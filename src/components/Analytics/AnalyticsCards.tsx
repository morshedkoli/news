"use client";

import { useEffect, useState } from 'react';
import { Activity, CheckCircle, Clock, Server, TrendingUp, AlertTriangle } from 'lucide-react';
import { DashboardData } from '@/types/analytics';
import { cn } from '@/lib/utils';
import Skeleton from '@/components/Skeleton';

// KPI Card Component
const KPICard = ({ title, value, subvalue, icon, trend, statusColor }: any) => {
    let colorClass = "text-gray-900";
    if (trend === 'positive') colorClass = "text-green-600";
    if (trend === 'negative') colorClass = "text-red-600";
    if (statusColor === 'healthy') colorClass = "text-green-600";
    if (statusColor === 'degraded') colorClass = "text-orange-600";
    if (statusColor === 'stalled') colorClass = "text-red-600";

    return (
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-4">
                <span className="text-gray-500 font-medium text-sm">{title}</span>
                <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                    {icon}
                </div>
            </div>
            <div>
                <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
                <div className="text-xs text-gray-400 mt-1">{subvalue}</div>
            </div>
        </div>
    );
};

export default function AnalyticsCards() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAnalytics() {
            try {
                const res = await fetch('/api/admin/analytics');
                if (!res.ok) return;
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <KPICard
                title="Posts Today"
                value={`${data.summary.postsToday} / ${data.summary.target}`}
                subvalue="Daily Target"
                icon={<Activity size={18} />}
                trend={data.summary.postsToday >= 15 ? "positive" : "neutral"}
            />
            <KPICard
                title="Success Rate"
                value={`${data.summary.successRate}%`}
                subvalue="Cron Reliability"
                icon={<CheckCircle size={18} />}
                trend={data.summary.successRate > 90 ? "positive" : "negative"}
            />
            <KPICard
                title="System Status"
                value={data.summary.systemStatus.toUpperCase()}
                subvalue="Operational Health"
                icon={<Server size={18} />}
                statusColor={data.summary.systemStatus}
            />
            <KPICard
                title="Active Feeds"
                value={data.summary.activeFeeds}
                subvalue="Sources Enabled"
                icon={<TrendingUp size={18} />}
            />
            <KPICard
                title="Avg Posts/Day"
                value={data.posting.avgPostsPerDay}
                subvalue="Last 7 Days"
                icon={<Clock size={18} />}
            />
        </div>
    );
}
