import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ArticleCandidate } from './sources/news-source';
import { RssSource } from './sources/rss-source';
import { dbAdmin } from '../firebase-admin';
import { sendNotification } from '../notifications';
import { normalizeCategory } from '../news-fetcher';
import { isBanglaText, validateNewsContent } from './validation';
import crypto from 'crypto';

interface RunResult {
    success: boolean;
    sourceUsed?: string;
    newsId?: string;
    exitReason?: string;
    durationMs: number;
}

export class NewsFetchOrchestrator {
    private rssSource: RssSource;
    private runId: string;
    private startTime: number;
    private log = console.log;

    // Run Stats
    private itemsChecked = 0;
    private aiFailures = 0;
    private skipReasons: string[] = [];

    constructor() {
        this.runId = crypto.randomUUID();
        this.startTime = Date.now();
        this.rssSource = new RssSource();
    }

    async run(): Promise<RunResult> {
        this.log(`[Orchestrator] Run ${this.runId} started. Mode=RSS_ONLY`);

        // 1. Process Retries (Before new fetch)
        await this.processRetries();

        // 1.5 Publish scheduled queue (if due)
        const scheduledResult = await this.publishScheduledQueue();
        if (scheduledResult.published) {
            return this.finish(true, 'queue', scheduledResult.newsId, 'scheduled_publish');
        }

        // 2. Fetch Candidates (RSS Only)
        // RssSource now handles feed selection/rotation internally
        const candidates = await this.rssSource.fetchCandidates();

        if (candidates.length === 0) {
            return this.finish(false, undefined, undefined, 'no_candidates_found');
        }

        // 2. Process Candidates
        this.itemsChecked = candidates.length;

        let publishedOnce = false;
        let publishedId: string | undefined;
        let queuedCount = 0;
        const queueStart = Date.now() + 30 * 60 * 1000;

        for (const candidate of candidates) {
            // A. Deduplication (Strict)
            const urlHash = this.generateUrlHash(candidate.cleanUrl);
            if (await this.checkUrlDuplicate(urlHash)) {
                this.log(`[Orchestrator] URL Duplicate: ${candidate.title}`);
                this.skipReasons.push(`duplicate: ${candidate.title.substring(0, 30)}...`);
                continue;
            }

            const contentHash = this.generateContentHash(candidate.title + (candidate.summary || ""));

            // B. Enrich Content (Non-Blocking)
            let fullContent = candidate.content || "";
            if (!fullContent && candidate.sourceUrl) {
                try {
                    const { fetchArticle } = await import('../news-fetcher');
                    const fetchResult = await fetchArticle(candidate.sourceUrl);
                    if (fetchResult.success) {
                        fullContent = fetchResult.data.content;
                        candidate.content = fetchResult.data.content;
                        candidate.excerpt = fetchResult.data.excerpt;
                        if (!candidate.image && fetchResult.data.image) candidate.image = fetchResult.data.image;
                        if (fetchResult.data.category) {
                            candidate.category = normalizeCategory(fetchResult.data.category) || candidate.category;
                        }
                    }
                } catch (e) {
                    this.log(`[Orchestrator] Content Fetch Failed (Non-fatal): ${e}`);
                }
            }

            const hasEnglishLetters = (text: string) => /[A-Za-z]/.test(text);

            // C. AI Summary (Non-Blocking)
            let summary = candidate.summary || "Pending Summary";
            let aiStatus = 'skipped';

            if (fullContent || candidate.summary) {
                try {
                    const aiModule = await import('../ai-engine');
                    const aiResult = await aiModule.generateContentWithFallback(
                        `Summarize this news article in 2-3 sentences in Bengali (Bangla) only. Content: ${fullContent || candidate.summary}`
                        , { feature: 'news_summary' }, 2);

                    if (aiResult?.content) {
                        summary = aiResult.content;
                        aiStatus = 'success';
                        candidate.summary = summary;
                    }
                } catch (e) {
                    this.log(`[Orchestrator] AI Summary Failed (Non-fatal): ${e}`);
                    aiStatus = 'failed';
                    this.aiFailures++;
                    summary = candidate.summary || candidate.excerpt || "Summary unavailable";
                }
            }

            // D. Translate if Summary/Title is English
            const titleNeedsTranslation = candidate.title && (hasEnglishLetters(candidate.title) || !isBanglaText(candidate.title));
            const summaryNeedsTranslation = summary && (hasEnglishLetters(summary) || !isBanglaText(summary));

            if (titleNeedsTranslation || summaryNeedsTranslation) {
                try {
                    const aiModule = await import('../ai-engine');
                    const translationPrompt = `Translate the following title and summary to Bengali (Bangla). Return ONLY JSON in this format: {"title":"...","summary":"..."}.
Title: ${candidate.title}
Summary: ${summary}`;

                    const translation = await aiModule.generateContentWithFallback(
                        translationPrompt,
                        { feature: 'news_translation' },
                        2
                    );

                    if (translation?.content) {
                        const jsonStart = translation.content.indexOf('{');
                        const jsonEnd = translation.content.lastIndexOf('}');
                        if (jsonStart !== -1 && jsonEnd !== -1) {
                            const jsonStr = translation.content.substring(jsonStart, jsonEnd + 1);
                            const translated = JSON.parse(jsonStr) as { title?: string; summary?: string };

                            if (translated.title && translated.summary) {
                                const translatedTitle = translated.title.trim();
                                const translatedSummary = translated.summary.trim();

                                const translationOk =
                                    translatedTitle.length > 0
                                    && translatedSummary.length > 0
                                    && !hasEnglishLetters(translatedTitle)
                                    && !hasEnglishLetters(translatedSummary)
                                    && isBanglaText(translatedTitle)
                                    && isBanglaText(translatedSummary);

                                if (translationOk) {
                                    candidate.title = translatedTitle;
                                    summary = translatedSummary;
                                    candidate.summary = translatedSummary;
                                } else {
                                    this.log(`[Orchestrator] ⛔ Translation Invalid: ${candidate.title}`);
                                    this.skipReasons.push('dropped: TRANSLATION_INVALID');
                                    continue;
                                }
                            } else {
                                this.log(`[Orchestrator] ⛔ Translation Missing Fields: ${candidate.title}`);
                                this.skipReasons.push('dropped: TRANSLATION_MISSING_FIELDS');
                                continue;
                            }
                        } else {
                            this.log(`[Orchestrator] ⛔ Translation JSON Parse Failed: ${candidate.title}`);
                            this.skipReasons.push('dropped: TRANSLATION_PARSE_FAILED');
                            continue;
                        }
                    } else {
                        this.log(`[Orchestrator] ⛔ Translation Failed: ${candidate.title}`);
                        this.skipReasons.push('dropped: TRANSLATION_FAILED');
                        continue;
                    }
                } catch (e) {
                    this.log(`[Orchestrator] ⛔ Translation Error: ${candidate.title}`);
                    this.skipReasons.push('dropped: TRANSLATION_ERROR');
                    continue;
                }
            }

            let normalizedCategory = normalizeCategory(candidate.category || null);
            if (!normalizedCategory && candidate.category) {
                try {
                    const aiModule = await import('../ai-engine');
                    const categoryTranslation = await aiModule.generateContentWithFallback(
                        `Translate this category to Bengali (Bangla). Return only the category name.
Category: ${candidate.category}`,
                        { feature: 'news_category_translation' },
                        2
                    );

                    const translatedCategory = categoryTranslation?.content?.trim() || "";
                    normalizedCategory = normalizeCategory(translatedCategory) || (/[ঀ-৿]/.test(translatedCategory) ? translatedCategory : null);
                } catch (e) {
                    this.log(`[Orchestrator] Category Translation Failed: ${candidate.category} (${e})`);
                }
            }

            candidate.category = normalizedCategory || "সাধারণ";

            // E. Validate Content (STRICT GATE)
            const validation = validateNewsContent(candidate);
            if (!validation.isValid) {
                // Check if we should Drop completely or just Block
                const dropReasons = [
                    'TITLE_NOT_BANGLA',
                    'SUMMARY_EMPTY',
                    'SUMMARY_NOT_BANGLA',
                    'SUMMARY_TOO_SHORT',
                    'SUMMARY_PENDING_OR_PLACEHOLDER',
                    'ENGLISH_DETECTED'
                ];
                const shouldDrop = validation.blockReasons.some(r => dropReasons.includes(r));

                if (shouldDrop) {
                    this.log(`[Orchestrator] 🗑️ DROPPED (Low Quality): ${candidate.title}`);
                    this.log(`  Reasons: ${validation.blockReasons.join(", ")}`);
                    this.skipReasons.push(`dropped: ${validation.blockReasons.join(", ")}`);
                    // DO NOT SAVE to DB
                    continue;
                }

                // For other reasons (e.g. maybe specific blacklisted keywords if added later), drop without saving
                this.log(`[Orchestrator] ⛔ BLOCKED (Drop): ${candidate.title}`);
                this.log(`  Reasons: ${validation.blockReasons.join(", ")}`);

                this.skipReasons.push(`dropped: ${validation.blockReasons.join(", ")}`);

                // DO NOT SAVE to DB
                continue;
            }

            // Require feature image before publishing
            if (!candidate.image || (typeof candidate.image === 'string' && candidate.image.trim().length === 0)) {
                this.log(`[Orchestrator] 🗑️ DROPPED (No Image): ${candidate.title}`);
                this.skipReasons.push('dropped: IMAGE_MISSING');
                // DO NOT SAVE to DB
                continue;
            }

            // F. Publish or Queue
            try {
                // Ensure we pass the updated summary
                candidate.summary = summary;

                if (!publishedOnce) {
                    const newsId = await this.publish(candidate, contentHash, urlHash, aiStatus);
                    this.log(`[Orchestrator] Published: ${candidate.title} (${newsId})`);
                    publishedOnce = true;
                    publishedId = newsId;

                    if (candidate.feedId) {
                        await this.updateFeedSuccess(candidate.feedId);
                    }
                } else {
                    queuedCount += 1;
                    const scheduledAt = Timestamp.fromDate(new Date(queueStart + ((queuedCount - 1) * 30 * 60 * 1000)));
                    await this.saveQueuedNews(candidate, contentHash, urlHash, aiStatus, scheduledAt);
                    this.log(`[Orchestrator] Queued: ${candidate.title} (in ${queuedCount * 30}m)`);
                }
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : String(e);
                this.log(`[Orchestrator] Publish Failed: ${message}`);
                this.skipReasons.push(`publish_error: ${message}`);
                continue;
            }
        }

        if (publishedOnce) {
            return this.finish(true, 'rss', publishedId, queuedCount > 0 ? 'published_and_queued' : 'success');
        }

        return this.finish(false, 'rss', undefined, 'all_candidates_skipped_or_failed');
    }

