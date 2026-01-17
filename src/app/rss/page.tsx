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
    where,
    serverTimestamp,
    orderBy,
    updateDoc,
    Timestamp,
    setDoc
} from "firebase/firestore";
import { Plus, Trash2, RefreshCw, Rss, Globe, PauseCircle, PlayCircle, Clock, Calendar, AlertCircle, Settings } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import Link from 'next/link';

interface RssFeed {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    start_time: string;
    interval_minutes: number;
    safety_delay_minutes: number;
    last_run_at?: any;
    next_run_at?: any;
    status: 'idle' | 'running' | 'error' | 'cooldown';
    error_log?: string;
}

export default function RssPage() {
    const [feeds, setFeeds] = useState<RssFeed[]>([]);
    const [progress, setProgress] = useState<any>(null);
    const [triggering, setTriggering] = useState(false);
    const [aiCount, setAiCount] = useState<number | null>(null);
    const [autoRun, setAutoRun] = useState(false); // Auto-Pilot State

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        url: "",
        start_time: "09:00",
        interval_minutes: 60,
        safety_delay_minutes: 5,
        enabled: true
    });


    useEffect(() => {
        // Feeds Listener
        const q = query(collection(db, "rss_feeds"), orderBy("name"));
        const unsub = onSnapshot(q, (snapshot) => {
            const feedsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as RssFeed[];
            setFeeds(feedsData);
        });

        // Progress Listener
        const unsubProgress = onSnapshot(doc(db, "system_stats", "rss_progress"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setProgress(data);
                if (data.status === 'running' || data.status === 'waiting') {
                    setTriggering(true);
                } else {
                    setTriggering(false);
                }
            }
        });

        // Active AI Listener
        const qAi = query(collection(db, "ai_providers"), where("enabled", "==", true));
        const unsubAi = onSnapshot(qAi, (snap) => {
            setAiCount(snap.size);
        });

        return () => { unsub(); unsubProgress(); unsubAi(); };
    }, []);

    // Auto-Pilot Effect
    useEffect(() => {
        if (!autoRun) return;

        const interval = setInterval(() => {
            if (!progress) return;

            // Check logic:
            // 1. Not running
            // 2. Cooldown expired (or null)
            // 3. AI is online

            const now = new Date();
            // Fix: 'waiting' essentially means "Waiting for Cooldown". 
            // So IF cooldown is over, strict 'running' is the only blocker.
            const isRunning = progress.status === 'running';

            let isCooldown = false;
            if (progress.cooldown_until) {
                const cooldownDate = new Date(progress.cooldown_until.seconds * 1000);
                if (now < cooldownDate) isCooldown = true;
            }

            if (!isRunning && !isCooldown && aiCount && aiCount > 0 && !triggering) {
                console.log("✈️ Auto-Pilot: Triggering Cron...");
                handleTriggerCron();
            }

        }, 10000); // Check every 10s

        return () => clearInterval(interval);
    }, [autoRun, progress, aiCount, triggering]);

    const resetForm = () => {
        setFormData({
            name: "",
            url: "",
            start_time: "09:00",
            interval_minutes: 60,
            safety_delay_minutes: 5,
            enabled: true
        });
        setEditId(null);
        setIsEditing(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                status: 'idle',
                next_run_at: serverTimestamp()
            };

            if (editId) {
                await updateDoc(doc(db, "rss_feeds", editId), {
                    ...formData,
                });
            } else {
                await addDoc(collection(db, "rss_feeds"), {
                    ...payload,
                    last_run_at: null
                });
            }
            resetForm();
        } catch (error) {
            console.error(error);
            alert("Failed to save");
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Delete this feed?")) {
            await deleteDoc(doc(db, "rss_feeds", id));
        }
    };

    const handleToggle = async (feed: RssFeed) => {
        await updateDoc(doc(db, "rss_feeds", feed.id), {
            enabled: !feed.enabled
        });
    };

    const handleTriggerCron = async () => {
        setTriggering(true);
        // Optimistic UI
        setProgress({ status: 'starting', logs: ['Manually triggered...'] });
        fetch("/api/cron/rss").catch(console.error);
    };

    return (
        <div className="space-y-8">

            {/* 1. STATUS DASHBOARD (Top Section) */}
            <div className="grid gap-4 md:grid-cols-12">

                {/* System Status Card */}
                <div className="md:col-span-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">System Status</h3>
                        {progress?.status === 'running' && <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />}
                    </div>
                    <div className="text-2xl font-black text-slate-800 uppercase flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${progress?.status === 'running' ? 'bg-indigo-500 animate-pulse' : progress?.status === 'error' ? 'bg-red-500' : 'bg-slate-400'}`}></div>
                        {progress?.status || 'LOADING...'}
                    </div>
                    {progress?.cooldown_until && (
                        <p className="text-xs text-amber-600 mt-2 font-medium bg-amber-50 inline-block px-2 py-1 rounded">
                            Cooldown: {new Date(progress.cooldown_until.seconds * 1000).toLocaleTimeString()}
                        </p>
                    )}
                </div>

                {/* AI Status Card */}
                <div className="md:col-span-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">AI Engines</h3>
                        {aiCount !== null && aiCount > 0 ? <Globe className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        {aiCount === null ? 'Checking...' : aiCount > 0 ? (
                            <span className="text-emerald-600 flex items-center gap-2">
                                ONLINE <span className="text-sm font-normal text-slate-400">({aiCount} Active)</span>
                            </span>
                        ) : (
                            <span className="text-red-500">OFFLINE</span>
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Required for summarization.</p>
                </div>

                {/* Quick Actions */}
                <div className="md:col-span-4 rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm flex flex-col justify-center gap-2">
                    <button
                        onClick={handleTriggerCron}
                        disabled={triggering || (aiCount === 0)}
                        className="w-full flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
                    >
                        <PlayCircle className={`mr-2 h-4 w-4 ${triggering ? 'animate-spin' : ''}`} />
                        {triggering ? 'System Running...' : 'Run Master Cron Now'}
                    </button>
                    {(aiCount === 0) && <p className="text-[10px] text-red-500 text-center">Cannot run: No AI Providers online</p>}

                    {/* Auto-Pilot Toggle */}
                    <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-slate-200">
                        <span className={`text-xs font-bold uppercase ${autoRun ? 'text-indigo-600 animate-pulse' : 'text-slate-400'}`}>
                            {autoRun ? 'Auto-Pilot Active' : 'Auto-Pilot Off'}
                        </span>
                        <button
                            onClick={() => setAutoRun(!autoRun)}
                            className={`w-10 h-6 rounded-full relative transition-colors ${autoRun ? 'bg-indigo-600' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${autoRun ? 'translate-x-4' : ''}`}></div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Live Logs (Collapsible or visible) */}
            {progress && (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg text-slate-300 font-mono text-xs">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                        <span className="font-bold text-white uppercase tracking-wider">Live System Logs</span>
                        <span className="text-slate-500 text-[10px]">Auto-updating</span>
                    </div>
                    <div className="h-32 overflow-y-auto custom-scrollbar flex flex-col-reverse">
                        {[...(progress.logs || [])].reverse().slice(0, 20).map((log: string, idx: number) => (
                            <div key={idx} className="py-0.5 border-b border-slate-800/50">{log}</div>
                        ))}
                    </div>
                </div>
            )}

            {/* Header Title */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">RSS Feeds</h1>
                    <p className="text-slate-500">Manage your news sources.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/rss/settings">
                        <button className="flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                            <Settings className="mr-2 h-4 w-4" />
                            Global Settings
                        </button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">

                {/* LIST */}
                <div className="lg:col-span-2 space-y-4">
                    {feeds.map((feed) => (
                        <div key={feed.id} className={`group relative rounded-xl border p-5 transition-all ${feed.status === 'running' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' :
                            !feed.enabled ? 'border-slate-100 bg-slate-50 opacity-75' :
                                'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm'
                            }`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-slate-900 text-lg">{feed.name || "Unnamed Feed"}</h3>
                                        {feed.status === 'running' && <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700 animate-pulse">RUNNING</span>}
                                        {feed.status === 'error' && <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">ERROR</span>}
                                        {!feed.enabled && <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-500">DISABLED</span>}
                                    </div>
                                    <p className="text-sm text-slate-500 truncate max-w-md" title={feed.url}>{feed.url}</p>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setFormData({ ...feed }); setEditId(feed.id); setIsEditing(true); }} className="p-2 text-slate-400 hover:text-indigo-600">
                                        Edit
                                    </button>
                                    <button onClick={() => handleDelete(feed.id)} className="p-2 text-slate-400 hover:text-red-600">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Schedule</p>
                                    <p className="font-medium text-slate-700 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        {feed.start_time} (Every {feed.interval_minutes}m)
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Next Run</p>
                                    <p className="font-medium text-indigo-600 flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {feed.next_run_at ? format(feed.next_run_at.toDate(), 'HH:mm') : 'Pending'}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Safety</p>
                                    <p className="font-medium text-slate-700">
                                        +{feed.safety_delay_minutes} min delay
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Last Run</p>
                                    <p className="font-medium text-slate-500">
                                        {feed.last_run_at ? formatDistanceToNow(feed.last_run_at.toDate(), { addSuffix: true }) : 'Never'}
                                    </p>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                                <button
                                    onClick={() => handleToggle(feed)}
                                    className={`text-xs font-bold flex items-center gap-1 ${feed.enabled ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                                >
                                    {feed.enabled ? <><PauseCircle className="w-4 h-4" /> Disable Feed</> : <><PlayCircle className="w-4 h-4" /> Enable Feed</>}
                                </button>

                                {feed.error_log && (
                                    <span className="text-red-500 text-xs flex items-center gap-1" title={feed.error_log}>
                                        <AlertCircle className="w-3 h-3" />
                                        Last Error: {feed.error_log.substring(0, 30)}...
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}

                    {feeds.length === 0 && (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            <Rss className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500">No feeds found. Add one on the right.</p>
                        </div>
                    )}
                </div>

                {/* FORM */}
                <div className="lg:col-span-1">
                    <div className="sticky top-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">
                            {isEditing ? 'Edit Feed' : 'Add New Feed'}
                        </h2>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="label">Feed Name</label>
                                <input
                                    required
                                    className="input-field"
                                    placeholder="e.g. Prothom Alo"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label">RSS URL</label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="url" required
                                        className="input-field pl-9"
                                        placeholder="https://..."
                                        value={formData.url}
                                        onChange={e => setFormData({ ...formData, url: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Start Time</label>
                                    <input
                                        type="time" required
                                        className="input-field"
                                        value={formData.start_time}
                                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Interval (Min)</label>
                                    <input
                                        type="number" min="15" required
                                        className="input-field"
                                        value={formData.interval_minutes}
                                        onChange={e => setFormData({ ...formData, interval_minutes: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Safety Delay (Min)</label>
                                <input
                                    type="number" min="1" required
                                    className="input-field"
                                    value={formData.safety_delay_minutes}
                                    onChange={e => setFormData({ ...formData, safety_delay_minutes: parseInt(e.target.value) || 0 })}
                                />
                                <p className="text-xs text-slate-400 mt-1">Wait this long after this feed finishes.</p>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox" id="enabled"
                                    checked={formData.enabled}
                                    onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="enabled" className="text-sm font-medium text-slate-700">Enable Automation</label>
                            </div>

                            <div className="flex gap-2 pt-2">
                                {isEditing && (
                                    <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition">
                                        Cancel
                                    </button>
                                )}
                                <button type="submit" className="flex-1 px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition">
                                    {isEditing ? 'Update Feed' : 'Add Feed'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .label { @apply block text-sm font-medium text-slate-700 mb-1; }
                .input-field { @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none; }
            `}</style>
        </div>
    );
}
