import { NextResponse } from 'next/server';
import { getActiveProviders, testProviderConnection, updateProviderStatus } from '@/lib/ai-engine';
import { AiProvider } from '@/types/ai';

export const maxDuration = 60; // 1 minute max for health checks
export const revalidate = 0;

export async function GET() {
    try {
        const providers = await getActiveProviders();
        const results = [];

        console.log(`🏥 Health Check: Testing ${providers.length} providers...`);

        for (const provider of providers) {
            const result = await testProviderConnection(provider);
            const status = result.success ? 'online' : 'offline';
            await updateProviderStatus(provider.id, status);
            results.push({
                id: provider.id,
                provider: provider.name,
                status,
                latency: result.latencyMs,
                error: result.message
            });
            console.log(`   - ${provider.name}: ${status}`);
        }

        // --- Explicit Hardcoded Check for Local Ollama ---
        // Use exact same logic as /api/ollama/status to ensure consistency
        const localEndpoint = process.env.NEXT_PUBLIC_OLLAMA_API_URL || "http://localhost:11434";
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const localRes = await fetch(`${localEndpoint}/api/tags`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (localRes.ok) {
                results.push({
                    id: 'local-ollama',
                    provider: 'Ollama Local',
                    status: 'online',
                    latency: 50 // Dummy latency for tag check
                });
                console.log(`   - Ollama Local (Hardcoded): online (Tags OK)`);
            } else {
                throw new Error("Status " + localRes.status);
            }
        } catch (e: any) {
            results.push({
                id: 'local-ollama',
                provider: 'Ollama Local',
                status: 'offline',
                error: e.message
            });
            console.log(`   - Ollama Local (Hardcoded): offline (${e.message})`);
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            results
        });
    } catch (error: any) {
        console.error("Health check failed:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
