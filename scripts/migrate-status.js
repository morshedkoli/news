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
        console.log("Initializing with Service Account:", serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(require(serviceAccountPath))
        });
    } else {
        console.log("Initializing with Default Credentials...");
        admin.initializeApp();
    }
}
const db = admin.firestore();

async function migrateStatus() {
    console.log('Starting Status Migration...');
    const newsRef = db.collection('news');

    // Process in batches
    const snapshot = await newsRef.get();
    if (snapshot.empty) {
        console.log('No news found.');
        return;
    }

    console.log(`Found ${snapshot.size} news documents.`);

    let batch = db.batch();
    let count = 0;
    let updated = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        let newStatus = data.status;

        // Rule 1: If blocked flag exists (legacy), convert to status='blocked'
        if (data.block_reasons && data.block_reasons.length > 0) {
            newStatus = 'blocked';
        }
        // Rule 2: If no status, default to 'published' (assuming legacy data was live)
        else if (!data.status) {
            newStatus = 'published';
        }

        // Safety: If it was 'blocked' but not marked via block_reasons, strict check?
        // Let's assume 'blocked' could already exist.

        // Log changes
        if (newStatus !== data.status) {
            // console.log(`Doc ${doc.id}: ${data.status} -> ${newStatus}`);
            batch.update(doc.ref, { status: newStatus });
            updated++;
        }

        count++;
        if (count % 500 === 0) {
            await batch.commit();
            batch = db.batch();
            console.log(`Processed ${count} docs...`);
        }
    }

    if (updated > 0) {
        await batch.commit();
    }

    console.log(`Migration Complete. Updated ${updated} documents.`);
}

migrateStatus().catch(console.error);
