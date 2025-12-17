import React from 'react';
import { cn } from './ui';

interface SoshaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  indicatorColor?: 'yellow' | 'purple' | 'orange' | 'red' | 'blue' | 'green' | 'default';
  isInteractive?: boolean;
}

export const SoshaCard: React.FC<SoshaCardProps> = ({ 
  className, 
  children, 
  indicatorColor, 
  isInteractive, 
  ...props 
}) => {
  return (
    <div 
      className={cn(
        "relative rounded-[2rem] bg-card/95 border border-border overflow-hidden backdrop-blur-md transition-all duration-300 group",
        "shadow-[0_8px_40px_var(--shadow-color)]",
        isInteractive && "hover:-translate-y-1 hover:shadow-[0_20px_60px_var(--shadow-color)] hover:border-primary/20 cursor-pointer",
        className
      )}
      {...props}
    >
      {/* Subtle Top Gradient (Glass Reflection) */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none" />
      
      {/* Inner Shadow for Depth (Variable) */}
      <div className="absolute inset-0 shadow-[inset_0_0_40px_var(--glass-border)] pointer-events-none rounded-[2rem]" />

      {/* Role/Status Glow Indicator */}
      {indicatorColor && indicatorColor !== 'default' && (
        <div className={cn(
          "absolute -top-10 -right-10 w-40 h-40 rounded-full blur-[80px] opacity-15 group-hover:opacity-25 transition-opacity duration-500 pointer-events-none",
          indicatorColor === 'yellow' && "bg-yellow-500",
          indicatorColor === 'purple' && "bg-purple-500",
          indicatorColor === 'orange' && "bg-orange-500",
          indicatorColor === 'red' && "bg-red-500",
          indicatorColor === 'blue' && "bg-blue-500",
          indicatorColor === 'green' && "bg-green-500",
        )} />
      )}

      {/* Content */}
      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </div>
  );
};

export const SoshaCardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...props }) => {
  return (
    <h3 className={cn("text-lg font-bold text-foreground tracking-tight", className)} {...props}>
      {children}
    </h3>
  );
};