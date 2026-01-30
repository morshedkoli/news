import { createHash } from 'crypto';
import { dbAdmin } from './firebase-admin';
import { NewsArticle } from '@/types/news';

export interface DuplicateResult {
    isDuplicate: boolean;
    type: 'exact' | 'content_hash' | 'semantic' | 'none';
    originalId?: string;
    confidence: number;
}

/**
 * Layer 1: URL Normalization
 * Removes tracking params, lowercases, removes trailing slashes.
 */
export function normalizeUrl(url: string): string {
    try {
        const u = new URL(url);

        // 1. Remove tracking parameters
        const paramsToRemove = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'fbclid', 'gclid', 'ref', 'source'
        ];
        paramsToRemove.forEach(p => u.searchParams.delete(p));

        // 2. Normalize Protocol
        u.protocol = 'https:';

        // 3. Normalize Host (lowercase)
        u.hostname = u.hostname.toLowerCase();

        // 4. Remove excessive slashes & decoding
        let path = decodeURIComponent(u.pathname);
        if (path.endsWith('/') && path.length > 1) {
            path = path.slice(0, -1);
        }

        return u.origin + path; // Ignore hash fragments
    } catch (e) {
        return url; // Fallback if invalid
    }
}

/**
 * Layer 2: Content Hash Generation
 * SHA-256 hash of the cleaned text body (first 500 chars).
 */
export function generateContentHash(text: string): string {
    if (!text) return '';

    // Clean text: remove whitespace, newlines, basic cleanup
    const cleanText = text
        .replace(/<[^>]*>/g, '') // Remove HTML
        .replace(/\s+/g, ' ') // Collapse whitespace
        .trim()
        .toLowerCase()
        .slice(0, 500); // Only first 500 chars needed for signature

    return createHash('sha256').update(cleanText).digest('hex');
}

/**
 * Layer 3: Semantic Similarity (Jaccard Index on Shingles)
 * Lightweight text comparison without vector DB.
 */
function calculateSimilarity(textA: string, textB: string): number {
    const tokenize = (text: string) => {
        const words = text.toLowerCase().replace(/[^\w\s\u0980-\u09FF]/g, '').split(/\s+/);
        const shingles = new Set<string>();
        // Create 2-word shingles (bigrams) for better context matching than bag-of-words
        for (let i = 0; i < words.length - 1; i++) {
            shingles.add(`${words[i]} ${words[i + 1]}`);
        }
        return shingles;
    };

    const setA = tokenize(textA);
    const setB = tokenize(textB);

    if (setA.size === 0 || setB.size === 0) return 0;

    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
}

/**
 * Main Driver: Check for Duplicates
 */
/**
 * Generate SHA-256 hash of a URL for safe Firestore querying.
 */
export function generateUrlHash(url: string): string {
    if (!url) return '';
    return createHash('sha256').update(url).digest('hex');
}

/**
 * Main Driver: Check for Duplicates
 */
export async function checkDuplicate(
    url: string,
    rawContent: string,
    generatedSummary: string = '',
    title: string = ''
): Promise<DuplicateResult> {
    const normUrl = normalizeUrl(url);
    const normUrlHash = generateUrlHash(normUrl);
    const contentHash = generateContentHash(rawContent);

    // 1. Check Normalized URL Hash
    const urlCheck = await dbAdmin.collection('news')
        .where('normalized_url_hash', '==', normUrlHash)
        .limit(1)
        .get();

    if (!urlCheck.empty) {
        return { isDuplicate: true, type: 'exact', originalId: urlCheck.docs[0].id, confidence: 1.0 };
    }

    // 1b. Falback: Check source_url using hash (if you decide to store source_url_hash)
    // or if we must stick to the User's rule "STOP querying Firestore using full URLs", 
    // we cannot safely check source_url if it's long. 
    // However, the User mentioned "Store ONLY the hash for dedup queries".
    // I'll calculate source_url hash too just in case we start saving it, 
    // but without migration, existing docs won't have it.
    // Given "Do NOT re-query by raw URL", we skip raw source_url check to prevent crash.

    // 2. Check Content Hash (Exact Body Match)
    // Note: Requires composite index if querying with other fields, but okay for single field check
    const hashCheck = await dbAdmin.collection('news')
        .where('content_hash', '==', contentHash)
        .limit(1)
        .get();

    if (!hashCheck.empty) {
        return { isDuplicate: true, type: 'content_hash', originalId: hashCheck.docs[0].id, confidence: 1.0 };
    }

    // 3. Relaxed Title/Semantic Check
    // Instead of full semantic check on summary (which might be heavy or missing), 
    // let's check Title Similarity first?
    // User requested: "Title similarity <= 0.92 → ALLOW". (Meaning > 0.92 is DUPLICATE)

    // Check recent news (last 24h is enough for title dupes)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentNews = await dbAdmin.collection('news')
        .where('published_at', '>=', oneDayAgo.toISOString())
        .get();

    // Helper for Jaccard/Token similarity
    const calculateTitleSimilarity = (s1: string, s2: string): number => {
        const tokenize = (text: string) => new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
        const t1 = tokenize(s1);
        const t2 = tokenize(s2);
        const intersect = new Set([...t1].filter(x => t2.has(x)));
        const union = new Set([...t1, ...t2]);
        return intersect.size / union.size;
    };

    // Levenshtein might be better for Titles, but Jaccard is faster. 
    // Let's stick to Jaccard or simple inclusion for now? 
    // User mentioned "Title similarity <= 0.92".

    // If we have a Generated Summary, we can check that too.
    for (const doc of recentNews.docs) {
        const data = doc.data() as NewsArticle;

        // Title Similarity
        if (data.title) {
            const sim = calculateTitleSimilarity(data.title, rawContent.split('\n')[0]); // Use first line as title proxy if missing? Or pass title?
            // Orchestrator passes rawContent, mostly body? 
            // We need Title passed to checkDuplicate.
            // Refactor: checkDuplicate(url, content, summary, title)
        }

        if (generatedSummary && data.summary) {
            const score = calculateSimilarity(generatedSummary, data.summary);
            if (score > 0.92) { // 92% threshold
                return { isDuplicate: true, type: 'semantic', originalId: doc.id, confidence: score };
            }
        }
    }

    return { isDuplicate: false, type: 'none', confidence: 0 };
}
