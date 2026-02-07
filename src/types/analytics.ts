import { RssRunLog } from "@/types/rss";

export interface DashboardData {
    summary: {
        postsToday: number;
        target: number;
        successRate: number;
        systemStatus: 'healthy' | 'degraded' | 'stalled' | 'manual';
        activeFeeds: number;
        aiUsageCount: number;
        nextPostWindow?: string;
    };
    posting: {
        hourly: { hour: string; count: number }[];
        daily: { date: string; count: number }[];
        sourceCounts: { name: string; count: number }[];
        avgPostsPerDay: number;
    };
    system: {
        lockStatus: { active: boolean; expiresAt: string | null; ttlSeconds: number };
        consecutiveFailures: number;
        lastRunStatus: string;
        lastRunTime: string;
    };
    performance: {
        dedupRate: number;
        aiFailureRate: number;
        retriesTriggered: number;
    };
    quality: {
        avgQualityScore: number;
        qualityDistribution: {
            high: number;
            medium: number;
            low: number;
        };
        topIssues: { issue: string; count: number }[];
        totalDropped: number;
        totalQueued: number;
        totalPublished: number;
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
    insights: { type: 'info' | 'warning' | 'critical'; message: string; action?: string }[];
}
