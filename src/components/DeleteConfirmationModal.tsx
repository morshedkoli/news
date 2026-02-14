"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    isDeleting?: boolean;
}

export default function DeleteConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    isDeleting = false
}: DeleteConfirmationModalProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
        } else {
            const timer = setTimeout(() => setVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!visible && !isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={isDeleting ? undefined : onClose}
            ></div>

            {/* Modal Content */}
            <div className={`relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all duration-300 ${isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}>
                <div className="flex flex-col items-center text-center">
                    <div className="mb-4 rounded-full bg-red-100 p-3 text-red-600">
                        <AlertTriangle size={32} />
                    </div>

                    <h3 className="mb-2 text-xl font-bold text-slate-900">
                        {title}
                    </h3>

                    <p className="mb-6 text-sm text-slate-500">
                        {description}
                    </p>

                    <div className="flex w-full gap-3">
                        <button
                            onClick={onClose}
                            disabled={isDeleting}
                            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-red-700 disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                    </div>
                </div>

                {/* Close Button */}
                {!isDeleting && (
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>
        </div>
    );
}
