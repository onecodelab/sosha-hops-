import React from 'react';
import { cn } from './ui';

interface BaroLogoProps {
  className?: string;
  variant?: 'full' | 'icon' | 'compact';
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
          className={cn(
            "object-contain shrink-0 drop-shadow-sm transition-all",
            variant === 'compact' ? "w-8 h-8" : "w-10 h-10",
            iconOnly && "w-12 h-12"
          )} 
          alt="Baro Icon" 
        />
      ) : (
        // Full logo — use the combined image asset directly
        <img 
          src="/baro-logo-full.png" 
          className="w-20 md:w-24 h-auto object-contain shrink-0 drop-shadow-sm transition-all" 
          alt="Baro OS Logo" 
        />
      )}
    </div>
  );
};
