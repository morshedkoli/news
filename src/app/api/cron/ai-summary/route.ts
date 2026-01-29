import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import { generateContent } from "@/lib/ai-engine";
import { NewsArticle } from "@/types/news";
import { Timestamp } from "firebase-admin/firestore";

export const maxDuration = 20; // Hard limit 20s
export const revalidate = 0;

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && req.nextUrl.searchParams.get('key') !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 1. Fetch SINGLE oldest 'pending' article
        const snapshot = await dbAdmin.collection("news")
            .where("summary_status", "==", "pending")
            .orderBy("created_at", "asc")
            .limit(1)
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ status: "idle", message: "No pending summaries" });
        }

        const doc = snapshot.docs[0];
        const article = doc.data() as NewsArticle;

        console.log(`🤖 AI Cron: Processing pending summary for: ${article.title.slice(0, 30)}...`);

        // 2. Determine System Prompt based on language
        const isBangla = /[ঀ-৿]/.test(article.content || "");
        const systemPrompt = isBangla
            ? `You are a professional Bangla news editor. Summarize this news in Bangla (max 100 words). Neutral tone. JSON output: { "summary": "...", "category": "..." }`
            : `Translate and summarize this English news to Bangla (max 100 words). Neutral tone. JSON output: { "summary": "...", "category": "..." }`;

        const userPrompt = `News:\n${(article.content || article.summary).slice(0, 6000)}`;

        // 3. Call AI (Non-blocking internal flow, but blocking for this cron)
        const aiRes = await generateContent(userPrompt, {
            systemPrompt,
            temperature: 0.3,
            jsonMode: true,
            feature: 'async_summary'
        });

        if (!aiRes || !aiRes.content) {
            // Mark failed so we don't retry forever in a tight loop immediately, 
            // or use a retry count. For now, mark 'failed' to need manual or backoff.
            await doc.ref.update({
                summary_status: 'failed',
                ai_generated_at: new Date().toISOString()
            });
            return NextResponse.json({ status: "failed", message: "AI generation failed" });
        }

        // 4. Parse & Update
        let summary = "";
        let category = article.category;

        try {
            const clean = aiRes.content.replace(/```json/g, "").replace(/```/g, "").trim();
            const json = JSON.parse(clean);
            summary = json.summary;
            if (json.category) category = json.category;
        } catch (e) {
            // Fallback to raw text if JSON fails
            summary = aiRes.content.slice(0, 500);
        }

        await doc.ref.update({
            summary: summary,
            category: category,
            summary_status: 'completed',
            ai_provider_id: aiRes.providerUsed,
            ai_model: aiRes.modelUsed,
            ai_generated_at: new Date().toISOString()
        });

        return NextResponse.json({
            status: "success",
            provider: aiRes.providerUsed,
            duration: aiRes.executionTimeMs
        });

    } catch (error: any) {
        console.error("AI Cron Fatal:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
