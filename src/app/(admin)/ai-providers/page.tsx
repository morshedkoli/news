"use client";

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Save, CheckCircle, AlertTriangle, RefreshCw, Globe, Server, Activity, ChevronRight } from 'lucide-react';
import Skeleton from '@/components/Skeleton';

export default function AiSettingsPage() {
    const pathname = usePathname();
    const router = useRouter();
    // ... states and functions (omitted for brevity, no changes needed here)
    // OpenRouter State
    const [openrouter, setOpenrouter] = useState({ apiKey: '', model: 'google/gemini-2.0-flash-001', enabled: false, priority: 3 });

    // Ollama State
    const [ollama, setOllama] = useState({ endpoint: 'http://localhost:11434/api/chat', model: 'llama3.2', enabled: false, priority: 10 });

    // Bytez State
    const [bytez, setBytez] = useState({ apiKey: '', model: 'openai-community/gpt-2', enabled: false, priority: 4 });

    // Groq State
    const [groq, setGroq] = useState({ apiKey: '', model: 'llama-3.3-70b-versatile', enabled: false, priority: 5 });

    // Hugging Face State
    const [huggingface, setHuggingface] = useState({ apiKey: '', model: 'openai/gpt-oss-20b', enabled: false, priority: 6 });

    // System State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    type HealthStatusEntry = {
        provider: string;
        status?: string;
        latency?: number;
        error?: string;
        id?: string;
        model?: string;
    };
    const [healthStatus, setHealthStatus] = useState<HealthStatusEntry[]>([]);
    const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
    type ProviderSnapshot = {
        id?: string;
        name?: string;
        healthScore?: number;
        healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
        lastUpdated?: string;
        stats?: { avgLatencyMs?: number; totalRequests?: number; successRate?: number; lastUpdated?: string };
    };
    const [providerSnapshots, setProviderSnapshots] = useState<ProviderSnapshot[]>([]);
    type ProviderModel = { id: string; name: string; enabled: boolean; priority: number };
    const [openrouterModels, setOpenrouterModels] = useState<ProviderModel[]>([]);
    const [ollamaModels, setOllamaModels] = useState<ProviderModel[]>([]);
    const [bytezModels, setBytezModels] = useState<ProviderModel[]>([]);
    const [groqModels, setGroqModels] = useState<ProviderModel[]>([]);
    const [huggingfaceModels, setHuggingfaceModels] = useState<ProviderModel[]>([]);
    const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

    const [checkingHealth, setCheckingHealth] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
    const [openrouterModelsLoading, setOpenrouterModelsLoading] = useState(false);
    const [openrouterModelsError, setOpenrouterModelsError] = useState<string | null>(null);
    const [openrouterCatalog, setOpenrouterCatalog] = useState<string[]>([]);
    const [openrouterSearch, setOpenrouterSearch] = useState('');
    const [bytezModelsLoading, setBytezModelsLoading] = useState(false);
    const [bytezModelsError, setBytezModelsError] = useState<string | null>(null);
    const [bytezCatalog, setBytezCatalog] = useState<string[]>([]);
    const [bytezSearch, setBytezSearch] = useState('');

    // Ollama Status
    interface OllamaModelStatus {
        name: string;
        isLoaded?: boolean;
    }
    const [ollamaStatus, setOllamaStatus] = useState<{ online: boolean; models: OllamaModelStatus[]; loadedModels: string[] }>({ online: false, models: [], loadedModels: [] });

    // Fetch Config on Load
    useEffect(() => {
        if (pathname === '/ai-providers') {
            router.replace('/ai-management');
        }
        fetchConfig();
        runHealthCheck();
        fetchOllamaStatus();
        fetchProviderSnapshots();
    }, [pathname, router]);

    const fetchProviderSnapshots = async () => {
        try {
            const res = await fetch('/api/admin/ai-providers');
            if (res.ok) {
                const data = await res.json();
                setProviderSnapshots(data || []);
            }
        } catch (error) {
            console.error("Failed to fetch provider snapshots", error);
        }
    };

    const isExpanded = (name: string) => expandedProviders.has(name);
    const toggleExpanded = (name: string) => {
        setExpandedProviders(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/ai/config');
            const data = await res.json();
            if (res.ok) {
                if (data.openrouter) setOpenrouter(data.openrouter);
                if (data.ollama) setOllama(data.ollama);
                if (data.bytez) setBytez(data.bytez);
                if (data.groq) setGroq(data.groq);
                if (data.huggingface) setHuggingface(data.huggingface);

                const normalizeModelList = (models: ProviderModel[] | undefined, fallback: string) => {
                    if (models && models.length > 0) {
                        return models
                            .map((m, index) => ({
                                id: m.id,
                                name: m.name || m.id,
                                enabled: m.enabled ?? true,
                                priority: typeof m.priority === 'number' ? m.priority : index + 1
                            }))
                            .sort((a, b) => a.priority - b.priority);
                    }
                    if (fallback) {
                        return [{ id: fallback, name: fallback, enabled: true, priority: 1 }];
                    }
                    return [];
                };

                if (data.openrouter) setOpenrouterModels(normalizeModelList(data.openrouter.models, data.openrouter.model));
                if (data.ollama) setOllamaModels(normalizeModelList(data.ollama.models, data.ollama.model));
                if (data.bytez) setBytezModels(normalizeModelList(data.bytez.models, data.bytez.model));
                if (data.groq) setGroqModels(normalizeModelList(data.groq.models, data.groq.model));
                if (data.huggingface) setHuggingfaceModels(normalizeModelList(data.huggingface.models, data.huggingface.model));
            }
        } catch (error) {
            console.error("Failed to fetch config", error);
        } finally {
            setLoading(false);
        }
    };
    const normalizeModelsForSave = (models: ProviderModel[], fallback: string) => {
        if (models.length === 0 && fallback) {
            return [{ id: fallback, name: fallback, enabled: true, priority: 1 }];
        }
        return models.map((m, index) => ({
            ...m,
            name: m.name || m.id,
            priority: typeof m.priority === 'number' ? m.priority : index + 1,
            enabled: m.enabled ?? true
        }));
    };

    const updateModel = (
        models: ProviderModel[],
        setModels: React.Dispatch<React.SetStateAction<ProviderModel[]>>,
        index: number,
        patch: Partial<ProviderModel>
    ) => {
        setModels(models.map((m, i) => i === index ? { ...m, ...patch } : m));
    };

    const addModel = (setModels: React.Dispatch<React.SetStateAction<ProviderModel[]>>) => {
        setModels(prev => ([
            ...prev,
            { id: '', name: '', enabled: true, priority: prev.length + 1 }
        ]));
    };

    const removeModel = (
        models: ProviderModel[],
        setModels: React.Dispatch<React.SetStateAction<ProviderModel[]>>,
        index: number
    ) => {
        const next = models.filter((_, i) => i !== index).map((m, i) => ({ ...m, priority: i + 1 }));
        setModels(next);
    };

    const moveModel = (
        models: ProviderModel[],
        setModels: React.Dispatch<React.SetStateAction<ProviderModel[]>>,
        from: number,
        to: number
    ) => {
        if (from === to || from < 0 || to < 0 || from >= models.length || to >= models.length) return;
        const next = [...models];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        setModels(next.map((m, i) => ({ ...m, priority: i + 1 })));
    };

    const validateModels = (models: ProviderModel[], label: string) => {
        const errors: string[] = [];
        const ids = models.map(m => m.id.trim()).filter(Boolean);
        const seen = new Set<string>();
        const duplicates = new Set<string>();
        ids.forEach(id => {
            if (seen.has(id)) duplicates.add(id);
            seen.add(id);
        });
        if (models.some(m => !m.id.trim())) {
            errors.push(`${label}: Model ID is required for all entries.`);
        }
        if (duplicates.size > 0) {
            errors.push(`${label}: Duplicate model IDs detected (${Array.from(duplicates).join(', ')}).`);
        }
        return errors;
    };

    const renderModelsEditor = (
        models: ProviderModel[],
        setModels: React.Dispatch<React.SetStateAction<ProviderModel[]>>
    ) => (
        <div className="space-y-3">
            <div className="text-xs text-slate-500">Drag to reorder or use the arrows.</div>
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500">
                <span className="col-span-4">Model ID</span>
                <span className="col-span-4">Display Name</span>
                <span className="col-span-2">Priority</span>
                <span className="col-span-1 text-center">Enabled</span>
                <span className="col-span-1"></span>
            </div>
            {models.map((model, index) => {
                const trimmedId = model.id.trim();
                const duplicate = trimmedId && models.filter(m => m.id.trim() === trimmedId).length > 1;
                const emptyId = !trimmedId;

                return (
                    <div
                        key={`${model.id}-${index}`}
                        className="grid grid-cols-12 gap-2 items-center"
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', String(index));
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            const fromIndex = Number(e.dataTransfer.getData('text/plain'));
                            if (!Number.isNaN(fromIndex)) moveModel(models, setModels, fromIndex, index);
                        }}
                    >
                        <input
                            value={model.id}
                            onChange={(e) => updateModel(models, setModels, index, { id: e.target.value })}
                            placeholder="model-id"
                            className={`col-span-4 rounded-lg border px-2 py-1.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none ${emptyId || duplicate ? 'border-red-300' : 'border-gray-200'}`}
                        />
                        <input
                            value={model.name}
                            onChange={(e) => updateModel(models, setModels, index, { name: e.target.value })}
                            placeholder="Display name"
                            className="col-span-4 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <input
                            type="number"
                            value={model.priority}
                            onChange={(e) => updateModel(models, setModels, index, { priority: Number(e.target.value) || index + 1 })}
                            className="col-span-2 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <div className="col-span-1 flex justify-center">
                            <input
                                type="checkbox"
                                checked={model.enabled}
                                onChange={(e) => updateModel(models, setModels, index, { enabled: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="col-span-1 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => moveModel(models, setModels, index, index - 1)}
                                className="text-xs text-slate-500 hover:text-slate-700"
                            >
                                Up
                            </button>
                            <button
                                type="button"
                                onClick={() => moveModel(models, setModels, index, index + 1)}
                                className="text-xs text-slate-500 hover:text-slate-700"
                            >
                                Down
                            </button>
                            <button
                                type="button"
                                onClick={() => removeModel(models, setModels, index)}
                                className="text-xs text-slate-500 hover:text-red-600"
                            >
                                Remove
                            </button>
                        </div>
                        {(emptyId || duplicate) && (
                            <div className="col-span-12 text-xs text-red-600">
                                {emptyId ? 'Model ID is required.' : 'Duplicate model ID.'}
                            </div>
                        )}
                    </div>
                );
            })}
            <button
                type="button"
                onClick={() => addModel(setModels)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
                + Add model
            </button>
        </div>
    );

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const validationErrors = [
                ...validateModels(openrouterModels, 'OpenRouter'),
                ...validateModels(ollamaModels, 'Ollama'),
                ...validateModels(bytezModels, 'Bytez'),
                ...validateModels(groqModels, 'Groq'),
                ...validateModels(huggingfaceModels, 'HuggingFace')
            ];

            if (validationErrors.length > 0) {
                setMessage({ type: 'error', text: validationErrors[0] });
                setSaving(false);
                return;
            }

            const normalizedOpenrouterModels = normalizeModelsForSave(openrouterModels, openrouter.model);
            const normalizedOllamaModels = normalizeModelsForSave(ollamaModels, ollama.model);
            const normalizedBytezModels = normalizeModelsForSave(bytezModels, bytez.model);
            const normalizedGroqModels = normalizeModelsForSave(groqModels, groq.model);
            const normalizedHuggingfaceModels = normalizeModelsForSave(huggingfaceModels, huggingface.model);

            const primaryOpenrouter = normalizedOpenrouterModels.find(m => m.enabled)?.id || normalizedOpenrouterModels[0]?.id || openrouter.model;
            const primaryOllama = normalizedOllamaModels.find(m => m.enabled)?.id || normalizedOllamaModels[0]?.id || ollama.model;
            const primaryBytez = normalizedBytezModels.find(m => m.enabled)?.id || normalizedBytezModels[0]?.id || bytez.model;
            const primaryGroq = normalizedGroqModels.find(m => m.enabled)?.id || normalizedGroqModels[0]?.id || groq.model;
            const primaryHuggingface = normalizedHuggingfaceModels.find(m => m.enabled)?.id || normalizedHuggingfaceModels[0]?.id || huggingface.model;

            const res = await fetch('/api/ai/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    openrouter: {
                        ...openrouter,
                        model: primaryOpenrouter,
                        models: normalizedOpenrouterModels
                    },
                    ollama: {
                        ...ollama,
                        model: primaryOllama,
                        models: normalizedOllamaModels
                    },
                    bytez: {
                        ...bytez,
                        model: primaryBytez,
                        models: normalizedBytezModels
                    },
                    groq: {
                        ...groq,
                        model: primaryGroq,
                        models: normalizedGroqModels
                    },
                    huggingface: {
                        ...huggingface,
                        model: primaryHuggingface,
                        models: normalizedHuggingfaceModels
                    }
                })
            });

            if (res.ok) {
                const data = await res.json().catch(() => null);
                if (data?.warnings?.length) {
                    setMessage({ type: 'success', text: `Saved with warning: ${data.warnings.join('; ')}` });
                } else {
                    setMessage({ type: 'success', text: 'AI Settings Saved Successfully' });
                }
                runHealthCheck(); // Re-check after save
            } else {
                const data = await res.json().catch(() => null);
                const errorText = data?.error || 'Failed to save settings';
                if (data?.invalidModels?.length) {
                    setMessage({ type: 'error', text: `${errorText}. Invalid: ${data.invalidModels.join(', ')}` });
                } else {
                    setMessage({ type: 'error', text: errorText });
                }
                return;
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    const runHealthCheck = async () => {
        setCheckingHealth(true);
        try {
            const res = await fetch('/api/cron/ai-health');
            const data = await res.json();
            setHealthStatus(data.activeProviders || data.results || []);
            setLastCheckedAt(new Date().toISOString());
            await fetchProviderSnapshots();
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ai-health-updated'));
            }
        } catch (e) {
            console.error("Health check failed", e);
        } finally {
            setCheckingHealth(false);
        }
    };

    const handleTestConnection = async (provider: string, config: Record<string, unknown>) => {
        setCheckingStatus(provider);
        setMessage(null);

        try {
            const res = await fetch('/api/ai/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, config })
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: `${provider} Connected: Online (${data.latencyMs}ms)` });
            } else {
                setMessage({ type: 'error', text: `${provider} Failed: ${data.message}` });
            }
        } catch {
            setMessage({ type: 'error', text: `Failed to test ${provider}` });
        } finally {
            setCheckingStatus(null);
        }
    };

    const fetchOllamaStatus = async () => {
        try {
            const res = await fetch('/api/ai/ollama/status');
            const data = await res.json();
            setOllamaStatus(data);
        } catch (e) {
            console.error('Failed to fetch Ollama status', e);
            setOllamaStatus({ online: false, models: [], loadedModels: [] });
        }
    };

    const providerDisplayName = (name: string) => {
        switch (name) {
            case 'Ollama':
                return 'Ollama Local';
            case 'Bytez':
                return 'Bytez API';
            case 'Groq':
                return 'Groq Cloud';
            case 'HuggingFace':
                return 'Hugging Face';
            default:
                return name;
        }
    };

    const fetchOpenRouterModels = async () => {
        setOpenrouterModelsLoading(true);
        setOpenrouterModelsError(null);
        try {
            const res = await fetch('/api/ai/openrouter/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: openrouter.apiKey })
            });
            const data = await res.json();
            if (!res.ok) {
                setOpenrouterModelsError(data?.error || 'Failed to fetch OpenRouter models');
                return;
            }

            const models = Array.isArray(data?.models) ? data.models : [];
            setOpenrouterCatalog(models);

            if (models.length > 0) {
                const nextModels = models.slice(0, 5).map((id: string, index: number) => ({
                    id,
                    name: id,
                    enabled: true,
                    priority: index + 1
                }));
                setOpenrouterModels(nextModels);
                setOpenrouter(prev => ({ ...prev, model: nextModels[0]?.id || prev.model }));
            }
        } catch (error) {
            setOpenrouterModelsError('Failed to fetch OpenRouter models');
            console.error(error);
        } finally {
            setOpenrouterModelsLoading(false);
        }
    };

    const addOpenRouterModel = (id: string) => {
        setOpenrouterModels(prev => {
            if (prev.some(m => m.id === id)) return prev;
            const next = [...prev, { id, name: id, enabled: true, priority: prev.length + 1 }];
            return next.map((m, i) => ({ ...m, priority: i + 1 }));
        });
    };

    const fetchBytezModels = async () => {
        setBytezModelsLoading(true);
        setBytezModelsError(null);
        try {
            const res = await fetch('/api/ai/bytez/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: bytez.apiKey })
            });
            const data = await res.json();
            if (!res.ok) {
                setBytezModelsError(data?.error || 'Failed to fetch Bytez models');
                return;
            }

            const models = Array.isArray(data?.models) ? data.models : [];
            setBytezCatalog(models);

            if (models.length > 0) {
                const nextModels = models.slice(0, 5).map((id: string, index: number) => ({
                    id,
                    name: id,
                    enabled: true,
                    priority: index + 1
                }));
                setBytezModels(nextModels);
                setBytez(prev => ({ ...prev, model: nextModels[0]?.id || prev.model }));
            }
        } catch (error) {
            setBytezModelsError('Failed to fetch Bytez models');
            console.error(error);
        } finally {
            setBytezModelsLoading(false);
        }
    };

    const addBytezModel = (id: string) => {
        setBytezModels(prev => {
            if (prev.some(m => m.id === id)) return prev;
            const next = [...prev, { id, name: id, enabled: true, priority: prev.length + 1 }];
            return next.map((m, i) => ({ ...m, priority: i + 1 }));
        });
    };

    const filteredBytezModels = bytezCatalog
        .filter((id) => id.toLowerCase().includes(bytezSearch.trim().toLowerCase()))
        .slice(0, 20);

    const filteredOpenRouterModels = openrouterCatalog
        .filter((id) => id.toLowerCase().includes(openrouterSearch.trim().toLowerCase()))
        .slice(0, 20);

    const findHealthEntry = (name: string) => {
        const displayName = providerDisplayName(name);
        return healthStatus.find(s =>
            s.provider.toLowerCase().includes(displayName.toLowerCase()) ||
            s.provider.toLowerCase() === displayName.toLowerCase()
        );
    };

    const getSnapshot = (name: string) => {
        const displayName = providerDisplayName(name);
        return providerSnapshots.find(s => (s.name || '').toLowerCase() === displayName.toLowerCase());
    };

    const isProviderEnabled = (name: string) => {
        return (
            (name === 'OpenRouter' && openrouter.enabled) ||
            (name === 'Ollama' && ollama.enabled) ||
            (name === 'Bytez' && bytez.enabled) ||
            (name === 'Groq' && groq.enabled) ||
            (name === 'HuggingFace' && huggingface.enabled)
        );
    };

    const getLatencyTone = (latency?: number) => {
        if (!latency && latency !== 0) return 'text-gray-400';
        if (latency <= 800) return 'text-emerald-600';
        if (latency <= 2000) return 'text-amber-600';
        return 'text-red-600';
    };

    const formatTime = (value?: string | null) => {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString();
    };

    const getStatusChip = (name: string) => {
        if (checkingHealth) {
            return <span className="flex items-center text-slate-500 text-xs font-medium gap-1"><RefreshCw size={14} className="animate-spin" /> Refreshing</span>;
        }

        // Flexible matching for provider names
        const provider = findHealthEntry(name);

        if (!provider) {
            // Special handling for Ollama - use direct status check
            if (name === 'Ollama') {
                return ollamaStatus.online
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><CheckCircle size={12} /> Online</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"><AlertTriangle size={12} /> Offline</span>;
            }

            if (!isProviderEnabled(name)) {
                return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Disabled</span>;
            }

            return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Not Checked</span>;
        }

        return provider.status === 'online'
            ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><CheckCircle size={12} /> Online</span>
            : <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"><AlertTriangle size={12} /> Offline</span>;
    };

    const renderStatusBlock = (name: string) => {
        const entry = findHealthEntry(name);
        const snapshot = getSnapshot(name);
        const healthScore = snapshot?.healthScore;
        const scoreValue = typeof healthScore === 'number' ? Math.max(0, Math.min(100, healthScore)) : null;
        const scoreTone = scoreValue === null
            ? 'bg-slate-200'
            : scoreValue >= 80
                ? 'bg-emerald-500'
                : scoreValue >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500';
        const hasLatency = typeof entry?.latency === 'number';

        return (
            <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    {getStatusChip(name)}
                    {snapshot?.healthStatus === 'degraded' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Degraded
                        </span>
                    )}
                    {hasLatency && (
                        <span className={`inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium ${getLatencyTone(entry?.latency)}`}>
                            Latency {entry?.latency}ms
                        </span>
                    )}
                    <span className="text-slate-500">Last checked: {formatTime(lastCheckedAt)}</span>
                    <span className="text-slate-500">Updated: {formatTime(snapshot?.lastUpdated)}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-medium">Health Score</span>
                    <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full ${scoreTone}`} style={{ width: `${scoreValue ?? 0}%` }} />
                    </div>
                    <span className="font-mono">{scoreValue ?? 0}/100</span>
                </div>

                {entry?.error && (
                    <div className="text-xs text-red-600">Error: {entry.error}</div>
                )}
            </div>
        );
    };

    if (loading) {
        const SkeletonCard = () => (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Skeleton height={40} width={40} />
                        <div>
                            <Skeleton height={20} width={150} />
                            <Skeleton height={14} width={200} />
                        </div>
                    </div>
                    <Skeleton height={20} width={80} />
                </div>
                <div className="p-6 space-y-6">
                    <Skeleton height={40} width="100%" />
                    <div className="grid grid-cols-2 gap-4">
                        <Skeleton height={40} width="100%" />
                        <Skeleton height={40} width="100%" />
                    </div>
                    <Skeleton height={24} width={120} />
                </div>
            </div>
        );

        return (
            <div className="max-w-4xl mx-auto p-6 space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <Skeleton height={36} width={300} />
                        <Skeleton height={20} width={400} />
                    </div>
                    <Skeleton height={24} width={120} />
                </div>
                <div className="space-y-6">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">AI Configuration</h1>
                    <p className="text-gray-500 mt-1">Manage standard AI providers for news generation.</p>
                </div>
                <button
                    onClick={runHealthCheck}
                    disabled={checkingHealth}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 transition disabled:opacity-50"
                >
                    <RefreshCw size={16} className={checkingHealth ? "animate-spin" : ""} /> Refresh Status
                </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">



                {/* 3. OpenRouter Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleExpanded('OpenRouter')}
                        className="w-full px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-100 p-2 rounded-lg">
                                <Globe className="text-purple-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">OpenRouter API</h2>
                                <p className="text-xs text-gray-500">Access to Claude, Gemini, Llama, etc.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {getStatusChip('OpenRouter')}
                            <ChevronRight size={18} className={`text-gray-400 transition-transform ${isExpanded('OpenRouter') ? 'rotate-90' : ''}`} />
                        </div>
                    </button>

                    {isExpanded('OpenRouter') && (
                        <div className="p-6 space-y-6">
                            {renderStatusBlock('OpenRouter')}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                    <input
                                    type="password"
                                    value={openrouter.apiKey}
                                    onChange={(e) => setOpenrouter({ ...openrouter, apiKey: e.target.value })}
                                    placeholder="sk-or-..."
                                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition font-mono text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                    <input
                                        type="text"
                                        value={openrouter.model}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setOpenrouter({ ...openrouter, model: value });
                                            setOpenrouterModels((prev) => {
                                                if (prev.length === 0) {
                                                    return [{ id: value, name: value, enabled: true, priority: 1 }];
                                                }
                                                const next = [...prev];
                                                next[0] = { ...next[0], id: value, name: next[0].name || value };
                                                return next;
                                            });
                                        }}
                                        list="openrouter-models"
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white font-mono text-sm"
                                        placeholder="google/gemini-2.0-flash-001"
                                    />
                                    <datalist id="openrouter-models">
                                        <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash (Free)</option>
                                        <option value="google/gemini-exp-1206:free">Gemini Experimental 1206 (Free)</option>
                                        <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (Free)</option>
                                        <option value="qwen/qwen2.5-vl-72b-instruct:free">Qwen 2.5 VL 72B (Free)</option>
                                        <option value="deepseek/deepseek-r1:free">DeepSeek R1 (Free)</option>
                                        <option value="nvidia/llama-3.1-nemotron-70b-instruct:free">Nvidia Nemotron 70B (Free)</option>
                                        <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (Paid)</option>
                                        <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (Paid)</option>
                                        <option value="openai/gpt-4o">GPT-4o (Paid)</option>
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority (Lower = First)</label>
                                    <input
                                        type="number"
                                        value={openrouter.priority}
                                        onChange={(e) => setOpenrouter({ ...openrouter, priority: parseInt(e.target.value) || 2 })}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Models (Priority + Enable)</label>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-2">
                                    <button
                                        type="button"
                                        onClick={fetchOpenRouterModels}
                                        disabled={openrouterModelsLoading}
                                        className="inline-flex items-center gap-2 rounded-md border border-indigo-200 px-3 py-1.5 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                                    >
                                        <RefreshCw size={14} className={openrouterModelsLoading ? 'animate-spin' : ''} />
                                        Fetch models
                                    </button>
                                    {openrouterModelsError && (
                                        <span className="text-red-600">{openrouterModelsError}</span>
                                    )}
                                    {openrouterCatalog.length > 0 && (
                                        <span className="text-slate-500">{openrouterCatalog.length} free models found</span>
                                    )}
                                </div>
                                {openrouterCatalog.length > 0 && (
                                    <div className="mb-3 space-y-2">
                                        <input
                                            value={openrouterSearch}
                                            onChange={(e) => setOpenrouterSearch(e.target.value)}
                                            placeholder="Search OpenRouter models"
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        {filteredOpenRouterModels.length > 0 ? (
                                            <div className="max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white">
                                                {filteredOpenRouterModels.map((id) => (
                                                    <div key={id} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50">
                                                        <span className="font-mono text-slate-700">{id}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => addOpenRouterModel(id)}
                                                            className="text-indigo-600 hover:text-indigo-700"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-500">No matches</div>
                                        )}
                                    </div>
                                )}
                                {renderModelsEditor(openrouterModels, setOpenrouterModels)}
                            </div>

                            <div className="flex items-center pt-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={openrouter.enabled}
                                        onChange={(e) => setOpenrouter({ ...openrouter, enabled: e.target.checked })}
                                        className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Enable Provider</span>
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleTestConnection('OpenRouter', openrouter)}
                                disabled={!!checkingStatus}
                                className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50 pt-2"
                            >
                                <Activity size={16} className={checkingStatus === 'OpenRouter' ? "animate-spin" : ""} />
                                {checkingStatus === 'OpenRouter' ? 'Checking...' : 'Test Connection'}
                            </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Ollama Local Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleExpanded('Ollama')}
                        className="w-full px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-2 rounded-lg">
                                <Server className="text-orange-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Ollama Local</h2>
                                <p className="text-xs text-gray-500">Local LLM - No API Key Required</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {getStatusChip('Ollama')}
                            <ChevronRight size={18} className={`text-gray-400 transition-transform ${isExpanded('Ollama') ? 'rotate-90' : ''}`} />
                        </div>
                    </button>

                    {isExpanded('Ollama') && (
                        <div className="p-6 space-y-6">
                            {renderStatusBlock('Ollama')}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
                                    <input
                                    type="text"
                                    value={ollama.endpoint}
                                    onChange={(e) => setOllama({ ...ollama, endpoint: e.target.value })}
                                    placeholder="http://localhost:11434/api/chat"
                                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition font-mono text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1">Default: http://localhost:11434/api/chat</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                    {ollamaStatus.models.length > 0 ? (
                                        <select
                                            value={ollama.model}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setOllama({ ...ollama, model: value });
                                                setOllamaModels((prev) => {
                                                    if (prev.length === 0) {
                                                        return [{ id: value, name: value, enabled: true, priority: 1 }];
                                                    }
                                                    const next = [...prev];
                                                    next[0] = { ...next[0], id: value, name: next[0].name || value };
                                                    return next;
                                                });
                                            }}
                                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white font-mono text-sm"
                                        >
                                            {ollamaStatus.models.map((m) => (
                                                <option key={m.name} value={m.name}>
                                                    {m.name} {m.isLoaded ? '🟢' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={ollama.model}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setOllama({ ...ollama, model: value });
                                                setOllamaModels((prev) => {
                                                    if (prev.length === 0) {
                                                        return [{ id: value, name: value, enabled: true, priority: 1 }];
                                                    }
                                                    const next = [...prev];
                                                    next[0] = { ...next[0], id: value, name: next[0].name || value };
                                                    return next;
                                                });
                                            }}
                                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white font-mono text-sm"
                                            placeholder="llama3.2"
                                        />
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">
                                        {ollamaStatus.online ? `${ollamaStatus.models.length} models available` : 'Ollama not running'}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority (Lower = First)</label>
                                    <input
                                        type="number"
                                        value={ollama.priority}
                                        onChange={(e) => setOllama({ ...ollama, priority: parseInt(e.target.value) || 10 })}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Models (Priority + Enable)</label>
                                {renderModelsEditor(ollamaModels, setOllamaModels)}
                            </div>

                            <div className="flex items-center pt-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={ollama.enabled}
                                        onChange={(e) => setOllama({ ...ollama, enabled: e.target.checked })}
                                        className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500 border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Enable Provider</span>
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleTestConnection('Ollama', ollama)}
                                disabled={!!checkingStatus}
                                className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50 pt-2"
                            >
                                <Activity size={16} className={checkingStatus === 'Ollama' ? "animate-spin" : ""} />
                                {checkingStatus === 'Ollama' ? 'Checking...' : 'Test Connection'}
                            </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 5. Bytez Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleExpanded('Bytez')}
                        className="w-full px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-cyan-100 p-2 rounded-lg">
                                <Globe className="text-cyan-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Bytez API</h2>
                                <p className="text-xs text-gray-500">Unified Model API (Paid)</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {getStatusChip('Bytez')}
                            <ChevronRight size={18} className={`text-gray-400 transition-transform ${isExpanded('Bytez') ? 'rotate-90' : ''}`} />
                        </div>
                    </button>

                    {isExpanded('Bytez') && (
                        <div className="p-6 space-y-6">
                            {renderStatusBlock('Bytez')}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                    <input
                                    type="password"
                                    value={bytez.apiKey}
                                    onChange={(e) => setBytez({ ...bytez, apiKey: e.target.value })}
                                    placeholder="Enter Bytez Key..."
                                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition font-mono text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                    <input
                                        type="text"
                                        value={bytez.model}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setBytez({ ...bytez, model: value });
                                            setBytezModels((prev) => {
                                                if (prev.length === 0) {
                                                    return [{ id: value, name: value, enabled: true, priority: 1 }];
                                                }
                                                const next = [...prev];
                                                next[0] = { ...next[0], id: value, name: next[0].name || value };
                                                return next;
                                            });
                                        }}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white font-mono text-sm"
                                        placeholder="openai-community/gpt-2"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Example: openai-community/gpt-2</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority (Lower = First)</label>
                                    <input
                                        type="number"
                                        value={bytez.priority}
                                        onChange={(e) => setBytez({ ...bytez, priority: parseInt(e.target.value) || 4 })}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Models (Priority + Enable)</label>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-2">
                                    <button
                                        type="button"
                                        onClick={fetchBytezModels}
                                        disabled={bytezModelsLoading}
                                        className="inline-flex items-center gap-2 rounded-md border border-cyan-200 px-3 py-1.5 text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
                                    >
                                        <RefreshCw size={14} className={bytezModelsLoading ? 'animate-spin' : ''} />
                                        Fetch free models
                                    </button>
                                    {bytezModelsError && (
                                        <span className="text-red-600">{bytezModelsError}</span>
                                    )}
                                    {bytezCatalog.length > 0 && (
                                        <span className="text-slate-500">{bytezCatalog.length} free models found</span>
                                    )}
                                </div>
                                {bytezCatalog.length > 0 && (
                                    <div className="mb-3 space-y-2">
                                        <input
                                            value={bytezSearch}
                                            onChange={(e) => setBytezSearch(e.target.value)}
                                            placeholder="Search Bytez models"
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                                        />
                                        {filteredBytezModels.length > 0 ? (
                                            <div className="max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white">
                                                {filteredBytezModels.map((id) => (
                                                    <div key={id} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50">
                                                        <span className="font-mono text-slate-700">{id}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => addBytezModel(id)}
                                                            className="text-cyan-600 hover:text-cyan-700"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-500">No matches</div>
                                        )}
                                    </div>
                                )}
                                {renderModelsEditor(bytezModels, setBytezModels)}
                            </div>

                            <div className="flex items-center pt-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={bytez.enabled}
                                        onChange={(e) => setBytez({ ...bytez, enabled: e.target.checked })}
                                        className="w-5 h-5 text-cyan-600 rounded focus:ring-cyan-500 border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Enable Provider</span>
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleTestConnection('Bytez', bytez)}
                                disabled={!!checkingStatus}
                                className="flex items-center gap-2 text-sm text-cyan-600 hover:text-cyan-700 font-medium disabled:opacity-50 pt-2"
                            >
                                <Activity size={16} className={checkingStatus === 'Bytez' ? "animate-spin" : ""} />
                                {checkingStatus === 'Bytez' ? 'Checking...' : 'Test Connection'}
                            </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 6. Groq Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleExpanded('Groq')}
                        className="w-full px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-2 rounded-lg">
                                <Globe className="text-orange-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Groq Cloud</h2>
                                <p className="text-xs text-gray-500">Fast AI Inference (Llama 3, Mixtral)</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {getStatusChip('Groq')}
                            <ChevronRight size={18} className={`text-gray-400 transition-transform ${isExpanded('Groq') ? 'rotate-90' : ''}`} />
                        </div>
                    </button>

                    {isExpanded('Groq') && (
                        <div className="p-6 space-y-6">
                            {renderStatusBlock('Groq')}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                    <input
                                    type="password"
                                    value={groq.apiKey}
                                    onChange={(e) => setGroq({ ...groq, apiKey: e.target.value })}
                                    placeholder="gsk_..."
                                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition font-mono text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1">Get key from <a href="https://console.groq.com/keys" target="_blank" className="text-blue-600 hover:underline">Groq Console</a></p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                    <select
                                        value={groq.model}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setGroq({ ...groq, model: value });
                                            setGroqModels((prev) => {
                                                if (prev.length === 0) {
                                                    return [{ id: value, name: value, enabled: true, priority: 1 }];
                                                }
                                                const next = [...prev];
                                                next[0] = { ...next[0], id: value, name: next[0].name || value };
                                                return next;
                                            });
                                        }}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white font-mono text-sm"
                                    >
                                        <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                                        <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile</option>
                                        <option value="openai/gpt-oss-20b">OpenAI GPT-OSS 20B</option>
                                        <option value="openai/gpt-oss-120b">OpenAI GPT-OSS 120B</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority (Lower = First)</label>
                                    <input
                                        type="number"
                                        value={groq.priority}
                                        onChange={(e) => setGroq({ ...groq, priority: parseInt(e.target.value) || 5 })}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Models (Priority + Enable)</label>
                                {renderModelsEditor(groqModels, setGroqModels)}
                            </div>

                            <div className="flex items-center pt-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={groq.enabled}
                                        onChange={(e) => setGroq({ ...groq, enabled: e.target.checked })}
                                        className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500 border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Enable Provider</span>
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleTestConnection('Groq', groq)}
                                disabled={!!checkingStatus}
                                className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50 pt-2"
                            >
                                <Activity size={16} className={checkingStatus === 'Groq' ? "animate-spin" : ""} />
                                {checkingStatus === 'Groq' ? 'Checking...' : 'Test Connection'}
                            </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 7. Hugging Face Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleExpanded('HuggingFace')}
                        className="w-full px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-100 p-2 rounded-lg">
                                <Globe className="text-yellow-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Hugging Face</h2>
                                <p className="text-xs text-gray-500">Inference API (Mistral, Llama, etc.)</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {getStatusChip('HuggingFace')}
                            <ChevronRight size={18} className={`text-gray-400 transition-transform ${isExpanded('HuggingFace') ? 'rotate-90' : ''}`} />
                        </div>
                    </button>

                    {isExpanded('HuggingFace') && (
                        <div className="p-6 space-y-6">
                            {renderStatusBlock('HuggingFace')}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                                    <input
                                    type="password"
                                    value={huggingface.apiKey}
                                    onChange={(e) => setHuggingface({ ...huggingface, apiKey: e.target.value })}
                                    placeholder="hf_..."
                                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none transition font-mono text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1">Get token from <a href="https://huggingface.co/settings/tokens" target="_blank" className="text-blue-600 hover:underline">Hugging Face Settings</a></p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Model ID</label>
                                    <select
                                        value={huggingface.model}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setHuggingface({ ...huggingface, model: value });
                                            setHuggingfaceModels((prev) => {
                                                if (prev.length === 0) {
                                                    return [{ id: value, name: value, enabled: true, priority: 1 }];
                                                }
                                                const next = [...prev];
                                                next[0] = { ...next[0], id: value, name: next[0].name || value };
                                                return next;
                                            });
                                        }}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none bg-white font-mono text-sm"
                                    >
                                        <option value="openai/gpt-oss-20b">OpenAI GPT-OSS 20B</option>
                                        <option value="openai/gpt-oss-120b">OpenAI GPT-OSS 120B</option>
                                        <option value="bigscience/bloom">BigScience BLOOM</option>
                                        <option value="EleutherAI/gpt-j-6B">EleutherAI GPT-J 6B</option>
                                        <option value="mistralai/mixtral-8x7b">Mistral Mixtral 8x7B</option>
                                        <option value="stabilityai/stablelm-2-1.6b">Stability AI StableLM 2 1.6B</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Must support Inference API & OpenAI Protocol</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority (Lower = First)</label>
                                    <input
                                        type="number"
                                        value={huggingface.priority}
                                        onChange={(e) => setHuggingface({ ...huggingface, priority: parseInt(e.target.value) || 6 })}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none transition"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Models (Priority + Enable)</label>
                                {renderModelsEditor(huggingfaceModels, setHuggingfaceModels)}
                            </div>

                            <div className="flex items-center pt-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={huggingface.enabled}
                                        onChange={(e) => setHuggingface({ ...huggingface, enabled: e.target.checked })}
                                        className="w-5 h-5 text-yellow-600 rounded focus:ring-yellow-500 border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Enable Provider</span>
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleTestConnection('HuggingFace', huggingface)}
                                disabled={!!checkingStatus}
                                className="flex items-center gap-2 text-sm text-yellow-600 hover:text-yellow-700 font-medium disabled:opacity-50 pt-2"
                            >
                                <Activity size={16} className={checkingStatus === 'HuggingFace' ? "animate-spin" : ""} />
                                {checkingStatus === 'HuggingFace' ? 'Checking...' : 'Test Connection'}
                            </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-between pt-4 pb-8 sticky bottom-0 bg-white/80 backdrop-blur border-t border-gray-100 -mx-6 px-6">
                    <div className="min-h-[24px]">
                        {message && (
                            <div className={`flex items-center gap-2 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                {message.text}
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 disabled:opacity-50 font-medium"
                    >
                        {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                        Save All Settings
                    </button>
                </div>

            </form>
        </div>
    );
}
