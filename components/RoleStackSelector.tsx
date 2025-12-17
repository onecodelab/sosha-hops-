
import React, { useState, useEffect, useRef } from "react";
import { motion, PanInfo, useAnimation } from "framer-motion";
import { cn } from "./ui";
import { LucideIcon, ArrowUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface RoleCard {
  id: string;
  name: string;
  subtitle: string;
  tagline: string;
  icon: LucideIcon;
  color: string;
}

interface RoleStackSelectorProps {
  roles: RoleCard[];
}

const SWIPE_THRESHOLD = 40;

export const RoleStackSelector: React.FC<RoleStackSelectorProps> = ({ roles }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Color mappings for styling
  const colorStyles: Record<string, string> = {
    yellow: "from-yellow-400/20 to-yellow-600/5 border-yellow-500/30 text-yellow-400",
    purple: "from-purple-400/20 to-purple-600/5 border-purple-500/30 text-purple-400",
    orange: "from-orange-400/20 to-orange-600/5 border-orange-500/30 text-orange-400",
    red: "from-red-400/20 to-red-600/5 border-red-500/30 text-red-400",
  };

  const glowStyles: Record<string, string> = {
    yellow: "bg-yellow-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
  };

  const pillStyles: Record<string, string> = {
    yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y < -SWIPE_THRESHOLD) {
      // Swipe Up (Next)
      if (activeIndex < roles.length - 1) {
        setActiveIndex((prev) => prev + 1);
      }
    } else if (info.offset.y > SWIPE_THRESHOLD) {
      // Swipe Down (Prev)
      if (activeIndex > 0) {
        setActiveIndex((prev) => prev - 1);
      }
    }
  };

  const handleCardClick = (index: number) => {
    if (index === activeIndex) {
      navigate(`/login/${roles[index].id}`);
    } else {
      setActiveIndex(index);
    }
  };

  // Wheel support for desktop
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Allow normal scroll if outside the component, but here we capture it
      if (Math.abs(e.deltaY) > 10) {
        e.preventDefault();
        if (e.deltaY > 0 && activeIndex < roles.length - 1) {
          setActiveIndex((prev) => Math.min(prev + 1, roles.length - 1));
        } else if (e.deltaY < 0 && activeIndex > 0) {
          setActiveIndex((prev) => Math.max(prev - 1, 0));
        }
      }
    };

    const el = containerRef.current;
    if (el) {
      el.addEventListener("wheel", handleWheel, { passive: false });
    }
    return () => {
      if (el) el.removeEventListener("wheel", handleWheel);
    };
  }, [activeIndex, roles.length]);

  return (
    <div 
      ref={containerRef}
      className="relative flex items-center justify-center w-full max-w-sm md:max-w-md h-[400px] md:h-[440px] touch-none"
      style={{ perspective: "1200px" }}
    >
      <div className="relative w-full h-full flex items-center justify-center preserve-3d">
        {roles.map((role, index) => {
          const isActive = index === activeIndex;
          const offset = index - activeIndex;
          const Icon = role.icon;

          // Limit visible stack for performance
          if (Math.abs(offset) > 2) return null;

          return (
            <motion.div
              key={role.id}
              className={cn(
                "absolute rounded-[2rem] border shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden cursor-pointer flex flex-col select-none origin-center",
                "bg-card border-border", // Solid opaque background
                isActive ? "z-30" : "z-10",
                // Responsive dimensions
                "w-[260px] h-[360px] md:w-[280px] md:h-[400px]" 
              )}
              initial={false}
              animate={{
                // Tighter vertical stacking
                y: offset * 130, 
                scale: 1 - Math.abs(offset) * 0.1,
                opacity: isActive ? 1 : 1 - Math.abs(offset) * 0.4,
                // Lower Z-Index base from 100 to 20 to prevent header overlap
                zIndex: 20 - Math.abs(offset),
                rotateX: offset * -5, // Slight tilt for depth
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
              drag={isActive ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.1}
              onDragEnd={handleDragEnd}
              onClick={() => handleCardClick(index)}
            >
              {/* Card Inner Content - Reduced Opacity Overlay */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br transition-colors duration-500 opacity-5", // Very subtle opacity
                isActive ? colorStyles[role.color] : "from-gray-800/20 to-black/20"
              )} />
              
              {/* Glow Blob */}
              {isActive && (
                <div className={cn(
                  "absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] opacity-20",
                  glowStyles[role.color]
                )} />
              )}

              {/* Content Layout */}
              <div className="relative z-10 flex flex-col items-center justify-between h-full p-6 text-center">
                
                {/* Top: Icon Avatar */}
                <div className="mt-2">
                   <div className={cn(
                     "w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center border-2 shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-500 bg-black/5",
                     isActive ? `border-${role.color}-500/50` : "border-white/10"
                   )}>
                      <Icon className={cn(
                        "w-10 h-10 md:w-12 md:h-12 transition-colors duration-300",
                        isActive ? `text-${role.color}-400` : "text-gray-500"
                      )} />
                   </div>
                </div>

                {/* Middle: Text */}
                <div className="space-y-1 md:space-y-2">
                   <h2 className={cn(
                     "text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300",
                     isActive ? "text-foreground" : "text-muted"
                   )}>
                     {role.name}
                   </h2>
                   <p className="text-xs md:text-sm font-medium text-muted uppercase tracking-wide">
                     {role.subtitle}
                   </p>
                </div>

                {/* Bottom: Pill & Hint */}
                <div className="mb-2 space-y-4 w-full">
                   <div className="flex justify-center">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-3 py-1 md:px-4 md:py-1.5 rounded-full border transition-all duration-300",
                        isActive ? pillStyles[role.color] : "bg-white/5 border-white/5 text-gray-500"
                      )}>
                        {role.tagline}
                      </span>
                   </div>
                   
                   {isActive && (
                     <motion.div 
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: 0.2 }}
                       className="pt-2 flex justify-center"
                     >
                       <button className="bg-primary text-black px-6 py-2.5 rounded-xl font-bold shadow-[0_4px_20px_rgba(255,184,0,0.3)] hover:scale-105 active:scale-95 transition-all text-xs md:text-sm">
                          Tap to Login
                       </button>
                     </motion.div>
                   )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination Dots (Right Side - Vertically Centered) */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-40 pr-4">
        {roles.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={cn(
              "w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all duration-300",
              idx === activeIndex 
                ? "bg-primary h-6 md:h-8 shadow-[0_0_10px_var(--primary-glow)]" 
                : "bg-gray-700 hover:bg-gray-500"
            )}
          />
        ))}
      </div>

      {/* Swipe Hint (Mobile only, visible initially) */}
      <div className="absolute -bottom-8 left-0 right-0 text-center pointer-events-none md:hidden opacity-50 animate-bounce">
         <div className="flex flex-col items-center gap-1">
            <ArrowUp className="w-4 h-4 text-muted" />
            <span className="text-[10px] text-muted uppercase tracking-widest">Swipe to choose</span>
         </div>
      </div>
    </div>
  );
};
