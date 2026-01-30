// RSS Feed interface - Simplified for global 30-minute interval system
// RSS Feed interface - Enhanced for robust tracking
export interface RssFeed {
    id: string;
    source_name: string; // Display Name (was name)
    rss_url: string;     // URL (was url)
    enabled: boolean;
    priority: number;    // 1-10

    // Metadata
    language: 'bn' | 'en';
    country: 'BD' | 'US' | 'INTL';
    source_type: 'direct' | 'aggregator'; // Aggregator needs stronger dedupe
    category?: string;

    // Configuration
    cooldown_minutes: number; // Waiting time between fetches

    // State Tracking
    last_fetched_at?: any;      // Timestamp (replaces last_checked_at)
    last_checked_at?: any;      // Legacy Compatibility
    last_success_at?: any;      // Timestamp
    cooldown_until?: any;       // Firestore Timestamp (Temporary block)
    consecutive_failures?: number;
    failure_count?: number;     // Legacy alias
    consecutive_empty_runs?: number;
    error_log?: string;

    // Legacy mapping (optional, for backward compat if needed)
    name?: string;
    url?: string;
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

    // Temporary State
    temp_disabled_sources?: string[];
    global_lock_until?: any; // Timestamp
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
    tried_sources?: string[];
    source_used?: string;
    success?: boolean;
    exit_reason?: string;
}
