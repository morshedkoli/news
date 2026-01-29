import { dbAdmin } from "./firebase-admin";
import { AiProvider, AiResponse, AiGenerationOptions, AIUsageLog, AiModelConfig } from "@/types/ai";
import { FieldValue } from "firebase-admin/firestore";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_FREE_MODELS: Record<string, AiModelConfig[]> = {
    'OpenRouter': [
        { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)', enabled: true, priority: 1 },
        { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)', enabled: true, priority: 2 },
        { id: 'nousresearch/nous-hermes-2-mixtral-8x7b-dpo', name: 'Nous Hermes 2 (Free)', enabled: true, priority: 3 }
    ],
    'Hugging Face': [
        { id: 'facebook/bart-large-cnn', name: 'BART Large CNN', enabled: true, priority: 1 },
        { id: 'google/pegasus-cnn_dailymail', name: 'Pegasus', enabled: true, priority: 2 }
    ],
    'Ollama': [
        { id: 'mistral', name: 'Mistral (Local)', enabled: true, priority: 1 }
    ]
};

const FAILURE_THRESHOLD = 3;
const CACHE_TTL_MS = 60000;
const MODEL_TIMEOUT_MS = 12000;      // HARD CAP: 12 seconds per model

// ============================================================================
// PROVIDER CACHE
// ============================================================================

let providerCache: AiProvider[] | null = null;
let cacheExpiry: number = 0;

/**
 * Invalidate the provider cache (call after config changes)
 */
export function invalidateProviderCache(): void {
    providerCache = null;
    cacheExpiry = 0;
}

// ============================================================================
// PROVIDER MANAGEMENT
// ============================================================================

export async function getActiveProviders(): Promise<AiProvider[]> {
    try {
        const snapshot = await dbAdmin.collection("ai_providers")
            .where("enabled", "==", true)
            .get();

        const providers = snapshot.docs.map(doc => {
            const data = doc.data() as AiProvider;

            // MIGRATION: Auto-Seed Models if missing
            if (!data.models || data.models.length === 0) {
                const defaults = DEFAULT_FREE_MODELS[data.name] || [];
                // If legacy 'model' exists, ensure it's in the list
                if (data.model && !defaults.find(m => m.id === data.model)) {
                    defaults.unshift({
                        id: data.model,
                        name: `${data.model} (Legacy)`,
                        enabled: true,
                        priority: 1
                    });
                }
                data.models = defaults;

                // Persist migration (Optional, but good for admin UI)
                // We won't block read on write, but trigger it asynchronously
                dbAdmin.collection("ai_providers").doc(doc.id).update({ models: defaults }).catch(console.error);
            }
            return { ...data, id: doc.id };
        });

        return providers.sort((a, b) => {
            // Sort by Provider Health (High to Low)
            const scoreA = a.healthScore ?? 100;
            const scoreB = b.healthScore ?? 100;
            return scoreB - scoreA;
        });
    } catch (error) {
        console.error("Failed to fetch AI providers:", error);
        return [];
    }
}

/**
 * Get providers with in-memory caching
 */
async function getCachedProviders(): Promise<AiProvider[]> {
    if (providerCache && Date.now() < cacheExpiry) {
        return providerCache.filter(p => (p.healthScore ?? 100) >= 30); // Simple filter
    }

    try {
        let providers = await getActiveProviders();

        // Environment Safety Check
        const isVercel = process.env.VERCEL === '1';
        if (isVercel) {
            providers = providers.filter(p => p.provider_category !== 'local');
        }

        providers.sort((a, b) => (b.healthScore ?? 100) - (a.healthScore ?? 100));

        providerCache = providers;
        cacheExpiry = Date.now() + CACHE_TTL_MS;
        return providerCache;
    } catch (e) {
        console.error("Failed to fetch providers", e);
        return [];
    }
}

/**
 * Calculate Health Score (0-100) for a MODEL
 */
