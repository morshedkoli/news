'use client';

import { RssSettings } from "@/types/rss";
import { Timestamp } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle, Clock, ShieldAlert, Activity } from "lucide-react";

interface OverviewTabProps {
    settings: RssSettings;
    isLoading: boolean;
}

export default function OverviewTab({ settings, isLoading }: OverviewTabProps) {
    if (isLoading) return <div className="p-8 text-center text-zinc-400">Loading metrics...</div>;

    // Logic for Status
    const lastSuccess = settings.last_successful_run instanceof Timestamp
        ? settings.last_successful_run.toDate()
        : null;

    const minutesSinceSuccess = lastSuccess
        ? (Date.now() - lastSuccess.getTime()) / (1000 * 60)
        : 999;

    const failedRuns = settings.consecutive_failed_runs || 0;

    let status: 'healthy' | 'degraded' | 'failing' = 'healthy';
    if (failedRuns >= 3) status = 'failing';
    else if (failedRuns >= 1 || minutesSinceSuccess > 90) status = 'degraded';

    const failsafeActive = failedRuns >= 3 || minutesSinceSuccess > 240; // 4 hours

    return (
        <div className="space-y-6">
            {/* Status Banner */}
            <div className={`p-4 rounded-lg border flex items-center gap-4 ${status === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    status === 'degraded' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                        'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                {status === 'healthy' && <CheckCircle className="w-8 h-8" />}
                {status === 'degraded' && <AlertTriangle className="w-8 h-8" />}
                {status === 'failing' && <ShieldAlert className="w-8 h-8" />}

                <div className="flex-1">
                    <h2 className="text-lg font-bold uppercase tracking-wide">{status} System Status</h2>
                    <p className="text-sm opacity-80">
                        {status === 'healthy' && "System is operating normally. Recent posts confirmed."}
                        {status === 'degraded' && "System is experiencing minor delays or skips."}
                        {status === 'failing' && "Multiple consecutive failures detected. Failsafe may be active."}
                    </p>
                </div>

                {failsafeActive && (
                    <div className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                        FAILSAFE ON
                    </div>
                )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Last Successful Post"
                    value={lastSuccess ? formatDistanceToNow(lastSuccess, { addSuffix: true }) : 'Never'}
                    icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
                    subtext={lastSuccess?.toLocaleString()}
                />
                <MetricCard
                    label="Consecutive Failures"
                    value={failedRuns.toString()}
                    icon={<AlertTriangle className={`w-5 h-5 ${failedRuns > 0 ? 'text-amber-400' : 'text-zinc-500'}`} />}
                    subtext={failedRuns >= 3 ? "Critical Level" : "Normal Range"}
                    valueColor={failedRuns > 0 ? 'text-amber-400' : 'text-zinc-200'}
                />
                <MetricCard
                    label="Posts Today"
                    value={(settings.total_posts_today || 0).toString()}
                    icon={<Activity className="w-5 h-5 text-blue-400" />}
                    subtext={`Avg Interval: ${settings.avg_time_between_posts || 0}m`}
                />
                <MetricCard
                    label="Last Cron Run"
                    value={settings.last_run_at ? formatDistanceToNow(settings.last_run_at.toDate(), { addSuffix: true }) : 'N/A'}
                    icon={<Clock className="w-5 h-5 text-purple-400" />}
                />
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon, subtext, valueColor = "text-zinc-100" }: any) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm font-medium">{label}</span>
                {icon}
            </div>
            <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
            {subtext && <div className="text-xs text-zinc-500 mt-1">{subtext}</div>}
        </div>
    );
}
