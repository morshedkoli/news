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
                return f.cooldown_until.toDate().getTime() < now;
            });

            if (feeds.length === 0) {
                console.log("[RssSource] All feeds are in cooldown");
                return [];
            }

            // 2. Select Feeds (Random Subset)
            // To ensure diversity but also reliability, we pick up to 3 feeds.
            // Shuffling ensures we don't always pick the same ones if we have many.
            const selectedFeeds = this.shuffle(feeds).slice(0, 3);
            console.log(`[RssSource] Selected feeds: ${selectedFeeds.map(f => f.name).join(', ')}`);

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
                            category: feed.category // Propagate category if defined on feed
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

    private shuffle<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}
