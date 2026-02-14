import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase-admin';
import { invalidateProviderCache } from '@/lib/ai-engine';


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
        const normalizeModels = (data: Record<string, unknown>, fallbackModel: string) => {
            const models = (data?.models as { id: string; name?: string; enabled?: boolean; priority?: number }[] | undefined) || [];
            if (models.length > 0) return models;
            if (fallbackModel) {
                return [{ id: fallbackModel, name: fallbackModel, enabled: true, priority: 1 }];
            }
            return [];
        };

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
                priority: openrouterData?.priority || OPENROUTER_TEMPLATE.priority,
                models: normalizeModels(openrouterData || {}, openrouterData?.model || 'google/gemini-2.0-flash-001')
            },
            ollama: {
                endpoint: ollamaData?.endpoint || 'http://localhost:11434/api/chat',
                enabled: ollamaData?.enabled ?? false,
                model: ollamaData?.model || 'llama3.2',
                priority: ollamaData?.priority || OLLAMA_TEMPLATE.priority,
                models: normalizeModels(ollamaData || {}, ollamaData?.model || 'llama3.2')
            },
            bytez: {
                apiKey: bytezData?.apiKey || '',
                enabled: bytezData?.enabled ?? false,
                model: bytezData?.model || 'openai-community/gpt-2',
                priority: bytezData?.priority || BYTEZ_TEMPLATE.priority,
                models: normalizeModels(bytezData || {}, bytezData?.model || 'openai-community/gpt-2')
            },
            groq: {
                apiKey: groqData?.apiKey || '',
                enabled: groqData?.enabled ?? false,
                model: groqData?.model || 'llama-3.3-70b-versatile',
                priority: groqData?.priority || GROQ_TEMPLATE.priority,
                models: normalizeModels(groqData || {}, groqData?.model || 'llama-3.3-70b-versatile')
            },
            huggingface: {
                apiKey: huggingfaceData?.apiKey || '',
                enabled: huggingfaceData?.enabled ?? false,
                model: huggingfaceData?.model || 'openai/gpt-oss-20b',
                priority: huggingfaceData?.priority || HUGGINGFACE_TEMPLATE.priority,
                models: normalizeModels(huggingfaceData || {}, huggingfaceData?.model || 'openai/gpt-oss-20b')
            }
        });
    } catch {
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { openrouter, ollama, bytez, groq, huggingface } = body;

        const normalizeModels = (models: Array<{ id: string; name?: string; enabled?: boolean; priority?: number }> | undefined, fallbackModel: string) => {
            if (models && models.length > 0) return models;
            if (fallbackModel) {
                return [{ id: fallbackModel, name: fallbackModel, enabled: true, priority: 1 }];
            }
            return [];
        };

        const validateOpenRouterModels = async (models: Array<{ id: string }>, apiKey?: string) => {
            if (!apiKey || models.length === 0) return { ok: true, invalid: [] as string[] };

            try {
                const res = await fetch('https://openrouter.ai/api/v1/models', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': 'https://newsbyte-bd.com',
                        'X-Title': 'NewsByte Admin'
                    }
                });

                if (!res.ok) {
                    return { ok: false, invalid: [], message: `OpenRouter models check failed (${res.status})` };
                }

                const data = await res.json();
                const raw = Array.isArray(data?.data) ? data.data : [];

                const isFreeModel = (model: { id?: string; pricing?: Record<string, unknown> }) => {
                    if (!model?.id) return false;
                    if (model.id.endsWith(':free')) return true;
                    const pricing = model.pricing || {};
                    const values = Object.values(pricing).map((value) => {
                        if (typeof value === 'number') return value;
                        if (typeof value === 'string') return Number(value);
                        return NaN;
                    });
                    if (values.length === 0) return false;
                    return values.every((value) => Number.isFinite(value) && value <= 0);
                };

                const available = new Set(
                    raw
                        .filter(isFreeModel)
                        .map((m: { id?: string }) => m?.id)
                        .filter(Boolean)
                );

                if (available.size === 0) {
                    return { ok: false, invalid: [], message: 'OpenRouter free models list empty' };
                }

                const invalid = models
                    .map(m => m.id)
                    .filter(id => id && !available.has(id));

                if (invalid.length > 0) {
                    return { ok: false, invalid, message: `Only free OpenRouter models allowed. Invalid: ${invalid.join(', ')}` };
                }

                return { ok: true, invalid: [] as string[] };
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return { ok: false, invalid: [], message: `OpenRouter validation error: ${message}` };
            }
        };

        const validateBytezModels = async (models: Array<{ id: string }>, apiKey?: string) => {
            if (!apiKey || models.length === 0) return { ok: true, invalid: [] as string[] };

            try {
                const tasks = ['chat', 'text-generation'];
                const fetches = await Promise.all(tasks.map(async (task) => {
                    const url = new URL('https://api.bytez.com/models/v2/list/models');
                    url.searchParams.set('task', task);

                    const res = await fetch(url.toString(), {
                        method: 'GET',
                        headers: {
                            'Authorization': apiKey
                        }
                    });

                    if (!res.ok) {
                        return { ok: false, error: `Bytez models check failed (${res.status})`, task };
                    }

                    const data = await res.json();
                    const raw = Array.isArray(data?.output) ? data.output : [];
                    return { ok: true, raw, task };
                }));

                const failed = fetches.find((f) => !f.ok);
                if (failed && !fetches.some((f) => f.ok)) {
                    return { ok: true, invalid: [], warning: failed.error };
                }

                type BytezModel = { meter?: string; modelId?: string };
                const raw = fetches.filter((f): f is { ok: true; raw: unknown[]; task: string } => f.ok).flatMap((f) => f.raw) as BytezModel[];

                const isFreeModel = (model: BytezModel) => {
                    const meter = model?.meter || '';
                    return typeof meter === 'string' && meter.toLowerCase().includes('free');
                };

                const available = new Set(
                    raw
                        .filter(isFreeModel)
                        .map((m) => m?.modelId)
                        .filter(Boolean) as string[]
                );

                if (available.size === 0) {
                    return { ok: true, invalid: [], warning: 'Bytez free models list empty' };
                }

                const invalid = models
                    .map(m => m.id)
                    .filter(id => id && !available.has(id));

                if (invalid.length > 0) {
                    return { ok: false, invalid, message: `Only free Bytez models allowed. Invalid: ${invalid.join(', ')}` };
                }

                return { ok: true, invalid: [] as string[] };
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return { ok: true, invalid: [], warning: `Bytez validation error: ${message}` };
            }
        };

        const promises = [];



        // Save OpenRouter
        if (openrouter) {
            const primaryModel = openrouter.models?.[0]?.id || openrouter.model || 'google/gemini-2.0-flash-001';
            const models = normalizeModels(openrouter.models, primaryModel);

            const validation = await validateOpenRouterModels(models, openrouter.apiKey);
            if (!validation.ok) {
                return NextResponse.json({
                    error: validation.message || 'OpenRouter model validation failed',
                    invalidModels: validation.invalid || []
                }, { status: 400 });
            }

            const openrouterPayload = {
                ...OPENROUTER_TEMPLATE,
                apiKey: openrouter.apiKey,
                enabled: openrouter.enabled,
                model: primaryModel,
                models,
                priority: typeof openrouter.priority === 'number' ? openrouter.priority : OPENROUTER_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(OPENROUTER_DOC_ID).set(openrouterPayload, { merge: true }));
        }

        // Save Ollama
        if (ollama) {
            const primaryModel = ollama.models?.[0]?.id || ollama.model || 'llama3.2';
            const models = normalizeModels(ollama.models, primaryModel);
            const ollamaPayload = {
                ...OLLAMA_TEMPLATE,
                endpoint: ollama.endpoint || 'http://localhost:11434/api/chat',
                enabled: ollama.enabled,
                model: primaryModel,
                models,
                priority: typeof ollama.priority === 'number' ? ollama.priority : OLLAMA_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(OLLAMA_DOC_ID).set(ollamaPayload, { merge: true }));
        }

        // Save Bytez
        let bytezWarning: string | undefined;
        if (bytez) {
            const primaryModel = bytez.models?.[0]?.id || bytez.model || 'openai-community/gpt-2';
            const models = normalizeModels(bytez.models, primaryModel);

            const validation = await validateBytezModels(models, bytez.apiKey);
            if (!validation.ok) {
                return NextResponse.json({
                    error: validation.message || 'Bytez model validation failed',
                    invalidModels: validation.invalid || []
                }, { status: 400 });
            }
            if (validation.warning) bytezWarning = validation.warning;

            const bytezPayload = {
                ...BYTEZ_TEMPLATE,
                apiKey: bytez.apiKey,
                enabled: bytez.enabled,
                model: primaryModel,
                models,
                priority: typeof bytez.priority === 'number' ? bytez.priority : BYTEZ_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(BYTEZ_DOC_ID).set(bytezPayload, { merge: true }));
        }

        // Save Groq
        if (groq) {
            const primaryModel = groq.models?.[0]?.id || groq.model || 'llama-3.3-70b-versatile';
            const models = normalizeModels(groq.models, primaryModel);
            const groqPayload = {
                ...GROQ_TEMPLATE,
                apiKey: groq.apiKey,
                enabled: groq.enabled,
                model: primaryModel,
                models,
                priority: typeof groq.priority === 'number' ? groq.priority : GROQ_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(GROQ_DOC_ID).set(groqPayload, { merge: true }));
        }

        // Save Hugging Face
        if (huggingface) {
            const primaryModel = huggingface.models?.[0]?.id || huggingface.model || 'openai/gpt-oss-20b';
            const models = normalizeModels(huggingface.models, primaryModel);
            const huggingfacePayload = {
                ...HUGGINGFACE_TEMPLATE,
                apiKey: huggingface.apiKey,
                enabled: huggingface.enabled,
                model: primaryModel,
                models,
                priority: typeof huggingface.priority === 'number' ? huggingface.priority : HUGGINGFACE_TEMPLATE.priority,
                lastUpdated: new Date().toISOString()
            };
            promises.push(dbAdmin.collection('ai_providers').doc(HUGGINGFACE_DOC_ID).set(huggingfacePayload, { merge: true }));
        }



        await Promise.all(promises);

        // Invalidate cache to apply changes immediately
        invalidateProviderCache();

        return NextResponse.json({ success: true, warnings: bytezWarning ? [bytezWarning] : [] });
    } catch {
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }
}
