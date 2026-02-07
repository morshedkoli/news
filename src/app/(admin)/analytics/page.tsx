"use client";

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import AnalyticsCharts from '@/components/Analytics/AnalyticsCharts';
import { QualityDashboard } from '@/components/Analytics/QualityDashboard';
import Link from "next/link";
import { Activity, CheckCircle, Clock, TrendingUp, RefreshCw, Zap } from 'lucide-react';
import { DashboardData } from '@/types/analytics';

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
                        Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
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
                    value={data?.summary ? `${data.summary.postsToday} / ${data.summary.target}` : "—"}
                    subvalue={data?.summary ? "Daily Target" : "No data"}
                    icon={<Activity size={18} />}
                    trend={data?.summary?.postsToday && data.summary.postsToday >= 15 ? "positive" : "neutral"}
                />
                <KPICard
                    title="Success Rate"
                    value={data?.summary ? `${data.summary.successRate}%` : "—"}
                    subvalue={data?.summary ? "Cron Availability" : "No data"}
                    icon={<CheckCircle size={18} />}
                    trend={data?.summary?.successRate && data.summary.successRate > 90 ? "positive" : "negative"}
                />
                <KPICard
                    title="Active Feeds"
                    value={data?.summary ? data.summary.activeFeeds : "—"}
                    subvalue={data?.summary ? "Sources Enabled" : "No data"}
                    icon={<TrendingUp size={18} />}
                />
                <KPICard
                    title="Avg Posts/Day"
                    value={data?.posting ? data.posting.avgPostsPerDay : "—"}
                    subvalue={data?.posting ? "Last 7 Days" : "No data"}
                    icon={<Clock size={18} />}
                />
            </div>

            {/* Charts Section */}
            {data?.posting ? (
                <AnalyticsCharts data={data} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-sm text-gray-500">
                        No hourly data available yet.
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-sm text-gray-500">
                        No source distribution available yet.
                    </div>
                </div>
            )}

            {/* Quality Metrics Section */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">Content Quality Metrics</h3>
                        <span className="text-xs text-gray-500">(Last 24 hours)</span>
                    </div>
                    <span className="text-xs text-gray-500">Quality Scoring & Drop Analysis</span>
                </div>
                <div className="p-6">
                    {data?.quality ? (
                        <QualityDashboard metrics={data.quality} />
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            No quality metrics available yet. Data will appear after content flows through the pipeline.
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                        <Activity size={18} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Feed Health lives in RSS Management</h3>
                        <p className="text-sm text-gray-500">View feed status, pipeline, and recovery actions.</p>
                    </div>
                </div>
                <Link
                    href="/rss-management?tab=health"
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
                >
                    Go to RSS Management
                </Link>
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

type KPICardProps = {
    title: string;
    value: string | number;
    subvalue: string;
    icon: ReactNode;
    trend?: 'positive' | 'negative' | 'neutral';
    statusColor?: 'healthy' | 'degraded' | 'stalled' | 'manual';
};

const KPICard = ({ title, value, subvalue, icon, trend, statusColor }: KPICardProps) => {
    let colorClass = "text-gray-900";
    if (trend === 'positive') colorClass = "text-green-600";
    if (trend === 'negative') colorClass = "text-red-600";
    if (statusColor === 'healthy') colorClass = "text-green-600";
    if (statusColor === 'degraded') colorClass = "text-orange-600";
    if (statusColor === 'stalled') colorClass = "text-red-600";
    const isMissing = value === "—" || value === "-" || value === "";

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
                <div className="text-xs text-gray-400 mt-1">
                    {subvalue}
                    {isMissing && (
                        <span className="ml-2 text-[10px] text-gray-400" title="Data not available yet. This can happen when the system is still collecting metrics.">
                            (why?)
                        </span>
                    )}
                </div>
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