    private async finish(success: boolean, source: string | undefined, newsId: string | undefined, reason: string): Promise<RunResult> {
        // Log run to DB
        await dbAdmin.collection("rss_run_logs").add({
            run_id: this.runId,
            started_at: new Date(this.startTime).toISOString(),
            duration_ms: Date.now() - this.startTime,
            success,
            source_used: source || 'rss',
            exit_reason: reason,
            posted_news_id: newsId || null,
            tried_sources: ['rss'],
            // Detailed Stats
            items_checked: this.itemsChecked,
            ai_failures: this.aiFailures,
            skip_reasons: this.skipReasons,
            post_published: !!newsId
        });

        // Update Heartbeat always
        try {
            await dbAdmin.collection("system_stats").doc("rss_settings").update({
                last_run_at: Timestamp.now()
            });
            if (!success) {
                await dbAdmin.collection("system_stats").doc("rss_settings").update({
                    consecutive_failed_runs: FieldValue.increment(1)
                });
            }
        } catch (e) {
            console.error("Failed to update heartbeat", e);
        }

        return { success, sourceUsed: source, newsId, exitReason: reason, durationMs: Date.now() - this.startTime };
    }

    private async checkUrlDuplicate(hash: string): Promise<boolean> {
        const snap = await dbAdmin.collection('news').where('normalized_url_hash', '==', hash).limit(1).get();
        return !snap.empty;
    }

