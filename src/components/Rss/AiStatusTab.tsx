'use client';

import { useState, useEffect } from "react";
import {
    Activity, Power, Zap, Clock,
    RefreshCw, ChevronRight, ArrowRight, AlertOctagon,
    BarChart3, Settings, Info
} from "lucide-react";
import { AiProvider } from "@/types/ai";

export default function AiStatusTab() {
    const [providers, setProviders] = useState<AiProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

    const fetchProviders = async () => {
        try {
            const res = await fetch('/api/admin/ai-providers');
            if (res.ok) {
                const data = await res.json();
                setProviders(data);
            }
        } catch {
            console.error("Failed to fetch AI providers");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProviders();
        const interval = setInterval(fetchProviders, 10000); // Fast poll for admin
        const handleHealthUpdate = () => fetchProviders();
        if (typeof window !== 'undefined') {
            window.addEventListener('ai-health-updated', handleHealthUpdate);
        }
        return () => {
            clearInterval(interval);
            if (typeof window !== 'undefined') {
                window.removeEventListener('ai-health-updated', handleHealthUpdate);
            }
        };
    }, []);

    const toggleProvider = async (id: string, current: boolean) => {
        if (!confirm(`Are you sure you want to ${current ? 'DISABLE' : 'ENABLE'} this provider?`)) return;
        // Stub: In real app, call server action
        console.log(`[Action] Toggle Provider ${id} -> ${!current}`);
        alert("Action logged. (Server integration pending)");
    };

    const toggleModel = async (providerId: string, modelId: string, current: boolean) => {
        if (!confirm(`Confirm: ${current ? 'Disable' : 'Enable'} model ${modelId}?`)) return;
        console.log(`[Action] Toggle Model ${modelId} (Provider: ${providerId}) -> ${!current}`);
        alert("Action logged. (Server integration pending)");
    };

    const recoverProvider = async (id: string) => {
        console.log(`[Action] Recover Provider ${id}`);
        alert("Recovery triggered. Check logs.");
    };

    if (loading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading AI System Context...</div>;

    // Global Stats
    const activeProviders = providers.filter(p => p.enabled && p.healthStatus !== 'unhealthy');
    const systemHealthy = activeProviders.length > 0;

    // Select Provider View
    const selectedProvider = providers.find(p => p.id === selectedProviderId);

    const formatTime = (value?: string | null) => {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString();
    };

    const getLatencyTone = (latency?: number) => {
        if (!latency && latency !== 0) return 'text-gray-400';
        if (latency <= 800) return 'text-emerald-600';
        if (latency <= 2000) return 'text-amber-600';
        return 'text-red-600';
    };

    const getStatusChip = (provider: AiProvider) => {
        if (!provider.enabled) {
            return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Disabled</span>;
        }

        if (provider.healthStatus === 'healthy') {
            return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Online</span>;
        }

        if (provider.healthStatus === 'degraded') {
            return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Degraded</span>;
        }

        if (provider.healthStatus === 'unhealthy') {
            return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Offline</span>;
        }

        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Not Checked</span>;
    };

    const getProviderUpdatedAt = (provider: AiProvider) => {
        const legacy = (provider as { lastUpdated?: string }).lastUpdated;
        return provider.stats?.lastUpdated || legacy || null;
    };

    const toggleExpanded = (id: string) => {
        setExpandedProviders(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="space-y-6">
            {/* SECTION 7: Global AI Status Banner */}
            <div className={`p-4 rounded-lg border flex items-center justify-between ${systemHealthy
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${systemHealthy ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {systemHealthy ? <Zap size={20} /> : <AlertOctagon size={20} />}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">
                            {systemHealthy ? 'AI System: Active' : 'AI System: CRITICAL STOP'}
                        </h2>
                        <p className="text-sm opacity-90">
                            {systemHealthy
                                ? `${activeProviders.length} Healthy Providers Available`
                                : 'All providers are unhealthy or disabled. Automatic posting paused.'}
                        </p>
                    </div>
                </div>
                {!systemHealthy && (
                    <button className="px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700 transition">
                        Emergency Restart
                    </button>
                )}
            </div>

            {/* MAIN CONTENT SWITCHER */}
            {!selectedProvider ? (
                // VIEW: COLLAPSIBLE LIST
                <div className="space-y-4">
                    {providers.sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0)).map(provider => {
                        const isExpanded = expandedProviders.has(provider.id);
                        const successRate = provider.stats?.successRate ?? 1;
                        const failureRate = (1 - successRate) * 100;
                        const latencyMs = provider.stats?.avgLatencyMs;
                        const healthScore = provider.healthScore ?? 100;
                        const scoreTone = healthScore >= 80 ? 'bg-emerald-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500';

                        return (
                            <div key={provider.id} className={`bg-white border rounded-xl shadow-sm ${!provider.enabled ? 'opacity-80 bg-gray-50' : ''}`}>
                                <button
                                    onClick={() => toggleExpanded(provider.id)}
                                    className="w-full p-5 flex flex-col gap-3 text-left"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${!provider.enabled ? 'bg-gray-100 text-gray-400' :
                                                    provider.healthStatus === 'unhealthy' ? 'bg-red-100 text-red-600' :
                                                        provider.healthStatus === 'degraded' ? 'bg-yellow-100 text-yellow-600' :
                                                            'bg-emerald-100 text-emerald-600'
                                                }`}>
                                                <Activity size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-gray-900 text-lg">{provider.name}</h3>
                                                    {getStatusChip(provider)}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                                    <span>Updated: {formatTime(getProviderUpdatedAt(provider))}</span>
                                                    {provider.provider_category && (
                                                        <span className="uppercase">{provider.provider_category}</span>
                                                    )}
                                                    {provider.healthStatus === 'degraded' && (
                                                        <span className="text-amber-600 font-medium">Degraded</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className={`font-mono ${getLatencyTone(latencyMs)}`}>
                                                {latencyMs ? `${(latencyMs / 1000).toFixed(2)}s` : '—'}
                                            </span>
                                            <ChevronRight size={18} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <span className="font-medium">Health Score</span>
                                        <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                                            <div className={`h-full ${scoreTone}`} style={{ width: `${healthScore}%` }} />
                                        </div>
                                        <span className="font-mono">{healthScore}/100</span>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-5 pb-5 space-y-4">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="bg-gray-50 p-3 rounded">
                                                <span className="text-gray-500 text-xs block">Failure Rate</span>
                                                <span className={`font-bold ${failureRate > 10 ? 'text-red-600' : 'text-gray-700'}`}>
                                                    {failureRate.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded">
                                                <span className="text-gray-500 text-xs block">Requests</span>
                                                <span className="font-bold text-gray-700">{provider.stats?.totalRequests ?? 0}</span>
                                            </div>
                                        </div>

                                        {provider.healthReason && (
                                            <div className="text-xs text-red-600">Error: {provider.healthReason}</div>
                                        )}

                                        {provider.pausedUntil && new Date(provider.pausedUntil).getTime() > Date.now() && (
                                            <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 p-2 rounded border border-red-100 animate-pulse">
                                                <Clock size={12} />
                                                PAUSED until {new Date(provider.pausedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}

                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                            <button
                                                onClick={() => setSelectedProviderId(provider.id)}
                                                className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                            >
                                                View Models <ChevronRight size={16} />
                                            </button>
                                            {provider.healthStatus !== 'healthy' && (
                                                <button onClick={() => recoverProvider(provider.id)} title="Retry Connection" className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600">
                                                    <RefreshCw size={12} /> Retry
                                                </button>
                                            )}
                                            <button
                                                onClick={() => toggleProvider(provider.id, provider.enabled ?? true)}
                                                className={`inline-flex items-center gap-1 ${provider.enabled ? 'text-slate-500 hover:text-red-600' : 'text-emerald-600'}`}
                                            >
                                                <Power size={12} /> {provider.enabled ? 'Disable' : 'Enable'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                // VIEW: DETAIL DRILL-DOWN
                <div className="space-y-6">
                    {/* Breadcrumb / Header */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedProviderId(null)}
                            className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1"
                        >
                            ← Back to Providers
                        </button>
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            {selectedProvider.name}
                            <span className={`text-sm px-2 py-0.5 rounded-full border ${selectedProvider.healthStatus === 'healthy' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                    'bg-red-100 text-red-700 border-red-200'
                                }`}>
                                Score: {selectedProvider.healthScore ?? 100}
                            </span>
                        </h2>
                    </div>

                    {/* SECTION 6: FALLBACK CHAIN VISUALIZATION */}
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <Settings size={14} /> Fallback Execution Chain
                        </h3>
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Auto-sort enabled models by priority */}
                            {(selectedProvider.models || [])
                                .filter(m => m.enabled)
                                .sort((a, b) => a.priority - b.priority)
                                .map((model, idx, arr) => (
                                    <div key={model.id} className="flex items-center gap-2">
                                        <div className={`px-4 py-2 rounded-lg border-2 flex flex-col items-center min-w-[140px] relative overflow-hidden ${model.healthStatus === 'unhealthy' ? 'bg-red-50 border-red-200 opacity-60' :
                                                idx === 0 ? 'bg-blue-50 border-blue-500' :
                                                    'bg-white border-gray-200'
                                            }`}>
                                            <span className="text-xs font-bold uppercase text-gray-500 mb-1">
                                                {idx === 0 ? 'PRIMARY' : idx === 1 ? 'FALLBACK' : 'EMERGENCY'}
                                            </span>
                                            <span className={`font-bold text-sm truncate max-w-full px-2 ${model.healthStatus === 'unhealthy' ? 'line-through' : ''}`}>
                                                {model.name}
                                            </span>

                                            {/* Status Dot */}
                                            <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${model.healthStatus === 'unhealthy' ? 'bg-red-500' : 'bg-green-500'
                                                }`} />
                                        </div>

                                        {idx < arr.length - 1 && (
                                            <ArrowRight size={20} className="text-gray-300" />
                                        )}
                                    </div>
                                ))
                            }
                            {(!selectedProvider.models || selectedProvider.models.length === 0) && (
                                <div className="text-gray-400 italic">No fallback models configured.</div>
                            )}
                        </div>
                        <div className="mt-4 text-xs text-gray-500 bg-blue-50 p-3 rounded flex items-start gap-2">
                            <Info size={14} className="mt-0.5 text-blue-500" />
                            <p>
                                <strong>Logic:</strong> The system picks the <strong>Primary</strong> model first.
                                If it fails (or is unhealthy), it will automatically be skipped in the <strong>next run</strong>,
                                and the system will attempt the <strong>Fallback</strong> model. No sequential retries occur in a single run to prevent timeouts.
                            </p>
                        </div>
                    </div>

                    {/* SECTION 3: MODELS LIST */}
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                <BarChart3 size={18} /> Model Performance & Health
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="px-6 py-3">Priority</th>
                                        <th className="px-6 py-3">Model Name</th>
                                        <th className="px-6 py-3">Health Score</th>
                                        <th className="px-6 py-3">Avg Latency</th>
                                        <th className="px-6 py-3">Reliability</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(selectedProvider.models || []).sort((a, b) => a.priority - b.priority).map((model) => (
                                        <tr key={model.id} className={`hover:bg-gray-50 transition-colors ${!model.enabled ? 'opacity-50' : ''}`}>
                                            <td className="px-6 py-4">
                                                <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
                                                    #{model.priority}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{model.name}</div>
                                                <div className="text-xs text-gray-400 font-mono">{model.id}</div>
                                                {model.healthReason && (
                                                    <div className="mt-1 text-xs text-red-600 max-w-[200px] truncate">
                                                        ⚠️ {model.healthReason}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold border ${(model.healthScore ?? 100) >= 80 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                        (model.healthScore ?? 100) >= 50 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                                            'bg-red-100 text-red-700 border-red-200'
                                                    }`}>
                                                    {(model.healthScore ?? 100)} / 100
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-mono">
                                                {(model.stats?.avgLatencyMs ?? 0) > 0
                                                    ? `${(model.stats!.avgLatencyMs / 1000).toFixed(2)}s`
                                                    : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${(model.stats?.successRate ?? 1) > 0.9 ? 'bg-emerald-500' :
                                                                    (model.stats?.successRate ?? 1) > 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                                                                }`}
                                                            style={{ width: `${(model.stats?.successRate ?? 1) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold">
                                                        {((model.stats?.successRate ?? 1) * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-0.5">
                                                    {model.stats?.totalRequests ?? 0} reqs
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => toggleModel(selectedProvider.id, model.id, model.enabled)}
                                                    className={`text-xs px-3 py-1.5 rounded font-bold border ${model.enabled
                                                            ? 'text-gray-500 border-gray-200 hover:border-red-300 hover:text-red-600'
                                                            : 'text-emerald-600 border-emerald-200 bg-emerald-50'
                                                        }`}
                                                >
                                                    {model.enabled ? 'Pause' : 'Enable'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {(!selectedProvider.models || selectedProvider.models.length === 0) && (
                                <div className="p-8 text-center text-gray-400">
                                    No models found. Provider might be using legacy configuration.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
