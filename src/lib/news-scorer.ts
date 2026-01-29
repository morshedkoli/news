import { differenceInHours } from "date-fns";

interface ScoredNews {
    score: number;
    shouldNotify: boolean;
    breakdown: {
        keywordScore: number;
        sourceScore: number;
        titleScore: number;
        impactScore: number;
        timeScore: number;
    };
}

// 1. Keyword Lists
const KEYWORDS = {
    CRITICAL: [
        "জরুরি", "ব্রেকিং", "ফাঁস", "নিহত", "আহত", "ভূমিকম্প", "আগুন",
        "লকডাউন", "কারফিউ", "শাটডাউন", "ধর্মঘট", "স্থগিত", "বাতিল"
    ],
    IMPORTANT: [
        "সরকার", "প্রধানমন্ত্রী", "সংসদ", "বাজেট", "দাম", "জ্বালানি",
        "ব্যাংক", "আদালত", "রায়", "শুনানি", "নির্বাচন", "ইসি",
        "ভর্তুকি", "রপ্তানি", "রেমিট্যান্স", "আহাওয়া", "ঘূর্ণিঝড়", "বন্যা",
        "ডেঙ্গু", "করোনা", "ভ্যাকসিন"
    ],
    CLICKBAIT: [
        "চমক", "ভাইরাল", "অবিশ্বাস্য", "দেখুন", "জানুন", "কি করলেন",
        "ভিডিও", "তোলপাড়", "বোমা"
    ]
};

// 2. Source Credibility Tiers
const SOURCE_TIERS: Record<string, number> = {
    "prothomalo.com": 20,
    "bbc.com": 20,
    "kalera-kantho.com": 20,
    "dailystar.net": 20,
    "bdnews24.com": 20,
    "banglatribune.com": 10,
    "jagonews24.com": 10,
    "dhakapost.com": 10,
    "somoynews.tv": 10,
    // Add more as needed, defaults to 5
};

export function calculateImportanceScore(
    title: string,
    summary: string,
    sourceUrl: string,
    publishedAt: Date | string
): ScoredNews {
    let keywordScore = 0;
    let sourceScore = 0;
    let titleScore = 0;
    let impactScore = 0;
    let timeScore = 0;

    const lowerTitle = title.toLowerCase();
    const sourceHostname = new URL(sourceUrl).hostname.replace('www.', '');

    // 1. Keyword Signal (Max 30)
    let matchedKeywords = 0;
    KEYWORDS.CRITICAL.forEach(k => {
        if (lowerTitle.includes(k)) matchedKeywords += 2;
    });
    KEYWORDS.IMPORTANT.forEach(k => {
        if (lowerTitle.includes(k)) matchedKeywords += 1;
    });
    keywordScore = Math.min(30, matchedKeywords * 5); // 5 points per hit, capped at 30

    // 2. Source Credibility (Max 20)
    sourceScore = SOURCE_TIERS[sourceHostname] || 5;

    // 3. Title Structure (Max 15)
    const wordCount = title.split(/\s+/).length;
    let hasClickbait = KEYWORDS.CLICKBAIT.some(k => lowerTitle.includes(k));

    if (!hasClickbait) {
        if (wordCount >= 4 && wordCount <= 12) titleScore += 10; // Concise
        else if (wordCount > 12) titleScore += 5; // Maybe too long
    } else {
        titleScore = 0; // Penalty for clickbait
    }
    // Boost for numeric facts in title (e.g. "50 killed", "100 taka up")
    if (/\d+/.test(title)) titleScore = Math.min(15, titleScore + 5);


    // 4. Content Impact (Max 25) - Heuristic based on summary text
    // We assume the summary contains keywords indicating scope
    const impactKeywords = ["সারাদেশ", "জাতীয়", "সারা দেশ", "সমগ্র", "সকল জেলা"];
    const highImpact = impactKeywords.some(k => summary.includes(k));

    if (highImpact) impactScore = 25;
    else impactScore = 10; // Default baseline

    // 5. Time Sensitivity (Max 10)
    const hoursSincePub = differenceInHours(new Date(), new Date(publishedAt));
    if (hoursSincePub < 2) timeScore = 10;
    else if (hoursSincePub < 6) timeScore = 5;
    else timeScore = 0;

    const totalScore = keywordScore + sourceScore + titleScore + impactScore + timeScore;

    return {
        score: totalScore,
        shouldNotify: totalScore >= 70,
        breakdown: {
            keywordScore,
            sourceScore,
            titleScore,
            impactScore,
            timeScore
        }
    };
}
