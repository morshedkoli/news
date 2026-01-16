"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    orderBy,
    setDoc,
    getDoc
} from "firebase/firestore";
import { Plus, Trash2, RefreshCw, Rss, Globe, Settings, Save } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RssFeed {
    id: string;
    url: string;
    last_checked?: any;
}

export default function RssPage() {
    const [feeds, setFeeds] = useState<RssFeed[]>([]);
    const [newUrl, setNewUrl] = useState("");
    const [waitTime, setWaitTime] = useState(5);
    const [globalWaitTime, setGlobalWaitTime] = useState(5);
    const [loading, setLoading] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [triggering, setTriggering] = useState(false);
    const [message, setMessage] = useState("");
    const [progress, setProgress] = useState<any>(null);

    useEffect(() => {
        // 1. Feeds Listener
        const q = query(collection(db, "rss_feeds"), orderBy("url"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const feedsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as RssFeed[];
            setFeeds(feedsData);
        });

        // 2. Progress Listener
        const unsubProgress = onSnapshot(doc(db, "system_stats", "rss_progress"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setProgress(data);

                // Auto-sync triggering state with backend status
                if (data.status === 'running' || data.status === 'waiting') {
                    setTriggering(true);
                } else if (data.status === 'complete' || data.status === 'error') {
                    setTriggering(false);
                }
            }
        });

        // 3. Global Config Listener
        const unsubConfig = onSnapshot(doc(db, "system_stats", "rss_config"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.default_wait_minutes !== undefined) {
                    setGlobalWaitTime(data.default_wait_minutes);
                }
            }
        });


        return () => {
            unsubscribe();
            unsubProgress();
            unsubConfig();
        };
    }, []);

    const handleSaveGlobalConfig = async () => {
        setSavingConfig(true);
        try {
            await setDoc(doc(db, "system_stats", "rss_config"), {
                default_wait_minutes: globalWaitTime,
                updated_at: serverTimestamp()
            }, { merge: true });
            setMessage("Global settings saved.");
            setTimeout(() => setMessage(""), 3000);
        } catch (error) {
            console.error("Failed to save config:", error);
            alert("Failed to save settings");
        } finally {
            setSavingConfig(false);
        }
    }

    const handleAddFeed = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUrl) return;
        setLoading(true);

        try {
            await addDoc(collection(db, "rss_feeds"), {
                url: newUrl,
                wait_minutes: waitTime || 5,
                last_checked: serverTimestamp(),
            });
            setNewUrl("");
        } catch (error) {
            console.error("Error adding feed:", error);
            alert("Failed to add feed");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        try {
            await deleteDoc(doc(db, "rss_feeds", id));
        } catch (error) {
            console.error("Error deleting feed:", error);
        }
    };

    const handleTriggerCron = async () => {
        setTriggering(true);
        setMessage("Triggering sync...");
        try {
            // Reset local UI logs immediately for better UX
            setProgress({ status: 'starting', logs: ['Initializing request...'] });

            const res = await fetch("/api/cron/rss");
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Request failed");

            setMessage(data.message || `Sync initiated.`);
            setTimeout(() => setMessage(""), 5000);
        } catch (e: any) {
            console.error(e);
            setMessage("Sync failed: " + e.message);
            setTriggering(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">RSS Feeds</h1>
                    <p className="text-slate-500">Manage automated news sources and sync generation.</p>
                </div>
                <button
                    onClick={handleTriggerCron}
                    disabled={triggering}
                    className="flex items-center justify-center rounded-lg bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition"
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${triggering ? 'animate-spin' : ''}`} />
                    {triggering ? 'Syncing...' : 'Sync All Feeds'}
                </button>
            </div>

            {message && (
                <div className={`rounded-lg px-4 py-3 text-sm border ${message.includes('failed') ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                    {message}
                </div>
            )}

            {/* Global Settings */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Settings className="h-5 w-5 text-slate-500" />
                    <h2 className="text-lg font-semibold text-slate-900">Global Configuration</h2>
                </div>
                <div className="flex items-end gap-4 max-w-md">
                    <div className="flex-1">
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                            Default Wait Time (Minutes)
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={globalWaitTime}
                            onChange={(e) => setGlobalWaitTime(parseInt(e.target.value) || 0)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <p className="mt-1 text-xs text-slate-500">Fallback delay if individual feed setting is missing.</p>
                    </div>
                    <button
                        onClick={handleSaveGlobalConfig}
                        disabled={savingConfig}
                        className="flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition h-[38px]"
                    >
                        {savingConfig ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        {savingConfig ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>

            {/* PROGRESS BAR SECTION */}
            {progress && (progress.status === 'running' || progress.status === 'waiting' || progress.status === 'complete' || progress.status === 'error') && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-md ring-1 ring-slate-100">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            {progress.status === 'waiting' && <span className="flex items-center gap-2 text-yellow-600 animate-pulse">Wait (Safety Delay)</span>}
                            {(progress.status === 'running' || progress.status === 'starting') && <span className="flex items-center gap-2 text-indigo-600 animate-pulse">Processing...</span>}
                            {progress.status === 'complete' && <span className="flex items-center gap-2 text-emerald-600">✅ Complete</span>}
                            {progress.status === 'error' && <span className="flex items-center gap-2 text-red-600">❌ Error</span>}
                        </h3>
                        <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            Feed {progress.current_feed_index || 0} / {progress.total_feeds || '?'}
                        </span>
                    </div>

                    {/* BAR */}
                    <div className="mb-6 h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${progress.status === 'waiting' ? 'bg-amber-400 striped-bar' :
                                progress.status === 'error' ? 'bg-red-500' :
                                    progress.status === 'complete' ? 'bg-emerald-500' :
                                        'bg-indigo-600'
                                }`}
                            style={{ width: `${Math.min(100, Math.max(5, ((progress.current_feed_index || 0) / (progress.total_feeds || 1)) * 100))}%` }}
                        ></div>
                    </div>

                    {/* DETAILS GRID */}
                    <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 mb-4">
                        <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">AI Provider</p>
                            <p className="font-mono text-slate-700 font-semibold truncate flex items-center gap-2">
                                {progress.current_provider ? (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        {progress.current_provider}
                                    </>
                                ) : 'Pending...'}
                                {progress.current_model && <span className="text-slate-400 font-normal ml-1">({progress.current_model})</span>}
                            </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Feed</p>
                            <p className="font-medium text-slate-700 truncate" title={progress.current_feed_url}>
                                {progress.current_feed_url || 'Initializing...'}
                            </p>
                        </div>
                    </div>

                    {/* LOGS CONSOLE */}
                    <div className="rounded-lg bg-slate-900 border border-slate-800 p-4 font-mono text-xs text-slate-300 shadow-inner">
                        <div className="flex flex-col-reverse max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {/* Reverse map to show newest first */}
                            {[...(progress.logs || [])].reverse().slice(0, 10).map((log: string, idx: number) => (
                                <div key={idx} className="mb-1.5 border-b border-slate-800 pb-1.5 last:border-0 last:pb-0 break-words leading-relaxed">
                                    <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                    {log.includes('✅') ? <span className="text-emerald-400">{log}</span> :
                                        log.includes('❌') ? <span className="text-red-400">{log}</span> :
                                            log.includes('⏳') ? <span className="text-yellow-400">{log}</span> :
                                                log}
                                </div>
                            ))}
                            {(!progress.logs || progress.logs.length === 0) && <span className="text-slate-600 italic">Waiting for logs...</span>}
                        </div>
                    </div>
                </div>
            )}


            <div className="grid gap-6 lg:grid-cols-3 mt-8">
                {/* Add Feed Form */}
                <div className="lg:col-span-1">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sticky top-6">
                        <h2 className="mb-4 text-lg font-semibold text-slate-900">Add New Feed</h2>
                        <form onSubmit={handleAddFeed} className="space-y-4">
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="url"
                                    id="url"
                                    value={newUrl}
                                    onChange={(e) => setNewUrl(e.target.value)}
                                    placeholder="https://example.com/rss"
                                    className="block w-full rounded-lg border border-slate-300 pl-10 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="wait" className="mb-1 block text-sm font-medium text-slate-700">
                                    Wait Time (Minutes)
                                </label>
                                <input
                                    type="number"
                                    id="wait"
                                    min="0"
                                    value={waitTime}
                                    onChange={(e) => setWaitTime(parseInt(e.target.value) || 5)}
                                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <p className="mt-1 text-xs text-slate-500">Delay before processing next feed.</p>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition"
                            >
                                {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                {loading ? "Adding..." : "Add Source"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Feed List */}
                <div className="lg:col-span-2">
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="border-b border-slate-200 px-6 py-4 bg-slate-50">
                            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Active RSS Feeds</h2>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {feeds.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                        <Rss className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-base font-medium text-slate-900">No feeds configured</h3>
                                    <p className="mt-1 text-sm text-slate-500">Add a valid RSS URL to start automatic news generation.</p>
                                </div>
                            ) : (
                                feeds.map((feed) => (
                                    <div key={feed.id} className="flex items-center justify-between p-6 hover:bg-slate-50 transition group">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                                                <Rss className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-slate-900" title={feed.url}>
                                                    {feed.url}
                                                </p>
                                                {feed.last_checked && (
                                                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        Last synced: {formatDistanceToNow(feed.last_checked.toDate(), { addSuffix: true })}
                                                    </p>
                                                )}
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Wait: {(feed as any).wait_minutes || 5} min
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(feed.id)}
                                            className="ml-4 rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-600 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            title="Delete Feed"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
