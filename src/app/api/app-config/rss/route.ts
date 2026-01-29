import { NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";
import { RssSettings } from "@/types/rss";

export const revalidate = 0; // Disable Vercel cache for real-time updates

const DEFAULT_CONFIG: RssSettings = {
    update_interval_minutes: 30,
    total_posts_today: 0,
    start_time: "06:00", // Default start time 6:00 AM
};

const SETTINGS_DOC = "rss_settings";
const SETTINGS_COLLECTION = "system_stats";

export async function GET() {
    try {
        const doc = await dbAdmin.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).get();
        const data = (doc.data() as RssSettings) || DEFAULT_CONFIG;

        return NextResponse.json({
            update_interval_minutes: data.update_interval_minutes ?? DEFAULT_CONFIG.update_interval_minutes,
            start_time: data.start_time ?? DEFAULT_CONFIG.start_time,
            total_posts_today: data.total_posts_today ?? 0,
            cron_requests_count: data.cron_requests_count ?? 0,
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            }
        });
    } catch (error) {
        console.error("Failed to fetch RSS config:", error);
        return NextResponse.json(DEFAULT_CONFIG, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { update_interval_minutes, start_time } = await req.json();

        // Validate update_interval_minutes
        if (typeof update_interval_minutes !== 'number' || update_interval_minutes < 1 || update_interval_minutes > 1440) {
            return NextResponse.json(
                { error: "Invalid update_interval_minutes. Must be between 1 and 1440 (24 hours)." },
                { status: 400 }
            );
        }

        // Validate start_time format (HH:MM)
        if (start_time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(start_time)) {
            return NextResponse.json(
                { error: "Invalid start_time format. Must be HH:MM (e.g., 06:00)." },
                { status: 400 }
            );
        }

        // Update in Firestore
        await dbAdmin.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).set({
            update_interval_minutes,
            start_time: start_time ?? DEFAULT_CONFIG.start_time,
            updated_at: new Date().toISOString()
        }, { merge: true });

        return NextResponse.json({
            success: true,
            update_interval_minutes,
            start_time: start_time ?? DEFAULT_CONFIG.start_time,
            message: "RSS update interval updated successfully"
        });
    } catch (error) {
        console.error("Failed to update RSS config:", error);
        return NextResponse.json(
            { error: "Failed to update RSS config" },
            { status: 500 }
        );
    }
}
