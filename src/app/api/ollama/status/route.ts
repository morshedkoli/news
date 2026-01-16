import { NextResponse } from "next/server";

export async function GET() {
    const endpoint = process.env.NEXT_PUBLIC_OLLAMA_API_URL || "http://localhost:11434";

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const response = await fetch(`${endpoint}/api/tags`, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            return NextResponse.json({ status: "connected" });
        } else {
            return NextResponse.json({ status: "disconnected", error: "Ollama responding with error" }, { status: 503 });
        }
    } catch (error) {
        return NextResponse.json({ status: "disconnected", error: "Unreachable" }, { status: 503 });
    }
}
