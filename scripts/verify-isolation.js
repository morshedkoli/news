const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
require('dotenv').config({ path: '.env.local' });

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : null;

if (!admin.apps.length) {
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
        admin.initializeApp({
            credential: admin.credential.cert(require(serviceAccountPath))
        });
    } else {
        admin.initializeApp();
    }
}
const db = admin.firestore();

async function verify() {
    console.log("🔍 Verifying Data Consistency...");

    // 1. Check for Blocked items visible as Published
    const leakQuery = await db.collection('news')
        .where('status', '==', 'published')
        .where('block_reasons', '!=', null) // If block_reasons exists and is not empty? Firestore logic is tricky here.
        .get();

    let leaks = 0;
    leakQuery.forEach(doc => {
        const data = doc.data();
        if (data.block_reasons && data.block_reasons.length > 0) {
            console.error(`❌ LEAK FOUND: ${doc.id} is published but has block reasons!`);
            leaks++;
        }
    });

    if (leaks === 0) {
        console.log("✅ No blocked items are leaking as published.");
    } else {
        console.error(`❌ FOUND ${leaks} LEAKING ITEMS!`);
    }

    // 3. Verify Blocked Items are isolated
    const blockedQuery = await db.collection('news').where('status', '==', 'blocked').get();
    console.log(`ℹ️  Found ${blockedQuery.size} blocked items correctly marked.`);

    blockedQuery.docs.forEach(doc => {
        const data = doc.data();
        if (data.published_at != null) {
            console.warn(`⚠️  Warning: Blocked item ${doc.id} still has published_at date.`);
        }
    });
}

verify().catch(console.error);
