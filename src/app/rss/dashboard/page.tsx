'use client';

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { RssSettings } from "@/types/rss";
import OverviewTab from "@/components/Rss/OverviewTab";
import RunLogsTab from "@/components/Rss/RunLogsTab";
import FeedHealthTab from "@/components/Rss/FeedHealthTab";
import DebugTab from "@/components/Rss/DebugTab";
import { Activity, List, Radio, Terminal, BarChart2 } from "lucide-react";

export default function RssDashboardPage() {
    const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'feeds' | 'debug'>('overview');
    const [settings, setSettings] = useState<RssSettings | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "system_stats", "rss_settings"), (docSnap) => {
            if (docSnap.exists()) {
                setSettings(docSnap.data() as RssSettings);
            }
            setLoadingSettings(false);
        });
        return () => unsub();
    }, []);

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart2 },
        { id: 'logs', label: 'Run Logs', icon: List },
        { id: 'feeds', label: 'Feed Health', icon: Radio },
        { id: 'debug', label: 'Debug & Tools', icon: Terminal },
    ];

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Activity className="text-emerald-500" />
                    RSS Health Dashboard
                </h1>
                <p className="text-zinc-400 mt-2">
                    Real-time monitoring and control center for the RSS Auto-Poster system.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-emerald-500 text-emerald-400'
                                : 'border-transparent text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-zinc-950">
                {activeTab === 'overview' && (
                    <OverviewTab settings={settings || {}} isLoading={loadingSettings} />
                )}
                {activeTab === 'logs' && <RunLogsTab />}
                {activeTab === 'feeds' && <FeedHealthTab />}
                {activeTab === 'debug' && <DebugTab />}
            </div>
        </div>
    );
}