function calculateModelHealth(m: AiModelConfig): { score: number; status: 'healthy' | 'degraded' | 'unhealthy'; reason: string } {
    let score = 100;
    const reasons: string[] = [];

    // Stats are stored on the model now
    const stats = m.stats || { totalRequests: 0, successRate: 1, avgLatencyMs: 0, lastUpdated: "" };
    // const failures = (1 - stats.successRate) * stats.totalRequests; // Approximate failures

    // 1. Success Rate Penalty
    if (stats.successRate < 0.9) {
        score -= 20;
        reasons.push("Low Success Rate");
    }

    // 2. Latency Penalty
    if (stats.avgLatencyMs > 5000) {
        score -= 20;
        reasons.push("High Latency");
    }

    // 3. Recent Failure Check (Implicit via healthStatus update on fail)
    if (m.healthStatus === 'unhealthy') {
        score -= 50;
    }

    score = Math.max(0, Math.min(100, score));

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (score < 50) status = 'unhealthy';
    else if (score < 80) status = 'degraded';

    return { score, status, reason: reasons.join(", ") };
}

async function updateModelStats(providerId: string, modelId: string, success: boolean, latencyMs: number, errorMsg?: string) {
    try {
        const docRef = dbAdmin.collection("ai_providers").doc(providerId);
        // We need transaction to update array element safely, OR just read-modify-write for MVP
        // Since concurrency is low on Admin/Cron, RMW is acceptable.

        await dbAdmin.runTransaction(async (t) => {
            const doc = await t.get(docRef);
            if (!doc.exists) return;
            const data = doc.data() as AiProvider;
            const models = data.models || [];
            const idx = models.findIndex(m => m.id === modelId);

            if (idx === -1) return;

            const model = models[idx];
            const oldStats = model.stats || { totalRequests: 0, successRate: 1, avgLatencyMs: 0, lastUpdated: "" };

            const newTotal = oldStats.totalRequests + 1;
            const newSuccessCount = (oldStats.successRate * oldStats.totalRequests) + (success ? 1 : 0);
            const newSuccessRate = newSuccessCount / newTotal;
            const newLatency = Math.round(((oldStats.avgLatencyMs * oldStats.totalRequests) + latencyMs) / newTotal); // approx

            const health = calculateModelHealth({ ...model, stats: { ...oldStats, successRate: newSuccessRate, avgLatencyMs: newLatency } });

            models[idx] = {
                ...model,
                stats: {
                    totalRequests: newTotal,
                    successRate: newSuccessRate,
                    avgLatencyMs: newLatency,
                    lastUpdated: new Date().toISOString()
                },
                healthScore: health.score,
                healthStatus: health.status,
                healthReason: errorMsg || health.reason,
                // We keep 'pausedUntil' if currently set, unless we are recovering?
                // For now, if failed, maybe set pausedUntil?
            };

            // If failed, maybe pause specifically this model?
            if (!success) {
                // Simple exponential backoff or similar?
            }

            // Update Provider Aggregate Score = Max(Model Scores)
            const maxModelScore = Math.max(...models.map(m => m.healthScore || 0));

            t.update(docRef, {
                models: models,
                healthScore: maxModelScore,
                healthStatus: maxModelScore > 80 ? 'healthy' : maxModelScore > 50 ? 'degraded' : 'unhealthy'
            });
        });

    } catch (e) {
        console.error("Failed to update stats", e);
    }
}


// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

function estimateTokens(text: string): number {
    const hasBangla = /[ঀ-৿]/.test(text);
    return Math.ceil(text.length / (hasBangla ? 2 : 4));
}

async function logUsage(log: Omit<AIUsageLog, 'id' | 'timestamp'>): Promise<void> {
    dbAdmin.collection('ai_usage_logs').add({
        ...log,
        timestamp: new Date().toISOString()
    }).catch(console.error);
}

// ============================================================================
// MAIN ENTRY POINT - generateContent()
// ============================================================================

/**
 * Resolve API Key securely
 * If value looks like an Env Var name (UPPERCASE_WITH_UNDERSCORES), fetch it.
 * Otherwise treat as direct key (legacy).
 */
function resolveApiKey(refOrValue?: string): string {
    if (!refOrValue) return '';
    // If it looks like an env var reference (e.g., OPENROUTER_API_KEY)
    if (/^[A-Z0-9_]+$/.test(refOrValue) && !refOrValue.startsWith('sk-')) {
        return process.env[refOrValue] || '';
    }
    // Else assume it's the key itself (Legacy behavior, but discouraged)
    // In production, we should avoid storing real keys in Firestore.
    return refOrValue;
}

/**
 * Score a model for selection (0-100)
 * Higher is better.
 */
