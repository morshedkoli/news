"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import OllamaStatus from "@/components/OllamaStatus";

// AdminShell wraps the authenticated content
export default function AdminShell({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <div className="flex flex-1 flex-col overflow-hidden">
                <TopBar onMenuClick={() => setSidebarOpen(true)} />

                {/* Main Content Scrollable Area */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
                    {/* Status Indicator Positioned Absolutely or Fixed, dealing with existing implementation */}
                    {/* The user originally had OllamaStatus floating. We can keep it or integrate it. 
                 Let's keep the existing behaviour but ensure it doesn't overlap weirdly. 
                 Or we can embed it in the TopBar. For now, let's leave it as is, 
                 but we need to ensure this component doesn't conflict with it.
             */}
                    <div className="mx-auto max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
