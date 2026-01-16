"use strict";
"use client";

import { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertTriangle, RefreshCw, Key, Server, Globe } from 'lucide-react';

export default function AiSettingsPage() {
    // Google State
    const [google, setGoogle] = useState({ apiKey: '', model: 'gemini-1.5-flash', enabled: false, priority: 1 });

    // OpenAI State
    const [openai, setOpenai] = useState({ apiKey: '', model: 'gpt-4o', enabled: false, priority: 2 });

    // OpenRouter State
    const [openrouter, setOpenrouter] = useState({ apiKey: '', model: 'google/gemini-2.0-flash-001', enabled: false, priority: 3 });

    // Ollama State
    const [ollama, setOllama] = useState({ model: 'llama3', enabled: false, priority: 4 });
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);

    // System State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [healthStatus, setHealthStatus] = useState<any[]>([]);
    const [checkingHealth, setCheckingHealth] = useState(false);

    // Fetch Config on Load
    useEffect(() => {
        fetchConfig();
        runHealthCheck();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/ai/config');
            const data = await res.json();
            if (res.ok) {
                if (data.google) setGoogle(data.google);
                if (data.openai) setOpenai(data.openai);
                if (data.openrouter) setOpenrouter(data.openrouter);
                if (data.ollama) setOllama(data.ollama);
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
                body: JSON.stringify({ google, openai, openrouter, ollama })
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

    const fetchOllamaModels = async () => {
        setFetchingModels(true);
        try {
            const res = await fetch('/api/ai/ollama/models');
            const data = await res.json();
            if (data.models && Array.isArray(data.models)) {
                // Determine structure (Ollama API returns { models: [{name: 'x'}, ...] })
                const names = data.models.map((m: any) => m.name);
                setOllamaModels(names);
            }
        } catch (error) {
            console.error("Failed to fetch ollama models", error);
        } finally {
            setFetchingModels(false);
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

    const getStatusIcon = (name: string) => {
        // Flexible matching for provider names
        const provider = healthStatus.find(s =>
            s.provider.toLowerCase().includes(name.toLowerCase()) ||
            (name === 'Google' && s.provider === 'Google Gemini') ||
            (name === 'OpenAI' && s.provider === 'OpenAI Official') ||
            (name === 'OpenRouter' && s.provider === 'OpenRouter')
        );

        if (!provider) return <span className="text-gray-400 text-xs">Unknown</span>;

        return provider.status === 'online'
            ? <span className="flex items-center text-green-600 text-xs font-medium gap-1"><CheckCircle size={14} /> Online ({provider.latency}ms)</span>
            : <span className="flex items-center text-red-600 text-xs font-medium gap-1"><AlertTriangle size={14} /> Offline</span>;
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Configuration...</div>;

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

                {/* 1. Google Gemini Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <Globe className="text-blue-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Google Gemini</h2>
                                <p className="text-xs text-gray-500">Fast & Free Tier Available</p>
                            </div>
                        </div>
                        {getStatusIcon('Google')}
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                <input
                                    type="password"
                                    value={google.apiKey}
                                    onChange={(e) => setGoogle({ ...google, apiKey: e.target.value })}
                                    placeholder="Examples: AIza..."
                                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition font-mono text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1">Get key from <a href="https://aistudio.google.com/" target="_blank" className="text-blue-600 hover:underline">Google AI Studio</a></p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                    <select
                                        value={google.model}
                                        onChange={(e) => setGoogle({ ...google, model: e.target.value })}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    >
                                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast/Free)</option>
                                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                        <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority (Lower = First)</label>
                                    <input
                                        type="number"
                                        value={google.priority}
                                        onChange={(e) => setGoogle({ ...google, priority: parseInt(e.target.value) || 1 })}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center pt-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={google.enabled}
                                        onChange={(e) => setGoogle({ ...google, enabled: e.target.checked })}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Enable Provider</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. OpenAI Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-lg">
                                <Key className="text-green-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">OpenAI API</h2>
                                <p className="text-xs text-gray-500">Official OpenAI Integration</p>
                            </div>
                        </div>
                        {getStatusIcon('OpenAI')}
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                <input
                                    type="password"
                                    value={openai.apiKey}
                                    onChange={(e) => setOpenai({ ...openai, apiKey: e.target.value })}
                                    placeholder="sk-..."
                                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition font-mono text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                    <select
                                        value={openai.model}
                                        onChange={(e) => setOpenai({ ...openai, model: e.target.value })}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white"
                                    >
                                        <option value="gpt-4o">GPT-4o</option>
                                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority (Lower = First)</label>
                                    <input
                                        type="number"
                                        value={openai.priority}
                                        onChange={(e) => setOpenai({ ...openai, priority: parseInt(e.target.value) || 1 })}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center pt-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={openai.enabled}
                                        onChange={(e) => setOpenai({ ...openai, enabled: e.target.checked })}
                                        className="w-5 h-5 text-green-600 rounded focus:ring-green-500 border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Enable Provider</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. OpenRouter Card */}
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
                                        <option value="google/gemini-exp-1206:free">Gemini Exp 1206 (Free)</option>
                                        <option value="deepseek/deepseek-r1-distill-llama-70b:free">DeepSeek R1 Distill 70B (Free)</option>
                                        <option value="deepseek/deepseek-chat:free">DeepSeek V3 (Free)</option>
                                        <option value="qwen/qwen-2.5-7b-instruct:free">Qwen 2.5 7B (Free)</option>
                                        <option value="meta-llama/llama-3.2-3b-instruct:free">Llama 3.2 3B (Free)</option>
                                        <option value="meta-llama/llama-3-8b-instruct:free">Llama 3 8B (Free)</option>
                                        <option value="mistralai/mistral-7b-instruct:free">Mistral 7B (Free)</option>
                                        <option value="microsoft/phi-3-mini-128k-instruct:free">Phi-3 Mini (Free)</option>
                                        <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</option>
                                        <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
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
                        </div>
                    </div>
                </div>

                {/* Local AI Status Card (Read-only) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden opacity-80 hover:opacity-100 transition">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-100 p-2 rounded-lg">
                                <Server className="text-indigo-600" size={20} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Local AI (Ollama)</h2>
                                <p className="text-xs text-gray-500">Auto-detected local processing</p>
                            </div>
                        </div>
                        {getStatusIcon('Ollama')}
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                    <select
                                        value={ollama.model}
                                        onChange={(e) => setOllama({ ...ollama, model: e.target.value })}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-mono text-sm"
                                        onClick={() => { if (ollamaModels.length === 0) fetchOllamaModels(); }}
                                    >
                                        <option value={ollama.model}>{ollama.model}</option>
                                        {ollamaModels.filter(m => m !== ollama.model).map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={(e) => { e.preventDefault(); fetchOllamaModels(); }}
                                    disabled={fetchingModels}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition mb-[1px]"
                                >
                                    {fetchingModels ? "Fetching..." : "Fetch Models"}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority (Lower = First)</label>
                                    <input
                                        type="number"
                                        value={ollama.priority}
                                        onChange={(e) => setOllama({ ...ollama, priority: parseInt(e.target.value) || 3 })}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                    />
                                </div>
                                <div className="flex items-center pt-6">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={ollama.enabled}
                                            onChange={(e) => setOllama({ ...ollama, enabled: e.target.checked })}
                                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Enable Provider</span>
                                    </label>
                                </div>
                            </div>

                            <p className="text-xs text-gray-400 bg-gray-50 p-3 rounded border border-gray-100">
                                Ensure <code>ollama serve</code> is running on port 11434.<br />
                                Endpoint: <span className="font-mono">http://localhost:11434</span>
                            </p>
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
