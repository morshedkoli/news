import { NewsSource, ArticleCandidate } from './sources/news-source';
import { GoogleNewsSource } from './sources/google-news';
import { DirectWebSource } from './sources/direct-scraper';
import { RssSource } from './sources/rss-source';
import { fetchArticle } from '../news-fetcher';
import { checkDuplicate, generateContentHash, generateUrlHash } from '../news-dedup';
import { dbAdmin } from '../firebase-admin';
import { sendNotification } from '../notifications';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

interface RunResult {
    success: boolean;
    sourceUsed?: string;
    newsId?: string;
    exitReason?: string;
    durationMs: number;
}

export class NewsFetchOrchestrator {
    private sources: NewsSource[] = [];
    private runId: string;
    private startTime: number;
    private log = console.log;

    constructor() {
        this.runId = crypto.randomUUID();
        this.startTime = Date.now();

        // Initialize Sources in Priority Order
        this.sources = [
            new GoogleNewsSource(),
            new DirectWebSource(),
            new RssSource()
        ].sort((a, b) => a.priority - b.priority);
    }

    async run(force = false, dryRun = false): Promise<RunResult> {
        this.log(`[Orchestrator] Run ${this.runId} started. Force=${force}, Dry=${dryRun}`);

        // 1. Load State (Disabled Sources Mask)
        const settingsRef = dbAdmin.collection("system_stats").doc("rss_settings");
        const settingsSnap = await settingsRef.get();
        const settings = settingsSnap.data() || {};

        // List of source IDs that failed in previous runs (and haven't been reset by a success)
        let disabledSources: string[] = settings.temp_disabled_sources || [];

        // Filter sources
        let candidates = this.sources.filter(s => s.enabled && !disabledSources.includes(s.id));

        // If all candidates are disabled (Chain Completed without success), Reset and Retry Primary
        if (candidates.length === 0) {
            this.log(`[Orchestrator] All sources were temporarily disabled. Resetting chain.`);
            disabledSources = [];
            candidates = this.sources.filter(s => s.enabled);
        }

        // Pick Top Priority
        if (candidates.length === 0) {
            return this.finish(false, undefined, undefined, 'no_sources_available');
        }

        const source = candidates[0]; // Logic: Top priority available

        this.log(`[Orchestrator] Selected Source: ${source.name} (Priority ${source.priority})`);

        // Check global timeout (45s safety)
        if (Date.now() - this.startTime > 45000) {
            return this.finish(false, undefined, undefined, 'global_timeout');
        }

        try {
            // 2. Fetch Candidate
            const candidate = await source.fetchCandidate();

            if (!candidate) {
                this.log(`[Orchestrator] Source ${source.name} returned no candidate.`);

                // Mark as disabled for next run
                if (!dryRun) {
                    await settingsRef.set({
                        temp_disabled_sources: FieldValue.arrayUnion(source.id)
                    }, { merge: true });
                }

                return this.finish(false, source.name, undefined, 'source_empty');
            }

            this.log(`[Orchestrator] Candidate found: ${candidate.title || candidate.sourceUrl}`);

            // 3. Dedup Check (URL)
            const urlHash = generateUrlHash(candidate.cleanUrl);
            const isUrlDuplicate = await this.checkUrlDuplicate(urlHash);
            if (isUrlDuplicate) {
                this.log(`[Orchestrator] Duplicate URL detected. Skipping.`);
                // Treat duplicate same as "Empty" -> Move to next source next time
                if (!dryRun) {
                    await settingsRef.set({
                        temp_disabled_sources: FieldValue.arrayUnion(source.id)
                    }, { merge: true });
                }
                return this.finish(false, source.name, undefined, 'duplicate_url');
            }

            // 4. Fetch Content (if missing or thin)
            let fullContent = candidate.content || "";
            let textContent = candidate.textContent || "";
            let image = candidate.image;
            let title = candidate.title;

            if (!fullContent || fullContent.length < 200) {
                this.log(`[Orchestrator] Fetching full article content...`);
                const fetchResult = await fetchArticle(candidate.sourceUrl);
                if (fetchResult.success && fetchResult.data) {
                    fullContent = fetchResult.data.content;
                    textContent = fetchResult.data.textContent;
                    image = image || fetchResult.data.image || undefined;
                    title = title || fetchResult.data.title;

                    candidate.title = title;
                    candidate.content = fullContent;
                    candidate.textContent = textContent;
                    candidate.image = image;
                } else {
                    this.log(`[Orchestrator] Content fetch failed.`);
                    // Treat as failure -> Disable source
                    if (!dryRun) {
                        await settingsRef.set({
                            temp_disabled_sources: FieldValue.arrayUnion(source.id)
                        }, { merge: true });
                    }
                    return this.finish(false, source.name, undefined, 'content_fetch_failed');
                }
            }

            // 5. Dedup Check (Content)
            const contentHash = generateContentHash(textContent);
            const isContentDuplicate = await this.checkContentDuplicate(contentHash);
            if (isContentDuplicate) {
                this.log(`[Orchestrator] Duplicate Content detected.`);
                if (!dryRun) {
                    await settingsRef.set({
                        temp_disabled_sources: FieldValue.arrayUnion(source.id)
                    }, { merge: true });
                }
                return this.finish(false, source.name, undefined, 'duplicate_content');
            }

            // 6. Post (Publish)
            if (dryRun) {
                this.log(`[DryRun] Would publish: ${title}`);
                return this.finish(true, source.name, 'dry-run-id', 'success');
            }

            const newsId = await this.publish(candidate, contentHash, urlHash);

            // 7. Success! Clear the disabled chain
            await settingsRef.set({
                temp_disabled_sources: [], // Reset chain
                last_successful_run: Timestamp.now(),
                total_posts_today: FieldValue.increment(1)
            }, { merge: true });

            // 8. RSS Cooldown Update
            if (candidate.feedId) {
                await this.updateRssCooldown(candidate.feedId, candidate.cooldownMinutes || 30);
            }

            return this.finish(true, source.name, newsId, 'success');

        } catch (e: any) {
            console.error(`[Orchestrator] Error with source ${source.name}:`, e);

            // Mark as disabled for next run
            if (!dryRun) {
                await settingsRef.set({
                    temp_disabled_sources: FieldValue.arrayUnion(source.id)
                }, { merge: true });
            }
            return this.finish(false, source.name, undefined, 'source_error');
        }
    }

