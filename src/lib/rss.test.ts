import { describe, it, expect, vi } from 'vitest';
import { isTimeWindowAllowed } from './rss-time-utils';
import { normalizeUrl, generateUrlHash, generateContentHash } from './news-dedup';

// Mock Date for consistent testing
const MOCK_DATE = '2024-03-20T10:00:00.000Z'; // UTC

describe('RSS Time Window', () => {
    it('should allow if current time is after start time', () => {
        // Mock current time: 10:00 AM UTC -> 4:00 PM BD (16:00)
        // Start time: 06:00
        vi.setSystemTime(new Date(MOCK_DATE));
        const result = isTimeWindowAllowed(new Date(), '06:00', 'Asia/Dhaka');
        expect(result.allowed).toBe(true);
    });

    it('should block if current time is before start time', () => {
        // Mock time: 10:00 AM UTC -> 4:00 PM BD
        // If we set start time to 17:00 (5 PM), it should block.
        vi.setSystemTime(new Date(MOCK_DATE));
        const result = isTimeWindowAllowed(new Date(), '17:00', 'Asia/Dhaka');
        expect(result.allowed).toBe(false);
    });
});

describe('RSS Deduplication', () => {
    it('should normalize URLs correctly', () => {
        const raw = "https://example.com/news/article?utm_source=rss&ref=123";
        const normalized = normalizeUrl(raw);
        expect(normalized).toBe("https://example.com/news/article");
    });

    it('should generate consistent URL hashes', () => {
        const url1 = "https://example.com/1";
        const url2 = "https://example.com/1";
        expect(generateUrlHash(url1)).toBe(generateUrlHash(url2));
    });

    it('should detect similar content via hash', () => {
        const content1 = "This is a breaking news story about testing.";
        const content2 = "This is a breaking news story about testing. "; // trailing space
        expect(generateContentHash(content1)).toBe(generateContentHash(content2));
    });
});

describe('AI Fallback Logic (Simulation)', () => {
    // Replicating the logic from route.ts to verify the algorithm behaves as expected
    const algorithm = (candidates: any[]) => {
        // Filter valid
        // Sort by score DESC
        const sorted = [...candidates].sort((a, b) => b.score - a.score);
        const best = sorted[0];

        // Strategy: Cap score at 60, Category = साधारण
        return {
            ...best,
            score: Math.min(best.score, 60),
            category: "সাধারণ"
        };
    };

    it('should cap the score and force category for fallback items', () => {
        const candidates = [
            { title: "Mediocre News", score: 55, category: "খেলাধুলা" },
            { title: "Better News", score: 65, category: "রাজনীতি" }
        ];

        const result = algorithm(candidates);

        expect(result.title).toBe("Better News");
        expect(result.score).toBe(60); // 65 capped to 60
        expect(result.category).toBe("সাধারণ"); // Forced general
    });

    it('should keep score if already low', () => {
        const candidates = [
            { title: "Bad News", score: 40, category: "খেলাধুলা" }
        ];

        const result = algorithm(candidates);
        expect(result.score).toBe(40); // 40 < 60, stays 40
        expect(result.category).toBe("সাধারণ");
    });
});
