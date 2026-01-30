import { XMLParser } from "fast-xml-parser";

async function runTest() {
    console.log('🧪 Testing RSS Fetch...');
    const feedUrl = 'https://www.prothomalo.com/feed/';

    try {
        console.log(`Fetching ${feedUrl}...`);
        const response = await fetch(feedUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            signal: AbortSignal.timeout(10000)
        });

        console.log(`Status: ${response.status}`);
        if (!response.ok) {
            console.log('Body:', await response.text());
            return;
        }

        const xmlData = await response.text();
        console.log(`XML Length: ${xmlData.length}`);

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
        const result = parser.parse(xmlData);

        const channel = result.rss?.channel || result.feed;
        let items = channel?.item || channel?.entry || [];

        if (!Array.isArray(items)) items = [items];

        console.log(`Found ${items.length} items.`);
        if (items.length > 0) {
            console.log('First item:', items[0].title);
        }

    } catch (e) {
        console.error(e);
    }
}

runTest();
