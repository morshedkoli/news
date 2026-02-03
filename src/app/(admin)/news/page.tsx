"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
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
import { Edit, Eye, EyeOff, Loader2, Trash2, Search, ChevronLeft, ChevronRight, ThumbsUp, FileText, Tag, CheckSquare, Square, MinusSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import Skeleton from "@/components/Skeleton";
import { toast } from "sonner";

// Available categories for news
// Available categories for news mapped to slugs
export const CATEGORIES = [
    { name: "সাধারণ", slug: "general" },
    { name: "খেলাধুলা", slug: "sports" },
    { name: "রাজনীতি", slug: "politics" },
    { name: "প্রযুক্তি", slug: "technology" },
    { name: "বিনোদন", slug: "entertainment" },
    { name: "অর্থনীতি", slug: "economy" },
    { name: "স্বাস্থ্য", slug: "health" },
    { name: "বিজ্ঞান", slug: "science" },
    { name: "শিক্ষা", slug: "education" },
    { name: "আন্তর্জাতিক", slug: "international" },
    { name: "জাতীয়", slug: "national" },
    { name: "জীবনযাত্রা", slug: "lifestyle" },
    { name: "মতামত", slug: "opinion" },
    { name: "সম্পাদকীয়", slug: "editorial" },
    { name: "অপরাধ", slug: "crime" },
    { name: "পরিবেশ", slug: "environment" },
    { name: "ধর্ম", slug: "religion" }
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
    status?: 'published' | 'blocked' | 'draft' | 'processing';
    block_reasons?: string[];
}

export default function NewsListPage() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [categoryFilter, setCategoryFilter] = useState("");
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [updatingCategory, setUpdatingCategory] = useState(false);
    const [activeTab, setActiveTab] = useState<'published' | 'blocked' | 'draft'>('published');

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({
        isOpen: false,
        id: null
    });
    const [isDeleting, setIsDeleting] = useState(false);

    // Bulk Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkAction, setIsBulkAction] = useState(false);

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
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/news/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id: deleteModal.id })
            });
            if (!res.ok) throw new Error("Delete failed");

            setDeleteModal({ isOpen: false, id: null });
            toast.success("News article deleted successfully");
        } catch (error) {
            console.error("Delete failed", error);
            toast.error("Failed to delete news article");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleTogglePublish = async (id: string, currentStatus: boolean, e: React.MouseEvent) => {
        // Prevent row click
        e.stopPropagation();

        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/news/update-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id, published: !currentStatus })
            });
            if (!res.ok) throw new Error("Update failed");

            toast.success(currentStatus ? "Article unpublished" : "Article published");

        } catch (error) {
            console.error("Toggle publish failed", error);
            toast.error("Failed to update status");
        }
    };

    const handleCategoryChange = async (id: string, newCategory: string) => {
        setUpdatingCategory(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/news/update-category', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    articleId: id,
                    newCategorySlug: newCategory
                })
            });

            if (!res.ok) throw new Error("Failed to update category");

            toast.success("Category updated successfully");
            setEditingCategory(null);
        } catch (error) {
            console.error("Category update failed", error);
            toast.error("Failed to update category");
        } finally {
            setUpdatingCategory(false);
        }
    };

    // Bulk Actions Handlers
    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedNews.length && paginatedNews.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedNews.map(item => item.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkAction = async (action: 'publish' | 'unpublish' | 'delete') => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Are you sure you want to ${action} ${selectedIds.size} items?`)) return;

        setIsBulkAction(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/news/bulk-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ids: Array.from(selectedIds),
                    action
                })
            });

            if (!res.ok) throw new Error("Bulk action failed");
            const data = await res.json();

            toast.success(`Successfully processed ${data.count} items`);
            setSelectedIds(new Set());

        } catch (error) {
            console.error("Bulk action failed", error);
            toast.error("Failed to perform bulk action");
        } finally {
            setIsBulkAction(false);
        }
    };

    // Filter & Pagination Logic
    const filteredNews = news.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.source_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !categoryFilter || item.category === categoryFilter;

        // Date Filter
        let matchesDate = true;
        if (dateRange.start || dateRange.end) {
            const itemDate = item.published_at
                ? (typeof item.published_at.toDate === 'function' ? item.published_at.toDate() : new Date(item.published_at))
                : null;

            if (itemDate) {
                if (dateRange.start) {
                    matchesDate = matchesDate && itemDate >= new Date(dateRange.start);
                }
                if (dateRange.end) {
                    // Set end date to end of day
                    const end = new Date(dateRange.end);
                    end.setHours(23, 59, 59, 999);
                    matchesDate = matchesDate && itemDate <= end;
                }
            } else {
                // Drafts or Items without date don't match date filter if set
                matchesDate = false;
            }
        }

        return matchesSearch && matchesCategory && matchesDate;
    }).filter(item => {
        // Tab Filtering
        if (activeTab === 'published') return item.status === 'published' || (item.published_at && !item.status); // Fallback for old data
        if (activeTab === 'blocked') return item.status === 'blocked';
        if (activeTab === 'draft') return item.status === 'draft' || item.status === 'processing' || (!item.published_at && !item.status);
        return true;
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
                            <option key={cat.slug} value={cat.name}>{cat.name}</option>
                        ))}
                    </select>
                </div>
                {/* Date Filters */}
                <div className="flex items-center gap-2 border-l border-slate-200 pl-4 ml-2">
                    <div className="relative">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Start Date"
                        />
                    </div>
                    <span className="text-slate-400">-</span>
                    <div className="relative">
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="End Date"
                        />
                    </div>
                    {(dateRange.start || dateRange.end) && (
                        <button
                            onClick={() => setDateRange({ start: "", end: "" })}
                            className="ml-2 text-xs text-red-500 hover:text-red-700"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Status Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('published')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'published' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Published
                </button>
                <button
                    onClick={() => setActiveTab('blocked')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'blocked' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Blocked
                </button>
                <button
                    onClick={() => setActiveTab('draft')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'draft' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Drafts / Processing
                </button>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-6 py-4 w-12">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        {paginatedNews.length > 0 && selectedIds.size === paginatedNews.length ? (
                                            <CheckSquare size={20} className="text-indigo-600" />
                                        ) : selectedIds.size > 0 ? (
                                            <MinusSquare size={20} className="text-indigo-600" />
                                        ) : (
                                            <Square size={20} />
                                        )}
                                    </button>
                                </th>
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
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        No articles found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                paginatedNews.map((item) => {
                                    const isPublished = !!item.published_at;
                                    return (
                                        <tr key={item.id} className={`group hover:bg-slate-50/50 transition ${selectedIds.has(item.id) ? 'bg-indigo-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => toggleSelect(item.id)}
                                                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                >
                                                    {selectedIds.has(item.id) ? (
                                                        <CheckSquare size={20} className="text-indigo-600" />
                                                    ) : (
                                                        <Square size={20} />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-4">
                                                    {item.image ? (
                                                        <img
                                                            src={item.image}
                                                            alt=""
                                                            loading="lazy"
                                                            className="h-16 w-24 flex-shrink-0 rounded-lg object-cover bg-slate-100"
                                                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => (e.currentTarget.style.display = 'none')}
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
                                                            <option key={cat.slug} value={cat.slug}>{cat.name}</option>
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
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${item.status === 'published'
                                                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                                                        : item.status === 'blocked'
                                                            ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"
                                                            : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                                                        }`}
                                                >
                                                    <span className={`h-1.5 w-1.5 rounded-full ${item.status === 'published' ? "bg-emerald-600" : item.status === 'blocked' ? "bg-red-600" : "bg-amber-600"}`}></span>
                                                    {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : (isPublished ? "Published" : "Draft")}
                                                </span>
                                                {item.status === 'blocked' && item.block_reasons && (
                                                    <div className="mt-1 text-[10px] text-red-600 max-w-[150px] leading-tight">
                                                        {item.block_reasons.join(", ")}
                                                    </div>
                                                )}
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
                                                        onClick={(e) => handleTogglePublish(item.id, isPublished, e)}
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

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-xl bg-slate-900 p-2 pl-6 text-white shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
                    <div className="text-sm font-medium">
                        <span className="font-bold text-indigo-400">{selectedIds.size}</span> selected
                    </div>
                    <div className="h-6 w-px bg-slate-700"></div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handleBulkAction('publish')}
                            disabled={isBulkAction}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-800 transition-colors"
                        >
                            <Eye size={16} /> Publish
                        </button>
                        <button
                            onClick={() => handleBulkAction('unpublish')}
                            disabled={isBulkAction}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-800 transition-colors"
                        >
                            <EyeOff size={16} /> Unpublish
                        </button>
                        <button
                            onClick={() => handleBulkAction('delete')}
                            disabled={isBulkAction}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-950/30 transition-colors"
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    </div>
                    {isBulkAction && (
                        <div className="pl-2 border-l border-slate-700">
                            <Loader2 size={18} className="animate-spin text-indigo-400" />
                        </div>
                    )}
                </div>
            )}

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
