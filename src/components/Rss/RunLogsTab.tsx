'use client';

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { RssRunLog } from "@/types/rss";
import { formatDistanceToNow, format } from "date-fns";
import { Check, X, ChevronDown, ChevronRight, AlertTriangle, Cloud, Zap } from "lucide-react";

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
            const q = query(
                collection(db, "rss_run_logs"),
                orderBy("started_at", "desc"),
                limit(50)
            );

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                run_id: doc.id,
                ...doc.data()
            } as any)) as RssRunLog[];
            setLogs(data);
        } catch (error) {
            console.error("Error loading RSS run logs:", error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-zinc-500">Loading logs...</div>;
    }

    return (
        <div className="bg-zinc-900/50 rounded-lg border border-zinc-800/50">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="border-b border-zinc-800/50 text-left text-xs text-zinc-500 uppercase">
                        <tr>
                            <th className="p-3 w-8"></th>
                            <th className="p-3">Timestamp</th>
                            <th className="p-3">Result</th>
                            <th className="p-3">Stats</th>
                            <th className="p-3">Duration</th>
                            <th className="p-3">Flags</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (
                            <React.Fragment key={log.run_id}>
                                <tr
                                    className={`hover:bg-zinc-800/50 cursor-pointer transition-colors ${expandedRow === log.run_id ? 'bg-zinc-800/50' : ''}`}
                                    onClick={() => setExpandedRow(expandedRow === log.run_id ? null : log.run_id)}
                                >
                                    <td className="p-3 text-zinc-500">
                                        {expandedRow === log.run_id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </td>
                                    <td className="p-3">
                                        <div className="text-zinc-200">{formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}</div>
                                        <div className="text-xs text-zinc-500">{format(new Date(log.started_at), "HH:mm:ss")}</div>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            {log.post_published ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                                                    <Check size={12} /> Posted
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-700/50 text-zinc-400 text-xs font-medium">
                                                    Checked
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-zinc-300">
                                                {log.feeds_checked} feeds, {log.items_checked} items
                                            </span>
                                            {log.ai_failures > 0 && (
                                                <span className="text-xs text-red-400 flex items-center gap-1">
                                                    <AlertTriangle size={10} /> {log.ai_failures} AI Fails
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 text-zinc-400">
                                        {(log.duration_ms / 1000).toFixed(1)}s
                                    </td>
                                    <td className="p-3">
                                        <div className="flex gap-1">
                                            {log.failsafe_activated && (
                                                <span title="Failsafe Active" className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30">
                                                    FAILSAFE
                                                </span>
                                            )}
                                            {log.run_type === 'dry_run' && (
                                                <span title="Dry Run" className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/30">
                                                    DRY
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                {expandedRow === log.run_id && (
                                    <tr className="bg-zinc-950/30">
                                        <td colSpan={6} className="p-4 pl-12 border-b border-zinc-800">
                                            <div className="grid grid-cols-2 gap-8 text-sm">
                                                <div className="space-y-3">
                                                    <h4 className="text-zinc-500 uppercase text-xs font-bold tracking-wider">Run Details</h4>
                                                    <DetailRow label="Run ID" value={log.run_id} mono />
                                                    <DetailRow label="Started At" value={log.started_at} />
                                                    <DetailRow label="Finished At" value={log.finished_at} />
                                                    {log.published_post_id && (
                                                        <DetailRow label="Published Post ID" value={log.published_post_id} mono />
                                                    )}
                                                    {log.ai_provider_used && (
                                                        <div className="flex items-center justify-between text-zinc-400 py-1">
                                                            <span>AI Provider</span>
                                                            <span className="text-zinc-200 flex items-center gap-1.5 bg-zinc-800 px-2 py-0.5 rounded text-xs border border-zinc-700">
                                                                <Cloud size={10} /> {log.ai_provider_used}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-3">
                                                    <h4 className="text-zinc-500 uppercase text-xs font-bold tracking-wider">Decisions</h4>
                                                    {log.skip_reasons && log.skip_reasons.length > 0 ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {log.skip_reasons.map((reason, i) => (
                                                                <span key={i} className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs border border-zinc-700">
                                                                    {reason}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-500 italic">No skip reasons logged (Success)</span>
                                                    )}

                                                    {log.failsafe_activated && (
                                                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded text-red-400 text-xs mt-2">
                                                            <div className="font-bold flex items-center gap-2 mb-1">
                                                                <Zap size={12} /> Failsafe Activated
                                                            </div>
                                                            System bypassed normal constraints to prioritize delivery.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                        {logs.length === 0 && !loading && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-zinc-500">No logs found</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function DetailRow({ label, value, mono = false }: { label: string, value: any, mono?: boolean }) {
    return (
        <div className="flex items-center justify-between py-1 border-b border-zinc-800/50 last:border-0">
            <span className="text-zinc-500">{label}</span>
            <span className={`text-zinc-300 ${mono ? 'font-mono text-xs' : ''} truncate max-w-[200px]`} title={value}>
                {value}
            </span>
        </div>
    );
}
