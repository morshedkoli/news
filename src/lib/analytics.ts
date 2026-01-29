import { dbAdmin } from "@/lib/firebase-admin";
import { RssFeed } from "@/types/rss";
import { DashboardData } from "@/types/analytics";

export async function getAnalyticsData(): Promise<DashboardData> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Parallel Fetch
    const [
        newsTodaySnap,
        newsSevenDaysSnap,
        runsTodaySnap,
        feedsSnap,
        statsSnap
    ] = await Promise.all([
        dbAdmin.collection("news")
            .where("published_at", ">=", startOfDay.toISOString())
            .get(),
        dbAdmin.collection("news")
            .where("published_at", ">=", sevenDaysAgo.toISOString())
            .get(),
        dbAdmin.collection("rss_run_logs")
            .where("started_at", ">=", startOfDay.toISOString())
            .orderBy("started_at", "desc")
            .get(),
        dbAdmin.collection("rss_feeds").get(),
        dbAdmin.collection("system_stats").doc("rss_settings").get()
    ]);

    // 2. Process Summary
    const postsToday = newsTodaySnap.size;
    const target = 15;
    const activeFeeds = feedsSnap.docs.filter(d => d.data().enabled).length;

    // Cron Stats
    const totalRuns = runsTodaySnap.size;
    const failedRuns = runsTodaySnap.docs.filter(d => {
        const data = d.data();
        return !data.post_published && data.skip_reasons?.some((r: string) => r.includes('error') || r.includes('failed'));
    }).length;

    const successRate = totalRuns > 0 ? ((totalRuns - failedRuns) / totalRuns) * 100 : 100;

    // System Status
    let systemStatus: 'healthy' | 'degraded' | 'stalled' = 'healthy';
    if (failedRuns > 5 || postsToday === 0 && now.getHours() > 12) {
        systemStatus = 'degraded';
    }
    const statsData = statsSnap.data() || {};
    if (statsData.consecutive_failed_runs > 5) {
        systemStatus = 'stalled';
    }

    // 3. Process Posting Charts
    // Hourly
    const hourlyMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) hourlyMap.set(i, 0);

    newsTodaySnap.docs.forEach(doc => {
        const date = new Date(doc.data().published_at);
        const hour = date.getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    });

    const hourlyChart = Array.from(hourlyMap.entries()).map(([hour, count]) => ({
        hour: `${hour}:00`,
        count
    }));

    // Daily
    const dailyMap = new Map<string, number>();
    newsSevenDaysSnap.docs.forEach(doc => {
        const date = new Date(doc.data().published_at);
        const key = `${date.getMonth() + 1}/${date.getDate()}`;
        dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
    });

    // Fill gaps
    const dailyChart = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = `${d.getMonth() + 1}/${d.getDate()}`;
        dailyChart.push({
            date: key,
            count: dailyMap.get(key) || 0
        });
    }

    const avgPostsPerDay = Math.round(newsSevenDaysSnap.size / 7);

    // 4. Process Feeds
    const feeds = feedsSnap.docs.map(doc => {
        const data = doc.data() as RssFeed;
        let health: 'healthy' | 'warning' | 'error' = 'healthy';

        if (data.consecutive_failures && data.consecutive_failures > 3) health = 'error';
        else if (data.consecutive_empty_runs && data.consecutive_empty_runs > 10) health = 'warning';
        else if (!data.enabled) health = 'warning'; // Or just separate status? Keep simple.

        return {
            id: doc.id,
            name: data.source_name || data.name || "Unknown",
            itemsPosted: 0, // Hard to calculate without costly query. Omit/Placeholder.
            status: health,
            lastPost: data.last_success_at ? data.last_success_at.toDate().toISOString() : null,
            failureCount: data.consecutive_failures || 0
        };
    });

    // 5. Generate Insights
    const insights: string[] = [];
    if (postsToday < target && now.getHours() > 20) {
        insights.push(`📉 Target Miss Risk: Only ${postsToday}/${target} posts. Consider forcing a run.`);
    }
    if (failedRuns > 3) {
        insights.push(`⚠️ High Failure Rate: ${failedRuns} failures today. Check logs.`);
    }
    const errorFeeds = feeds.filter(f => f.status === 'error');
    if (errorFeeds.length > 0) {
        insights.push(`🔴 broken feeds detected: ${errorFeeds.map(f => f.name).join(', ')}`);
    }
    if (statsData.last_news_posted_at) {
        const lastPost = statsData.last_news_posted_at.toDate();
        const diffHours = (now.getTime() - lastPost.getTime()) / (1000 * 3600);
        if (diffHours > 4) {
            insights.push(`⏰ System Stale: No posts for ${diffHours.toFixed(1)} hours.`);
        }
    }

    return {
        summary: {
            postsToday,
            target,
            successRate: Math.round(successRate),
            systemStatus,
            activeFeeds,
            aiUsageCount: 0 // TODO: Implement AI usage tracking
        },
        posting: {
            hourly: hourlyChart,
            daily: dailyChart,
            avgPostsPerDay
        },
        cron: {
            runs: runsTodaySnap.docs.slice(0, 20).map(d => ({ id: d.id, ...d.data() } as any)),
            totalRuns,
            failedRuns
        },
        feeds: feeds.sort((a, b) => (a.status === 'error' ? -1 : 1)), // Errors first
        insights
    };
}
