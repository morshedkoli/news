import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import { parseRssFeed, calculateNextRun } from "@/lib/rss"; // Added helper
import { fetchArticle } from "@/lib/news-fetcher";
import { generateContent, getActiveProviders } from "@/lib/ai-engine";
import { normalizeUrl, checkDuplicate, generateContentHash } from '@/lib/news-dedup';
import { NewsArticle } from '@/types/news';
import { RssFeed, RssSettings } from '@/types/rss'; // Added types
import { calculateImportanceScore } from "@/lib/news-scorer";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

// Allow execution to finish one feed (Vercel max is usually 10-60s on hobby, we target 30s)
export const maxDuration = 60;
export const revalidate = 0;

const HELP_ALERTS_COLLECTION = "system_alerts";
const SETTINGS_DOC_REF = dbAdmin.collection("system_stats").doc("rss_settings");
const PROGRESS_DOC_REF = dbAdmin.collection('system_stats').doc('rss_progress');

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

// Helper to update live progress for Admin UI
async function updateProgress(data: any) {
    try {
        await PROGRESS_DOC_REF.set({
            ...data,
            last_updated: FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error("Failed to update progress:", e);
    }
}

async function logSystemEvent(message: string, type: 'info' | 'error' | 'success' | 'warn') {
    console.log(`[RSS-CRON] [${type.toUpperCase()}] ${message}`);
    const emoji = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warn' ? '⚠️' : 'ℹ️';
    await updateProgress({
        logs: FieldValue.arrayUnion(`${emoji} ${message}`)
    });
}

export async function GET(req: NextRequest) {
    const executionStart = Date.now();

    // --- HYBRID CRON STRATEGY DOCUMENTATION ---
    // Vercel Hobby Plan allows internal cron jobs only once per day.
    // This endpoint is designed to be called by EXTERNAL cron services (e.g., cron-job.org)
    // for frequent execution (e.g., every 10 minutes).
    // The daily Vercel cron serves as a fallback safety trigger.
    // ------------------------------------------

    const source = req.headers.get('x-vercel-cron') ? 'Vercel Cron' : 'External/Manual';
    console.log(`⏰ Master Cron Waking Up... Source: ${source}`);

    try {
        // 1. Load Settings
        const settingsDoc = await SETTINGS_DOC_REF.get();
        const settings = (settingsDoc.data() || {
            master_interval_minutes: 5,
            global_safety_delay_minutes: 5,
            require_ai_online: true,
            max_feeds_per_cycle: 1, // Default to 1 for safety
            global_lock_until: null,
            global_cooldown_until: null
        }) as RssSettings;

        // 2. Cooldown Check
        const now = Timestamp.now();
        if (settings.global_cooldown_until && settings.global_cooldown_until.toMillis() > now.toMillis()) {
            const cooldownLeft = Math.ceil((settings.global_cooldown_until.toMillis() - now.toMillis()) / 1000 / 60);
            await logSystemEvent(`System in Cooldown. Resuming in ${cooldownLeft} mins.`, 'info');
            await updateProgress({ status: 'waiting', cooldown_until: settings.global_cooldown_until });
            return NextResponse.json({ message: "Cooldown active", next_check: settings.global_cooldown_until.toDate() });
        }

        // 3. Lock Check (Crash Recovery)
        if (settings.global_lock_until && settings.global_lock_until.toMillis() > now.toMillis()) {
            // Lock is active. Is it stale?
            const lockTime = settings.global_lock_until.toDate();
            // If lock is > 10 mins in future (shouldn't happen) or just valid, we wait.
            // Actually, we trust the lock.
            await logSystemEvent(`System Locked. Another feed is running.`, 'warn');
            await updateProgress({ status: 'running' });
            return NextResponse.json({ message: "System Locked", locked_until: lockTime });
        }

        // 4. AI Check
        if (settings.require_ai_online) {
            const providers = await getActiveProviders();
            if (providers.length === 0) {
                await logSystemEvent(`AI Offline. Skipping run.`, 'error');
                await updateProgress({ status: 'error' });
                return NextResponse.json({ message: "AI Offline" }, { status: 503 });
            }
        }

        // 5. Fetch Candidate Feeds
        // Logic: Enabled = true AND next_run_at <= Now (or null) AND status = 'idle' (or stale running)
        // Note: Firestore doesn't support OR queries well in this context, so we fetch standard candidates.

        const feedsSnap = await dbAdmin.collection("rss_feeds")
            .where("enabled", "==", true)
            .where("status", "==", "idle") // Only pick idle ones
            .where("next_run_at", "<=", now)
            .orderBy("next_run_at", "asc")
            .limit(1) // STRICTLY ONE at a time per Master Cron Cycle
            .get();

        if (feedsSnap.empty) {
            // Check if we have any "stale" running feeds (crashed?)
            // TODO: Add stale check logic if needed.
            await updateProgress({ status: 'idle', message: 'No feeds due.' });
            return NextResponse.json({ message: "No feeds due." });
        }

        const feedDoc = feedsSnap.docs[0];
        const feed = { id: feedDoc.id, ...feedDoc.data() } as RssFeed;

        await logSystemEvent(`Selected Feed: ${feed.url}`, 'info');

        // 6. ACQUIRE LOCK & SET RUNNING
        const lockDurationMinutes = 5;
        const lockUntil = Timestamp.fromMillis(Date.now() + lockDurationMinutes * 60 * 1000);

        // Transaction or Batch to ensure atomicity? 
        // For simplicity in this v1 architecture, we just write. Race conditions are rare with 1 worker pattern.
        await SETTINGS_DOC_REF.update({
            global_lock_until: lockUntil
        });

        await dbAdmin.collection("rss_feeds").doc(feed.id).update({
            status: 'running',
            last_run_at: now
        });

        await updateProgress({
            status: 'running',
            current_feed_url: feed.url,
            current_feed_id: feed.id
        });

        // 7. PROCESS FEED
        let executionSuccess = false;
        let processedCount = 0;

        try {
            const items = await parseRssFeed(feed.url);
            const topItems = items.slice(0, 3); // Max 3 items per run to stay fast

            for (const item of topItems) {
                // Timeout Safety: Stop if running longer than 45s (leaving 15s for cleanup)
                if (Date.now() - executionStart > 45000) {
                    console.warn("⚠️ Cron approaching timeout. Stopping loop to cleanup.");
                    await logSystemEvent("Timeout approaching. Stopping cycle early.", 'warn');
                    break;
                }
                // --- FEED PROCESSING LOGIC (Copied & Optimized from old cron) ---
                const cleanUrl = normalizeUrl(item.link);

                // Check Status & Lock again inside loop? No, too expensive.

                // Dedupe
                const urlCheck = await checkDuplicate(cleanUrl, '', '');
                if (urlCheck.isDuplicate) {
                    console.log(`Skipping Duplicate: ${cleanUrl}`);
                    continue;
                }

                // Fetch Body
                const article = await fetchArticle(item.link);
                if (!article?.textContent || article.textContent.length < 200) continue;

                // Summarize
                const textChunk = article.textContent.slice(0, 8000);
                const userPrompt = `নিচের সংবাদটি সংক্ষেপে উপস্থাপন করুন। মূল তথ্য ঠিক রাখুন। কোনো মতামত দেবেন না।\n\nসংবাদ:\n${textChunk}`;

                const aiRes = await generateContent(userPrompt, {
                    systemPrompt: SYSTEM_PROMPT,
                    temperature: 0.2,
                    jsonMode: true
                });

                if (!aiRes || !aiRes.content) throw new Error("AI Empty Response");

                let summaryData: any = {};
                try {
                    summaryData = JSON.parse(aiRes.content.replace(/```json/g, "").replace(/```/g, "").trim());
                } catch (e) { continue; }

                if (!summaryData.title || !summaryData.summary) continue;

                // Publish
                const scoreData = calculateImportanceScore(summaryData.title, summaryData.summary, cleanUrl, new Date());

                await dbAdmin.collection("news").add({
                    title: summaryData.title,
                    summary: summaryData.summary + "\n\n(AI সংক্ষেপিত)",
                    image: article.image || "",
                    source_url: item.link,
                    normalized_url: cleanUrl,
                    content_hash: generateContentHash(article.textContent),
                    source_name: article.siteName || new URL(item.link).hostname,
                    published_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    category: "general",
                    is_rss: true,
                    importance_score: scoreData.score
                });

                processedCount++;
            }

            executionSuccess = true;
            await logSystemEvent(`Processed ${processedCount} items from ${feed.name || feed.url}`, 'success');

        } catch (error: any) {
            console.error("Feed Execution Failed:", error);
            await logSystemEvent(`Feed Failed: ${error.message}`, 'error');
            await dbAdmin.collection("rss_feeds").doc(feed.id).update({
                error_log: error.message
            });
        }

        // 8. CLEANUP & SCHEDULE NEXT
        const finishTime = new Date();

        // Next Run Calculation
        const nextRun = calculateNextRun(feed.start_time || "09:00", feed.interval_minutes || 60, finishTime);
        const nextRunTs = Timestamp.fromDate(nextRun);

        await dbAdmin.collection("rss_feeds").doc(feed.id).update({
            status: 'idle',
            last_run_at: Timestamp.fromDate(finishTime),
            next_run_at: nextRunTs
        });

        // 9. RELEASE LOCK & SET COOLDOWN
        // Determine safety delay
        const safetyDelay = feed.safety_delay_minutes || settings.global_safety_delay_minutes || 5;
        const cooldownUntil = Timestamp.fromMillis(Date.now() + safetyDelay * 60 * 1000);

        await SETTINGS_DOC_REF.update({
            global_lock_until: null,
            global_cooldown_until: cooldownUntil
        });

        await updateProgress({
            status: 'waiting',
            cooldown_until: cooldownUntil,
            last_feed_count: processedCount
        });

        await logSystemEvent(`Cycle Complete. Cooling down for ${safetyDelay} mins.`, 'info');

        return NextResponse.json({
            success: true,
            processed: processedCount,
            feed: feed.url,
            next_run: nextRun.toISOString()
        });

    } catch (criticalError: any) {
        console.error("CRITICAL CRON FAILURE", criticalError);
        // Emergency Unlock
        try {
            await SETTINGS_DOC_REF.update({ global_lock_until: null });
        } catch (e) { console.error("Failed to unlock", e); }

        return NextResponse.json({
            error: "Critical Internal Error",
            details: criticalError.message,
            stack: criticalError.stack
        }, { status: 500 });
    }
}
