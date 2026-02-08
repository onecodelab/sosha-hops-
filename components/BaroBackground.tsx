
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
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-background via-background to-transparent transition-colors duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />

        {/* Classic Glows (Only visible in Dark Mode effectively due to blend modes or variable override) */}
        <div className="hidden dark:block absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="hidden dark:block absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px]" />

        <BackgroundMascots variant={variant} />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
};
