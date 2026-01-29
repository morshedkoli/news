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

        const tagsData = await tagsResponse.json();
        const models = tagsData.models || [];

        // 2. Get currently running/loaded models
        let loadedModels: string[] = [];
        try {
            const psResponse = await fetch(`${endpoint}/api/ps`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });

            if (psResponse.ok) {
                const psData = await psResponse.json();
                loadedModels = (psData.models || []).map((m: any) => m.name || m.model);
            }
        } catch (e) {
            // ps endpoint might not be available in older versions
            console.warn('Could not fetch running models', e);
        }

        return NextResponse.json({
            online: true,
            models: models.map((m: any) => ({
                name: m.name,
                size: m.size,
                modified: m.modified_at,
                isLoaded: loadedModels.some(lm => lm.includes(m.name.split(':')[0]))
            })),
            loadedModels
        });

    } catch (error: any) {
        console.error('Ollama status check failed:', error);
        return NextResponse.json({
            online: false,
            error: error.message || 'Failed to connect to Ollama',
            models: []
        });
    }
}
