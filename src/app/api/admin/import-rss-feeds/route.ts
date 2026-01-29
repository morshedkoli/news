import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebase-admin";

// Top 10 RSS Feeds
const RSS_FEEDS = [
    {
        name: "Prothom Alo",
        url: "https://www.prothomalo.com/feed/",
        category: "সাধারণ",
        priority: 20,
        enabled: true,
    },
    {
        name: "The Daily Star",
        url: "https://www.thedailystar.net/feed",
        category: "সাধারণ",
        priority: 19,
        enabled: true,
    },
    {
        name: "Bdnews24 Bangla",
        url: "https://bangla.bdnews24.com/rss.xml",
        category: "সাধারণ",
        priority: 18,
        enabled: true,
    },
    {
        name: "Dhaka Tribune",
        url: "https://www.dhakatribune.com/feed",
        category: "সাধারণ",
        priority: 17,
        enabled: true,
    },
    {
        name: "Kaler Kantho",
        url: "https://www.kalerkantho.com/rss.xml",
        category: "সাধারণ",
        priority: 16,
        enabled: true,
    },
    {
        name: "Jugantor",
        url: "https://www.jugantor.com/feed/rss.xml",
        category: "সাধারণ",
        priority: 15,
        enabled: true,
    },
    {
        name: "Samakal",
        url: "https://samakal.com/feed/",
        category: "সাধারণ",
        priority: 14,
        enabled: true,
    },
    {
        name: "New Age Bangladesh",
        url: "https://www.newagebd.net/rss/rss.xml",
        category: "সাধারণ",
        priority: 13,
        enabled: true,
    },
    {
        name: "Financial Express BD",
        url: "https://thefinancialexpress.com.bd/feed",
        category: "অর্থনীতি",
        priority: 12,
        enabled: true,
    },
    {
        name: "UNB News",
        url: "https://unb.com.bd/feed",
        category: "সাধারণ",
        priority: 11,
        enabled: true,
    }
];

export async function POST(req: NextRequest) {
    try {
        console.log("📥 Starting bulk import of RSS feeds...");

        const results = {
            success: [] as string[],
            errors: [] as { name: string; error: string }[],
            skipped: [] as string[]
        };

        // Check if feeds already exist
        const existingFeeds = await dbAdmin.collection("rss_feeds").get();
        const existingUrls = new Set(existingFeeds.docs.map(doc => doc.data().url));

        for (const feed of RSS_FEEDS) {
            try {
                // Skip if already exists
                if (existingUrls.has(feed.url)) {
                    console.log(`⏭️ Skipped (already exists): ${feed.name}`);
                    results.skipped.push(feed.name);
                    continue;
                }

                const feedData = {
                    ...feed,
                    last_checked_at: null,
                    last_success_at: null,
                    cooldown_until: null,
                    failure_count: 0,
                    error_log: ""
                };

                await dbAdmin.collection("rss_feeds").add(feedData);
                console.log(`✅ Added: ${feed.name}`);
                results.success.push(feed.name);
            } catch (error: any) {
                console.error(`❌ Failed to add ${feed.name}:`, error.message);
                results.errors.push({
                    name: feed.name,
                    error: error.message
                });
            }
        }

        console.log("\n📊 Import Summary:");
        console.log(`   ✅ Success: ${results.success.length}`);
        console.log(`   ⏭️ Skipped: ${results.skipped.length}`);
        console.log(`   ❌ Errors: ${results.errors.length}`);

        return NextResponse.json({
            status: "completed",
            summary: {
                total: RSS_FEEDS.length,
                success: results.success.length,
                skipped: results.skipped.length,
                errors: results.errors.length
            },
            details: results
        });

    } catch (error: any) {
        console.error("💥 Bulk import failed:", error);
        return NextResponse.json({
            status: "failed",
            error: error.message
        }, { status: 500 });
    }
}

// GET endpoint to view feeds that will be imported
export async function GET(req: NextRequest) {
    return NextResponse.json({
        message: "RSS Feeds Bulk Import Endpoint",
        feeds_to_import: RSS_FEEDS.length,
        feeds: RSS_FEEDS.map(f => ({
            name: f.name,
            url: f.url,
            category: f.category,
            priority: f.priority
        })),
        instructions: {
            import: "Send POST request to this endpoint to import all feeds",
            curl: "curl -X POST http://localhost:3000/api/admin/import-rss-feeds"
        }
    });
}
