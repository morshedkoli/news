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
            const category = data?.category;

            // Delete News
            t.delete(newsRef);

            // Decrement Category
            if (category) {
                // We use the Service's logic but pass our transaction
                await CategoryService.decrementCategoryCount(category, t);
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Delete News Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
