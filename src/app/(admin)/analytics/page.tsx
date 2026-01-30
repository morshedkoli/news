"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, CheckCircle, Clock, Server, TrendingUp, RefreshCw, Zap } from 'lucide-react';
import { DashboardData } from '@/types/analytics';
import { cn } from '@/lib/utils';

// Helper: Status Badge
const StatusBadge = ({ status }: { status: 'healthy' | 'warning' | 'error' | 'degraded' | 'stalled' }) => {
    const colors = {
        healthy: "bg-green-100 text-green-700 border-green-200",
        warning: "bg-amber-100 text-amber-700 border-amber-200",
        error: "bg-red-100 text-red-700 border-red-200",
        degraded: "bg-orange-100 text-orange-700 border-orange-200",
        stalled: "bg-red-50 text-red-600 border-red-100"
    };

    return (
        <span className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium border",
            colors[status] || colors.healthy
        )}>
            {status.toUpperCase()}
        </span>
    );
};

export default function AnalyticsPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/analytics');
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setData(json);
            setLastUpdated(new Date());
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000); // Auto-refresh every minute
        return () => clearInterval(interval);
    }, []);

    if (loading && !data) return <AnalyticsSkeleton />;

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">System Analytics</h1>
                    <p className="text-gray-500 mt-1">Real-time performance metrics and system health.</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">
                        Updated: {lastUpdated?.toLocaleTimeString()}
                    </span>
                    <button
                        onClick={() => fetchData()}
                        className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Insight Banner */}
            {data?.insights && data.insights.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4 flex gap-4">
                    <div className="bg-indigo-100 p-2 rounded-lg h-fit">
                        <Zap className="text-indigo-600" size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-indigo-900">Action Required</h3>
                        <ul className="mt-1 space-y-1">
                            {data.insights.map((insight, idx) => (
                                <li key={idx} className={`text-sm flex items-center gap-2 ${insight.type === 'critical' ? 'text-red-800' :
                                        insight.type === 'warning' ? 'text-amber-800' : 'text-indigo-800'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${insight.type === 'critical' ? 'bg-red-400' :
                                            insight.type === 'warning' ? 'bg-amber-400' : 'bg-indigo-400'
                                        }`} />
                                    {insight.message}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KPICard
                    title="Posts Today"
                    value={`${data?.summary.postsToday} / ${data?.summary.target}`}
                    subvalue="Daily Target"
                    icon={<Activity size={18} />}
                    trend={data?.summary.postsToday && data.summary.postsToday >= 15 ? "positive" : "neutral"}
                />
                <KPICard
                    title="Success Rate"
                    value={`${data?.summary.successRate}%`}
                    subvalue="Cron Availability"
                    icon={<CheckCircle size={18} />}
                    trend={data?.summary.successRate! > 90 ? "positive" : "negative"}
                />
                <KPICard
                    title="System Status"
                    value={data?.summary.systemStatus.toUpperCase() || "UNKNOWN"}
                    subvalue="Global Health"
                    icon={<Server size={18} />}
                    statusColor={data?.summary.systemStatus}
                />
                <KPICard
                    title="Active Feeds"
                    value={data?.summary.activeFeeds || 0}
                    subvalue="Sources Enabled"
                    icon={<TrendingUp size={18} />}
                />
                <KPICard
                    title="Avg Posts/Day"
                    value={data?.posting.avgPostsPerDay || 0}
                    subvalue="Last 7 Days"
                    icon={<Clock size={18} />}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Trend */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-6">Posting Activity (Hourly)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.posting.hourly}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="hour"
                                    tick={{ fontSize: 12, fill: '#6B7280' }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={2}
                                />
                                <YAxis
                                    tick={{ fontSize: 12, fill: '#6B7280' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#F3F4F6' }}
                                />
                                <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Source Distribution */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-6">Top News Sources (7 Days)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={data?.posting.sourceCounts.slice(0, 10)}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={100}
                                    tick={{ fontSize: 11, fill: '#6B7280' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#F3F4F6' }}
                                />
                                <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Feed Health List */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                    <h3 className="font-semibold text-gray-900 mb-4">Feed Health Status</h3>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar h-[300px]">
                        {data?.feeds.map((feed) => (
                            <div key={feed.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div>
                                    <div className="font-medium text-gray-900 text-sm truncate max-w-[150px]" title={feed.name}>
                                        {feed.name}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        Last: {feed.lastPost ? formatTimeAgo(feed.lastPost) : 'Never'}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <StatusBadge status={feed.status} />
                                    {feed.failureCount > 0 && (
                                        <div className="text-xs text-red-500 mt-1 font-medium">
                                            {feed.failureCount} fails
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Cron Logs Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">Recent Cron Executions</h3>
                    <span className="text-xs text-gray-500">Last 20 Runs</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">Time</th>
                                <th className="px-6 py-3">Duration</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Feed</th>
                                <th className="px-6 py-3">Result</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data?.cron.runs.map((run) => (
                                <tr key={run.id} className="hover:bg-gray-50/50 transition">
                                    <td className="px-6 py-3 font-mono text-gray-600">
                                        {new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-6 py-3">
                                        {(run.duration_ms / 1000).toFixed(2)}s
                                    </td>
                                    <td className="px-6 py-3">
                                        {run.post_published ? (
                                            <span className="text-green-600 font-medium flex items-center gap-1">
                                                <CheckCircle size={14} /> Success
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">Skipped</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 max-w-[200px] truncate" title={run.feeds_checked + " checked"}>
                                        In logs
                                    </td>
                                    <td className="px-6 py-3 max-w-[300px]">
                                        {run.post_published ? (
                                            <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded textxs">
                                                Article Published
                                            </span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {(run.skip_reasons || []).slice(0, 2).map((reason: string, i: number) => (
                                                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200">
                                                        {reason}
                                                    </span>
                                                ))}
                                                {(run.skip_reasons || []).length > 2 && (
                                                    <span className="text-xs text-gray-400">+{run.skip_reasons.length - 2}</span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}

// Subcomponents

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

const AnalyticsSkeleton = () => (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 animate-pulse">
        <div className="h-10 bg-gray-200 rounded w-1/4 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
        </div>
        <div className="grid grid-cols-3 gap-6 h-[400px]">
            <div className="col-span-2 bg-gray-200 rounded-xl"></div>
            <div className="bg-gray-200 rounded-xl"></div>
        </div>
    </div>
);

function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}
