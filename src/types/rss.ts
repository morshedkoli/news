// RSS Feed interface - Simplified for global 30-minute interval system
export interface RssFeed {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    category?: string;
    priority: number; // Higher number = higher priority (default 10)

    // State Tracking
    last_checked_at?: any; // Firestore Timestamp
    last_success_at?: any; // Firestore Timestamp
    cooldown_until?: any; // Firestore Timestamp (30 min after success)
    failure_count?: number;
    error_log?: string;
}

// RSS Settings - Global state for 30-minute posting interval
export interface RssSettings {
    last_news_posted_at?: any; // Firestore Timestamp - Global 30-minute tracker
    total_posts_today?: number;
    last_reset_date?: string; // For daily stats reset (YYYY-MM-DD)
}

// RSS Item from feed parsing
export interface RssItem {
    title: string;
    link: string;
    pubDate: string;
    description?: string;
}
