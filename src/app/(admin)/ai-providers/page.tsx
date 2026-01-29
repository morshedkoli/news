"use client";

import { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertTriangle, RefreshCw, Key, Globe, Server, Activity } from 'lucide-react';
import Skeleton from '@/components/Skeleton';
import AiStatusTab from '@/components/Rss/AiStatusTab';

export default function AiSettingsPage() {
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
    const [healthStatus, setHealthStatus] = useState<any[]>([]);

    const [checkingHealth, setCheckingHealth] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState<string | null>(null);

    // Ollama Status
    const [ollamaStatus, setOllamaStatus] = useState<{ online: boolean; models: any[]; loadedModels: string[] }>({ online: false, models: [], loadedModels: [] });

    // Fetch Config on Load
    useEffect(() => {
        fetchConfig();
        runHealthCheck();
        fetchOllamaStatus();
    }, []);

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
            }
        } catch (error) {
            console.error("Failed to fetch config", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch('/api/ai/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ openrouter, ollama, bytez, groq, huggingface })
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'AI Settings Saved Successfully' });
                runHealthCheck(); // Re-check after save
            } else {
                throw new Error("Failed to save");
            }
        } catch (error) {
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
            setHealthStatus(data.results || []);
        } catch (e) {
            console.error("Health check failed", e);
        } finally {
            setCheckingHealth(false);
        }
    };

    const handleTestConnection = async (provider: string, config: any) => {
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
        } catch (error) {
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

    const getStatusIcon = (name: string) => {
        // Flexible matching for provider names
        const provider = healthStatus.find(s =>
            s.provider.toLowerCase().includes(name.toLowerCase()) ||
            (name === 'OpenRouter' && s.provider === 'OpenRouter') ||
            (name === 'Ollama' && s.provider === 'Ollama Local') ||
            (name === 'Bytez' && s.provider === 'Bytez API') ||
            (name === 'Groq' && s.provider === 'Groq Cloud') ||
            (name === 'HuggingFace' && s.provider === 'Hugging Face')
        );

        if (!provider) {
            // Special handling for Ollama - use direct status check
            if (name === 'Ollama') {
                return ollamaStatus.online
                    ? <span className="flex items-center text-green-600 text-xs font-medium gap-1"><CheckCircle size={14} /> Online ({ollamaStatus.models.length} models)</span>
                    : <span className="flex items-center text-amber-600 text-xs font-medium gap-1"><AlertTriangle size={14} /> Offline</span>;
            }

            // Check if provider is enabled based on current state
            const isEnabled =
                (name === 'OpenRouter' && openrouter.enabled) ||
                (name === 'Ollama' && ollama.enabled) ||
                (name === 'Bytez' && bytez.enabled) ||
                (name === 'Groq' && groq.enabled) ||
                (name === 'HuggingFace' && huggingface.enabled);

            if (!isEnabled) {
                return <span className="text-gray-400 text-xs">Disabled</span>;
            }

            // Provider is enabled but not in health check - might be new or not yet checked
            return <span className="text-amber-500 text-xs">Not Checked</span>;
        }

        return provider.status === 'online'
            ? <span className="flex items-center text-green-600 text-xs font-medium gap-1"><CheckCircle size={14} /> Online ({provider.latency}ms)</span>
            : <span className="flex items-center text-red-600 text-xs font-medium gap-1"><AlertTriangle size={14} /> Offline</span>;
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

            {/* AI Status Dashboard */}
            <div className="bg-gray-50/50 p-1 rounded-xl">
                <AiStatusTab />
            </div>

            <div className="border-t border-gray-100 my-8"></div>


            <form onSubmit={handleSave} className="space-y-6">



                {/* 3. OpenRouter Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-100 p-2 rounded-lg">
                                <Globe className="text-purple-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">OpenRouter API</h2>
                                <p className="text-xs text-gray-500">Access to Claude, Gemini, Llama, etc.</p>
                            </div>
                        </div>
                        {getStatusIcon('OpenRouter')}
                    </div>

                    <div className="p-6 space-y-6">
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
                                        onChange={(e) => setOpenrouter({ ...openrouter, model: e.target.value })}
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
                                        <option value="mistralai/mistral-small-24b-instruct-2501:free">Mistral Small 24B (Free)</option>
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
                </div>

                {/* 4. Ollama Local Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-2 rounded-lg">
                                <Server className="text-orange-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Ollama Local</h2>
                                <p className="text-xs text-gray-500">Local LLM - No API Key Required</p>
                            </div>
                        </div>
                        {getStatusIcon('Ollama')}
                    </div>

                    <div className="p-6 space-y-6">
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
                                            onChange={(e) => setOllama({ ...ollama, model: e.target.value })}
                                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white font-mono text-sm"
                                        >
                                            {ollamaStatus.models.map((m: any) => (
                                                <option key={m.name} value={m.name}>
                                                    {m.name} {m.isLoaded ? '🟢' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={ollama.model}
                                            onChange={(e) => setOllama({ ...ollama, model: e.target.value })}
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
                </div>

                {/* 5. Bytez Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-cyan-100 p-2 rounded-lg">
                                <Globe className="text-cyan-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Bytez API</h2>
                                <p className="text-xs text-gray-500">Unified Model API (Paid)</p>
                            </div>
                        </div>
                        {getStatusIcon('Bytez')}
                    </div>

                    <div className="p-6 space-y-6">
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
                                        onChange={(e) => setBytez({ ...bytez, model: e.target.value })}
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
                </div>

                {/* 6. Groq Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-2 rounded-lg">
                                <Globe className="text-orange-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Groq Cloud</h2>
                                <p className="text-xs text-gray-500">Fast AI Inference (Llama 3, Mixtral)</p>
                            </div>
                        </div>
                        {getStatusIcon('Groq')}
                    </div>

                    <div className="p-6 space-y-6">
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
                                        onChange={(e) => setGroq({ ...groq, model: e.target.value })}
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
                </div>

                {/* 7. Hugging Face Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-100 p-2 rounded-lg">
                                <Globe className="text-yellow-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Hugging Face</h2>
                                <p className="text-xs text-gray-500">Inference API (Mistral, Llama, etc.)</p>
                            </div>
                        </div>
                        {getStatusIcon('HuggingFace')}
                    </div>

                    <div className="p-6 space-y-6">
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
                                        onChange={(e) => setHuggingface({ ...huggingface, model: e.target.value })}
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
