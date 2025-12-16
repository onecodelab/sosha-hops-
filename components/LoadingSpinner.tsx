import React, { useEffect, useState } from 'react';
import { SoshaBackground } from './SoshaBackground';
import { SoshaLogo3D } from './SoshaLogo3D';

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
    <>
      <style>{`
        @keyframes sosha-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(255, 184, 0, 0.3)); }
          50% { transform: scale(1.05); filter: drop-shadow(0 0 40px rgba(255, 184, 0, 0.6)); }
        }
        .animate-sosha-pulse {
          animation: sosha-pulse 3s ease-in-out infinite;
        }
      `}</style>
      
      <SoshaBackground variant="landing" showThemeToggle={false}>
        <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen">
          
          {/* Glowing Logo Tile */}
          <div className="animate-sosha-pulse">
             <SoshaLogo3D size="md" />
          </div>
          
          {/* Loading Text */}
          <div className="mt-12 flex flex-col items-center gap-3">
            <div className="h-1 w-32 bg-gray-800 rounded-full overflow-hidden">
               <div className="h-full bg-primary animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '50%' }} />
            </div>
            <p className="text-xs font-bold text-gray-500 tracking-[0.2em] uppercase">
              Initializing Sosha OS...
            </p>
          </div>

          {/* Warning Message */}
          {showWarning && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <p className="text-yellow-500/80 text-xs bg-yellow-500/10 px-4 py-2 rounded-full border border-yellow-500/20 backdrop-blur-md">
                Connecting to database is taking longer than usual...
              </p>
            </div>
          )}
        </div>
        
        {/* Inline style for the progress bar animation */}
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </SoshaBackground>
    </>
  );
}
