import { RssRunLog } from "@/types/rss";

export interface DashboardData {
    summary: {
        postsToday: number;
        target: number;
        successRate: number;
        systemStatus: 'healthy' | 'degraded' | 'stalled' | 'manual'; // Added 'manual'
        activeFeeds: number;
        aiUsageCount: number;
        nextPostWindow?: string; // New
    };
    posting: {
        hourly: { hour: string; count: number }[];
        daily: { date: string; count: number }[];
        sourceCounts: { name: string; count: number }[];
        avgPostsPerDay: number;
    };
    // New Section: Deep System Health
    system: {
        lockStatus: { active: boolean; expiresAt: string | null; ttlSeconds: number };
        consecutiveFailures: number;
        lastRunStatus: string;
        lastRunTime: string;
    };
    // New Section: Performance Metrics
    performance: {
        dedupRate: number; // % of items rejected as duplicates
        aiFailureRate: number; // % of AI summaries failed
        retriesTriggered: number;
    };
    cron: {
        runs: (RssRunLog & { id: string })[];
        totalRuns: number;
        failedRuns: number;
    };
    feeds: {
        id: string;
        name: string;
        itemsPosted: number;
        status: 'healthy' | 'warning' | 'error';
        lastPost: string | null;
        failureCount: number;
    }[];
    insights: { type: 'info' | 'warning' | 'critical'; message: string; action?: string }[]; // Enhanced insights
}
