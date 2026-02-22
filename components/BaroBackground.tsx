
import React from 'react';
import { BackgroundMascots, MascotVariant } from './BackgroundMascots';
import ThemeToggle from './ThemeToggle';
import { LeafBubbleBackground } from './LeafBubbleBackground';
import { cn } from './ui';

interface BaroBackgroundProps {
  children: React.ReactNode;
  variant?: MascotVariant;
  showThemeToggle?: boolean;
}

export const BaroBackground: React.FC<BaroBackgroundProps> = ({
  children,
  variant = 'landing',
  showThemeToggle = true
}) => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden font-sans selection:bg-primary selection:text-black relative transition-colors duration-500">

      {/* Theme Toggle */}
      {showThemeToggle && (
        <div className="fixed top-6 right-6 z-[60]">
          <ThemeToggle />
        </div>
      )}

      {/* Fresh Theme Background (Leaf Bubbles) - Controlled by CSS visibility */}
      <LeafBubbleBackground />

      {/* Background Layer */}
      <div className="fixed inset-0 z-0 river-gradient transition-colors duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />

        {/* River Atmospheric Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-green/5 rounded-full blur-[140px] animate-float-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-yellow/5 rounded-full blur-[140px] animate-float-medium" />

        {/* Dynamic Water Horizon */}
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-green/10 to-transparent blur-[1px]" />

        <BackgroundMascots variant={variant} />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
};
