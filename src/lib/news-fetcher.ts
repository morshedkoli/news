import * as cheerio from 'cheerio';

export interface ArticleData {
    title: string;
    content: string; // HTML
    textContent: string;
    excerpt: string;
    byline: string;
    siteName: string;
    image: string | null;
    category: string | null; // Auto-detected from article metadata
}

export type FetchResult =
    | { success: true; data: ArticleData }
    | { success: false; error: string; details?: any };

/**
 * Category mapping from English/URL patterns to Bangla
 */
const CATEGORY_MAP: Record<string, string> = {
    // English to Bangla - Common categories
    'general': 'সাধারণ',
    'news': 'সাধারণ',
    'latest': 'সাধারণ',
    'breaking': 'সাধারণ',
    'top': 'সাধারণ',
    'featured': 'সাধারণ',
    'home': 'সাধারণ',

    // Sports
    'sports': 'খেলাধুলা',
    'sport': 'খেলাধুলা',
    'cricket': 'খেলাধুলা',
    'football': 'খেলাধুলা',
    'games': 'খেলাধুলা',

    // Politics
    'politics': 'রাজনীতি',
    'political': 'রাজনীতি',
    'government': 'রাজনীতি',
    'election': 'রাজনীতি',

    // Technology
    'technology': 'প্রযুক্তি',
    'tech': 'প্রযুক্তি',
    'gadgets': 'প্রযুক্তি',
    'digital': 'প্রযুক্তি',
    'it': 'প্রযুক্তি',

    // Entertainment
    'entertainment': 'বিনোদন',
    'showbiz': 'বিনোদন',
    'movies': 'বিনোদন',
    'music': 'বিনোদন',
    'celebrity': 'বিনোদন',
    'bollywood': 'বিনোদন',
    'dhallywood': 'বিনোদন',

    // Economy/Business
    'business': 'অর্থনীতি',
    'economy': 'অর্থনীতি',
    'finance': 'অর্থনীতি',
    'market': 'অর্থনীতি',
    'stock': 'অর্থনীতি',
    'banking': 'অর্থনীতি',

    // Health
    'health': 'স্বাস্থ্য',
    'medical': 'স্বাস্থ্য',
    'medicine': 'স্বাস্থ্য',
    'healthcare': 'স্বাস্থ্য',

    // Science
    'science': 'বিজ্ঞান',
    'research': 'বিজ্ঞান',
    'space': 'বিজ্ঞান',

    // Education
    'education': 'শিক্ষা',
    'campus': 'শিক্ষা',
    'university': 'শিক্ষা',
    'school': 'শিক্ষা',

    // International
    'international': 'আন্তর্জাতিক',
    'world': 'আন্তর্জাতিক',
    'global': 'আন্তর্জাতিক',
    'foreign': 'আন্তর্জাতিক',
    'asia': 'আন্তর্জাতিক',
    'europe': 'আন্তর্জাতিক',
    'america': 'আন্তর্জাতিক',
    'middle-east': 'আন্তর্জাতিক',

    // National
    'national': 'জাতীয়',
    'bangladesh': 'জাতীয়',
    'country': 'জাতীয়',
    'dhaka': 'জাতীয়',
    'local': 'জাতীয়',

    // Lifestyle
    'lifestyle': 'জীবনযাত্রা',
    'life': 'জীবনযাত্রা',
    'living': 'জীবনযাত্রা',
    'fashion': 'জীবনযাত্রা',
    'food': 'জীবনযাত্রা',
    'travel': 'জীবনযাত্রা',

    // Opinion
    'opinion': 'মতামত',
    'editorial': 'সম্পাদকীয়',
    'column': 'মতামত',
    'letters': 'মতামত',

    // Crime
    'crime': 'অপরাধ',
    'law': 'অপরাধ',
    'court': 'অপরাধ',
    'police': 'অপরাধ',

    // Environment
    'environment': 'পরিবেশ',
    'climate': 'পরিবেশ',
    'weather': 'পরিবেশ',

    // Religion
    'religion': 'ধর্ম',
    'islam': 'ধর্ম',
    'religious': 'ধর্ম',

    // Bangla categories (already in Bangla)
    'সাধারণ': 'সাধারণ',
    'খেলাধুলা': 'খেলাধুলা',
    'রাজনীতি': 'রাজনীতি',
    'প্রযুক্তি': 'প্রযুক্তি',
    'বিনোদন': 'বিনোদন',
    'অর্থনীতি': 'অর্থনীতি',
    'স্বাস্থ্য': 'স্বাস্থ্য',
    'বিজ্ঞান': 'বিজ্ঞান',
    'শিক্ষা': 'শিক্ষা',
    'আন্তর্জাতিক': 'আন্তর্জাতিক',
    'জাতীয়': 'জাতীয়',
    'জীবনযাত্রা': 'জীবনযাত্রা',
    'মতামত': 'মতামত',
    'সম্পাদকীয়': 'সম্পাদকীয়',
    'অপরাধ': 'অপরাধ',
    'পরিবেশ': 'পরিবেশ',
    'ধর্ম': 'ধর্ম',
};

/**
 * Extract category from article metadata and URL
 */
function extractCategory($: cheerio.CheerioAPI, url: string): string | null {
    // 1. Try article:section meta tag (most reliable)
    let category = $('meta[property="article:section"]').attr('content');
    if (category) {
        category = category.trim().toLowerCase();
        const mapped = CATEGORY_MAP[category];
        if (mapped) return mapped;
    }

    // 2. Try og:article:section
    category = $('meta[property="og:article:section"]').attr('content');
    if (category) {
        category = category.trim().toLowerCase();
        const mapped = CATEGORY_MAP[category];
        if (mapped) return mapped;
    }

    // 3. Try article:tag (sometimes used for category)
    category = $('meta[property="article:tag"]').attr('content');
    if (category) {
        category = category.trim().toLowerCase();
        const mapped = CATEGORY_MAP[category];
        if (mapped) return mapped;
    }

    // 4. Try category meta tag
    category = $('meta[name="category"]').attr('content');
    if (category) {
        category = category.trim().toLowerCase();
        const mapped = CATEGORY_MAP[category];
        if (mapped) return mapped;
    }

    // 5. Try to extract from URL path
    // Common patterns: /sports/article, /category/sports/article, /bn/sports/article
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);

        // Check each path segment
        for (const part of pathParts) {
            const normalized = part.toLowerCase();
            const mapped = CATEGORY_MAP[normalized];
            if (mapped) return mapped;
        }
    } catch (e) {
        // Invalid URL, skip
    }

    // 6. Try breadcrumb navigation
    const breadcrumbs = $('.breadcrumb a, .breadcrumbs a, [class*="breadcrumb"] a');
    breadcrumbs.each((_, el) => {
        const text = $(el).text().trim().toLowerCase();
        const mapped = CATEGORY_MAP[text];
        if (mapped && !category) {
            category = mapped;
            return false; // Break loop
        }
    });
    if (category) return category;

    // 7. Try category links/tags in article
    const categoryLinks = $('a[rel="category"], .category a, .categories a, [class*="category"] a');
    categoryLinks.each((_, el) => {
        const text = $(el).text().trim().toLowerCase();
        const mapped = CATEGORY_MAP[text];
        if (mapped && !category) {
            category = mapped;
            return false; // Break loop
        }
    });
    if (category) return category;

    // No category found
    return null;
}


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

        // Extract Category from multiple sources
        const category = extractCategory($, url);

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
            image: ogImage,
            category: category
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
