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
        "relative rounded-[2.5rem] bg-card/40 border border-white/5 overflow-hidden transition-all duration-500 group",
        "backdrop-blur-lg md:backdrop-blur-xl", // Stronger on desktop, standard on mobile
        "shadow-[0_8px_40px_-10px_var(--shadow-color)]",
        isInteractive && "hover:-translate-y-1 hover:shadow-[0_20px_60px_-10px_var(--glass-glow)] hover:border-white/10 cursor-pointer hover:bg-card/50",
        className
      )}
      {...props}
    >
      {/* Sleek Gradient Overlay - Glass Reflection */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

      {/* Inner Sharpening Line */}
      <div className="absolute inset-0 rounded-[2.5rem] border border-white/5 opacity-50 pointer-events-none" />

      {/* Role/Status Glow Indicator (Refined) */}
      {indicatorColor && indicatorColor !== 'default' && (
        <div className={cn(
          "absolute -top-[100px] -right-[100px] w-[250px] h-[250px] rounded-full blur-[80px] opacity-10 group-hover:opacity-20 transition-all duration-1000 ease-out pointer-events-none mix-blend-screen",
          indicatorColor === 'yellow' && "bg-primary",
          indicatorColor === 'purple' && "bg-purple-500",
          indicatorColor === 'orange' && "bg-orange-500",
          indicatorColor === 'red' && "bg-red-500",
          indicatorColor === 'blue' && "bg-blue-500",
          indicatorColor === 'green' && "bg-secondary",
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
    <h3 className={cn("text-lg font-black text-foreground tracking-tight uppercase flex items-center gap-2", className)} {...props}>
      {children}
    </h3>
  );
};