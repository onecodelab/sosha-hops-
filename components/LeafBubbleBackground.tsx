
import React from 'react';

export const LeafBubbleBackground: React.FC = () => {
  return (
    <div className="leaf-bubbles fixed inset-0 z-0 pointer-events-none overflow-hidden select-none">
      {/* Top Left Organic Blob */}
      <div 
        className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full blur-[120px] animate-float-slow" 
        style={{ backgroundColor: 'var(--bubble-1)' }}
      />
      
      {/* Bottom Right Lime Blob */}
      <div 
        className="absolute -bottom-[10%] -right-[10%] w-[40vw] h-[40vw] rounded-full blur-[100px] animate-float-medium" 
        style={{ backgroundColor: 'var(--bubble-2)' }}
      />
      
      {/* Floating Small Detail Bubbles */}
      <div 
        className="absolute top-[20%] right-[20%] w-32 h-32 rounded-full blur-[40px] animate-float-slow" 
        style={{ animationDelay: '2s', backgroundColor: 'var(--bubble-1)' }} 
      />
      <div 
        className="absolute bottom-[30%] left-[10%] w-48 h-48 rounded-full blur-[50px] animate-float-medium" 
        style={{ animationDelay: '1s', backgroundColor: 'var(--bubble-2)' }} 
      />
      
      {/* Center ambient glow (Optional, keeping subtle) */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full blur-[150px] opacity-30" 
        style={{ backgroundColor: 'var(--bubble-1)' }} 
      />
    </div>
  );
};
