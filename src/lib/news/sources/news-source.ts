export interface ArticleCandidate {
    title: string;
    summary?: string;
    content?: string; // HTML or Text
    textContent?: string;
    excerpt?: string;
    image?: string;
    sourceUrl: string; // The specific article URL
    cleanUrl: string;  // Normalized URL
    sourceName: string;
    publishedAt?: string;

    // Metadata
    score?: number;
    category?: string;

    // RSS Specific configuration passed back
    feedId?: string;
    cooldownMinutes?: number;
}

export interface NewsSource {
    id: string;
    priority: number; // Lower is higher priority (1 = Top)
    enabled: boolean;
    name: string;

    /**
     * Fetch candidate articles from this source.
     * Returns an array of candidates, sorted by relevance/date.
     */
    fetchCandidates(): Promise<ArticleCandidate[]>;
}
