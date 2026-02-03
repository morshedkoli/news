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

async function fixDraftLeaks() {
    console.log("🔧 Fixing Draft Leaks...");

    // Find items that are STATUS=published but PUBLISHED_AT=null
    // These are the "Leaking drafts"

    const snapshot = await db.collection('news')
        .where('status', '==', 'published')
        .get();

    let fixedCount = 0;

    const batch = db.batch(); // Assuming < 500 for now, if more we need loop
    let ops = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.published_at) {
            console.log(`Fixing ${doc.id}: Status is 'published' but published_at is null -> Setting status to 'draft'`);
            batch.update(doc.ref, { status: 'draft' });
            fixedCount++;
            ops++;
        }
    });

    if (ops > 0) {
        await batch.commit();
    }

    console.log(`✅ Fixed ${fixedCount} leaking drafts.`);
}

fixDraftLeaks().catch(console.error);
