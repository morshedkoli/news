"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Globe, ThumbsUp, Layers, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Skeleton from "@/components/Skeleton";

interface NewsDetails {
    id: string;
    title: string;
    summary: string;
    image?: string;
    source_name?: string;
    source_url?: string;
    published_at?: any;
    created_at?: any;
    category?: string;
    likes?: number;
    importance_score?: number;
}

export default function ViewNewsPage() {
    const params = useParams(); // params.id is string | string[]
    const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : null;

    const [news, setNews] = useState<NewsDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;

        const fetchNews = async () => {
            try {
                const docRef = doc(db, "news", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setNews({ id: docSnap.id, ...docSnap.data() } as NewsDetails);
                } else {
                    setError("News article not found");
                }
            } catch (err) {
                console.error(err);
                setError("Failed to fetch news details");
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [id]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 pb-12">
                {/* Header / Back */}
                <div className="flex items-center gap-4">
                    <Skeleton height={40} width={40} />
                    <Skeleton height={28} width={200} />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <Skeleton height={256} />
                    <div className="p-6 md:p-8 space-y-6">
                        <div className="flex flex-wrap items-center gap-4">
                            <Skeleton height={24} width={100} />
                            <Skeleton height={24} width={120} />
                            <Skeleton height={24} width={180} />
                        </div>
                        <Skeleton height={40} width="80%" />
                        <div className="space-y-2">
                            <Skeleton height={20} width="100%" />
                            <Skeleton height={20} width="100%" />
                            <Skeleton height={20} width="90%" />
                            <Skeleton height={20} width="95%" />
                        </div>
                        <hr className="border-slate-100" />
                        <div className="flex justify-between">
                            <Skeleton height={40} width={200} />
                            <Skeleton height={40} width={180} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !news) return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <p className="text-red-500 font-medium">{error || "Article not found"}</p>
            <Link href="/news" className="text-indigo-600 hover:underline flex items-center gap-2">
                <ArrowLeft size={16} /> Back to News
            </Link>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            {/* Header / Back */}
            <div className="flex items-center gap-4">
                <Link href="/news" className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-xl font-bold text-slate-800">Article Details</h1>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">

                {/* Hero Image */}
                <div className="relative h-64 w-full bg-slate-100">
                    {news.image ? (
                        <img
                            src={news.image}
                            alt={news.title}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/800x400?text=No+Image';
                            }}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center text-slate-400">
                            No Image Available
                        </div>
                    )}

                    {/* Floating Status */}
                    <div className="absolute top-4 right-4 flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase shadow-sm ${news.published_at ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'}`}>
                            {news.published_at ? 'Published' : 'Draft'}
                        </span>
                    </div>
                </div>

                <div className="p-6 md:p-8 space-y-6">

                    {/* Meta Data Top */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5">
                            <Layers size={16} className="text-indigo-500" />
                            <span className="capitalize">{news.category || 'General'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Globe size={16} className="text-blue-500" />
                            <span>{news.source_name || 'Unknown Source'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Calendar size={16} className="text-slate-400" />
                            <span>
                                {news.published_at
                                    ? format(
                                        (typeof news.published_at.toDate === 'function')
                                            ? news.published_at.toDate()
                                            : new Date(news.published_at),
                                        "PPP p"
                                    )
                                    : 'Not Published'}
                            </span>
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-3xl font-black text-slate-900 leading-tight">
                        {news.title}
                    </h2>

                    {/* Summary / Content */}
                    <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                        <p className="whitespace-pre-line">{news.summary}</p>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Footer Actions / Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                        <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
                            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                <ThumbsUp size={16} className="text-indigo-500" />
                                <span>{news.likes || 0} Likes</span>
                            </div>
                            {news.importance_score && (
                                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                    <span className="text-amber-500 font-black">★</span>
                                    <span>Score: {news.importance_score}</span>
                                </div>
                            )}
                        </div>

                        {news.source_url && (
                            <a
                                href={news.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition shadow-sm"
                            >
                                Read Original Article <ExternalLink size={16} />
                            </a>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
