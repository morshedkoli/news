import React from 'react';

interface LogoProps {
    className?: string;
    showText?: boolean;
    variant?: 'default' | 'monochrome' | 'white';
}

export default function Logo({ className = "", showText = true, variant = 'default' }: LogoProps) {
    const primaryColor = variant === 'monochrome' ? 'currentColor' : variant === 'white' ? '#FFFFFF' : '#4F46E5'; // Indigo-600
    const secondaryColor = variant === 'monochrome' ? 'currentColor' : variant === 'white' ? '#E2E8F0' : '#1E293B'; // Slate-800

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* Abstract 'N' with Signal Wave - SVG Icon */}
            <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0"
            >
                {/* Background Shape (Subtle) */}
                <rect width="32" height="32" rx="8" fill={primaryColor} fillOpacity="0.1" />

                {/* The 'N' Structure - Stylized */}
                <path
                    d="M10 24V8L18 18V8"
                    stroke={secondaryColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* The Digital Signal Wave (AI/Tech essence) */}
                <path
                    d="M22 24V14M22 10V8"
                    stroke={primaryColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />
                <circle cx="22" cy="12" r="1" fill={primaryColor} />
            </svg>

            {/* Text Part */}
            {showText && (
                <div className="flex flex-col leading-none">
                    <span className={`text-lg font-bold tracking-tight ${variant === 'white' ? 'text-white' : 'text-slate-900'}`}>
                        NewsByte BD
                    </span>
                    <span className={`text-[10px] font-medium tracking-normal opacity-80 ${variant === 'white' ? 'text-slate-300' : 'text-slate-500'}`}>
                        মূল খবর, বাড়তি কথা নয়।
                    </span>
                </div>
            )}
        </div>
    );
}
