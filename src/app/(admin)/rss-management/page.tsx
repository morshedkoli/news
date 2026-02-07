"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Rss, Activity, GitMerge, Settings, Play } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import RssPage from "@/app/(admin)/rss/page";
import OverviewTab from "@/components/Rss/OverviewTab";
import FeedHealthTab from "@/components/Rss/FeedHealthTab";
import RunLogsTab from "@/components/Rss/RunLogsTab";
import PipelineTab from "@/components/Rss/PipelineTab";
import GlobalSettingsPage from "@/app/(admin)/rss/settings/page";
import { RssSettings } from "@/types/rss";

export default function RssManagementPage() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<'feeds' | 'health' | 'pipeline' | 'settings'>('feeds');
    const [settings, setSettings] = useState<RssSettings | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [runningManually, setRunningManually] = useState(false);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'health' || tab === 'pipeline' || tab === 'settings' || tab === 'feeds') {
            setActiveTab(tab);
        }
    }, [searchParams]);

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
        } catch {
            alert("Failed to trigger run.");
        } finally {
            setRunningManually(false);
        }
    };

    const tabs = [
        { id: 'feeds', label: 'Feeds', icon: Rss },
        { id: 'health', label: 'Health', icon: Activity },
        { id: 'pipeline', label: 'Pipeline', icon: GitMerge },
        { id: 'settings', label: 'RSS Settings', icon: Settings }
    ];

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">RSS Management</h1>
                <p className="text-gray-500 mt-1">Manage feeds, health, pipeline, and settings in one place.</p>
            </div>

            <div className="flex border-b border-gray-200 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
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

            <div className="bg-gray-50 min-h-[500px]">
                {activeTab === 'feeds' && <RssPage />}
                {activeTab === 'health' && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
                                    <Activity className="text-emerald-500" /> RSS Health
                                </h2>
                                <p className="text-sm text-slate-500">System overview, feed health, and run logs.</p>
                            </div>
                            <button
                                onClick={handleManualRun}
                                disabled={runningManually}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded shadow hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <Play size={16} />
                                {runningManually ? 'Running...' : 'Trigger Manual Run'}
                            </button>
                        </div>
                        <OverviewTab settings={settings || {}} isLoading={loadingSettings} />
                        <FeedHealthTab />
                        <RunLogsTab />
                    </div>
                )}
                {activeTab === 'pipeline' && <PipelineTab />}
                {activeTab === 'settings' && <GlobalSettingsPage />}
            </div>
        </div>
    );
}
