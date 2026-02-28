import React from 'react';
import { ShieldCheck, ClipboardList, Coffee, Flame, ChefHat, BarChart3, Users, LayoutDashboard, Utensils, Bell, Truck, Building, ShoppingBag, PackageCheck, Bike, Navigation, MapPin, Package } from 'lucide-react';
import { cn } from './ui';

export type MascotVariant = 'owner' | 'manager' | 'waiter' | 'kitchen' | 'landing' | 'supplier' | 'driver';

interface BackgroundMascotsProps {
  variant: MascotVariant;
}

export const BackgroundMascots: React.FC<BackgroundMascotsProps> = ({ variant }) => {
  const getTheme = () => {
    switch (variant) {
      case 'owner': return { color: 'yellow', icons: [ShieldCheck, BarChart3, Users, LayoutDashboard] };
      case 'manager': return { color: 'purple', icons: [ClipboardList, Users, BarChart3, ShieldCheck] };
      case 'waiter': return { color: 'orange', icons: [Coffee, Utensils, Users, Bell] };
      case 'kitchen': return { color: 'red', icons: [Flame, ChefHat, Utensils, ClipboardList] };
      case 'supplier': return { color: 'blue', icons: [Truck, Building, ShoppingBag, PackageCheck] };
      case 'driver': return { color: 'emerald', icons: [Bike, Navigation, MapPin, Package] };
      default: return { color: 'yellow', icons: [ShieldCheck, ClipboardList, Coffee, Flame] }; // Landing
    }
  };

  const theme = getTheme();

  const colorMap: Record<string, string> = {
    yellow: "text-yellow-500/20 border-yellow-500/10 shadow-[0_0_40px_rgba(234,179,8,0.05)] bg-yellow-500/5",
    purple: "text-purple-500/20 border-purple-500/10 shadow-[0_0_40px_rgba(168,85,247,0.05)] bg-purple-500/5",
    orange: "text-orange-500/20 border-orange-500/10 shadow-[0_0_40px_rgba(249,115,22,0.05)] bg-orange-500/5",
    red: "text-red-500/20 border-red-500/10 shadow-[0_0_40px_rgba(239,68,68,0.05)] bg-red-500/5",
    blue: "text-blue-500/20 border-blue-500/10 shadow-[0_0_40px_rgba(59,130,246,0.05)] bg-blue-500/5",
    emerald: "text-emerald-500/20 border-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.05)] bg-emerald-500/5",
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 select-none">
      {/* Style block for animations if not globally present */}
      <style>{`
            @keyframes float-slow {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-20px) rotate(2deg); }
            }
            @keyframes float-medium {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-15px) rotate(-2deg); }
            }
            @keyframes float-slower {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-25px) rotate(3deg); }
            }
            .animate-float-slow { animation: float-slow 14s ease-in-out infinite; }
            .animate-float-delayed { animation: float-slow 16s ease-in-out infinite; animation-delay: 2s; }
            .animate-float-medium { animation: float-medium 10s ease-in-out infinite; animation-delay: 1s; }
            .animate-float-slower { animation: float-slower 20s ease-in-out infinite; animation-delay: 4s; }
        `}</style>

      {/* 1. Top Right (Dashboard safe area) */}
      <div className={cn("absolute opacity-30 animate-float-slow transition-all duration-1000", variant === 'landing' ? "top-[15%] right-[5%]" : "top-[5%] right-[5%]")}>
        <MascotItem Icon={theme.icons[0]} colorClass={colorMap[theme.color]} rotate={12} size="lg" />
      </div>

      {/* 2. Bottom Left */}
      <div className="absolute bottom-[10%] left-[5%] opacity-20 animate-float-medium transition-all duration-1000">
        <MascotItem Icon={theme.icons[1]} colorClass={colorMap[theme.color]} rotate={-8} size="md" />
      </div>

      {/* 3. Top Left (Avoid sidebar in dashboards) */}
      <div className={cn("absolute opacity-20 animate-float-delayed transition-all duration-1000", variant === 'landing' ? "top-[10%] left-[5%]" : "top-[15%] left-[20%]")}>
        <MascotItem Icon={theme.icons[2]} colorClass={colorMap[theme.color]} rotate={-15} size="md" />
      </div>

      {/* 4. Bottom Right */}
      <div className={cn("absolute opacity-15 animate-float-slower transition-all duration-1000", variant === 'landing' ? "bottom-[15%] right-[5%]" : "bottom-[20%] right-[10%]")}>
        <MascotItem Icon={theme.icons[3] || theme.icons[0]} colorClass={colorMap[theme.color]} rotate={5} size="lg" />
      </div>
    </div>
  );
};

const MascotItem = ({ Icon, colorClass, rotate, size }: any) => {
  const sizeClasses = size === 'lg' ? "w-32 h-32 md:w-48 md:h-48" : "w-24 h-24 md:w-32 md:h-32";
  const iconSize = size === 'lg' ? "w-16 h-16 md:w-24 md:h-24" : "w-12 h-12 md:w-16 md:h-16";

  return (
    <div
      className={cn(
        "relative rounded-[2.5rem] bg-gradient-to-br from-white/5 to-transparent border backdrop-blur-[1px] flex items-center justify-center",
        sizeClasses,
        colorClass
      )}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <Icon className={cn(iconSize, "opacity-80 drop-shadow-xl")} strokeWidth={1.5} />
      {/* Gloss Shine */}
      <div className="absolute top-6 right-6 w-3 h-3 rounded-full bg-white/20 blur-[2px]" />
    </div>
  );
};
