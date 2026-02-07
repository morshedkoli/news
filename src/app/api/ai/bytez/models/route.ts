import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : '';

        if (!apiKey) {
            return NextResponse.json({ error: 'Bytez API key required' }, { status: 400 });
        }

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
                const text = await res.text();
                return { ok: false, error: `Bytez models fetch failed (${res.status})`, details: text, task };
            }

            const data = await res.json();
            const raw = Array.isArray(data?.output) ? data.output : [];
            return { ok: true, raw, task };
        }));

        const failed = fetches.find((f) => !f.ok);
        if (failed && !fetches.some((f) => f.ok)) {
            return NextResponse.json({ error: failed.error, details: failed.details }, { status: 400 });
        }

        const raw = fetches.filter((f): f is { ok: true; raw: unknown[]; task: string } => f.ok).flatMap((f) => f.raw);

        type BytezModel = { meter?: string; modelId?: string };
        const typedRaw = raw as BytezModel[];

        const isFreeModel = (model: BytezModel) => {
            const meter = model?.meter || '';
            return typeof meter === 'string' && meter.toLowerCase().includes('free');
        };

        const models = typedRaw
            .filter(isFreeModel)
            .map((m) => m?.modelId)
            .filter(Boolean) as string[];

        return NextResponse.json({ models, freeOnly: true, tasks });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
