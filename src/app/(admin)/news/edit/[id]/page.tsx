"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Skeleton from "@/components/Skeleton";

export default function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newsData, setNewsData] = useState<any>(null);
    const router = useRouter();
    const { user } = useAuth();

    useEffect(() => {
        async function fetchNews() {
            try {
                const docRef = doc(db, "news", id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setNewsData({ id: docSnap.id, ...docSnap.data() });
                } else {
                    router.push("/news");
                }
            } catch (error) {
                console.error("Error fetching news:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchNews();
    }, [id, router]);

    const handleUpdate = async () => {
        setSaving(true);
        try {
            const docRef = doc(db, "news", id);
            await updateDoc(docRef, {
                title: newsData.title,
                summary: newsData.summary,
                image: newsData.image,
                updated_at: serverTimestamp(),
            });
            router.push("/news");
        } catch (error) {
            console.error("Update failed:", error);
            alert("Failed to update news");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
                <div className="mx-auto max-w-3xl">
                    <Skeleton height={24} width={120} />
                    <div className="rounded-lg bg-white p-6 shadow mt-6">
                        <Skeleton height={32} width={200} />
                        <div className="space-y-6 mt-6">
                            <Skeleton height={40} />
                            <Skeleton height={120} />
                            <Skeleton height={40} />
                            <div className="flex justify-end">
                                <Skeleton height={48} width={150} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="mx-auto max-w-3xl">
                <Link href="/news" className="mb-6 flex items-center text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
                </Link>

                <div className="rounded-lg bg-white p-6 shadow">
                    <h1 className="mb-6 text-2xl font-bold">Edit News</h1>

                    <div className="space-y-6">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Bangla Title</label>
                            <input
                                type="text"
                                value={newsData.title}
                                onChange={(e) => setNewsData({ ...newsData, title: e.target.value })}
                                className="block w-full rounded-md border border-gray-300 bg-white text-gray-900 px-4 py-2 font-semibold focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Bangla Summary</label>
                            <textarea
                                rows={10}
                                value={newsData.summary}
                                onChange={(e) => setNewsData({ ...newsData, summary: e.target.value })}
                                className="block w-full rounded-md border border-gray-300 bg-white text-gray-900 px-4 py-2 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Image URL</label>
                            <input
                                type="text"
                                value={newsData.image}
                                onChange={(e) => setNewsData({ ...newsData, image: e.target.value })}
                                className="block w-full rounded-md border border-gray-300 bg-white text-gray-900 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            />
                            {newsData.image && (
                                <img
                                    src={newsData.image}
                                    alt="Preview"
                                    className="mt-4 h-32 w-auto rounded object-cover"
                                />
                            )}
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleUpdate}
                                disabled={saving}
                                className="flex items-center rounded-md bg-blue-600 px-8 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Update News
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
