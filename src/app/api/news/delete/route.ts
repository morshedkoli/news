import { NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebase-admin";
import { CategoryService } from "@/lib/categories";

export async function POST(req: Request) {
    try {
        // 1. Auth Check
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        await authAdmin.verifyIdToken(token);

        // 2. Parse Body
        const { id } = await req.json();
        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        // 3. Get News Doc to find category
        // We need a transaction to delete and update category atomically if possible
        // But since CategoryService uses its own transaction internally, and we can't easily span a transaction across unknown reads + Service calls without refactoring Service to accept Transaction object (which we did!), let's do robust approach.

        // However, we first need to read the news doc to know its category.
        // We will perform the read first, then run a transaction for deletion + decrement.

        await dbAdmin.runTransaction(async (t) => {
            const newsRef = dbAdmin.collection("news").doc(id);
            const newsDoc = await t.get(newsRef);

            if (!newsDoc.exists) {
                return; // Already deleted?
            }

            const data = newsDoc.data();
            const categoryId = data?.categoryId;
            // Legacy fallback: if no ID but has category name/slug?
            // Since we promised ID-based routing, let's prioritize ID.
            // If legacy data, we might not have ID.

            // Delete News
            t.delete(newsRef);

            // Decrement Category
            if (categoryId) {
                await CategoryService.decrementCategoryCount(categoryId, t);
            } else if (data?.category) {
                // Try to resolve legacy?
                // CAUTION: 'ensureCategory' creates it if missing, which is wrong for delete.
                // 'decrementCategoryCount' in our new Service expects ID.
                // We could fetch by slug, but let's stick to ID for now as requested.
                // or maybe logging missing ID.
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Delete News Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
