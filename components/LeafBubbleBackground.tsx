
import React from 'react';

export const LeafBubbleBackground: React.FC = () => {
  return (
    <div className="leaf-bubbles fixed inset-0 z-0 pointer-events-none overflow-hidden select-none">
      {/* Background is now fully dim and controlled by BaroBackground/CSS variables */}
    </div>
  );
};
