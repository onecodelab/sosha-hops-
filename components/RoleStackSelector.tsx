
import React, { useState, useEffect, useRef } from "react";
import { motion, PanInfo, AnimatePresence } from "framer-motion";
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
const SCROLL_DEBOUNCE = 500; // ms between allowed scroll steps

export const RoleStackSelector: React.FC<RoleStackSelectorProps> = ({ roles }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef<number>(0);

  // Color mappings
  const colorStyles: Record<string, string> = {
    yellow: "from-yellow-400/10 to-yellow-600/5 border-yellow-500/20 text-yellow-400",
    purple: "from-purple-400/10 to-purple-600/5 border-purple-500/20 text-purple-400",
    orange: "from-orange-400/10 to-orange-600/5 border-orange-500/20 text-orange-400",
    red: "from-red-400/10 to-red-600/5 border-red-500/20 text-red-400",
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
      if (activeIndex < roles.length - 1) setActiveIndex((prev) => prev + 1);
    } else if (info.offset.y > SWIPE_THRESHOLD) {
      if (activeIndex > 0) setActiveIndex((prev) => prev - 1);
    }
  };

  const handleCardClick = (index: number) => {
    if (index === activeIndex) {
      navigate(`/login/${roles[index].id}`);
    } else {
      setActiveIndex(index);
    }
  };

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollTime.current < SCROLL_DEBOUNCE) {
        e.preventDefault();
        return;
      }

      // Increased threshold to 30 to ignore tiny flickers
      if (Math.abs(e.deltaY) > 30) {
        e.preventDefault();
        if (e.deltaY > 0 && activeIndex < roles.length - 1) {
          setActiveIndex((prev) => prev + 1);
          lastScrollTime.current = now;
        } else if (e.deltaY < 0 && activeIndex > 0) {
          setActiveIndex((prev) => prev - 1);
          lastScrollTime.current = now;
        }
      }
    };

    const el = containerRef.current;
    if (el) el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      if (el) el.removeEventListener("wheel", handleWheel);
    };
  }, [activeIndex, roles.length]);

  return (
    <div 
      ref={containerRef}
      className="relative flex items-center justify-center w-full max-w-sm md:max-w-md h-[420px] md:h-[480px] touch-none"
      style={{ perspective: "1500px" }}
    >
      <div className="relative w-full h-full flex items-center justify-center preserve-3d">
        {roles.map((role, index) => {
          const isActive = index === activeIndex;
          const offset = index - activeIndex;
          const Icon = role.icon;

          // Only render current and adjacent cards for performance and focus
          if (Math.abs(offset) > 2) return null;

          return (
            <motion.div
              key={role.id}
              className={cn(
                "absolute rounded-[3rem] border shadow-[0_40px_80px_rgba(0,0,0,0.7)] overflow-hidden cursor-pointer flex flex-col select-none origin-center transition-shadow duration-500",
                "bg-[#080808] border-white/5",
                isActive ? "z-30 shadow-primary/5" : "z-10",
                "w-[260px] h-[360px] md:w-[300px] md:h-[420px]" 
              )}
              initial={false}
              animate={{
                y: offset * 120, // Tighter vertical spread
                scale: 1 - Math.abs(offset) * 0.15,
                opacity: isActive ? 1 : 0.3 - Math.abs(offset) * 0.1,
                zIndex: 20 - Math.abs(offset),
                rotateX: offset * -15, // Dynamic depth tilt
                rotateZ: offset * 2,
              }}
              transition={{
                type: "spring",
                stiffness: 70, // Slower, more deliberate motion
                damping: 24,   // High damping for luxury feel (no bounce)
                mass: 1.2      // Feel slightly "heavier"
              }}
              drag={isActive ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.1}
              onDragEnd={handleDragEnd}
              onClick={() => handleCardClick(index)}
            >
              {/* Internal Glow */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br transition-opacity duration-1000",
                isActive ? "opacity-10" : "opacity-0",
                colorStyles[role.color]
              )} />
              
              {/* Highlight Glow */}
              <AnimatePresence>
                {isActive && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.15 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "absolute -top-32 -right-32 w-80 h-80 rounded-full blur-[100px]",
                      glowStyles[role.color]
                    )} 
                  />
                )}
              </AnimatePresence>

              {/* Content Container */}
              <div className="relative z-10 flex flex-col items-center justify-between h-full p-8 text-center">
                
                {/* Icon Tile */}
                <div className="mt-2">
                   <div className={cn(
                     "w-20 h-20 md:w-24 md:h-24 rounded-[2rem] flex items-center justify-center border transition-all duration-700 bg-white/[0.01]",
                     isActive ? `border-${role.color}-500/40 shadow-[0_0_50px_rgba(0,0,0,0.5)]` : "border-white/5"
                   )}>
                      <Icon className={cn(
                        "w-8 h-8 md:w-10 md:h-10 transition-colors duration-700",
                        isActive ? `text-${role.color}-400` : "text-zinc-800"
                      )} />
                   </div>
                </div>

                {/* Identity */}
                <div className="space-y-1.5">
                   <h2 className={cn(
                     "text-2xl md:text-3xl font-bold tracking-tighter transition-colors duration-700",
                     isActive ? "text-white" : "text-zinc-700"
                   )}>
                     {role.name}
                   </h2>
                   <p className="text-[9px] font-black text-muted uppercase tracking-[0.25em] opacity-40">
                     {role.subtitle}
                   </p>
                </div>

                {/* Action Footer */}
                <div className="mb-2 space-y-6 w-full flex flex-col items-center">
                   <span className={cn(
                     "text-[8px] font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border transition-all duration-700",
                     isActive ? pillStyles[role.color] : "bg-transparent border-white/5 text-zinc-800"
                   )}>
                     {role.tagline}
                   </span>
                   
                   <div className="h-12 flex items-center justify-center">
                    <AnimatePresence>
                      {isActive && (
                        <motion.button 
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 10 }}
                          className="bg-primary text-black px-10 py-3.5 rounded-2xl font-bold shadow-[0_15px_35px_rgba(255,184,0,0.3)] hover:scale-105 active:scale-95 transition-all text-xs md:text-sm"
                        >
                           Tap to Login
                        </motion.button>
                      )}
                    </AnimatePresence>
                   </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Vertical Indicator */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-40">
        {roles.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={cn(
              "w-1 rounded-full transition-all duration-700",
              idx === activeIndex 
                ? "bg-primary h-10 opacity-100 shadow-[0_0_10px_#FFB800]" 
                : "bg-zinc-800 h-2 hover:bg-zinc-600 opacity-40"
            )}
          />
        ))}
      </div>
    </div>
  );
};
