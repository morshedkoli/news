import { useState } from 'react';
import { AlertTriangle, Play, Unlock, Info } from 'lucide-react';
import { DashboardData } from '@/types/analytics';

export default function ActionCenter({ data }: { data: DashboardData }) {
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const handleAction = async (action: string) => {
        setActionLoading(action);
        try {
            if (action === 'trigger_run') {
                await fetch('/api/cron/rss?force=true');
                alert("Run triggered successfully!");
            }
            if (action === 'unlock') {
                await fetch('/api/admin/system/unlock', { method: 'POST' }); // Need to implement this API
                alert("System unlocked!");
            }
        } catch (e) {
            alert("Action failed: " + e);
        } finally {
            setActionLoading(null);
            // In a real app, refresh data
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Play className="text-indigo-600" size={20} />
                Action Center
            </h3>

            <div className="space-y-4">
                {/* Insights List */}
                {data.insights.length > 0 && (
                    <div className="space-y-2">
                        {data.insights.map((insight, idx) => (
                            <div key={idx} className={`p-3 rounded-lg text-sm border flex items-start gap-3
                                ${insight.type === 'critical' ? 'bg-red-50 border-red-200 text-red-800' :
                                    insight.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                        'bg-blue-50 border-blue-200 text-blue-800'}`}>
                                <Info size={16} className="mt-0.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="font-medium">{insight.message}</p>
                                    {insight.action && (
                                        <button
                                            onClick={() => handleAction(insight.action!)}
                                            disabled={!!actionLoading}
                                            className="mt-2 text-xs font-bold underline hover:no-underline"
                                        >
                                            {actionLoading === insight.action ? "Running..." : "Fix Now"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Primary Actions */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                    <button
                        onClick={() => handleAction('trigger_run')}
                        disabled={!!actionLoading}
                        className="flex items-center justify-center gap-2 p-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                        {actionLoading === 'trigger_run' ? <span className="animate-spin">C</span> : <Play size={16} />}
                        Trigger Run
                    </button>

                    <button
                        onClick={() => handleAction('unlock')}
                        disabled={!!actionLoading || !data.system.lockStatus.active}
                        className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition disabled:opacity-50"
                    >
                        <Unlock size={16} />
                        Force Unlock
                    </button>
                </div>
            </div>
        </div>
    );
}
