import { Activity, CheckCircle, Clock, Server, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import { DashboardData } from '@/types/analytics';

const KPICard = ({ title, value, subvalue, icon, trend, statusColor }: any) => {
    let colorClass = "text-slate-900";
    if (trend === 'positive') colorClass = "text-green-600";
    if (trend === 'negative') colorClass = "text-red-600";
    if (statusColor) {
        if (statusColor === 'healthy') colorClass = "text-green-600";
        if (statusColor === 'degraded') colorClass = "text-amber-600";
        if (statusColor === 'stalled') colorClass = "text-red-600";
        if (statusColor === 'manual') colorClass = "text-slate-900 bg-slate-100 px-2 rounded";
    }

    return (
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between h-full hover:shadow-md transition">
            <div className="flex justify-between items-start mb-4">
                <span className="text-slate-500 font-medium text-sm">{title}</span>
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                    {icon}
                </div>
            </div>
            <div>
                <div className={`text-2xl font-bold ${colorClass} flex items-center gap-2`}>
                    {value}
                    {statusColor === 'stalled' && <AlertTriangle size={20} />}
                </div>
                <div className="text-xs text-slate-400 mt-1 font-medium">{subvalue}</div>
            </div>
        </div>
    );
};

export default function MissionControl({ data }: { data: DashboardData }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard
                title="System Health"
                value={data.summary.systemStatus.toUpperCase()}
                subvalue={
                    data.summary.systemStatus === 'healthy' ? "Fully Operational" :
                        data.summary.systemStatus === 'degraded' ? "Slow Posting" :
                            "Intervention Needed"
                }
                icon={<ShieldCheck size={18} />}
                statusColor={data.summary.systemStatus}
            />
            <KPICard
                title="Daily Progress"
                value={`${data.summary.postsToday} / ${data.summary.target}`}
                subvalue={data.summary.postsToday >= 15 ? "Target Met 🎯" : `${15 - data.summary.postsToday} to go`}
                icon={<Activity size={18} />}
                trend={data.summary.postsToday >= 7 ? "positive" : "neutral"}
            />
            <KPICard
                title="Next Post"
                value={data.summary.nextPostWindow || "Calculating..."}
                subvalue="Scheduled Window"
                icon={<Clock size={18} />}
            />
            <KPICard
                title="Success Rate"
                value={`${data.summary.successRate}%`}
                subvalue={`${data.cron.failedRuns} failures today`}
                icon={<CheckCircle size={18} />}
                trend={data.summary.successRate > 85 ? "positive" : "negative"}
            />
        </div>
    );
}