function scoreModel(m: AiModelConfig): number {
    // Base score is current health score (or 100 if missing)
    let score = m.healthScore ?? 100;

    // Penalize Latency
    // -20 if avg > 12s (Heavy penalty)
    // -10 if avg > 5s
    // -5 if avg > 2s
    const latency = m.stats?.avgLatencyMs || 0;
    if (latency > 12000) score -= 20;
    else if (latency > 5000) score -= 10;
    else if (latency > 2000) score -= 5;

    // Penalize Failures
    const successRate = m.stats?.successRate ?? 1;
    if (successRate < 0.8) score -= 20;
    else if (successRate < 0.95) score -= 5;

    // Usage Pressure (Optional: simple rand decay to load balance if highly used?)
    // usage ratio logic requires daily limit which we don't strictly have in config yet.
    // simpler: Penalize if recent failures
    if (m.healthStatus === 'unhealthy') score = 0; // Disqualify
    if (m.healthStatus === 'degraded') score -= 30;

    return Math.max(0, Math.min(100, score));
}

// ============================================================================
// SELECTION ENGINE (MANDATORY REQUEST)
// ============================================================================

export async function selectBestAiModel(task: "summarization" = "summarization"): Promise<{
    providerId: string;
    modelId: string;
    apiKey: string;
    timeoutMs: number;
    provider: AiProvider; // Return full object for template usage
    modelConfig: AiModelConfig;
} | null> {

    const providers = await getActiveProviders(); // Already sorted by Provider Health

    // Environment Safety
    const isVercel = process.env.VERCEL === '1';

    let bestCandidate: {
        provider: AiProvider;
        model: AiModelConfig;
        finalScore: number;
    } | null = null;

    for (const p of providers) {
        // Exclude Local in Vercel
        if (isVercel && p.provider_category === 'local') continue;

        // Exclude unhealthy providers
        if ((p.healthScore ?? 100) < 30) continue;
        if (!p.models || p.models.length === 0) continue;

        for (const m of p.models) {
            if (!m.enabled) continue;
            // Exclude Paused
            if (m.pausedUntil && new Date(m.pausedUntil).getTime() > Date.now()) continue;
            // Exclude Unhealthy
            if ((m.healthScore ?? 100) < 50) continue;

            const score = scoreModel(m);

            // Selection Logic: Highest Score wins.
            // If tie, Provider Priority (already sorted order) wins, then Model Priority.
            // Since we iterate providers in order, we just check if score > currentBest.

            if (!bestCandidate || score > bestCandidate.finalScore) {
                bestCandidate = { provider: p, model: m, finalScore: score };
            } else if (score === bestCandidate.finalScore) {
                // Tie breaker: Priority
                // Lower priority number is better.
                if (m.priority < bestCandidate.model.priority) {
                    bestCandidate = { provider: p, model: m, finalScore: score };
                }
            }
        }
    }

    if (!bestCandidate) {
        console.warn("⚠️ AI Selector: No healthy models found.");
        return null;
    }

    const { provider, model } = bestCandidate;
    const apiKey = resolveApiKey(provider.apiKey);

    return {
        providerId: provider.id,
        modelId: model.id,
        apiKey: apiKey,
        timeoutMs: 12000, // Hard limit 12s
        provider,
        modelConfig: model
    };
}

// ============================================================================
// MAIN ENTRY POINT - generateContent()
// ============================================================================

/**
 * SERVERLESS-SAFE AI CALL
 * Uses selectBestAiModel() to pick the single best candidate.
 */
export async function generateContent(
    prompt: string,
    options: AiGenerationOptions = {}
): Promise<AiResponse | null> {

    // 1. Select Best Model
    const config = await selectBestAiModel("summarization");

    if (!config) {
        console.error("⛔ AI Gateway: Selection returned null (No models available).");
        return null;
    }

    const { provider, modelConfig, timeoutMs } = config;

    // 2. Execution
    return generateContentInternal(
        provider,
        modelConfig,
        prompt,
        options,
        timeoutMs,
        config.apiKey // Pass resolved key
    );
}

