'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AppAdConfig, AdPositionConfig } from '@/types/ads';
import { toast } from 'react-hot-toast';
import Skeleton from "@/components/Skeleton";

const DEFAULT_CONFIG: AppAdConfig = {
    global_enabled: false,
    banner: { enabled: false, provider: 'none' },
    native: { enabled: false, provider: 'none' },
    interstitial: { enabled: false, provider: 'none' }
};

export default function AdsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<AppAdConfig>(DEFAULT_CONFIG);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const docRef = doc(db, 'system_ads', 'config');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                setConfig(snap.data() as AppAdConfig);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load ad config");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const docRef = doc(db, 'system_ads', 'config');
            await setDoc(docRef, {
                ...config,
                last_updated: new Date().toISOString()
            });
            toast.success("Ad configuration saved!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    const updateGlobal = (val: boolean) => setConfig({ ...config, global_enabled: val });

    const updateSection = (section: keyof Omit<AppAdConfig, 'global_enabled' | 'last_updated'>, field: keyof AdPositionConfig, value: any) => {
        setConfig(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    if (loading) {
        return (
            <div className="p-6 max-w-4xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <Skeleton height={32} width={300} />
                    <Skeleton height={40} width={120} />
                </div>
                <Skeleton height={100} />
                <div className="space-y-6">
                    <Skeleton height={150} />
                    <Skeleton height={150} />
                    <Skeleton height={150} />
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">App Ads Management</h1>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* Global Toggle */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Global Ads Toggle</h2>
                    <p className="text-gray-500 text-sm">Master switch to enable/disable all ads in the app immediately.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={config.global_enabled}
                        onChange={(e) => updateGlobal(e.target.checked)}
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {/* Sections */}
            <div className={`grid gap-6 ${!config.global_enabled ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <AdSectionCard
                    title="Home Banner Ad"
                    desc="Small banner shown at the top of Home Screen"
                    config={config.banner}
                    onChange={(f, v) => updateSection('banner', f, v)}
                />

                <AdSectionCard
                    title="News List Native Ad"
                    desc="Native ad injected between news items"
                    config={config.native}
                    onChange={(f, v) => updateSection('native', f, v)}
                />

                <AdSectionCard
                    title="Interstitial Ad"
                    desc="Full screen ad shown when opening details"
                    config={config.interstitial}
                    onChange={(f, v) => updateSection('interstitial', f, v)}
                />
            </div>
        </div>
    );
}

function AdSectionCard({ title, desc, config, onChange }: {
    title: string,
    desc: string,
    config: AdPositionConfig,
    onChange: (field: keyof AdPositionConfig, value: any) => void
}) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                    <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => onChange('enabled', e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
            </div>

            {config.enabled && (
                <div className="pt-4 space-y-4 border-t border-gray-50">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                        <select
                            value={config.provider}
                            onChange={(e) => onChange('provider', e.target.value)}
                            className="w-full rounded border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="none">Select Provider...</option>
                            <option value="admob">Google AdMob</option>
                            <option value="custom">Custom Image</option>
                        </select>
                    </div>

                    {config.provider === 'admob' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ad Unit ID</label>
                            <input
                                type="text"
                                value={config.unit_id || ''}
                                onChange={(e) => onChange('unit_id', e.target.value)}
                                placeholder="ca-app-pub-xxxxxxxx/yyyyyyyy"
                                className="w-full rounded border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    )}

                    {config.provider === 'custom' && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                                <input
                                    type="text"
                                    value={config.custom_image_url || ''}
                                    onChange={(e) => onChange('custom_image_url', e.target.value)}
                                    placeholder="https://..."
                                    className="w-full rounded border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Target Link</label>
                                <input
                                    type="text"
                                    value={config.custom_link_url || ''}
                                    onChange={(e) => onChange('custom_link_url', e.target.value)}
                                    placeholder="https://..."
                                    className="w-full rounded border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
