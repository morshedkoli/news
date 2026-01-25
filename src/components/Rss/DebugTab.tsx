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
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg space-y-4">
                    <h3 className="font-bold text-zinc-100 flex items-center gap-2">
                        <Terminal size={18} /> Manual Controls
                    </h3>
                    <p className="text-sm text-zinc-400">
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
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-900/50 hover:bg-red-900/80 text-red-200 border border-red-800/50 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            <ShieldAlert size={16} /> Force Run (Bypass Checks)
                        </button>
                    </div>

                    <div className="text-xs text-zinc-500 mt-4 border-t border-zinc-800 pt-4">
                        <p><strong>Dry Run:</strong> Simulates logic, AI generation, and decision making. Does NOT write to DB or send notifications.</p>
                        <p className="mt-2"><strong>Force Run:</strong> Executes a REAL run. Bypasses Time Window, Global Cooldown, and Feed Cooldowns.</p>
                    </div>
                </div>
            </div>

            {/* Output Console */}
            <div className="lg:col-span-2 h-[500px] flex flex-col">
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg flex-1 overflow-hidden flex flex-col">
                    <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
                        <span className="text-xs font-mono text-zinc-400">Console Output</span>
                        {output && (
                            <button onClick={() => setOutput(null)} className="text-xs text-zinc-500 hover:text-zinc-300">
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                        {output ? (
                            <pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap">
                                {output}
                            </pre>
                        ) : (
                            <div className="h-full flex items-center justify-center text-zinc-600 text-sm italic">
                                Ready for input...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
