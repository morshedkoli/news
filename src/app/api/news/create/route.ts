import { NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebase-admin";
import { sendNotification } from "@/lib/notifications";
import { FieldValue } from "firebase-admin/firestore";
import { normalizeUrl, generateUrlHash, generateContentHash } from '@/lib/news-dedup';
import { validateNewsContent } from '@/lib/news/validation';
import { normalizeCategory } from '@/lib/news-fetcher';
import type { ArticleCandidate } from '@/lib/news/sources/news-source';

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
        const adminDoc = await dbAdmin.collection('admins').doc(decodedToken.email || '').get();
        if (!adminDoc.exists) {
            console.warn(`Access denied for ${decodedToken.email}: Not in admins collection`);
            return NextResponse.json({ error: 'Forbidden: Not an admin' }, { status: 403 });
        }

        // 2. Validate Payload
        const body = await req.json();
        const { title, summary, image, source_url, source_name, created_by, category, content, excerpt } = body;

        if (!title || !summary || !source_url) {
            return NextResponse.json({ error: "Missing required fields (title, summary, source_url)" }, { status: 400 });
        }

        // Validate language and summary content
        const validationCandidate: ArticleCandidate = {
            title,
            summary,
            content,
            excerpt,
            sourceUrl: source_url,
            cleanUrl: normalizeUrl(source_url),
            sourceName: source_name || "Unknown",
        };
        const validation = validateNewsContent(validationCandidate);
        if (!validation.isValid) {
            return NextResponse.json({ error: 'Validation failed', reasons: validation.blockReasons }, { status: 400 });
        }

        // Require a feature image for published posts
        if (!image || (typeof image === 'string' && image.trim().length === 0)) {
            return NextResponse.json({ error: 'Missing required field: image' }, { status: 400 });
        }

        // Normalize Category (Bangla only)
        let resolvedCategory = normalizeCategory(category || null) || null;
        if (!resolvedCategory && category) {
            try {
                const { generateContentWithFallback } = await import('@/lib/ai-engine');
                const translated = await generateContentWithFallback(
                    `Translate this category to Bengali (Bangla). Return only the category name.
Category: ${category}`,
                    { feature: 'news_category_translation' },
                    2
                );
                const translatedCategory = translated?.content?.trim() || "";
                resolvedCategory = normalizeCategory(translatedCategory) || (/[ঀ-৿]/.test(translatedCategory) ? translatedCategory : null);
            } catch (e) {
                console.error("Category translation failed:", e);
            }
        }
        resolvedCategory = resolvedCategory || "সাধারণ";

        // Generate Metadata
        const normalized_url = normalizeUrl(source_url);
        const normalized_url_hash = generateUrlHash(normalized_url);
        const content_hash = generateContentHash(summary);

        // 3. Prepare Data
        console.log(`Creating news: ${title} by ${created_by}`);

        const newsData: Record<string, unknown> = {
            title,
            summary,
            image: image || "",
            source_url,
            normalized_url,         // Optional reference
            normalized_url_hash,    // MANDATORY for dedup
            content_hash,           // Useful for content dedup
            source_name: source_name || "Unknown",
            created_by: created_by || decodedToken.email,
            category: resolvedCategory,
            likes: 0,
            is_rss: false
        };

        // Resolve Category (ensureCategory may create if missing)
        let catData: { id: string; slug: string; name: string } | null = null;
        if (resolvedCategory) {
            try {
                const { CategoryService } = await import('@/lib/categories');
                catData = await CategoryService.ensureCategory(resolvedCategory);
                newsData.categoryId = catData.id;
                newsData.categorySlug = catData.slug;
            } catch (err) {
                console.warn("Category resolution failed:", err);
            }
        }

        // 4. Save to Firestore atomically with cooldown check
        const statsRef = dbAdmin.collection('system_stats').doc('rss_settings');
        const newsRef = dbAdmin.collection('news').doc();

        try {
            await dbAdmin.runTransaction(async (t) => {
                const statsSnap = await t.get(statsRef);
                const statsData = statsSnap.exists ? (statsSnap.data() as Record<string, unknown>) : {};
                const intervalMinutes = typeof statsData.update_interval_minutes === 'number' ? statsData.update_interval_minutes : 40;
                const lastPostedRaw = statsData.last_news_posted_at as { toDate?: () => Date } | undefined;
                const lastPosted = lastPostedRaw?.toDate ? lastPostedRaw.toDate().getTime() : 0;

                if (Date.now() - lastPosted < intervalMinutes * 60 * 1000) {
                    throw new Error('cooldown_active');
                }

                // Set server timestamps inside transaction
                newsData.published_at = FieldValue.serverTimestamp();
                newsData.created_at = FieldValue.serverTimestamp();

                t.set(newsRef, newsData);

                // Update stats
                t.set(statsRef, {
                    last_news_posted_at: FieldValue.serverTimestamp(),
                    last_run_at: FieldValue.serverTimestamp(),
                    total_posts_today: FieldValue.increment(1),
                    consecutive_failed_runs: 0
                }, { merge: true });

                // Increment Category Count inside transaction if we have a category
                if (catData && catData.id) {
                    const { CategoryService } = await import('@/lib/categories');
                    await CategoryService.incrementCategoryCount(catData.id, t);
                }
            });
        } catch (txErr: unknown) {
            const message = txErr instanceof Error ? txErr.message : "Unknown error";
            if (message === 'cooldown_active') {
                return NextResponse.json({ error: 'Cooldown active. Try later.' }, { status: 429 });
            }
            console.error('Transaction failed creating news:', txErr);
            return NextResponse.json({ error: 'Failed to create news' }, { status: 500 });
        }

        console.log(`News created with ID: ${newsRef.id}`);

        // 5. Trigger Push Notification (Server-Side)
        let notificationSent = false;
        try {
            console.log(`Attempting to send notification for ${newsRef.id}...`);
            const notificationResult = await sendNotification(title, summary, newsRef.id);
            notificationSent = !!notificationResult;

            if (notificationSent) {
                console.log("✅ FCM Notification sent successfully.");
            } else {
                console.warn("⚠️ FCM Notification failed (returned null).");
            }
        } catch (notifyErr: unknown) {
            console.error("❌ Unexpected error sending notification:", notifyErr);
            notificationSent = false;
        }

        // 6. Return Success
        return NextResponse.json({
            success: true,
            id: newsRef.id,
            notificationSent: notificationSent,
            message: notificationSent
                ? "Published and Notified"
                : "Published but Notification Failed"
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Create News API Error:", error);
        return NextResponse.json({ error: message || "Internal Server Error" }, { status: 500 });
    }
}
