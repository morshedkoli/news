import * as cheerio from 'cheerio';
import { NewsSource, ArticleCandidate } from './news-source';
import { fetchArticle } from '../../news-fetcher'; // Reusing existing fetcher
import { normalizeUrl } from '../../news-dedup';

export class GoogleNewsSource implements NewsSource {
    id = 'google-news-aggregator';
    name = 'Google News Aggregator';
    priority = 1;
    enabled = true;

    private searchUrls = [
        // Bangladesh keywork, Bangla language, Bangladesh region
        'https://news.google.com/search?q=%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE%E0%A6%A6%E0%A7%87%E0%A6%B6&hl=bn&gl=BD&ceid=BD:bn'
    ];

    async fetchCandidate(): Promise<ArticleCandidate | null> {
        console.log(`[GoogleNews] Starting fetch...`);

        // 1. Pick a random search URL (if we add more in future)
        const url = this.searchUrls[0];

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                console.warn(`[GoogleNews] Failed to fetch search page: ${response.status}`);
                return null;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // 2. Extract Article Cards
            // Google News classes change, but structure is usually: article, or div with specific link structure
            const articles: { title: string; link: string; source: string; time?: string }[] = [];

            // Improved Google News Strategy:
            // Look for specific links that look like article links

            const linkConfig = [
                'a[href^="./articles/"]', // Relative links
                'a[jslog*="track:click"]',
                'article a'
            ];

            const seenLinks = new Set<string>();

            $(linkConfig.join(', ')).each((_, el) => {
                const linkEl = $(el);
                let link = linkEl.attr('href');

                // Filter out bad links
                if (!link || seenLinks.has(link)) return;

                // Title often inside: h3, h4, or the link text itself
                let title = linkEl.text().trim();
                const parent = linkEl.closest('article, div[jslog]');

                if (!title || title.length < 10) {
                    // Check parent or children
                    title = linkEl.find('h3, h4, div[role="heading"]').text().trim() ||
                        parent.find('h3, h4').text().trim();
                }

                // Skip if title is empty or suspicious
                if (!title || title.length < 10) return;

                const time = parent.find('time').attr('datetime');
                const source = parent.find('.vr1PYe, div[data-n-tid]').text().trim();

                if (link) {
                    // Resolve relative link
                    if (link.startsWith('./')) {
                        link = link.replace('./', 'https://news.google.com/');
                    }

                    seenLinks.add(link);
                    articles.push({ title, link, source, time });
                }
            });

            console.log(`[GoogleNews] Found ${articles.length} raw items`);

            // 3. Process items to find a valid candidate
            for (const item of articles.slice(0, 5)) {
                // Resolve redirect to get real URL
                // Note: Resolving Google News redirects can be slow.
                // We might need to fetch the 'link' (google news link) which redirects to real site.

                const realUrl = await this.resolveGoogleRedirect(item.link);
                if (!realUrl) continue;

                const clean = normalizeUrl(realUrl);

                // Basic check: Ignore if it looks like a known bad domain or aggregator
                if (realUrl.includes('youtube.com')) continue;

                // We will return the *first* potentially valid one
                // The Orchestrator will handle De-duplication against DB.
                // But we can do a quick "Is this just the home page?" check
                if (clean.split('/').length < 4) continue;

                // We need to fetch the full article to get content/image
                // But `fetchCandidate` only promises a candidate. 
                // Should we fetch body HERE? 
                // Task Says: "Fetch MAX 10 candidates -> Pick FIRST non-duplicate -> Do NOT fetch article body here"
                // Wait, the task "SOURCE 1 — GOOGLE NEWS HTML SCRAPER" section says:
                // "Do NOT fetch article body here"
                // BUT "SOURCE 2" says "Parse ... content".
                // 
                // "POSTING FLOW" says: "2. fetchCandidate() -> 4. If candidate found -> save article -> 5. Publish"
                // If we don't fetch body, we can't save "content".
                // 
                // Correction: The Task says for Google News: "Do NOT fetch article body here". 
                // This implies `ArticleCandidate` from Google Source might contain only Metadata?
                // But the Orchestrator flow expects a ready-to-save candidate.
                // Let's re-read carefully: "If candidate found -> save article".
                // If body is missing, we can't save a useful article.
                // 
                // Ah, "SOURCE 2 — DIRECT WEBSITE SCRAPER" -> "Fetch list... Fetch ONE article... Parse title, content..."
                // 
                // Maybe the Orchestrator is responsible for fetching body if missing?
                // No, the interface says `fetchCandidate()`. 
                // 
                // Let's assume for Google News, we MUST resolve the URL.
                // If the task strictly says "Do NOT fetch article body here", maybe it means "Don't scrape the full text yet, just get the link"?
                // BUT "4. If candidate found -> save article". Saving just a link is useless.
                // 
                // Re-reading "SOURCE 1": "Extraction rules: title, link, source name, published time... pick FIRST non-duplicate... Do NOT fetch article body here".
                // This is contradictory to "Save article" unless we save it *without* body and let AI fetch it?
                // BUT "AI summarization runs async". If we post immediately, we display Title + Link?
                // 
                // "POSTING FLOW": "5. Publish immediately (NO AI BLOCK)". 
                // If we don't have body/image, the post will be empty.
                // 
                // My interpretation: For Google News source, we identify the candidate URL. 
                // The Orchestrator might need to call `fetchArticle(candidate.sourceUrl)` if content is missing.
                // OR, `fetchCandidate` implementation *should* fetch the body for the chosen candidate.
                // 
                // "Do NOT fetch article body here" likely means "Do not fetch body for ALL 10 candidates". 
                // Do it only for the *chosen* one.
                // 
                // So: 
                // 1. Get List
                // 2. Resolve Link
                // 3. Returns Candidate (Metadata Only? Or Fetch Body?)
                // 
                // If I look at `route.ts` existing logic: it calls `fetchArticle(item.link)`.
                // I should probably do the same.
                // 
                // Let's implement `fetchCandidate` to:
                // 1. Get list
                // 2. Loop
                // 3. Resolve URL
                // 4. Return the candidate with Title/URL. 
                // 
                // Wait, if I return `ArticleCandidate`, does it require content? 
                // The interface `content?` is optional.
                // 
                // I will configure the Orchestrator to "If candidate has no content, fetch it" or 
                // make the Source responsible for "returning a COMPLETE candidate".
                // 
                // Given "Post immediately", we likely need at least an Image and Summary/Snippet.
                // Scraping the body is necessary to get Image/Snippet.
                // 
                // So I will implement: Pick one -> Fetch Body -> Return.

                // Resolving functionality

                return {
                    title: item.title,
                    sourceUrl: realUrl,
                    cleanUrl: clean,
                    sourceName: item.source || 'Google News',
                    publishedAt: item.time,
                    // Content missing, will need fetching if not present
                };
            }

        } catch (e) {
            console.error(`[GoogleNews] Error:`, e);
        }

