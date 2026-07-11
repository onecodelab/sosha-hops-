import React from 'react';
import { BaroLogo } from './BaroLogo';

export const BrandLoader: React.FC = () => {
    return (
        <div className="fixed inset-0 h-[100dvh] z-[100] flex items-center justify-center bg-[#faf9f7] dark:bg-[#0a0a0b] transition-colors duration-500 overflow-hidden">
            {/* Corner Ambient Glowing Lights indicating loading progress */}
            <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#fbbd41]/40 dark:bg-[#fbbd41]/25 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-[#84e7a5]/35 dark:bg-[#84e7a5]/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />

            {/* Centered Glowing Logo Only */}
            <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-[#fbbd41]/30 dark:bg-[#fbbd41]/30 blur-[50px] rounded-full scale-150 animate-pulse" />
                <BaroLogo variant="splash" className="animate-pulse relative z-10" />
            </div>
        </div>
    );
};
