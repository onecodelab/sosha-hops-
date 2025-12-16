
import React from 'react';
import { BackgroundMascots, MascotVariant } from './BackgroundMascots';
import ThemeToggle from './ThemeToggle';
import { LeafBubbleBackground } from './LeafBubbleBackground';

interface SoshaBackgroundProps {
  children: React.ReactNode;
  variant?: MascotVariant;
  showThemeToggle?: boolean;
}

export const SoshaBackground: React.FC<SoshaBackgroundProps> = ({ 
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

      {/* Classic Background Layer */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-background to-black transition-colors duration-500">
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />
         
         {/* These classic glows will be overridden or blended by CSS variables in fresh theme */}
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px]" />
         
         <BackgroundMascots variant={variant} />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
};
