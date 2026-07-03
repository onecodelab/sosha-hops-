
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
        <BackgroundMascots variant={variant} />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
};
