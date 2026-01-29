"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusCircle, Rss, List, LogOut, X, Newspaper, BarChart3, Cpu, Megaphone, Smartphone, Activity } from "lucide-react";
import clsx from "clsx";
import Logo from "@/components/Logo";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const NAV_ITEMS = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Add News", href: "/news/add", icon: PlusCircle },
    { label: "News List", href: "/news", icon: List },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
    { label: "AI Providers", href: "/ai-providers", icon: Cpu },
    { label: "RSS Feeds", href: "/rss", icon: Rss },
    { label: "RSS Health", href: "/rss/dashboard", icon: Activity },
    { label: "Ads Mgmt", href: "/ads", icon: Megaphone },
    { label: "App Update", href: "/app-update", icon: Smartphone },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/50 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={clsx(
                    "fixed inset-y-0 left-0 z-30 w-64 transform bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6">
                    <Link href="/" className="flex items-center gap-2">
                        <Logo />
                    </Link>
                    <button onClick={onClose} className="text-slate-500 lg:hidden">
                        <X size={24} />
                    </button>
                </div>

                <nav className="mt-6 px-4 space-y-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => onClose()} // Close on mobile navigate
                                className={clsx(
                                    "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-indigo-50 text-indigo-700"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                )}
                            >
                                <item.icon size={20} className={isActive ? "text-indigo-600" : "text-slate-400"} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer / Logout area could go here */}
            </aside>
        </>
    );
}
