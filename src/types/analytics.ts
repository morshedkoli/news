import { RssRunLog } from "@/types/rss";

export interface DashboardData {
    summary: {
        postsToday: number;
        target: number;
        successRate: number;
        systemStatus: 'healthy' | 'degraded' | 'stalled';
        activeFeeds: number;
        aiUsageCount: number;
    };
    posting: {
        hourly: { hour: string; count: number }[];
        daily: { date: string; count: number }[];
        sourceCounts: { name: string; count: number }[]; // New
        avgPostsPerDay: number;
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
    insights: string[];
}
