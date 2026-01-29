"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const RSS_FEEDS = [
    {
        name: "Prothom Alo",
        url: "https://www.prothomalo.com/feed/",
        category: "সাধারণ",
        priority: 20,
        enabled: true,
    },
    {
        name: "The Daily Star",
        url: "https://www.thedailystar.net/feed",
        category: "সাধারণ",
        priority: 19,
        enabled: true,
    },
    {
        name: "Bdnews24 Bangla",
        url: "https://bangla.bdnews24.com/rss.xml",
        category: "সাধারণ",
        priority: 18,
        enabled: true,
    },
    {
        name: "Dhaka Tribune",
        url: "https://www.dhakatribune.com/feed",
        category: "সাধারণ",
        priority: 17,
        enabled: true,
    },
    {
        name: "Kaler Kantho",
        url: "https://www.kalerkantho.com/rss.xml",
        category: "সাধারণ",
        priority: 16,
        enabled: true,
    },
    {
        name: "Jugantor",
        url: "https://www.jugantor.com/feed/rss.xml",
        category: "সাধারণ",
        priority: 15,
        enabled: true,
    },
    {
        name: "Samakal",
        url: "https://samakal.com/feed/",
        category: "সাধারণ",
        priority: 14,
        enabled: true,
    },
    {
        name: "New Age Bangladesh",
        url: "https://www.newagebd.net/rss/rss.xml",
        category: "সাধারণ",
        priority: 13,
        enabled: true,
    },
    {
        name: "Financial Express BD",
        url: "https://thefinancialexpress.com.bd/feed",
        category: "অর্থনীতি",
        priority: 12,
        enabled: true,
    },
    {
        name: "UNB News",
        url: "https://unb.com.bd/feed",
        category: "সাধারণ",
        priority: 11,
        enabled: true,
    }
];

export default function ImportFeedsPage() {
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState<{
        added: string[];
        skipped: string[];
        errors: { name: string; error: string }[];
    } | null>(null);

    const importFeeds = async () => {
        setImporting(true);
        setResults(null);

        const added: string[] = [];
        const skipped: string[] = [];
        const errors: { name: string; error: string }[] = [];

        for (const feed of RSS_FEEDS) {
            try {
                // Check if already exists
                const q = query(
                    collection(db, "rss_feeds"),
                    where("url", "==", feed.url)
                );
                const existing = await getDocs(q);

                if (!existing.empty) {
                    skipped.push(feed.name);
                    continue;
                }

                // Add feed
                await addDoc(collection(db, "rss_feeds"), {
                    ...feed,
                    last_checked_at: null,
                    last_success_at: null,
                    cooldown_until: null,
                    failure_count: 0,
                    error_log: ""
                });

                added.push(feed.name);
            } catch (error: any) {
                errors.push({
                    name: feed.name,
                    error: error.message
                });
            }
        }

        setResults({ added, skipped, errors });
        setImporting(false);
    };

    return (
        <div className="max-w-4xl mx-auto p-8">
            <div className="bg-white rounded-xl shadow-lg p-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    📰 Import RSS Feeds
                </h1>
                <p className="text-slate-600 mb-8">
                    Add top 10 Bangladeshi news sources to your system
                </p>

                {/* Feeds List */}
                <div className="bg-slate-50 rounded-lg p-6 mb-8 max-h-96 overflow-y-auto">
                    <h2 className="font-bold text-slate-900 mb-4">Feeds to Import:</h2>
                    <div className="space-y-2">
                        {RSS_FEEDS.map((feed) => (
                            <div
                                key={feed.url}
                                className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200"
                            >
                                <div>
                                    <div className="font-semibold text-slate-900">{feed.name}</div>
                                    <div className="text-sm text-slate-500">{feed.url}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-semibold">
                                        Priority {feed.priority}
                                    </span>
                                    <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                                        {feed.category}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Import Button */}
                <button
                    onClick={importFeeds}
                    disabled={importing}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 px-6 rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                    {importing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Importing...
                        </>
                    ) : (
                        <>Import All Feeds</>
                    )}
                </button>

                {/* Results */}
                {results && (
                    <div className="mt-8 space-y-4">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-emerald-600">
                                    {results.added.length}
                                </div>
                                <div className="text-sm text-emerald-700 font-medium">Added</div>
                            </div>
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-amber-600">
                                    {results.skipped.length}
                                </div>
                                <div className="text-sm text-amber-700 font-medium">Skipped</div>
                            </div>
                            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-red-600">
                                    {results.errors.length}
                                </div>
                                <div className="text-sm text-red-700 font-medium">Errors</div>
                            </div>
                        </div>

                        {/* Details */}
                        {results.added.length > 0 && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                <h3 className="font-bold text-emerald-900 mb-2 flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5" />
                                    Successfully Added
                                </h3>
                                <ul className="space-y-1">
                                    {results.added.map((name) => (
                                        <li key={name} className="text-emerald-700 text-sm">
                                            ✅ {name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {results.skipped.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <h3 className="font-bold text-amber-900 mb-2">
                                    Skipped (Already Exists)
                                </h3>
                                <ul className="space-y-1">
                                    {results.skipped.map((name) => (
                                        <li key={name} className="text-amber-700 text-sm">
                                            ⏭️ {name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {results.errors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                                    <XCircle className="w-5 h-5" />
                                    Errors
                                </h3>
                                <ul className="space-y-1">
                                    {results.errors.map((err) => (
                                        <li key={err.name} className="text-red-700 text-sm">
                                            ❌ {err.name}: {err.error}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
