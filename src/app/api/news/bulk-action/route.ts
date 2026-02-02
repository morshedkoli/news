import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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

        // Process items
        for (const id of ids) {
            const docRef = collectionRef.doc(id);

            if (action === 'delete') {
                batch.delete(docRef);
            } else if (action === 'publish') {
                batch.update(docRef, {
                    published_at: FieldValue.serverTimestamp(),
                    status: 'published',
                    updated_at: FieldValue.serverTimestamp()
                });
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

    } catch (error: any) {
        console.error("Bulk action failed:", error);
        return NextResponse.json(
            { error: error.message || "Bulk action failed" },
            { status: 500 }
        );
    }
}
