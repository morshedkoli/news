export interface RelatedSource {
    source_name: string;
    source_url: string;
    published_at: string;
}

export interface NewsArticle {
    id?: string;
    title: string;
    summary: string;
    content?: string; // Full content or snippet
    image?: string;

    // Source Info
    source_name: string;
    source_url: string;
    published_at: string;

    // Deduplication Fields
    normalized_url: string;
    content_hash: string;

    is_duplicate: boolean;
    duplicate_of?: string | null; // ID of the original article
    related_sources?: RelatedSource[];

    // Metadata
    created_at?: string; // Firestore Timestamp or ISO string
    category?: string;
    importance_score?: number;
}
