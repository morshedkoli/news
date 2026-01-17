import * as cheerio from 'cheerio';

export interface ArticleData {
    title: string;
    content: string; // HTML
    textContent: string;
    excerpt: string;
    byline: string;
    siteName: string;
    image: string | null;
}

export type FetchResult =
    | { success: true; data: ArticleData }
    | { success: false; error: string; details?: any };

export async function fetchArticle(url: string): Promise<FetchResult> {
    try {
        console.log(`📡 Fetching article (Cheerio): ${url}`);

        const response = await fetch(url, {
            signal: AbortSignal.timeout(15000), // 15s Timeout
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,bn;q=0.8",
            },
        });

        if (!response.ok) {
            const msg = `Target site returned HTTP ${response.status}`;
            console.warn(msg, url);
            return { success: false, error: msg };
        }

        const html = await response.text();
        if (!html || html.length < 100) {
            return { success: false, error: "Received empty or too short content" };
        }

        // LOAD CHEERIO
        const $ = cheerio.load(html);

        // 1. Remove Trash (Scripts, Styles, Ads)
        $('script, style, iframe, noscript, nav, header, footer, svg, .ad, .ads, .social-share, .comments').remove();

        // 2. Extract Metadata
        const title =
            $('meta[property="og:title"]').attr('content') ||
            $('title').text() ||
            "";

        const ogImage =
            $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            null;

        const siteName =
            $('meta[property="og:site_name"]').attr('content') ||
            new URL(url).hostname;

        // 3. Extract Main Content (Heuristic)
        // Try common selectors for news sites
        let contentEl = $('article');
        if (contentEl.length === 0) contentEl = $('main');
        if (contentEl.length === 0) contentEl = $('.content');
        if (contentEl.length === 0) contentEl = $('#content');
        if (contentEl.length === 0) contentEl = $('.main');
        if (contentEl.length === 0) contentEl = $('.post-body');
        if (contentEl.length === 0) contentEl = $('.entry-content');

        // Fallback: Use Body but be careful
        if (contentEl.length === 0) contentEl = $('body');

        // Get inner HTML and Text
        const contentHtml = contentEl.html() || "";
        let textContent = contentEl.text();

        // 4. Normalize Whitespace
        textContent = textContent.replace(/\s+/g, ' ').trim();

        // 5. Generate Excerpt
        const excerpt = textContent.slice(0, 300) + (textContent.length > 300 ? "..." : "");

        const articleData: ArticleData = {
            title: title.trim(),
            content: contentHtml,
            textContent: textContent,
            excerpt: excerpt,
            byline: "", // Hard to extract reliably without Readability
            siteName: siteName,
            image: ogImage
        };

        if (textContent.length < 50) {
            return { success: false, error: "Extracted content is too short (possible parsing failure)" };
        }

        return {
            success: true,
            data: articleData
        };

    } catch (error: any) {
        console.error("Error fetching article:", error);
        return {
            success: false,
            error: error.name === 'AbortError' ? 'Request Timed Out (15s)' : error.message
        };
    }
}
