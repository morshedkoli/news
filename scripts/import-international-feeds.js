
/**
 * Bulk Import International RSS Feeds
 * Usage: npx tsx scripts/import-international-feeds.js
 */
const admin = require('firebase-admin');

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n").replace(/"/g, "")
        : undefined;

    if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
        console.error("❌ Missing specific credentials in .env.local");
        process.exit(1);
    }

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        })
    });
}

const db = admin.firestore();

const INTERNATIONAL_FEEDS = [
    {
        name: "BBC World News",
        url: "http://feeds.bbci.co.uk/news/world/rss.xml",
        category: "আন্তর্জাতিক",
        priority: 15,
        enabled: true,
    },
    {
        name: "Al Jazeera English",
        url: "https://www.aljazeera.com/xml/rss/all.xml",
        category: "আন্তর্জাতিক",
        priority: 15,
        enabled: true,
    },
    {
        name: "CNN Top Stories",
        url: "http://rss.cnn.com/rss/edition.rss",
        category: "আন্তর্জাতিক",
        priority: 14,
        enabled: true,
    },
    {
        name: "Reuters World",
        url: "https://www.reutersagency.com/feed/?best-topics=world-at-work&post_type=best",
        category: "আন্তর্জাতিক",
        priority: 14,
        enabled: true,
    },
    {
        name: "The Guardian World",
        url: "https://www.theguardian.com/world/rss",
        category: "আন্তর্জাতিক",
        priority: 13,
        enabled: true,
    },
    {
        name: "New York Times World",
        url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        category: "আন্তর্জাতিক",
        priority: 13,
        enabled: true,
    }
];

async function importInternationalFeeds() {
    console.log('🌍 Starting import of International RSS feeds...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const feed of INTERNATIONAL_FEEDS) {
        try {
            // Check for duplicates based on URL
            const snapshot = await db.collection('rss_feeds').where('url', '==', feed.url).get();
            if (!snapshot.empty) {
                console.log(`⚠️ Skipped (Exists): ${feed.name}`);
                continue;
            }

            const feedData = {
                ...feed,
                last_checked_at: null,
                last_success_at: null,
                cooldown_until: null,
                failure_count: 0,
                error_log: "",
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('rss_feeds').add(feedData);
            console.log(`✅ Added: ${feed.name}`);
            successCount++;
        } catch (error) {
            console.error(`❌ Failed to add ${feed.name}:`, error.message);
            errorCount++;
        }
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Added: ${successCount}`);
    console.log(`   ⚠️ Skipped: ${INTERNATIONAL_FEEDS.length - successCount - errorCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
}

importInternationalFeeds().catch(console.error);
