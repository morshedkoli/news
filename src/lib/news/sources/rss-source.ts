import { NewsSource, ArticleCandidate } from './news-source';
import { normalizeUrl } from '../../news-dedup';
import { parseRssFeed } from '../../rss';
import { dbAdmin } from '../../firebase-admin';
import { RssFeed } from '@/types/rss';

export class RssSource implements NewsSource {
    id = 'rss';
    name = 'RSS Feed';
    priority = 1;
    enabled = true;
    private maxFeedsPerCycle = 3;

    setMaxFeedsPerCycle(value: number) {
        if (Number.isFinite(value) && value > 0) {
            this.maxFeedsPerCycle = Math.min(5, Math.max(1, Math.floor(value)));
        }
    }

    async fetchCandidates(): Promise<ArticleCandidate[]> {
        console.log(`[RssSource] Searching for enabled RSS feeds...`);

        try {
            // 1. Get enabled feeds that are not in cooldown
            const feedsSnap = await dbAdmin.collection("rss_feeds")
                .where("enabled", "==", true)
                .get();

            if (feedsSnap.empty) return [];

            let feeds = feedsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RssFeed));

            // Filter Cooldown
            const now = Date.now();
            feeds = feeds.filter(f => {
                if (!f.cooldown_until) return true;
                const cooldownUntil = f.cooldown_until as { toDate?: () => Date } | Date | undefined;
                const cooldownDate = cooldownUntil instanceof Date
                    ? cooldownUntil
                    : typeof cooldownUntil?.toDate === 'function'
                        ? cooldownUntil.toDate()
                        : null;
                return cooldownDate ? cooldownDate.getTime() < now : true;
            });

            if (feeds.length === 0) {
                console.log("[RssSource] All feeds are in cooldown");
                return [];
            }

            // 2. Select Feeds (Priority + Reliability)
            const sortedFeeds = feeds.sort((a, b) => {
                const aPriority = typeof a.priority === 'number' ? a.priority : 5;
                const bPriority = typeof b.priority === 'number' ? b.priority : 5;
                if (aPriority !== bPriority) return aPriority - bPriority;

                const aFailures = typeof a.consecutive_failures === 'number' ? a.consecutive_failures : 0;
                const bFailures = typeof b.consecutive_failures === 'number' ? b.consecutive_failures : 0;
                if (aFailures !== bFailures) return aFailures - bFailures;

                const aLast = a.last_success_at as { toDate?: () => Date } | Date | undefined;
                const bLast = b.last_success_at as { toDate?: () => Date } | Date | undefined;
                const aTime = aLast instanceof Date ? aLast.getTime() : typeof aLast?.toDate === 'function' ? aLast.toDate().getTime() : 0;
                const bTime = bLast instanceof Date ? bLast.getTime() : typeof bLast?.toDate === 'function' ? bLast.toDate().getTime() : 0;
                return bTime - aTime;
            });
            const selectedFeeds = sortedFeeds.slice(0, this.maxFeedsPerCycle);
            console.log(`[RssSource] Selected feeds: ${selectedFeeds.map(f => f.name || f.source_name).join(', ')}`);

            const allCandidates: ArticleCandidate[] = [];

            // 3. Fetch in Parallel
            await Promise.all(selectedFeeds.map(async (feed) => {
                const feedUrl = feed.rss_url || feed.url;
                if (!feedUrl) return;

                try {
                    console.log(`[RssSource] Parsing feed: ${feed.name} (${feedUrl})`);
                    const items = await parseRssFeed(feedUrl);

                    // Convert to candidates
                    for (const item of items.slice(0, 5)) { // Check top 5 from each
                        if (!item.link) continue;

                        // Basic validation
                        if (!item.title || item.title.length < 10) continue;

                        allCandidates.push({
                            title: item.title,
                            summary: item.description,
                            sourceUrl: item.link,
                            cleanUrl: normalizeUrl(item.link),
                            sourceName: feed.source_name || feed.name || 'RSS',
                            publishedAt: typeof item.pubDate === 'string' ? item.pubDate : undefined,
                            feedId: feed.id,
                            feedLanguage: feed.language,
                            sourceType: feed.source_type,
                            feedPriority: feed.priority
                        });
                    }
                } catch (e) {
                    console.error(`[RssSource] Failed to parse ${feed.name}:`, e);
                }
            }));

            // 4. Sort by Date (Desc)
            return allCandidates.sort((a, b) => {
                const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
                const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
                return dateB - dateA;
            });

        } catch (e) {
            console.error(`[RssSource] Error:`, e);
            return [];
        }
    }

}
