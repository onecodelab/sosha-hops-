
import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { useMenu } from '../hooks/useMenu';
import {
  PieChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, Badge, cn, Button } from '../components/ui';
import {
  TrendingUp, AlertOctagon, DollarSign, PieChart as PieIcon, Info, Filter,
  ArrowUpRight, ArrowDownRight, Zap, Target, Trash2, Clock,
  ChevronRight, Award, Flame, Star
} from 'lucide-react';

interface MenuStat {
  id: string;
  name: string;
  category: string;
  totalSold: number;
  revenue: number;
  costPerUnit: number;
  totalCost: number;
  profit: number;
  marginPercent: number;
  wasteRisk: number; // New metric
  labels: string[];
  image_url?: string;
  hourlyPerformance?: Record<number, number>; // Hour -> Quantity
}

const MenuAnalytics: React.FC = () => {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const { menuItems, loading: menuLoading } = useMenu(false);
  const [analyticsData, setAnalyticsData] = useState<MenuStat[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ name: string, percentage: number, revenue: number, winner?: MenuStat }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!menuLoading) {
      fetchAnalytics();
    }
  }, [menuItems, period, menuLoading]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate = new Date();
      if (period === '7d') startDate.setDate(now.getDate() - 7);
      else if (period === '30d') startDate.setDate(now.getDate() - 30);
      else startDate.setDate(now.getDate() - 90);

      // 1. Fetch Sales Data
      const { data: sales, error: salesErr } = await supabase
        .from('order_items')
        .select(`
          menu_item_id,
          quantity,
          price,
          orders!inner (status, created_at)
        `)
        .gte('orders.created_at', startDate.toISOString())
        .in('orders.status', ['closed', 'paid', 'served']);

      if (salesErr) throw salesErr;

      // 2. Fetch Recipe & Cost Data
      const { data: recipes, error: recErr } = await supabase
        .from('recipes')
        .select(`
          menu_item_id,
          recipe_ingredients (
            quantity_needed,
            unit_type,
            ingredient:ingredients (unit_type, cost_per_unit, weight_per_unit)
          )
        `);

      if (recErr) throw recErr;

      // Helper for conversion
      const getFactor = (from: string, to: string, weight: number = 1) => {
        if (from === to) return 1;
        if (from === 'kg' && to === 'g') return 0.001;
        if (from === 'g' && to === 'kg') return 1000;
        if (from === 'l' && to === 'ml') return 0.001;
        if (from === 'ml' && to === 'l') return 1000;
        if ((from === 'kg' || from === 'l') && ['pcs', 'slice', 'unit'].includes(to)) return weight / 1000;
        if (['g', 'ml'].includes(from) && ['pcs', 'slice', 'unit'].includes(to)) return weight;
        return 1;
      };

      // Create Cost Map
      const costMap = new Map<string, number>();
      recipes?.forEach(r => {
        const unitCost = (r.recipe_ingredients as any[])?.reduce((sum, ri) => {
          const factor = getFactor(ri.ingredient?.unit_type, ri.unit_type, ri.ingredient?.weight_per_unit);
          return sum + (ri.quantity_needed * factor * (ri.ingredient?.cost_per_unit || 0));
        }, 0);
        costMap.set(r.menu_item_id, unitCost);
      });

      // 3. Aggregate Sales
      const statsMap = new Map<string, { sold: number; rev: number; hourly: Record<number, number> }>();
      sales?.forEach((s: any) => {
        const id = s.menu_item_id;
        const current = statsMap.get(id) || { sold: 0, rev: 0, hourly: {} };
        const hour = new Date(s.orders.created_at).getHours();

        statsMap.set(id, {
          sold: current.sold + s.quantity,
          rev: current.rev + (s.price * s.quantity),
          hourly: { ...current.hourly, [hour]: (current.hourly[hour] || 0) + s.quantity }
        });
      });

      // 4. Transform to MenuStat
      const finalStats: MenuStat[] = menuItems.map(item => {
        const data = statsMap.get(item.id) || { sold: 0, rev: 0, hourly: {} };
        const unitCost = costMap.get(item.id) || 0;
        const totalCost = data.sold * unitCost;
        const profit = data.rev - totalCost;
        const margin = data.rev > 0 ? (profit / data.rev) * 100 : 0;

        // Waste Risk: High cost share + Low demand
        // Score 0-100: Higher is riskier
        const itemPrice = item.price || 1;
        const costShare = unitCost / itemPrice;
        const demandFactor = Math.max(0, 1 - (data.sold / 20)); // Normalized 0-1
        const wasteRisk = (costShare * demandFactor) * 100;

        // Auto Labels
        const labels: string[] = [];
        if (margin > 60 && data.sold > 0) labels.push('High Margin – Promote');
        if (margin < 30 && data.sold > 10) labels.push('Popular but Low Margin – Reprice');
        if (wasteRisk > 70) labels.push('High Waste Risk – Remove?');

        // Time Winner logic (Ethiopian 12h clock)
        const entries = Object.entries(data.hourly);
        const maxHourEntry = entries.sort((a, b) => b[1] - a[1])[0];
        if (maxHourEntry && data.sold > 5) {
          const hour = parseInt(maxHourEntry[0]);
          // Ethiopian Time: Offset 6 hours
          // 6 AM -> 12, 7 AM -> 1, 12 PM -> 6, 6 PM -> 12, 11 PM -> 5
          const etHour = (hour - 6 + 24) % 12 || 12;
          const periodName = (hour >= 6 && hour < 18) ? 'Day' : 'Night';
          labels.push(`Peak at ${etHour}:00 (${periodName})`);
        }

        return {
          id: item.id,
          name: item.name,
          category: item.category || 'Uncategorized',
          totalSold: data.sold,
          revenue: data.rev,
          costPerUnit: unitCost,
          totalCost,
          profit,
          marginPercent: margin,
          wasteRisk,
          labels,
          image_url: item.image_url,
          hourlyPerformance: data.hourly
        };
      });

      setAnalyticsData(finalStats);

      // Category Breakdown
      const totalRev = finalStats.reduce((sum, s) => sum + s.revenue, 0);
      const catMap = new Map<string, number>();
      finalStats.forEach(s => {
        catMap.set(s.category, (catMap.get(s.category) || 0) + s.revenue);
      });

      const catWinnersMap = new Map<string, MenuStat>();
      finalStats.forEach(s => {
        const currentWinner = catWinnersMap.get(s.category);
        if (!currentWinner || s.revenue > currentWinner.revenue) {
          catWinnersMap.set(s.category, s);
        }
      });

      const overallWinner = [...finalStats].sort((a, b) => b.revenue - a.revenue)[0];

      const breakdown = Array.from(catMap.entries())
        .map(([name, revenue]) => ({
          name,
          revenue,
          percentage: totalRev > 0 ? (revenue / totalRev) * 100 : 0,
          winner: catWinnersMap.get(name)
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // Prepend Overall Winner if it exists
      if (overallWinner && overallWinner.revenue > 0) {
        breakdown.unshift({
          name: 'All Dishes',
          revenue: totalRev,
          percentage: 100,
          winner: overallWinner
        });
      }

      setCategoryBreakdown(breakdown);

    } catch (err) {
      console.error("Analytics Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const [activeRankTab, setActiveRankTab] = useState<'top' | 'bottom'>('top');
  const [rankBy, setRankBy] = useState<'revenue' | 'profit' | 'margin' | 'orders' | 'wasteRisk'>('revenue');

  const rankedData = [...analyticsData].sort((a, b) => {
    const field = rankBy === 'orders' ? 'totalSold' : rankBy === 'margin' ? 'marginPercent' : rankBy;
    return activeRankTab === 'top' ? (b as any)[field] - (a as any)[field] : (a as any)[field] - (b as any)[field];
  }).slice(0, 10);

  const bestSeller = [...analyticsData].sort((a, b) => b.totalSold - a.totalSold)[0];

  return (
    <DashboardLayout
      title="Truth Layer Analytics"
      subtitle="Objective performance evidence for your business"
      actions={
        <div className="flex bg-card/50 p-1 rounded-xl border border-white/5 backdrop-blur-md">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                period === p ? "bg-primary text-black" : "text-muted hover:text-white"
              )}
            >
              Last {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-5 duration-700">

        {/* Section 1: Best Seller Spotlight (Rolling Plate) */}
        {bestSeller && bestSeller.totalSold > 0 && (
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary/20 via-black to-black border border-primary/10 p-8 lg:p-12 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 relative z-10">
                <div className="flex items-center gap-3">
                  <Badge className="bg-primary/20 text-primary border-primary/20 px-3 py-1 animate-pulse">
                    <Award className="w-3 h-3 mr-1" /> BEST SELLER
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">Current Period Champion</span>
                </div>
                <h1 className="text-5xl lg:text-7xl font-black text-white tracking-tighter leading-tight">
                  {bestSeller.name}
                </h1>
                <div className="flex flex-wrap gap-4">
                  <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-2xl backdrop-blur-xl">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Orders</p>
                    <p className="text-3xl font-black text-primary font-mono">{bestSeller.totalSold}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-2xl backdrop-blur-xl">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Profit Share</p>
                    <p className="text-3xl font-black text-white font-mono">ETB {bestSeller.profit.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-4">
                  {bestSeller.labels.map(label => (
                    <Badge key={label} className="bg-white/10 text-white border-white/5 font-bold px-4 py-1.5 rounded-full flex items-center gap-2">
                      <Flame className="w-3 h-3 text-orange-500" /> {label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="relative flex justify-center items-center">
                {/* Rolling Plate Animation Container */}
                <div className="relative w-64 h-64 lg:w-96 lg:h-96">
                  {/* Outer Orbit */}
                  <div className="absolute inset-0 rounded-full border border-primary/20 animate-[spin_20s_linear_infinite]" />
                  {/* Inner Content */}
                  <div className="absolute inset-4 rounded-full border border-primary/40 p-4">
                    <div className="w-full h-full rounded-full overflow-hidden shadow-[0_0_80px_rgba(255,184,0,0.2)] border-4 border-primary shadow-primary/20 animate-[spin_12s_linear_infinite_reverse]">
                      <img
                        src={bestSeller.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                        alt={bestSeller.name}
                        className="w-full h-full object-cover scale-110"
                      />
                    </div>
                  </div>
                  {/* Floating Stats Orbits */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-black font-black px-4 py-1 rounded-full text-xs shadow-xl animate-bounce">
                    #{bestSeller.totalSold} SOLD
                  </div>
                </div>
              </div>
            </div>

            {/* Background Decorations */}
            <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />
            <div className="absolute -left-20 -top-20 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px]" />
          </div>
        )}

        {/* Section 2: Blunt Rankings - Moved up and expanded */}
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-white flex items-center gap-3">
                <Target className="w-8 h-8 text-primary" /> Performance Rankings
              </h2>
              <p className="text-xs text-muted-foreground mt-1 font-medium italic">Ranked evidence of your items</p>
            </div>

            <div className="flex bg-black/40 border border-white/5 p-1 rounded-2xl w-fit">
              <button
                onClick={() => setActiveRankTab('top')}
                className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", activeRankTab === 'top' ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "text-muted-foreground hover:text-white")}
              >
                Top Performers
              </button>
              <button
                onClick={() => setActiveRankTab('bottom')}
                className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", activeRankTab === 'bottom' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-muted-foreground hover:text-white")}
              >
                Bottom Performers
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pb-4">
            {(['revenue', 'profit', 'margin', 'orders', 'wasteRisk'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRankBy(tab)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border transition-all",
                  rankBy === tab ? "bg-primary border-primary text-black" : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"
                )}
              >
                By {tab === 'wasteRisk' ? 'Waste Risk' : tab}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {rankedData.map((item, i) => (
              <div key={item.id} className="group relative bg-[#111] border border-white/5 rounded-3xl p-5 hover:border-primary/50 transition-all">
                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-black border border-white/10 flex items-center justify-center font-black text-xs text-white z-10 shadow-2xl">
                  {i + 1}
                </div>
                <div className="space-y-3">
                  <div className="w-full aspect-square rounded-2xl overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-500">
                    <img src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'} className="w-full h-full object-cover scale-110" />
                  </div>
                  <div>
                    <h4 className="font-black text-white text-sm truncate leading-tight group-hover:text-primary transition-colors">{item.name}</h4>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-mono font-bold text-primary">
                        {rankBy === 'orders' ? `${item.totalSold} Sold` :
                          rankBy === 'wasteRisk' ? `Risk: ${item.wasteRisk.toFixed(0)}%` :
                            rankBy === 'margin' ? `${item.marginPercent.toFixed(1)}%` :
                              `ETB ${(item as any)[rankBy].toLocaleString()}`}
                      </span>
                    </div>
                    {/* Tiny stats inside card */}
                    <div className="mt-3 flex gap-2">
                      {item.labels.slice(0, 1).map((label, idx) => (
                        <span key={idx} className="text-[7px] text-muted-foreground font-black uppercase tracking-tighter">{label.split(' – ')[0]}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Revenue Split (Simplified and full width) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-black/40 border-white/5 backdrop-blur-xl rounded-[2rem]">
            <CardHeader className="p-8 pb-2">
              <CardTitle className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-3">
                <PieIcon className="w-5 h-5 text-blue-400" /> Category Revenue Split
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryBreakdown.filter(c => c.name !== 'All Dishes').map(cat => (
                  <div key={cat.name} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight">
                      <span className="text-muted-foreground">{cat.name}</span>
                      <span className="text-white">{cat.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div className="h-full bg-primary" style={{ width: `${cat.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="bg-black/40 border border-white/5 rounded-[2rem] p-8 overflow-hidden relative backdrop-blur-xl">
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-6">
                < Award className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Category Champions</h3>
              </div>

              <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
                {categoryBreakdown.filter(c => c.winner && c.winner.revenue > 0).map((cat, idx) => (
                  <div key={cat.name} className="flex items-center gap-4 group/winner">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 group-hover/winner:border-primary/50 transition-all">
                        <img
                          src={cat.winner?.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                          className="w-full h-full object-cover grayscale group-hover/winner:grayscale-0 group-hover/winner:scale-110 transition-all duration-500"
                        />
                      </div>
                      <div className="absolute -top-1 -right-1 bg-primary text-black text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-black">
                        {idx + 1}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-primary font-black uppercase tracking-widest leading-none mb-1">{cat.name} Winner</p>
                      <h4 className="text-sm font-bold text-white group-hover/winner:text-primary transition-colors truncate max-w-[120px]">
                        {cat.winner?.name}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-mono">ETB {cat.winner?.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-6 mt-6 border-t border-white/5">
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                  <Zap className="w-3 h-3 text-primary animate-pulse" />
                  Live Performance Pulse
                </div>
              </div>
            </div>
            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default MenuAnalytics;
