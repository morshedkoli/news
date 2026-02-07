"use client";

import { useEffect, useState } from "react";
import { Edit2, Users } from "lucide-react";
import Skeleton from "@/components/Skeleton";
import { toast } from "sonner";
import EditUserModal from "@/components/Users/EditUserModal";

interface AdminUser {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    emailVerified: boolean;
    disabled: boolean;
    providerData: string[];
}

export default function UsersPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/users');
            if (!res.ok) throw new Error("Failed to fetch users");
            const data = await res.json();
            setUsers(data.users || []);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleEditClick = (user: AdminUser) => {
        setSelectedUser(user);
        setIsEditModalOpen(true);
    };

    const handleUserUpdated = (updatedUser: { uid: string; displayName?: string; email?: string }) => {
        setUsers(prev => prev.map(u => u.uid === updatedUser.uid ? { ...u, ...updatedUser } : u));
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton height={32} width={200} />
                    <Skeleton height={20} width={300} className="mt-2" />
                </div>
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} height={64} className="rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="text-indigo-600" />
                        Users Management
                    </h1>
                    <p className="text-slate-500">View and manage registered users.</p>
                </div>
                <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-medium">
                    Total: {users.length}
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-6 py-4 font-medium">User</th>
                                <th className="px-6 py-4 font-medium">Provider</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium">UID</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        No users found.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.uid} className="group hover:bg-slate-50/50 transition">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg shrink-0">
                                                    {user.photoURL ? (
                                                        <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full object-cover" />
                                                    ) : (
                                                        (user.displayName?.[0] || user.email?.[0] || "?").toUpperCase()
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-slate-900">{user.displayName || "No Name"}</div>
                                                    <div className="text-slate-500 text-xs font-mono">{user.email || "No Email"}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1 flex-wrap">
                                                {user.providerData.map(p => (
                                                    <span key={p} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs border border-slate-200">
                                                        {p.replace('.com', '')}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${!user.disabled ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20" : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"}`}>
                                                {!user.disabled ? "Active" : "Disabled"}
                                            </span>
                                            {user.emailVerified && (
                                                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">
                                                    Verified
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-400 max-w-[150px] truncate" title={user.uid}>
                                            {user.uid}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleEditClick(user)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition shadow-sm"
                                            >
                                                <Edit2 size={14} /> Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedUser && (
                <EditUserModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    user={selectedUser}
                    onUserUpdated={handleUserUpdated}
                />
            )}
        </div>
    );
}