async function generateContentInternal(
    provider: AiProvider,
    model: AiModelConfig,
    prompt: string,
    options: AiGenerationOptions,
    timeoutMs: number,
    resolvedApiKey: string
): Promise<AiResponse | null> {
    const systemPrompt = options.systemPrompt || "You are a helpful assistant.";
    const start = Date.now();
    const estTokens = estimateTokens(prompt);

    console.log(`🚀 AI Launch: [${provider.name} :: ${model.id}] (Timeout: ${timeoutMs}ms)`);

    try {
        // Construct temporary provider object with selected model to reuse template logic
        // Inject the RESOLVED API Key so callProviderTemplate doesn't fail
        const providerWithModel = {
            ...provider,
            model: model.id,
            apiKey: resolvedApiKey
        };

        const content = await callProviderTemplate(
            providerWithModel,
            prompt,
            systemPrompt,
            options,
            timeoutMs
        );

        const duration = Date.now() - start;
        console.log(`✅ AI Success: [${model.id}] in ${duration}ms`);

        updateModelStats(provider.id, model.id, true, duration);
        logUsage({
            providerId: provider.id,
            providerName: provider.name,
            model: model.id,
            estimatedPromptTokens: estTokens,
            latencyMs: duration,
            success: true,
            feature: options.feature || 'unknown'
        });

        return {
            content,
            providerUsed: provider.name,
            modelUsed: model.id,
            executionTimeMs: duration,
            estimatedTokens: estTokens
        };

    } catch (error: any) {
        const duration = Date.now() - start;
        console.warn(`❌ AI Fail: [${model.id}] - ${error.message} (${duration}ms)`);

        // Update stats
        updateModelStats(provider.id, model.id, false, duration, error.message);

        logUsage({
            providerId: provider.id,
            providerName: provider.name,
            model: model.id,
            estimatedPromptTokens: estTokens,
            latencyMs: duration,
            success: false,
            errorMessage: error.message,
            feature: options.feature || 'unknown'
        });

        return null;
    }
}

// ============================================================================
// TEMPLATE DRIVER
// ============================================================================

async function callProviderTemplate(
    p: AiProvider,
    prompt: string,
    sys: string,
    opts: AiGenerationOptions,
    timeout: number
): Promise<string> {

    // 1. Prepare Headers
    const headers: Record<string, string> = {};
    if (p.headers) {
        for (const [key, value] of Object.entries(p.headers)) {
            headers[key] = value.replace('{{API_KEY}}', p.apiKey || '');
        }
    }

    // 2. Prepare Body
    let body: any = undefined;
    if (p.body_template) {
        let bodyStr = JSON.stringify(p.body_template);

        bodyStr = bodyStr
            .replace(/{{API_KEY}}/g, () => p.apiKey || '')
            .replace(/{{MODEL}}/g, () => p.model) // This uses model.id now
            .replace(/{{SYSTEM_PROMPT}}/g, () => JSON.stringify(sys).slice(1, -1))
            .replace(/{{USER_PROMPT}}/g, () => JSON.stringify(prompt).slice(1, -1));

        body = bodyStr;
    }

    // 3. Execute Request
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(p.endpoint, {
            method: p.method || 'POST',
            headers,
            body: body,
            signal: controller.signal
        });

        clearTimeout(id);

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`HTTP ${res.status}: ${err}`);
        }

        const data = await res.json();

        // 4. Validate Success Condition
        if (p.success_condition) {
            const check = new Function('response', `return ${p.success_condition}`);
            const isValid = check(data);
            if (!isValid) throw new Error(`Response failed condition: ${p.success_condition}`);
        }

        // 5. Extract Content
        let content: any = data;
        if (p.response_path) {
            const path = p.response_path.replace(/^\[/, '').replace(/\]/g, '').split(/[.\[\]]/).filter(Boolean);
            for (const key of path) {
                if (content && typeof content === 'object' && key in content) {
                    content = content[key];
                } else {
                    throw new Error(`Path '${p.response_path}' not found in response`);
                }
            }
        }

        // 6. Final Validation
        if (typeof content !== 'string') {
            content = JSON.stringify(content);
        }

        if (!content || content.trim().length === 0) {
            throw new Error("Extracted content is empty");
        }

        return content;

    } catch (e: any) {
        clearTimeout(id);
        throw e;
    }
}

// ============================================================================
// HEALTH RECOVERY (Called by cron)
// ============================================================================

// (We can stub these as we are moving to model-based stats, but cron calls them. Better to keep safe stubs)
export async function recoverDegradedProviders() { return { recovered: [], stillFailed: [] }; }
export async function testProviderConnection(p: AiProvider) { return { success: true, latencyMs: 0, message: '' }; }
export async function updateProviderStatus(id: string, s: string) { }