    private async finish(success: boolean, source: string | undefined, newsId: string | undefined, reason: string): Promise<RunResult> {
        // Log run to DB
        await dbAdmin.collection("rss_run_logs").add({
            run_id: this.runId,
            started_at: new Date(this.startTime).toISOString(),
            duration_ms: Date.now() - this.startTime,
            success,
            source_used: source || null,
            exit_reason: reason,
            posted_news_id: newsId || null
        });

        this.log(`[Orchestrator] Finished. Success=${success} Reason=${reason}`);
        return { success, sourceUsed: source, newsId, exitReason: reason, durationMs: Date.now() - this.startTime };
    }

    private async checkUrlDuplicate(hash: string): Promise<boolean> {
        const snap = await dbAdmin.collection('news').where('normalized_url_hash', '==', hash).limit(1).get();
        return !snap.empty;
    }

    private async checkContentDuplicate(hash: string): Promise<boolean> {
        const snap = await dbAdmin.collection('news').where('content_hash', '==', hash).limit(1).get();
        return !snap.empty;
    }

    private async publish(candidate: ArticleCandidate, contentHash: string, urlHash: string): Promise<string> {
        const ref = await dbAdmin.collection('news').add({
            title: candidate.title,
            summary: candidate.summary || "Pending Summary",
            content: candidate.content,
            image: candidate.image || "",
            source_url: candidate.sourceUrl,
            normalized_url: candidate.cleanUrl,
            normalized_url_hash: urlHash,
            content_hash: contentHash,
            source_name: candidate.sourceName,
            published_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            category: candidate.category || "General",
            is_rss: true,
            source_type: 'auto_fetch',
            summary_status: 'pending',
            importance_score: 50
        });

        // Notify
        await sendNotification(candidate.title, "New Update", ref.id);
        return ref.id;
    }

    private async updateRssCooldown(feedId: string, minutes: number) {
        const cooldownTime = Timestamp.fromMillis(Date.now() + minutes * 60 * 1000);
        await dbAdmin.collection("rss_feeds").doc(feedId).update({
            last_success_at: Timestamp.now(),
            cooldown_until: cooldownTime
        });
    }
}
