import React, { useEffect } from 'react';
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

  useEffect(() => {
    const timeoutTimer = setTimeout(() => {
      if (onTimeout) onTimeout();
    }, timeout);

    return () => {
      clearTimeout(timeoutTimer);
    };
  }, [timeout, onTimeout]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#faf9f7] dark:bg-[#0a0a0b] transition-colors duration-500 overflow-hidden">
      {/* Corner Ambient Glowing Lights indicating active loading stage */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#fbbd41]/40 dark:bg-[#fbbd41]/25 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-[#84e7a5]/35 dark:bg-[#84e7a5]/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Centered Glowing Logo Only */}
      <motion.div
        animate={{ 
          opacity: [0.6, 1, 0.6],
          scale: [0.97, 1.03, 0.97]
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 flex items-center justify-center"
      >
        <div className="absolute inset-0 bg-[#fbbd41]/35 blur-[55px] rounded-full scale-150 animate-pulse" />
        <BaroLogo variant="splash" className="relative z-10" />
      </motion.div>
    </div>
  );
}
