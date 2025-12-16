
import React from 'react';

export const LeafBubbleBackground: React.FC = () => {
  return (
    <div className="leaf-bubbles fixed inset-0 z-0 pointer-events-none overflow-hidden select-none">
      {/* Top Left Organic Blob */}
      <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-emerald-500/10 blur-[120px] animate-float-slow" />
      
      {/* Bottom Right Lime Blob */}
      <div className="absolute -bottom-[10%] -right-[10%] w-[40vw] h-[40vw] rounded-full bg-lime-500/10 blur-[100px] animate-float-medium" />
      
      {/* Floating Small Detail Bubbles */}
      <div className="absolute top-[20%] right-[20%] w-32 h-32 rounded-full bg-green-400/5 blur-[40px] animate-float-slow" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-[30%] left-[10%] w-48 h-48 rounded-full bg-teal-500/5 blur-[50px] animate-float-medium" style={{ animationDelay: '1s' }} />
      
      {/* Center ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full bg-green-900/5 blur-[150px]" />
    </div>
  );
};
