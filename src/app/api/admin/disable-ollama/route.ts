import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase-admin';

/**
 * POST /api/admin/disable-ollama
 * Disables all Ollama-related providers in the database
 */
export async function POST() {
    try {
        const results: string[] = [];

        // Find and disable any Ollama providers
        const snapshot = await dbAdmin.collection('ai_providers').get();

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const name = (data.name || '').toLowerCase();
            const model = (data.model || '').toLowerCase();

            // Check if this is an Ollama provider
            if (name.includes('ollama') || model.includes('qwen2.5:') || model.includes('llama:')) {
                await dbAdmin.collection('ai_providers').doc(doc.id).update({
                    enabled: false
                });
                results.push(`Disabled: ${doc.id} (${data.name})`);
            }
        }

        if (results.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No Ollama providers found to disable',
                disabled: []
            });
        }

        return NextResponse.json({
            success: true,
            message: `Disabled ${results.length} Ollama provider(s)`,
            disabled: results
        });

    } catch (error: any) {
        console.error('Failed to disable Ollama:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
