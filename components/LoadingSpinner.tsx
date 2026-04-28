import React, { useEffect, useState } from 'react';
import { BaroLogo } from './BaroLogo';

interface LoadingSpinnerProps {
  timeout?: number;
  onTimeout?: () => void;
}

export function LoadingSpinner({
  timeout = 10000,
  onTimeout
}: LoadingSpinnerProps) {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const warningTimer = setTimeout(() => {
      setShowWarning(true);
    }, 5000);

    const timeoutTimer = setTimeout(() => {
      if (onTimeout) onTimeout();
    }, timeout);

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(timeoutTimer);
    };
  }, [timeout, onTimeout]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-8 overflow-hidden">

      {/* 
          CENTRAL POSITIONING 
          - Pure Flexbox centering
          - No absolute positioning hacks
          - No hardcoded height/width on container
      */}
      <div className="w-full max-w-lg flex flex-col items-center gap-16 transition-all duration-700">

        <div className="flex flex-col items-center gap-10">
          {/* Central Logo Indicator */}
          <div className="relative flex items-center justify-center scale-90 md:scale-100">
            {/* Layered Cinematic Glow */}
            <div className="absolute inset-0 bg-primary/40 blur-[100px] rounded-full animate-rotate-slow scale-150" />
            <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse-slow scale-110" />
            <div className="absolute inset-0 bg-[#FFB800]/10 blur-[30px] rounded-full animate-pulse" />
            
            <BaroLogo 
              variant="full" 
              className="w-32 md:w-48 h-auto animate-pulse relative z-10 drop-shadow-[0_0_40px_rgba(255,184,0,0.6)]" 
            />
          </div>
        </div>

        {/* System Initializer UI */}
        <div className="flex flex-col items-center w-full max-w-[280px] gap-8">
          {/* Progress Line */}
          <div className="h-[1px] w-full bg-border/50 relative overflow-hidden rounded-full">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent animate-[loading-slide_2s_linear_infinite]" />
          </div>

          {/* Typography */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-[10px] font-black text-muted-foreground/40 tracking-[0.8em] uppercase ml-[0.8em]">
              System Protocol
            </span>
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold text-foreground/60 tracking-widest uppercase">
                Initializing Baro OS
              </span>
            </div>
          </div>
        </div>

        {/* Interaction Message */}
        {showWarning && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <p className="text-[10px] font-bold text-yellow-500/40 bg-yellow-500/5 px-6 py-2 rounded-full border border-yellow-500/10 backdrop-blur-sm">
              Authenticating with database cluster...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
