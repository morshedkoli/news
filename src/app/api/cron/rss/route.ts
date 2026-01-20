import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import { parseRssFeed } from "@/lib/rss";
import { fetchArticle } from "@/lib/news-fetcher";
import { generateContent } from "@/lib/ai-engine";
import { normalizeUrl, generateContentHash, generateUrlHash } from '@/lib/news-dedup';
import { sendNotification } from "@/lib/notifications";
import { RssFeed, RssSettings } from '@/types/rss';
import { calculateImportanceScore } from "@/lib/news-scorer";
import { Timestamp } from "firebase-admin/firestore";

// Cron configuration
export const maxDuration = 60; // 60 seconds max duration
export const revalidate = 0;
export const runtime = 'nodejs';

// System constants
const SETTINGS_DOC = "rss_settings";
const GLOBAL_INTERVAL_MINUTES = 30; // Global posting interval
const FEED_COOLDOWN_MINUTES = 30; // Per-feed cooldown after success

const SYSTEM_PROMPT_BANGLA = `You are a professional Bangla news editor.
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

const SYSTEM_PROMPT_ENGLISH = `You are a professional news translator and editor.
Rules:
- TRANSLATE the English news to Bangla
- Maintain neutral journalistic tone
- No opinions, no analysis, no emotion
- No clickbait
- Do NOT add new facts or guess missing info
- Use short paragraphs (max 6 paragraphs, max 2 lines each)
- Max 120 words total
- Translate names and places appropriately (e.g., "Bangladesh" → "বাংলাদেশ")

