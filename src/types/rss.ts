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

// RSS Settings - Global state for configurable posting interval
export interface RssSettings {
    last_news_posted_at?: any; // Firestore Timestamp - Global interval tracker
    total_posts_today?: number;
    last_reset_date?: string; // For daily stats reset (YYYY-MM-DD)
    update_interval_minutes?: number; // Configurable posting interval (default 30)
    start_time?: string; // Start time in HH:MM format (e.g., "06:00")

    // Stats & Health
    consecutive_failed_runs?: number;
    last_successful_run?: any;
    avg_time_between_posts?: number;
    last_run_at?: any;

    // Cron request tracking
    cron_requests_count?: number;
}

// RSS Item from feed parsing
export interface RssItem {
    title: string;
    link: string;
    pubDate: string;
    description?: string;
}

export interface RssRunLog {
    run_id: string;
    started_at: string; // ISO
    finished_at: string; // ISO
    feeds_checked: number;
    items_checked: number;
    post_published: boolean;
    published_post_id?: string;
    skip_reasons: string[];
    ai_failures: number;
    ai_provider_used?: string;
    failsafe_activated: boolean;
    run_type?: 'live' | 'dry_run';
    duration_ms: number;
}
