'use client';

import { useState } from "react";
import { Play, ShieldAlert, Terminal } from "lucide-react";

export default function DebugTab() {
    const [output, setOutput] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    async function runCron(mode: 'dry' | 'force') {
        setIsLoading(true);
        setOutput(`🚀 Starting ${mode.toUpperCase()} run...\nwaiting for response...`);

        try {
            const res = await fetch(`/api/cron/rss?${mode}=true`);
            const data = await res.json();
            setOutput(JSON.stringify(data, null, 2));
        } catch (error: any) {
            setOutput(`❌ Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls */}
            <div className="space-y-6">
                <div className="bg-white border border-gray-200 p-6 rounded-lg space-y-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <Terminal size={18} /> Manual Controls
                    </h3>
                    <p className="text-sm text-gray-500">
                        Manually trigger the RSS cron logic. Use Dry Run to test without side effects.
                    </p>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => runCron('dry')}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            <Play size={16} /> Run Dry Mode
                        </button>

                        <button
                            onClick={() => runCron('force')}
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-100 hover:bg-red-200 text-red-800 border border-red-200 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            <ShieldAlert size={16} /> Force Run (Bypass Checks)
                        </button>
                    </div>

                    <div className="text-xs text-gray-400 mt-4 border-t border-gray-200 pt-4">
                        <p><strong>Dry Run:</strong> Simulates logic, AI generation, and decision making. Does NOT write to DB or send notifications.</p>
                        <p className="mt-2"><strong>Force Run:</strong> Executes a REAL run. Bypasses Time Window, Global Cooldown, and Feed Cooldowns.</p>
                    </div>
                </div>
            </div>

            {/* Output Console */}
            <div className="lg:col-span-2 h-[500px] flex flex-col">
                <div className="bg-gray-50 border border-gray-200 rounded-lg flex-1 overflow-hidden flex flex-col">
                    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                        <span className="text-xs font-mono text-gray-500">Console Output</span>
                        {output && (
                            <button onClick={() => setOutput(null)} className="text-xs text-gray-400 hover:text-gray-700">
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                        {output ? (
                            <pre className="font-mono text-xs text-emerald-600 whitespace-pre-wrap">
                                {output}
                            </pre>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                                Ready for input...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
