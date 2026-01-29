import { NewsSource, ArticleCandidate } from './news-source';
import { normalizeUrl } from '../../news-dedup';
import { parseRssFeed } from '../../rss';
import { dbAdmin } from '../../firebase-admin';
import { RssFeed } from '@/types/rss';
import { Timestamp } from 'firebase-admin/firestore';

export class RssSource implements NewsSource {
    id = 'rss-fallback';
    name = 'RSS Feed Fallback';
    priority = 3; // Lowest priority
    enabled = true;

    async fetchCandidate(): Promise<ArticleCandidate | null> {
        console.log(`[RssFallack] Searching for enabled RSS feed...`);

        try {
            // 1. Get enabled feeds that are not in cooldown
            // Note: In a real "Orchestrator" model, we might want to cache this or pass it in.
            // For now, we query Firestore to find ONE eligible feed.
            // Optimization: Pick one that hasn't been fetched recently.

            const feedsSnap = await dbAdmin.collection("rss_feeds")
                .where("enabled", "==", true)
                .get();

            if (feedsSnap.empty) return null;

            let feeds = feedsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RssFeed));

            // Filter Cooldown
            const now = Date.now();
            feeds = feeds.filter(f => {
                if (!f.cooldown_until) return true;
                return f.cooldown_until.toDate().getTime() < now;
            });

            if (feeds.length === 0) {
                console.log("[RssFallback] All feeds are in cooldown");
                return null;
            }

            // Shuffle or sort by last_fetched
            // Let's pick Random to distribute load evenly instead of strict sequence
            const feed = feeds[Math.floor(Math.random() * feeds.length)];
            const feedUrl = feed.rss_url || feed.url;

            if (!feedUrl) return null;

            console.log(`[RssFallback] Parsing feed: ${feed.name} (${feedUrl})`);
            const items = await parseRssFeed(feedUrl);

            // Check top 3 items
            for (const item of items.slice(0, 3)) {
                if (!item.link) continue;

                const clean = normalizeUrl(item.link);

                // Note: Orchestrator checks for duplicates against DB.
                // We just return a valid-looking candidate.

                return {
                    title: item.title,
                    summary: item.description,
                    sourceUrl: item.link,
                    cleanUrl: clean,
                    sourceName: feed.source_name || feed.name || 'RSS',
                    publishedAt: typeof item.pubDate === 'string' ? item.pubDate : undefined,
                    // Pass the Feed ID so Orchestrator can update cooldown
                    // We can attach it to sourceName temporarily or add a field if we mod interface.
                    // Ideally, we need to pass back metadata to update the specific RSS Feed document.
                    // For now, let's assume Orchestrator doesn't update RSS-specific stats 
                    // OR we extend common metadata.
                };
            }

        } catch (e) {
            console.error(`[RssFallback] Error:`, e);
        }

        return null;
    }
}
