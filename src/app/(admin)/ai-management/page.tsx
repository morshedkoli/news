"use client";

import { useState } from "react";
import { Cpu, Activity } from "lucide-react";
import AiProvidersPage from "@/app/(admin)/ai-providers/page";
import AiStatusTab from "@/components/Rss/AiStatusTab";

export default function AiManagementPage() {
    const [activeTab, setActiveTab] = useState<'providers' | 'status'>('providers');

    const tabs = [
        { id: 'providers', label: 'Providers & Models', icon: Cpu },
        { id: 'status', label: 'AI Status', icon: Activity }
    ];

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">AI Management</h1>
                <p className="text-gray-500 mt-1">Manage providers, model priorities, and system status.</p>
            </div>

            <div className="flex border-b border-gray-200 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-gray-50 min-h-[500px]">
                {activeTab === 'providers' && <AiProvidersPage />}
                {activeTab === 'status' && <AiStatusTab />}
            </div>
        </div>
    );
}
