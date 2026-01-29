import { NextResponse } from 'next/server';
import {
    getActiveProviders,
    testProviderConnection,
    updateProviderStatus,
    recoverDegradedProviders,
    invalidateProviderCache
} from '@/lib/ai-engine';
import { dbAdmin } from '@/lib/firebase-admin';

export const maxDuration = 60;
export const revalidate = 0;

/**
 * AI Health Check Cron
 * 
 * 1. Tests all active providers
 * 2. Recovers degraded providers
 * 3. Updates status in database
 */
export async function GET() {
    try {
        console.log(`🏥 AI Health Check: Starting...`);

        // 1. Test active providers
        const providers = await getActiveProviders();
        const results = [];

        console.log(`   Testing ${providers.length} active providers...`);

        for (const provider of providers) {
            const result = await testProviderConnection(provider);
            const status = result.success ? 'online' : 'offline';
            await updateProviderStatus(provider.id, status);
            results.push({
                id: provider.id,
                provider: provider.name,
                model: provider.model,
                status,
                latency: result.latencyMs,
                error: result.message
            });
            console.log(`   - ${provider.name}: ${status} ${result.latencyMs ? `(${result.latencyMs}ms)` : ''}`);
        }

        // 2. Recover degraded providers
        console.log(`   Checking for degraded providers to recover...`);
        const recovery = await recoverDegradedProviders();

        if (recovery.recovered.length > 0) {
            console.log(`   ✅ Recovered: ${recovery.recovered.join(', ')}`);
        }
        if (recovery.stillFailed.length > 0) {
            console.log(`   ❌ Still failing: ${recovery.stillFailed.join(', ')}`);
        }

        // 3. Invalidate cache to pick up changes
        invalidateProviderCache();

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            activeProviders: results,
            recovery: {
                recovered: recovery.recovered,
                stillFailed: recovery.stillFailed
            }
        });

    } catch (error: any) {
        console.error("Health check failed:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
