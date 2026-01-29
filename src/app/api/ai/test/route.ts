import { NextRequest, NextResponse } from 'next/server';
import { AiProvider } from '@/types/ai';
import { testProviderConnection } from '@/lib/ai-engine';

export async function POST(req: NextRequest) {
    try {
        const provider = await req.json() as AiProvider;
        const result = await testProviderConnection(provider);

        if (result.success) {
            return NextResponse.json({ success: true, latency: result.latencyMs });
        } else {
            return NextResponse.json({ success: false, message: result.message }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
