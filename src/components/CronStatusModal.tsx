"use client";

import { CheckCircle, XCircle, Terminal, X, Copy } from "lucide-react";
import { useEffect, useState } from "react";

interface CronStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any;
    isLoading: boolean;
    error: string | null;
}

export default function CronStatusModal({
    isOpen,
    onClose,
    data,
    isLoading,
    error
}: CronStatusModalProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
        } else {
            const timer = setTimeout(() => setVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!visible && !isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={!isLoading ? onClose : undefined}
            ></div>

            {/* Modal Content */}
            <div className={`relative w-full max-w-lg transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 ${isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className={`rounded-full p-2 ${isLoading ? 'bg-indigo-100 text-indigo-600' :
                                error ? 'bg-red-100 text-red-600' :
                                    'bg-emerald-100 text-emerald-600'
                            }`}>
                            <Terminal size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Run Cron Job</h3>
                            <p className="text-xs text-slate-500">Manual Trigger Execution</p>
                        </div>
                    </div>
                    {!isLoading && (
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="px-6 py-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600"></div>
                            <p className="mt-4 text-sm font-medium text-slate-600 animate-pulse">Processing RSS Feeds...</p>
                        </div>
                    ) : error ? (
                        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                            <div className="flex items-start gap-3">
                                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                                <div>
                                    <h4 className="font-bold text-red-900">Execution Failed</h4>
                                    <p className="mt-1 text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                                    <div>
                                        <h4 className="font-bold text-emerald-900">Execution Completed</h4>
                                        <p className="text-sm text-emerald-700">Cron job ran successfully.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Raw output details */}
                            <div className="rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-300 overflow-auto max-h-60 relative group">
                                <pre className="whitespace-pre-wrap break-all">
                                    {JSON.stringify(data, null, 2)}
                                </pre>
                                <button
                                    onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}
                                    className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-white transition"
                                    title="Copy to clipboard"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                    >
                        {isLoading ? 'Please wait...' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
}
