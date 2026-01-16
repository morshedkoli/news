import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_API_URL || 'http://localhost:11434';

        // Add timeout control
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`${ollamaUrl}/api/tags`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            throw new Error(`Failed to fetch models: ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Ollama Models Fetch Error:", error);
        return NextResponse.json({ models: [], error: error.message }, { status: 500 });
    }
}
