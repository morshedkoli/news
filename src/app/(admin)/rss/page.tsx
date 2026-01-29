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
    orderBy,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { Trash2, RefreshCw, Rss, Globe, PauseCircle, PlayCircle, Clock, AlertCircle, TrendingUp, Settings } from "lucide-react";
import { formatDistanceToNow, format, addMinutes } from "date-fns";
import Link from "next/link";
import CronStatusModal from "@/components/CronStatusModal";
import Skeleton from "@/components/Skeleton";

interface RssFeed {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    category?: string;
    priority: number;
    last_checked_at?: any;
    last_success_at?: any;
    cooldown_until?: any;
    failure_count?: number;
    error_log?: string;
}

interface RssSettings {
    last_news_posted_at?: any;
    total_posts_today?: number;
    last_reset_date?: string;
    update_interval_minutes?: number;
}

export default function RssPage() {
    const [feeds, setFeeds] = useState<RssFeed[]>([]);
    const [settings, setSettings] = useState<RssSettings | null>(null);
    const [triggering, setTriggering] = useState(false);
    const [loading, setLoading] = useState(true);

    // Cron Modal State
    const [cronModal, setCronModal] = useState({
        isOpen: false,
        isLoading: false,
        data: null,
        error: null as string | null
    });

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        url: "",
        category: "সাধারণ",
        priority: 10,
        enabled: true
    });

    useEffect(() => {
        // Feeds Listener
        const q = query(collection(db, "rss_feeds"), orderBy("priority", "desc"));
        const unsub = onSnapshot(q, (snapshot) => {
            const feedsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as RssFeed[];
            setFeeds(feedsData);
            setLoading(false);
        });

        // Settings Listener
        const unsubSettings = onSnapshot(doc(db, "system_stats", "rss_settings"), (docSnap) => {
            if (docSnap.exists()) {
                setSettings(docSnap.data() as RssSettings);
            }
            setLoading(false);
        });

        return () => {
            unsub();
            unsubSettings();
        };
    }, []);

    const resetForm = () => {
        setFormData({
            name: "",
            url: "",
            category: "সাধারণ",
            priority: 10,
            enabled: true
        });
        setEditId(null);
        setIsEditing(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editId) {
                await updateDoc(doc(db, "rss_feeds", editId), {
                    ...formData,
                });
            } else {
                await addDoc(collection(db, "rss_feeds"), {
                    ...formData,
                    last_checked_at: null,
                    last_success_at: null,
                    cooldown_until: null,
                    failure_count: 0,
                    error_log: ""
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
        setCronModal({
            isOpen: true,
            isLoading: true,
            data: null,
            error: null
        });

        try {
            const response = await fetch("/api/cron/rss");
            const data = await response.json();

            setCronModal(prev => ({
                ...prev,
                isLoading: false,
                data: data
            }));

        } catch (error: any) {
            console.error("Cron error:", error);
            setCronModal(prev => ({
                ...prev,
                isLoading: false,
                error: error.message || "Failed to trigger cron"
            }));
        } finally {
            setTriggering(false);
        }
    };

    // Calculate next available post time
    const getIntervalMinutes = () => settings?.update_interval_minutes ?? 30;

    const getNextPostTime = () => {
        if (!settings?.last_news_posted_at) return "Now";
        const interval = getIntervalMinutes();
        if (interval === 0) return "Now";
        const lastPost = settings.last_news_posted_at.toDate();
        const nextPost = addMinutes(lastPost, interval);
        const now = new Date();

        if (nextPost <= now) return "Now";
        return format(nextPost, 'HH:mm:ss');
    };

    const getMinutesUntilNext = () => {
        if (!settings?.last_news_posted_at) return 0;
        const interval = getIntervalMinutes();
        if (interval === 0) return 0;
        const lastPost = settings.last_news_posted_at.toDate();
        const nextPost = addMinutes(lastPost, interval);
        const now = new Date();
        const diff = Math.max(0, Math.ceil((nextPost.getTime() - now.getTime()) / (1000 * 60)));
        return diff;
    };

    const isGlobalCooldown = getMinutesUntilNext() > 0;

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="grid gap-4 md:grid-cols-12">
                    <Skeleton height={100} className="md:col-span-4" />
                    <Skeleton height={100} className="md:col-span-4" />
                    <Skeleton height={100} className="md:col-span-4" />
                </div>
                <Skeleton height={80} />
                <Skeleton height={120} />
                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                        <Skeleton height={160} />
                        <Skeleton height={160} />
                    </div>
                    <div className="lg:col-span-1">
                        <Skeleton height={400} />
                    </div>
                </div>
            </div>
        )
    }
    return (
        <div className="space-y-8">

            {/* GLOBAL STATUS DASHBOARD */}
            <div className="grid gap-4 md:grid-cols-12">

                {/* Last Post Status */}
                <div className="md:col-span-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Last Post</h3>
                        <Clock className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-800">
                        {settings?.last_news_posted_at
                            ? formatDistanceToNow(settings.last_news_posted_at.toDate(), { addSuffix: true })
                            : "Never"
                        }
                    </div>
                    {settings?.last_news_posted_at && (
                        <p className="text-xs text-slate-400 mt-1">
                            {format(settings.last_news_posted_at.toDate(), 'PPpp')}
                        </p>
                    )}
                </div>

                {/* Next Post Time */}
                <div className={`md:col-span-4 rounded-xl border p-5 shadow-sm ${isGlobalCooldown
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-emerald-200 bg-emerald-50'
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Next Post</h3>
                        {isGlobalCooldown ? (
                            <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                        ) : (
                            <PlayCircle className="w-4 h-4 text-emerald-500" />
                        )}
                    </div>
                    <div className={`text-2xl font-black ${isGlobalCooldown ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                        {getNextPostTime()}
                    </div>
                    {isGlobalCooldown && (
                        <p className="text-xs text-amber-600 mt-1 font-medium">
                            Cooldown: {getMinutesUntilNext()} minutes remaining
                        </p>
                    )}
                </div>

                {/* Daily Stats */}
                <div className="md:col-span-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Today's Posts</h3>
                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="text-2xl font-black text-indigo-600">
                        {settings?.total_posts_today || 0}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Auto-posted via RSS
                    </p>
                </div>
            </div>

            {/* Manual Trigger Button */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-slate-900">Manual Trigger</h3>
                        <p className="text-sm text-slate-500">Test the RSS cron endpoint manually</p>
                    </div>
                    <button
                        onClick={handleTriggerCron}
                        disabled={triggering}
                        className="flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
                    >
                        <PlayCircle className={`mr-2 h-4 w-4 ${triggering ? 'animate-spin' : ''}`} />
                        {triggering ? 'Running...' : 'Run Cron Now'}
                    </button>
                </div>
            </div>

            {/* Info Banner */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div className="flex-1">
                        <h4 className="font-bold text-indigo-900 mb-1">
                            Auto-Posting: ~{getIntervalMinutes() > 0 ? Math.floor(18 * 60 / getIntervalMinutes()) : '∞'} posts/day
                        </h4>
                        <p className="text-sm text-indigo-700">
                            Posting <strong>every {getIntervalMinutes()} minutes</strong> from enabled feeds.
                            Cron runs every 5 minutes via cron-job.org. Adjust interval in
                            <a href="/rss/settings" className="mx-1 underline font-medium">RSS Settings</a>
                            to control daily post count.
                        </p>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">RSS Feeds</h1>
                    <p className="text-slate-500">Manage your news sources</p>
                </div>
                <Link
                    href="/rss/settings"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition text-sm"
                >
                    <Settings className="w-4 h-4" />
                    RSS Settings
                </Link>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">

                {/* FEED LIST */}
                <div className="lg:col-span-2 space-y-4">
                    {feeds.map((feed) => {
                        const inCooldown = feed.cooldown_until && feed.cooldown_until.toDate() > new Date();

                        return (
                            <div key={feed.id} className={`group relative rounded-xl border p-5 transition-all ${!feed.enabled ? 'border-slate-100 bg-slate-50 opacity-75' :
                                inCooldown ? 'border-amber-200 bg-amber-50' :
                                    'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm'
                                }`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-slate-900 text-lg">{feed.name || "Unnamed Feed"}</h3>
                                            {!feed.enabled && <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-500">DISABLED</span>}
                                            {inCooldown && <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">COOLDOWN</span>}
                                        </div>
                                        <p className="text-sm text-slate-500 truncate max-w-md" title={feed.url}>{feed.url}</p>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => {
                                            setFormData({
                                                name: feed.name,
                                                url: feed.url,
                                                category: feed.category || "সাধারণ",
                                                priority: feed.priority || 10,
                                                enabled: feed.enabled
                                            });
                                            setEditId(feed.id);
                                            setIsEditing(true);
                                        }} className="p-2 text-slate-400 hover:text-indigo-600 text-sm">
                                            Edit
                                        </button>
                                        <button onClick={() => handleDelete(feed.id)} className="p-2 text-slate-400 hover:text-red-600">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Priority</p>
                                        <p className="font-medium text-slate-700">
                                            {feed.priority || 10}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Last Checked</p>
                                        <p className="font-medium text-slate-500">
                                            {feed.last_checked_at ? formatDistanceToNow(feed.last_checked_at.toDate(), { addSuffix: true }) : 'Never'}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Last Success</p>
                                        <p className="font-medium text-emerald-600">
                                            {feed.last_success_at ? formatDistanceToNow(feed.last_success_at.toDate(), { addSuffix: true }) : 'Never'}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                                    <button
                                        onClick={() => handleToggle(feed)}
                                        className={`text-xs font-bold flex items-center gap-1 ${feed.enabled ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                                    >
                                        {feed.enabled ? <><PauseCircle className="w-4 h-4" /> Disable</> : <><PlayCircle className="w-4 h-4" /> Enable</>}
                                    </button>

                                    {feed.error_log && (
                                        <span className="text-red-500 text-xs flex items-center gap-1" title={feed.error_log}>
                                            <AlertCircle className="w-3 h-3" />
                                            Error: {feed.error_log.substring(0, 30)}...
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {feeds.length === 0 && (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            <Rss className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500">No feeds found. Add one on the right.</p>
                        </div>
                    )}
                </div>

                {/* ADD/EDIT FORM */}
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

                            <div>
                                <label className="label">Category</label>
                                <select
                                    className="input-field"
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                >
                                    <option value="সাধারণ">সাধারণ (General)</option>
                                    <option value="খেলাধুলা">খেলাধুলা (Sports)</option>
                                    <option value="রাজনীতি">রাজনীতি (Politics)</option>
                                    <option value="প্রযুক্তি">প্রযুক্তি (Technology)</option>
                                    <option value="বিনোদন">বিনোদন (Entertainment)</option>
                                    <option value="অর্থনীতি">অর্থনীতি (Business)</option>
                                    <option value="স্বাস্থ্য">স্বাস্থ্য (Health)</option>
                                    <option value="বিজ্ঞান">বিজ্ঞান (Science)</option>
                                    <option value="শিক্ষা">শিক্ষা (Education)</option>
                                    <option value="আন্তর্জাতিক">আন্তর্জাতিক (International)</option>
                                </select>
                            </div>

                            <div>
                                <label className="label">Priority</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    required
                                    className="input-field"
                                    value={formData.priority}
                                    onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) || 10 })}
                                />
                                <p className="text-xs text-slate-400 mt-1">Higher priority feeds are checked first (1-100)</p>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox" id="enabled"
                                    checked={formData.enabled}
                                    onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                 />
                                <label htmlFor="enabled" className="text-sm font-medium text-slate-700">Enable Feed</label>
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

            <CronStatusModal
                isOpen={cronModal.isOpen}
                onClose={() => setCronModal(prev => ({ ...prev, isOpen: false }))}
                data={cronModal.data}
                isLoading={cronModal.isLoading}
                error={cronModal.error}
            />
        </div>
    );
}
