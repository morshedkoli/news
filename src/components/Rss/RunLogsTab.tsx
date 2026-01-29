'use client';

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { RssRunLog } from "@/types/rss";
import { formatDistanceToNow, format } from "date-fns";
import { Check, X, ChevronDown, ChevronRight, AlertTriangle, Cloud, Zap, Clock, Ban, Timer } from "lucide-react";

export default function RunLogsTab() {
    const [logs, setLogs] = useState<RssRunLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    useEffect(() => {
        loadLogs();
    }, []);

    async function loadLogs() {
        setLoading(true);
        try {
            const q = query(collection(db, "rss_run_logs"), orderBy("started_at", "desc"), limit(50));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ run_id: doc.id, ...doc.data() } as any)) as RssRunLog[];
            setLogs(data);
        } catch (error) {
            console.error("Error loading RSS run logs:", error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-400">Loading timeline...</div>;

    const getExitReason = (log: RssRunLog) => {
        if (log.post_published) return {
            message: `Posted successfully`,
            status: 'success',
            icon: Check
        };

        if (log.skip_reasons?.some(r => r.includes('cooldown'))) {
            // Calculate remaining minutes roughly if available, or just say active
            return { message: 'Skipped — Cooldown active', status: 'neutral', icon: Clock };
        }
        if (log.skip_reasons?.some(r => r.includes('time_guard'))) return { message: 'Exit — Time guard hit', status: 'warning', icon: Timer };
        if (log.skip_reasons?.some(r => r.includes('fatal'))) return { message: 'Crashed — Fatal Error', status: 'error', icon: X };
        if (log.ai_failures > 0) return { message: 'Deferred — AI timeout, summary pending', status: 'warning', icon: AlertTriangle };

        return { message: 'No Action — No new items', status: 'neutral', icon: Ban };
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Cron Run Timeline (Last 24h)</h3>
                <span className="text-xs text-gray-400">Latest 50 runs</span>
            </div>
            <div className="divide-y divide-gray-100">
                {logs.map((log) => {
                    const exit = getExitReason(log);
                    const isExpanded = expandedRow === log.run_id;
                    const timeStr = format(new Date(log.started_at), "HH:mm");

                    return (
                        <div key={log.run_id} className="group">
                            {/* Summary Line */}
                            <div
                                onClick={() => setExpandedRow(isExpanded ? null : log.run_id)}
                                className={`
                                    flex items-center gap-3 p-3 text-sm cursor-pointer hover:bg-gray-50 transition-colors
                                    ${isExpanded ? 'bg-blue-50/50' : ''}
                                `}
                            >
                                <span className="font-mono text-gray-400 w-12 text-right flex-shrink-0">{timeStr}</span>

                                <span className={`
                                    flex items-center gap-1.5 font-bold px-2 py-0.5 rounded text-xs w-24 justify-center flex-shrink-0
                                    ${exit.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                                        exit.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                                            exit.status === 'error' ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-600'}
                                `}>
                                    <exit.icon size={10} />
                                    {exit.status === 'success' ? 'POSTED' :
                                        exit.status === 'warning' ? 'WARN' :
                                            exit.status === 'error' ? 'ERROR' : 'SKIP'}
                                </span>

                                <span className="text-gray-700 truncate flex-1 font-medium">
                                    {exit.message}
                                </span>

                                <div className="text-xs text-gray-400 flex items-center gap-2">
                                    <span className="bg-gray-100 px-1.5 rounded">{(log.duration_ms / 1000).toFixed(1)}s</span>
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </div>
                            </div>

                            {/* Details Expanded */}
                            {isExpanded && (
                                <div className="pl-16 pr-4 pb-4 pt-1 border-b border-gray-100 bg-gray-50/30 text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="font-bold text-xs uppercase text-gray-400 mb-2">Run Stats</h4>
                                        <div className="space-y-1 text-gray-600">
                                            <div className="flex justify-between border-b border-gray-200 border-dashed">
                                                <span>Feeds Checked</span> <span>{log.feeds_checked}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-gray-200 border-dashed">
                                                <span>Items Scanned</span> <span>{log.items_checked}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-gray-200 border-dashed">
                                                <span>AI Failures</span> <span className={log.ai_failures > 0 ? "text-red-500 font-bold" : ""}>{log.ai_failures}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-xs uppercase text-gray-400 mb-2">Diagnostic Flags</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {log.skip_reasons?.map((r, i) => (
                                                <span key={i} className="px-2 py-1 bg-white border rounded text-xs font-mono text-gray-500">{r}</span>
                                            ))}
                                            {log.failsafe_activated && <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">FAILSAFE HIT</span>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

