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
    generatedSummary: string = ''
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

    // 3. Semantic Check (If summary exists)
    // Query recent news (last 48h) to compare summaries
    if (generatedSummary) {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const recentNews = await dbAdmin.collection('news')
            .where('published_at', '>=', twoDaysAgo.toISOString())
            .get();

        for (const doc of recentNews.docs) {
            const data = doc.data() as NewsArticle;
            // Only check semantic similarity if we have a summary to compare
            if (data.summary) {
                const score = calculateSimilarity(generatedSummary, data.summary);
                if (score > 0.6) { // 60% similarity threshold for bigrams is quite high/strict
                    return { isDuplicate: true, type: 'semantic', originalId: doc.id, confidence: score };
                }
            }
        }
    }

    return { isDuplicate: false, type: 'none', confidence: 0 };
}
