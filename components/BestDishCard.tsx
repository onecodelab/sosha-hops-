import React from 'react';
import { BaroCard } from './BaroCard';
import { cn } from './ui';
import { Star, TrendingUp, Award, Utensils } from 'lucide-react';

interface BestDishCardProps {
  name: string;
  category: string;
  totalOrders: number;
  rating: number;
  revenueShare: number;
  imageUrl: string;
}

export const BestDishCard: React.FC<BestDishCardProps> = ({
  name,
  category,
  totalOrders,
  rating,
  revenueShare,
  imageUrl
}) => {
  return (
    <BaroCard
      indicatorColor="green"
      className="h-full"
    >
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6 p-6 h-full overflow-visible relative group">
        <style>{`
            @keyframes slow-rotate {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            .animate-plate {
              animation: slow-rotate 40s linear infinite;
            }
          `}</style>

        {/* Glow Effect Behind */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-40 h-40 bg-lime-500/20 blur-[60px] rounded-full pointer-events-none" />

        {/* Left: Rotating Plate */}
        <div className="relative flex-shrink-0">
          {/* Concentric Rings */}
          <div className="absolute inset-0 m-auto w-[120%] h-[120%] border border-white/5 rounded-full" />
          <div className="absolute inset-0 m-auto w-[140%] h-[140%] border border-white/5 rounded-full opacity-50" />

          {/* Plate Container */}
          <div className="relative w-48 h-48 md:w-52 md:h-52 rounded-full p-2 border border-lime-400/20 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-2xl">
            <div className="w-full h-full rounded-full overflow-hidden animate-plate relative z-10">
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full object-cover scale-110"
              />
            </div>

            {/* Badge */}
            <div className="absolute -bottom-2 -right-2 z-20 bg-lime-500 text-black text-xs font-bold px-3 py-1 rounded-full shadow-[0_0_15px_rgba(132,204,22,0.6)] flex items-center gap-1 animate-in zoom-in duration-500 delay-300">
              <Award className="w-3 h-3" /> #1 Winner
            </div>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="flex-1 w-full text-center xl:text-left space-y-4 relative z-10">
          <div>
            <h4 className="text-lime-500 text-xs font-bold uppercase tracking-widest mb-1 flex items-center justify-center xl:justify-start gap-2">
              <Star className="w-3 h-3 fill-current" /> Customer Favorite
            </h4>
            <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">
              {name}
            </h3>
            <p className="text-gray-500 text-sm font-medium mt-1">{category}</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 border border-white/5 rounded-xl p-3">
              <p className="text-gray-400 text-[10px] uppercase font-bold">Total Orders</p>
              <div className="flex items-center gap-2 mt-1">
                <Utensils className="w-4 h-4 text-primary" />
                <span className="text-xl font-bold text-white">{totalOrders}</span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-xl p-3">
              <p className="text-gray-400 text-[10px] uppercase font-bold">Rating</p>
              <div className="flex items-center gap-2 mt-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-xl font-bold text-white">{rating}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Revenue Share</span>
              <span className="text-lime-400 font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> {revenueShare}%
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-gray-800 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-lime-500 to-green-600 rounded-full"
                style={{ width: `${revenueShare}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </BaroCard>
  );
};
