import React from 'react';
import { cn } from './ui';

interface BaroLogoProps {
  className?: string;
  variant?: 'full' | 'icon';
}

/**
 * The official Baro "Flow of Excellence" logo.
 * Represents the organic rhythm of the Baro River transformed into a high-performance OS.
 */
export const BaroLogo: React.FC<BaroLogoProps> = ({ className, variant = 'full' }) => {
  return (
    <div className={cn(
      "flex items-center gap-1 group",
      className
    )}>
      <span className="serif-ital text-white lowercase">baro</span>
      <span className="mono-os text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full text-[10px] font-black border border-brand-green/20">os</span>
    </div>
  );
};