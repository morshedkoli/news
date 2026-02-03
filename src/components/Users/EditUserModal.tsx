"use client";

import { useState, useEffect } from "react";
import { X, Loader2, User, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";

interface EditUserModalProps {
    user: {
        uid: string;
        displayName?: string;
        email?: string;
    };
    isOpen: boolean;
    onClose: () => void;
    onUserUpdated: (user: any) => void;
}

export default function EditUserModal({ user, isOpen, onClose, onUserUpdated }: EditUserModalProps) {
    const [displayName, setDisplayName] = useState(user.displayName || "");
    const [email, setEmail] = useState(user.email || "");
    const [password, setPassword] = useState(""); // Only send if not empty
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setDisplayName(user.displayName || "");
            setEmail(user.email || "");
            setPassword("");
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`/api/users/${user.uid}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    displayName,
                    email,
                    password: password || undefined,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to update user");
            }

            const data = await res.json();
            toast.success("User updated successfully");
            onUserUpdated(data.user);
            onClose();
        } catch (error: any) {
            console.error("Update user error:", error);
            toast.error(error.message || "Failed to update user");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-semibold text-slate-900">Edit User</h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500 uppercase">Display Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                                placeholder="John Doe"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500 uppercase">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                                placeholder="john@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500 uppercase">New Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                                placeholder="Leave blank to keep current"
                                minLength={6}
                            />
                        </div>
                        <p className="text-xs text-slate-400">Min 6 characters. Leave empty to keep unchanged.</p>
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm hover:shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
