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
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-8 overflow-hidden select-none">

      <div className="flex flex-col items-center gap-12 animate-in fade-in zoom-in-95 duration-700">
        <div className="flex flex-col items-center gap-10">
          {/* Central Logo Indicator - Using the icon for faster initial render */}
          <div className="relative flex items-center justify-center">
            <BaroLogo 
              variant="full" 
              className="w-48 h-auto animate-pulse relative z-10" 
            />
          </div>
        </div>

        {/* System Initializer UI */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-black text-foreground/20 tracking-[1em] uppercase ml-[1em]">
              System Protocol
            </span>
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(255,184,0,0.5)]" />
              <span className="text-[11px] font-black text-foreground/60 tracking-[0.4em] uppercase">
                Initializing Baro OS
              </span>
            </div>
          </div>
        </div>

        {/* Interaction Message */}
        {showWarning && (
          <div className="absolute bottom-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <p className="text-[10px] font-bold text-primary/40 bg-primary/5 px-6 py-2 rounded-full border border-primary/10 backdrop-blur-sm">
              Authenticating with database cluster...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
