import React, { useEffect, useState } from 'react';
import { BaroLogo } from './BaroLogo';
import { motion } from 'framer-motion';

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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black transition-colors duration-500">
      <div className="relative flex flex-col items-center gap-12">
        {/* Simplified Logo with Pulse */}
        <motion.div
          animate={{ 
            opacity: [0.4, 0.7, 0.4],
            scale: [0.98, 1, 0.98]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10"
        >
          <BaroLogo className="w-24 h-auto" />
        </motion.div>

        {/* Simplified Status UI */}
        <div className="flex flex-col items-center gap-4">
          <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.8em] ml-[0.8em]">
            System Protocol
          </span>
          
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-[#FFB800] rounded-full animate-pulse shadow-[0_0_8px_#FFB800]" />
            <span className="text-[11px] font-black text-white/60 uppercase tracking-[0.4em]">
              Initializing Baro OS
            </span>
          </div>
        </div>

        {/* Interaction Message */}
        {showWarning && (
          <div className="absolute bottom-12 opacity-50">
            <p className="text-[10px] font-bold text-white px-6 py-2 uppercase tracking-widest">
              Authenticating with database cluster...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
