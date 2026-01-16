"use client";

import { useEffect, useState } from "react";
import { Circle, RefreshCw } from "lucide-react";

export default function OllamaStatus() {
    const [status, setStatus] = useState<"connected" | "disconnected" | "checking">("checking");

    const checkStatus = async () => {
        try {
            setStatus("checking");
            const res = await fetch("/api/ollama/status");
            if (res.ok) {
                setStatus("connected");
            } else {
                setStatus("disconnected");
            }
        } catch (e) {
            setStatus("disconnected");
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors ${status === "connected"
            ? "bg-green-100 text-green-700 border border-green-200"
            : status === "disconnected"
                ? "bg-red-100 text-red-700 border border-red-200"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}>
            {status === "checking" ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
                <Circle className={`h-3 w-3 fill-current ${status === "connected" ? "text-green-500" : "text-red-500"}`} />
            )}
            <span className="hidden sm:inline">
                {status === "connected" ? "AI Online" : status === "disconnected" ? "AI Offline" : "Checking..."}
            </span>
        </div>
    );
}
