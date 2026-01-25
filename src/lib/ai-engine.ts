import { dbAdmin } from "./firebase-admin";
import { AiProvider, AiResponse, AiGenerationOptions, AIUsageLog } from "@/types/ai";
import { FieldValue } from "firebase-admin/firestore";

/**
 * ============================================================================
 * GLOBAL AI GATEWAY
 * ============================================================================
 * 
 * This is the SINGLE entry point for all AI operations.
 * All AI calls MUST go through generateContent().
 * 
 * Features:
 * - Priority-based provider selection
 * - Automatic failover on errors
 * - In-memory provider cache
 * - Health tracking & auto-degradation
 * - Usage logging
 * - Token estimation
 * 
 * ============================================================================
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const OPENROUTER_FREE_MODELS = [
    'google/gemini-2.0-flash-exp:free',
    'google/gemini-exp-1206:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen2.5-vl-72b-instruct:free',
    'deepseek/deepseek-r1:free',
    'nvidia/llama-3.1-nemotron-70b-instruct:free',
    'mistralai/mistral-small-24b-instruct-2501:free'
];

const FAILURE_THRESHOLD = 3;         // Auto-degrade after N consecutive failures
const CACHE_TTL_MS = 60000;          // Provider cache TTL: 1 minute
const DEFAULT_TIMEOUT_MS = 60000;    // Default request timeout: 60 seconds
const LOCAL_PROVIDER_TIMEOUT_MS = 45000; // Shorter timeout for local providers

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
    console.log("🔄 AI Gateway: Provider cache invalidated");
}

/**
 * Get providers with in-memory caching
 */
async function getCachedProviders(): Promise<AiProvider[]> {
    if (providerCache && Date.now() < cacheExpiry) {
        return providerCache;
    }
    providerCache = await getActiveProviders();
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return providerCache;
}

// ============================================================================
// PROVIDER MANAGEMENT
// ============================================================================

export async function getActiveProviders(): Promise<AiProvider[]> {
    try {
        const snapshot = await dbAdmin.collection("ai_providers")
            .where("enabled", "==", true)
            .get();

        const providers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AiProvider));

        // Filter out unhealthy providers (isHealthy === false)
        const healthyProviders = providers.filter(p => p.isHealthy !== false);

        // Sort: Priority ASC (Lower = Higher priority)
        return healthyProviders.sort((a, b) => {
            const priorityA = a.priority ?? 999;
            const priorityB = b.priority ?? 999;
            if (priorityA !== priorityB) return priorityA - priorityB;
            return a.id.localeCompare(b.id);
        });
    } catch (error) {
        console.error("Failed to fetch AI providers:", error);
        return [];
    }
}

export async function updateProviderStatus(id: string, status: 'online' | 'offline') {
    try {
        const updateData: any = {
            lastStatus: status,
            lastChecked: new Date().toISOString()
        };

        // Reset failure count on success
        if (status === 'online') {
            updateData.failureCount = 0;
            updateData.isHealthy = true;
        }

        await dbAdmin.collection("ai_providers").doc(id).update(updateData);
    } catch (e) {
        console.warn(`Failed to update status for provider ${id}`, e);
    }
}

/**
 * Mark provider as failed and auto-degrade if threshold exceeded
 */
async function markProviderFailed(id: string, errorMessage: string): Promise<void> {
    try {
        const ref = dbAdmin.collection('ai_providers').doc(id);

        await ref.update({
            lastStatus: 'offline',
            lastChecked: new Date().toISOString(),
            failureCount: FieldValue.increment(1),
            lastFailureAt: new Date().toISOString(),
            lastError: errorMessage.substring(0, 500)
        });

        // Check if threshold exceeded
        const doc = await ref.get();
        const failureCount = doc.data()?.failureCount || 0;

        if (failureCount >= FAILURE_THRESHOLD) {
            await ref.update({ isHealthy: false });
            console.warn(`🚫 AI Gateway: Provider ${id} auto-degraded after ${failureCount} failures`);
            invalidateProviderCache();
        }
    } catch (e) {
        console.warn(`Failed to mark provider ${id} as failed`, e);
    }
}

