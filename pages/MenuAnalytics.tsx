
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { useMenu } from '../hooks/useMenu';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, Badge, cn, Button } from '../components/ui';
import { TrendingUp, AlertOctagon, DollarSign, PieChart, Info, Filter } from 'lucide-react';

interface MenuStat {
  id: string;
  name: string;
  category: string;
  totalSold: number;
  totalRevenue: number;
  quadrant: 'Star' | 'Dog' | 'Puzzle' | 'Plowhorse';
}

const MenuAnalytics: React.FC = () => {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const { menuItems, loading: menuLoading } = useMenu(false);
  const [analyticsData, setAnalyticsData] = useState<MenuStat[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{name: string, percentage: number, revenue: number}[]>([]);
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

      // 1. Fetch Order Items joined with Orders to filter by status and date
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select(`
          menu_item_id,
          quantity,
          price,
          menu_items (
            id,
            name,
            price,
            category,
            description,
            image_url
          ),
          orders!inner (
            status,
            created_at
          )
        `)
        .gte('orders.created_at', startDate.toISOString())
        .in('orders.status', ['completed', 'paid', 'served']);

      if (error) throw error;

      // 2. Aggregate Data
      const itemMap = new Map<string, { sold: number; rev: number }>();
      let totalPeriodRevenue = 0;

      orderItems?.forEach((item: any) => {
        const id = item.menu_item_id;
        const subtotal = (item.price || 0) * item.quantity;
        const current = itemMap.get(id) || { sold: 0, rev: 0 };
        itemMap.set(id, {
          sold: current.sold + item.quantity,
          rev: current.rev + subtotal
        });
        totalPeriodRevenue += subtotal;
      });

      // 3. Map back to menu items and calculate quadrants
      const stats: MenuStat[] = menuItems.map(menu => {
        const data = itemMap.get(menu.id) || { sold: 0, rev: 0 };
        return {
          id: menu.id,
          name: menu.name,
          category: menu.category || 'Uncategorized',
          totalSold: data.sold,
          totalRevenue: data.rev,
          quadrant: 'Dog' // Placeholder
        };
      });

      // 4. Matrix Classification Logic
      const activeStats = stats.filter(s => s.totalSold > 0);
      const avgSold = activeStats.reduce((acc, s) => acc + s.totalSold, 0) / (activeStats.length || 1);
      const avgRev = activeStats.reduce((acc, s) => acc + s.totalRevenue, 0) / (activeStats.length || 1);

      const finalStats = stats.map(s => {
        let q: any = 'Dog';
        if (s.totalSold >= avgSold && s.totalRevenue >= avgRev) q = 'Star';
        else if (s.totalSold >= avgSold && s.totalRevenue < avgRev) q = 'Plowhorse';
        else if (s.totalSold < avgSold && s.totalRevenue >= avgRev) q = 'Puzzle';
        return { ...s, quadrant: q };
      });

      setAnalyticsData(finalStats);

      // 5. Category Breakdown
      const catMap = new Map<string, number>();
      finalStats.forEach(s => {
        catMap.set(s.category, (catMap.get(s.category) || 0) + s.totalRevenue);
      });

      const breakdown = Array.from(catMap.entries())
        .map(([name, revenue]) => ({
          name,
          revenue,
          percentage: totalPeriodRevenue > 0 ? (revenue / totalPeriodRevenue) * 100 : 0
        }))
        .sort((a, b) => b.revenue - a.revenue);

      setCategoryBreakdown(breakdown);

    } catch (err) {
      console.error("Analytics Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const topPerformers = [...analyticsData].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5);
  const scatterData = analyticsData.filter(s => s.totalSold > 0).map(s => ({
    name: s.name,
    x: s.totalSold,
    y: s.totalRevenue,
    quadrant: s.quadrant
  }));

  const getQuadrantColor = (q: string) => {
    switch (q) {
      case 'Star': return '#84CC16'; // Green
      case 'Plowhorse': return '#FFB800'; // Yellow
      case 'Puzzle': return '#A855F7'; // Purple
      default: return '#EF4444'; // Red (Dog)
    }
  };

  return (
    <DashboardLayout 
      title="Menu Analytics" 
      subtitle="Optimize your menu performance and profitability"
      actions={
        <div className="flex bg-card/50 p-1 rounded-xl border border-border backdrop-blur-md">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                period === p 
                  ? "bg-primary text-black shadow-lg" 
                  : "text-muted hover:text-foreground"
              )}
            >
              Last {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* Top Section: Table & Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Top Performers Table */}
          <Card className="lg:col-span-2 bg-[#09090b] border-border">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Top Performers
              </CardTitle>
              <Badge variant="outline" className="border-primary/20 text-primary">By Revenue</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted uppercase bg-black/20">
                    <tr>
                      <th className="px-6 py-4">Menu Item</th>
                      <th className="px-6 py-4 text-center">Total Sold</th>
                      <th className="px-6 py-4 text-right">Revenue Generated</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr><td colSpan={4} className="p-8 text-center text-muted">Loading analytics...</td></tr>
                    ) : topPerformers.length === 0 ? (
                      <tr><td colSpan={4} className="p-12 text-center text-muted flex flex-col items-center gap-3">
                        <AlertOctagon className="w-8 h-8 opacity-20" />
                        No sales found for this period.
                      </td></tr>
                    ) : (
                      topPerformers.map((item) => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4">
                            <p className="font-bold text-white group-hover:text-primary transition-colors">{item.name}</p>
                            <p className="text-xs text-muted">{item.category}</p>
                          </td>
                          <td className="px-6 py-4 text-center font-mono text-gray-300">{item.totalSold}</td>
                          <td className="px-6 py-4 text-right font-mono text-primary font-bold">ETB {item.totalRevenue.toLocaleString()}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              "px-2 py-1 rounded text-[10px] font-bold uppercase border",
                              item.quadrant === 'Star' ? "bg-green-500/10 text-green-500 border-green-500/20" : 
                              item.quadrant === 'Plowhorse' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : 
                              "bg-purple-500/10 text-purple-500 border-purple-500/20"
                            )}>
                              {item.quadrant}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card className="bg-[#09090b] border-border">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <PieChart className="w-5 h-5 text-blue-400" /> Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                 <div className="space-y-4 py-4">
                    {[1,2,3].map(i => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />)}
                 </div>
              ) : categoryBreakdown.length === 0 ? (
                 <p className="text-center text-muted py-10 text-sm italic">Insufficient sales data</p>
              ) : (
                categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-300">{cat.name}</span>
                      <span className="font-bold text-white">{cat.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,184,0,0.3)]" 
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-right text-gray-500 font-mono">ETB {cat.revenue.toLocaleString()}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Matrix Section */}
        <Card className="bg-[#09090b] border-border overflow-hidden">
          <CardHeader className="border-b border-border">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" /> Menu Engineering Matrix
              </CardTitle>
              <div className="group relative">
                <Info className="w-5 h-5 text-muted hover:text-white cursor-help transition-colors" />
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#1a1a1a] border border-border p-4 rounded-xl shadow-2xl z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity text-xs space-y-2">
                   <p><strong className="text-green-400">Stars:</strong> High popularity & High revenue</p>
                   <p><strong className="text-yellow-400">Plowhorses:</strong> High popularity but Lower revenue</p>
                   <p><strong className="text-purple-400">Puzzles:</strong> Low popularity but High revenue</p>
                   <p><strong className="text-red-400">Dogs:</strong> Low popularity & Low revenue</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[450px] w-full relative">
              {loading ? (
                <div className="h-full flex items-center justify-center text-muted italic">Computing matrix...</div>
              ) : scatterData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted">No sales data to plot</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 40, bottom: 40, left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                      type="number" 
                      dataKey="x" 
                      name="Popularity" 
                      stroke="#71717a" 
                      label={{ value: 'Popularity (Quantity Sold)', position: 'bottom', fill: '#71717a', fontSize: 12, dy: 10 }} 
                    />
                    <YAxis 
                      type="number" 
                      dataKey="y" 
                      name="Revenue" 
                      stroke="#71717a" 
                      label={{ value: 'Revenue (ETB)', angle: -90, position: 'left', fill: '#71717a', fontSize: 12, dx: -20 }} 
                    />
                    <RechartsTooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#111] border border-border p-3 rounded-xl shadow-2xl text-xs">
                              <p className="font-bold text-white mb-2">{data.name}</p>
                              <div className="space-y-1">
                                <p className="text-gray-400">Quadrant: <span style={{ color: getQuadrantColor(data.quadrant) }} className="font-bold">{data.quadrant}</span></p>
                                <p className="text-gray-400">Total Sold: <span className="text-white">{data.x}</span></p>
                                <p className="text-gray-400">Revenue: <span className="text-primary">ETB {data.y.toLocaleString()}</span></p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter name="Items" data={scatterData}>
                      {scatterData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getQuadrantColor(entry.quadrant)} 
                          className="drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]"
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
              
              {/* Overlay Quadrant Labels */}
              {!loading && scatterData.length > 0 && (
                <div className="absolute inset-0 pointer-events-none grid grid-cols-2 grid-rows-2 p-14 opacity-20">
                   <div className="flex items-start justify-start p-4"><span className="text-xs font-bold text-purple-400 border border-purple-400/30 px-2 py-1 rounded">PUZZLES</span></div>
                   <div className="flex items-start justify-end p-4"><span className="text-xs font-bold text-green-400 border border-green-400/30 px-2 py-1 rounded">STARS</span></div>
                   <div className="flex items-end justify-start p-4"><span className="text-xs font-bold text-red-400 border border-red-400/30 px-2 py-1 rounded">DOGS</span></div>
                   <div className="flex items-end justify-end p-4"><span className="text-xs font-bold text-yellow-400 border border-yellow-400/30 px-2 py-1 rounded">PLOWHORSES</span></div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default MenuAnalytics;
