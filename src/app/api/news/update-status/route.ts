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

        const newsRef = dbAdmin.collection("news").doc(id);
        const newsSnapshot = await newsRef.get();
        if (!newsSnapshot.exists) throw new Error("News not found");

        const snapshotData = newsSnapshot.data();
        const hasEnglishLetters = (value: unknown) => typeof value === 'string' && /[A-Za-z]/.test(value);
        const isImageMissing = !snapshotData?.image || (typeof snapshotData.image === 'string' && snapshotData.image.trim().length === 0);
        const englishDetected = hasEnglishLetters(snapshotData?.title)
            || hasEnglishLetters(snapshotData?.summary)
            || hasEnglishLetters(snapshotData?.content)
            || hasEnglishLetters(snapshotData?.excerpt);

        if (published && (englishDetected || isImageMissing)) {
            const reasons = [
                englishDetected ? 'ENGLISH_DETECTED' : null,
                isImageMissing ? 'IMAGE_MISSING' : null
            ].filter(Boolean);

            await dbAdmin.runTransaction(async (t) => {
                const docSnap = await t.get(newsRef);
                if (!docSnap.exists) return;
                const data = docSnap.data();
                const categoryId = data?.categoryId;
                if (categoryId) {
                    await CategoryService.decrementCategoryCount(categoryId, t);
                }
                t.delete(newsRef);
            });

            return NextResponse.json({
                success: false,
                deleted: true,
                reasons
            }, { status: 422 });
        }

        // 3. Transaction
        await dbAdmin.runTransaction(async (t) => {
            const newsDoc = await t.get(newsRef);

            if (!newsDoc.exists) throw new Error("News not found");

            const data = newsDoc.data();
            // Logic:
            // If publishing: set published_at = now, Increment count
            // If unpublishing: set published_at = null, Decrement count

            // Note: need to check if it was ALREADY published or not to avoid double counting?
            // The frontend sends the DESIRED state (published: true/false).
            // We should check current state.

            const categoryId = data?.categoryId;

            const currentPublished = !!data?.published_at;

            if (published === currentPublished) {
                return; // No change needed
            }

            if (published) {
                // Publishing
                t.update(newsRef, {
                    published_at: FieldValue.serverTimestamp(),
                    status: 'published'
                });
                if (categoryId) {
                    await CategoryService.incrementCategoryCount(categoryId, t);
                }
            } else {
                // Unpublishing
                t.update(newsRef, {
                    published_at: null,
                    status: 'draft'
                });
                if (categoryId) {
                    await CategoryService.decrementCategoryCount(categoryId, t);
                }
            }
        });

        // Auto-post to Facebook if publishing
        if (published) {
            try {
                // Fetch news data for Facebook posting
                const newsSnapshot = await dbAdmin.collection('news').doc(id).get();
                const newsData = newsSnapshot.data();

                const { FacebookService } = await import('@/lib/facebook-service');
                await FacebookService.postNewsToPages(
                    id,
                    newsData?.title || 'Untitled',
                    newsData?.summary || '',
                    newsData?.image,
                    newsData?.source_url
                );
            } catch (error: unknown) {
                // Log but don't fail the publish operation
                console.error('Facebook auto-post failed:', error);
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Update Status Error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
