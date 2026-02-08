import React, { useEffect, useState } from 'react';
import { BaroLogo3D } from './BaroLogo3D';

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
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-8">
      <style>{`
        @keyframes baro-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        .animate-baro-float {
          animation: baro-float 4s ease-in-out infinite;
        }
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      {/* 
          CENTRAL LOGO - BaroLogo3D 
          - No absolute positioning for alignment
          - No custom margins
          - Uses standard Flex/Grid centering from parent
      */}
      <div className="w-full flex justify-center items-center">
        <BaroLogo3D size="lg" animate />
      </div>

      {/* SYSTEM INITIALIZER TEXT */}
      <div className="mt-16 flex flex-col items-center w-full max-w-[280px] gap-6">
        <div className="h-[1px] w-full bg-border relative overflow-hidden">
          <div className="absolute inset-0 bg-primary animate-[loading_2s_ease-in-out_infinite]" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-black text-muted-foreground tracking-[0.8em] uppercase ml-[0.8em]">
            Initializing Platform
          </span>
          <span className="text-sm font-bold text-primary tracking-tight">
            BARO OS <span className="text-foreground/40 font-medium">INTELLIGENCE</span>
          </span>
        </div>
      </div>

      {/* STATUS OVERRIDE */}
      {showWarning && (
        <div className="mt-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <p className="text-[10px] font-bold text-yellow-500/60 bg-yellow-500/5 px-4 py-1.5 rounded-full border border-yellow-500/10">
            Stabilizing connection...
          </p>
        </div>
      )}
    </div>
  );
}
