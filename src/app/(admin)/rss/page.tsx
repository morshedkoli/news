"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
} from "firebase/firestore";
import { Trash2, Rss, Globe, PauseCircle, PlayCircle, AlertCircle, Beaker, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Skeleton from "@/components/Skeleton";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import { toast } from "sonner";

type FirestoreTimestamp = { toDate: () => Date };

interface RssFeed {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    priority: number;
    last_checked_at?: FirestoreTimestamp | null;
    last_success_at?: FirestoreTimestamp | null;
    cooldown_until?: FirestoreTimestamp | null;
    failure_count?: number;
    error_log?: string;
}

interface FeedTestItem {
    title: string;
    link: string;
    pubDate?: string;
}

type FeedTestResult =
    | {
        success: true;
        itemCount: number;
        latency: number;
        title: string;
        description?: string;
        sampleItems: FeedTestItem[];
    }
    | {
        success: false;
        error: string;
        details?: string;
    };

export default function RssPage() {
    const pathname = usePathname();
    const router = useRouter();
    const [feeds, setFeeds] = useState<RssFeed[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        url: "",
        priority: 10,
        enabled: true
    });

    // Test Feed State
    const [testingFeed, setTestingFeed] = useState(false);
    const [testResult, setTestResult] = useState<FeedTestResult | null>(null);
    const [testModalOpen, setTestModalOpen] = useState(false);

    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({
        isOpen: false,
        id: null
    });
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (pathname === '/rss') {
            router.replace('/rss-management');
        }
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

        return () => {
            unsub();
        };
    }, [pathname, router]);

    const resetForm = () => {
        setFormData({
            name: "",
            url: "",
            priority: 10,
            enabled: true
        });
        setEditId(null);
        setIsEditing(false);
        setShowForm(false);
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
            toast.success(editId ? "Feed updated successfully" : "Feed added successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save feed");
        }
    };

    const handleDeleteClick = (id: string) => {
        setDeleteModal({ isOpen: true, id });
    };

    const confirmDelete = async () => {
        if (!deleteModal.id) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, "rss_feeds", deleteModal.id));
            toast.success("Feed deleted successfully");
            setDeleteModal({ isOpen: false, id: null });
        } catch (error) {
            console.error("Delete failed", error);
            toast.error("Failed to delete feed");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleToggle = async (feed: RssFeed) => {
        await updateDoc(doc(db, "rss_feeds", feed.id), {
            enabled: !feed.enabled
        });
    };


    const handleTestFeed = async () => {
        if (!formData.url) {
            toast.error("Please enter a URL first");
            return;
        }

        setTestingFeed(true);
        setTestResult(null);

        try {
            const res = await fetch('/api/rss/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: formData.url })
            });

            const data = await res.json();
            setTestResult(data as FeedTestResult);
            setTestModalOpen(true);

            if (data.success) {
                toast.success("Feed is valid!");
                // Auto-fill name if empty
                if (!formData.name && data.title && data.title !== 'Unknown Feed') {
                    setFormData(prev => ({ ...prev, name: data.title }));
                }
            } else {
                toast.error("Feed validation failed");
            }
        } catch (error) {
            console.error("Test failed", error);
            toast.error("Failed to test feed");
        } finally {
            setTestingFeed(false);
        }
    };

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

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">RSS Feeds</h1>
                    <p className="text-slate-500">Manage your news sources</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                >
                    Add Feed
                </button>
            </div>

            <div className="space-y-4">
                {feeds.map((feed) => {
                        const inCooldown = feed.cooldown_until?.toDate?.() ? feed.cooldown_until.toDate() > new Date() : false;

                        return (
                            <div key={feed.id} className={`relative rounded-lg border p-3 transition-all ${!feed.enabled ? 'border-slate-100 bg-slate-50 opacity-75' :
                                inCooldown ? 'border-amber-200 bg-amber-50' :
                                    'border-slate-200 bg-white hover:border-indigo-200'
                                }`}>
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-semibold text-slate-900">{feed.name || "Unnamed Feed"}</h3>
                                            {!feed.enabled && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-500">DISABLED</span>}
                                            {inCooldown && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">COOLDOWN</span>}
                                        </div>
                                        <p className="text-xs text-slate-500 truncate max-w-md" title={feed.url}>{feed.url}</p>
                                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                                            <span>Priority: <strong className="text-slate-700">{feed.priority || 10}</strong></span>
                                            <span>Checked: <strong className="text-slate-700">{feed.last_checked_at?.toDate?.() ? formatDistanceToNow(feed.last_checked_at.toDate(), { addSuffix: true }) : 'Never'}</strong></span>
                                            <span>Success: <strong className="text-emerald-600">{feed.last_success_at?.toDate?.() ? formatDistanceToNow(feed.last_success_at.toDate(), { addSuffix: true }) : 'Never'}</strong></span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => {
                                            setFormData({
                                                name: feed.name,
                                                url: feed.url,
                                                priority: feed.priority || 10,
                                                enabled: feed.enabled
                                            });
                                            setEditId(feed.id);
                                            setIsEditing(true);
                                            setShowForm(true);
                                        }} className="p-2 text-slate-400 hover:text-indigo-600 text-sm">
                                            Edit
                                        </button>
                                        <button onClick={() => handleDeleteClick(feed.id)} className="p-2 text-slate-400 hover:text-red-600">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between text-xs">
                                    <button
                                        onClick={() => handleToggle(feed)}
                                        className={`font-bold flex items-center gap-1 ${feed.enabled ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                                    >
                                        {feed.enabled ? <><PauseCircle className="w-4 h-4" /> Disable</> : <><PlayCircle className="w-4 h-4" /> Enable</>}
                                    </button>

                                    {feed.error_log && (
                                        <span className="text-red-500 flex items-center gap-1" title={feed.error_log}>
                                            <AlertCircle className="w-3 h-3" />
                                            {feed.error_log.substring(0, 40)}...
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

            <style jsx>{`
                .label { @apply block text-sm font-medium text-slate-700 mb-1; }
                .input-field { @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none; }
            `}</style>

            <DeleteConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null })}
                onConfirm={confirmDelete}
                title="Delete RSS Feed"
                description="Are you sure you want to delete this feed? This action cannot be undone."
                isDeleting={isDeleting}
            />

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-slate-800">
                                {isEditing ? 'Edit Feed' : 'Add New Feed'}
                            </h3>
                            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
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
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="url" required
                                            className="input-field pl-9"
                                            placeholder="https://..."
                                            value={formData.url}
                                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleTestFeed}
                                        disabled={testingFeed || !formData.url}
                                        className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition"
                                        title="Test Feed URL"
                                    >
                                        <Beaker className={`w-4 h-4 ${testingFeed ? 'animate-pulse' : ''}`} />
                                    </button>
                                </div>
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
                                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition">
                                    {isEditing ? 'Update Feed' : 'Add Feed'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Feed Test Result Modal */}
            {testModalOpen && testResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Beaker className="w-4 h-4 text-indigo-600" />
                                Feed Test Results
                            </h3>
                            <button onClick={() => setTestModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {testResult.success ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg border border-green-100">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <span className="font-medium">Valid Feed: Found {testResult.itemCount} items</span>
                                        <span className="text-xs text-green-700 ml-auto">{testResult.latency}ms</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="p-3 bg-slate-50 rounded-lg">
                                            <span className="block text-xs text-slate-400 uppercase font-bold">Feed Title</span>
                                            <span className="font-medium text-slate-900">{testResult.title}</span>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-lg">
                                            <span className="block text-xs text-slate-400 uppercase font-bold">Description</span>
                                            <span className="font-medium text-slate-900 truncate">{testResult.description || '-'}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-slate-900 mb-2">Latest Items Preview</h4>
                                        <div className="space-y-2">
                                            {testResult.sampleItems.map((item: FeedTestItem, i: number) => (
                                                <div key={i} className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
                                                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline line-clamp-1 block">
                                                        {item.title}
                                                    </a>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                                        <span>{item.pubDate ? formatDistanceToNow(new Date(item.pubDate), { addSuffix: true }) : 'No date'}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <AlertCircle className="w-6 h-6" />
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-900 mb-2">Validation Failed</h4>
                                    <p className="text-red-600 font-medium mb-4">{testResult.error}</p>
                                    {testResult.details && (
                                        <pre className="text-xs bg-slate-900 text-slate-50 p-3 rounded-lg text-left overflow-x-auto mx-auto max-w-md">
                                            {testResult.details}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setTestModalOpen(false)}
                                className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
