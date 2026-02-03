'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { Settings, Eye, EyeOff, Save, CheckCircle } from 'lucide-react';

interface FacebookSettings {
    app_id: string;
    app_secret: string;
    redirect_uri: string;
    configured: boolean;
}

export default function FacebookCredentials() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [settings, setSettings] = useState<FacebookSettings>({
        app_id: '',
        app_secret: '',
        redirect_uri: '',
        configured: false
    });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/facebook/settings', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) throw new Error('Failed to load settings');

            const data = await res.json();
            setSettings(data);
        } catch (error: any) {
            console.error(error);
            toast.error('Failed to load Facebook settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/facebook/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    app_id: settings.app_id,
                    app_secret: settings.app_secret,
                    redirect_uri: settings.redirect_uri
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to save settings');
            }

            toast.success('Facebook credentials saved successfully!');
            setSettings(prev => ({ ...prev, configured: true }));
            loadSettings(); // Reload to mask the secret
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-10 bg-slate-200 rounded"></div>
                    <div className="h-10 bg-slate-200 rounded"></div>
                    <div className="h-10 bg-slate-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-3">
                <Settings size={20} className="text-slate-600" />
                <h2 className="font-semibold text-slate-800">Facebook App Credentials</h2>
                {settings.configured && (
                    <span className="ml-auto text-xs flex items-center gap-1 text-green-600">
                        <CheckCircle size={14} />
                        Configured
                    </span>
                )}
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        App ID
                    </label>
                    <input
                        type="text"
                        value={settings.app_id}
                        onChange={(e) => setSettings({ ...settings, app_id: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your Facebook App ID"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        App Secret
                    </label>
                    <div className="relative">
                        <input
                            type={showSecret ? 'text' : 'password'}
                            value={settings.app_secret}
                            onChange={(e) => setSettings({ ...settings, app_secret: e.target.value })}
                            className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter your Facebook App Secret"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowSecret(!showSecret)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                        Keep this secret! Never share it publicly.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        OAuth Redirect URI
                    </label>
                    <input
                        type="url"
                        value={settings.redirect_uri}
                        onChange={(e) => setSettings({ ...settings, redirect_uri: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://yourdomain.com/api/facebook/callback"
                        required
                    />
                    <p className="mt-1 text-xs text-slate-500">
                        This must match the redirect URI configured in your Facebook App
                    </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                    <p className="font-semibold text-blue-900 mb-2">Setup Instructions:</p>
                    <ol className="text-blue-800 space-y-1 list-decimal list-inside">
                        <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">Meta for Developers</a></li>
                        <li>Create a new app or select an existing one</li>
                        <li>Add &quot;Facebook Login&quot; product</li>
                        <li>Configure OAuth redirect URIs in app settings</li>
                        <li>Copy App ID and App Secret from app dashboard</li>
                        <li>Paste credentials here and save</li>
                    </ol>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <Save size={18} />
                    {saving ? 'Saving...' : 'Save Credentials'}
                </button>
            </form>
        </div>
    );
}
