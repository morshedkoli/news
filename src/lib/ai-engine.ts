import { dbAdmin } from "./firebase-admin";
import { AiProvider, AiResponse, AiGenerationOptions } from "@/types/ai";

/**
 * AI Engine: Manages multiple AI providers with failover logic.
 * Unified System: Supports generic HTTP APIs via templates.
 */

// --- 1. Provider Management ---

export async function getActiveProviders(): Promise<AiProvider[]> {
    try {
        const snapshot = await dbAdmin.collection("ai_providers")
            .where("enabled", "==", true)
            .get();

        const providers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AiProvider));

        // Sort: 
        // 1. Priority: ASC (Lower number = Higher priority)
        // 2. Tie-breaker: id
        return providers.sort((a, b) => {
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
        await dbAdmin.collection("ai_providers").doc(id).update({
            lastStatus: status,
            lastChecked: new Date().toISOString()
        });
    } catch (e) {
        console.warn(`Failed to update status for provider ${id}`, e);
    }
}

export async function testProviderConnection(provider: AiProvider): Promise<{ success: boolean; message?: string; latencyMs?: number }> {
    const startTime = Date.now();
    try {
        await callProviderTemplate(
            provider,
            "Ping",
            "You are a connection tester. Reply with 'Pong'.",
            {},
            20000 // 20s timeout for tests
        );
        const duration = Date.now() - startTime;
        return { success: true, latencyMs: duration };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}


// --- 2. Core Execution Logic ---

export async function generateContent(prompt: string, options: AiGenerationOptions = {}): Promise<AiResponse | null> {
    const providers = await getActiveProviders();

    if (providers.length === 0) {
        console.error("⛔ AI Engine: No enabled providers found.");
        return null;
    }

    const systemPrompt = options.systemPrompt || "You are a helpful assistant.";
    const timeoutMs = 120000; // 2 minutes global timeout per provider

    // Strict Sequential Loop
    for (const provider of providers) {
        // Filter by Category if specified
        if (options.allowedCategories && options.allowedCategories.length > 0) {
            if (!provider.provider_category || !options.allowedCategories.includes(provider.provider_category)) {
                continue;
            }
        }

        const categoryLabel = provider.provider_category ? provider.provider_category.toUpperCase() : 'UNKNOWN';
        console.log(`🤖 AI Engine: Trying [${categoryLabel}] provider: ${provider.name} (${provider.model})...`);

        const startTime = Date.now();

        try {
            let content: string | null = null;

            // Unified Driver Call
            content = await callProviderTemplate(provider, prompt, systemPrompt, options, timeoutMs);

            if (content) {
                const duration = Date.now() - startTime;
                console.log(`✅ AI Engine: Success with [${provider.name}] in ${duration}ms`);

                updateProviderStatus(provider.id, 'online');

                return {
                    content,
                    providerUsed: provider.name,
                    modelUsed: provider.model,
                    executionTimeMs: duration
                };
            }

        } catch (error: any) {
            console.warn(`⚠️ AI Engine: Provider [${provider.name}] failed:`, error.message);
            updateProviderStatus(provider.id, 'offline');
            // Continue to next provider...
        }
    }

    console.error("⛔ AI Engine: All providers failed.");
    return null;
}

// --- 3. Unified Template Driver ---

/**
 * Executes a provider template with dynamic macro replacement.
 */
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
        console.log(`🔌 [AI Engine] ${p.name} Headers:`, Object.keys(headers).join(", "));
    } else {
        console.warn(`⚠️ [AI Engine] ${p.name} has NO headers configured.`);
    }

    // 2. Prepare Body
    let body: any = undefined;
    if (p.body_template) {
        let bodyStr = JSON.stringify(p.body_template);

        // Dynamic Variable Replacement
        bodyStr = bodyStr
            .replace(/{{API_KEY}}/g, () => p.apiKey || '')
            .replace(/{{MODEL}}/g, () => p.model)
            .replace(/{{SYSTEM_PROMPT}}/g, () => JSON.stringify(sys).slice(1, -1))
            .replace(/{{USER_PROMPT}}/g, () => JSON.stringify(prompt).slice(1, -1));

        body = bodyStr; // It's a string now, ready for sending
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

        // 4. Validate Success Condition (Safe Eval)
        if (p.success_condition) {
            // Create a safe context for evaluation
            const check = new Function('response', `return ${p.success_condition}`);
            const isValid = check(data);
            if (!isValid) throw new Error(`Response failed success condition: ${p.success_condition}`);
        }

        // 5. Extract Content using Response Path
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

        // Bangla Validation (Heuristic: > 5% English words)
        // const englishWordCount = (content.match(/[a-zA-Z]+/g) || []).length;
        // const totalWordCount = content.split(/\s+/).length;
        // if (englishWordCount / totalWordCount > 0.10) { 
        //    console.warn("⚠️ Warning: High English content detected");
        // }

        return content;

    } catch (e: any) {
        clearTimeout(id);
        throw e;
    }
}

