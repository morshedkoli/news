import * as cheerio from 'cheerio';
import { NewsSource, ArticleCandidate } from './news-source';
import { normalizeUrl } from '../../news-dedup';

interface SiteConfig {
    name: string;
    listUrl: string;
    linkSelector: string; // Selector to find article links on list page
    articleSelector?: string; // Optional: Selector to find main article content
}

export class DirectWebSource implements NewsSource {
    id = 'direct-web-scraper';
    name = 'Direct Website Scraper';
    priority = 2; // Medium priority
    enabled = true;

    // Configuration for sites to scrape
    private sites: SiteConfig[] = [
        {
            name: 'Prothom Alo',
            listUrl: 'https://www.prothomalo.com/collection/latest',
            linkSelector: 'a.card-link, a.story-link', // Adjust as needed
        },
        {
            name: 'Kaler Kantho',
            listUrl: 'https://www.kalerkantho.com/online/all-news',
            linkSelector: 'h3 a, .title a',
        }
    ];

    async fetchCandidate(): Promise<ArticleCandidate | null> {
        console.log(`[DirectWeb] Starting cycle...`);

        // Randomly pick a site to distribute load
        const site = this.sites[Math.floor(Math.random() * this.sites.length)];
        console.log(`[DirectWeb] Checking site: ${site.name}`);

        try {
            const response = await fetch(site.listUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                console.warn(`[DirectWeb] Failed to fetch list ${site.listUrl}: ${response.status}`);
                return null;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            const potentialLinks: string[] = [];
            $(site.linkSelector).each((_, el) => {
                let href = $(el).attr('href');
                if (href) {
                    if (href.startsWith('/')) {
                        const u = new URL(site.listUrl);
                        href = u.origin + href;
                    }
                    potentialLinks.push(href);
                }
            });

            // Find first valid
            for (const link of potentialLinks.slice(0, 5)) {
                const clean = normalizeUrl(link);
                // Skip ads or unrelated
                if (!clean.includes('prothomalo.com') && !clean.includes('kalerkantho.com')) continue;
                // Skip known non-article directories if needed (e.g. /topic/)

                // Return the candidate. 
                // Note: We do NOT fetch the body here. The Orchestrator will fetch the body using `fetchArticle`
                // This makes this step fast.
                return {
                    title: "", // Unknown until fetched
                    sourceUrl: link,
                    cleanUrl: clean,
                    sourceName: site.name,
                };
            }

        } catch (e) {
            console.error(`[DirectWeb] Error scraping ${site.name}:`, e);
        }

        return null;
    }
}
