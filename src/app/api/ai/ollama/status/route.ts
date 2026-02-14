import { NextResponse } from 'next/server';

/**
 * GET /api/ai/ollama/status
 * Checks Ollama status and returns loaded models
 */
export async function GET() {
    try {
        // Get Ollama endpoint from query or use default
        const endpoint = 'http://localhost:11434';

        // 1. Check if Ollama is running
        const tagsResponse = await fetch(`${endpoint}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!tagsResponse.ok) {
            return NextResponse.json({
                online: false,
                error: 'Ollama not responding',
                models: []
            });
        }

        const tagsData: { models?: unknown } = await tagsResponse.json();
        type OllamaTagModel = { name?: string; size?: number; modified_at?: string };
        const models = Array.isArray(tagsData.models) ? (tagsData.models as OllamaTagModel[]) : [];

        // 2. Get currently running/loaded models
        let loadedModels: string[] = [];
        try {
            const psResponse = await fetch(`${endpoint}/api/ps`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });

            if (psResponse.ok) {
                const psData: { models?: unknown } = await psResponse.json();
                const running = Array.isArray(psData.models) ? (psData.models as Array<{ name?: string; model?: string }>) : [];
                loadedModels = running.map((m) => m.name || m.model || '').filter(Boolean);
            }
        } catch (e) {
            // ps endpoint might not be available in older versions
            console.warn('Could not fetch running models', e);
        }

        return NextResponse.json({
            online: true,
            models: models.map((m) => {
                const name = m.name || "";
                return {
                    name,
                    size: m.size,
                    modified: m.modified_at,
                    isLoaded: name ? loadedModels.some(lm => lm.includes(name.split(':')[0])) : false
                };
            }),
            loadedModels
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error('Ollama status check failed:', error);
        return NextResponse.json({
            online: false,
            error: message || 'Failed to connect to Ollama',
            models: []
        });
    }
}
