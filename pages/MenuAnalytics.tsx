
import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { useMenu } from '../hooks/useMenu';
import { calculateCostPerPlate, calculateMargins, RecipeIngredient } from '../lib/menuEconomics';
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
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ name: string, percentage: number, revenue: number }[]>([]);
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

      // 2. Aggregate Sales
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

      // 3. Transform to MenuStat using SOURCE OF TRUTH (view_menu_details)
      // menuItems is already fetched from view_menu_details in useMenu hook
      const finalStats: MenuStat[] = menuItems.map(item => {
        const data = statsMap.get(item.id) || { sold: 0, rev: 0, hourly: {} };

        // Cost comes directly from the DB View (Single Source of Truth)
        // We type cast item as any because MenuDish type might not officially have cost_price yet in types.ts
        const unitCost = (item as any).cost_per_plate || 0;
        const totalCost = data.sold * unitCost;
        const { margin, marginPercent } = calculateMargins(item.price, unitCost);

        // Waste Risk: High cost share + Low demand
        const itemPrice = item.price || 1;
        const costShare = unitCost / itemPrice;
        const demandFactor = Math.max(0, 1 - (data.sold / 20));
        const wasteRisk = (costShare * demandFactor) * 100;

        // Auto Labels
        const labels: string[] = [];
        if (margin > 60 && data.sold > 0) labels.push('High Margin – Promote');
        if (margin < 30 && data.sold > 10) labels.push('Popular but Low Margin – Reprice');
        if (data.sold < 5 && unitCost > 0) labels.push('Low Demand – Consider Removal');
        if (!(item as any).is_available) labels.push('Currently Unavailable');
        if (wasteRisk > 70) labels.push('High Waste Risk – Remove?');

        const entries = Object.entries(data.hourly);
        const maxHourEntry = entries.sort((a, b) => b[1] - a[1])[0];
        if (maxHourEntry && data.sold > 5) {
          const hour = parseInt(maxHourEntry[0]);
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
          profit: margin * data.sold, // Profit is margin * quantity sold
          marginPercent: marginPercent,
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

      setCategoryBreakdown(
        Array.from(catMap.entries())
          .map(([name, revenue]) => ({
            name,
            revenue,
            percentage: totalRev > 0 ? (revenue / totalRev) * 100 : 0
          }))
          .sort((a, b) => b.revenue - a.revenue)
      );

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

  const revenueAtRisk = useMemo(() => {
    // Current "Revenue at Risk" based on items that are unavailable or have low stock
    // Low stock items have Math.min stock < par_min (assuming we had par_min here, but we'll use < 5 for now)
    return menuItems.reduce((sum, item) => {
      if (!item.is_available) {
        const stats = analyticsData.find(s => s.id === item.id);
        return sum + (stats?.revenue || 0);
      }
      return sum;
    }, 0);
  }, [menuItems, analyticsData]);

  return (
    <DashboardLayout
      title="Truth Layer Analytics"
      subtitle="Objective performance evidence for your business"
      actions={
        <div className="flex bg-muted/10 p-1.5 rounded-[1.25rem] border border-border backdrop-blur-md">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                period === p ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-muted hover:text-foreground hover:bg-muted/10"
              )}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-5 duration-700">

        {/* Section 1: Best Seller Spotlight (Rolling Plate) - PRIORITIZED TOP */}
        {bestSeller && bestSeller.totalSold > 0 && (
          <div className="relative overflow-hidden rounded-[4rem] bg-card/60 backdrop-blur-xl border border-border p-10 lg:p-14 shadow-2xl group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center relative z-10">
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <Badge className="bg-primary text-black font-black px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(255,184,0,0.3)] animate-pulse border-none">
                    <Award className="w-4 h-4 mr-2" strokeWidth={3} /> CHAMPION
                  </Badge>
                  <span className="text-[10px] text-muted font-black uppercase tracking-[0.3em] opacity-60">Peak Intelligence Node</span>
                </div>
                <h1 className="text-6xl lg:text-7xl font-black text-foreground tracking-tighter leading-[0.8] uppercase">
                  {bestSeller.name}
                </h1>
                <div className="flex flex-wrap gap-6 pt-4">
                  <div className="bg-muted/5 border border-border px-8 py-5 rounded-[2rem] shadow-inner">
                    <p className="text-[10px] text-muted uppercase font-black tracking-widest mb-1.5 opacity-60">Session Velocity</p>
                    <p className="text-4xl font-black text-primary tracking-tighter">{bestSeller.totalSold} <span className="text-xs font-black opacity-40">Orders</span></p>
                  </div>
                  <div className="bg-muted/5 border border-border px-8 py-5 rounded-[2rem] shadow-inner">
                    <p className="text-[10px] text-muted uppercase font-black tracking-widest mb-1.5 opacity-60">Profit Injection</p>
                    <p className="text-4xl font-black text-foreground tracking-tighter"><span className="text-xs font-black mr-1 opacity-40">ETB</span>{bestSeller.profit.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-4">
                  {bestSeller.labels.map(label => (
                    <span key={label} className="bg-card text-[9px] font-black text-muted uppercase tracking-widest px-5 py-2 rounded-xl border border-border shadow-sm flex items-center gap-2 group-hover:text-primary transition-colors">
                      <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(255,184,0,0.5)]" /> {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative flex justify-center items-center">
                <div className="relative w-64 h-64 lg:w-96 lg:h-96">
                  {/* Outer Orbit Layers */}
                  <div className="absolute inset-0 rounded-full border border-primary/20 animate-[spin_30s_linear_infinite]" />
                  <div className="absolute inset-8 rounded-full border border-primary/10 animate-[spin_20s_linear_infinite_reverse]" />
                  {/* Image Container */}
                  <div className="absolute inset-16 rounded-full p-1.5 bg-gradient-to-br from-primary to-primary/20 shadow-[0_0_100px_rgba(255,184,0,0.2)]">
                    <div className="w-full h-full rounded-full overflow-hidden border-8 border-card shadow-2xl">
                      <img
                        src={bestSeller.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                        alt={bestSeller.name}
                        className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-1000"
                      />
                    </div>
                  </div>
                  {/* Floating Stat Pill */}
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background font-black px-6 py-2 rounded-full text-[10px] uppercase tracking-widest shadow-2xl animate-bounce">
                    #{bestSeller.totalSold} TOTAL SOLD
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Dynamic Metric Bar - Moved Below Spotlight */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-card/60 backdrop-blur-xl border border-border p-8 rounded-[2.5rem] shadow-2xl group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <p className="text-[10px] text-muted uppercase font-black tracking-[0.2em] mb-2 opacity-60">Total Revenue ({period})</p>
            <p className="text-4xl font-black text-foreground tracking-tighter">
              <span className="text-xs font-black mr-1 opacity-40">ETB</span>
              {analyticsData.reduce((sum, s) => sum + s.revenue, 0).toLocaleString()}
            </p>
            <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 text-primary/5 group-hover:scale-110 transition-transform" />
          </div>
          <div className="bg-card/60 backdrop-blur-xl border border-border p-8 rounded-[2.5rem] shadow-2xl group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
            <p className="text-[10px] text-muted uppercase font-black tracking-[0.2em] mb-2 opacity-60">Total Profit Injection</p>
            <p className="text-4xl font-black text-emerald-500 tracking-tighter">
              <span className="text-xs font-black mr-1 opacity-40">ETB</span>
              {analyticsData.reduce((sum, s) => sum + s.profit, 0).toLocaleString()}
            </p>
            <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-500/5 group-hover:scale-110 transition-transform" />
          </div>
          <div className="bg-card/60 backdrop-blur-xl border border-border p-8 rounded-[2.5rem] shadow-2xl group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
            <p className="text-[10px] text-red-500 uppercase font-black tracking-[0.2em] mb-2 opacity-80">Revenue At Risk Node</p>
            <p className="text-4xl font-black text-foreground tracking-tighter">
              <span className="text-xs font-black mr-1 opacity-40">ETB</span>
              {revenueAtRisk.toLocaleString()}
            </p>
            <AlertOctagon className="absolute -right-4 -bottom-4 w-24 h-24 text-red-500/5 group-hover:scale-110 transition-transform" />
          </div>
        </div>

        {/* Section 2: Blunt Rankings - Moved up and expanded */}
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-foreground flex items-center gap-3">
                <Target className="w-8 h-8 text-primary" /> Performance Rankings
              </h2>
              <p className="text-xs text-muted-foreground mt-1 font-medium italic">Ranked evidence of your items</p>
            </div>

            <div className="flex bg-muted/10 border border-border p-1.5 rounded-[1.5rem] w-fit shadow-inner backdrop-blur-sm">
              <button
                onClick={() => setActiveRankTab('top')}
                className={cn("px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeRankTab === 'top' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "text-muted hover:text-foreground")}
              >
                Top Assets
              </button>
              <button
                onClick={() => setActiveRankTab('bottom')}
                className={cn("px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeRankTab === 'bottom' ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "text-muted hover:text-foreground")}
              >
                Bottom Assets
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pb-4">
            {(['revenue', 'profit', 'margin', 'orders', 'wasteRisk'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRankBy(tab)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm",
                  rankBy === tab ? "bg-foreground border-foreground text-background" : "bg-card border-border text-muted hover:border-primary/50"
                )}
              >
                By {tab === 'wasteRisk' ? 'Waste Risk' : tab}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {rankedData.map((item, i) => (
              <div key={item.id} className="group relative bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] p-6 hover:border-primary/50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1">
                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-2xl bg-foreground border border-border flex items-center justify-center font-black text-xs text-background z-10 shadow-2xl">
                  {i + 1}
                </div>
                <div className="space-y-4">
                  <div className="w-full aspect-square rounded-[2rem] overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-700 shadow-inner">
                    <img src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'} className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-1000" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-black text-foreground text-sm truncate uppercase tracking-tight group-hover:text-primary transition-colors">{item.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                        {rankBy === 'orders' ? `${item.totalSold} Units` :
                          rankBy === 'wasteRisk' ? `Risk: ${item.wasteRisk.toFixed(0)}%` :
                            rankBy === 'margin' ? `${item.marginPercent.toFixed(1)}%` :
                              `ETB ${(item as any)[rankBy].toLocaleString()}`}
                      </span>
                    </div>
                    {/* Tiny stats inside card */}
                    <div className="pt-2 flex flex-wrap gap-2">
                      {item.labels.slice(0, 2).map((label, idx) => (
                        <span key={idx} className="text-[7px] text-muted font-black uppercase tracking-widest opacity-60 bg-muted/10 px-2 py-0.5 rounded-md">{label.split(' – ')[0]}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Revenue Split (Simplified and full width) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-3 bg-card/60 backdrop-blur-xl border border-border rounded-[3rem] shadow-2xl overflow-hidden relative group">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50 opacity-20" />
            <div className="p-10 pb-4">
              <h3 className="text-xl font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl">
                  <PieIcon className="w-6 h-6 text-blue-500" strokeWidth={3} />
                </div>
                Category Revenue Distribution
              </h3>
            </div>
            <div className="p-10 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                {categoryBreakdown.map(cat => (
                  <div key={cat.name} className="space-y-4 group/cat">
                    <div className="flex justify-between items-end">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest opacity-60 mb-1">{cat.name}</span>
                        <span className="text-xl font-black text-foreground tracking-tighter">
                          <span className="text-[10px] font-black mr-1 opacity-40">ETB</span>
                          {cat.revenue.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs font-black text-primary mb-1">{cat.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 w-full bg-muted/10 rounded-full overflow-hidden border border-border shadow-inner relative">
                      <div
                        className="h-full bg-primary shadow-[0_0_15px_rgba(255,184,0,0.4)] transition-all duration-1000 ease-out"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default MenuAnalytics;
