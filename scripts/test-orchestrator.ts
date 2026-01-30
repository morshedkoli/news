import * as cheerio from 'cheerio';

async function runTest() {
    console.log('🧪 Debugging Kaler Kantho Scraper...');
    const url = 'https://www.kalerkantho.com/online/all-news';

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(10000)
        });

        console.log(`Status: ${response.status}`);
        if (!response.ok) return;

        const html = await response.text();
        console.log(`HTML Length: ${html.length}`);

        const $ = cheerio.load(html);
        const selector = 'h3 a, .title a';
        const found = $(selector).length;
        console.log(`Found elements matching '${selector}': ${found}`);

        if (found === 0) {
            console.log('Trying fallback selectors...');
            console.log("a tags found:", $('a').length);
            $('a').slice(0, 5).each((_, el) => {
                console.log('Link class:', $(el).attr('class'), 'Href:', $(el).attr('href'));
            });
        }

    } catch (e) {
        console.error(e);
    }
}

runTest();
