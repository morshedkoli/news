/**
 * Bulk Import RSS Feeds Script
 * 
 * This script adds the top 10 Bangladeshi news RSS feeds to Firestore.
 * Run this in the browser console on the Firebase Console or in a Node.js script.
 */

// Top 10 RSS Feeds (5 Bangla + 5 English)
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

/**
 * Browser Console Version (Firebase Console)
 * 
 * 1. Go to Firebase Console → Firestore Database
 * 2. Open browser console (F12)
 * 3. Paste this entire script
 * 4. Run: await bulkImportFeeds()
 */
async function bulkImportFeeds() {
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase not loaded. Make sure you are on Firebase Console.');
        return;
    }

    const db = firebase.firestore();
    let successCount = 0;
    let errorCount = 0;

    console.log('📥 Starting bulk import of RSS feeds...\n');

    for (const feed of RSS_FEEDS) {
        try {
            const feedData = {
                ...feed,
                last_checked_at: null,
                last_success_at: null,
                cooldown_until: null,
                failure_count: 0,
                error_log: ""
            };

            await db.collection('rss_feeds').add(feedData);
            console.log(`✅ Added: ${feed.name}`);
            successCount++;
        } catch (error) {
            console.error(`❌ Failed to add ${feed.name}:`, error);
            errorCount++;
        }
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total: ${RSS_FEEDS.length}`);
}

/**
 * Node.js Version (Firebase Admin SDK)
 * 
 * Run: node import-rss-feeds.js
 */
async function bulkImportFeedsNode() {
    const admin = require('firebase-admin');

    // Initialize Firebase Admin (make sure you have service account key)
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
    }

    const db = admin.firestore();
    let successCount = 0;
    let errorCount = 0;

    console.log('📥 Starting bulk import of RSS feeds...\n');

    for (const feed of RSS_FEEDS) {
        try {
            const feedData = {
                ...feed,
                last_checked_at: null,
                last_success_at: null,
                cooldown_until: null,
                failure_count: 0,
                error_log: ""
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
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total: ${RSS_FEEDS.length}`);
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bulkImportFeedsNode, RSS_FEEDS };
}

// Instructions
console.log(`
📋 RSS Feeds Bulk Import Script

🌐 Browser Console (Firebase Console):
   1. Go to Firebase Console → Firestore
   2. Open browser console (F12)
   3. Paste this script
   4. Run: await bulkImportFeeds()

💻 Node.js (Firebase Admin SDK):
   1. Save this file as import-rss-feeds.js
   2. Run: node import-rss-feeds.js

📝 Feeds to be imported: ${RSS_FEEDS.length}
   - ${RSS_FEEDS.filter(f => f.priority >= 15).length} Bangla sources
   - ${RSS_FEEDS.filter(f => f.priority < 15).length} English sources (will be auto-translated)
`);
