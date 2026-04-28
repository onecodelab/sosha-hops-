import React from 'react';
import { BaroLogo } from './BaroLogo';

export const BrandLoader: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#000000] overflow-hidden">
            <div className="flex flex-col items-center gap-16 group">
                {/* Central Logo Indicator */}
                <div className="relative flex items-center justify-center scale-90 md:scale-100">
                    {/* Layered Cinematic Glow */}
                    <div className="absolute inset-0 bg-brand-yellow/20 blur-[100px] rounded-full scale-150" style={{ animation: 'rotate-slow 12s linear infinite' }} />
                    <div className="absolute inset-0 bg-brand-yellow/10 blur-[60px] rounded-full scale-110" style={{ animation: 'pulse-slow 6s ease-in-out infinite' }} />
                    <div className="absolute inset-0 bg-[#FFB800]/10 blur-[30px] rounded-full animate-pulse" />
                    
                    <BaroLogo 
                        variant="full" 
                        className="w-32 md:w-48 h-auto animate-pulse relative z-10 drop-shadow-[0_0_40px_rgba(255,184,0,0.6)]" 
                    />
                </div>

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
