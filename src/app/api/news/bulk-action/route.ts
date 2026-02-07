import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { CategoryService } from "@/lib/categories";

/**
 * POST /api/news/bulk-action
 * Performs bulk operations on news items: delete, publish, unpublish
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
        const decoded = await authAdmin.verifyIdToken(token);

        // Parse Body
        const body = await req.json();
        const { ids, action } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Invalid or empty IDs array' }, { status: 400 });
        }
        if (!['delete', 'publish', 'unpublish'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const batch = dbAdmin.batch();
        const collectionRef = dbAdmin.collection('news');
        let successCount = 0;

        // Verify admin
        const adminRef = dbAdmin.collection("admins").doc(decoded.email || "_");
        const adminSnap = await adminRef.get();
        if (!adminSnap.exists) {
            return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
        }

        const hasEnglishLetters = (value: unknown) => typeof value === 'string' && /[A-Za-z]/.test(value);

        if (action === 'publish') {
            const docs = await Promise.all(ids.map((id) => collectionRef.doc(id).get()));
            const invalidIds: string[] = [];
            const invalidCategoryIds: string[] = [];

            for (const docSnap of docs) {
                if (!docSnap.exists) continue;
                const data = docSnap.data();
                const isImageMissing = !data?.image || (typeof data.image === 'string' && data.image.trim().length === 0);
                const englishDetected = hasEnglishLetters(data?.title)
                    || hasEnglishLetters(data?.summary)
                    || hasEnglishLetters(data?.content)
                    || hasEnglishLetters(data?.excerpt);

                if (isImageMissing || englishDetected) {
                    invalidIds.push(docSnap.id);
                    if (data?.categoryId) invalidCategoryIds.push(data.categoryId);
                    batch.delete(docSnap.ref);
                    continue;
                }

                batch.update(docSnap.ref, {
                    published_at: FieldValue.serverTimestamp(),
                    status: 'published',
                    updated_at: FieldValue.serverTimestamp()
                });
                successCount++;
            }

            await batch.commit();

            for (const categoryId of invalidCategoryIds) {
                try {
                    await CategoryService.decrementCategoryCount(categoryId);
                } catch (error: unknown) {
                    console.error(`Failed to decrement category ${categoryId}:`, error);
                }
            }

            return NextResponse.json({
                success: true,
                count: successCount,
                deletedInvalid: invalidIds.length,
                message: `Successfully processed ${successCount} items`
            });
        }

        // Process items for delete/unpublish
        for (const id of ids) {
            const docRef = collectionRef.doc(id);

            if (action === 'delete') {
                batch.delete(docRef);
            } else if (action === 'unpublish') {
                batch.update(docRef, {
                    published_at: null,
                    status: 'draft',
                    updated_at: FieldValue.serverTimestamp()
                });
            }
            successCount++;
        }

        // Commit batch
        await batch.commit();

        return NextResponse.json({
            success: true,
            count: successCount,
            message: `Successfully processed ${successCount} items`
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Bulk action failed:", error);
        return NextResponse.json(
            { error: message || "Bulk action failed" },
            { status: 500 }
        );
    }
}