    private generateUrlHash(url: string): string {
        return crypto.createHash('md5').update(url).digest('hex');
    }

    private generateContentHash(text: string): string {
        return crypto.createHash('md5').update(text).digest('hex');
    }

    private async saveQueuedNews(candidate: ArticleCandidate, contentHash: string, urlHash: string, aiStatus: string, scheduledAt: Timestamp) {
        try {
            let categoryId: string | undefined;
            let categorySlug: string | undefined;
            const categoryName = candidate.category || "সাধারণ";

            try {
                const { CategoryService } = await import('../categories');
                const catData = await CategoryService.ensureCategory(categoryName);
                categoryId = catData.id;
                categorySlug = catData.slug;
            } catch (e) {
                console.error("Queue Category Error:", e);
            }

            await dbAdmin.collection('news').add({
                title: candidate.title,
                summary: candidate.summary || candidate.excerpt || "",
                content: candidate.content || "",
                image: candidate.image || "",
                source_url: candidate.sourceUrl,
                normalized_url: candidate.cleanUrl,
                normalized_url_hash: urlHash,
                content_hash: contentHash,
                source_name: candidate.sourceName,
                created_at: Timestamp.now(),
                published_at: null,
                scheduled_at: scheduledAt,
                push_sent: false,
                category: categoryName,
                category_name: categoryName,
                categoryId,
                categorySlug,
                is_rss: true,
                source_type: 'rss_fetch',
                summary_status: aiStatus === 'success' ? 'complete' : 'pending',
                ai_status: aiStatus,
                importance_score: 30,
                likes: 0,
                status: 'processing'
            });
        } catch (e) {
            console.error("Failed to save queued news:", e);
        }
    }

