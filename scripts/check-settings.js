const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (!process.env.FIREBASE_PRIVATE_KEY) {
    console.error('❌ Error: Missing FIREBASE_PRIVATE_KEY in .env.local');
    process.exit(1);
}

// Initialize
if (!admin.apps.length) {
    try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            }),
        });
    } catch (error) {
        console.error('❌ Error initializing Firebase Admin:', error);
        process.exit(1);
    }
}

const db = admin.firestore();

async function checkSettings() {
    console.log('🔍 Checking RSS Settings...');
    const settings = await db.collection("system_stats").doc("rss_settings").get();
    console.log('Settings:', JSON.stringify(settings.data(), null, 2));

    console.log('\n🔍 Checking RSS Sources (rss_feeds)...');
    const feeds = await db.collection("rss_feeds").get();
    feeds.docs.forEach(doc => {
        const d = doc.data();
        console.log(`- [${doc.id}] ${d.name || d.source_name}: Enabled=${d.enabled}, URL=${d.url}`);
    });
}

checkSettings();
