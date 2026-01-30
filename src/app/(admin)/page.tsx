"use client";

import { useAuth } from "@/context/AuthContext";
import Skeleton from "@/components/Skeleton";
import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useState } from "react";
import MissionControl from "@/components/Analytics/MissionControl";
import DeepStats from "@/components/Analytics/DeepStats";
import ActionCenter from "@/components/Analytics/ActionCenter";
import { DashboardData } from "@/types/analytics";

export default function Home() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Poll for live updates
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/admin/analytics');
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchData();
      // Poll every 30 seconds for live feel
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (loading || !data) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton height={32} width="220px" />
        <Skeleton height={20} width="320px" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} height={120} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton height={300} />
          <Skeleton height={300} />
          <Skeleton height={300} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Mission Control</h1>
        <p className="text-slate-500">System status and operational command.</p>
      </div>

      {/* Row 1: KPI Cards */}
      <MissionControl data={data} />

      {/* Row 2: Deep Analysis & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Deep Stats (2 cols wide on large screens) */}
        <div className="lg:col-span-2">
          <DeepStats data={data} />
        </div>

        {/* Right: Actions & Insights */}
        <div>
          <ActionCenter data={data} />
        </div>
      </div>

      {/* Row 3: Recent Activity Log (Detailed) */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Recent Pipeline Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Duration</th>
                <th className="px-6 py-3 font-medium">Source Used</th>
                <th className="px-6 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.cron?.runs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-slate-400">No recent runs</td>
                </tr>
              ) : (
                data.cron.runs.slice(0, 10).map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {format(new Date(run.started_at), "HH:mm:ss")}
                      <span className="text-xs text-slate-400 ml-1">Today</span>
                    </td>
                    <td className="px-6 py-4">
                      {(run.duration_ms / 1000).toFixed(1)}s
                    </td>
                    <td className="px-6 py-4">
                      {run.source_used ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {run.source_used}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                      {run.tried_sources && run.tried_sources.length > 1 && (
                        <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-1 rounded" title={run.tried_sources.join(' -> ')}>
                          +Retries
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {run.success ? (
                        <span className="inline-flex items-center text-green-600 font-medium text-xs">
                          ✅ Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-500 font-medium text-xs">
                          ❌ {run.exit_reason || "Failed"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
