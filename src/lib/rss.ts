import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { XMLParser } from "fast-xml-parser";

interface RssItem {
    title: string;
    link: string;
    pubDate: string;
    description?: string;
}

export async function parseRssFeed(feedUrl: string): Promise<RssItem[]> {
    try {
        const response = await fetch(feedUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; BanglaNewsBot/1.0)",
            },
            signal: AbortSignal.timeout(10000) // 10s timeout
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch RSS: ${response.statusText}`);
        }

        const xmlData = await response.text();
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
        const result = parser.parse(xmlData);

        const channel = result.rss?.channel || result.feed;
        let items = channel?.item || channel?.entry || [];

        // Handle single item case (fast-xml-parser might return object instead of array)
        if (!Array.isArray(items)) {
            items = [items];
        }

        return items.map((item: any) => ({
            title: item.title,
            link: normalizeUrl(item.link || item.id || ""), // Atom feeds use id often as link
            pubDate: item.pubDate || item.published || item.updated || new Date().toISOString(),
            description: item.description || item.summary || ""
        })).filter((i: RssItem) => i.link && i.title);

    } catch (error) {
        console.error(`Error parsing RSS feed ${feedUrl}:`, error);
        return [];
    }
}

export function normalizeUrl(url: string): string {
    try {
        // Handle "link" object in some RSS feeds (e.g. Atom)
        if (typeof url === 'object' && url !== null) {
            // @ts-ignore
            url = url['#text'] || url['href'] || "";
        }

        let u = new URL(url);
        // Force HTTPS
        if (u.protocol === 'http:') u.protocol = 'https:';

        // Remove tracking params
        const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid'];
        paramsToRemove.forEach(p => u.searchParams.delete(p));

        // Start strip trailing slash
        let cleanUrl = u.toString();
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }

        return cleanUrl;
    } catch (e) {
        return url; // Return original if parsing fails
    }
}

export async function isDuplicateArticle(url: string): Promise<boolean> {
    const cleanUrl = normalizeUrl(url);
    const newsRef = collection(db, "news");
    const q = query(newsRef, where("source_url", "==", cleanUrl), limit(1));
    const snapshot = await getDocs(q);

    return !snapshot.empty;
}
