
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
        "relative rounded-[2rem] bg-card/90 border border-border shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden backdrop-blur-md transition-all duration-300 group",
        isInteractive && "hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.8)] hover:border-white/10 cursor-pointer",
        className
      )}
      {...props}
    >
      {/* Subtle Top Gradient (Glass Reflection) */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none" />
      
      {/* Inner Shadow for Depth */}
      <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.2)] pointer-events-none rounded-[2rem]" />

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
      <div className="relative z-10 p-6">
        {children}
      </div>
    </div>
  );
};

export const SoshaCardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 mb-4", className)} {...props}>
    {children}
  </div>
);

export const SoshaCardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...props }) => (
  <h3 className={cn("font-bold text-foreground tracking-tight text-lg", className)} {...props}>
    {children}
  </h3>
);

export const SoshaCardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={cn("", className)} {...props}>
    {children}
  </div>
);
