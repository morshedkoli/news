"use client";

import { Download, Shield, Zap, Globe, Smartphone, Moon, CheckCircle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-static";

export default function DownloadPage() {
    const apkUrl = "/apk/app-arm64-v8a-release.apk";
    const appVersion = "1.0.0";
    const appSize = "28 MB"; // Estimated/Placeholder

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">

            {/* Navbar / Header */}
            <nav className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-1.5 rounded-lg text-white">
                            <Zap size={20} fill="currentColor" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                            NewsApp
                        </span>
                    </div>
                    {/* Optional Right Side (Home Link) */}
                    <Link href="/" className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition">
                        Wait, I'm Admin
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="relative overflow-hidden pt-16 pb-20 lg:pt-32 lg:pb-28">
                {/* Background Blobs */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
                    <div className="absolute top-20 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
                    <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
                </div>

                <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-medium mb-8">
                        <span className="animate-pulse w-2 h-2 rounded-full bg-indigo-500"></span>
                        New Version {appVersion} Available
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-slate-900 mb-6">
                        Real-time News. <br className="hidden sm:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                            Unfiltered & Fast.
                        </span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-600 mb-10 leading-relaxed">
                        Experience the fastest automated news aggregator.
                        AI-summarized, ad-free, and designed for reading comfort.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a
                            href={apkUrl}
                            download="NewsApp.apk"
                            className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-lg shadow-xl shadow-indigo-200/50 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3"
                        >
                            <Download size={24} />
                            Download for Android
                        </a>
                        <div className="flex flex-col items-start gap-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><Shield size={12} className="text-green-600" /> Virus Scanned</span>
                            <span>Version {appVersion} • {appSize} • Android 8.0+</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Feature Grid */}
            <section className="py-20 bg-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Zap className="text-amber-500" />}
                            title="Instant Updates"
                            desc="Get breaking news within seconds via our high-performance RSS engine."
                        />
                        <FeatureCard
                            icon={<Globe className="text-blue-500" />}
                            title="Bangla & English"
                            desc="Seamlessly switch between localized content from top national sources."
                        />
                        <FeatureCard
                            icon={<Moon className="text-indigo-500" />}
                            title="Dark Mode"
                            desc="Easy on the eyes with a beautiful OLED-friendly dark reading mode."
                        />
                    </div>
                </div>
            </section>

            {/* Installation Steps */}
            <section className="py-20 bg-slate-50 border-t border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">How to Install</h2>

                    <div className="space-y-6">
                        <Step
                            num={1}
                            title="Download the APK"
                            desc="Click the download button above to save the file to your device."
                        />
                        <Step
                            num={2}
                            title="Allow Installation"
                            desc="If prompted, enable 'Install from Unknown Sources' in your browser settings."
                        />
                        <Step
                            num={3}
                            title="Open & Enjoy"
                            desc="Tap the downloaded file to install. No account required."
                        />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 py-12">
                <div className="max-w-6xl mx-auto px-4 text-center">
                    <p className="text-slate-500 text-sm">
                        &copy; 2026 NewsApp Project. All rights reserved.
                    </p>
                    <div className="flex justify-center gap-6 mt-4">
                        <Link href="/privacy" className="text-slate-400 hover:text-slate-600 text-sm">Privacy Policy</Link>
                        <Link href="/terms" className="text-slate-400 hover:text-slate-600 text-sm">Terms of Service</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

// Subcomponents
interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    desc: string;
}

function FeatureCard({ icon, title, desc }: FeatureCardProps) {
    return (
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-100/50 transition-all group">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
            <p className="text-slate-500 leading-relaxed">{desc}</p>
        </div>
    );
}

interface StepProps {
    num: number;
    title: string;
    desc: string;
}

function Step({ num, title, desc }: StepProps) {
    return (
        <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-200">
            <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                {num}
            </div>
            <div>
                <h4 className="font-semibold text-slate-900">{title}</h4>
                <p className="text-sm text-slate-500 mt-1">{desc}</p>
            </div>
        </div>
    );
}
