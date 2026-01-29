"use client";

import { Menu, LogOut, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";


interface TopBarProps {
    onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
    const { user } = useAuth();

    const handleLogout = async () => {
        try {
            await auth.signOut();
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8 shadow-sm">
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="text-slate-500 hover:text-slate-700 lg:hidden"
                >
                    <Menu size={24} />
                </button>
                {/* Placeholder for Page Title if we want it dynamic, or just a generic label */}
                <h2 className="hidden text-sm font-medium text-slate-500 lg:block">Admin Console</h2>
            </div>

            <div className="flex items-center gap-4">

                <div className="flex items-center gap-3">
                    <div className="hidden text-right sm:block">
                        <p className="text-sm font-medium text-slate-700">{user?.displayName || "Admin User"}</p>
                        <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 border border-indigo-200">
                        <User size={16} />
                    </div>
                </div>

                <div className="h-8 w-px bg-slate-200 mx-1"></div>

                <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                    <LogOut size={18} />
                    <span className="hidden sm:inline">Logout</span>
                </button>
            </div>
        </header>
    );
}
