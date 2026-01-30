import { ActionCodeSettings } from 'firebase-admin/auth';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NewsSource, ArticleCandidate } from './sources/news-source';
import { RssSource } from './sources/rss-source';
import { dbAdmin } from '../firebase-admin';
import { sendNotification } from '../notifications';
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

    constructor() {
        this.runId = crypto.randomUUID();
        this.startTime = Date.now();
        this.rssSource = new RssSource();
    }

    async run(force = false, dryRun = false): Promise<RunResult> {
        this.log(`[Orchestrator] Run ${this.runId} started. Mode=RSS_ONLY`);

        // 1. Fetch Candidates (RSS Only)
        // RssSource now handles feed selection/rotation internally
        const candidates = await this.rssSource.fetchCandidates();

        if (candidates.length === 0) {
            return this.finish(false, undefined, undefined, 'no_candidates_found');
        }

        // 2. Process Candidates
        for (const candidate of candidates) {
            // A. Deduplication (Strict)
            const urlHash = this.generateUrlHash(candidate.cleanUrl);
            if (await this.checkUrlDuplicate(urlHash)) {
                this.log(`[Orchestrator] URL Duplicate: ${candidate.title}`);
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
                    summary = candidate.summary || candidate.excerpt || "Summary unavailable";
                }
            }

            // D. Publish
            try {
                // Ensure we pass the updated summary
                candidate.summary = summary;

                const newsId = await this.publish(candidate, contentHash, urlHash, aiStatus);
                this.log(`[Orchestrator] Published: ${candidate.title} (${newsId})`);

                if (candidate.feedId) {
                    await this.updateFeedSuccess(candidate.feedId);
                }

                return this.finish(true, 'rss', newsId, 'success');
            } catch (e) {
                this.log(`[Orchestrator] Publish Failed: ${e}`);
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
            tried_sources: ['rss']
        });

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

        const ref = await dbAdmin.collection('news').add({
            title: candidate.title,
            summary: candidate.summary || candidate.excerpt || "Click to read more...",
            content: candidate.content || "",
            image: candidate.image || "",
            source_url: candidate.sourceUrl,
            normalized_url: candidate.cleanUrl,
            normalized_url_hash: urlHash,
            content_hash: contentHash,
            source_name: candidate.sourceName,
            published_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            category: categoryName,
            category_name: categoryName,
            categoryId,
            categorySlug,
            is_rss: true,
            source_type: 'rss_fetch',
            summary_status: aiStatus === 'success' ? 'complete' : 'pending',
            ai_status: aiStatus,
            importance_score: 50,
            likes: 0
        });

        // Update Global Stats (triggers Cooldown)
        await dbAdmin.collection("system_stats").doc("rss_settings").update({
            last_news_posted_at: Timestamp.now(),
            total_posts_today: FieldValue.increment(1),
            consecutive_failed_runs: 0
        });

        // Notify App Users
        try {
            await sendNotification(candidate.title, candidate.summary || "New News Available", ref.id);
        } catch (e) {
            console.error("Failed to send notification:", e);
        }

        return ref.id;
    }

    private async updateFeedSuccess(feedId: string) {
        await dbAdmin.collection("rss_feeds").doc(feedId).update({
            last_success_at: Timestamp.now(),
            consecutive_failures: 0
        });
    }
}
