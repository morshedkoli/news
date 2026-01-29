import { NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebase-admin";
import { CategoryService } from "@/lib/categories";
import { FieldValue } from "firebase-admin/firestore";

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
        const { id, published } = await req.json();
        if (!id || typeof published !== 'boolean') {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 3. Transaction
        await dbAdmin.runTransaction(async (t) => {
            const newsRef = dbAdmin.collection("news").doc(id);
            const newsDoc = await t.get(newsRef);

            if (!newsDoc.exists) throw new Error("News not found");

            const data = newsDoc.data();
            const category = data?.category;

            // Logic:
            // If publishing: set published_at = now, Increment count
            // If unpublishing: set published_at = null, Decrement count

            // Note: need to check if it was ALREADY published or not to avoid double counting?
            // The frontend sends the DESIRED state (published: true/false).
            // We should check current state.

            const currentPublished = !!data?.published_at;

            if (published === currentPublished) {
                return; // No change needed
            }

            if (published) {
                // Publishing
                t.update(newsRef, { published_at: FieldValue.serverTimestamp() });
                if (category) {
                    await CategoryService.incrementCategoryCount(category, t);
                }
            } else {
                // Unpublishing
                t.update(newsRef, { published_at: null });
                if (category) {
                    await CategoryService.decrementCategoryCount(category, t);
                }
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Update Status Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
