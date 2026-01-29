"use client";

import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Global Error Caught:", error);
    }, [error]);

    return (
        <html>
            <body className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-800">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
                    <h2 className="mb-2 text-2xl font-bold text-red-600">মারাত্মক ত্রুটি (Critical Error)</h2>
                    <p className="mb-6 text-slate-600">
                        দুঃখিত, একটি অনাকাঙ্ক্ষিত সমস্যা হয়েছে। সিস্টেমটি রিলাউড করার চেষ্টা করুন।
                    </p>
                    <div className="rounded-lg bg-slate-100 p-4 font-mono text-xs text-red-500 mb-6 text-left overflow-auto max-h-32">
                        {error.message}
                    </div>
                    <button
                        onClick={() => reset()}
                        className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700"
                    >
                        Try Again (পুনরায় চেষ্টা করুন)
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="mt-4 block w-full rounded-lg text-sm text-slate-500 hover:text-slate-800"
                    >
                        Go to Home (হোম পেজে যান)
                    </button>
                </div>
            </body>
        </html>
    );
}
