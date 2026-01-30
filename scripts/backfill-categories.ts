
import 'dotenv/config';
import { dbAdmin } from '../src/lib/firebase-admin';
import { CategoryService } from '../src/lib/categories';

async function backfill() {
    console.log("🚀 Starting Backfill of Category IDs...");

    // 1. Scan News
    const newsRef = dbAdmin.collection('news');
    // We can't filter by missing field easily in all firestore versions/bindings without a composite index or manual scan.
    // Manual scan is safer for "once" script.
    const snapshot = await newsRef.get();

    console.log(`Found ${snapshot.size} news documents. Scanning for missing categoryId...`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // If already correct, skip
        if (data.categoryId && data.categorySlug) {
            skipped++;
            continue;
        }

        // Strategy: 
        // 1. Prefer existing slug if available
        // 2. Fallback to name (category)
        // 3. Fallback to "General"

        let targetName = data.category || "General";
        // If we have a slug but no ID, we might want to resolve by slug?
        // CategoryService.ensureCategory takes NAME.
        // It generates slug from name.
        // If we pass a name, it checks slug existence.
        // So passing the name is the right way.

        // Use legacy 'category_name' if 'category' is missing or looks like a slug?
        if (!data.category && data.category_name) {
            targetName = data.category_name;
        }

        try {
            // Resolve (Find or Create)
            const catData = await CategoryService.ensureCategory(targetName);

            // Update Doc
            await doc.ref.update({
                categoryId: catData.id,
                categorySlug: catData.slug,
                // Ensure legacy fields match for consistency during transition
                category: targetName,
                category_name: targetName
            });

            // Increment Count (Since we are "fixing" usage)
            // Note: If we run this multiple times, we check `if (data.categoryId)` so we won't double count.
            await CategoryService.incrementCategoryCount(catData.id);

            console.log(`✅ Updated doc ${doc.id}: mapped '${targetName}' -> ${catData.slug} (${catData.id})`);
            updated++;

        } catch (e) {
            console.error(`❌ Failed to update doc ${doc.id} (target: ${targetName}):`, e);
            errors++;
        }
    }

    console.log(`\n🎉 Backfill Complete.`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors:  ${errors}`);
}

backfill()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("Fatal Error:", e);
        process.exit(1);
    });
