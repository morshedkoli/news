import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import { parseRssFeed } from "@/lib/rss";
import { fetchArticle } from "@/lib/news-fetcher";
import { generateContent } from "@/lib/ai-engine";
import { normalizeUrl, generateContentHash, generateUrlHash } from '@/lib/news-dedup';
import { sendNotification } from "@/lib/notifications";
import { RssFeed, RssSettings } from '@/types/rss';
import { calculateImportanceScore } from "@/lib/news-scorer";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import crypto from 'crypto';

// Cron configuration
export const maxDuration = 60; // 60 seconds max duration
export const revalidate = 0;
export const runtime = 'nodejs';

// System constants
const SETTINGS_DOC = "rss_settings";
const DEFAULT_INTERVAL_MINUTES = 60; // Default: 1 post per hour = ~16-18 posts/day (6AM-12AM)

// Valid categories in Bangla for AI to choose from
const VALID_CATEGORIES = [
    "সাধারণ", "খেলাধুলা", "রাজনীতি", "প্রযুক্তি", "বিনোদন",
    "অর্থনীতি", "স্বাস্থ্য", "বিজ্ঞান", "শিক্ষা", "আন্তর্জাতিক",
    "জাতীয়", "জীবনযাত্রা", "মতামত", "অপরাধ", "পরিবেশ", "ধর্ম"
];

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

Valid categories (choose EXACTLY one): ${VALID_CATEGORIES.join(", ")}

