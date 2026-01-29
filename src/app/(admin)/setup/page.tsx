"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import Skeleton from "@/components/Skeleton";

export default function SetupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "admins", user.uid), {
                email: user.email,
                role: "superadmin",
                created_at: new Date()
            });

            setMessage("Success! Redirecting...");
            router.push("/");
        } catch (error: any) {
            console.error(error);
            setMessage(error.message || "Failed to create admin account.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-md mx-auto py-12 px-4">
                <Skeleton height={48} width="180px" />
                <Skeleton height={20} width="320px" />
                <Skeleton height={48} width="100%" />
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto py-12 px-4 shadow-xl border border-slate-100 bg-white rounded-2xl mt-20">
            <div className="mb-8 text-center">
                <Shield className="mx-auto h-12 w-12 text-indigo-600 mb-2" />
                <h1 className="text-2xl font-bold text-slate-900">Admin Setup</h1>
                <p className="text-slate-500">Create your first admin account.</p>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                        <input
                            type="email"
                            required
                            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="Admin Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder="Min 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                {message && (
                    <div className={`text-center text-sm p-3 rounded-md border ${message.includes('Success') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                        {message}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition"
                >
                    {loading ? "Creating..." : "Create Admin Account"}
                </button>
            </form>
        </div>
    );
}
