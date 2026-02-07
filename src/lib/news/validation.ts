import { ArticleCandidate } from './sources/news-source';

export interface ValidationResult {
    isValid: boolean;
    blockReasons: string[];
}

/**
 * Checks if the text contains a significant portion of Bangla characters.
 * Strategy: Count Bangla Unicode characters (\u0980–\u09FF).
 * If Bangla characters are < 30% of total visible characters, return false.
 */
export function isBanglaText(text: string): boolean {
    if (!text || text.trim().length === 0) return false;

    // Count Bangla Characters (Range 0980-09FF)
    const banglaCount = (text.match(/[\u0980-\u09FF]/g) || []).length;

    // Count Total "Visible" Characters (excluding spaces/newlines)
    const totalVisible = text.replace(/\s/g, '').length;

    if (totalVisible === 0) return false;

    const ratio = banglaCount / totalVisible;
    return ratio >= 0.3; // 30% threshold
}

/**
 * List of phrases that indicate a non-final summary
 */
const INVALID_SUMMARY_PHRASES = [
    "pending summary",
    "summary coming soon",
    "processing",
    "ai processing",
    "generating summary",
    "summary unavailable",
    "click to read more"
];

export function validateNewsContent(candidate: ArticleCandidate): ValidationResult {
    const reasons: string[] = [];

    const summary = (candidate.summary || "").trim();
    const title = (candidate.title || "").trim();
    const content = (candidate.content || candidate.excerpt || "").trim();

    const hasEnglishLetters = (text: string) => /[A-Za-z]/.test(text);

    if (hasEnglishLetters(title) || hasEnglishLetters(summary)) {
        reasons.push("ENGLISH_DETECTED");
    }

    // 1. Check Title Language (Mandatory)
    // We check both title and summary. If either is mostly English, we block.
    if (!isBanglaText(title)) {
        reasons.push("TITLE_NOT_BANGLA");
    }

    // 2. Check Summary
    if (!summary) {
        reasons.push("SUMMARY_EMPTY");
    } else {
        const lowerSummary = summary.toLowerCase();
        let isPendingOrPlaceholder = false;

        // A. Check for phrases FIRST (Block even if length is short/long)
        for (const phrase of INVALID_SUMMARY_PHRASES) {
            if (lowerSummary.includes(phrase)) {
                reasons.push("SUMMARY_PENDING_OR_PLACEHOLDER");
                isPendingOrPlaceholder = true;
                break;
            }
        }

        // B. Check Length (Only if not already flagged as pending)
        // If it's pending, we don't care if it's too short (PENDING is the main reason)
        if (!isPendingOrPlaceholder && summary.length < 20) {
            reasons.push("SUMMARY_TOO_SHORT");
        }

        // C. Check Language (Only if not pending/short)
        // We only check language if we have enough content to judge.
        if (!isPendingOrPlaceholder && summary.length >= 20) {
            if (!isBanglaText(summary)) {
                reasons.push("SUMMARY_NOT_BANGLA");
            }
        }
    }

    return {
        isValid: reasons.length === 0,
        blockReasons: reasons
    };
}
