import { NextResponse } from "next/server";
import { fetchArticle } from "@/lib/news-fetcher";
import { generateContent } from "@/lib/ai-engine";
import { normalizeUrl, checkDuplicate, generateContentHash } from '@/lib/news-dedup';
import { dbAdmin } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow 60s for fetching/AI

// Valid categories for AI to choose from (in Bangla)
const VALID_CATEGORIES = [
    "সাধারণ", "খেলাধুলা", "রাজনীতি", "প্রযুক্তি", "বিনোদন",
    "অর্থনীতি", "স্বাস্থ্য", "বিজ্ঞান", "শিক্ষা", "আন্তর্জাতিক",
    "জাতীয়", "জীবনযাত্রা", "মতামত", "অপরাধ", "পরিবেশ", "ধর্ম"
];

// Update System Prompt to be stricter
// Update System Prompts for Multi-language Support
const SYSTEM_PROMPT_BANGLA = `You are a professional Bangla news editor.
Rules:
- Write in Bangla only
- Neutral journalistic tone
- No opinions, no analysis, no emotion
- No clickbait
- Do NOT add new facts or guess missing info
- Use short paragraphs (max 6 paragraphs, max 2 lines each)
- Max 120 words total
- Analyze the content and choose the most appropriate category
- **IMPORTANT: Output strictly valid JSON. Do NOT use literal newlines inside strings. Use \\n for line breaks.**

Valid categories (choose EXACTLY one): ${VALID_CATEGORIES.join(", ")}

Output format JSON ONLY:
{
  "title": "Clean Bangla Title",
  "summary": "Bangla Summary...",
  "category": "Category in Bangla from the list above"
}`;