Output format JSON ONLY:
{
  "title": "Translated Bangla Title",
  "summary": "Translated Bangla Summary..."
}`;

/**
 * RSS Auto-Posting Cron Endpoint
 * 
 * Triggered by cron-job.org every 30 minutes
 * Posts one news article from enabled RSS feeds
 * Sends push notification for each post
 */
export async function GET(req: NextRequest) {
    const start = Date.now();

    // 1. SECURITY CHECK
    const authorized = checkSecurity(req);
    if (!authorized) {
        console.warn("🚫 Unauthorized cron attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        console.log("⏰ RSS Cron Triggered at", new Date().toISOString());

        // 2. GLOBAL RATE LIMIT CHECK (30-minute interval)
        const settingsRef = dbAdmin.collection("system_stats").doc(SETTINGS_DOC);
        const settingsSnap = await settingsRef.get();
        const settings = (settingsSnap.data() as RssSettings) || {};

        // Check if we need to reset daily stats
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        if (settings.last_reset_date !== today) {
            await settingsRef.set({
                total_posts_today: 0,
                last_reset_date: today
            }, { merge: true });
            settings.total_posts_today = 0;
        }

        // Check global cooldown
        if (settings.last_news_posted_at) {
            const lastPostTime = settings.last_news_posted_at.toDate();
            const diffMinutes = (Date.now() - lastPostTime.getTime()) / (1000 * 60);

            if (diffMinutes < GLOBAL_INTERVAL_MINUTES) {
                const remaining = Math.ceil(GLOBAL_INTERVAL_MINUTES - diffMinutes);
                console.log(`⏸️ Global Cooldown Active. Last post: ${diffMinutes.toFixed(1)} mins ago. Wait ${remaining} mins.`);
                return NextResponse.json({
                    status: "skipped",
                    reason: "global_cooldown",
                    minutes_remaining: remaining,
                    last_posted_at: lastPostTime.toISOString()
                });
            }
        }

        // 3. FETCH ENABLED FEEDS
        const feedsSnap = await dbAdmin.collection("rss_feeds")
            .where("enabled", "==", true)
            .get();

        if (feedsSnap.empty) {
            console.log("⚠️ No enabled feeds found");
            return NextResponse.json({
                status: "skipped",
                reason: "no_feeds_enabled"
            });
        }

        // 4. FILTER AND SORT FEEDS
        let feeds = feedsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as RssFeed));

        // Filter out feeds in cooldown
        const now = Date.now();
        feeds = feeds.filter(f => {
            if (!f.cooldown_until) return true;
            const cooldownEnd = f.cooldown_until.toDate().getTime();
            return cooldownEnd <= now;
        });

        if (feeds.length === 0) {
            console.log("⏸️ All feeds are in cooldown");
            return NextResponse.json({
                status: "skipped",
                reason: "all_feeds_cooldown"
            });
        }

        // Sort: Priority DESC, then Last Checked ASC (oldest first)
        feeds.sort((a, b) => {
            const prioA = a.priority ?? 10;
            const prioB = b.priority ?? 10;
            if (prioA !== prioB) return prioB - prioA; // Higher priority first

            const timeA = a.last_checked_at ? a.last_checked_at.toDate().getTime() : 0;
            const timeB = b.last_checked_at ? b.last_checked_at.toDate().getTime() : 0;
            return timeA - timeB; // Older check first
        });

        console.log(`📋 Processing ${feeds.length} eligible feeds`);

        // 5. FEED PROCESSING LOOP (Fallback Logic)
        let posted = false;
        let postedFeed: string | null = null;
        let postedNewsId: string | null = null;
        const attempts: string[] = [];

        for (const feed of feeds) {
            // Safety timeout check (leave 15s buffer)
            if (Date.now() - start > 45000) {
                console.warn("⚠️ Cron timeout approaching (45s). Exiting loop.");
                break;
            }

            attempts.push(feed.name || feed.url);
            console.log(`\n🔍 Checking Feed: ${feed.name} (${feed.url})`);

            try {
                // Parse RSS feed
                const rssItems = await parseRssFeed(feed.url);

                if (rssItems.length === 0) {
                    console.log(`  ⚠️ Feed returned no items`);
                    await updateFeedChecked(feed.id);
                    continue;
                }

                console.log(`  📰 Found ${rssItems.length} items in feed`);

                // Check top 5 items for new content
                let foundNew = false;

                for (const item of rssItems.slice(0, 5)) {
                    const cleanUrl = normalizeUrl(item.link);

                    // Deduplication Check 1: URL Hash (fast)
                    const urlHash = generateUrlHash(cleanUrl);
                    const existingByUrl = await dbAdmin.collection("news")
                        .where("normalized_url_hash", "==", urlHash)
                        .limit(1)
                        .get();

                    if (!existingByUrl.empty) {
                        console.log(`  ⏭️ Duplicate URL: ${item.title.slice(0, 50)}...`);
                        continue;
                    }

                    // Fetch article content
                    console.log(`  📡 Fetching: ${item.title.slice(0, 50)}...`);
                    const fetchResult = await fetchArticle(item.link);

                    if (!fetchResult.success || !fetchResult.data?.textContent) {
                        const errorMsg = !fetchResult.success ? fetchResult.error : 'No content';
                        console.log(`  ❌ Fetch failed: ${errorMsg}`);
                        continue;
                    }

                    const article = fetchResult.data;

                    // Validate content length
                    if (article.textContent.length < 200) {
                        console.log(`  ⚠️ Content too short (${article.textContent.length} chars)`);
                        continue;
                    }

                    // Deduplication Check 2: Content Hash
                    const contentHash = generateContentHash(article.textContent);
                    const existingByContent = await dbAdmin.collection("news")
                        .where("content_hash", "==", contentHash)
                        .limit(1)
                        .get();

                    if (!existingByContent.empty) {
                        console.log(`  ⏭️ Duplicate Content: ${item.title.slice(0, 50)}...`);
                        continue;
                    }

                    // === FOUND VALID NEW ARTICLE ===
                    foundNew = true;
                    console.log(`  ✅ Valid new article found!`);

                    // Detect Language (simple heuristic: check for Bangla Unicode characters)
                    const isBangla = /[ঀ-৿]/.test(article.textContent.slice(0, 500));
                    const language = isBangla ? 'Bangla' : 'English';
                    console.log(`  🌍 Language detected: ${language}`);

                    // Select appropriate system prompt
                    const systemPrompt = isBangla ? SYSTEM_PROMPT_BANGLA : SYSTEM_PROMPT_ENGLISH;
                    const userPrompt = isBangla
                        ? `News:\n${article.textContent.slice(0, 8000)}\n\nSummarize this in Bangla following system rules.`
                        : `English News:\n${article.textContent.slice(0, 8000)}\n\nTranslate and summarize this English news to Bangla following system rules.`;

                    // Generate AI Summary (or Translation + Summary for English)
                    console.log(`  🤖 ${isBangla ? 'Generating' : 'Translating and generating'} AI summary...`);
                    const aiRes = await generateContent(
                        userPrompt,
                        {
                            systemPrompt: systemPrompt,
                            temperature: 0.2,
                            jsonMode: true
                        }
                    );

                    if (!aiRes?.content) {
                        throw new Error("AI generation failed");
                    }

                    // Parse AI response
                    let contentJson: any = {};
                    try {
                        const cleanedContent = aiRes.content
                            .replace(/```json/g, "")
                            .replace(/```/g, "")
                            .trim();
                        contentJson = JSON.parse(cleanedContent);
                    } catch (e) {
                        throw new Error("Invalid JSON from AI");
                    }

                    if (!contentJson.title || !contentJson.summary) {
                        throw new Error("Incomplete AI response (missing title or summary)");
                    }

                    console.log(`  📝 AI Title: ${contentJson.title.slice(0, 50)}...`);

                    // Calculate importance score
                    const scoreData = calculateImportanceScore(
                        contentJson.title,
                        contentJson.summary,
                        cleanUrl,
                        new Date()
                    );

                    // Determine category: Use auto-detected from article, fallback to feed category
                    const finalCategory = article.category || feed.category || "সাধারণ";
                    console.log(`  📂 Category: ${finalCategory}${article.category ? ' (auto-detected)' : ' (from feed)'}`);

                    // Save to Firestore
                    const newsRef = await dbAdmin.collection("news").add({
                        title: contentJson.title,
                        summary: contentJson.summary,
                        image: article.image || "",
                        source_url: item.link,
                        normalized_url: cleanUrl,
                        normalized_url_hash: urlHash,
                        content_hash: contentHash,
                        source_name: article.siteName || new URL(item.link).hostname,
                        published_at: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        category: finalCategory,
                        is_rss: true,
                        importance_score: scoreData.score
                    });

                    console.log(`  💾 Saved to Firestore: ${newsRef.id}`);

                    // Send Push Notification
                    console.log(`  🔔 Sending push notification...`);
                    const notifResult = await sendNotification(
                        contentJson.title,
                        contentJson.summary,
                        newsRef.id
                    );

                    if (notifResult) {
                        console.log(`  ✅ Notification sent successfully`);
                    } else {
                        console.log(`  ⚠️ Notification failed (non-blocking)`);
                    }

                    // Update Global Settings
                    const newTotalToday = (settings.total_posts_today || 0) + 1;
                    await settingsRef.set({
                        last_news_posted_at: Timestamp.now(),
                        total_posts_today: newTotalToday,
                        last_reset_date: today
                    }, { merge: true });

                    // Update Feed State (Success + Cooldown)
                    const cooldownTime = Timestamp.fromMillis(
                        Date.now() + FEED_COOLDOWN_MINUTES * 60 * 1000
                    );
                    await dbAdmin.collection("rss_feeds").doc(feed.id).update({
                        last_success_at: Timestamp.now(),
                        last_checked_at: Timestamp.now(),
                        cooldown_until: cooldownTime,
                        failure_count: 0,
                        error_log: ""
                    });

                    posted = true;
                    postedFeed = feed.name || feed.url;
                    postedNewsId = newsRef.id;

                    console.log(`\n🎉 Successfully posted from: ${postedFeed}`);
                    break; // Break item loop
                }

                if (posted) break; // Break feed loop

                // If no new items found, update checked time
                if (!foundNew) {
                    console.log(`  ⚠️ No new items in this feed`);
                    await updateFeedChecked(feed.id);
                }

            } catch (err) {
                console.error(`❌ Error processing feed ${feed.name}:`, err);

                // Update feed with error
                const errorMsg = err instanceof Error ? err.message : String(err);
                await dbAdmin.collection("rss_feeds").doc(feed.id).update({
                    last_checked_at: Timestamp.now(),
                    error_log: errorMsg,
                    failure_count: (feed.failure_count || 0) + 1
                });
            }
        }

        // 6. RETURN RESULT
        const duration = ((Date.now() - start) / 1000).toFixed(2);

        if (posted) {
            console.log(`\n✅ Cron completed in ${duration}s - Posted from ${postedFeed}`);
            return NextResponse.json({
                status: "posted",
                feed: postedFeed,
                newsId: postedNewsId,
                duration_seconds: parseFloat(duration),
                total_posts_today: (settings.total_posts_today || 0) + 1
            });
        } else {
            console.log(`\n⚠️ Cron completed in ${duration}s - No news posted`);
            return NextResponse.json({
                status: "checked_all",
                result: "no_new_articles",
                attempts: attempts,
                duration_seconds: parseFloat(duration)
            });
        }

    } catch (error: any) {
        console.error("💥 Cron Fatal Error:", error);
        return NextResponse.json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}

/**
 * Update feed's last_checked_at timestamp
 */
async function updateFeedChecked(feedId: string) {
    await dbAdmin.collection("rss_feeds").doc(feedId).update({
        last_checked_at: Timestamp.now()
    });
}

/**
 * Security check for cron endpoint
 * Validates CRON_SECRET from query param or Bearer token
 */
function checkSecurity(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET;

    // If no secret configured, allow (development mode)
    if (!secret) {
        console.warn("⚠️ CRON_SECRET not set - allowing request (dev mode)");
        return true;
    }

    // Check query parameter
    const queryKey = req.nextUrl.searchParams.get('key');
    if (queryKey === secret) return true;

    // Check Authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader === `Bearer ${secret}`) return true;

    return false;
}
