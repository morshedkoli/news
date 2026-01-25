'use client';

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, deleteField } from "firebase/firestore";
import { RssFeed, RssSettings } from "@/types/rss";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, Play, Pause, RefreshCw, AlertCircle, Wifi } from "lucide-react";

export default function FeedHealthTab() {
    const [feeds, setFeeds] = useState<RssFeed[]>([]);
    const [loading, setLoading] = useState(true);
    const [cronRequests, setCronRequests] = useState<number | null>(null);

    useEffect(() => {
        const q = query(collection(db, "rss_feeds"), orderBy("priority", "desc"));
        const unsubscribeFeeds = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RssFeed));
            setFeeds(data);
            setLoading(false);
        });

        // Listen to cron_requests_count in system_stats/rss_settings
        const unsubSettings = onSnapshot(doc(db, "system_stats", "rss_settings"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as RssSettings;
                setCronRequests(data.cron_requests_count ?? 0);
            }
        });

        return () => {
            unsubscribeFeeds();
            unsubSettings();
        };
    }, []);

    async function toggleFeed(feedId: string, currentStatus: boolean) {
        await updateDoc(doc(db, "rss_feeds", feedId), { enabled: !currentStatus });
    }

    async function resetCooldown(feedId: string) {
        await updateDoc(doc(db, "rss_feeds", feedId), {
            cooldown_until: deleteField(),
            error_log: deleteField(),
            failure_count: 0
        });
    }

    if (loading) return <div className="p-8 text-center text-zinc-500">Loading feeds...</div>;

    return (
        <div className="space-y-4">
            <div className="mb-4 p-4 bg-zinc-900 border border-zinc-800 rounded flex items-center gap-4">
                <span className="font-semibold text-zinc-200">cron-job.org Requests:</span>
                <span className="text-emerald-400 text-lg font-mono">{cronRequests !== null ? cronRequests : '—'}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {feeds.map(feed => (
                    <FeedCard
                        key={feed.id}
                        feed={feed}
                        onToggle={() => toggleFeed(feed.id, feed.enabled)}
                        onReset={() => resetCooldown(feed.id)}
                    />
                ))}
            </div>
        </div>
    );
}

function FeedCard({ feed, onToggle, onReset }: { feed: RssFeed, onToggle: () => void, onReset: () => void }) {
    // Determine Health
    // Healthy: Last success < 24h, failures < 3
    // Broken: failures >= 3
    // Idle: No success in > 24h but no failures
    const failures = feed.failure_count || 0;
    const lastSuccess = feed.last_success_at ? feed.last_success_at.toDate() : null;
    const hoursSinceSuccess = lastSuccess ? (Date.now() - lastSuccess.getTime()) / (1000 * 3600) : 999;

    let health: 'healthy' | 'idle' | 'broken' = 'healthy';
    if (failures >= 3) health = 'broken';
    else if (hoursSinceSuccess > 24) health = 'idle';

    // Cooldown check
    const now = new Date();
    const cooldownUntil = feed.cooldown_until ? feed.cooldown_until.toDate() : null;
    const inCooldown = cooldownUntil && cooldownUntil > now;

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden group">
            {/* Status Stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${!feed.enabled ? 'bg-zinc-700' :
                    health === 'healthy' ? 'bg-emerald-500' :
                        health === 'broken' ? 'bg-red-500' : 'bg-amber-500'
                }`} />

            <div className="flex justify-between items-start pl-2">
                <div>
                    <h3 className="font-bold text-zinc-100 truncate pr-2">{feed.name}</h3>
                    <div className="text-xs text-zinc-500 truncate max-w-[200px]">{feed.url}</div>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${!feed.enabled ? 'bg-zinc-800 text-zinc-500 border-zinc-700' :
                        health === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            health === 'broken' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                    {!feed.enabled ? 'Disabled' : health}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pl-2">
                <div className="text-zinc-500">
                    Priority: <span className="text-zinc-300">{feed.priority}</span>
                </div>
                <div className="text-zinc-500">
                    Failures: <span className={`${failures > 0 ? 'text-red-400' : 'text-zinc-300'}`}>{failures}</span>
                </div>
                <div className="text-zinc-500 col-span-2">
                    Last Success: <span className="text-zinc-300">{lastSuccess ? formatDistanceToNow(lastSuccess, { addSuffix: true }) : 'Never'}</span>
                </div>
            </div>

            {feed.error_log && (
                <div className="bg-red-950/30 border border-red-500/20 p-2 rounded text-[10px] text-red-300 truncate pl-2">
                    {feed.error_log}
                </div>
            )}

            {inCooldown && (
                <div className="bg-blue-950/30 border border-blue-500/20 p-2 rounded text-[10px] text-blue-300 pl-2">
                    Cooldown until {cooldownUntil?.toLocaleTimeString()}
                </div>
            )}

            <div className="mt-auto pt-2 flex gap-2 pl-2">
                <button
                    onClick={onToggle}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${feed.enabled
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                >
                    {feed.enabled ? <><Pause size={12} /> Disable</> : <><Play size={12} /> Enable</>}
                </button>

                <button
                    onClick={onReset}
                    className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                    title="Reset Cooldown & Errors"
                >
                    <RefreshCw size={12} />
                </button>
            </div>
        </div>
    );
}
