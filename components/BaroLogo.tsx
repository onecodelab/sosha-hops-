import React from 'react';
import { cn } from './ui';

export const BaroLogo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <img
      src="/baro-logo.png"
      alt="Baro OS"
      className={cn("object-contain w-full h-full mix-blend-screen filter brightness-110 contrast-150 saturate-150", className)}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
};