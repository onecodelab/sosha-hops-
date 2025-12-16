
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { useMenu } from '../hooks/useMenu';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, Badge, cn } from '../components/ui';
import { ArrowUpRight, ArrowDownRight, TrendingUp, AlertOctagon, DollarSign, Clock } from 'lucide-react';

interface MenuStat {
  id: string;
  name: string;
  category: string;
  orders: number;
  revenue: number;
  margin: number;
  matrixType: 'Star' | 'Dog' | 'Puzzle' | 'Plow Horse';
}

const MenuAnalytics: React.FC = () => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const { menuItems, loading: menuLoading } = useMenu(false); // Fetch all to check availability
  const [analyticsData, setAnalyticsData] = useState<MenuStat[]>([]);
  const [hourlyData, setHourlyData] = useState<{hour: string, value: number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (menuItems.length > 0) {
      calculateAnalytics();
    }
  }, [menuItems, period]);

  const calculateAnalytics = async () => {
    setLoading(true);

    try {
      // 1. Determine Date Range
      const now = new Date();
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0); // Default to start of today

      if (period === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (period === 'month') {
        startDate.setDate(now.getDate() - 30);
      }

      const startDateISO = startDate.toISOString();

      // 2. Fetch Order Items (Top Performers Logic)
      // Join order_items with orders to filter by status and date
      const { data: orderItems, error: oiError } = await supabase
        .from('order_items')
        .select(`
          menu_item_id,
          quantity,
          price_at_time,
          orders!inner (
            status,
            created_at
          )
        `)
        .gte('orders.created_at', startDateISO)
        .neq('orders.status', 'cancelled');

      if (oiError) throw oiError;

      // 3. Client-side Aggregation
      const itemMap = new Map<string, { count: number; rev: number }>();

      orderItems?.forEach((item: any) => {
        const id = item.menu_item_id;
        const current = itemMap.get(id) || { count: 0, rev: 0 };
        itemMap.set(id, {
          count: current.count + item.quantity,
          rev: current.rev + (item.price_at_time * item.quantity)
        });
      });

      const stats: MenuStat[] = menuItems.map(menu => {
        const data = itemMap.get(menu.id) || { count: 0, rev: 0 };
        
        // Mock Margin % for Matrix visualization (randomized slightly around 60% for demo purposes 
        // since exact cost isn't in DB yet)
        const estimatedMarginPct = 40 + Math.floor(Math.random() * 40); 

        return {
          id: menu.id,
          name: menu.name,
          category: menu.category,
          orders: data.count,
          revenue: data.rev,
          margin: estimatedMarginPct,
          matrixType: 'Dog' // Placeholder
        };
      });

      // 4. Matrix Classification
      // Calculate averages to define quadrants
      const activeStats = stats.filter(s => s.orders > 0); // Only analyze sold items for averages
      const avgOrders = activeStats.reduce((acc, s) => acc + s.orders, 0) / (activeStats.length || 1);
      const avgRev = activeStats.reduce((acc, s) => acc + s.revenue, 0) / (activeStats.length || 1);

      const classifiedStats = stats.map(s => {
        let type: any = 'Dog';
        if (s.orders === 0) type = 'Dog';
        else if (s.orders >= avgOrders && s.revenue >= avgRev) type = 'Star';
        else if (s.orders >= avgOrders && s.revenue < avgRev) type = 'Plow Horse';
        else if (s.orders < avgOrders && s.revenue >= avgRev) type = 'Puzzle';
        
        return { ...s, matrixType: type };
      });

      setAnalyticsData(classifiedStats.sort((a, b) => b.revenue - a.revenue));

      // 5. Hourly Intensity Chart (Always for Today as requested)
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      
      const { data: todayOrders, error: ordersError } = await supabase
        .from('orders')
        .select('created_at')
        .gte('created_at', todayStart.toISOString())
        .neq('status', 'cancelled');

      if (ordersError) throw ordersError;

      const hoursMap = new Array(24).fill(0);
      todayOrders?.forEach((o: any) => {
        const h = new Date(o.created_at).getHours();
        hoursMap[h]++;
      });

      // Format for Chart (showing 8 AM to 11 PM)
      const chartData = hoursMap.map((count, hour) => ({
        hour: `${hour}:00`,
        value: count
      })).slice(8, 23); 

      setHourlyData(chartData);

    } catch (err) {
      console.error("Analytics Calculation Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const topSellingItems = analyticsData.filter(i => i.orders > 0).slice(0, 10);
  
  // Real Out of Stock Logic: Checks unavailable flag OR zero stock
  const outOfStockItems = menuItems.filter(i => !i.is_available || (i.stock_quantity !== undefined && i.stock_quantity <= 0));

  // Matrix Data: x = Orders (Popularity), y = Revenue (Profitability Proxy)
  const matrixData = analyticsData.filter(s => s.orders > 0).map(s => ({
    name: s.name,
    x: s.orders,
    y: s.revenue,
    type: s.matrixType
  }));

  const getIntensityColor = (value: number) => {
    // Dynamic coloring based on max value in the set could be better, but using static thresholds for now
    if (value >= 5) return 'bg-[#84CC16]'; // High
    if (value >= 3) return 'bg-[#84CC16]/70';
    if (value >= 1) return 'bg-[#FFB800]'; // Med
    if (value > 0) return 'bg-[#FFB800]/50';
    return 'bg-gray-800'; // Zero
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header & Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Menu Analytics</h1>
            <p className="text-muted text-sm">Real-time profitability and popularity insights</p>
          </div>
          
          <div className="flex bg-card p-1 rounded-lg border border-border">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-md capitalize transition-all",
                  period === p 
                    ? "bg-primary text-black shadow-md" 
                    : "text-muted hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Top Section: Tables & Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Top Selling Items Table */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">Top Performers</CardTitle>
              <Badge variant="success" className="bg-[#84CC16]/10 text-[#84CC16] border-[#84CC16]/20">
                <TrendingUp className="w-3 h-3 mr-1" /> Revenue Leaders
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[300px] custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted uppercase bg-black/20 border-b border-border sticky top-0 backdrop-blur-sm z-10">
                    <tr>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Orders</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">Est. Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading && <tr><td colSpan={5} className="p-4 text-center">Loading...</td></tr>}
                    {!loading && topSellingItems.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted">No sales data for this period.</td></tr>}
                    {topSellingItems.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                        <td className="px-4 py-3 text-muted">{item.category}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{item.orders}</td>
                        <td className="px-4 py-3 text-right font-mono text-primary">ETB {item.revenue.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            "px-2 py-1 rounded text-xs font-bold",
                            item.margin > 60 ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                          )}>
                            {item.margin}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Out of Stock / Lost Revenue */}
          <div className="space-y-6">
             <Card className="border-l-4 border-l-red-500">
                <CardHeader>
                   <CardTitle className="text-foreground flex items-center gap-2">
                      <AlertOctagon className="w-5 h-5 text-red-500" /> Out of Stock
                   </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[220px] overflow-y-auto custom-scrollbar">
                   {outOfStockItems.map(item => (
                      <div key={item.id} className="p-3 bg-red-500/5 rounded-lg border border-red-500/10">
                         <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-foreground">{item.name}</span>
                            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">Unavailable</span>
                         </div>
                         <div className="flex justify-between text-xs text-muted">
                            <span>Category:</span>
                            <span>{item.category}</span>
                         </div>
                      </div>
                   ))}
                   {outOfStockItems.length === 0 && <p className="text-muted text-sm">All items available.</p>}
                </CardContent>
             </Card>

             {/* Matrix Highlights */}
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between">
                   <div className="text-xs text-muted uppercase font-bold tracking-wider mb-2">Top Star</div>
                   <div className="text-sm font-bold text-[#84CC16] line-clamp-2">
                      {analyticsData.find(i => i.matrixType === 'Star')?.name || 'N/A'}
                   </div>
                   <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3 text-[#84CC16]" /> High Rev/Vol
                   </div>
                </div>
                <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between">
                   <div className="text-xs text-muted uppercase font-bold tracking-wider mb-2">Underperforming</div>
                   <div className="text-sm font-bold text-red-400 line-clamp-2">
                      {analyticsData.filter(i => i.orders > 0 && i.matrixType === 'Dog')[0]?.name || 'N/A'}
                   </div>
                   <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <ArrowDownRight className="w-3 h-3 text-red-400" /> Low Rev/Vol
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Middle Section: Matrix & Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Profit vs Popularity Matrix */}
          <Card className="lg:col-span-2">
             <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                   <DollarSign className="w-5 h-5 text-primary" /> Menu Engineering Matrix
                </CardTitle>
             </CardHeader>
             <CardContent>
                <div className="h-[300px] w-full relative">
                   {analyticsData.filter(i => i.orders > 0).length === 0 ? (
                      <div className="h-full flex items-center justify-center text-muted">Need more sales data to build matrix</div>
                   ) : (
                   <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                         <XAxis type="number" dataKey="x" name="Orders" stroke="#666" label={{ value: 'Popularity (Orders)', position: 'bottom', fill: '#666', fontSize: 12 }} />
                         <YAxis type="number" dataKey="y" name="Revenue" stroke="#666" label={{ value: 'Revenue (ETB)', angle: -90, position: 'left', fill: '#666', fontSize: 12 }} />
                         <RechartsTooltip 
                            cursor={{ strokeDasharray: '3 3' }} 
                            content={({ active, payload }) => {
                               if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                     <div className="bg-card border border-border p-2 rounded shadow-xl text-xs z-50">
                                        <p className="font-bold text-white mb-1">{data.name}</p>
                                        <p className="text-gray-400">Type: <span className="text-primary">{data.type}</span></p>
                                        <p className="text-gray-400">Orders: {data.x}</p>
                                        <p className="text-gray-400">Rev: ETB {data.y.toLocaleString()}</p>
                                     </div>
                                  );
                               }
                               return null;
                            }}
                         />
                         
                         {/* Legend Text */}
                         <text x="90%" y="10%" textAnchor="end" fill="#84CC16" fontSize="10" fontWeight="bold">STARS (High/High)</text>
                         <text x="90%" y="90%" textAnchor="end" fill="#FFB800" fontSize="10" fontWeight="bold">PLOW HORSES (High Vol/Low Rev)</text>
                         <text x="10%" y="10%" textAnchor="start" fill="#A855F7" fontSize="10" fontWeight="bold">PUZZLES (Low Vol/High Rev)</text>
                         <text x="10%" y="90%" textAnchor="start" fill="#EF4444" fontSize="10" fontWeight="bold">DOGS (Low/Low)</text>

                         <Scatter name="Items" data={matrixData} fill="#FFB800">
                            {matrixData.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={
                                  entry.type === 'Star' ? '#84CC16' : 
                                  entry.type === 'Dog' ? '#EF4444' : 
                                  entry.type === 'Puzzle' ? '#A855F7' : '#FFB800'
                               } />
                            ))}
                         </Scatter>
                      </ScatterChart>
                   </ResponsiveContainer>
                   )}
                </div>
             </CardContent>
          </Card>

          {/* Hourly Heatmap */}
          <Card>
             <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                   <Clock className="w-5 h-5 text-blue-400" /> Today's Intensity
                </CardTitle>
             </CardHeader>
             <CardContent>
                <div className="flex flex-col gap-2 h-full justify-center pb-4">
                   {hourlyData.length === 0 && (
                      <div className="text-center text-muted py-10">No orders today yet</div>
                   )}
                   {hourlyData.map((slot) => (
                      <div key={slot.hour} className="flex items-center gap-3 group">
                         <span className="text-xs font-mono text-muted w-12 text-right">
                            {slot.hour}
                         </span>
                         <div className="flex-1 h-6 bg-black/20 rounded-md overflow-hidden relative">
                            <div 
                               className={cn("h-full transition-all duration-500", getIntensityColor(slot.value))} 
                               style={{ width: `${Math.min(100, (slot.value / 10) * 100)}%` }} // Normalize for bar width
                            />
                            <div className="absolute inset-0 flex items-center px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-[10px] font-bold text-black drop-shadow-sm">{slot.value} Sales</span>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </CardContent>
          </Card>

        </div>

      </div>
    </DashboardLayout>
  );
};

export default MenuAnalytics;
