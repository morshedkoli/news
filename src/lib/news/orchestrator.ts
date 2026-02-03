import { ActionCodeSettings } from 'firebase-admin/auth';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NewsSource, ArticleCandidate } from './sources/news-source';
import { RssSource } from './sources/rss-source';
import { dbAdmin } from '../firebase-admin';
import { sendNotification } from '../notifications';
import { validateNewsContent } from './validation';
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

    async run(force = false, dryRun = false): Promise<RunResult> {
        this.log(`[Orchestrator] Run ${this.runId} started. Mode=RSS_ONLY`);

        // 1. Process Retries (Before new fetch)
        await this.processRetries();

        // 2. Fetch Candidates (RSS Only)
        // RssSource now handles feed selection/rotation internally
        const candidates = await this.rssSource.fetchCandidates();

        if (candidates.length === 0) {
            return this.finish(false, undefined, undefined, 'no_candidates_found');
        }

        // 2. Process Candidates
        this.itemsChecked = candidates.length;

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
                    }
                } catch (e) {
                    this.log(`[Orchestrator] Content Fetch Failed (Non-fatal): ${e}`);
                }
            }

            // C. AI Summary (Non-Blocking)
            let summary = candidate.summary || "Pending Summary";
            let aiStatus = 'skipped';

            if (fullContent || candidate.summary) {
                try {
                    const aiModule = await import('../ai-engine');
                    const aiResult = await aiModule.generateContent(
                        `Summarize this news article in 2-3 sentences max. Language: Bengali (if content is Bengali) or English. Content: ${fullContent || candidate.summary}`
                        , { feature: 'news_summary' });

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

            // D. Validate Content (STRICT GATE)
            const validation = validateNewsContent(candidate);
            if (!validation.isValid) {
                // Check if we should Drop completely or just Block
                const dropReasons = ['TITLE_NOT_BANGLA', 'SUMMARY_EMPTY', 'SUMMARY_NOT_BANGLA', 'SUMMARY_TOO_SHORT', 'SUMMARY_PENDING_OR_PLACEHOLDER'];
                const shouldDrop = validation.blockReasons.some(r => dropReasons.includes(r));

                if (shouldDrop) {
                    this.log(`[Orchestrator] 🗑️ DROPPED (Low Quality): ${candidate.title}`);
                    this.log(`  Reasons: ${validation.blockReasons.join(", ")}`);
                    this.skipReasons.push(`dropped: ${validation.blockReasons.join(", ")}`);
                    // DO NOT SAVE to DB
                    continue;
                }

                // For other reasons (e.g. maybe specific blacklisted keywords if added later), keep blocking logic
                this.log(`[Orchestrator] ⛔ BLOCKED: ${candidate.title}`);
                this.log(`  Reasons: ${validation.blockReasons.join(", ")}`);

                this.skipReasons.push(`blocked: ${validation.blockReasons.join(", ")}`);

                // Save as Blocked
                await this.saveBlockedNews(candidate, contentHash, urlHash, aiStatus, validation.blockReasons);

                // Allow pipeline to continue to next item
                continue;
            }

            // Require feature image before publishing
            if (!candidate.image || (typeof candidate.image === 'string' && candidate.image.trim().length === 0)) {
                this.log(`[Orchestrator] ⛔ BLOCKED (No Image): ${candidate.title}`);
                const reasons = [...(validation.blockReasons || []), 'IMAGE_MISSING'];
                this.skipReasons.push(`blocked: IMAGE_MISSING`);
                await this.saveBlockedNews(candidate, contentHash, urlHash, aiStatus, reasons);
                continue;
            }

            // E. Publish
            try {
                // Ensure we pass the updated summary
                candidate.summary = summary;

                const newsId = await this.publish(candidate, contentHash, urlHash, aiStatus);
                this.log(`[Orchestrator] Published: ${candidate.title} (${newsId})`);

                if (candidate.feedId) {
                    await this.updateFeedSuccess(candidate.feedId);
                }

                return this.finish(true, 'rss', newsId, 'success');
            } catch (e: any) {
                this.log(`[Orchestrator] Publish Failed: ${e}`);
                this.skipReasons.push(`publish_error: ${e.message}`);
                continue;
            }
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

    private async saveBlockedNews(candidate: ArticleCandidate, contentHash: string, urlHash: string, aiStatus: string, reasons: string[]) {
        try {
            // Retry Logic for Language Blocks
            const isLanguageBlock = reasons.some(r => r.includes('NOT_BANGLA'));
            const status = isLanguageBlock ? 'blocked_retry' : 'blocked';
            const retryFields = isLanguageBlock ? {
                retry_count: 0,
                next_retry_at: Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)), // 10 mins
            } : {};

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
                blocked_at: Timestamp.now(),
                created_at: Timestamp.now(),
                published_at: null, // ENSURE NULL
                push_sent: false,   // ENSURE FALSE
                category: candidate.category || "General",
                is_rss: true,
                source_type: 'rss_fetch',
                summary_status: aiStatus,
                status: status,
                block_reasons: reasons,
                importance_score: 0,
                ...retryFields
            });
        } catch (e) {
            console.error("Failed to save blocked news:", e);
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
                const statsData = statsSnap.exists ? statsSnap.data() : {} as any;

                const intervalMinutes = (statsData.update_interval_minutes as number) || 40; // default 40
                const lastPosted = statsData.last_news_posted_at ? statsData.last_news_posted_at.toDate().getTime() : 0;

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

            return newsRef.id;
        } catch (e: any) {
            if (e.message === 'cooldown_active') {
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

                } catch (e: any) {
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