    private async publishScheduledQueue(): Promise<{ published: boolean; newsId?: string }> {
        try {
            const snap = await dbAdmin.collection('news')
                .where('status', '==', 'processing')
                .limit(10)
                .get();

            if (snap.empty) return { published: false };

            const now = Date.now();
            const due = snap.docs
                .map(d => ({ id: d.id, data: d.data() }))
                .filter(d => d.data.scheduled_at)
                .map(d => {
                    const scheduledAt = d.data.scheduled_at as { toDate?: () => Date } | Date;
                    const scheduledDate = scheduledAt instanceof Date
                        ? scheduledAt
                        : typeof scheduledAt?.toDate === 'function'
                            ? scheduledAt.toDate()
                            : null;
                    return { ...d, scheduledDate };
                })
                .filter(d => d.scheduledDate && d.scheduledDate.getTime() <= now)
                .sort((a, b) => (a.scheduledDate?.getTime() || 0) - (b.scheduledDate?.getTime() || 0));

            if (due.length === 0) return { published: false };

            const next = due[0];
            const newsRef = dbAdmin.collection('news').doc(next.id);
            const statsRef = dbAdmin.collection('system_stats').doc('rss_settings');

            await dbAdmin.runTransaction(async (t) => {
                const doc = await t.get(newsRef);
                if (!doc.exists) return;
                const data = doc.data();
                const categoryId = data?.categoryId;

                t.update(newsRef, {
                    published_at: FieldValue.serverTimestamp(),
                    status: 'published'
                });

                t.set(statsRef, {
                    last_news_posted_at: FieldValue.serverTimestamp(),
                    last_run_at: FieldValue.serverTimestamp(),
                    total_posts_today: FieldValue.increment(1),
                    consecutive_failed_runs: 0
                }, { merge: true });

                if (categoryId) {
                    const { CategoryService } = await import('../categories');
                    await CategoryService.incrementCategoryCount(categoryId, t);
                }
            });

            // Notify App Users
            try {
                const data = next.data;
                await sendNotification(data.title || "New News Available", data.summary || "New News Available", next.id);
            } catch (e) {
                console.error("Failed to send notification:", e);
            }

            // Auto-post to Facebook pages (non-blocking)
            try {
                const data = next.data;
                const { FacebookService } = await import('../facebook-service');
                await FacebookService.postNewsToPages(
                    next.id,
                    data.title || 'Untitled',
                    data.summary || '',
                    data.image,
                    data.source_url
                );
            } catch (e) {
                console.error("Failed to post to Facebook:", e);
            }

            return { published: true, newsId: next.id };
        } catch (e) {
            console.error("Failed to publish scheduled queue:", e);
            return { published: false };
        }
    }

