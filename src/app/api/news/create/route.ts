import { NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebase-admin";
import { sendNotification } from "@/lib/notifications";
import { FieldValue } from "firebase-admin/firestore";
import { normalizeUrl, generateUrlHash, generateContentHash } from '@/lib/news-dedup';

export async function POST(req: Request) {
    try {
        // 1. Security: Verify Admin Token
        const authHeader = req.headers.get('authorization');

        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        let decodedToken;

        try {
            decodedToken = await authAdmin.verifyIdToken(token);
        } catch (authError) {
            console.error("Token verification failed:", authError);
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        // Check if user is actually an admin in Firestore
        // Note: This matches the logic from notifications/send/route.ts
        const adminDoc = await dbAdmin.collection('admins').doc(decodedToken.email || '').get();
        if (!adminDoc.exists) {
            console.warn(`Access denied for ${decodedToken.email}: Not in admins collection`);
            return NextResponse.json({ error: 'Forbidden: Not an admin' }, { status: 403 });
        }

        // 2. Validate Payload
        const body = await req.json();
        const { title, summary, image, source_url, source_name, created_by, category } = body;

        if (!title || !summary || !source_url) {
            return NextResponse.json({ error: "Missing required fields (title, summary, source_url)" }, { status: 400 });
        }

        // Generate Metadata
        const normalized_url = normalizeUrl(source_url);
        const normalized_url_hash = generateUrlHash(normalized_url);
        const content_hash = generateContentHash(summary);

        // 3. Save to Firestore (Admin SDK)
        console.log(`Creating news: ${title} by ${created_by}`);

        const docRef = await dbAdmin.collection("news").add({
            title,
            summary,
            image: image || "",
            source_url,
            normalized_url,         // Optional reference
            normalized_url_hash,    // MANDATORY for dedup
            content_hash,           // Useful for content dedup
            source_name: source_name || "Unknown",
            created_by: created_by || decodedToken.email,
            category: category || "general",
            likes: 0,
            published_at: FieldValue.serverTimestamp(),
            created_at: FieldValue.serverTimestamp(),
            is_rss: false
        });

        // Update Category Stats
        // We do this asynchronously/independently or await it. 
        // Since we are not in a transaction here (add is simple), we can just await it.
        if (category) {
            const { CategoryService } = await import('@/lib/categories');
            await CategoryService.incrementCategoryCount(category);
        }

        console.log(`News created with ID: ${docRef.id}`);

        // 4. Trigger Push Notification (Server-Side)
        let notificationSent = false;
        try {
            console.log(`Attempting to send notification for ${docRef.id}...`);
            const notificationResult = await sendNotification(title, summary, docRef.id);
            notificationSent = !!notificationResult;

            if (notificationSent) {
                console.log("✅ FCM Notification sent successfully.");
            } else {
                console.warn("⚠️ FCM Notification failed (returned null).");
            }
        } catch (notifyErr) {
            console.error("❌ Unexpected error sending notification:", notifyErr);
            notificationSent = false;
        }

        // 5. Return Success with Notification Status
        return NextResponse.json({
            success: true,
            id: docRef.id,
            notificationSent: notificationSent,
            message: notificationSent
                ? "Published and Notified"
                : "Published but Notification Failed"
        });

    } catch (error: any) {
        console.error("Create News API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
