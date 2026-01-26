"use client";

import { useAuth } from "@/context/AuthContext";
import Skeleton from "@/components/Skeleton";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { collection, getCountFromServer, query, where, Timestamp, orderBy, limit, getDocs, getAggregateFromServer, sum } from "firebase/firestore";
import { BarChart3, Heart, Newspaper, Calendar } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AnalyticsCards from "@/components/Analytics/AnalyticsCards";

interface DashboardStats {
  totalNews: number;
  todayNews: number;
  totalLikes: number;
}

interface DashboardNews {
  id: string;
  title: string;
  source_name?: string;
  published_at: any; // Allow Timestamp
  published?: boolean;
}

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalNews: 0,
    todayNews: 0,
    totalLikes: 0,
  });
  // Use loose type for now or import proper NewsArticle if available, but avoid any
  const [recentNews, setRecentNews] = useState<DashboardNews[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const newsColl = collection(db, "news");

        // 1. Stats
        // Total News
        const totalSnapshot = await getCountFromServer(newsColl);

        // Today's News
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todayQuery = query(newsColl, where("published_at", ">=", Timestamp.fromDate(startOfDay)));
        const todaySnapshot = await getCountFromServer(todayQuery);

        // Total Likes (Aggregation)
        const likesSnapshot = await getAggregateFromServer(newsColl, {
          totalLikes: sum('likes')
        });

        setStats({
          totalNews: totalSnapshot.data().count,
          todayNews: todaySnapshot.data().count,
          totalLikes: likesSnapshot.data().totalLikes || 0,
        });

        // 2. Recent News
        const recentQuery = query(newsColl, orderBy("published_at", "desc"), limit(5));
        const recentDocs = await getDocs(recentQuery);
        setRecentNews(recentDocs.docs.map(d => ({ id: d.id, ...d.data() } as DashboardNews)));

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchData();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton height={32} width="220px" />
        <Skeleton height={20} width="320px" />
        {/* Analytics Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} height={120} />)}
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Skeleton height={100} />
          <Skeleton height={100} />
          <Skeleton height={100} />
        </div>
        <Skeleton height={32} width="180px" />
        <Skeleton height={180} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500">Welcome back, {user?.displayName || "Admin"}. System Overview:</p>
      </div>

      {/* Analytics KPI Cards */}
      <AnalyticsCards />

      {/* Content Stats Grid */}
      <h2 className="text-lg font-semibold text-slate-700 mt-8 mb-4">Content Metrics</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {/* Total News */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Total News</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalNews}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <Newspaper size={24} />
          </div>
        </div>

        {/* Today's News */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Published Today</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.todayNews}</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <Calendar size={24} />
          </div>
        </div>

        {/* Total Likes */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Total Engagement</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalLikes}</p>
          </div>
          <div className="p-3 bg-rose-50 rounded-lg text-rose-600">
            <Heart size={24} />
          </div>
        </div>
      </div>

      {/* Recent News Table */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden mt-8">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Recent News</h3>
          <Link href="/news" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">Source</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentNews.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-slate-400">No news found</td>
                </tr>
              ) : (
                recentNews.map((news) => (
                  <tr key={news.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div className="line-clamp-1 max-w-md">{news.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      {news.source_name || "Unknown"}
                    </td>
                    <td className="px-6 py-4">
                      {news.published_at
                        ? format(
                          (typeof news.published_at.toDate === 'function')
                            ? news.published_at.toDate()
                            : new Date(news.published_at), // Fallback
                          "MMM d, p"
                        )
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${news.published !== false ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}>
                        {news.published !== false ? "Published" : "Draft"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
