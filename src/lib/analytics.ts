import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { subDays, startOfDay, endOfDay, format } from "date-fns";

export interface DashboardStats {
    totalNews: number;
    todayNews: number;
    totalLikes: number;
    todayViews: number;
    trendingNews: any[];
    sourcePerformance: any[];
    notificationStats: {
        sentToday: number;
        avgScore: number;
        ctr: number; // Click Through Rate (simulated or real if tracking exists)
    };
    hourlyViews: any[];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // 1. Overview Stats
    // Note: For large collections, use aggregation queries or counters. 
    // Here we use simple queries for MVP (assuming < 10k docs for now)
    const newsRef = collection(db, "news");

    // Total News (Optimized: Count aggregation would be better)
    const totalNewsSnapshot = await getDocs(query(newsRef, orderBy("published_at", "desc"), limit(1000)));
    const totalNews = totalNewsSnapshot.size;

    // Today's News
    const qToday = query(newsRef, where("published_at", ">=", Timestamp.fromDate(todayStart)), where("published_at", "<=", Timestamp.fromDate(todayEnd)));
    const todayNewsSnapshot = await getDocs(qToday);
    const todayNews = todayNewsSnapshot.size;

    // Likes & Views Aggregation
    let totalLikes = 0;
    let todayViews = 0; // In a real app, views would be in a subcollection or separate analytics store

    // 2. Performance Aggregation
    const sourceMap: Record<string, { posts: number, likes: number }> = {};
    const trendingList: any[] = [];

    totalNewsSnapshot.forEach(doc => {
        const data = doc.data();
        totalLikes += (data.likes || 0);

        // Mocking views for demo schema if not present
        const views = data.views || Math.floor(Math.random() * 500);

        // For Trending
        if (trendingList.length < 10) {
            trendingList.push({ id: doc.id, ...data, views });
        }

        // Source Stats
        const source = data.source_name || "Unknown";
        if (!sourceMap[source]) sourceMap[source] = { posts: 0, likes: 0 };
        sourceMap[source].posts++;
        sourceMap[source].likes += (data.likes || 0);
    });

    // 3. Notification Stats (Simulated based on 'importance_score')
    // In production, you'd query the 'notifications' collection
    const notifiedNews = totalNewsSnapshot.docs.filter(d => d.data().importance_score >= 70);
    const sentToday = notifiedNews.filter(d => d.data().published_at.toDate() >= todayStart).length;
    const avgScore = notifiedNews.reduce((acc, curr) => acc + curr.data().importance_score, 0) / (notifiedNews.length || 1);


    // 4. Source Performance Chart Data
    const sourcePerformance = Object.entries(sourceMap)
        .map(([name, stats]) => ({
            name,
            posts: stats.posts,
            avgLikes: Math.round(stats.likes / stats.posts)
        }))
        .sort((a, b) => b.posts - a.posts)
        .slice(0, 5);

    // 5. Hourly Views (Mocked for visualization as strict hourly tracking requires big data structure)
    const hourlyViews = Array.from({ length: 24 }, (_, i) => ({
        hour: `${i}:00`,
        views: Math.floor(Math.random() * 100) + (i > 18 ? 200 : 50) // Higher in evening
    }));

    return {
        totalNews,
        todayNews,
        totalLikes,
        todayViews: Math.floor(totalLikes * 5.5), // Heuristic estimate if views not tracked
        trendingNews: trendingList.sort((a, b) => b.likes - a.likes).slice(0, 5),
        sourcePerformance,
        notificationStats: {
            sentToday,
            avgScore: Math.round(avgScore),
            ctr: 12.5 // Mock CTR
        },
        hourlyViews
    };
}
