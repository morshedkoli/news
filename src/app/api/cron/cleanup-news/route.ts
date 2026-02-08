import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// Cleanup configuration
export const maxDuration = 60;
export const revalidate = 0;
export const runtime = 'nodejs';

const SETTINGS_DOC = "rss_settings";
const DEFAULT_RETENTION_DAYS = 20;

function checkSecurity(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return true;
    const queryKey = req.nextUrl.searchParams.get('key');
    if (queryKey === secret) return true;
    const authHeader = req.headers.get('authorization');
    if (authHeader === `Bearer ${secret}`) return true;
    return false;
}

export async function GET(req: NextRequest) {
    const authorized = checkSecurity(req);
    if (!authorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dryRun = req.nextUrl.searchParams.get('dry') === 'true';

    try {
        console.log(`🧹 News Cleanup Started. Dry=${dryRun}`);

        // Load retention settings
        const settingsRef = dbAdmin.collection("system_stats").doc(SETTINGS_DOC);
        const settingsSnap = await settingsRef.get();
        const settings = settingsSnap.exists ? (settingsSnap.data() ?? {}) : {};

        const retentionDays = typeof settings.news_retention_days === 'number'
            ? settings.news_retention_days
            : DEFAULT_RETENTION_DAYS;

        if (retentionDays <= 0) {
            console.log(`⏸️ Auto-cleanup disabled (retention_days=${retentionDays})`);
            return NextResponse.json({ 
                status: "skipped", 
                reason: "cleanup_disabled",
                retentionDays 
            });
        }

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

        console.log(`📅 Deleting news older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);

        // Query old news by date only (avoids composite index requirement)
        const oldNewsQuery = await dbAdmin.collection("news")
            .where("published_at", "<=", cutoffTimestamp)
            .limit(500)
            .get();

        // Filter by status in code
        const docsToDelete = oldNewsQuery.docs.filter(doc => {
            const data = doc.data();
            return data.status === 'published';
        });
        const totalFound = docsToDelete.length;

        console.log(`🔍 Found ${totalFound} old articles to delete`);

        if (totalFound === 0) {
            return NextResponse.json({
                status: "success",
                deleted: 0,
                retentionDays,
                message: "No old articles found"
            });
        }

        // Delete in batches
        const batch = dbAdmin.batch();
        const deletedIds: string[] = [];

        for (const doc of docsToDelete) {
            if (!dryRun) {
                batch.delete(doc.ref);
            }
            deletedIds.push(doc.id);
        }

        if (!dryRun) {
            await batch.commit();
            console.log(`✅ Deleted ${totalFound} old articles`);
        } else {
            console.log(`📝 Would delete ${totalFound} old articles (dry run)`);
        }

        // Log cleanup activity
        const cleanupLog = {
            action: 'news_cleanup',
            retention_days: retentionDays,
            deleted_count: totalFound,
            deleted_ids: dryRun ? [] : deletedIds.slice(0, 50), // Limit logged IDs
            dry_run: dryRun,
            cutoff_date: cutoffDate.toISOString(),
            performed_at: FieldValue.serverTimestamp()
        };

        await dbAdmin.collection("system_logs").add(cleanupLog);

        return NextResponse.json({
            status: "success",
            deleted: totalFound,
            retentionDays,
            dryRun,
            message: dryRun 
                ? `Would delete ${totalFound} articles` 
                : `Deleted ${totalFound} articles permanently`
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("💥 Cleanup Error:", error);
        return NextResponse.json({ 
            error: message,
            status: "failed" 
        }, { status: 500 });
    }
}
