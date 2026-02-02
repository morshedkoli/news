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
    where,
} from "firebase/firestore";
import { format } from "date-fns";
import { Edit, Trash2, Search, ChevronLeft, ChevronRight, AlertTriangle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import Skeleton from "@/components/Skeleton";
import { toast } from "sonner";

interface BlockedNewsItem {
    id: string;
    title: string;
    created_at: any;
    image: string;
    source_name: string;
    summary: string;
    block_reasons?: string[];
}

export default function BlockedNewsPage() {
    const [news, setNews] = useState<BlockedNewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({
        isOpen: false,
        id: null
    });
    const [isDeleting, setIsDeleting] = useState(false);

    const itemsPerPage = 10;

    useEffect(() => {
        // Query only BLOCKED status
        const q = query(
            collection(db, "news"),
            where("status", "==", "blocked"),
            orderBy("created_at", "desc"),
            limit(100)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as BlockedNewsItem[];
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
            toast.success("Blocked news discarded permanently");
        } catch (error) {
            console.error("Delete failed", error);
            toast.error("Failed to discard blocked news");
        } finally {
            setIsDeleting(false);
        }
    };

    // Filter & Pagination Logic
    const filteredNews = news.filter(item => {
        return item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.source_name?.toLowerCase().includes(searchTerm.toLowerCase());
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
                </div>
                <Skeleton height={400} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-red-700 flex items-center gap-2">
                        <ShieldAlert className="h-8 w-8" />
                        Blocked News
                    </h1>
                    <p className="text-slate-500">News items blocked by the strict content validation gate.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search blocked news..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-red-50 text-xs uppercase text-red-800">
                            <tr>
                                <th className="px-6 py-4 font-medium">Article</th>
                                <th className="px-6 py-4 font-medium">Source</th>
                                <th className="px-6 py-4 font-medium">Block Reasons</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedNews.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        No blocked news found. Everything is healthy!
                                    </td>
                                </tr>
                            ) : (
                                paginatedNews.map((item) => (
                                    <tr key={item.id} className="group hover:bg-slate-50/50 transition">
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
                                                        {item.created_at
                                                            ? format(
                                                                (typeof item.created_at.toDate === 'function')
                                                                    ? item.created_at.toDate()
                                                                    : new Date(item.created_at),
                                                                "MMM d, yyyy • h:mm a"
                                                            )
                                                            : "Unknown Date"}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                                {item.source_name || "Unknown"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {(item.block_reasons || ["UNKNOWN"]).map((reason, idx) => (
                                                    <span key={idx} className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                                                        <AlertTriangle size={10} />
                                                        {reason}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    href={`/news/edit/${item.id}`}
                                                    className="rounded p-1.5 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                                    title="Fix & Publish"
                                                >
                                                    <Edit size={18} />
                                                </Link>
                                                <button
                                                    onClick={() => handleDeleteClick(item.id)}
                                                    className="rounded p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                                    title="Discard"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
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
                title="Discard Blocked News"
                description="Are you sure you want to discard this blocked item permanently?"
                isDeleting={isDeleting}
            />
        </div >
    );
}
