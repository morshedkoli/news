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

export async function fetchArticle(url: string): Promise<ArticleData | null> {
    try {
        // Dynamic Import to prevent serverless crash on module load and ensure bundling
        const { JSDOM } = await import("jsdom");
        const { Readability } = await import("@mozilla/readability");

        const response = await fetch(url, {
            // Safety: 15s timeout to prevent hanging serverless functions
            signal: AbortSignal.timeout(15000),
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",

                "Accept-Language": "en-US,en;q=0.9,bn;q=0.8",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            },
            referrerPolicy: "no-referrer",
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }

        const html = await response.text();
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

        if (!article) return null;

        return {
            title: article.title || "",
            content: article.content || "",
            textContent: article.textContent || "",
            excerpt: article.excerpt || "",
            byline: article.byline || "",
            siteName: siteName || "",
            image: ogImage || null,
        };
    } catch (error) {
        console.error("Error fetching article:", error);
        return null;
    }
}
