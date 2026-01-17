// import { Readability } from "@mozilla/readability";
// import { JSDOM } from "jsdom";

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
        console.log(`📡 Fetching article: ${url}`);

        // Dynamic Import to prevent serverless crash on module load
        const { JSDOM } = await import("jsdom");
        const { Readability } = await import("@mozilla/readability");

        const response = await fetch(url, {
            // Safety: 15s timeout
            signal: AbortSignal.timeout(15000),
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,bn;q=0.8",
            },
            referrerPolicy: "no-referrer",
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

        const dom = new JSDOM(html, { url });
        const doc = dom.window.document;

        // Extract OpenGraph Image
        const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
            doc.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ||
            null;

        // Extract Site Name
        const siteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ||
            new URL(url).hostname;

        const reader = new Readability(doc);
        const article = reader.parse();

        if (!article) {
            return { success: false, error: "Readability failed to parse content" };
        }

        return {
            success: true,
            data: {
                title: article.title || "",
                content: article.content || "",
                textContent: article.textContent || "",
                excerpt: article.excerpt || "",
                byline: article.byline || "",
                siteName: siteName || "",
                image: ogImage || null,
            }
        };
    } catch (error: any) {
        console.error("Error fetching article:", error);
        return {
            success: false,
            error: error.name === 'AbortError' ? 'Request Timed Out (15s)' : error.message
        };
    }
}
