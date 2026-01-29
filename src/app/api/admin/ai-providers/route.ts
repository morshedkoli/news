import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const secret = process.env.CRON_SECRET;
        const authHeader = req.headers.get('authorization');
        // Basic protection - in prod use proper session check
        // if (authHeader !== `Bearer ${secret}`) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

        const snapshot = await dbAdmin.collection("ai_providers").orderBy("priority", "asc").get();

        const providers = snapshot.docs.map(doc => {
            const data = doc.data();
            // SANITIZATION: Never send apiKey to client
            const { apiKey, headers, body_template, ...safeData } = data;

            return {
                id: doc.id,
                ...safeData,
                // Mask key for UI indication only (e.g. "sk-....4d2a")
                apiKeyMasked: apiKey ? `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 4)}` : null
            };
        });

        return NextResponse.json(providers);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
