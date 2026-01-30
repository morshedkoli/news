import { dbAdmin } from "@/lib/firebase-admin";
import { XMLParser } from "fast-xml-parser";
import { RssItem } from "@/types/rss";


export async function parseRssFeed(feedUrl: string): Promise<RssItem[]> {
    try {
        const response = await fetch(feedUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

// ... (keep earlier code)

export async function isDuplicateArticle(url: string): Promise<boolean> {
    const cleanUrl = normalizeUrl(url);
    try {
        const snapshot = await dbAdmin.collection("news")
            .where("source_url", "==", cleanUrl)
            .limit(1)
            .get();
        return !snapshot.empty;
    } catch (e) {
        console.error("Duplicate Check Error:", e);
        return false; // Fail safe
    }
}

export function calculateNextRun(startTimeStr: string, intervalMinutes: number, lastRun: Date | null): Date {
    const now = new Date();
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);

    // Create start time for today
    let nextRun = new Date(now);
    nextRun.setHours(startHour, startMinute, 0, 0);

    // If start time is in the past, add intervals until it's in the future
    // OR if we have a last run, project forward from there

    if (lastRun) {
        nextRun = new Date(lastRun.getTime() + intervalMinutes * 60000);
        // Catch up if falling behind, but don't go too far into future? 
        // Actually, strictly `lastRun + interval` is better for regularity, 
        // but if the system was down for days, we don't want to run 100 times instantly.
        // So: `Math.max(lastRun + interval, now)` is often safer for news, 
        // BUT strict interval is better for "Every 6 hours".

        // Strategy: If next scheduled run is in past, set it to NOW (catch up immediately)
        if (nextRun < now) {
            nextRun = now;
        }
    } else {
        // First run
        // If scheduled start time was earlier today, run NOW.
        // If scheduled start time is later today, run THEN.
        if (nextRun < now) {
            // It's 10:00, Start was 09:00. 
            // Should we run now? Yes.
            nextRun = now;
        }
    }

    return nextRun;
}