export async function testProviderConnection(provider: AiProvider): Promise<{ success: boolean; message?: string; latencyMs?: number }> {
    const startTime = Date.now();
    try {
        await callProviderTemplate(
            provider,
            "Ping",
            "You are a connection tester. Reply with 'Pong'.",
            { feature: 'health_check' },
            20000
        );
        const duration = Date.now() - startTime;
        return { success: true, latencyMs: duration };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Estimate token count for text (rough heuristic)
 * ~4 characters per token for English, ~2 for Bangla
 */
function estimateTokens(text: string): number {
    const hasBangla = /[ঀ-৿]/.test(text);
    const charsPerToken = hasBangla ? 2 : 4;
    return Math.ceil(text.length / charsPerToken);
}

// ============================================================================
// USAGE LOGGING
// ============================================================================

async function logUsage(log: Omit<AIUsageLog, 'id' | 'timestamp'>): Promise<void> {
    try {
        await dbAdmin.collection('ai_usage_logs').add({
            ...log,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.warn("Failed to log AI usage", e);
    }
}

// ============================================================================
// MAIN ENTRY POINT - generateContent()
// ============================================================================

/**
 * ⚠️ THIS IS THE ONLY FUNCTION ALLOWED TO INVOKE ANY AI PROVIDER ⚠️
 * 
 * All AI calls in the entire codebase MUST go through this function.
 * No direct SDK calls are allowed anywhere else.
 */
export async function generateContent(
    prompt: string,
    options: AiGenerationOptions = {}
): Promise<AiResponse | null> {
    const providers = await getCachedProviders();

    if (providers.length === 0) {
        console.error("⛔ AI Gateway: No enabled/healthy providers found.");
        return null;
    }

    const systemPrompt = options.systemPrompt || "You are a helpful assistant.";
    const timeoutMs = DEFAULT_TIMEOUT_MS;
    const feature = options.feature || 'unknown';
    const estimatedTokens = estimateTokens(prompt + (systemPrompt || ''));

    console.log(`🤖 AI Gateway: Request received [feature=${feature}, ~${estimatedTokens} tokens]`);

    // Sequential provider loop with failover
    for (const provider of providers) {
        // Filter by category if specified
        if (options.allowedCategories?.length) {
            if (!provider.provider_category || !options.allowedCategories.includes(provider.provider_category)) {
                continue;
            }
        }

        const categoryLabel = provider.provider_category?.toUpperCase() || 'UNKNOWN';
        console.log(`🔌 AI Gateway: Trying [${categoryLabel}] ${provider.name} (${provider.model})...`);

        const startTime = Date.now();

        // Use shorter timeout for local providers
        const providerTimeout = provider.provider_category === 'local'
            ? LOCAL_PROVIDER_TIMEOUT_MS
            : (provider.timeout_ms || DEFAULT_TIMEOUT_MS);

        try {
            let content: string | null = null;
            let modelUsed = provider.model;

            // OpenRouter special handling with fallback models
            if (provider.name === 'OpenRouter') {
                const result = await callOpenRouterWithFallback(provider, prompt, systemPrompt, options, providerTimeout);
                content = result.content;
                modelUsed = result.modelUsed;
            } else {
                content = await callProviderTemplate(provider, prompt, systemPrompt, options, providerTimeout);
            }

            if (content) {
                const duration = Date.now() - startTime;
                console.log(`✅ AI Gateway: Success with ${provider.name} (${modelUsed}) in ${duration}ms`);

                // Update provider status
                updateProviderStatus(provider.id, 'online');

                // Log usage (async, non-blocking)
                logUsage({
                    providerId: provider.id,
                    providerName: provider.name,
                    model: modelUsed,
                    estimatedPromptTokens: estimatedTokens,
                    latencyMs: duration,
                    success: true,
                    feature
                });

                return {
                    content,
                    providerUsed: provider.name,
                    modelUsed: modelUsed,
                    executionTimeMs: duration,
                    estimatedTokens
                };
            }

        } catch (error: any) {
            const duration = Date.now() - startTime;
            console.warn(`⚠️ AI Gateway: ${provider.name} failed:`, error.message);

            // Mark provider as failed
            markProviderFailed(provider.id, error.message);

            // Log failed attempt
            logUsage({
                providerId: provider.id,
                providerName: provider.name,
                model: provider.model,
                estimatedPromptTokens: estimatedTokens,
                latencyMs: duration,
                success: false,
                errorMessage: error.message?.substring(0, 200),
                feature
            });
        }
    }

    console.error("⛔ AI Gateway: All providers failed.");
    return null;
}

// ============================================================================
// OPENROUTER FALLBACK LOGIC
// ============================================================================

async function callOpenRouterWithFallback(
    provider: AiProvider,
    prompt: string,
    systemPrompt: string,
    options: AiGenerationOptions,
    timeoutMs: number
): Promise<{ content: string; modelUsed: string }> {

    const modelsToTry = [provider.model];

    for (const fallbackModel of OPENROUTER_FREE_MODELS) {
        if (fallbackModel !== provider.model && !modelsToTry.includes(fallbackModel)) {
            modelsToTry.push(fallbackModel);
        }
    }

    let lastError: Error | null = null;

    for (let i = 0; i < modelsToTry.length; i++) {
        const model = modelsToTry[i];
        const isRetry = i > 0;

        if (isRetry) {
            console.log(`🔄 OpenRouter: Trying fallback model [${model}]...`);
        }

        try {
            const providerWithModel = { ...provider, model };
            const content = await callProviderTemplate(providerWithModel, prompt, systemPrompt, options, timeoutMs);

            if (content) {
                if (isRetry) {
                    console.log(`✅ OpenRouter: Fallback model [${model}] succeeded!`);
                }
                return { content, modelUsed: model };
            }
        } catch (error: any) {
            lastError = error;
            console.warn(`⚠️ OpenRouter: Model [${model}] failed: ${error.message}`);
        }
    }

    throw lastError || new Error("All OpenRouter models failed");
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
            .replace(/{{MODEL}}/g, () => p.model)
            .replace(/{{SYSTEM_PROMPT}}/g, () => JSON.stringify(sys).slice(1, -1))
            .replace(/{{USER_PROMPT}}/g, () => JSON.stringify(prompt).slice(1, -1));

        body = bodyStr;
    }

    // 3. Execute Request
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), p.timeout_ms || timeout);

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

/**
 * Recover degraded providers by testing them
 */
export async function recoverDegradedProviders(): Promise<{ recovered: string[]; stillFailed: string[] }> {
    const recovered: string[] = [];
    const stillFailed: string[] = [];

    try {
        const snapshot = await dbAdmin.collection("ai_providers")
            .where("enabled", "==", true)
            .where("isHealthy", "==", false)
            .get();

        for (const doc of snapshot.docs) {
            const provider = { id: doc.id, ...doc.data() } as AiProvider;

            console.log(`🔧 AI Gateway: Testing degraded provider ${provider.name}...`);

            const result = await testProviderConnection(provider);

            if (result.success) {
                await dbAdmin.collection("ai_providers").doc(doc.id).update({
                    isHealthy: true,
                    failureCount: 0,
                    lastStatus: 'online',
                    lastChecked: new Date().toISOString()
                });
                recovered.push(provider.name);
                console.log(`✅ AI Gateway: Provider ${provider.name} recovered!`);
            } else {
                stillFailed.push(provider.name);
                console.log(`❌ AI Gateway: Provider ${provider.name} still failing: ${result.message}`);
            }
        }

        if (recovered.length > 0) {
            invalidateProviderCache();
        }

    } catch (e) {
        console.error("Failed to run provider recovery", e);
    }

    return { recovered, stillFailed };
}
