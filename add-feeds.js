// Quick script to add RSS feeds directly to Firestore
// Run with: node add-feeds.js

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const feeds = [
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

async function addFeeds() {
    console.log('📥 Adding RSS feeds to Firestore...\n');

    let added = 0;
    let skipped = 0;

    for (const feed of feeds) {
        try {
            // Check if already exists
            const existing = await db.collection('rss_feeds')
                .where('url', '==', feed.url)
                .limit(1)
                .get();

            if (!existing.empty) {
                console.log(`⏭️  Skipped (exists): ${feed.name}`);
                skipped++;
                continue;
            }

            // Add feed
            await db.collection('rss_feeds').add({
                ...feed,
                last_checked_at: null,
                last_success_at: null,
                cooldown_until: null,
                failure_count: 0,
                error_log: ""
            });

            console.log(`✅ Added: ${feed.name}`);
            added++;
        } catch (error) {
            console.error(`❌ Error adding ${feed.name}:`, error.message);
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Added: ${added}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📝 Total: ${feeds.length}`);

    process.exit(0);
}

addFeeds().catch(console.error);