    private async publish(candidate: ArticleCandidate, contentHash: string, urlHash: string, aiStatus: string): Promise<string> {
        let categoryId: string | undefined;
        let categorySlug: string | undefined;
        const categoryName = candidate.category || "General";

        // Resolve Category
        try {
            const { CategoryService } = await import('../categories');
            const catData = await CategoryService.ensureCategory(categoryName);
            categoryId = catData.id;
            categorySlug = catData.slug;
            await CategoryService.incrementCategoryCount(catData.id);
        } catch (e) {
            console.error("Orchestrator Category Error:", e);
            throw new Error(`Category resolution failed: ${e}`);
        }

        const statsRef = dbAdmin.collection('system_stats').doc('rss_settings');
        const newsRef = dbAdmin.collection('news').doc();

        try {
            await dbAdmin.runTransaction(async (t) => {
                const statsSnap = await t.get(statsRef);
                const statsData = statsSnap.exists ? (statsSnap.data() as Record<string, unknown>) : {};

                const intervalMinutes = typeof statsData.update_interval_minutes === 'number' ? statsData.update_interval_minutes : 40; // default 40
                const lastPostedRaw = statsData.last_news_posted_at as { toDate?: () => Date } | undefined;
                const lastPosted = lastPostedRaw?.toDate ? lastPostedRaw.toDate().getTime() : 0;

                if (Date.now() - lastPosted < intervalMinutes * 60 * 1000) {
                    // Cooldown active - abort transaction
                    throw new Error('cooldown_active');
                }

                const newsData = {
                    title: candidate.title,
                    summary: candidate.summary || candidate.excerpt || "Click to read more...",
                    content: candidate.content || "",
                    image: candidate.image || "",
                    source_url: candidate.sourceUrl,
                    normalized_url: candidate.cleanUrl,
                    normalized_url_hash: urlHash,
                    content_hash: contentHash,
                    source_name: candidate.sourceName,
                    published_at: FieldValue.serverTimestamp(),
                    created_at: FieldValue.serverTimestamp(),
                    category: categoryName,
                    category_name: categoryName,
                    categoryId,
                    categorySlug,
                    is_rss: true,
                    source_type: 'rss_fetch',
                    summary_status: aiStatus === 'success' ? 'complete' : 'pending',
                    ai_status: aiStatus,
                    importance_score: 50,
                    likes: 0,
                    status: 'published'
                };

                t.set(newsRef, newsData);

                // Update stats atomically
                t.set(statsRef, {
                    last_news_posted_at: FieldValue.serverTimestamp(),
                    last_run_at: FieldValue.serverTimestamp(),
                    total_posts_today: FieldValue.increment(1),
                    consecutive_failed_runs: 0
                }, { merge: true });
            });

            // Notify App Users (outside transaction)
            try {
                await sendNotification(candidate.title, candidate.summary || "New News Available", newsRef.id);
            } catch (e) {
                console.error("Failed to send notification:", e);
            }

            // Auto-post to Facebook pages (outside transaction, non-blocking)
            try {
                const { FacebookService } = await import('../facebook-service');
                await FacebookService.postNewsToPages(
                    newsRef.id,
                    candidate.title,
                    candidate.summary || candidate.excerpt || "Click to read more...",
                    candidate.image,
                    candidate.sourceUrl
                );
                this.log(`[Orchestrator] Posted to Facebook pages`);
            } catch (e) {
                // Log but don't fail the publish operation
                console.error("Failed to post to Facebook:", e);
                this.log(`[Orchestrator] Facebook posting failed: ${e}`);
            }

            return newsRef.id;
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Unknown error";
            if (message === 'cooldown_active') {
                throw new Error('publish_cooldown_active');
            }
            throw e;
        }
    }

