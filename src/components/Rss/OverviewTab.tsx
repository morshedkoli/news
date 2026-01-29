'use client';

import { useState, useEffect } from "react";
import { RssSettings, RssRunLog } from "@/types/rss";
import { Timestamp, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDistanceToNow, addMinutes, format } from "date-fns";
import {
    AlertTriangle, CheckCircle, Clock, ShieldAlert, Activity,
    Settings, Target, Zap, TrendingDown, HelpCircle, ArrowRight
} from "lucide-react";

interface OverviewTabProps {
    settings: RssSettings;
    isLoading: boolean;
}

export default function OverviewTab({ settings, isLoading }: OverviewTabProps) {
    const [analysisLogs, setAnalysisLogs] = useState<RssRunLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);

    // Fetch logs for analysis (client-side aggregation)
    useEffect(() => {
        async function fetchAnalysisLogs() {
            try {
                const q = query(collection(db, "rss_run_logs"), orderBy("started_at", "desc"), limit(50));
                const snap = await getDocs(q);
                const logs = snap.docs.map(d => ({ ...d.data(), run_id: d.id } as RssRunLog));
                setAnalysisLogs(logs);
            } catch (e) {
                console.error("Failed to fetch logs for analysis", e);
            } finally {
                setLoadingLogs(false);
            }
        }
        fetchAnalysisLogs();
    }, []);

    if (isLoading || loadingLogs) return <div className="p-12 text-center text-gray-500 animate-pulse">Running System Analysis...</div>;

    // --- DERIVED METRICS ---
    const lastSuccess = settings.last_successful_run instanceof Timestamp ? settings.last_successful_run.toDate() : null;
    const lastRun = settings.last_run_at instanceof Timestamp ? settings.last_run_at.toDate() : null;
    const minutesSinceSuccess = lastSuccess ? (Date.now() - lastSuccess.getTime()) / (1000 * 60) : 999;
    const postsToday = settings.total_posts_today || 0;
    const TARGET = 15;

    // Status Logic
    let systemStatus: 'HEALTHY' | 'DEGRADED' | 'STALLED' = 'HEALTHY';
    if (minutesSinceSuccess > 180 || (settings.consecutive_failed_runs || 0) >= 4) systemStatus = 'STALLED';
    else if (minutesSinceSuccess > 90 || (settings.consecutive_failed_runs || 0) >= 2) systemStatus = 'DEGRADED';

    // Daily Targets
    const now = new Date();
    const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
    const minutesLeftToday = (endOfDay.getTime() - now.getTime()) / 60000;
    const cronInterval = settings.update_interval_minutes || 60;
    const cronOppsLeft = Math.floor(minutesLeftToday / cronInterval);
    const requiredRate = cronOppsLeft > 0
        ? Math.ceil(((TARGET - postsToday) / cronOppsLeft) * 100)
        : 100;
    const estimatedPosts = postsToday + Math.round(cronOppsLeft * 0.6); // Assume 60% success rate

    // Bottleneck Analysis
    const bottlenecks = {
        ai_timeout: 0,
        cooldown: 0,
        empty_feed: 0,
        time_guard: 0,
        duplicates: 0,
        other: 0
    };

    analysisLogs.forEach(log => {
        if (log.post_published) return;
        if (log.ai_failures > 0) bottlenecks.ai_timeout++;
        else if (log.skip_reasons?.some(r => r.includes('cooldown'))) bottlenecks.cooldown++;
        else if (log.skip_reasons?.some(r => r.includes('empty'))) bottlenecks.empty_feed++;
        else if (log.skip_reasons?.some(r => r.includes('time_guard'))) bottlenecks.time_guard++;
        else if (log.skip_reasons?.some(r => r.includes('duplicate'))) bottlenecks.duplicates++;
        else bottlenecks.other++;
    });

    return (
        <div className="space-y-8">
            {/* HERO SECTION - Top Level Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className={`p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${systemStatus === 'HEALTHY' ? 'bg-emerald-50 border-emerald-100' :
                        systemStatus === 'DEGRADED' ? 'bg-amber-50 border-amber-100' :
                            'bg-red-50 border-red-100'
                    }`}>
                    <div>
                        <div className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-1">System Status</div>
                        <div className={`text-4xl font-black flex items-center gap-3 ${systemStatus === 'HEALTHY' ? 'text-emerald-700' :
                                systemStatus === 'DEGRADED' ? 'text-amber-700' : 'text-red-700'
                            }`}>
                            {systemStatus === 'HEALTHY' && <CheckCircle className="w-10 h-10" />}
                            {systemStatus === 'DEGRADED' && <AlertTriangle className="w-10 h-10" />}
                            {systemStatus === 'STALLED' && <ShieldAlert className="w-10 h-10" />}
                            {systemStatus}
                        </div>
                    </div>

                    <div className="bg-white/80 p-4 rounded-lg flex gap-8 items-center backdrop-blur-sm border border-gray-200">
                        <div>
                            <div className="text-xs text-gray-500 font-bold uppercase">Posts Today</div>
                            <div className="text-3xl font-bold text-gray-900">{postsToday} <span className="text-gray-400 text-lg">/ {TARGET}</span></div>
                        </div>
                        <div className="h-10 w-px bg-gray-300"></div>
                        <div>
                            <div className="text-xs text-gray-500 font-bold uppercase">Next Trigger</div>
                            <div className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Clock size={18} className="text-blue-500" /> ~{cronInterval}m
                            </div>
                        </div>
                        <div className="h-10 w-px bg-gray-300"></div>
                        <div>
                            <div className="text-xs text-gray-500 font-bold uppercase">Succcess Rate</div>
                            <div className="text-xl font-bold text-gray-900">
                                {Math.round((postsToday / (postsToday + (settings.consecutive_failed_runs || 0) + 1)) * 100)}%
                            </div>
                        </div>
                    </div>
                </div>

                {/* Derived Intelligence Bar */}
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-gray-100">
                    <div className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Clock size={20} /></div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase">Last Successful Post</div>
                            <div className="font-semibold text-gray-900">
                                {lastSuccess ? formatDistanceToNow(lastSuccess, { addSuffix: true }) : 'Never'}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Target size={20} /></div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase">Estimated Finish</div>
                            <div className="font-semibold text-gray-900">
                                {estimatedPosts} - {estimatedPosts + 2} posts range
                            </div>
                        </div>
                    </div>
                    <div className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-gray-100 text-gray-600 rounded-lg"><Activity size={20} /></div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase">System Heartbeat</div>
                            <div className="font-semibold text-gray-900">
                                Last run {lastRun ? formatDistanceToNow(lastRun, { addSuffix: true }) : 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* SECTION 2 - "Why No Post?" Explainer */}
                <div className="space-y-6">
                    {(minutesSinceSuccess > 60) && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 relative overflow-hidden">
                            <div className="absolute right-0 top-0 opacity-10 rotate-12 -mr-8 -mt-8">
                                <HelpCircle size={150} />
                            </div>
                            <h3 className="text-xl font-bold text-amber-900 mb-4 flex items-center gap-2">
                                <AlertTriangle className="text-amber-600" />
                                Why no post in the last {Math.round(minutesSinceSuccess / 60)}h {Math.round(minutesSinceSuccess % 60)}m?
                            </h3>

                            <div className="space-y-3 relative z-10">
                                <p className="text-sm text-amber-800 font-medium">Primary system bottlenecks detected recently:</p>
                                <ul className="space-y-2">
                                    {bottlenecks.ai_timeout > 0 && (
                                        <li className="flex items-center gap-2 text-sm bg-white/60 p-2 rounded">
                                            <span className="font-bold text-red-600">{bottlenecks.ai_timeout}x</span>
                                            AI Generation Timeouts (Latency high)
                                        </li>
                                    )}
                                    {bottlenecks.cooldown > 0 && (
                                        <li className="flex items-center gap-2 text-sm bg-white/60 p-2 rounded">
                                            <span className="font-bold text-blue-600">{bottlenecks.cooldown}x</span>
                                            Skips due to Cooldown (Normal operation)
                                        </li>
                                    )}
                                    {bottlenecks.time_guard > 0 && (
                                        <li className="flex items-center gap-2 text-sm bg-white/60 p-2 rounded">
                                            <span className="font-bold text-amber-600">{bottlenecks.time_guard}x</span>
                                            Vercel Execution Time Limit Hit
                                        </li>
                                    )}
                                    {bottlenecks.empty_feed > 0 && (
                                        <li className="flex items-center gap-2 text-sm bg-white/60 p-2 rounded">
                                            <span className="font-bold text-gray-600">{bottlenecks.empty_feed}x</span>
                                            Feeds returned no new items
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* SECTION 7 - Daily Target Intelligence */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Target size={20} className="text-blue-500" /> Daily Target Intelligence
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="text-sm text-gray-500">Progress to 15 posts</div>
                                <div className="text-xl font-bold text-gray-900">{Math.round((postsToday / TARGET) * 100)}%</div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                <div className={`h-2.5 rounded-full ${postsToday >= TARGET ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (postsToday / TARGET) * 100)}%` }}></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <div className="bg-gray-50 p-3 rounded">
                                    <div className="text-xs text-gray-400 font-bold uppercase">Opportunities Left</div>
                                    <div className="text-2xl font-bold text-gray-800">{cronOppsLeft}</div>
                                    <div className="text-xs text-gray-500">Expected runs today</div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded">
                                    <div className="text-xs text-gray-400 font-bold uppercase">Required Hit Rate</div>
                                    <div className={`text-2xl font-bold ${requiredRate > 100 ? 'text-red-500' : requiredRate > 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                        {requiredRate > 100 ? 'impossible' : `${requiredRate}%`}
                                    </div>
                                    <div className="text-xs text-gray-500">To reach target</div>
                                </div>
                            </div>

                            {requiredRate > 80 && (
                                <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                    <AlertTriangle size={14} /> Attention: Daily target unlikely without manual intervention.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* SECTION 3 - Bottleneck Analysis Chart */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <TrendingDown size={20} className="text-purple-500" /> Today's Bottlenecks
                        </h3>
                        <div className="space-y-4">
                            <BottleneckBar label="AI Latency / Errors" count={bottlenecks.ai_timeout} total={analysisLogs.length} color="bg-red-500" />
                            <BottleneckBar label="Vercel Time Limit" count={bottlenecks.time_guard} total={analysisLogs.length} color="bg-amber-500" />
                            <BottleneckBar label="Empty Feeds" count={bottlenecks.empty_feed} total={analysisLogs.length} color="bg-gray-400" />
                            <BottleneckBar label="Duplicates" count={bottlenecks.duplicates} total={analysisLogs.length} color="bg-blue-400" />
                            <BottleneckBar label="Global Cooldown" count={bottlenecks.cooldown} total={analysisLogs.length} color="bg-indigo-300" />
                        </div>
                        <p className="text-xs text-center text-gray-400 mt-4">Based on last {analysisLogs.length} cron executions</p>
                    </div>

                    {/* SECTION 8 - Suggested Actions */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6">
                        <h3 className="font-bold text-emerald-900 mb-4 flex items-center gap-2">
                            <Zap size={20} className="text-emerald-600" /> Recommended Actions
                        </h3>
                        <div className="space-y-3">
                            {bottlenecks.ai_timeout > 2 && (
                                <ActionItem
                                    text="Disable 'OpenRouter' and switch to 'Local' or 'Gemini' due to high timeouts."
                                    icon={<ServerIcon />}
                                />
                            )}
                            {requiredRate > 80 && (
                                <ActionItem
                                    text="Trigger a 'Manual Run' now to catch up on missed posts."
                                    icon={<PlayIcon />}
                                />
                            )}
                            {bottlenecks.empty_feed > 5 && (
                                <ActionItem
                                    text="Check Feed Health tab. Some feeds are consistently empty."
                                    icon={<RadioIcon />}
                                />
                            )}
                            {bottlenecks.cooldown > 10 && (
                                <ActionItem
                                    text="Consider reducing Global Cooldown to 30m in settings."
                                    icon={<SettingsIcon />}
                                />
                            )}
                            <div className="text-center pt-2">
                                <span className="text-xs text-emerald-700 opacity-70 italic">System is monitoring for optimizations...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BottleneckBar({ label, count, total, color }: any) {
    if (count === 0) return null;
    const percentage = Math.round((count / total) * 100);
    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{label}</span>
                <span className="font-bold text-gray-900">{count} ({percentage}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${color}`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
}

function ActionItem({ text, icon }: any) {
    return (
        <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
            <div className="text-emerald-600 mt-0.5">{icon}</div>
            <div className="text-sm text-emerald-900 font-medium leading-tight">{text}</div>
            <ArrowRight size={14} className="text-emerald-300 ml-auto mt-0.5" />
        </div>
    );
}

// Simple Icons
const ServerIcon = () => <Activity size={16} />;
const PlayIcon = () => <Zap size={16} />;
const RadioIcon = () => <Settings size={16} />;
const SettingsIcon = () => <Settings size={16} />;
