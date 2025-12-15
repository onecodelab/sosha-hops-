import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, cn, showToast } from '../components/ui';
import { 
  ClipboardList, Clock, AlertOctagon, TrendingUp, DollarSign, 
  Armchair, Utensils, Truck, CheckCircle2, AlertTriangle, ArrowRight, Loader2
} from 'lucide-react';
import { supabase } from '../supabase';

const OrdersTables: React.FC = () => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);
  
  // Analytics State
  const [kpi, setKpi] = useState({
    totalOrders: 0,
    avgValue: 0,
    cancellations: 0,
    cancellationRate: 0,
    turnover: 0
  });

  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [orderTypeData, setOrderTypeData] = useState<any[]>([]);
  const [tableStats, setTableStats] = useState<any[]>([]);
  const [staffStats, setStaffStats] = useState<any[]>([]);
  const [serviceFlow, setServiceFlow] = useState({
      toKitchen: 0,
      toReady: 0,
      toServed: 0,
      total: 0
  });

  useEffect(() => {
    fetchData();

    // Subscribe to updates
    const sub = supabase.channel('orders_tables_analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();
      
    return () => { supabase.removeChannel(sub); };
  }, [period]);

  const fetchData = async () => {
      setLoading(true);
      try {
          // 1. Determine Date Range
          const now = new Date();
          let startDate = new Date();
          
          if (period === 'today') {
              startDate.setHours(0,0,0,0);
          } else if (period === 'week') {
              startDate.setDate(now.getDate() - 7);
          } else if (period === 'month') {
              startDate.setDate(now.getDate() - 30);
          }
          const startISO = startDate.toISOString();

          // 2. Fetch Users (Client-side join preparation)
          const { data: users, error: userError } = await supabase.from('users').select('*');
          if (userError) console.error("Error fetching users:", userError);
          
          const userMap = new Map();
          users?.forEach(u => userMap.set(u.id, u));

          // 3. Fetch Orders
          const { data: orders, error } = await supabase
             .from('orders')
             .select('*')
             .gte('created_at', startISO);

          if (error) throw error;
          const safeOrders = orders || [];

          // --- Process KPI ---
          const totalOrders = safeOrders.length;
          const revenue = safeOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
          const avgValue = totalOrders > 0 ? Math.round(revenue / totalOrders) : 0;
          
          const cancelled = safeOrders.filter(o => o.status === 'cancelled').length;
          const cancellationRate = totalOrders > 0 ? ((cancelled / totalOrders) * 100).toFixed(1) : '0';

          // Turnover (Served/Paid orders: Paid At - Created At)
          const completedOrders = safeOrders.filter(o => ['served', 'completed', 'paid'].includes(o.status));
          let totalDurationMins = 0;
          let countedDuration = 0;

          completedOrders.forEach(o => {
             const start = new Date(o.created_at).getTime();
             const end = o.paid_at ? new Date(o.paid_at).getTime() : new Date(o.created_at).getTime() + (45 * 60000); 
             const diff = (end - start) / 60000;
             if (diff > 0 && diff < 300) { 
                 totalDurationMins += diff;
                 countedDuration++;
             }
          });
          const turnover = countedDuration > 0 ? Math.round(totalDurationMins / countedDuration) : 0;

          setKpi({
              totalOrders,
              avgValue,
              cancellations: cancelled,
              cancellationRate: Number(cancellationRate),
              turnover
          });

          // --- Process Hourly ---
          const hoursMap = new Array(24).fill(0);
          safeOrders.forEach(o => {
              const h = new Date(o.created_at).getHours();
              hoursMap[h]++;
          });
          
          const hData = hoursMap.map((count, i) => {
              const ampm = i >= 12 ? 'pm' : 'am';
              const hour12 = i % 12 || 12;
              return { time: `${hour12}${ampm}`, orders: count, hour24: i };
          }).filter(d => d.hour24 >= 8 && d.hour24 <= 22);

          setHourlyData(hData);

          // --- Process Order Type ---
          const typeCount: Record<string, number> = { 'Dine-in': 0, 'Delivery': 0, 'Takeaway': 0 };
          safeOrders.forEach(o => {
              const type = o.order_type ? 
                  (o.order_type.charAt(0).toUpperCase() + o.order_type.slice(1)) : 
                  'Dine-in';
              if (typeCount[type] !== undefined) typeCount[type]++;
              else typeCount['Dine-in']++;
          });

          const oTypeData = Object.entries(typeCount).map(([name, value]) => ({
             name, 
             value,
             color: name === 'Dine-in' ? '#FFB800' : name === 'Delivery' ? '#84CC16' : '#3B82F6'
          })).filter(d => d.value > 0);
          setOrderTypeData(oTypeData);

          // --- Process Table Stats ---
          const tableMap: Record<string, { turns: number, rev: number, duration: number, count: number }> = {};
          
          safeOrders.forEach(o => {
              if (!o.table_number) return;
              const t = o.table_number;
              if (!tableMap[t]) tableMap[t] = { turns: 0, rev: 0, duration: 0, count: 0 };
              
              tableMap[t].turns++;
              tableMap[t].rev += (o.total_amount || 0);

              if (['served', 'completed', 'paid'].includes(o.status)) {
                  const start = new Date(o.created_at).getTime();
                  const end = o.paid_at ? new Date(o.paid_at).getTime() : new Date().getTime(); 
                  const dur = (end - start) / 60000;
                  if (dur > 0) {
                      tableMap[t].duration += dur;
                      tableMap[t].count++;
                  }
              }
          });

          const tStats = Object.entries(tableMap).map(([id, data]) => ({
              id,
              usage: data.turns,
              revenue: data.rev,
              avgTurnover: data.count > 0 ? `${Math.round(data.duration / data.count)}m` : '-'
          })).sort((a,b) => b.revenue - a.revenue).slice(0, 10);
          
          setTableStats(tStats);

          // --- Process Staff Stats ---
          const staffMap: Record<string, { name: string, role: string, orders: number, cancelled: number, speedTotal: number, speedCount: number }> = {};

          safeOrders.forEach(o => {
              const uid = o.waiter_id;
              if (!uid) return;
              
              const u = userMap.get(uid);

              if (!staffMap[uid]) staffMap[uid] = { name: u?.full_name || 'Unknown', role: u?.role || 'Staff', orders: 0, cancelled: 0, speedTotal: 0, speedCount: 0 };
              
              staffMap[uid].orders++;
              if (o.status === 'cancelled') staffMap[uid].cancelled++;
              
              if (o.status === 'served' || o.status === 'paid' || o.status === 'completed') {
                   const sTime = o.served_at ? new Date(o.served_at).getTime() : 0;
                   const cTime = new Date(o.created_at).getTime();
                   if (sTime > cTime) {
                       staffMap[uid].speedTotal += (sTime - cTime) / 60000;
                       staffMap[uid].speedCount++;
                   }
              }
          });

          const sStats = Object.values(staffMap).map(s => ({
              name: s.name,
              role: s.role,
              orders: s.orders,
              errors: s.cancelled,
              speed: s.speedCount > 0 ? `${Math.round(s.speedTotal / s.speedCount)}m` : '-' 
          })).sort((a,b) => b.orders - a.orders);

          setStaffStats(sStats);

          // --- Process Flow ---
          let flowCounts = { k: 0, r: 0, s: 0 };
          let flowSums = { k: 0, r: 0, s: 0 };

          safeOrders.forEach(o => {
               const created = new Date(o.created_at).getTime();
               if (o.accepted_at) { // Was kitchen_accepted_at
                   flowSums.k += (new Date(o.accepted_at).getTime() - created) / 60000;
                   flowCounts.k++;
                   if (o.ready_at) {
                       flowSums.r += (new Date(o.ready_at).getTime() - new Date(o.accepted_at).getTime()) / 60000;
                       flowCounts.r++;
                       if (o.served_at) {
                           flowSums.s += (new Date(o.served_at).getTime() - new Date(o.ready_at).getTime()) / 60000;
                           flowCounts.s++;
                       }
                   }
               }
          });

          const tk = flowCounts.k > 0 ? Math.round(flowSums.k / flowCounts.k) : 2;
          const tr = flowCounts.r > 0 ? Math.round(flowSums.r / flowCounts.r) : 15;
          const ts = flowCounts.s > 0 ? Math.round(flowSums.s / flowCounts.s) : 3;

          setServiceFlow({
              toKitchen: tk,
              toReady: tr,
              toServed: ts,
              total: tk + tr + ts
          });


      } catch (err) {
          console.error("Orders Analytics Error:", err);
          showToast("Failed to load analytics data", "error");
      } finally {
          setLoading(false);
      }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">Orders & Tables</h1>
              <p className="text-gray-400 text-sm">Throughput analysis and service efficiency</p>
            </div>
            {loading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          </div>
          
          <div className="flex bg-[#1A1A1A] p-1 rounded-lg border border-gray-800">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-md capitalize transition-all",
                  period === p 
                    ? "bg-primary text-black shadow-md" 
                    : "text-gray-400 hover:text-white"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Orders</p>
                   <h3 className="text-2xl font-bold text-white mt-1">{kpi.totalOrders}</h3>
                   <div className="text-xs text-[#84CC16] font-bold mt-1 flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1" /> Volume
                   </div>
                </div>
                <div className="p-2 bg-primary/10 rounded-full">
                   <ClipboardList className="w-5 h-5 text-primary" />
                </div>
             </CardContent>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Avg Order Value</p>
                   <h3 className="text-2xl font-bold text-white mt-1">ETB {kpi.avgValue}</h3>
                   <div className="text-xs text-[#84CC16] font-bold mt-1 flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1" /> Per Ticket
                   </div>
                </div>
                <div className="p-2 bg-green-500/10 rounded-full">
                   <DollarSign className="w-5 h-5 text-green-500" />
                </div>
             </CardContent>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Cancellations</p>
                   <h3 className="text-2xl font-bold text-white mt-1">{kpi.cancellationRate}% <span className="text-sm font-normal text-gray-500">({kpi.cancellations})</span></h3>
                   <div className={cn("text-xs font-bold mt-1 flex items-center", kpi.cancellations > 5 ? "text-red-500" : "text-gray-500")}>
                      <AlertOctagon className="w-3 h-3 mr-1" /> {kpi.cancellations > 5 ? 'High Rate' : 'Normal'}
                   </div>
                </div>
                <div className="p-2 bg-red-500/10 rounded-full">
                   <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
             </CardContent>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Table Turnover</p>
                   <h3 className="text-2xl font-bold text-white mt-1">{kpi.turnover > 0 ? kpi.turnover + ' min' : '-'}</h3>
                   <div className="text-xs text-blue-400 font-bold mt-1 flex items-center">
                      <Clock className="w-3 h-3 mr-1" /> Cycle Time
                   </div>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-full">
                   <Armchair className="w-5 h-5 text-blue-500" />
                </div>
             </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* Hourly Volume */}
           <Card className="lg:col-span-2 bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white">Order Volume by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="h-[300px] w-full">
                    {hourlyData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500">No hourly data available</div>
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={hourlyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                          <XAxis dataKey="time" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                             cursor={{fill: 'rgba(255,255,255,0.05)'}}
                             contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#fff' }}
                          />
                          <Bar dataKey="orders" fill="#FFB800" radius={[4, 4, 0, 0]} maxBarSize={40} />
                       </BarChart>
                    </ResponsiveContainer>
                    )}
                 </div>
              </CardContent>
           </Card>

           {/* Order Type Split */}
           <Card className="bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white">Source Split</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center">
                 <div className="h-[200px] w-full relative">
                    {orderTypeData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500">No data</div>
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                             data={orderTypeData}
                             innerRadius={60}
                             outerRadius={80}
                             paddingAngle={5}
                             dataKey="value"
                             stroke="none"
                          >
                             {orderTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                             ))}
                          </Pie>
                          <Tooltip 
                             contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '8px' }}
                             itemStyle={{ color: '#fff' }}
                          />
                       </PieChart>
                    </ResponsiveContainer>
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-3xl font-bold text-white">{kpi.totalOrders}</span>
                       <span className="text-xs text-gray-500 uppercase">Total Orders</span>
                    </div>
                 </div>
                 <div className="w-full space-y-3 mt-4">
                    {orderTypeData.map((type) => (
                       <div key={type.name} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                             <span className="text-gray-300">{type.name}</span>
                          </div>
                          <span className="font-bold text-white">{type.value}</span>
                       </div>
                    ))}
                    {orderTypeData.length === 0 && <p className="text-center text-gray-500 text-sm">No orders yet</p>}
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Order Flow Timeline */}
        <Card className="bg-[#1A1A1A] border-gray-800">
           <CardHeader>
              <CardTitle className="text-white">Average Service Flow</CardTitle>
           </CardHeader>
           <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 
                 {/* Step 1 */}
                 <div className="relative p-4 bg-black/20 rounded-xl border border-gray-800 flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
                       <ClipboardList className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-sm font-bold text-white">Placed</p>
                    <p className="text-xs text-gray-500 mt-1">Start</p>
                    
                    <div className="hidden md:flex absolute top-1/2 -right-5 w-6 h-6 z-10 items-center justify-center bg-gray-800 rounded-full border border-gray-700">
                       <ArrowRight className="w-3 h-3 text-gray-400" />
                    </div>
                 </div>

                 {/* Step 2 */}
                 <div className="relative p-4 bg-black/20 rounded-xl border border-gray-800 flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
                       <CheckCircle2 className="w-5 h-5 text-purple-500" />
                    </div>
                    <p className="text-sm font-bold text-white">Kitchen Accept</p>
                    <p className="text-xs text-primary font-bold mt-1">{serviceFlow.toKitchen}m avg</p>
                    
                    <div className="hidden md:flex absolute top-1/2 -right-5 w-6 h-6 z-10 items-center justify-center bg-gray-800 rounded-full border border-gray-700">
                       <ArrowRight className="w-3 h-3 text-gray-400" />
                    </div>
                 </div>

                 {/* Step 3 */}
                 <div className="relative p-4 bg-black/20 rounded-xl border border-gray-800 flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-3">
                       <Utensils className="w-5 h-5 text-orange-500" />
                    </div>
                    <p className="text-sm font-bold text-white">Ready</p>
                    <p className="text-xs text-primary font-bold mt-1">{serviceFlow.toReady}m avg</p>
                    
                    <div className="hidden md:flex absolute top-1/2 -right-5 w-6 h-6 z-10 items-center justify-center bg-gray-800 rounded-full border border-gray-700">
                       <ArrowRight className="w-3 h-3 text-gray-400" />
                    </div>
                 </div>

                 {/* Step 4 */}
                 <div className="relative p-4 bg-black/20 rounded-xl border border-gray-800 flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                       <Truck className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-sm font-bold text-white">Served</p>
                    <p className="text-xs text-primary font-bold mt-1">{serviceFlow.toServed}m avg</p>
                 </div>

              </div>
              <div className="mt-4 text-center text-xs text-gray-500">
                 Total Cycle Time: <span className="text-white font-bold">{serviceFlow.total} min</span>
                 <span className="ml-2 italic text-gray-600">(Note: Requires Kitchen Display usage for accuracy)</span>
              </div>
           </CardContent>
        </Card>

        {/* Bottom Section: Tables & Staff */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           
           {/* Table Stats */}
           <Card className="bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white flex items-center gap-2">
                    <Armchair className="w-5 h-5 text-gray-400" /> Table Analytics
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="overflow-x-auto max-h-[300px]">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800 sticky top-0 backdrop-blur-sm z-10">
                       <tr>
                          <th className="px-6 py-3">Table</th>
                          <th className="px-6 py-3">Turns</th>
                          <th className="px-6 py-3">Avg Time</th>
                          <th className="px-6 py-3 text-right">Revenue</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                       {tableStats.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">No table data</td></tr>}
                       {tableStats.map((table) => (
                          <tr key={table.id} className="hover:bg-white/5 transition-colors">
                             <td className="px-6 py-3 font-bold text-white">{table.id}</td>
                             <td className="px-6 py-3 text-gray-300">
                                {table.usage} <span className="text-xs text-gray-500">sessions</span>
                             </td>
                             <td className="px-6 py-3 text-gray-300">{table.avgTurnover}</td>
                             <td className="px-6 py-3 text-right font-mono text-primary">ETB {table.revenue.toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
                 </div>
              </CardContent>
           </Card>

           {/* Staff Performance Context */}
           <Card className="bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" /> Service Quality
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="overflow-x-auto max-h-[300px]">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800 sticky top-0 backdrop-blur-sm z-10">
                       <tr>
                          <th className="px-6 py-3">Waiter</th>
                          <th className="px-6 py-3">Volume</th>
                          <th className="px-6 py-3">Avg Speed</th>
                          <th className="px-6 py-3 text-right">Errors</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                       {staffStats.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">No staff activity</td></tr>}
                       {staffStats.map((staff) => (
                          <tr key={staff.name} className="hover:bg-white/5 transition-colors">
                             <td className="px-6 py-3 font-medium text-white">
                                {staff.name}
                                <div className="text-xs text-gray-500">{staff.role}</div>
                             </td>
                             <td className="px-6 py-3 text-gray-300">{staff.orders}</td>
                             <td className="px-6 py-3 text-gray-300">{staff.speed}</td>
                             <td className="px-6 py-3 text-right">
                                {staff.errors === 0 ? (
                                   <span className="text-green-500 text-xs font-bold">Perfect</span>
                                ) : (
                                   <span className="text-red-400 text-xs font-bold">{staff.errors} Issues</span>
                                )}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
                 </div>
              </CardContent>
           </Card>

        </div>

      </div>
    </DashboardLayout>
  );
};

export default OrdersTables;