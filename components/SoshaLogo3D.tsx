import React from 'react';
import { SoshaLogo } from './SoshaLogo';
import { cn } from './ui';

interface SoshaLogo3DProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animate?: boolean;
}

export const SoshaLogo3D: React.FC<SoshaLogo3DProps> = ({ size = 'lg', className, animate = false }) => {
  
  const sizeClasses = {
    sm: "w-20 h-20",
    md: "w-32 h-32",
    lg: "w-40 h-40"
  };

  const innerSizeClasses = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-24 h-24"
  };

  return (
    <div className={cn(
      "relative mx-auto perspective-1000 cursor-default",
      sizeClasses[size],
      animate && "transition-transform duration-700 hover:scale-105",
      className
    )}>
      {/* Back Glow Blob */}
      <div className="absolute inset-0 rounded-full blur-[50px] bg-primary/30 animate-pulse" />

      {/* Main 3D Card Shape */}
      <div className={cn(
        "relative w-full h-full rounded-[2.5rem] border backdrop-blur-md shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300",
        "bg-gradient-to-br from-yellow-400/20 to-yellow-900/10 border-yellow-500/30",
        // Adjust border radius slightly for smaller sizes
        size === 'sm' ? "rounded-[1.5rem]" : "rounded-[2.5rem]"
      )}>
        
        {/* Top Glare/Reflection */}
        <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent opacity-60" />
        
        {/* Inner Shadow for depth */}
        <div className={cn("absolute inset-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.6)]", size === 'sm' ? "rounded-[1.5rem]" : "rounded-[2.5rem]")} />

        {/* The Logo */}
        <div className={cn("relative z-10 filter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]", innerSizeClasses[size])}>
           <SoshaLogo className="w-full h-full" />
        </div>

        {/* Bottom Detail Shine */}
        <div className="absolute bottom-5 w-1/2 h-1 rounded-full bg-yellow-500/20 blur-sm" />
      </div>
    </div>
  );
};
