"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { Save, AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import Skeleton from "@/components/Skeleton";

export default function GlobalSettingsPage() {
    const [config, setConfig] = useState({
        master_interval_minutes: 5,
        global_safety_delay_minutes: 5,
        require_ai_online: true,
        max_feeds_per_cycle: 1,
        update_interval_minutes: 60,
        start_time: "06:00"
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "system_stats", "rss_settings"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setConfig({
                    master_interval_minutes: data.master_interval_minutes || 5,
                    global_safety_delay_minutes: data.global_safety_delay_minutes || 5,
                    require_ai_online: data.require_ai_online ?? true,
                    max_feeds_per_cycle: data.max_feeds_per_cycle || 1,
                    update_interval_minutes: data.update_interval_minutes ?? 60,
                    start_time: data.start_time || "06:00"
                });
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await setDoc(doc(db, "system_stats", "rss_settings"), {
                ...config,
                updated_at: serverTimestamp()
            }, { merge: true });
            setMessage("Settings saved successfully.");
            setTimeout(() => setMessage(""), 3000);
        } catch (error) {
            console.error(error);
            setMessage("Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto py-8 px-4">
                <Skeleton height={32} width="320px" />
                <Skeleton height={20} width="400px" />
                <Skeleton height={180} width="100%" />
            </div>
        );
    }
    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Global RSS Scheduler Settings</h1>
                <p className="text-slate-500">Configure safety limits and Master Cron behavior.</p>
            </div>

            {message && (
                <div className={`mb-6 rounded-lg px-4 py-3 text-sm border ${message.includes('Failed') ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                    {message}
                </div>
            )}

            <form onSubmit={handleSave} className="grid gap-6 md:grid-cols-2">
                {/* TIMING CONFIG */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                        Safety & Timing
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">RSS Feed Start Time</label>
                        <input
                            type="time"
                            value={config.start_time}
                            onChange={e => setConfig({ ...config, start_time: e.target.value })}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                        />
                        <p className="text-xs text-slate-400 mt-1">What time should RSS feed processing start each day? (e.g., 06:00 for 6 AM)</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Global Posting Interval (Minutes)</label>
                        <input
                            type="number" min="0" max="1440"
                            value={config.update_interval_minutes}
                            onChange={e => setConfig({ ...config, update_interval_minutes: parseInt(e.target.value) || 0 })}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Time between posts. Recommended: 45min (~20 posts), 60min (~16 posts), 90min (~10 posts/day).
                        </p>
                        {config.update_interval_minutes > 0 && (
                            <p className="text-xs font-medium text-indigo-600 mt-1">
                                ≈ {Math.floor(18 * 60 / config.update_interval_minutes)} posts/day (6AM-12AM)
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Global Safety Delay (Minutes)</label>
                        <input
                            type="number" min="1" max="60"
                            value={config.global_safety_delay_minutes}
                            onChange={e => setConfig({ ...config, global_safety_delay_minutes: parseInt(e.target.value) })}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                        />
                        <p className="text-xs text-slate-400 mt-1">Minimum wait time between ANY two feeds.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Max Feeds Per Cycle</label>
                        <input
                            type="number" min="1" max="5"
                            value={config.max_feeds_per_cycle}
                            onChange={e => setConfig({ ...config, max_feeds_per_cycle: parseInt(e.target.value) })}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                        />
                        <p className="text-xs text-slate-400 mt-1">How many feeds to process in one cron wakeup (Keep low for Vercel)</p>
                    </div>
                </div>

                {/* AI & CRON */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        System Constraints
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Master Cron Interval Info</label>
                        <input
                            type="number" disabled
                            value={config.master_interval_minutes}
                            className="w-full rounded-md border-slate-200 bg-slate-50 text-slate-500 shadow-sm p-2 border cursor-not-allowed"
                        />
                        <p className="text-xs text-slate-400 mt-1">Controlled by Vercel json (Informational only)</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div>
                            <span className="block text-sm font-medium text-slate-900">Require AI Online</span>
                            <span className="text-xs text-slate-500">Stop Cron if no AI Providers are active</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.require_ai_online}
                                onChange={e => setConfig({ ...config, require_ai_online: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full flex items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition"
                    >
                        {saving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Configuration</>}
                    </button>
                </div>
            </form>

            {/* DANGER ZONE */}
            <div className="mt-12 rounded-xl border border-red-200 bg-red-50 p-6">
                <h2 className="text-lg font-bold text-red-800 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Emergency Zone
                </h2>
                <p className="text-sm text-red-600 mb-6">
                    Use this if the system is stuck in "Running" or "Waiting" state for too long (e.g., &gt; 1 hour).
                    This will force-clear all locks and reset the system to IDLE.
                </p>
                <div className="flex gap-4">
                    <button
                        onClick={async () => {
                            if (!confirm("Are you sure? This will STOP any currently running feed forcefully.")) return;
                            setSaving(true);
                            try {
                                // 1. Reset Global Settings Locks
                                await setDoc(doc(db, "system_stats", "rss_settings"), {
                                    global_lock_until: null,
                                    global_cooldown_until: null
                                }, { merge: true });

                                // 2. Reset Progress Status
                                await setDoc(doc(db, "system_stats", "rss_progress"), {
                                    status: 'idle',
                                    logs: ['⚠️ System Force Reset by Admin'],
                                    current_feed_url: null,
                                    cooldown_until: null
                                }, { merge: true });

                                setMessage("✅ System successfully reset to IDLE.");
                            } catch (e: any) {
                                console.error(e);
                                setMessage("❌ Reset failed: " + e.message);
                            } finally {
                                setSaving(false);
                            }
                        }}
                        type="button"
                        className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-sm"
                    >
                        Force System Reset
                    </button>

                    <button
                        onClick={async () => {
                            if (!confirm("⚠️ DANGER: This will delete ALL news articles (Database Only). This cannot be undone!")) return;
                            if (!confirm("Are you absolutely sure you want to delete all news?")) return;

                            setSaving(true);
                            try {
                                const res = await fetch('/api/admin/delete-all-news', { method: 'POST' });
                                const data = await res.json();
                                if (data.success) {
                                    setMessage(`✅ Deleted ${data.count} articles.`);
                                } else {
                                    setMessage(`❌ Failed: ${data.error}`);
                                }
                            } catch (e: any) {
                                setMessage("❌ Error: " + e.message);
                            } finally {
                                setSaving(false);
                            }
                        }}
                        type="button"
                        className="px-4 py-2 bg-red-800 text-white font-medium rounded-lg hover:bg-red-900 transition shadow-sm ml-auto"
                    >
                        Delete All News
                    </button>
                </div>
            </div>
        </div>
    );
}
