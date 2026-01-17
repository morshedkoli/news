import { NextResponse } from "next/server";
import { fetchArticle } from "@/lib/news-fetcher";
import { generateContent } from "@/lib/ai-engine";
import { normalizeUrl, checkDuplicate, generateContentHash } from '@/lib/news-dedup';
import { dbAdmin } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow 60s for fetching/AI

const SYSTEM_PROMPT = `You are a professional Bangla news editor.
Rules:
- Write in Bangla only
- Neutral journalistic tone
- No opinions, no analysis, no emotion
- No clickbait
- Do NOT add new facts or guess missing info
- Use short paragraphs (max 6 paragraphs, max 2 lines each)
- Max 120 words total

Output format JSON ONLY:
{
  "title": "Clean Bangla Title",
  "summary": "Bangla Summary..."
}`;

export async function POST(req: Request) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        // LAYER 1: URL Check
        const cleanUrl = normalizeUrl(url);
        const urlCheck = await checkDuplicate(cleanUrl, '', '');
        if (urlCheck.isDuplicate && urlCheck.type === 'exact') {
            // Fetch existing article to show context
            let existingArticle = null;
            if (urlCheck.originalId) {
                const docSnap = await dbAdmin.collection('news').doc(urlCheck.originalId).get();
                if (docSnap.exists) {
                    const data = docSnap.data();
                    existingArticle = {
                        title: data?.title,
                        textContent: data?.summary, // Use summary as content preview
                        siteName: data?.source_name,
                        image: data?.image
                    };
                }
            }

            await dbAdmin.collection('system_stats').doc('deduplication').set({
                count: FieldValue.increment(1),
                last_blocked: cleanUrl,
                updated_at: FieldValue.serverTimestamp()
            }, { merge: true });

            return NextResponse.json({
                error: "এই সংবাদটি ইতিমধ্যে প্রকাশিত হয়েছে (URL Duplicate)",
                details: "Database ID: " + urlCheck.originalId,
                article: existingArticle
            }, { status: 409 });
        }

        // 1. Fetch Article Metadata & Content
        const article = await fetchArticle(url);
        if (!article) {
            return NextResponse.json({ error: "Failed to fetch article content" }, { status: 500 });
        }

        // LAYER 2: Hash Check
        const hashCheck = await checkDuplicate(cleanUrl, article.textContent, '');
        if (hashCheck.isDuplicate && hashCheck.type === 'content_hash') {
            return NextResponse.json({
                error: "এই সংবাদটি ইতিমধ্যে প্রকাশিত হয়েছে (Content Match)",
                details: "Database ID: " + hashCheck.originalId,
                article, // Return article for preview
            }, { status: 409 });
        }

        // 2. Summarize with AI Engine
        const textToSummarize = article.textContent.slice(0, 20000);
        const userPrompt = `নিচের সংবাদটি সংক্ষেপে উপস্থাপন করুন। মূল তথ্য ঠিক রাখুন। কোনো মতামত দেবেন না।\n\nসংবাদ:\n${textToSummarize}`;

        let generated = null;
        let aiKey: any = null;
        try {
            aiKey = await generateContent(userPrompt, {
                systemPrompt: SYSTEM_PROMPT,
                temperature: 0.2,
                jsonMode: true
            });

            if (aiKey && aiKey.content) {
                try {
                    // Robust JSON extraction
                    let clean = aiKey.content.replace(/```json/g, "").replace(/```/g, "").trim();

                    // Find first '{' and last '}' to handle potential prelude/postscript text
                    const firstOpen = clean.indexOf('{');
                    const lastClose = clean.lastIndexOf('}');
                    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
                        clean = clean.substring(firstOpen, lastClose + 1);
                    }

                    generated = JSON.parse(clean);

                    // LAYER 3: Semantic Check
                    if (generated && generated.summary) {
                        const semanticCheck = await checkDuplicate(cleanUrl, article.textContent, generated.summary);
                        if (semanticCheck.isDuplicate && semanticCheck.type === 'semantic') {
                            return NextResponse.json({
                                error: `এই সংবাদটি ইতিমধ্যে প্রকাশিত হয়েছে (Semantic Match: ${Math.round(semanticCheck.confidence * 100)}%)`,
                                details: "Similar to: " + semanticCheck.originalId,
                                article,
                                generated // Return generated summary
                            }, { status: 409 });
                        }
                    }
                } catch (e) {
                    console.warn("Soft Fail: JSON Parse Error, falling back to raw text.", e);
                    // Fallback to raw text if JSON fails but content exists
                    generated = { title: article.title, summary: aiKey.content };
                }
            } else {
                throw new Error("All AI providers failed or returned empty.");
            }

        } catch (aiError) {
            console.error("AI Generation failed:", aiError);
            return NextResponse.json({
                error: (aiError as Error).message || "AI summarization failed",
                details: "Please check AI Provider status in admin panel.",
                article // Return article anyway
            }, { status: 503 });
        }

        return NextResponse.json({
            original: article,
            generated: generated,
            provider_info: {
                provider: aiKey?.providerUsed || 'Unknown',
                model: aiKey?.modelUsed || 'Unknown'
            }
        });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

