'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { toast } from "sonner";
import Skeleton from '@/components/Skeleton';
import { Facebook, Trash2, TestTube, Power, PowerOff, ExternalLink } from 'lucide-react';
import { FacebookPageConnection } from '@/types/facebook';
import FacebookCredentials from '@/components/FacebookCredentials';

export default function FacebookPage() {
    const [loading, setLoading] = useState(true);
    const [pages, setPages] = useState<FacebookPageConnection[]>([]);
    const [connecting, setConnecting] = useState(false);
    const [testing, setTesting] = useState<string | null>(null);

    type FirestoreTimestamp = { toDate?: () => Date };
    const getDateValue = (value: unknown): Date | null => {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value === 'string' || typeof value === 'number') return new Date(value);
        const maybe = value as FirestoreTimestamp;
        return typeof maybe.toDate === 'function' ? maybe.toDate() : null;
    };

    useEffect(() => {
        fetchPages();

        // Check for OAuth callback success/error in URL
        const params = new URLSearchParams(window.location.search);
        const success = params.get('success');
        const error = params.get('error');
        const pagesCount = params.get('pages');

        if (success) {
            toast.success(`Successfully connected ${pagesCount} Facebook page(s)!`);
            window.history.replaceState({}, '', '/facebook');
        } else if (error) {
            toast.error(`Failed to connect: ${decodeURIComponent(error)}`);
            window.history.replaceState({}, '', '/facebook');
        }
    }, []);

    const fetchPages = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/facebook/pages', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) throw new Error('Failed to fetch pages');

            const data = await res.json();
            setPages(data);
        } catch (error: unknown) {
            console.error(error);
            toast.error('Failed to fetch Facebook pages');
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        setConnecting(true);
        window.location.href = '/api/facebook/oauth';
    };

    const handleToggle = async (pageId: string, currentEnabled: boolean) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/facebook/pages', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id: pageId, enabled: !currentEnabled })
            });

            if (!res.ok) throw new Error('Failed to update page');

            toast.success(`Page ${!currentEnabled ? 'enabled' : 'disabled'}`);
            fetchPages();
        } catch (error: unknown) {
            console.error(error);
            toast.error('Failed to update page');
        }
    };

    const handleDelete = async (pageId: string, pageName: string) => {
        if (!confirm(`Are you sure you want to remove "${pageName}"?`)) return;

        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`/api/facebook/pages?id=${pageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) throw new Error('Failed to delete page');

            toast.success('Page removed successfully');
            fetchPages();
        } catch (error: unknown) {
            console.error(error);
            toast.error('Failed to remove page');
        }
    };

    const handleTestPost = async (pageId: string, pageName: string) => {
        setTesting(pageId);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/facebook/test-post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ pageId })
            });

            const result = await res.json();

            if (result.success) {
                toast.success(`Test post created on "${pageName}"!`);
            } else {
                toast.error(result.error || 'Test post failed');
            }
        } catch (error: unknown) {
            console.error(error);
            toast.error('Failed to create test post');
        } finally {
            setTesting(null);
        }
    };

    if (loading) {
        return (
            <div className="p-6 max-w-5xl mx-auto space-y-6">
                <Skeleton height={40} width={300} />
                <Skeleton height={120} />
                <Skeleton height={200} />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Facebook className="text-blue-600" size={28} />
                        Facebook Integration
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Connect your Facebook pages to automatically post news articles
                    </p>
                </div>
                <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                    <Facebook size={18} />
                    {connecting ? 'Connecting...' : 'Connect Facebook Page'}
                </button>
            </div>

            {/* Credentials Configuration */}
            <FacebookCredentials />

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">How it works</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Click &quot;Connect Facebook Page&quot; to authorize your Facebook pages</li>
                    <li>• All news published (manually or via RSS) will be automatically posted to enabled pages</li>
                    <li>• You can test the connection anytime using the &quot;Test Post&quot; button</li>
                    <li>• Disable a page to stop auto-posting without removing it</li>
                </ul>
            </div>

            {/* Connected Pages */}
            {pages.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
                    <Facebook size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                        No Facebook pages connected
                    </h3>
                    <p className="text-slate-500 mb-6">
                        Connect your Facebook pages to start auto-posting news
                    </p>
                    <button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        Connect Now
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="border-b border-slate-100 px-6 py-4">
                        <h2 className="font-semibold text-slate-800">Connected Pages ({pages.length})</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {pages.map((page) => {
                            const expiresAt = getDateValue(page.token_expires_at) || new Date();
                            const daysUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            const isExpiringSoon = daysUntilExpiry < 7;
                            const isExpired = daysUntilExpiry < 0;

                            return (
                                <div key={page.id} className="px-6 py-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="font-semibold text-slate-900">
                                                    {page.page_name}
                                                </h3>
                                                {page.enabled ? (
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                                        Auto-posting enabled
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded">
                                                        Disabled
                                                    </span>
                                                )}
                                                {isExpired && (
                                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                                                        Token Expired
                                                    </span>
                                                )}
                                                {!isExpired && isExpiringSoon && (
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                                                        Expires in {daysUntilExpiry} days
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                                                <span>Page ID: {page.page_id}</span>
                                                <span>Total Posts: {page.total_posts}</span>
                                                {page.last_posted_at && (
                                                    <span>
                                                        Last Posted: {(getDateValue(page.last_posted_at) || new Date()).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            {page.last_error && (
                                                <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                                    ⚠️ Last Error: {page.last_error}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 ml-4">
                                            <button
                                                onClick={() => handleToggle(page.id, page.enabled)}
                                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                                title={page.enabled ? 'Disable auto-posting' : 'Enable auto-posting'}
                                            >
                                                {page.enabled ? <Power size={18} /> : <PowerOff size={18} />}
                                            </button>
                                            <button
                                                onClick={() => handleTestPost(page.id, page.page_name)}
                                                disabled={testing === page.id}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
                                                title="Test post"
                                            >
                                                {testing === page.id ? (
                                                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                                                ) : (
                                                    <TestTube size={18} />
                                                )}
                                            </button>
                                            <a
                                                href={`https://facebook.com/${page.page_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                                title="View on Facebook"
                                            >
                                                <ExternalLink size={18} />
                                            </a>
                                            <button
                                                onClick={() => handleDelete(page.id, page.page_name)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                title="Remove page"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
