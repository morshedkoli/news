import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase-admin';
import { invalidateProviderCache } from '@/lib/ai-engine';
import { AiProvider } from '@/types/ai';


const OPENROUTER_DOC_ID = 'openrouter-official';
const OLLAMA_DOC_ID = 'ollama-local';
const BYTEZ_DOC_ID = 'bytez-official';
const GROQ_DOC_ID = 'groq-official';
const HUGGINGFACE_DOC_ID = 'huggingface-official';

// --- Templates ---
import {
    OPENROUTER_TEMPLATE,
    OLLAMA_TEMPLATE,
    BYTEZ_TEMPLATE,
    GROQ_TEMPLATE,
    HUGGINGFACE_TEMPLATE
} from '@/lib/ai-templates';



// --- Handlers ---

export async function GET() {
    try {
        const [openrouterDoc, ollamaDoc, bytezDoc, groqDoc, huggingfaceDoc] = await Promise.all([
            dbAdmin.collection('ai_providers').doc(OPENROUTER_DOC_ID).get(),
            dbAdmin.collection('ai_providers').doc(OLLAMA_DOC_ID).get(),
            dbAdmin.collection('ai_providers').doc(BYTEZ_DOC_ID).get(),
            dbAdmin.collection('ai_providers').doc(GROQ_DOC_ID).get(),
            dbAdmin.collection('ai_providers').doc(HUGGINGFACE_DOC_ID).get()
        ]);

        const openrouterData = openrouterDoc.exists ? openrouterDoc.data() : {};
        const ollamaData = ollamaDoc.exists ? ollamaDoc.data() : {};
        const bytezData = bytezDoc.exists ? bytezDoc.data() : {};
        const groqData = groqDoc.exists ? groqDoc.data() : {};
        const huggingfaceData = huggingfaceDoc.exists ? huggingfaceDoc.data() : {};


        return NextResponse.json({
            openrouter: {
                apiKey: openrouterData?.apiKey || '',
                enabled: openrouterData?.enabled ?? false,
                model: openrouterData?.model || 'google/gemini-2.0-flash-001',
                priority: openrouterData?.priority || OPENROUTER_TEMPLATE.priority
            },
            ollama: {
                endpoint: ollamaData?.endpoint || 'http://localhost:11434/api/chat',
                enabled: ollamaData?.enabled ?? false,
                model: ollamaData?.model || 'llama3.2',
                priority: ollamaData?.priority || OLLAMA_TEMPLATE.priority
            },
            bytez: {
                apiKey: bytezData?.apiKey || '',
                enabled: bytezData?.enabled ?? false,
                model: bytezData?.model || 'openai-community/gpt-2',
                priority: bytezData?.priority || BYTEZ_TEMPLATE.priority
            },
            groq: {
                apiKey: groqData?.apiKey || '',
                enabled: groqData?.enabled ?? false,
                model: groqData?.model || 'llama-3.3-70b-versatile',
                priority: groqData?.priority || GROQ_TEMPLATE.priority
            },
            huggingface: {
                apiKey: huggingfaceData?.apiKey || '',
                enabled: huggingfaceData?.enabled ?? false,
                model: huggingfaceData?.model || 'openai/gpt-oss-20b',
                priority: huggingfaceData?.priority || HUGGINGFACE_TEMPLATE.priority
            }
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { openrouter, ollama, bytez, groq, huggingface } = body;

        const promises = [];



        // Save OpenRouter
        if (openrouter) {
            const openrouterPayload = {
                ...OPENROUTER_TEMPLATE,
                apiKey: openrouter.apiKey,
                enabled: openrouter.enabled,
                model: openrouter.model || 'google/gemini-2.0-flash-001',
                priority: typeof openrouter.priority === 'number' ? openrouter.priority : OPENROUTER_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(OPENROUTER_DOC_ID).set(openrouterPayload, { merge: true }));
        }

        // Save Ollama
        if (ollama) {
            const ollamaPayload = {
                ...OLLAMA_TEMPLATE,
                endpoint: ollama.endpoint || 'http://localhost:11434/api/chat',
                enabled: ollama.enabled,
                model: ollama.model || 'llama3.2',
                priority: typeof ollama.priority === 'number' ? ollama.priority : OLLAMA_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(OLLAMA_DOC_ID).set(ollamaPayload, { merge: true }));
        }

        // Save Bytez
        if (bytez) {
            const bytezPayload = {
                ...BYTEZ_TEMPLATE,
                apiKey: bytez.apiKey,
                enabled: bytez.enabled,
                model: bytez.model || 'openai-community/gpt-2',
                priority: typeof bytez.priority === 'number' ? bytez.priority : BYTEZ_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(BYTEZ_DOC_ID).set(bytezPayload, { merge: true }));
        }

        // Save Groq
        if (groq) {
            const groqPayload = {
                ...GROQ_TEMPLATE,
                apiKey: groq.apiKey,
                enabled: groq.enabled,
                model: groq.model || 'llama-3.3-70b-versatile',
                priority: typeof groq.priority === 'number' ? groq.priority : GROQ_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(GROQ_DOC_ID).set(groqPayload, { merge: true }));
        }

        // Save Hugging Face
        if (huggingface) {
            const huggingfacePayload = {
                ...HUGGINGFACE_TEMPLATE,
                apiKey: huggingface.apiKey,
                enabled: huggingface.enabled,
                model: huggingface.model || 'openai/gpt-oss-20b',
                priority: typeof huggingface.priority === 'number' ? huggingface.priority : HUGGINGFACE_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(HUGGINGFACE_DOC_ID).set(huggingfacePayload, { merge: true }));
        }



        await Promise.all(promises);

        // Invalidate cache to apply changes immediately
        invalidateProviderCache();

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }
}
