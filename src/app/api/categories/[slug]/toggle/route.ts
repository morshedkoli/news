import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebase-admin";

/**
 * PATCH /api/categories/[slug]/toggle
 * Toggles the enabled status of a category.
 * Requires admin authentication.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        // Auth: Expect Bearer token (Firebase ID Token)
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decoded = await authAdmin.verifyIdToken(token);

        // Verify admin status
        const adminDoc = await dbAdmin.collection('admins').doc(decoded.email || '').get();
        if (!adminDoc.exists) {
            return NextResponse.json({ error: 'Not an admin' }, { status: 403 });
        }

        const { slug } = await params;
        if (!slug) {
            return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
        }

        // Find category by slug
        const categoriesRef = dbAdmin.collection('categories');
        const snapshot = await categoriesRef.where('slug', '==', slug).limit(1).get();

        if (snapshot.empty) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        const categoryDoc = snapshot.docs[0];
        const currentEnabled = categoryDoc.data().enabled !== false; // default true

        // Toggle enabled status
        await categoryDoc.ref.update({
            enabled: !currentEnabled,
            updated_at: new Date().toISOString(),
            updated_by: decoded.email
        });

        console.log(`📁 Category ${slug} ${!currentEnabled ? 'enabled' : 'disabled'} by ${decoded.email}`);

        return NextResponse.json({
            success: true,
            slug,
            enabled: !currentEnabled,
            message: `Category ${!currentEnabled ? 'enabled' : 'disabled'}`
        });

    } catch (error: any) {
        console.error("Failed to toggle category:", error);
        return NextResponse.json(
            { error: error.message || "Failed to toggle category" },
            { status: 500 }
        );
    }
}
