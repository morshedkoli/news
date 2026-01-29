"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { Loader2, Save, Link as LinkIcon, AlertCircle, Tag } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { CATEGORIES } from "../page";
import Skeleton from "@/components/Skeleton";

// Client-side URL normalization (mirrors backend logic roughly)
function normalizeUrlClient(url: string): string {
    try {
        const u = new URL(url);
        const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref', 'source'];
        paramsToRemove.forEach(p => u.searchParams.delete(p));
        u.protocol = 'https:';
        u.hostname = u.hostname.toLowerCase();
        let path = decodeURIComponent(u.pathname);
        if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
        return u.origin + path;
    } catch (e) {
        return url;
    }
}

export default function AddNewsPage() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [error, setError] = useState("");
    const [progress, setProgress] = useState<{ step: number; message: string }>({ step: 0, message: "" });
    const { user } = useAuth();
    const router = useRouter();

    // Form State
    const [newsData, setNewsData] = useState<{
        title: string;
        summary: string;
        image: string;
        source_url: string;
        source_name: string;
        category: string;
    } | null>(null);
    const [providerInfo, setProviderInfo] = useState<{ provider: string; model: string } | null>(null);
    const [language, setLanguage] = useState<string | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState<{ error: string; details: string; article?: any; generated?: any } | null>(null);
    const [isDuplicate, setIsDuplicate] = useState(false);

    const updateProgress = (step: number, message: string) => {
        setProgress({ step, message });
    };

    const handleGenerate = async () => {
        if (!url) return;
        setLoading(true);
        setError("");
        setDuplicateWarning(null);
        setProviderInfo(null);
        setLanguage(null);
        setNewsData(null);
        setIsDuplicate(false);
        updateProgress(10, "Validating URL...");

        try {
            updateProgress(30, "Fetching article content...");
            const res = await fetch("/api/news/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });

            if (!res.ok) {
                const data = await res.json();
                if (res.status === 409) {
                    setDuplicateWarning({
                        error: data.error,
                        details: data.details,
                        article: data.article,
                        generated: data.generated
                    });
                    updateProgress(0, "");
                    setLoading(false);
                    return; // Stop processing
                }
                throw new Error(data.error || "Failed to generate");
            }

            updateProgress(60, "Generating Bangla summary using AI...");
            // Simulate a slight delay to let the user see the "Calculating" state
            await new Promise(r => setTimeout(r, 800));

            const data = await res.json();

            updateProgress(90, "Finalizing metadata...");
            setNewsData({
                title: data.generated?.title || data.original.title,
                summary: data.generated?.summary || data.original.excerpt,
                image: data.original.image || "",
                source_url: url,
                source_name: data.original.siteName,
                category: data.generated?.category || data.original.category || "সাধারণ",
            });

            if (data.provider_info) {
                setProviderInfo(data.provider_info);
            }
            if (data.provider_info) {
                setProviderInfo(data.provider_info);
            }

            if (data.language_detected === 'English') {
                updateProgress(90, "Translation from English complete!");
            }

            if (data.language_detected) {
                setLanguage(data.language_detected);
            }

            if (data.provider_info?.provider === 'Fallback' || !data.generated) {
                setError("⚠️ AI generation failed. Loaded original content (Raw).");
            } else {
                updateProgress(100, "Done!");
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message);
            updateProgress(0, "");
        } finally {
            setLoading(false);
        }
    };

    const handleViewDuplicate = () => {
        if (!duplicateWarning?.article) return;

        const data = duplicateWarning;
        setNewsData({
            title: data.generated?.title || data.article.title,
            summary: data.generated?.summary || data.article.excerpt || data.article.textContent?.slice(0, 300) + "...",
            image: data.article.image || "",
            source_url: url,
            source_name: data.article.siteName || "Unknown",
            category: data.article.category || data.generated?.category || "সাধারণ",
        });

        setIsDuplicate(true);
        setDuplicateWarning(null);
    };

    const handlePublish = async () => {
        if (!newsData || isDuplicate) return;
        setPublishing(true);
        updateProgress(10, "Preparing to publish...");

        try {
            const disclaimer = "\n\nএই সংবাদটি কৃত্রিম বুদ্ধিমত্তার মাধ্যমে সংক্ষেপ করা হয়েছে। সম্পূর্ণ সংবাদ পড়তে মূল সূত্রে যান।";
            const finalSummary = newsData.summary.endsWith(disclaimer.trim())
                ? newsData.summary
                : newsData.summary + disclaimer;

            updateProgress(30, "Connecting to secure server...");

            // Get ID Token for Auth
            if (!user) throw new Error("User not authenticated");
            const token = await user.getIdToken();

            updateProgress(50, "Saving & Sending Notification...");

            // Call Server API
            const response = await fetch("/api/news/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: newsData.title,
                    summary: finalSummary,
                    image: newsData.image,
                    source_url: newsData.source_url,
                    source_name: newsData.source_name,
                    category: newsData.category,
                    created_by: user.email
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to publish news");
            }

            if (result.notificationSent) {
                updateProgress(100, "Published & Notified Successfully!");
            } else {
                // WARNING: Notification failed but news is saved.
                alert("⚠️ খবর প্রকাশ হয়েছে, কিন্তু নোটিফিকেশন পাঠানো যায়নি (Push Failed)");
                updateProgress(100, "Published (Notification Warning)");
            }

            setTimeout(() => {
                router.push("/");
            }, 1000);

        } catch (err: any) {
            console.error("Publish Error:", err);
            setError("Failed to publish: " + err.message);
            updateProgress(0, "");
        } finally {
            setPublishing(false);
        }
    };

    // Duplicate Warning UI
    if (duplicateWarning) {
        return (
            <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-2xl border border-orange-200 bg-white p-8 shadow-xl text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <h2 className="mb-2 text-xl font-bold text-slate-900">Duplicate News Detected</h2>
                    <p className="text-orange-600 font-medium mb-1">{duplicateWarning.error}</p>
                    <p className="text-slate-500 text-sm mb-6 font-mono bg-slate-50 p-2 rounded break-all">{duplicateWarning.details}</p>

                    <div className="flex flex-col gap-3 justify-center sm:flex-row">
                        <button
                            onClick={() => {
                                setDuplicateWarning(null);
                                setUrl("");
                            }}
                            className="rounded-lg bg-slate-100 px-6 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                        >
                            Cancel
                        </button>

                        {duplicateWarning.article && (
                            <button
                                onClick={handleViewDuplicate}
                                className="rounded-lg bg-orange-100 px-6 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-200"
                            >
                                View Content (Disabled)
                            </button>
                        )}

                        <button
                            onClick={() => {
                                setDuplicateWarning(null);
                                setUrl("");
                            }}
                            className="rounded-lg bg-orange-600 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                        >
                            Try Another URL
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Step 1: Input URL and Progress/Error
    if (!newsData && !loading && progress.step === 0 && !duplicateWarning) {
        return (
            <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
                <div className="w-full max-w-xl text-center">
                    <h1 className="mb-2 text-3xl font-bold text-slate-800">Add New Article</h1>
                    <p className="mb-8 text-slate-500">Paste an article URL to automatically generate a summary.</p>

                    <div className="rounded-2xl bg-white p-2 shadow-xl shadow-slate-200/50 ring-1 ring-slate-100">
                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
                            <LinkIcon className="text-slate-400" size={20} />
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="Paste source URL here..."
                                className="flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
                                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={!url}
                        className="mt-6 w-full rounded-xl bg-indigo-600 px-6 py-4 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                    >
                        Generate Summary
                    </button>

                    {error && (
                        <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-red-50 p-3 text-red-600">
                            <AlertCircle size={18} />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Step 2: Loading / Progress
    if (loading || (progress.step > 0 && progress.step < 100 && !newsData)) {
        return (
            <div className="mx-auto max-w-6xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <Skeleton height={28} width={250} />
                        <Skeleton height={20} width={400} />
                    </div>
                    <div className="flex gap-3">
                        <Skeleton height={36} width={80} />
                        <Skeleton height={36} width={120} />
                    </div>
                </div>
                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-1 space-y-6">
                        <Skeleton height={200} />
                        <Skeleton height={150} />
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                        <Skeleton height={400} />
                    </div>
                </div>
            </div>
        );
    }

    // Step 3: Editor / Preview
    return (
        <div className="mx-auto max-w-6xl">
            {isDuplicate && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                    <p className="font-bold text-red-700">🚫 Publishing Disabled: Duplicate Content Detected</p>
                    <p className="text-sm text-red-600">This content matches an existing article in the database.</p>
                </div>
            )}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Edit & Publish</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500">Review the AI-generated content.</p>
                        {language && (
                            <div className={`flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-medium border ${language === 'English'
                                ? 'bg-purple-50 text-purple-700 border-purple-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}>
                                <span>{language === 'English' ? '🇬🇧 Translated from English' : '🇧🇩 Original Bangla'}</span>
                            </div>
                        )}
                        {providerInfo && (
                            <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-100">
                                <span>{providerInfo.provider}</span>
                                <span className="opacity-40">/</span>
                                <span className="font-mono opacity-80">{providerInfo.model}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { setNewsData(null); setUrl(""); setProgress({ step: 0, message: "" }); setIsDuplicate(false); }}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={publishing || isDuplicate}
                        className={`rounded-lg px-6 py-2 text-sm font-medium text-white shadow-sm flex items-center gap-2 ${isDuplicate
                            ? "bg-slate-400 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700"
                            } disabled:opacity-50`}
                    >
                        {publishing ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                        {isDuplicate ? "Publish Disabled" : "Publish Live"}
                    </button>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid gap-8 lg:grid-cols-3">
                {/* Left Column: Image & Metadata */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="relative aspect-video w-full bg-slate-100">
                            {newsData?.image ? (
                                <img
                                    src={newsData.image}
                                    alt="Preview"
                                    className="h-full w-full object-cover"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center text-slate-400">
                                    No Image
                                </div>
                            )}
                        </div>
                        <div className="p-4">
                            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Image URL</label>
                            <input
                                type="text"
                                value={newsData?.image || ""}
                                onChange={(e) => setNewsData(prev => prev ? ({ ...prev, image: e.target.value }) : null)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                            />
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h3 className="mb-4 font-semibold text-slate-900">Source Information</h3>

                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Source Name</label>
                        <input
                            type="text"
                            value={newsData?.source_name || ""}
                            onChange={(e) => setNewsData(prev => prev ? ({ ...prev, source_name: e.target.value }) : null)}
                            className="mb-4 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                        />

                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Source URL</label>
                        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 break-all border border-slate-200">
                            {newsData?.source_url}
                        </div>
                    </div>
                </div>

                {/* Right Column: Title & Content */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

                        <div className="mb-6">
                            <label className="mb-2 block text-sm font-semibold text-slate-900">Category</label>
                            <div className="relative">
                                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <select
                                    value={newsData?.category || "সাধারণ"}
                                    onChange={(e) => setNewsData(prev => prev ? ({ ...prev, category: e.target.value }) : null)}
                                    className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <label className="mb-2 block text-sm font-semibold text-slate-900">News Title (Bangla)</label>
                        <input
                            type="text"
                            value={newsData?.title || ""}
                            onChange={(e) => setNewsData(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                            className="mb-6 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-lg font-bold text-slate-900 focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="Enter title here"
                        />

                        <label className="mb-2 block text-sm font-semibold text-slate-900">News Summary (Bangla)</label>
                        <textarea
                            rows={12}
                            value={newsData?.summary || ""}
                            onChange={(e) => setNewsData(prev => prev ? ({ ...prev, summary: e.target.value }) : null)}
                            className="ww-full w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base leading-relaxed text-slate-800 focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="Enter summary here..."
                        />
                        <p className="mt-2 text-xs text-slate-400 italic">
                            * An AI disclaimer will be automatically appended to the summary upon publishing.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
