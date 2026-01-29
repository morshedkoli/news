export interface ArticleCandidate {
    title: string;
    summary?: string;
    content?: string; // HTML or Text
    textContent?: string;
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
     * Fetch a single candidate article from this source.
     * Should return null if no valid candidate is found.
     */
    fetchCandidate(): Promise<ArticleCandidate | null>;
}
