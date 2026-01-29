"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp,
    startAfter,
    getDocs,
    where,
} from "firebase/firestore";
import { format } from "date-fns";
import { Edit, Eye, EyeOff, Loader2, Trash2, Search, ChevronLeft, ChevronRight, ThumbsUp, FileText, Tag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import Skeleton from "@/components/Skeleton";

// Available categories for news
export const CATEGORIES = [
    "সাধারণ",
    "খেলাধুলা",
    "রাজনীতি",
    "প্রযুক্তি",
    "বিনোদন",
    "অর্থনীতি",
    "স্বাস্থ্য",
    "বিজ্ঞান",
    "শিক্ষা",
    "আন্তর্জাতিক",
    "জাতীয়",
    "জীবনযাত্রা",
    "মতামত",
    "সম্পাদকীয়",
    "অপরাধ",
    "পরিবেশ",
    "ধর্ম"
];

interface NewsItem {
    id: string;
    title: string;
    published_at: any;
    image: string;
    source_name: string;
    likes: number;
    summary: string;
    category?: string;
}

export default function NewsListPage() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [categoryFilter, setCategoryFilter] = useState("");
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [updatingCategory, setUpdatingCategory] = useState(false);

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({
        isOpen: false,
        id: null
    });
    const [isDeleting, setIsDeleting] = useState(false);

    const itemsPerPage = 10;

    // ... (useEffect remains same)

    useEffect(() => {
        const q = query(collection(db, "news"), orderBy("created_at", "desc"), limit(100));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as NewsItem[];
            setNews(newsData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDeleteClick = (id: string) => {
        setDeleteModal({ isOpen: true, id });
    };

    const confirmDelete = async () => {
        if (!deleteModal.id) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, "news", deleteModal.id));
            setDeleteModal({ isOpen: false, id: null });
        } catch (error) {
            console.error("Delete failed", error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleTogglePublish = async (id: string, currentStatus: boolean) => {
        try {
            await updateDoc(doc(db, "news", id), {
                published_at: currentStatus ? null : serverTimestamp(),
            });
        } catch (error) {
            console.error("Toggle publish failed", error);
        }
    };

    const handleCategoryChange = async (id: string, newCategory: string) => {
        setUpdatingCategory(true);
        try {
            await updateDoc(doc(db, "news", id), {
                category: newCategory,
            });
            setEditingCategory(null);
        } catch (error) {
            console.error("Category update failed", error);
        } finally {
            setUpdatingCategory(false);
        }
    };

    // Filter & Pagination Logic
    const filteredNews = news.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.source_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !categoryFilter || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const totalPages = Math.ceil(filteredNews.length / itemsPerPage);
    const paginatedNews = filteredNews.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Skeleton height={28} width={250} />
                        <Skeleton height={20} width={400} />
                    </div>
                    <Skeleton height={44} width={150} />
                </div>
                <Skeleton height={68} />
                <Skeleton height={400} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">News Articles</h1>
                    <p className="text-slate-500">Manage, edit, and publish your generated news content.</p>
                </div>
                <Link
                    href="/news/add"
                    className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition"
                >
                    Add New Article
                </Link>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by title or source..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
                <div className="relative">
                    <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                    >
                        <option value="">All Categories</option>
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-6 py-4 font-medium">Article</th>
                                <th className="px-6 py-4 font-medium">Category</th>
                                <th className="px-6 py-4 font-medium">Source</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium text-center">Likes</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedNews.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No articles found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                paginatedNews.map((item) => {
                                    const isPublished = !!item.published_at;
                                    return (
                                        <tr key={item.id} className="group hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-4">
                                                    {item.image ? (
                                                        <img
                                                            src={item.image}
                                                            alt=""
                                                            className="h-16 w-24 flex-shrink-0 rounded-lg object-cover bg-slate-100"
                                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                                        />
                                                    ) : (
                                                        <div className="h-16 w-24 flex-shrink-0 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs">No Img</div>
                                                    )}
                                                    <div>
                                                        <div className="mb-1 font-semibold text-slate-900 line-clamp-2 max-w-md">
                                                            {item.title}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            {item.published_at
                                                                ? format(
                                                                    (typeof item.published_at.toDate === 'function')
                                                                        ? item.published_at.toDate()
                                                                        : new Date(item.published_at),
                                                                    "MMM d, yyyy • h:mm a"
                                                                )
                                                                : "Not published yet"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingCategory === item.id ? (
                                                    <select
                                                        value={item.category || "সাধারণ"}
                                                        onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                                                        disabled={updatingCategory}
                                                        className="rounded-md border border-indigo-300 bg-white px-2 py-1 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                        autoFocus
                                                        onBlur={() => !updatingCategory && setEditingCategory(null)}
                                                    >
                                                        {CATEGORIES.map(cat => (
                                                            <option key={cat} value={cat}>{cat}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <button
                                                        onClick={() => setEditingCategory(item.id)}
                                                        className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                                                        title="Click to change category"
                                                    >
                                                        <Tag size={12} />
                                                        {item.category || "সাধারণ"}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                                    {item.source_name || "Unknown"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${isPublished
                                                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                                                        : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                                                        }`}
                                                >
                                                    <span className={`h-1.5 w-1.5 rounded-full ${isPublished ? "bg-emerald-600" : "bg-amber-600"}`}></span>
                                                    {isPublished ? "Published" : "Draft"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1 text-slate-600">
                                                    <ThumbsUp size={14} />
                                                    <span>{item.likes || 0}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleTogglePublish(item.id, isPublished)}
                                                        className={`rounded p-1.5 transition-colors ${isPublished
                                                            ? "text-slate-500 hover:bg-slate-100 hover:text-amber-600"
                                                            : "text-slate-500 hover:bg-slate-100 hover:text-emerald-600"
                                                            }`}
                                                        title={isPublished ? "Unpublish" : "Publish"}
                                                    >
                                                        {isPublished ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                    <Link
                                                        href={`/news/${item.id}`}
                                                        className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600"
                                                        title="View Details"
                                                    >
                                                        <FileText size={18} />
                                                    </Link>
                                                    <Link
                                                        href={`/news/edit/${item.id}`}
                                                        className="rounded p-1.5 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                                        title="Edit"
                                                    >
                                                        <Edit size={18} />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDeleteClick(item.id)}
                                                        className="rounded p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                        <div className="text-sm text-slate-500">
                            Showing page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                                <ChevronLeft size={16} /> Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <DeleteConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null })}
                onConfirm={confirmDelete}
                title="Delete News Article"
                description="Are you sure you want to delete this article? This action cannot be undone and will permanently remove the content."
                isDeleting={isDeleting}
            />
        </div >
    );
}
