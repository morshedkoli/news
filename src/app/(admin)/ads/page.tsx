'use client';

import { useState, useEffect, useMemo } from 'react';
import { auth } from '@/lib/firebase';
import { AppAdConfig, AdPositionConfig } from '@/types/ads';
import { toast } from "sonner";
import Skeleton from "@/components/Skeleton";
import { AlertTriangle } from 'lucide-react';

const DEFAULT_CONFIG: AppAdConfig = {
    global_enabled: false,
    banner: { enabled: false, provider: 'none' },
    native: { enabled: false, provider: 'none' },
    interstitial: { enabled: false, provider: 'none' }
};

// Validation helper
function validateAdConfig(cfg: AppAdConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const positions: Array<keyof Omit<AppAdConfig, 'global_enabled' | 'last_updated' | 'last_updated_by' | 'config_version'>> = ['banner', 'native', 'interstitial'];

    for (const pos of positions) {
        const p = cfg[pos];
        if (p.enabled) {
            if (p.provider === 'none') {
                errors.push(`${pos.charAt(0).toUpperCase() + pos.slice(1)}: Select a provider`);
            }
            if (p.provider === 'admob' && (!p.unit_id || p.unit_id.trim() === '')) {
                errors.push(`${pos.charAt(0).toUpperCase() + pos.slice(1)}: Ad Unit ID is required for AdMob`);
            }
            if (p.provider === 'custom' && (!p.custom_image_url || p.custom_image_url.trim() === '')) {
                errors.push(`${pos.charAt(0).toUpperCase() + pos.slice(1)}: Image URL is required for Custom ads`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

export default function AdsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<AppAdConfig>(DEFAULT_CONFIG);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/app-config/ads');
            if (res.ok) {
                const data = await res.json();
                setConfig(data as AppAdConfig);
            } else {
                throw new Error('Failed to load ad config');
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load ad config");
        } finally {
            setLoading(false);
        }
    };

    // Validation state
    const validation = useMemo(() => validateAdConfig(config), [config]);

    const handleSave = async () => {
        // Pre-save validation
        if (!validation.valid) {
            toast.error(validation.errors[0]); // Show first error
            return;
        }

        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/app-config/ads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(config)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || 'Failed to save ad config');
            }
            toast.success("Ad configuration saved!");
            // Refresh to get updated version
            fetchConfig();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error";
            console.error(error);
            toast.error(message || "Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    const updateGlobal = (val: boolean) => setConfig({ ...config, global_enabled: val });

    type AdPositionValue = AdPositionConfig[keyof AdPositionConfig];
    const updateSection = (section: 'banner' | 'native' | 'interstitial', field: keyof AdPositionConfig, value: AdPositionValue) => {
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
                <div>
                    <h1 className="text-2xl font-bold">App Ads Management</h1>
                    {config.last_updated && (
                        <p className="text-xs text-gray-400 mt-1">
                            Last updated: {new Date(config.last_updated).toLocaleString()}
                            {config.config_version && <span className="ml-2 text-gray-300">v{config.config_version}</span>}
                        </p>
                    )}
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving || !validation.valid}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* Validation Warnings */}
            {!validation.valid && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-amber-500 mt-0.5" size={18} />
                        <div>
                            <p className="font-medium text-amber-800">Configuration Issues</p>
                            <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
                                {validation.errors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

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
    onChange: (field: keyof AdPositionConfig, value: AdPositionConfig[keyof AdPositionConfig]) => void
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
