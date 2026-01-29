'use client';

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { RssSettings } from "@/types/rss";
import OverviewTab from "@/components/Rss/OverviewTab";
import RunLogsTab from "@/components/Rss/RunLogsTab";
import FeedHealthTab from "@/components/Rss/FeedHealthTab";
import DebugTab from "@/components/Rss/DebugTab";
import PipelineTab from "@/components/Rss/PipelineTab";
import AiStatusTab from "@/components/Rss/AiStatusTab";
import { Activity, List, Radio, Terminal, BarChart2, GitMerge, BrainCircuit, Play } from "lucide-react";

export default function RssDashboardPage() {
    const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'logs' | 'ai' | 'feeds' | 'debug'>('overview');
    const [settings, setSettings] = useState<RssSettings | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [runningManually, setRunningManually] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "system_stats", "rss_settings"), (docSnap) => {
            if (docSnap.exists()) {
                setSettings(docSnap.data() as RssSettings);
            }
            setLoadingSettings(false);
        });
        return () => unsub();
    }, []);

    const handleManualRun = async () => {
        if (!confirm("Start a manual cron run immediately? This will bypass cooldowns.")) return;
        setRunningManually(true);
        try {
            await fetch('/api/cron/rss?force=true');
            alert("Manual run triggered. Check logs in ~30 seconds.");
        } catch (e) {
            alert("Failed to trigger run.");
        } finally {
            setRunningManually(false);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart2 },
        { id: 'pipeline', label: 'Pipeline', icon: GitMerge },
        { id: 'logs', label: 'Run Logs', icon: List },
        { id: 'ai', label: 'AI Status', icon: BrainCircuit },
        { id: 'feeds', label: 'Feed Health', icon: Radio },
        { id: 'debug', label: 'Debug & Tools', icon: Terminal },
    ];

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Activity className="text-emerald-500" />
                        RSS Health Dashboard
                    </h1>
                    <p className="text-gray-500 mt-2">
                        Real-time monitoring and control center for the RSS Auto-Poster system.
                    </p>
                </div>
                <button
                    onClick={handleManualRun}
                    disabled={runningManually}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded shadow hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-wait"
                >
                    <Play size={16} />
                    {runningManually ? 'Running...' : 'Trigger Manual Run'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'border-emerald-500 text-emerald-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-gray-50 min-h-[500px]">
                {activeTab === 'overview' && (
                    <OverviewTab settings={settings || {}} isLoading={loadingSettings} />
                )}
                {activeTab === 'pipeline' && <PipelineTab />}
                {activeTab === 'logs' && <RunLogsTab />}
                {activeTab === 'ai' && <AiStatusTab />}
                {activeTab === 'feeds' && <FeedHealthTab />}
                {activeTab === 'debug' && <DebugTab />}
            </div>
        </div>
    );
}
