import { NextRequest, NextResponse } from 'next/server';
import { testProviderConnection } from '@/lib/ai-engine';
import { AiProvider } from '@/types/ai';
import {
    OPENROUTER_TEMPLATE,
    OLLAMA_TEMPLATE,
    BYTEZ_TEMPLATE,
    GROQ_TEMPLATE,
    HUGGINGFACE_TEMPLATE
} from '@/lib/ai-templates';

/**
 * POST /api/ai/status
 * Test a provider connection with the given credentials (without saving)
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { provider, config } = body;

        let template: Omit<AiProvider, 'id' | 'apiKey' | 'enabled'> | null = null;

        switch (provider) {
            case 'OpenRouter':
                template = OPENROUTER_TEMPLATE;
                break;
            case 'Ollama':
                template = OLLAMA_TEMPLATE;
                break;
            case 'Bytez':
                template = BYTEZ_TEMPLATE;
                break;
            case 'Groq':
                template = GROQ_TEMPLATE;
                break;
            case 'HuggingFace':
                template = HUGGINGFACE_TEMPLATE;
                break;
            default:
                return NextResponse.json({ success: false, message: 'Unknown provider' }, { status: 400 });
        }

        // Construct a temporary provider object
        const tempProvider: AiProvider = {
            id: 'test-provider',
            ...template,
            apiKey: config.apiKey,
            model: config.model || template.model,
            endpoint: config.endpoint || template.endpoint,
            enabled: true, // Force enabled for the test
            priority: 0
        };

        console.log(`🧪 Testing connection for ${provider}...`);
        const result = await testProviderConnection(tempProvider);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Status check failed:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
