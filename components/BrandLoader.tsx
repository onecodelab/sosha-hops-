import React from 'react';

export const BrandLoader: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#000000] overflow-hidden">
            <div className="flex flex-col items-center gap-10 group">
                {/* Tech Status Text - Centered focus */}
                <div className="flex flex-col items-center gap-4">
                    <span className="mono-os text-[10px] font-black text-white/20 tracking-[1em] animate-in fade-in slide-in-from-bottom-2 duration-1200">
                        SYSTEM PROTOCOL
                    </span>
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-1200 delay-400">
                        <div className="w-1.5 h-1.5 bg-brand-yellow rounded-full animate-pulse shadow-[0_0_10px_#FFB800]" />
                        <span className="mono-os text-[11px] font-black text-white/60 tracking-[0.4em]">
                            INITIALIZING BARO OS
                        </span>
                    </div>
                </div>
            </div>

            {/* Subtle atmospheric scanlines or details */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
        </div>
    );
};
