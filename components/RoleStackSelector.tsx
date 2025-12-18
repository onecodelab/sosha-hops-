
import React, { useState, useEffect, useRef } from "react";
import { motion, PanInfo } from "framer-motion";
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

const SWIPE_THRESHOLD = 30;
const SCROLL_DEBOUNCE = 600; // ms between allowed scroll steps

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

  // Smoother wheel support with throttling
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollTime.current < SCROLL_DEBOUNCE) {
        e.preventDefault();
        return;
      }

      if (Math.abs(e.deltaY) > 20) {
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
      className="relative flex items-center justify-center w-full max-w-sm md:max-w-md h-[400px] md:h-[450px] touch-none"
      style={{ perspective: "2000px" }}
    >
      <div className="relative w-full h-full flex items-center justify-center preserve-3d">
        {roles.map((role, index) => {
          const isActive = index === activeIndex;
          const offset = index - activeIndex;
          const Icon = role.icon;

          if (Math.abs(offset) > 2) return null;

          return (
            <motion.div
              key={role.id}
              className={cn(
                "absolute rounded-[2.5rem] border shadow-[0_30px_70px_rgba(0,0,0,0.6)] overflow-hidden cursor-pointer flex flex-col select-none origin-center",
                "bg-[#0a0a0a] border-white/5", // Dark, solid card background
                isActive ? "z-30" : "z-10",
                "w-[270px] h-[370px] md:w-[290px] md:h-[410px]" 
              )}
              initial={false}
              animate={{
                y: offset * 140, // Increased vertical spacing
                scale: 1 - Math.abs(offset) * 0.12,
                opacity: isActive ? 1 : 0.4 - Math.abs(offset) * 0.15,
                zIndex: 20 - Math.abs(offset),
                rotateX: offset * -12, // More pronounced depth tilt
                rotateZ: offset * 1.5, // Slight organic rotation
              }}
              transition={{
                type: "spring",
                stiffness: 80, // Much smoother, fluid motion
                damping: 22,
                mass: 1
              }}
              drag={isActive ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.15}
              onDragEnd={handleDragEnd}
              onClick={() => handleCardClick(index)}
            >
              {/* Subtle Overlay */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br transition-colors duration-1000 opacity-10",
                isActive ? colorStyles[role.color] : "from-transparent to-transparent"
              )} />
              
              {/* Active Glow */}
              {isActive && (
                <motion.div 
                  layoutId="glow"
                  className={cn(
                    "absolute -top-32 -right-32 w-80 h-80 rounded-full blur-[100px] opacity-20",
                    glowStyles[role.color]
                  )} 
                />
              )}

              {/* Layout */}
              <div className="relative z-10 flex flex-col items-center justify-between h-full p-8 text-center">
                
                <div className="mt-4">
                   <div className={cn(
                     "w-24 h-24 md:w-28 md:h-28 rounded-[2rem] flex items-center justify-center border transition-all duration-700 bg-white/[0.02]",
                     isActive ? `border-${role.color}-500/30 shadow-[0_0_40px_rgba(0,0,0,0.4)]` : "border-white/5"
                   )}>
                      <Icon className={cn(
                        "w-10 h-10 md:w-12 md:h-12 transition-colors duration-500",
                        isActive ? `text-${role.color}-400` : "text-gray-700"
                      )} />
                   </div>
                </div>

                <div className="space-y-2">
                   <h2 className={cn(
                     "text-2xl md:text-3xl font-bold tracking-tighter transition-colors duration-500",
                     isActive ? "text-white" : "text-gray-600"
                   )}>
                     {role.name}
                   </h2>
                   <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] opacity-50">
                     {role.subtitle}
                   </p>
                </div>

                <div className="mb-2 space-y-6 w-full">
                   <div className="flex justify-center">
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-[0.15em] px-4 py-1.5 rounded-full border transition-all duration-700",
                        isActive ? pillStyles[role.color] : "bg-white/[0.02] border-white/5 text-gray-700"
                      )}>
                        {role.tagline}
                      </span>
                   </div>
                   
                   {isActive && (
                     <motion.div 
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="flex justify-center"
                     >
                       <button className="bg-primary text-black px-8 py-3 rounded-2xl font-bold shadow-[0_10px_30px_rgba(255,184,0,0.3)] hover:scale-105 active:scale-95 transition-all text-xs md:text-sm">
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

      {/* Pagination Dots */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-40 pr-2">
        {roles.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={cn(
              "w-1 h-1 md:w-1.5 md:h-1.5 rounded-full transition-all duration-500",
              idx === activeIndex 
                ? "bg-primary h-6 md:h-10 opacity-100" 
                : "bg-gray-800 hover:bg-gray-600 opacity-40"
            )}
          />
        ))}
      </div>

      {/* Mobile Hint */}
      <div className="absolute -bottom-12 left-0 right-0 text-center pointer-events-none md:hidden opacity-30 animate-pulse">
         <div className="flex flex-col items-center gap-1">
            <ArrowUp className="w-3 h-3 text-muted" />
            <span className="text-[9px] text-muted uppercase tracking-[0.3em]">Scroll to explore</span>
         </div>
      </div>
    </div>
  );
};
