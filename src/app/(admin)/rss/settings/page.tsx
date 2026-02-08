"use client";
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { Save, AlertTriangle, ShieldCheck, Trash2 } from "lucide-react";
import Skeleton from "@/components/Skeleton";

export default function GlobalSettingsPage() {
    const pathname = usePathname();
    const router = useRouter();
    const [config, setConfig] = useState({
        master_interval_minutes: 5,
        global_safety_delay_minutes: 5,
        require_ai_online: true,
        max_feeds_per_cycle: 3,
        update_interval_minutes: 60,
        start_time: "06:00",
        min_publish_score: 55,
        min_queue_score: 35,
        require_image_for_publish: false,
        summary_min_length: 15,
        translation_retry_enabled: true,
        news_retention_days: 20
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (pathname === '/rss/settings') {
            router.replace('/rss-management?tab=settings');
        }
        const unsub = onSnapshot(doc(db, "system_stats", "rss_settings"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setConfig({
                    master_interval_minutes: data.master_interval_minutes || 5,
                    global_safety_delay_minutes: data.global_safety_delay_minutes || 5,
                    require_ai_online: data.require_ai_online ?? true,
                    max_feeds_per_cycle: data.max_feeds_per_cycle || 3,
                    update_interval_minutes: data.update_interval_minutes ?? 60,
                    start_time: data.start_time || "06:00",
                    min_publish_score: data.min_publish_score ?? 55,
                    min_queue_score: data.min_queue_score ?? 35,
                    require_image_for_publish: data.require_image_for_publish ?? false,
                    summary_min_length: data.summary_min_length ?? 15,
                    translation_retry_enabled: data.translation_retry_enabled ?? true,
                    news_retention_days: data.news_retention_days ?? 20
                });
            }
            setLoading(false);
        });
        return () => unsub();
    }, [pathname, router]);

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

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        Quality Controls
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Minimum Publish Score</label>
                        <input
                            type="number" min="0" max="100"
                            value={config.min_publish_score}
                            onChange={e => setConfig({ ...config, min_publish_score: parseInt(e.target.value) || 0 })}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2 border"
                        />
                        <p className="text-xs text-slate-400 mt-1">Higher values mean stricter publishing quality.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Minimum Queue Score</label>
                        <input
                            type="number" min="0" max="100"
                            value={config.min_queue_score}
                            onChange={e => setConfig({ ...config, min_queue_score: parseInt(e.target.value) || 0 })}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2 border"
                        />
                        <p className="text-xs text-slate-400 mt-1">Below this score, items are dropped instead of queued.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Summary Minimum Length</label>
                        <input
                            type="number" min="10" max="200"
                            value={config.summary_min_length}
                            onChange={e => setConfig({ ...config, summary_min_length: parseInt(e.target.value) || 0 })}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2 border"
                        />
                        <p className="text-xs text-slate-400 mt-1">Shorter summaries are penalized in quality scoring.</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div>
                            <span className="block text-sm font-medium text-slate-900">Require Image for Publish</span>
                            <span className="text-xs text-slate-500">If enabled, missing images will only queue, not publish.</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.require_image_for_publish}
                                onChange={e => setConfig({ ...config, require_image_for_publish: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div>
                            <span className="block text-sm font-medium text-slate-900">Enable Translation Retry</span>
                            <span className="text-xs text-slate-500">Save failed translations and retry later.</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.translation_retry_enabled}
                                onChange={e => setConfig({ ...config, translation_retry_enabled: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>
                </div>

                {/* DATA MANAGEMENT */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-red-600" />
                        Data Management
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">News Retention (Days)</label>
                        <input
                            type="number" min="0" max="365"
                            value={config.news_retention_days}
                            onChange={e => setConfig({ ...config, news_retention_days: parseInt(e.target.value) || 0 })}
                            className="w-full rounded-md border-slate-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Automatically delete published news after this many days. Set to 0 to disable auto-cleanup.
                        </p>
                        {config.news_retention_days > 0 && (
                            <p className="text-xs font-medium text-red-600 mt-1">
                                ⚠️ News older than {config.news_retention_days} days will be permanently deleted daily at midnight.
                            </p>
                        )}
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
                            } catch (e: unknown) {
                                const message = e instanceof Error ? e.message : "Unknown error";
                                console.error(e);
                                setMessage("❌ Reset failed: " + message);
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
                            } catch (e: unknown) {
                                const message = e instanceof Error ? e.message : "Unknown error";
                                setMessage("❌ Error: " + message);
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
