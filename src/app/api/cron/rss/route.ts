import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin"; // Keep common imports
import { NewsFetchOrchestrator } from "@/lib/news/orchestrator";
import { RssSettings } from '@/types/rss';
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// Cron configuration
export const maxDuration = 60; // 60 seconds max duration
export const revalidate = 0;
export const runtime = 'nodejs';

// System constants
const SETTINGS_DOC = "rss_settings";
const DEFAULT_INTERVAL_MINUTES = 30; // Target: Every 30 mins

export async function GET(req: NextRequest) {
    const start = Date.now();

    // 1. SECURITY CHECK
    const authorized = checkSecurity(req);
    if (!authorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse Params
    const forceMode = req.nextUrl.searchParams.get('force') === 'true';
    const dryRun = req.nextUrl.searchParams.get('dry') === 'true';
    const userAgent = req.headers.get('user-agent') || '';

    // Track cron-job.org
    if (userAgent.toLowerCase().includes('cron-job.org')) {
        await dbAdmin.collection("system_stats").doc(SETTINGS_DOC).set({
            cron_requests_count: FieldValue.increment(1)
        }, { merge: true });
    }

    try {
        console.log(`⏰ Cron Triggered. Force=${forceMode}, Dry=${dryRun}`);

        // 2. LOAD SETTINGS & LOCK CHECK
        const settingsRef = dbAdmin.collection("system_stats").doc(SETTINGS_DOC);
        // Transaction to check/set lock?
        // Simple Firestore check is sufficient for this scale
        const settingsSnap = await settingsRef.get();
        const settings = (settingsSnap.data() as RssSettings) || {};

        // === CRITICAL: TTL LOCK CHECK ===
        // If locked AND lock is fresh (less than 10 mins old), SKIP.
        // If locked BUT lock is OLD (expired), IGNORE lock and proceed (Auto-Recovery).
        if (settings.global_lock_until && !forceMode && !dryRun) {
            const lockExpires = settings.global_lock_until.toDate().getTime();
            if (Date.now() < lockExpires) {
                console.log(`⏸️ System is locked until ${settings.global_lock_until.toDate().toLocaleTimeString()}`);
                return NextResponse.json({ status: "skipped", reason: "global_lock_active" });
            } else {
                console.log(`⚠️ Lock expired! Forcing release and proceeding.`);
            }
        }

        // 3. SET LOCK (10 Minutes TTL)
        if (!dryRun) {
            const lockTime = new Date(Date.now() + 10 * 60 * 1000); // 10 mins from now
            await settingsRef.set({ global_lock_until: FieldValue.serverTimestamp() }, { merge: true }); // Use server time or set calculated? 
            // Better: Set specific time.
            await settingsRef.update({
                global_lock_until: Timestamp.fromDate(lockTime)
            });
        }

        // 4. TIME & FREQUENCY CHECKS
        // A. Start Time Check (6:00 AM)
        const START_TIME = settings.start_time ?? "06:00";
        const { isTimeWindowAllowed } = await import('@/lib/rss-time-utils');
        const timeCheck = isTimeWindowAllowed(new Date(), START_TIME, "Asia/Dhaka");

        if (!timeCheck.allowed && !forceMode && !dryRun) {
            console.log(`⏸️ Too early (${timeCheck.localTime}), waiting for ${START_TIME}`);
            // Unlock before return
            if (!dryRun) await settingsRef.update({ global_lock_until: null });
            return NextResponse.json({ status: "skipped", reason: "before_start_time" });
        }

        // B. Global Cooldown Check (Last Successful Publish)
        // Cooldown should ONLY apply if we actually PUBLISHED recently.
        if (settings.last_news_posted_at && !forceMode && !dryRun) {
            const lastPost = settings.last_news_posted_at.toDate().getTime();
            const minsSince = (Date.now() - lastPost) / 60000;
            const limit = settings.update_interval_minutes || DEFAULT_INTERVAL_MINUTES;

            if (minsSince < limit) {
                console.log(`⏸️ Global Cooldown. Last post ${minsSince.toFixed(1)}m ago. Limit ${limit}m.`);
                if (!dryRun) await settingsRef.update({ global_lock_until: null });
                return NextResponse.json({ status: "skipped", reason: "global_cooldown" });
            }
        }

        // C. Daily Reset Logic
        const today = new Date().toISOString().split('T')[0];
        if (settings.last_reset_date !== today && !dryRun) {
            await settingsRef.set({
                total_posts_today: 0,
                last_reset_date: today,
                temp_disabled_sources: []
            }, { merge: true });
        }

        // 5. EXECUTE ORCHESTRATOR
        const orchestrator = new NewsFetchOrchestrator();
        const result = await orchestrator.run(forceMode, dryRun);

        // 6. CLEAR LOCK
        if (!dryRun) {
            await settingsRef.update({ global_lock_until: null });
        }

        // 7. RETURN STATUS
        // Success = True only if published successfully.
        if (!result.success) {
            console.log("❌ Run failed to publish any news.");
            return NextResponse.json({ status: "failed", result }, { status: 200 }); // 200 OK so Cron Job scheduler logs it as run
        }

        return NextResponse.json({
            status: "success",
            result
        });

    } catch (error: any) {
        console.error("💥 Cron Fatal Error:", error);
        // Force unlock on error
        try {
            await dbAdmin.collection("system_stats").doc(SETTINGS_DOC).update({ global_lock_until: null });
        } catch (e) { }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
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
