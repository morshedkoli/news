import { DashboardData } from '@/types/analytics';
import { Database, Cpu, PieChart, Lock } from 'lucide-react';

export default function DeepStats({ data }: { data: DashboardData }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                <Cpu className="text-indigo-600" size={20} />
                System Internals
            </h3>

            <div className="space-y-6">
                {/* Lock Status */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <Lock size={18} className={data.system.lockStatus.active ? "text-amber-500" : "text-slate-400"} />
                        <div>
                            <p className="text-sm font-medium text-slate-700">Pipeline Lock</p>
                            <p className="text-xs text-slate-500">{data.system.lockStatus.active ? `Locked (${Math.round(data.system.lockStatus.ttlSeconds / 60)}m remaining)` : "Inactive (Ready)"}</p>
                        </div>
                    </div>
                    <div className={`h-2 w-2 rounded-full ${data.system.lockStatus.active ? "bg-amber-500 animate-pulse" : "bg-green-500"}`} />
                </div>

                {/* Source Distribution */}
                <div>
                    <div className="flex justify-between mb-2">
                        <p className="text-sm font-medium text-slate-700">Source Distribution</p>
                    </div>
                    <div className="space-y-2">
                        {data.posting.sourceCounts.slice(0, 3).map((s) => (
                            <div key={s.name} className="flex items-center justify-between text-sm">
                                <span className="text-slate-600 truncate max-w-[150px]">{s.name}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full"
                                            style={{ width: `${(s.count / data.summary.postsToday) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-slate-900 font-bold">{s.count}</span>
                                </div>
                            </div>
                        ))}
                        {data.posting.sourceCounts.length === 0 && <p className="text-xs text-slate-400 italic">No posts yet</p>}
                    </div>
                </div>

                {/* Performance */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Dedup Rate</p>
                        <p className={`text-xl font-bold ${data.performance.dedupRate > 75 ? "text-amber-600" : "text-slate-800"}`}>
                            {data.performance.dedupRate}%
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">AI Failure</p>
                        <p className={`text-xl font-bold ${data.performance.aiFailureRate > 20 ? "text-red-600" : "text-slate-800"}`}>
                            {data.performance.aiFailureRate}%
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
