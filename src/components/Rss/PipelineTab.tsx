'use client';

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { PlayCircle, CheckCircle, Filter, FileText, XCircle, BrainCircuit, Activity } from "lucide-react";
import { format } from "date-fns";

export default function PipelineTab() {
    const [stats, setStats] = useState({
        scanned: 0,
        duplicates: 0,
        aiFailures: 0,
        contentFilters: 0, // too short, etc
        published: 0,
        errors: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPipelineStats();
    }, []);

    const loadPipelineStats = async () => {
        setLoading(true);
        try {
            // Aggregate logs from the last 24 hours (approx 48-100 runs)
            // Note: In a real heavy production app, this should be a pre-calculated aggregate in Firestore.
            // For now, client-side aggregation of last 50 logs is sufficient for the admin.
            const q = query(
                collection(db, "rss_run_logs"),
                orderBy("started_at", "desc"),
                limit(50)
            );

            const snapshot = await getDocs(q);
            const newStats = {
                scanned: 0,
                duplicates: 0,
                aiFailures: 0,
                contentFilters: 0,
                published: 0,
                errors: 0
            };

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                newStats.scanned += (data.items_checked || 0);
                newStats.aiFailures += (data.ai_failures || 0);

                if (data.post_published) newStats.published++;

                if (Array.isArray(data.skip_reasons)) {
                    data.skip_reasons.forEach((r: string) => {
                        if (r.includes("duplicate")) newStats.duplicates++;
                        if (r.includes("content_too_short") || r.includes("fetch_failed")) newStats.contentFilters++;
                        if (r.includes("error") || r.includes("fatal")) newStats.errors++;
                    });
                }
            });

            setStats(newStats);
        } catch (error) {
            console.error("Failed to load pipeline stats:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-400">Analyzing pipeline logs...</div>;

    return (
        <div className="space-y-8">
            <div className="text-center mb-8">
                <h2 className="text-lg font-bold text-gray-800">Processing Pipeline (Last 50 Runs)</h2>
                <p className="text-sm text-gray-500">Visualization of item flow from scanning to publication</p>
            </div>

            <div className="relative flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0">
                {/* 1. Scanned */}
                <PipelineNode
                    icon={<PlayCircle size={24} />}
                    label="Items Scanned"
                    count={stats.scanned}
                    color="bg-blue-100 text-blue-700 border-blue-200"
                />

                <Arrow label="Filter" />

                {/* 2. Deduplication */}
                <div className="flex flex-col gap-4">
                    <PipelineNode
                        icon={<Filter size={24} />}
                        label="Duplicates"
                        count={stats.duplicates}
                        color="bg-amber-100 text-amber-700 border-amber-200"
                        isDrop
                    />
                    <PipelineNode
                        icon={<XCircle size={24} />}
                        label="Invalid / Errors"
                        count={stats.contentFilters + stats.errors}
                        color="bg-gray-100 text-gray-600 border-gray-200"
                        isDrop
                    />
                </div>

                <Arrow label="Process" />

                {/* 3. AI Processing */}
                <div className="flex flex-col gap-4">
                    <PipelineNode
                        icon={<BrainCircuit size={24} />}
                        label="AI Failures"
                        count={stats.aiFailures}
                        color="bg-purple-100 text-purple-700 border-purple-200"
                        isDrop
                    />
                </div>

                <Arrow label="Publish" />

                {/* 4. Published */}
                <PipelineNode
                    icon={<CheckCircle size={24} />}
                    label="Published"
                    count={stats.published}
                    color="bg-emerald-100 text-emerald-700 border-emerald-200"
                    isSuccess
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div>
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <Activity size={18} className="text-blue-500" /> Conversion Rate
                    </h3>
                    <div className="text-3xl font-bold text-gray-900">
                        {stats.scanned > 0 ? ((stats.published / stats.scanned) * 100).toFixed(1) : 0}%
                    </div>
                    <p className="text-sm text-gray-500 mt-1">of scanned items become published posts</p>
                </div>
                <div>
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <XCircle size={18} className="text-amber-500" /> Content Drop Rate
                    </h3>
                    <div className="text-3xl font-bold text-gray-900">
                        {stats.scanned > 0 ? (((stats.duplicates + stats.contentFilters) / stats.scanned) * 100).toFixed(1) : 0}%
                    </div>
                    <p className="text-sm text-gray-500 mt-1">rejected as duplicate or low quality</p>
                </div>
            </div>
        </div>
    );
}

function PipelineNode({ icon, label, count, color, isDrop, isSuccess }: any) {
    return (
        <div className={`
            relative z-10 w-48 p-4 rounded-xl border-2 flex flex-col items-center gap-2 text-center shadow-sm transition-all
            ${color} ${isDrop ? 'opacity-90 scale-90' : 'scale-100'} ${isSuccess ? 'ring-4 ring-emerald-50 scale-105' : ''}
        `}>
            <div className="p-2 bg-white/50 rounded-full">{icon}</div>
            <div className="font-bold text-2xl">{count}</div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</div>

            {isDrop && (
                <div className="absolute -top-3 right-4 bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded-full">
                    DROPPED
                </div>
            )}
        </div>
    );
}

function Arrow({ label }: { label: string }) {
    return (
        <div className="hidden md:flex flex-col items-center justify-center w-24 relative">
            <div className="text-[10px] text-gray-400 font-medium uppercase mb-1">{label}</div>
            <div className="h-0.5 w-full bg-gray-300"></div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-l-8 border-transparent border-l-gray-300 transform translate-x-1"></div>
        </div>
    );
}
