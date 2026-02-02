import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/news/update-category
 * Atomically updates a news article's category and adjusts post counts.
 * Requires admin authentication.
 */
export async function POST(req: NextRequest) {
    try {
        // Auth Check
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        await authAdmin.verifyIdToken(token);

        // Parse Body
        const body = await req.json();
        const { articleId, newCategorySlug } = body;

        if (!articleId || !newCategorySlug) {
            return NextResponse.json({ error: 'Missing articleId or newCategorySlug' }, { status: 400 });
        }

        // Run Transaction
        await dbAdmin.runTransaction(async (t) => {
            // 1. Get Article
            const articleRef = dbAdmin.collection('news').doc(articleId);
            const articleDoc = await t.get(articleRef);
            if (!articleDoc.exists) throw new Error("Article not found");
            const article = articleDoc.data();

            const oldCategoryId = article?.categoryId;
            const oldCategorySlug = article?.categorySlug;

            // If no change, exit early
            if (oldCategorySlug === newCategorySlug) return;

            // 2. Get New Category
            const categoriesRef = dbAdmin.collection('categories');
            const newCatQuery = categoriesRef.where('slug', '==', newCategorySlug).limit(1);
            const newCatSnap = await t.get(newCatQuery);
            if (newCatSnap.empty) throw new Error("New category not found");
            const newCatDoc = newCatSnap.docs[0];

            // 3. Update Counts
            // Decrement old if it exists
            if (oldCategoryId) {
                const oldCatRef = categoriesRef.doc(oldCategoryId);
                t.update(oldCatRef, {
                    postCount: FieldValue.increment(-1)
                });
            }

            // Increment new
            t.update(newCatDoc.ref, {
                postCount: FieldValue.increment(1)
            });

            // 4. Update Article
            t.update(articleRef, {
                categoryId: newCatDoc.id,
                categorySlug: newCatDoc.data().slug,
                category: newCatDoc.data().name, // Legacy support
                category_name: newCatDoc.data().name, // Legacy support
                updated_at: FieldValue.serverTimestamp()
            });
        });

        return NextResponse.json({
            success: true,
            message: "Category updated successfully"
        });

    } catch (error: any) {
        console.error("Category update failed:", error);
        return NextResponse.json(
            { error: error.message || "Update failed" },
            { status: 500 }
        );
    }
}
