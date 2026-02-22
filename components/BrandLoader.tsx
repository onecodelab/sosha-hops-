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
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />
        </div>
    );
};
