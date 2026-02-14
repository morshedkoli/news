"use client";

import AdminShell from "@/components/Shell/AdminShell";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading) {
            if (!user && pathname !== "/login") {
                router.push("/login");
            } else if (user && pathname === "/login") {
                router.push("/");
            }
        }
    }, [user, loading, pathname, router]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
            </div>
        );
    }

    // Prevent flash of protected content
    if (!user && pathname !== "/login") {
        return null;
    }

    // If authenticated, wrap in AdminShell
    if (user) {
        return <AdminShell>{children}</AdminShell>;
    }

    return <>{children}</>;
}
