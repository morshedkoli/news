export type RssFeedStatus = 'idle' | 'running' | 'error' | 'cooldown';

export interface RssFeed {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    category?: string; // Category for news generated from this feed
    start_time: string; // "HH:mm"
    interval_minutes: number;
    safety_delay_minutes: number;
    last_run_at: any; // Firestore Timestamp
    next_run_at: any; // Firestore Timestamp
    status: RssFeedStatus;
    error_log?: string;
}

export interface RssSettings {
    master_interval_minutes: number;
    global_safety_delay_minutes: number;
    require_ai_online: boolean;
    max_feeds_per_cycle: number;
    global_lock_until?: any; // Firestore Timestamp
    global_cooldown_until?: any; // Firestore Timestamp
}
