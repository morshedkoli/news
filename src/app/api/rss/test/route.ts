import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";

const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
    },
});

/**
 * POST /api/rss/test
 * Tests an RSS feed URL and returns sample items.
 * No authentication required for testing.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid URL' },
                { status: 400 }
            );
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            return NextResponse.json(
                { error: 'Invalid URL format' },
                { status: 400 }
            );
        }

        // Try to fetch and parse the feed
        const startTime = Date.now();
        const feed = await parser.parseURL(url);
        const latency = Date.now() - startTime;

        // Extract sample items
        const sampleItems = (feed.items || []).slice(0, 5).map(item => ({
            title: item.title || 'No title',
            link: item.link || '',
            pubDate: item.pubDate || item.isoDate || '',
            contentSnippet: item.contentSnippet?.substring(0, 150) || '',
        }));

        return NextResponse.json({
            success: true,
            title: feed.title || 'Unknown Feed',
            description: feed.description || '',
            itemCount: feed.items?.length || 0,
            sampleItems,
            latency,
            message: `Feed valid! Found ${feed.items?.length || 0} items.`
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("RSS test failed:", message);

        let errorMessage = 'Failed to fetch or parse feed';
        if (message.includes('timeout')) {
            errorMessage = 'Feed request timed out (10s limit)';
        } else if (message.includes('fetch')) {
            errorMessage = 'Could not fetch feed URL. Check if the URL is accessible.';
        } else if (message.includes('parse') || message.includes('xml')) {
            errorMessage = 'Invalid RSS/XML format. Ensure URL points to a valid RSS feed.';
        }

        return NextResponse.json(
            {
                success: false,
                error: errorMessage,
                details: message
            },
            { status: 400 }
        );
    }
}
