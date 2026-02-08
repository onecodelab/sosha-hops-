import React from 'react';
import { BaroLogo } from './BaroLogo';
import { cn } from './ui';

interface BaroLogo3DProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animate?: boolean;
}

export const BaroLogo3D: React.FC<BaroLogo3DProps> = ({ size = 'lg', className, animate = false }) => {

  const sizeClasses = {
    sm: "max-w-[120px]",
    md: "max-w-[240px]",
    lg: "max-w-[360px]"
  };

  return (
    <div className={cn(
      "relative w-full flex items-center justify-center transition-all duration-500",
      sizeClasses[size],
      className
    )}>
      {/* 
          CLEAN GLOW 
          - Separation of concerns: glow is a layer, not baked in
          - Uses theme primary color
      */}
      <div className="absolute inset-0 bg-primary/5 blur-[50px] rounded-full animate-pulse pointer-events-none" />

      <div className={cn(
        "relative z-10 w-full",
        animate && "animate-baro-float"
      )}>
        <BaroLogo />
      </div>
    </div>
  );
};
