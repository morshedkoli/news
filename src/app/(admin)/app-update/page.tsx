'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AppVersionConfig } from '@/types/app-config';
import { toast } from 'react-hot-toast';
import { Smartphone, Save, AlertCircle } from 'lucide-react';
import Skeleton from '@/components/Skeleton';

const DEFAULT_CONFIG: AppVersionConfig = {
    latest_version: '1.0.0',
    force_update: false,
    update_message: 'New version available! Please update to continue.',
    play_store_url: ''
};

export default function AppUpdatePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<AppVersionConfig>(DEFAULT_CONFIG);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const docRef = doc(db, 'app_config', 'version');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                setConfig(snap.data() as AppVersionConfig);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load app config");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!config.latest_version) {
            toast.error("Version is required");
            return;
        }

        setSaving(true);
        try {
            const docRef = doc(db, 'app_config', 'version');
            await setDoc(docRef, {
                ...config,
                last_updated: new Date().toISOString()
            });
            toast.success("App configuration saved!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof AppVersionConfig, value: any) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    if (loading) {
        return (
            <div className="p-6 max-w-4xl mx-auto space-y-8">
                <div className="flex justify-between items-center border-b border-gray-200 pb-6">
                    <div className="flex items-center gap-3">
                        <Skeleton height={52} width={52} />
                        <div>
                            <Skeleton height={28} width={300} />
                            <Skeleton height={20} width={400} />
                        </div>
                    </div>
                    <Skeleton height={44} width={150} />
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton height={300} />
                    <Skeleton height={300} />
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-center border-b border-gray-200 pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                        <Smartphone size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">App Version Control</h1>
                        <p className="text-gray-500 text-sm">Manage Android app update settings and enforcement</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium shadow-sm"
                >
                    <Save size={18} />
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Version & Enforcement */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
                    <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3">Version Settings</h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Latest Version Code</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={config.latest_version}
                                onChange={(e) => handleChange('latest_version', e.target.value)}
                                placeholder="e.g. 2.0.0"
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pl-4 py-2.5"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span className="text-gray-400 text-xs">v{config.latest_version}</span>
                            </div>
                        </div>
                        <p className="mt-1.5 text-xs text-gray-500">Matches the `versionName` in Android `build.gradle`</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <span className="block text-sm font-medium text-gray-900">Force Update</span>
                            <span className="block text-xs text-gray-500 mt-1">Require users to update immediately</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={config.force_update}
                                onChange={(e) => handleChange('force_update', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                    </div>

                    {config.force_update && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                            <AlertCircle size={16} className="mt-0.5" />
                            <p>Users on older versions will be blocked from using the app until they update.</p>
                        </div>
                    )}
                </div>

                {/* URLs & Messages */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
                    <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3">Distribution</h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Play Store URL</label>
                        <input
                            type="url"
                            value={config.play_store_url}
                            onChange={(e) => handleChange('play_store_url', e.target.value)}
                            placeholder="https://play.google.com/store/apps/details?id=..."
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Update Message (Bangla supported)</label>
                        <textarea
                            rows={4}
                            value={config.update_message}
                            onChange={(e) => handleChange('update_message', e.target.value)}
                            placeholder="What's new in this version?"
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