Output format JSON ONLY:
{
  "title": "Clean Bangla Title",
  "summary": "Bangla Summary...",
  "category": "Category in Bangla from the list above"
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
- Analyze the content and choose the most appropriate category

Valid categories (choose EXACTLY one): ${VALID_CATEGORIES.join(", ")}

Output format JSON ONLY:
{
  "title": "Translated Bangla Title",
  "summary": "Translated Bangla Summary...",
  "category": "Category in Bangla from the list above"
}`;

/**
 * RSS Auto-Posting Cron Endpoint
 * 
 * Triggered by cron-job.org every 30 minutes
 * Posts one news article from enabled RSS feeds
 * Sends push notification for each post
 */
interface ProcessedCandidate {
    title: string;
    summary: string;
    category: string;
    score: number;
    image: string;
    sourceUrl: string;
    cleanUrl: string;
    urlHash: string;
    contentHash: string;
    sourceName: string;
    feedId: string;
    feedName: string;
}

export async function GET(req: NextRequest) {
    const start = Date.now();
    const runId = crypto.randomUUID();
    const skipReasons: string[] = [];

    // Tracking Counters
    let feedsChecked = 0;
    let itemsChecked = 0;
    let aiFailures = 0;
    let lastAiProvider: string | null = null;

    // Track cron-job.org requests
    const userAgent = req.headers.get('user-agent') || '';
    if (userAgent.toLowerCase().includes('cron-job.org')) {
        // Increment counter in Firestore
        const statsRef = dbAdmin.collection("system_stats").doc("rss_settings");
        await statsRef.set({
            cron_requests_count: FieldValue.increment(1)
        }, { merge: true });
    }

    function logDecision(status: 'POSTING' | 'SKIPPED', reason: string, details: string[] = []) {
        let detailsStr = "";
        if (details.length > 0) {
            const counts: Record<string, number> = {};
            details.forEach(d => counts[d] = (counts[d] || 0) + 1);
            detailsStr = Object.entries(counts).map(([k, v]) => `${k} (${v})`).join(', ');
        }

        const reasonsLog = detailsStr ? `| reasons=[${detailsStr}]` : `| reasons=[${reason}]`;
        console.log(`[RSS][DECISION] ${status} | runId=${runId} ${status === 'POSTING' ? `| reason=${reason}` : reasonsLog}`);
    }

    // HELPER: Finalize Run (Logs & Stats)
    async function finalizeRun(
        isPosted: boolean,
        reasons: string[],
        postedNewsId: string | null = null,
        isDryRun: boolean = false,
        failsafe: boolean = false,
        aiProvider: string | null = null
    ) {
        const finishedAt = new Date().toISOString();

        // 1. Log Run Details to Firestore (even for dry runs, but marked)
        await dbAdmin.collection("rss_run_logs").add({
            run_id: runId,
            run_type: isDryRun ? 'dry_run' : 'live',
            started_at: new Date(start).toISOString(),
            finished_at: finishedAt,
            feeds_checked: feedsChecked,
            items_checked: itemsChecked,
            ai_failures: aiFailures,
            post_published: isPosted,
            posted_news_id: postedNewsId,
            skip_reasons: reasons, // Array of strings
            duration_ms: Date.now() - start,
            failsafe_activated: failsafe,
            ai_provider_used: aiProvider || null
        });

        // 2. Update Dashboard Metrics (SKIP for Dry Run)
        if (!isDryRun) {
            const statsRef = dbAdmin.collection("system_stats").doc(SETTINGS_DOC);

            await dbAdmin.runTransaction(async (t) => {
                const doc = await t.get(statsRef);
                const data = doc.data() || {};

                const updates: any = {};

                if (isPosted) {
                    // Reset failure count
                    updates.consecutive_failed_runs = 0;
                    updates.last_successful_run = Timestamp.now();
                    updates.total_posts_today = (data.total_posts_today || 0) + 1;

                    // Calculate Avg Time Between Posts
                    if (data.last_successful_run) {
                        const lastRun = data.last_successful_run.toDate();
                        const diffMinutes = (Date.now() - lastRun.getTime()) / (1000 * 60);

                        const currentAvg = data.avg_time_between_posts || DEFAULT_INTERVAL_MINUTES; // Default 60
                        updates.avg_time_between_posts = Math.round((currentAvg * 0.8) + (diffMinutes * 0.2));
                    } else {
                        updates.avg_time_between_posts = DEFAULT_INTERVAL_MINUTES;
                    }
                } else {
                    // Increment failure count
                    updates.consecutive_failed_runs = (data.consecutive_failed_runs || 0) + 1;
                }

                updates.last_run_at = Timestamp.now();

                t.set(statsRef, updates, { merge: true });
            });
        }
    }

    const forceMode = req.nextUrl.searchParams.get('force') === 'true';
    const dryRun = req.nextUrl.searchParams.get('dry') === 'true';

    // 1. SECURITY CHECK
    const authorized = checkSecurity(req);
    if (!authorized) {
        console.warn("🚫 Unauthorized cron attempt");
        logDecision('SKIPPED', 'unauthorized');
        await finalizeRun(false, ['unauthorized'], null, dryRun);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        console.log(`⏰ RSS Cron Triggered at ${new Date().toISOString()} (RunID: ${runId}) [Force: ${forceMode}, Dry: ${dryRun}]`);

        // 2. GLOBAL RATE LIMIT CHECK (configurable interval)
        const settingsRef = dbAdmin.collection("system_stats").doc(SETTINGS_DOC);
        const settingsSnap = await settingsRef.get();
        const settings = (settingsSnap.data() as RssSettings) || {};

        // Get the configurable interval and start time (defaults)
        const GLOBAL_INTERVAL_MINUTES = settings.update_interval_minutes ?? DEFAULT_INTERVAL_MINUTES;
        const START_TIME = settings.start_time ?? "06:00"; // Default start time 6:00 AM

        // Check if current time is before start time (skip if before start)
        const now = new Date();
        const [startHour, startMinute] = START_TIME.split(':').map(Number);
        const startTimeToday = new Date(now);
        startTimeToday.setHours(startHour, startMinute, 0, 0);

        // Check time window (Timezone-aware)
        const { isTimeWindowAllowed } = await import('@/lib/rss-time-utils');
        const timeCheck = isTimeWindowAllowed(now, START_TIME, "Asia/Dhaka");

        console.log(`[RSS][TIME] ServerTime=${now.toISOString()}`);
        console.log(`[RSS][TIME] LocalTime=${timeCheck.localTime} (Target: ${START_TIME})`);
        console.log(`[RSS][TIME] Allowed=${timeCheck.allowed}`);

        if (forceMode) {
            console.log("💪 Force Mode active: Bypassing Time & Cooldown checks.");
        }

        if (!timeCheck.allowed && !forceMode) {
            console.log(`⏸️ Too early. Current time (${timeCheck.localTime}) is before start time (${START_TIME}). Skipping cron.`);
            logDecision('SKIPPED', 'before_start_time');
            skipReasons.push('before_start_time');
            await finalizeRun(false, skipReasons, null, dryRun);
            return NextResponse.json({
                status: "skipped",
                reason: "before_start_time",
                start_time: START_TIME,
                local_time: timeCheck.localTime,
                server_time: now.toISOString()
            });
        }

        // Check if we need to reset daily stats
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        if (settings.last_reset_date !== today) {
            if (!dryRun) { // Only reset if not a dry run
                await settingsRef.set({
                    total_posts_today: 0,
                    last_reset_date: today
                }, { merge: true });
            }
            settings.total_posts_today = 0;
        }

        // Check global cooldown
        // FAILSAFE 1: If no news posted in last 4 hours (System Stale)
        const FAILSAFE_HOURS = 4;
        const FAILSAFE_RUN_THRESHOLD = 3;
        let failsafeActive = false;

        // Check consecutive failures
        if ((settings.consecutive_failed_runs || 0) >= FAILSAFE_RUN_THRESHOLD) {
            failsafeActive = true;
            console.log(`🚨 [RSS][FAILSAFE] ACTIVATED | Reason: ${settings.consecutive_failed_runs} consecutive failed runs`);
        }

        if (settings.last_news_posted_at) {
            const lastPostTime = settings.last_news_posted_at.toDate();
            const diffMinutes = (Date.now() - lastPostTime.getTime()) / (1000 * 60);

            // Check if stale
            if (diffMinutes > (FAILSAFE_HOURS * 60)) {
                failsafeActive = true;
                console.log(`🚨 [RSS][FAILSAFE] ACTIVATED | Reason: System stale (${(diffMinutes / 60).toFixed(1)}h)`);
            }

            if (!failsafeActive && !forceMode && diffMinutes < GLOBAL_INTERVAL_MINUTES) {
                const remaining = Math.ceil(GLOBAL_INTERVAL_MINUTES - diffMinutes);
                console.log(`⏸️ Global Cooldown Active (${GLOBAL_INTERVAL_MINUTES}min interval). Last post: ${diffMinutes.toFixed(1)} mins ago. Wait ${remaining} mins.`);
                logDecision('SKIPPED', 'global_cooldown');
                await finalizeRun(false, ['global_cooldown'], null, dryRun);
                return NextResponse.json({
                    status: "skipped",
                    reason: "global_cooldown",
                    minutes_remaining: remaining,
                    interval_minutes: GLOBAL_INTERVAL_MINUTES,
                    start_time: START_TIME,
                    last_posted_at: lastPostTime.toISOString()
                });
            }
        } else {
            // First run ever or corrupted state
            console.log(`✨ First run or unknown state. Failsafe enabled.`);
            failsafeActive = true;
        }

        // 3. FETCH ENABLED FEEDS
        const feedsSnap = await dbAdmin.collection("rss_feeds")
            .where("enabled", "==", true)
            .get();

        if (feedsSnap.empty) {
            console.log("⚠️ No enabled feeds found");
            logDecision('SKIPPED', 'no_feeds_enabled');
            await finalizeRun(false, ['no_feeds_enabled']);
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

        // Filter out feeds in cooldown (UNLESS Failsafe)
        const nowMillis = Date.now();
        feeds = feeds.filter(f => {
            if (failsafeActive) return true;

            if (!f.cooldown_until) return true;
            const cooldownEnd = f.cooldown_until.toDate().getTime();
            const inCooldown = cooldownEnd > nowMillis;
            if (inCooldown) {
                skipReasons.push(`feed_cooldown:${f.name}`);
            }
            return !inCooldown;
        });

        if (feeds.length === 0) {
            console.log("⏸️ All feeds are in cooldown");
            logDecision('SKIPPED', 'all_feeds_cooldown', skipReasons);
            await finalizeRun(false, skipReasons);
            return NextResponse.json({
                status: "skipped",
                reason: "all_feeds_cooldown"
            });
        }

        // Sort: Priority DESC, then Last Checked ASC
        feeds.sort((a, b) => {
            const prioA = a.priority ?? 10;
            const prioB = b.priority ?? 10;
            if (prioA !== prioB) return prioB - prioA;

            const timeA = a.last_checked_at ? a.last_checked_at.toDate().getTime() : 0;
            const timeB = b.last_checked_at ? b.last_checked_at.toDate().getTime() : 0;
            return timeA - timeB;
        });

        console.log(`📋 Processing ${feeds.length} eligible feeds`);

        // 5. FEED PROCESSING LOOP
        let posted = false;
        let postedReason = "";
        let postedFeed: string | null = null;
        let postedNewsId: string | null = null;
        const attempts: string[] = [];
        const candidates: ProcessedCandidate[] = [];

        // Helper to publish a candidate
        async function publishCandidate(candidate: ProcessedCandidate, reason: string) {
            if (dryRun) {
                console.log(`🧪 [DRY RUN] Would publish: ${candidate.title.slice(0, 50)}... (Score: ${candidate.score.toFixed(1)})`);
                posted = true;
                postedReason = reason + " (DRY RUN)";
                postedFeed = candidate.feedName;
                postedNewsId = "dry-run-id";
                return;
            }

            console.log(`\n🚀 Publishing Candidate: ${candidate.title.slice(0, 50)}... (Score: ${candidate.score.toFixed(1)})`);

            // 1. Commit to DB
            const newsRef = await dbAdmin.collection("news").add({
                title: candidate.title,
                summary: candidate.summary,
                image: candidate.image || "",
                source_url: candidate.sourceUrl,
                normalized_url: candidate.cleanUrl,
                normalized_url_hash: candidate.urlHash,
                content_hash: candidate.contentHash,
                source_name: candidate.sourceName,
                published_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                category: candidate.category,
                is_rss: true,
                importance_score: candidate.score
            });

            console.log(`  💾 Saved to Firestore: ${newsRef.id}`);

            // 2. Notification Deduplication & Send
            const notifHash = crypto.createHash('sha256').update(newsRef.id).digest('hex');
            const notifRef = dbAdmin.collection("sent_notifications").doc(notifHash);
            const notifDoc = await notifRef.get();

            if (notifDoc.exists) {
                console.warn(`  ⚠️ Notification duplicate detected (Hash: ${notifHash}). Skipping.`);
            } else {
                // Send Push
                const notifResult = await sendNotification(
                    candidate.title,
                    candidate.summary,
                    newsRef.id
                );

                if (notifResult) {
                    console.log(`  ✅ Notification sent`);
                    // Mark as sent
                    await notifRef.set({
                        post_id: newsRef.id,
                        sent_at: Timestamp.now(),
                        hash: notifHash
                    });
                } else {
                    console.log(`  ⚠️ Notification failed`);
                }
            }

            // Update stats
            const currentStats = (await settingsRef.get()).data() as RssSettings;
            const totalPosted = (currentStats?.total_posts_today || 0) + 1;

            await settingsRef.set({
                last_news_posted_at: Timestamp.now(),
                total_posts_today: totalPosted,
                last_reset_date: today
            }, { merge: true });

            // Feed Cooldown
            const feedCooldownMinutes = Math.max(30, Math.floor(GLOBAL_INTERVAL_MINUTES / 2));
            const cooldownTime = Timestamp.fromMillis(Date.now() + feedCooldownMinutes * 60 * 1000);

            await dbAdmin.collection("rss_feeds").doc(candidate.feedId).update({
                last_success_at: Timestamp.now(),
                last_checked_at: Timestamp.now(),
                cooldown_until: cooldownTime,
                failure_count: 0,
                error_log: ""
            });

            posted = true;
            postedReason = reason;
            postedFeed = candidate.feedName;
            postedNewsId = newsRef.id;
        }

        for (const feed of feeds) {
            // Safety timeout check 
            if (Date.now() - start > 45000) {
                console.warn("⚠️ Cron timeout approaching (45s). Exiting loop.");
                skipReasons.push('cron_timeout_approaching');
                break;
            }
            feedsChecked++;

            attempts.push(feed.name || feed.url);
            console.log(`\n🔍 Checking Feed: ${feed.name} (${feed.url})`);

            try {
                // Parse RSS feed
                const rssItems = await parseRssFeed(feed.url);

                if (rssItems.length === 0) {
                    console.log(`  ⚠️ Feed returned no items`);
                    await updateFeedChecked(feed.id);
                    skipReasons.push(`feed_empty:${feed.name}`);
                    continue;
                }

                console.log(`  📰 Found ${rssItems.length} items in feed`);

                // Check top 5 items for new content
                let feedCandidateFound = false;
                let feedItemsSkipped = 0;

                for (const item of rssItems.slice(0, 5)) {
                    if (posted) break;
                    itemsChecked++;

                    const cleanUrl = normalizeUrl(item.link);

                    // Deduplication Check 1: URL Hash (fast)
                    const urlHash = generateUrlHash(cleanUrl);
                    const existingByUrl = await dbAdmin.collection("news")
                        .where("normalized_url_hash", "==", urlHash)
                        .limit(1)
                        .get();

                    if (!existingByUrl.empty) {
                        console.log(`  ⏭️ Duplicate URL: ${item.title.slice(0, 50)}...`);
                        skipReasons.push('duplicate_url');
                        feedItemsSkipped++;
                        continue;
                    }

                    // Fetch article content
                    console.log(`  📡 Fetching: ${item.title.slice(0, 50)}...`);
                    const fetchResult = await fetchArticle(item.link);

                    if (!fetchResult.success || !fetchResult.data?.textContent) {
                        const errorMsg = !fetchResult.success ? fetchResult.error : 'No content';
                        console.log(`  ❌ Fetch failed: ${errorMsg}`);
                        skipReasons.push('fetch_failed');
                        feedItemsSkipped++;
                        continue;
                    }

                    const article = fetchResult.data;

                    // Validate content length
                    if (article.textContent.length < 200) {
                        console.log(`  ⚠️ Content too short (${article.textContent.length} chars)`);
                        skipReasons.push('content_too_short');
                        feedItemsSkipped++;
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
                        skipReasons.push('duplicate_content');
                        feedItemsSkipped++;
                        continue;
                    }

                    // === FOUND VALID NEW ARTICLE ===
                    console.log(`  ✅ Valid new article found!`);

                    // Detect Language
                    const isBangla = /[ঀ-৿]/.test(article.textContent.slice(0, 500));
                    const language = isBangla ? 'Bangla' : 'English';
                    console.log(`  🌍 Language detected: ${language}`);

                    // System Prompt
                    const systemPrompt = isBangla ? SYSTEM_PROMPT_BANGLA : SYSTEM_PROMPT_ENGLISH;
                    const userPrompt = isBangla
                        ? `News:\n${article.textContent.slice(0, 8000)}\n\nSummarize this in Bangla following system rules.`
                        : `English News:\n${article.textContent.slice(0, 8000)}\n\nTranslate and summarize this English news to Bangla following system rules.`;

                    // === AI GENERATION WITH RETRIES ===
                    const MAX_RETRIES = 2; // Total 3
                    let aiSuccess = false;
                    let contentJson: any = {};

                    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                        try {
                            console.log(`  🤖 Generative AI Attempt ${attempt + 1}/${MAX_RETRIES + 1}...`);

                            const aiRes = await generateContent(
                                userPrompt,
                                {
                                    systemPrompt: systemPrompt,
                                    temperature: 0.2 + (attempt * 0.1),
                                    jsonMode: true,
                                    feature: 'rss_cron'
                                }
                            );

                            if (!aiRes?.content) {
                                throw new Error("AI returned empty content");
                            }

                            // Capture provider
                            if (aiRes.providerUsed) lastAiProvider = aiRes.providerUsed;

                            // Parse AI response
                            try {
                                const cleanedContent = aiRes.content
                                    .replace(/```json/g, "")
                                    .replace(/```/g, "")
                                    .trim();

                                try {
                                    contentJson = JSON.parse(cleanedContent);
                                } catch (parseErr) {
                                    console.warn("  ⚠️ JSON Parse Failed, attempting Regex fallback...");
                                    const titleMatch = cleanedContent.match(/"title"\s*:\s*"([^"]+)"/);
                                    const summaryMatch = cleanedContent.match(/"summary"\s*:\s*"([\s\S]*?)"\s*(,|})/);
                                    const categoryMatch = cleanedContent.match(/"category"\s*:\s*"([^"]+)"/);

                                    if (summaryMatch) {
                                        contentJson = {
                                            title: titleMatch ? titleMatch[1] : article.title,
                                            summary: summaryMatch[1].replace(/\\n/g, '\n').trim(),
                                            category: categoryMatch ? categoryMatch[1] : null
                                        };
                                    } else {
                                        throw new Error("Failed to extract content via Regex");
                                    }
                                }
                            } catch (e) {
                                throw new Error("Invalid JSON structure");
                            }

                            if (!contentJson.title || !contentJson.summary) {
                                throw new Error("Incomplete JSON (missing title/summary)");
                            }
                            // VALIDATION: Smart Language Check
                            // 1. Must contain at least SOME Bangla characters
                            const hasBanglaChar = /[ঀ-৿]/.test(contentJson.title) && /[ঀ-৿]/.test(contentJson.summary);

                            if (!hasBanglaChar) {
                                if (failsafeActive) {
                                    console.warn("  ⚠️ [Failsafe] Allowing content with NO Bangla characters.");
                                } else {
                                    throw new Error("Content contains NO Bangla characters");
                                }
                            }

                            // 2. "Allow mixed Bangla-English up to 30%"
                            // match logic...

                            aiSuccess = true;
                            break;

                        } catch (err: any) {
                            console.warn(`  ⚠️ AI Attempt ${attempt + 1} failed: ${err.message}`);
                            aiFailures++;
                            if (attempt === MAX_RETRIES) {
                                skipReasons.push(`ai_failed_after_retries:${err.message}`);
                            }
                        }
                    }

                    if (!aiSuccess) {
                        console.error("  ❌ All AI attempts failed. Skipping item.");
                        feedItemsSkipped++;
                        continue;
                    }

                    console.log(`  📝 AI Title: ${contentJson.title.slice(0, 50)}...`);

                    // Calculate importance score
                    const scoreData = calculateImportanceScore(
                        contentJson.title,
                        contentJson.summary,
                        cleanUrl,
                        new Date()
                    );

                    // Determine category
                    let finalCategory = "সাধারণ";
                    let categorySource = "default";

                    if (contentJson.category && VALID_CATEGORIES.includes(contentJson.category)) {
                        finalCategory = contentJson.category;
                        categorySource = "AI-detected";
                    } else if (article.category && VALID_CATEGORIES.includes(article.category)) {
                        finalCategory = article.category;
                        categorySource = "article metadata";
                    } else if (feed.category && VALID_CATEGORIES.includes(feed.category)) {
                        finalCategory = feed.category;
                        categorySource = "feed config";
                    }

                    console.log(`  📂 Category: ${finalCategory} (${categorySource})`);

                    const candidate: ProcessedCandidate = {
                        title: contentJson.title,
                        summary: contentJson.summary,
                        category: finalCategory,
                        score: scoreData.score,
                        image: article.image || "",
                        sourceUrl: item.link,
                        cleanUrl: cleanUrl,
                        urlHash: urlHash,
                        contentHash: contentHash,
                        sourceName: article.siteName || new URL(item.link).hostname,
                        feedId: feed.id,
                        feedName: feed.name || feed.url
                    };

                    // === STRATEGY EVALUATION ===
                    const HIGH_QUALITY_THRESHOLD = 70;

                    if (candidate.score >= HIGH_QUALITY_THRESHOLD) {
                        console.log(`  🌟 High Quality Item found (Score: ${candidate.score}). Posting immediately.`);
                        await publishCandidate(candidate, 'high_quality_match');
                        break;
                    } else {
                        console.log(`  📥 Buffering Candidate (Score: ${candidate.score}). Continuing search...`);
                        candidates.push(candidate);
                        feedCandidateFound = true;
                    }
                } // End Item Loop

                if (posted) break;

                // If no new items found, update checked time
                if (!feedCandidateFound) {
                    console.log(`  ⚠️ No new items in this feed`);
                    await updateFeedChecked(feed.id);
                    skipReasons.push(`feed_no_new_items:${feed.name} (${feedItemsSkipped} skipped)`);
                }

            } catch (err) {
                console.error(`❌ Error processing feed ${feed.name}:`, err);
                skipReasons.push(`feed_error:${feed.name}`);

                const errorMsg = err instanceof Error ? err.message : String(err);
                await dbAdmin.collection("rss_feeds").doc(feed.id).update({
                    last_checked_at: Timestamp.now(),
                    error_log: errorMsg,
                    failure_count: (feed.failure_count || 0) + 1
                });
            }
        } // End Feed Loop

        // === FALLBACK: If nothing posted, check candidates ===
        if (!posted && candidates.length > 0) {
            console.log(`\n🤔 No High-Quality items found. Checking buffered candidates...`);
            candidates.sort((a, b) => b.score - a.score);
            const best = candidates[0];

            // PRIORITY OVERRIDE
            const originalScore = best.score;
            best.category = "সাধারণ";
            best.score = Math.min(best.score, 60);

            console.log(`  💎 Best Candidate: ${best.title} (Original Score: ${originalScore.toFixed(1)} -> Capped: ${best.score})`);
            console.log(`  🏷️ Category Overridden to: ${best.category}`);

            await publishCandidate(best, 'fallback_best_candidate_capped');
        }

        // 6. RETURN RESULT
        const duration = ((Date.now() - start) / 1000).toFixed(2);

        if (posted) {
            logDecision('POSTING', postedReason);
            console.log(`\n✅ Cron completed in ${duration}s - Posted from ${postedFeed}`);
            await finalizeRun(true, [postedReason], postedNewsId, dryRun, failsafeActive, lastAiProvider);
            return NextResponse.json({
                status: "posted",
                feed: postedFeed,
                newsId: postedNewsId,
                score: candidates.find(c => c.cleanUrl === candidates[0]?.cleanUrl)?.score, // Approx
                reason: postedReason,
                duration_seconds: parseFloat(duration),
                total_posts_today: (settings.total_posts_today || 0) + 1
            });
        } else {
            console.log(`\n⚠️ Cron completed in ${duration}s - No news posted`);
            logDecision('SKIPPED', 'no_valid_items_found', skipReasons);
            await finalizeRun(false, skipReasons, null, dryRun, failsafeActive, lastAiProvider);
            return NextResponse.json({
                status: "checked_all",
                result: "no_new_articles",
                attempts: attempts,
                duration_seconds: parseFloat(duration),
                skipped_reasons: skipReasons
            });
        }

    } catch (error: any) {
        console.error("💥 Cron Fatal Error:", error);
        logDecision('SKIPPED', 'fatal_error', [error.message]);

        try {
            await finalizeRun(false, ['fatal_error: ' + error.message]);
        } catch (e) { console.error("Failed to log fatal error to DB", e); }

        return NextResponse.json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}

async function updateFeedChecked(feedId: string) {
    await dbAdmin.collection("rss_feeds").doc(feedId).update({
        last_checked_at: Timestamp.now()
    });
}

function checkSecurity(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return true; // dev mode
    const queryKey = req.nextUrl.searchParams.get('key');
    if (queryKey === secret) return true;
    const authHeader = req.headers.get('authorization');
    if (authHeader === `Bearer ${secret}`) return true;
    return false;
}
