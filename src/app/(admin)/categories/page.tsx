"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Tag, Calendar, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import Skeleton from "@/components/Skeleton";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

interface CategoryData {
    name: string;
    slug: string;
    postCount: number;
    lastPostAt: any;
    enabled: boolean;
}

export default function CategoriesPage() {
    const [categories, setCategories] = useState<CategoryData[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/categories?admin=true');
            const data = await res.json();
            if (data.categories) {
                setCategories(data.categories);
            }
        } catch (error) {
            console.error("Failed to fetch categories", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const toggleCategory = async (slug: string, currentStatus: boolean) => {
        setToggling(slug);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`/api/categories/${encodeURIComponent(slug)}/toggle`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to toggle');
            }

            const data = await res.json();

            // Update local state
            setCategories(prev => prev.map(cat =>
                cat.slug === slug ? { ...cat, enabled: data.enabled } : cat
            ));

            toast.success(`Category ${data.enabled ? 'enabled' : 'disabled'}`);
        } catch (error: any) {
            console.error("Failed to toggle category", error);
            toast.error(error.message || "Failed to toggle category");
        } finally {
            setToggling(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <Skeleton height={28} width={200} />
                        <Skeleton height={20} width={300} />
                    </div>
                </div>
                <Skeleton height={400} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
                    <p className="text-slate-500">Overview of active news categories and their statistics.</p>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-6 py-4 font-medium">Category Name</th>
                                <th className="px-6 py-4 font-medium">Slug</th>
                                <th className="px-6 py-4 font-medium text-center">Post Count</th>
                                <th className="px-6 py-4 font-medium">Last Published</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {categories.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No categories found. Start publishing news to see categories here.
                                    </td>
                                </tr>
                            ) : (
                                categories.map((cat) => (
                                    <tr key={cat.slug} className="group hover:bg-slate-50/50 transition">
                                        <td className="px-6 py-4 text-slate-900 font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                                    <Tag size={16} />
                                                </div>
                                                {cat.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                            {cat.slug}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cat.postCount > 0 ? "bg-slate-100 text-slate-800" : "bg-red-50 text-red-700"}`}>
                                                {cat.postCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            {cat.lastPostAt ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar size={14} className="text-slate-400" />
                                                    {format(new Date(cat.lastPostAt._seconds * 1000), "MMM d, yyyy")}
                                                </div>
                                            ) : "-"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cat.enabled !== false
                                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                                                    : "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-300"
                                                    }`}
                                            >
                                                <span className={`h-1.5 w-1.5 rounded-full ${cat.enabled !== false ? "bg-emerald-600" : "bg-slate-400"}`}></span>
                                                {cat.enabled !== false ? "Enabled" : "Disabled"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => toggleCategory(cat.slug, cat.enabled !== false)}
                                                disabled={toggling === cat.slug}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${cat.enabled !== false
                                                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                    : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                                                    } disabled:opacity-50`}
                                            >
                                                {toggling === cat.slug ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : cat.enabled !== false ? (
                                                    <><ToggleRight size={14} /> Disable</>
                                                ) : (
                                                    <><ToggleLeft size={14} /> Enable</>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
