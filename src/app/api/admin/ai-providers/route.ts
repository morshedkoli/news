import { NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const snapshot = await dbAdmin.collection("ai_providers").orderBy("priority", "asc").get();

        const providers = snapshot.docs.map(doc => {
            const data = doc.data();
            // SANITIZATION: Never send apiKey to client
            const safeData = { ...data };
            delete (safeData as { apiKey?: string }).apiKey;
            delete (safeData as { headers?: unknown }).headers;
            delete (safeData as { body_template?: unknown }).body_template;

            return {
                id: doc.id,
                ...safeData,
                // Mask key for UI indication only (e.g. "sk-....4d2a")
                apiKeyMasked: data.apiKey ? `${data.apiKey.substring(0, 3)}...${data.apiKey.substring(data.apiKey.length - 4)}` : null
            };
        });

        return NextResponse.json(providers);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
