import React from 'react';
import { BaroLogo } from './BaroLogo';

export const BrandLoader: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#000000] overflow-hidden">
            <div className="flex flex-col items-center gap-16 group">
                {/* Central Logo Indicator */}
                <div className="relative flex items-center justify-center scale-90 md:scale-100">
                    {/* Lightweight glow — hidden on mobile */}
                    <div className="hidden md:block absolute inset-0 bg-brand-yellow/20 blur-[60px] rounded-full scale-125" />
                    
                    <BaroLogo 
                        variant="full" 
                        className="w-32 md:w-48 h-auto animate-pulse relative z-10" 
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
        </div>
    );
};