const SYSTEM_PROMPT_ENGLISH = `You are a professional news editor.
Rules:
- READ the English news and WRITE a concise summary in BANGLA.
- Do NOT translate sentence-by-sentence.
- Synthesize the main points into a clear Bangla summary.
- Maintain neutral journalistic tone.
- No opinions, no analysis.
- Use short paragraphs (max 6 paragraphs, max 2 lines each).
- Max 150 words total.
- Translate names/places accurately (e.g. "Bangladesh" → "বাংলাদেশ").
- Analyze the content and choose the most appropriate category.
- **IMPORTANT: Output strictly valid JSON. Use \\n for line breaks.**

Valid categories (choose EXACTLY one): ${VALID_CATEGORIES.join(", ")}

Output format JSON ONLY:
{
  "title": "Engaging Bangla Title",
  "summary": "Concise Bangla Summary...",
  "category": "Category in Bangla from the list above"
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
        const fetchResult = await fetchArticle(url);

        if (!fetchResult.success) {
            return NextResponse.json({
                error: "Failed to fetch article content",
                details: fetchResult.error
            }, { status: 422 }); // 422 Unprocessable Entity
        }

        const article = fetchResult.data;

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
        const textToSummarize = article.textContent.slice(0, 8000); // 8k chars limit

        // Detect Language
        const isBangla = /[ঀ-৿]/.test(article.textContent.slice(0, 500));
        const language = isBangla ? 'Bangla' : 'English';

        console.log(`🌍 Language detected: ${language} for ${url}`);

        let systemPrompt, userPrompt;

        if (isBangla) {
            systemPrompt = SYSTEM_PROMPT_BANGLA;
            userPrompt = `নিচের সংবাদটি সংক্ষেপে উপস্থাপন করুন। মূল তথ্য ঠিক রাখুন। কোনো মতামত দেবেন না।\n\nসংবাদ:\n${textToSummarize}`;
        } else {
            systemPrompt = SYSTEM_PROMPT_ENGLISH;
            // Explicit instruction for Summary + Translation
            userPrompt = `Summarize the following English news into a clear, engaging Bangla news report. Capture all key facts.\n\nEnglish News:\n${textToSummarize}`;
        }

        let generated = null;
        let aiKey: any = null;
        try {
            aiKey = await generateContent(userPrompt, {
                systemPrompt: systemPrompt,
                temperature: 0.2,
                jsonMode: true,
                feature: 'news_generate'
            });

            if (aiKey && aiKey.content) {
                try {
                    // Robust JSON extraction
                    let clean = aiKey.content.replace(/```json/g, "").replace(/```/g, "").trim();

                    // Find first '{' and last '}'
                    const firstOpen = clean.indexOf('{');
                    const lastClose = clean.lastIndexOf('}');
                    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
                        clean = clean.substring(firstOpen, lastClose + 1);
                    }

                    try {
                        generated = JSON.parse(clean);
                    } catch (parseErr) {
                        // JSON Parse Failed (likely due to newlines). Try Regex Extraction.
                        console.warn("JSON Parse Failed, attempting Regex fallback...", parseErr);

                        const titleMatch = clean.match(/"title"\s*:\s*"([^"]+)"/);
                        const summaryMatch = clean.match(/"summary"\s*:\s*"([\s\S]*?)"\s*(,|})/);
                        const categoryMatch = clean.match(/"category"\s*:\s*"([^"]+)"/);

                        if (summaryMatch) {
                            generated = {
                                title: titleMatch ? titleMatch[1] : article.title,
                                summary: summaryMatch[1].replace(/\\n/g, '\n').trim(), // Unescape if needed
                                category: categoryMatch ? categoryMatch[1] : "সাধারণ"
                            };
                        } else {
                            throw parseErr; // Regex failed too
                        }
                    }

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
                    console.warn("Soft Fail: All Parsing failed. Fallback to excerpt.", e);
                    // Fallback to extraction from original if parsing fails entirely
                    // DO NOT return raw JSON string to user
                    generated = {
                        title: article.title,
                        summary: article.excerpt || article.textContent.substring(0, 500) + "...",
                        category: article.category || "সাধারণ"
                    };
                }
            } else {
                throw new Error("All AI providers failed or returned empty.");
            }

        } catch (aiError) {
            console.warn("first attempt failed", aiError);
        }

        // RETRY LOGIC: If JSON generation failed OR translation failed (still English), try Plain Text mode
        const isGeneratedBangla = generated?.summary ? /[ঀ-৿]/.test(generated.summary) : false;

        if (language === 'English' && (!generated || !generated.summary || !isGeneratedBangla)) {
            console.log("🔄 Retry: AI JSON failed or Output is not Bangla, attempting Plain Text Translation...");

            try {
                const retryPrompt = `Summarize this news in Bangla (Title + Summary).
Format:
Title: [Bangla Title]
Summary: [Bangla Summary]

News:
${textToSummarize}`;

                const retryAiKey = await generateContent(retryPrompt, {
                    systemPrompt: "You are a professional editor. Summarize English news to Bangla. Output strict 'Title: ... Summary: ...' format.",
                    temperature: 0.1,
                    feature: 'news_generate'
                });

                if (retryAiKey && retryAiKey.content) {
                    const content = retryAiKey.content;
                    const titleMatch = content.match(/Title:\s*(.+)/i);
                    const summaryMatch = content.match(/Summary:\s*([\s\S]+)/i);

                    if (summaryMatch) {
                        generated = {
                            title: titleMatch ? titleMatch[1].trim() : article.title,
                            summary: summaryMatch[1].trim(),
                            category: "সাধারণ" // Plain text mode fallback
                        };
                        aiKey = retryAiKey; // specific success
                        console.log("✅ Retry Success: Translated via Plain Text mode");
                    }
                }
            } catch (retryError) {
                console.warn("❌ Retry failed:", retryError);
            }
        }

        // Final Fallback if both attempts fail
        if (!generated || !generated.summary) {
            console.warn("AI Generation failed completely. Fallback to excerpt.");
            generated = {
                title: article.title,
                summary: article.excerpt || article.textContent.substring(0, 500) + "...",
                category: article.category || "সাধারণ"
            };
            aiKey = { providerUsed: 'Fallback', modelUsed: 'None' };
        }

        return NextResponse.json({
            original: article,
            generated: generated,
            provider_info: {
                provider: aiKey?.providerUsed || 'Unknown',
                model: aiKey?.modelUsed || 'Unknown'
            },
            language_detected: (aiKey?.providerUsed !== 'Fallback') ? language : null
        });

    } catch (error: any) {
        console.error("API Error:", error);

        // Handle Firestore "value too large" error specifically
        if (error.code === 3 || error.message?.includes("too large") || error.code === 'INVALID_ARGUMENT') {
            return NextResponse.json({
                error: "এই লিংকের খবরটি প্রক্রিয়াকরণ করা যাচ্ছে না (URL too long)",
                details: "The URL is too long for the database index."
            }, { status: 400 });
        }

        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

