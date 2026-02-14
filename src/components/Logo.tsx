interface LogoProps {
    className?: string;
    showText?: boolean;
    variant?: 'default' | 'monochrome' | 'white';
}

export default function Logo({ className = "", showText = true, variant = 'default' }: LogoProps) {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* NewsByte Brand Icon */}
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg">
                <img
                    src="/logo-mark.png"
                    alt="NewsByte"
                    className="h-full w-full object-contain"
                />
            </div>

            {/* Text Part */}
            {showText && (
                <div className="flex flex-col leading-none">
                    <span className={`text-lg font-bold tracking-tight ${variant === 'white' ? 'text-white' : 'text-slate-900'}`}>
                        NewsByte
                    </span>
                    <span className={`text-[10px] font-medium tracking-normal opacity-80 ${variant === 'white' ? 'text-slate-300' : 'text-slate-500'}`}>
                        মূল খবর, বাড়তি কথা নয়।
                    </span>
                </div>
            )}
        </div>
    );
}