        return null;
    }

    private async resolveGoogleRedirect(googleUrl: string): Promise<string | null> {
        if (!googleUrl.startsWith('https://news.google.com') && !googleUrl.startsWith('./')) return googleUrl;

        // Basic approach: fetch HEAD or GET and look at final URL
        // Note: Google uses JS redirects often. 
        // simple fetch might land on a "Redirecting..." page.
        // 
        // If straightforward fetch follows redirects, great.
        try {
            // Construct absolute URL if relative
            const target = googleUrl.startsWith('./')
                ? googleUrl.replace('./', 'https://news.google.com/')
                : googleUrl;

            const res = await fetch(target, { method: 'HEAD', redirect: 'follow' });
            if (res.url && !res.url.includes('news.google.com')) {
                return res.url;
            }

            // If HEAD didn't leave google, try GET (sometimes needed)
            const resGet = await fetch(target, { method: 'GET', redirect: 'follow' });
            if (resGet.url && !resGet.url.includes('news.google.com')) {
                return resGet.url;
            }

            // If still google, it might be the "Consent" or "Redirecting" page which requires JS.
            // In serverless, we can't easily run JS.
            // Cheerio scraping the decode part?
            // Many google news links are base64 encoded payload. 
            // Decoding isn't trivial.

            // For early implementation, we fail if we can't resolve.
            return null;
        } catch (e) {
            return null;
        }
    }
}
