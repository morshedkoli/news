import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase-admin';
import { AiProvider } from '@/types/ai';

const OPENAI_DOC_ID = 'openai-official';
const OPENROUTER_DOC_ID = 'openrouter-official';
const OLLAMA_DOC_ID = 'local-ollama';

// --- Templates ---

const GOOGLE_DOC_ID = 'google-gemini';

// --- Templates ---

const GOOGLE_TEMPLATE: Omit<AiProvider, 'id' | 'apiKey' | 'enabled'> = {
    name: "Google Gemini",
    type: "openai-compatible", // Reusing generic engine logic, just different endpoint/headers
    provider_category: "free",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{{MODEL}}:generateContent?key={{API_KEY}}",
    model: "gemini-1.5-flash",
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body_template: {
        "contents": [{
            "parts": [{ "text": "{{USER_PROMPT}}" }]
        }],
        "systemInstruction": {
            "parts": [{ "text": "{{SYSTEM_PROMPT}}" }]
        }
    },
    response_path: "candidates[0].content.parts[0].text",
    success_condition: "response.candidates && response.candidates.length > 0",
    timeout_ms: 30000,
    priority: 1, // Defaulting to high priority as it's free/fast
    description: "Google's Gemini Models (Free Tier Available)",
    lastStatus: "unknown"
};

const OPENAI_TEMPLATE: Omit<AiProvider, 'id' | 'apiKey' | 'enabled'> = {
    name: "OpenAI Official",
    type: "openai-compatible",
    provider_category: "paid",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o",
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer {{API_KEY}}"
    },
    body_template: {
        "model": "{{MODEL}}",
        "messages": [
            { "role": "system", "content": "{{SYSTEM_PROMPT}}" },
            { "role": "user", "content": "{{USER_PROMPT}}" }
        ]
    },
    response_path: "choices[0].message.content",
    success_condition: "response.choices && response.choices.length > 0",
    timeout_ms: 60000,
    priority: 2,
    description: "Official OpenAI Integration",
    lastStatus: "unknown"
};

const OPENROUTER_TEMPLATE: Omit<AiProvider, 'id' | 'apiKey' | 'enabled'> = {
    name: "OpenRouter",
    type: "openai-compatible",
    provider_category: "paid",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "google/gemini-2.0-flash-001",
    method: "POST",
    headers: {
        "Authorization": "Bearer {{API_KEY}}",
        "HTTP-Referer": "https://newsbyte-bd.com",
        "X-Title": "NewsByte Admin",
        "Content-Type": "application/json"
    },
    body_template: {
        "model": "{{MODEL}}",
        "messages": [
            { "role": "system", "content": "{{SYSTEM_PROMPT}}" },
            { "role": "user", "content": "{{USER_PROMPT}}" }
        ]
    },
    response_path: "choices[0].message.content",
    success_condition: "response.choices && response.choices.length > 0",
    timeout_ms: 30000,
    priority: 3,
    description: "OpenRouter Generic Aggregator",
    lastStatus: "unknown"
};

const OLLAMA_TEMPLATE: Omit<AiProvider, 'id' | 'apiKey' | 'enabled'> = {
    name: "Ollama Local",
    type: "local",
    provider_category: "local",
    endpoint: "http://localhost:11434/api/chat",
    model: "llama3", // Default, user can change
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body_template: {
        "model": "{{MODEL}}",
        "stream": false,
        "messages": [
            { "role": "system", "content": "{{SYSTEM_PROMPT}}" },
            { "role": "user", "content": "{{USER_PROMPT}}" }
        ]
    },
    response_path: "message.content", // Ollama specific response path
    success_condition: "response.message && response.message.content",
    timeout_ms: 120000, // Local can be slow
    priority: 4,
    description: "Auto-detected local LLM",
    lastStatus: "unknown"
};

// --- Handlers ---

export async function GET() {
    try {
        const [googleDoc, openaiDoc, openrouterDoc, ollamaDoc] = await Promise.all([
            dbAdmin.collection('ai_providers').doc(GOOGLE_DOC_ID).get(),
            dbAdmin.collection('ai_providers').doc(OPENAI_DOC_ID).get(),
            dbAdmin.collection('ai_providers').doc(OPENROUTER_DOC_ID).get(),
            dbAdmin.collection('ai_providers').doc(OLLAMA_DOC_ID).get()
        ]);

        const googleData = googleDoc.exists ? googleDoc.data() : {};
        const openaiData = openaiDoc.exists ? openaiDoc.data() : {};
        const openrouterData = openrouterDoc.exists ? openrouterDoc.data() : {};
        const ollamaData = ollamaDoc.exists ? ollamaDoc.data() : {};

        return NextResponse.json({
            google: {
                apiKey: googleData?.apiKey || '',
                enabled: googleData?.enabled ?? false,
                model: googleData?.model || 'gemini-1.5-flash',
                priority: googleData?.priority || GOOGLE_TEMPLATE.priority
            },
            openai: {
                apiKey: openaiData?.apiKey || '',
                enabled: openaiData?.enabled ?? false,
                model: openaiData?.model || 'gpt-4o',
                priority: openaiData?.priority || OPENAI_TEMPLATE.priority
            },
            openrouter: {
                apiKey: openrouterData?.apiKey || '',
                enabled: openrouterData?.enabled ?? false,
                model: openrouterData?.model || 'google/gemini-2.0-flash-001',
                priority: openrouterData?.priority || OPENROUTER_TEMPLATE.priority
            },
            ollama: {
                enabled: ollamaData?.enabled ?? false,
                model: ollamaData?.model || 'llama3',
                priority: ollamaData?.priority || OLLAMA_TEMPLATE.priority
            }
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { google, openai, openrouter, ollama } = body;

        const promises = [];

        // Save Google
        if (google) {
            const googlePayload = {
                ...GOOGLE_TEMPLATE,
                apiKey: google.apiKey,
                enabled: google.enabled,
                model: google.model || 'gemini-1.5-flash',
                priority: typeof google.priority === 'number' ? google.priority : GOOGLE_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(GOOGLE_DOC_ID).set(googlePayload, { merge: true }));
        }

        // Save OpenAI
        if (openai) {
            const openaiPayload = {
                ...OPENAI_TEMPLATE,
                apiKey: openai.apiKey,
                enabled: openai.enabled,
                model: openai.model || 'gpt-4o',
                priority: typeof openai.priority === 'number' ? openai.priority : OPENAI_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(OPENAI_DOC_ID).set(openaiPayload, { merge: true }));
        }

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
                // No API Key for Ollama usually
                enabled: ollama.enabled,
                model: ollama.model || 'llama3',
                priority: typeof ollama.priority === 'number' ? ollama.priority : OLLAMA_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(OLLAMA_DOC_ID).set(ollamaPayload, { merge: true }));
        }

        await Promise.all(promises);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }
}
