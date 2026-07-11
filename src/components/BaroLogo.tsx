import React from 'react';
import { cn } from './ui';

interface BaroLogoProps {
  className?: string;
  variant?: 'full' | 'icon' | 'compact' | 'splash';
  iconOnly?: boolean;
}

export const BaroLogo: React.FC<BaroLogoProps> = ({ 
  className, 
  variant = 'full',
  iconOnly = false
}) => {
  return (
    <div className={cn("flex items-center shrink-0", className)}>
      {variant === 'icon' || variant === 'compact' || iconOnly ? (
        // Icon only — just the graphic, no text
        <img 
          src="/baro-icon.png" 
          decoding="async"
          loading="lazy"
          className={cn(
            "object-contain shrink-0 drop-shadow-sm transition-all",
            variant === 'compact' ? "w-8 h-8" : "w-10 h-10"
          )} 
          alt="Baro Icon" 
        />
      ) : variant === 'splash' ? (
        // Splash loading screen — large and centered
        <img 
          src="/baro-logo-full.png" 
          decoding="async"
          loading="eager"
          className="w-56 sm:w-72 md:w-80 h-auto object-contain shrink-0 drop-shadow-[0_0_24px_rgba(251,189,65,0.45)] transition-all" 
          alt="Baro OS Logo" 
        />
      ) : (
        // Normal full navbar logo
        <img 
          src="/baro-logo-full.png" 
          decoding="async"
          loading="eager"
          className="w-24 md:w-28 h-auto object-contain shrink-0 drop-shadow-sm transition-all" 
          alt="Baro OS Logo" 
        />
      )}
    </div>
  );
};
