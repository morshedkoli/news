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
    let systemStatus: 'healthy' | 'degraded' | 'stalled' | 'manual' = 'healthy';
    const statsData = statsSnap.data() || {};

    // Time-based Health Check (Primary Signal)
    if (statsData.last_news_posted_at) {
        const lastPostTime = statsData.last_news_posted_at.toDate().getTime();
        const minsSinceLastPost = (now.getTime() - lastPostTime) / 60000;

        if (minsSinceLastPost > 120) {
            systemStatus = 'stalled';
        } else if (minsSinceLastPost > 40) {
            systemStatus = 'degraded';
        } else {
            systemStatus = 'healthy';
        }
    } else {
        // No posts ever? Or just reset?
        if (failedRuns > 5) systemStatus = 'stalled';
    }

    // Secondary Failure Check (Override to Degraded/Stalled if high failures)
    if (failedRuns > 8 && systemStatus !== 'stalled') {
        systemStatus = 'degraded';
    }
    if (statsData.consecutive_failed_runs > 10) {
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

    // Source Counts (Last 7 Days)
    const sourceMap = new Map<string, number>();
    newsSevenDaysSnap.docs.forEach(doc => {
        const data = doc.data();
        // Use source_name (often from scraper) or fellback to 'RSS' if missing
        // For unified system: source_name should be populated.
        const source = data.source_name || "Unknown";
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
    });

    const sourceCounts = Array.from(sourceMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count); // Top sources first

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

    // 5. Deep System Analysis
    // statsData is already defined above (deduplicated)
    const lockUntil = statsData.global_lock_until ? statsData.global_lock_until.toDate() : null;
    const isLocked = lockUntil && lockUntil.getTime() > now.getTime();

    // Lock Status
    const lockStatus = {
        active: !!isLocked,
        expiresAt: lockUntil ? lockUntil.toISOString() : null,
        ttlSeconds: isLocked ? Math.round((lockUntil.getTime() - now.getTime()) / 1000) : 0
    };

    // Performance Metrics
    const recentRuns = runsTodaySnap.docs.map(d => d.data() as any);
    const totalAiFailures = recentRuns.reduce((acc, run) => acc + (run.ai_failures || 0), 0);
    const dedupExits = recentRuns.filter(r => r.exit_reason?.includes('duplicate')).length; // Approximate
    const retriesTriggered = recentRuns.filter(r => r.tried_sources && r.tried_sources.length > 1).length;

    const performance = {
        dedupRate: totalRuns > 0 ? Math.round((dedupExits / totalRuns) * 100) : 0,
        aiFailureRate: totalRuns > 0 ? Math.round((totalAiFailures / totalRuns) * 100) : 0,
        retriesTriggered
    };

    // System Status Logic (Enhanced)
    if (statsData.last_news_posted_at) {
        const lastPostTime = statsData.last_news_posted_at.toDate().getTime();
        const minsSinceLastPost = (now.getTime() - lastPostTime) / 60000;

        if (minsSinceLastPost > 120) {
            systemStatus = 'stalled';
        } else if (minsSinceLastPost > 45) {
            systemStatus = 'degraded';
        }
    } else if (failedRuns > 5) {
        systemStatus = 'stalled';
    }

    if (statsData.consecutive_failed_runs > 10) {
        systemStatus = 'manual'; // Too many failures, needs human look
    }

    // Next Window Calculation
    let nextPostWindow = "Now";
    if (systemStatus === 'healthy' && statsData.last_news_posted_at) {
        const lastPost = statsData.last_news_posted_at.toDate();
        const nextTime = new Date(lastPost.getTime() + 30 * 60000); // 30m interval
        const diffMins = Math.round((nextTime.getTime() - now.getTime()) / 60000);
        if (diffMins > 0) nextPostWindow = `in ${diffMins} mins`;
        else nextPostWindow = "Overdue";
    }

    // 6. Actionable Insights
    const insights: { type: 'info' | 'warning' | 'critical'; message: string; action?: string }[] = [];

    // Stalled / Manual
    if (systemStatus === 'stalled' || systemStatus === 'manual') {
        insights.push({
            type: 'critical',
            message: `System stalled! No posts for > 2 hours.`,
            action: 'trigger_run'
        });
    }

    // Target Miss
    if (postsToday < target && now.getHours() > 18) {
        const deficit = target - postsToday;
        insights.push({
            type: 'warning',
            message: `Behind daily target by ${deficit} posts.`,
            action: 'trigger_run'
        });
    }

    // Locked Support
    if (isLocked) {
        insights.push({
            type: 'info',
            message: `Pipeline active (Locked for ${Math.round(lockStatus.ttlSeconds / 60)}m).`,
        });
    }

    // Dedup Warning
    if (performance.dedupRate > 80) {
        insights.push({
            type: 'warning',
            message: `High Dedup Rate (${performance.dedupRate}%). Filters might be too strict.`,
            action: 'check_settings'
        });
    }

    // AI Warning
    if (performance.aiFailureRate > 50) {
        insights.push({
            type: 'warning',
            message: `AI Provider failing often (${performance.aiFailureRate}%). Check billing/quota.`,
            action: 'check_ai'
        });
    }

    // Source Balance
    if (sourceCounts.length > 0 && sourceCounts[0].count === postsToday && postsToday > 5) {
        insights.push({
            type: 'info',
            message: `Single source dominance: ${sourceCounts[0].name} provided 100% of posts.`,
        });
    }

    return {
        summary: {
            postsToday,
            target,
            successRate: Math.round(successRate),
            systemStatus,
            activeFeeds,
            aiUsageCount: 0,
            nextPostWindow
        },
        posting: {
            hourly: hourlyChart,
            daily: dailyChart,
            sourceCounts,
            avgPostsPerDay
        },
        system: {
            lockStatus,
            consecutiveFailures: statsData.consecutive_failed_runs || 0,
            lastRunStatus: recentRuns[0]?.exit_reason || "unknown",
            lastRunTime: recentRuns[0]?.started_at || ""
        },
        performance,
        cron: {
            runs: runsTodaySnap.docs.slice(0, 20).map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    success: !!(data.post_published || data.success)
                } as any;
            }),
            totalRuns,
            failedRuns
        },
        feeds: feeds.sort((a, b) => (a.status === 'error' ? -1 : 1)),
        insights
    };
}
