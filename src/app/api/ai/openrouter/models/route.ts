import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : '';

        if (!apiKey) {
            return NextResponse.json({ error: 'OpenRouter API key required' }, { status: 400 });
        }

        const res = await fetch('https://openrouter.ai/api/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://newsbyte-bd.com',
                'X-Title': 'NewsByte Admin'
            }
        });

        if (!res.ok) {
            const text = await res.text();
            return NextResponse.json({ error: `OpenRouter models fetch failed (${res.status})`, details: text }, { status: 400 });
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

        const models = raw
            .filter(isFreeModel)
            .map((m: { id?: string }) => m?.id)
            .filter(Boolean);

        return NextResponse.json({ models, freeOnly: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
