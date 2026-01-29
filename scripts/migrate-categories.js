const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
// Assuming service account is in env or default credentials
// For local script, we might need to load service account key or use default if authorized via gcloud
// Try to load .env.local to get GOOGLE_APPLICATION_CREDENTIALS or similar if needed.

// However, typically in this project (based on scripts/import-rss-feeds.js which I saw in list_dir),
// it might just use default credentials. Let's try standard init.

// Load Environment Variables from .env.local (Manual parsing since dotenv might not be loaded if run via node directly without require)
// Actually we can use dotenv from dependencies
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

function getSlug(name) {
    return name.toLowerCase().trim().replace(/\s+/g, '-');
}

async function migrate() {
    console.log("🚀 Starting Category Migration...");

    // Step 1: Scan all news
    console.log("Scanning news collection...");
    const newsSnap = await db.collection("news").get();
    console.log(`Found ${newsSnap.size} news documents.`);

    const categoryGroups = {}; // key: slug, value: { name, count, docIds: [] }

    newsSnap.forEach(doc => {
        const data = doc.data();
        // Skip if already has categoryId AND categorySlug (Already migrated?)
        if (data.categoryId && data.categorySlug) return;

        // Legacy fields
        const catName = data.category || "General";
        // Attempt to find display name if separate, or use catName
        const displayName = data.category_name || catName;

        const slug = getSlug(catName);

        if (!categoryGroups[slug]) {
            categoryGroups[slug] = {
                name: displayName,
                count: 0,
                docIds: []
            };
        }

        categoryGroups[slug].count++;
        categoryGroups[slug].docIds.push(doc.id);
    });

    const uniqueSlugs = Object.keys(categoryGroups);
    console.log(`Found ${uniqueSlugs.length} unique categories to migrate.`);

    // Step 2 & 3: Create Categories & Update News
    const batchSize = 500;
    let batch = db.batch();
    let opCount = 0;

    for (const slug of uniqueSlugs) {
        const group = categoryGroups[slug];
        console.log(`Processing category: ${group.name} (${slug}) - ${group.count} items`);

        // Check if category exists by slug (Robustness)
        let categoryId;
        const catQuery = await db.collection("categories").where("slug", "==", slug).limit(1).get();

        if (!catQuery.empty) {
            const catDoc = catQuery.docs[0];
            categoryId = catDoc.id;
            console.log(`  -> Found existing category ID: ${categoryId}`);

            // Should we update postCount?
            // "postCount: number of active posts"
            // We should probably explicitly set it to match the scan if we are migrating?
            // Or increment? Migration assumes "Ground Truth" is the news collection.
            // Let's UPDATE the postCount to the actual count + existing? 
            // Better: Set it to the actual count found in this scan if this script is the authority.
            // BUT: There might be migrated docs already counted.
            // Let's assume we are fixing "unmigrated" ones.
            // If checking "if (data.categoryId) return", we only count unmigrated.
            // So we should INCREMENT.

            batch.update(catDoc.ref, {
                postCount: admin.firestore.FieldValue.increment(group.count)
            });
            opCount++;
        } else {
            // Create new
            const newCatRef = db.collection("categories").doc();
            categoryId = newCatRef.id;
            console.log(`  -> Creating NEW category ID: ${categoryId}`);

            batch.set(newCatRef, {
                name: group.name,
                slug: slug,
                postCount: group.count,
                enabled: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            opCount++;
        }

        if (opCount >= batchSize) { await batch.commit(); batch = db.batch(); opCount = 0; }

        // Update News Docs
        for (const newsId of group.docIds) {
            const newsRef = db.collection("news").doc(newsId);
            batch.update(newsRef, {
                categoryId: categoryId,
                categorySlug: slug
            });
            opCount++;

            if (opCount >= batchSize) { await batch.commit(); batch = db.batch(); opCount = 0; }
        }
    }

    if (opCount > 0) {
        await batch.commit();
    }

    console.log("✅ Migration Complete.");
}

migrate().catch(console.error);
