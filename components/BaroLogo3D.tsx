import React from 'react';
import { BaroLogo } from './BaroLogo';
import { cn } from './ui';

interface BaroLogo3DProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animate?: boolean;
}

/**
 * Enhanced brand signature with depth and atmosphere.
 * Mimics the "Organic Pulse" through subtle glow and motion.
 */
export const BaroLogo3D: React.FC<BaroLogo3DProps> = ({ size = 'lg', className, animate = false }) => {

  const sizeClasses = {
    sm: "max-w-[100px]",
    md: "max-w-[220px]",
    lg: "max-w-[340px]"
  };

  return (
    <div className={cn(
      "relative w-full flex items-center justify-center transition-all duration-700",
      sizeClasses[size],
      className
    )}>
      {/* 
          ATMOSPHERIC CORE 
          The "Sosha Yellow" energy hub behind the Organic Pulse
          Redesigned to feel like a liquid sun on the Baro River
      */}
      <div className="absolute inset-0 bg-brand-yellow/20 blur-[90px] rounded-full animate-pulse-slow pointer-events-none mix-blend-screen" />
      <div className="absolute inset-x-[-20%] top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-transparent via-brand-green/30 to-transparent blur-[1px] pointer-events-none" />

      <div className={cn(
        "relative z-10 w-full flex items-center justify-center transform hover:scale-[1.05] transition-transform duration-700 cursor-default",
        animate && "animate-float-slow"
      )}>
        <BaroLogo className="w-full mix-blend-lighten opacity-90" />
      </div>
    </div>
  );
};
