"use client";

import { useEffect, useState } from "react";
import { fetchDashboardStats, DashboardStats } from "@/lib/analytics";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    LineChart, Line, CartesianGrid
} from "recharts";
import { TrendingUp, Users, Bell, Activity } from "lucide-react";

export default function AnalyticsPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchDashboardStats();
                setStats(data);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) return <div className="p-8 text-center">লোডিং অ্যানালিটিক্স...</div>;
    if (!stats) return <div className="p-8 text-center text-red-500">ডাটা লোড করা যায়নি</div>;

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-slate-800">অ্যানালিটিক্স ড্যাশবোর্ড</h1>

            {/* 1. Overview Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="মোট সংবাদ"
                    value={stats.totalNews}
                    icon={<Activity className="text-blue-500" />}
                />
                <StatCard
                    label="আজকের সংবাদ"
                    value={stats.todayNews}
                    icon={<TrendingUp className="text-green-500" />}
                />
                <StatCard
                    label="মোট লাইক"
                    value={stats.totalLikes}
                    icon={<Users className="text-indigo-500" />}
                />
                <StatCard
                    label="নোটিফিকেশন পাঠানো হয়েছে"
                    value={stats.notificationStats.sentToday}
                    icon={<Bell className="text-orange-500" />}
                />
            </div>

            {/* 2. Charts Section */}
            <div className="grid gap-8 lg:grid-cols-2">

                {/* Source Performance */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-lg font-semibold text-slate-700">সংবাদ উৎসের পারফরম্যান্স</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.sourcePerformance}>
                                <XAxis dataKey="name" fontSize={12} tickMargin={10} />
                                <YAxis fontSize={12} />
                                <Tooltip />
                                <Bar dataKey="posts" fill="#6366f1" radius={[4, 4, 0, 0]} name="মোট পোস্ট" />
                                <Bar dataKey="avgLikes" fill="#ec4899" radius={[4, 4, 0, 0]} name="গড় লাইক" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="mt-4 text-center text-sm text-slate-500">
                        * গ্রাফটি দেখায় কোন উৎস থেকে কত সংবাদ এসেছে এবং তাদের এনগেজমেন্ট কেমন।
                    </p>
                </div>

                {/* Hourly Insight */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-lg font-semibold text-slate-700">পাঠকের সক্রিয় সময় (Estimated)</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.hourlyViews}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="hour" fontSize={12} tickMargin={10} />
                                <YAxis fontSize={12} />
                                <Tooltip />
                                <Line type="monotone" dataKey="views" stroke="#10b981" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="mt-4 text-center text-sm text-slate-500">
                        * এই সময়ে পাঠকরা অ্যাপে বেশি সক্রিয় থাকেন। নোটিফিকেশনের জন্য সেরা সময়।
                    </p>
                </div>
            </div>

            {/* 3. Trending News Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                    <h3 className="font-semibold text-slate-700">শীর্ষ ৫টি জনপ্রিয় সংবাদ</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="px-6 py-3 font-medium">শিরোনাম</th>
                                <th className="px-6 py-3 font-medium">উৎস</th>
                                <th className="px-6 py-3 font-medium text-right">লাইক</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {stats.trendingNews.map((news) => (
                                <tr key={news.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-medium text-slate-800 line-clamp-1 block">{news.title}</td>
                                    <td className="px-6 py-3 text-slate-500">{news.source_name}</td>
                                    <td className="px-6 py-3 text-right font-medium text-indigo-600">{news.likes || 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Notification Insight */}
            <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white shadow-lg">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h3 className="text-xl font-bold">নোটিফিকেশন ইফেক্টিভনেস</h3>
                        <p className="mt-1 opacity-90">স্মার্ট ফিল্টারিং সিস্টেমের ফলাফল</p>
                    </div>
                    <div className="flex gap-8 text-center">
                        <div>
                            <p className="text-3xl font-bold">{stats.notificationStats.avgScore}</p>
                            <p className="text-xs opacity-75">গড় ইম্পর্ট্যান্স স্কোর</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold">{stats.notificationStats.ctr}%</p>
                            <p className="text-xs opacity-75"> ক্লিক রেট (CTR)</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

function StatCard({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            </div>
            <div className="rounded-full bg-slate-50 p-3">
                {icon}
            </div>
        </div>
    );
}
