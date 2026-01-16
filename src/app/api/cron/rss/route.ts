import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import { parseRssFeed } from "@/lib/rss";
import { fetchArticle } from "@/lib/news-fetcher";
import { generateContent, getActiveProviders } from "@/lib/ai-engine";
import { normalizeUrl, checkDuplicate, generateContentHash } from '@/lib/news-dedup';
import { NewsArticle } from '@/types/news';
import { calculateImportanceScore } from "@/lib/news-scorer";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

// Allow long execution for local/server environments
export const maxDuration = 300;
export const revalidate = 0;

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



// Helper to update progress
async function updateProgress(data: any) {
    try {
        await dbAdmin.collection('system_stats').doc('rss_progress').set({
            ...data,
            last_updated: FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error("Failed to update progress:", e);
    }
}

export async function GET(req: NextRequest) {
    console.log("Starting Robust RSS Cron Job...");

    // 1. Check if we have ANY AI providers enabled
    const providers = await getActiveProviders();
    if (providers.length === 0) {
        console.error("⛔ CRON ABORTED: No active AI providers found.");
        await updateProgress({
            status: 'error',
            logs: FieldValue.arrayUnion("⛔ CRON ABORTED: No active AI providers found.")
        });
        return NextResponse.json({
            success: false,
            message: "AI Service Offline (No Providers). Cron skipped."
        }, { status: 503 });
    }

    // Initialize Progress
    await updateProgress({
        status: 'running',
        total_feeds: 0,
        current_feed_index: 0,
        current_feed_url: '',
        processed_items: 0,
        total_items: 0,
        current_provider: 'Initializing...',
        current_model: '',
        logs: [] // Reset logs
    });

    let processedCount = 0;
    let errorCount = 0;

    const MAX_DAILY_NOTIFICATIONS = 5;
    const MIN_FEED_GAP_MS = 5 * 60 * 1000; // 5 Minutes

    try {
        // 2. Fetch Feeds
        const feedsSnapshot = await dbAdmin.collection("rss_feeds").get();
        const feeds = feedsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));



        if (feeds.length === 0) {
            await updateProgress({ status: 'complete', logs: FieldValue.arrayUnion("No feeds found.") });
            return NextResponse.json({ message: "No feeds." });
        }

        await updateProgress({
            total_feeds: feeds.length,
            logs: FieldValue.arrayUnion(`Found ${feeds.length} feeds.Starting process...`)
        });

        // 3. Rate Limit State
        const statsRef = dbAdmin.collection("system_stats").doc("notifications");
        const statsDoc = await statsRef.get();
        let stats = statsDoc.data() || { today_count: 0, date: new Date().toISOString().split('T')[0] };

        if (stats.date !== new Date().toISOString().split('T')[0]) {
            stats = { today_count: 0, last_sent: null, date: new Date().toISOString().split('T')[0] };
            await statsRef.set(stats);
        }

        // Fetch Global Config
        const configDoc = await dbAdmin.collection("system_stats").doc("rss_config").get();
        const globalConfig = configDoc.data() || {};
        const globalDefaultWait = (globalConfig.default_wait_minutes !== undefined) ? Number(globalConfig.default_wait_minutes) : 5;

        // 4. SEQUENTIAL PROCESSING LOOP
        for (let i = 0; i < feeds.length; i++) {
            const feed = feeds[i] as any;

            // Dynamic Wait Time (Feed Specific -> Global Default -> 5 mins)
            let waitMinutes = globalDefaultWait;
            if (feed.wait_minutes !== undefined && feed.wait_minutes !== null) {
                waitMinutes = Number(feed.wait_minutes);
            }

            const dynamicWaitMs = waitMinutes * 60 * 1000;

            if (i > 0 && dynamicWaitMs > 0) {
                console.log(`⏳ Waiting ${waitMinutes} minutes before processing next feed...`);
                await updateProgress({
                    status: 'waiting',
                    logs: FieldValue.arrayUnion(`⏳ Waiting ${waitMinutes} minutes safety delay before next feed...`)
                });
                await new Promise(resolve => setTimeout(resolve, dynamicWaitMs));
            }

            console.log(`▶ Processing Feed [${i + 1}/${feeds.length}]: ${feed.url}`);
            await updateProgress({
                status: 'running',
                current_feed_index: i + 1,
                current_feed_url: feed.url,
                logs: FieldValue.arrayUnion(`▶ Processing Feed [${i + 1}/${feeds.length}]: ${feed.url}`)
            });

            try {
                // Parse Feed
                const items = await parseRssFeed(feed.url);
                // STRICT LIMIT: Only process top 2 items
                const recentItems = items.slice(0, 2);

                for (const item of recentItems) {
                    try {
                        // LAYER 1: URL Normalization
                        const cleanUrl = normalizeUrl(item.link);

                        // Check URL Exact Match
                        const urlCheck = await checkDuplicate(cleanUrl, '', '');
                        if (urlCheck.isDuplicate && urlCheck.type === 'exact') {
                            console.log(`   ❌ Skipped (Exact URL Duplicate): ${cleanUrl}`);
                            await updateProgress({
                                logs: FieldValue.arrayUnion(`❌ Skipped (Duplicate): ${cleanUrl.substring(0, 50)}...`)
                            });
                            await dbAdmin.collection('system_stats').doc('deduplication').set({
                                count: FieldValue.increment(1),
                                last_blocked: cleanUrl,
                                updated_at: FieldValue.serverTimestamp()
                            }, { merge: true });
                            continue;
                        }

                        console.log(`   📝 Fetching: ${item.title}`);

                        const article = await fetchArticle(item.link);
                        if (!article?.textContent || article.textContent.length < 200) {
                            console.log("   ⚠️ Skipped: Short/Empty content");
                            continue;
                        }

                        // LAYER 2: Content Hash Check
                        const contentHash = generateContentHash(article.textContent);
                        const hashCheck = await checkDuplicate(cleanUrl, article.textContent, '');
                        if (hashCheck.isDuplicate && hashCheck.type === 'content_hash') {
                            console.log(`   ❌ Skipped (Content Hash Duplicate): ${item.title}`);
                            continue;
                        }

                        // Summarize with AI Engine
                        const textChunk = article.textContent.slice(0, 8000);
                        const userPrompt = `নিচের সংবাদটি সংক্ষেপে উপস্থাপন করুন। মূল তথ্য ঠিক রাখুন। কোনো মতামত দেবেন না।\n\nসংবাদ:\n${textChunk}`;

                        let summaryData = null;
                        try {
                            const aiRes = await generateContent(userPrompt, {
                                systemPrompt: SYSTEM_PROMPT,
                                temperature: 0.2,
                                jsonMode: true
                            });

                            if (aiRes && aiRes.content) {
                                await updateProgress({
                                    current_provider: aiRes.providerUsed,
                                    current_model: aiRes.modelUsed,
                                    logs: FieldValue.arrayUnion(`✅ AI Success using ${aiRes.providerUsed} (${aiRes.modelUsed})`)
                                });
                                const cleanJson = aiRes.content.replace(/```json/g, "").replace(/```/g, "").trim();
                                summaryData = JSON.parse(cleanJson);
                            }
                        } catch (aiErr) {
                            console.error("   ⚠️ AI Failed for item:", aiErr);
                            continue;
                        }

                        if (!summaryData || !summaryData.title || !summaryData.summary) {
                            console.log("   ⚠️ Skipped: Invalid AI Output");
                            continue;
                        }

                        // LAYER 3: Semantic Similarity Check (Post-Generation)
                        const semanticCheck = await checkDuplicate(cleanUrl, article.textContent, summaryData.summary);
                        if (semanticCheck.isDuplicate && semanticCheck.type === 'semantic') {
                            console.log(`   ❌ Skipped (Semantic Duplicate): ${item.title} (Similarity: ${Math.round(semanticCheck.confidence * 100)}%)`);
                            continue;
                        }

                        const finalSummary = summaryData.summary + "\n\n(AI সংক্ষেপিত)";

                        // Score & Rate Limit
                        const scoreData = calculateImportanceScore(summaryData.title, summaryData.summary, cleanUrl, new Date());

                        // Save
                        const newsData: NewsArticle = {
                            title: summaryData.title,
                            summary: finalSummary,
                            image: article.image || "",
                            source_url: item.link,
                            normalized_url: cleanUrl,
                            content_hash: contentHash,
                            source_name: article.siteName || new URL(item.link).hostname,
                            published_at: new Date().toISOString(),
                            created_at: new Date().toISOString(),
                            category: "general",
                            is_duplicate: false,
                            is_rss: true,
                            importance_score: scoreData.score,
                            score_breakdown: scoreData.breakdown
                        } as any; // Cast to match Firestore expectation if types differ

                        const docRef = await dbAdmin.collection("news").add(newsData);

                        processedCount++;
                        console.log(`   ✅ Published: ${docRef.id} (Score: ${scoreData.score})`);

                        // Notify?
                        if (scoreData.shouldNotify && stats.today_count < MAX_DAILY_NOTIFICATIONS) {
                            const protocol = req.nextUrl.protocol || "http:";
                            const apiUrl = `${protocol}//${req.headers.get("host")}/api/notifications/send`;

                            fetch(apiUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    title: "জরুরি সংবাদ",
                                    body: summaryData.title,
                                    newsId: docRef.id
                                })
                            }).catch(e => console.error("Notify failed", e));

                            stats.today_count++;
                            await statsRef.update({ today_count: FieldValue.increment(1) });
                        }

                    } catch (itemErr: any) {
                        console.error(`   ❌ Item Error:`, itemErr);
                        await updateProgress({
                            logs: FieldValue.arrayUnion(`❌ Item Error: ${itemErr.message || 'Unknown error'}`)
                        });
                        errorCount++;
                    }
                }

                // Update Feed Timestamp
                await dbAdmin.collection("rss_feeds").doc(feed.id).update({ last_checked: Timestamp.now() });

            } catch (feedErr: any) {
                console.error(`❌ Feed Failed: ${feed.url}`, feedErr);
                await updateProgress({
                    logs: FieldValue.arrayUnion(`❌ Feed Failed: ${feed.url} - ${feedErr.message}`)
                });
                errorCount++;
            }
        }


        return NextResponse.json({
            success: true,
            message: `Batch Complete. Processed: ${processedCount}, Errors: ${errorCount}`
        });

    } catch (gErr: any) {
        await updateProgress({
            status: 'error',
            logs: FieldValue.arrayUnion(`❌ Critical Error: ${gErr.message}`)
        });
        return NextResponse.json({ error: gErr.message }, { status: 500 });
    }
}