    private async processRetries() {
        this.log(`[Orchestrator] Checking for retries...`);
        try {
            // Fetch potential retries (Client-side filter for now to avoid advanced indexing)
            const snap = await dbAdmin.collection('news')
                .where('status', '==', 'blocked_retry')
                .get();

            const now = Date.now();
            const pending = snap.docs.filter(d => {
                const data = d.data();
                const nextRetry = data.next_retry_at instanceof Timestamp ? data.next_retry_at.toDate().getTime() : 0;
                return nextRetry <= now && (data.retry_count || 0) < 3;
            });

            if (pending.length === 0) return;

            this.log(`[Orchestrator] Processing ${pending.length} retries...`);

            for (const docSnap of pending) {
                const data = docSnap.data();
                const docId = docSnap.id;
                this.log(`[Orchestrator] Retrying: ${data.title}`);

                try {
                    // Call AI for Translation
                    const aiModule = await import('../ai-engine');
                    const prompt = `Translate the following news title and summary to Bengali (Bangla). 
Return JSON in this format: { "title": "...", "summary": "..." }
Original Title: ${data.title}
Original Summary: ${data.summary}`;

                    const aiResult = await aiModule.generateContent(prompt, { feature: 'retry_translation' });

                    if (aiResult?.content) {
                        // Parse JSON
                        const jsonStart = aiResult.content.indexOf('{');
                        const jsonEnd = aiResult.content.lastIndexOf('}');
                        if (jsonStart !== -1 && jsonEnd !== -1) {
                            const jsonStr = aiResult.content.substring(jsonStart, jsonEnd + 1);
                            const translated = JSON.parse(jsonStr);

                            if (translated.title && translated.summary) {
                                // Construct Candidate from Doc + Translation
                                const candidate: ArticleCandidate = {
                                    title: translated.title,
                                    summary: translated.summary,
                                    content: data.content,
                                    image: data.image,
                                    sourceUrl: data.source_url,
                                    cleanUrl: data.normalized_url,
                                    sourceName: data.source_name,
                                    publishedAt: data.published_at,
                                    category: data.category,
                                    feedId: undefined // Logic doesn't need feedId update for query
                                };

                                // Re-validate
                                const validation = validateNewsContent(candidate);
                                if (validation.isValid) {
                                    // Publish!
                                    await this.publish(candidate, data.content_hash, data.normalized_url_hash, 'success_retry');
                                    // Delete blocked doc
                                    await dbAdmin.collection('news').doc(docId).delete();
                                    this.log(`[Orchestrator] Retry Success: ${data.title} -> ${translated.title}`);
                                    continue;
                                } else {
                                    this.log(`[Orchestrator] Retry Translation Invalid: ${validation.blockReasons.join(',')}`);
                                }
                            }
                        }
                    }

                    // If we got here, retry failed
                    await dbAdmin.collection('news').doc(docId).update({
                        retry_count: FieldValue.increment(1),
                        next_retry_at: Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)), // Backoff 10m
                        last_retry_error: "Translation failed or invalid"
                    });

                } catch (e: unknown) {
                    console.error(`[Orchestrator] Retry Error for ${docId}:`, e);
                    await dbAdmin.collection('news').doc(docId).update({
                        retry_count: FieldValue.increment(1),
                        next_retry_at: Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000))
                    });
                }
            }
        } catch (e) {
            console.error("[Orchestrator] Retry Cycle Error:", e);
        }
    }

    private async updateFeedSuccess(feedId: string) {
        await dbAdmin.collection("rss_feeds").doc(feedId).update({
            last_success_at: Timestamp.now(),
            consecutive_failures: 0
        });
    }
}
