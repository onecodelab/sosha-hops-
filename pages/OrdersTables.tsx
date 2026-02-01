
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import {
   BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
   PieChart, Pie, Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, cn, showToast, Badge } from '../components/ui';
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
            startDate.setHours(0, 0, 0, 0);
         } else if (period === 'week') {
            startDate.setDate(now.getDate() - 7);
         } else if (period === 'month') {
            startDate.setDate(now.getDate() - 30);
         }
         const startISO = startDate.toISOString();

         // 2. Fetch Users from Profiles
         const { data: profiles, error: userError } = await supabase.from('profiles').select('*');
         if (userError) console.error("Error fetching staff profiles:", userError);

         const profileMap = new Map();
         profiles?.forEach(u => profileMap.set(u.id, u));

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
         const completedOrders = safeOrders.filter(o => ['served', 'closed', 'paid'].includes(o.status));
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

            if (['served', 'closed', 'paid'].includes(o.status)) {
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
         })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

         setTableStats(tStats);

         // --- Process Staff Stats ---
         const staffMap: Record<string, { name: string, role: string, orders: number, cancelled: number, speedTotal: number, speedCount: number }> = {};

         safeOrders.forEach(o => {
            const uid = o.waiter_id;
            if (!uid) return;

            const u = profileMap.get(uid);

            if (!staffMap[uid]) staffMap[uid] = { name: u?.full_name || 'Unknown', role: u?.role || 'Staff', orders: 0, cancelled: 0, speedTotal: 0, speedCount: 0 };

            staffMap[uid].orders++;
            if (o.status === 'cancelled') staffMap[uid].cancelled++;

            if (o.status === 'served' || o.status === 'paid' || o.status === 'closed') {
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
         })).sort((a, b) => b.orders - a.orders);

         setStaffStats(sStats);

         // --- Process Flow ---
         let flowCounts = { k: 0, r: 0, s: 0 };
         let flowSums = { k: 0, r: 0, s: 0 };

         safeOrders.forEach(o => {
            const created = new Date(o.created_at).getTime();
            if (o.accepted_at) {
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
      <DashboardLayout title="Orders & Tables" subtitle="Throughput analysis and service efficiency">
         <div className="space-y-8 animate-in fade-in duration-700">

            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
               <div className="flex bg-muted/10 p-1.5 rounded-[1.5rem] border border-border backdrop-blur-md">
                  {(['today', 'week', 'month'] as const).map((p) => (
                     <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={cn(
                           "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-[1.1rem] transition-all",
                           period === p
                              ? "bg-primary text-black shadow-lg shadow-primary/20"
                              : "text-muted hover:text-foreground hover:bg-muted/10 opacity-60 hover:opacity-100"
                        )}
                     >
                        {p}
                     </button>
                  ))}
               </div>
               {loading && (
                  <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
                     <Loader2 className="w-4 h-4 animate-spin text-primary" />
                     <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Syncing Nodes...</span>
                  </div>
               )}
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <Card className="bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] shadow-xl overflow-hidden group">
                  <div className="p-6 flex justify-between items-start relative">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                     <div className="relative z-10">
                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-60">Total Orders</p>
                        <h3 className="text-3xl font-black text-foreground mt-2 tracking-tighter">{kpi.totalOrders}</h3>
                        <div className="text-[10px] text-emerald-500 font-black mt-2 flex items-center gap-1 uppercase tracking-widest">
                           <TrendingUp className="w-3 h-3" strokeWidth={3} /> High_Activity
                        </div>
                     </div>
                     <div className="p-4 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform duration-500 shadow-inner">
                        <ClipboardList className="w-6 h-6 text-primary" strokeWidth={3} />
                     </div>
                  </div>
               </Card>

               <Card className="bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] shadow-xl overflow-hidden group">
                  <div className="p-6 flex justify-between items-start relative">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                     <div className="relative z-10">
                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-60">Avg Order Value</p>
                        <h3 className="text-3xl font-black text-foreground mt-2 tracking-tighter">
                           <span className="text-sm mr-1 opacity-40">ETB</span>
                           {kpi.avgValue}
                        </h3>
                        <div className="text-[10px] text-emerald-500 font-black mt-2 flex items-center gap-1 uppercase tracking-widest">
                           <TrendingUp className="w-3 h-3" strokeWidth={3} /> Per Ticket
                        </div>
                     </div>
                     <div className="p-4 bg-emerald-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-500 shadow-inner">
                        <DollarSign className="w-6 h-6 text-emerald-500" strokeWidth={3} />
                     </div>
                  </div>
               </Card>

               <Card className="bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] shadow-xl overflow-hidden group">
                  <div className="p-6 flex justify-between items-start relative">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                     <div className="relative z-10">
                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-60">Cancellations</p>
                        <h3 className="text-3xl font-black text-foreground mt-2 tracking-tighter">
                           {kpi.cancellationRate}%
                           <span className="text-sm font-black text-muted/40 ml-2">({kpi.cancellations})</span>
                        </h3>
                        <div className={cn(
                           "text-[10px] font-black mt-2 flex items-center gap-1 uppercase tracking-widest",
                           kpi.cancellations > 5 ? "text-red-500" : "text-muted opacity-40"
                        )}>
                           <AlertOctagon className="w-3 h-3" strokeWidth={3} /> {kpi.cancellations > 5 ? 'High Rate' : 'Stable'}
                        </div>
                     </div>
                     <div className="p-4 bg-red-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-500 shadow-inner">
                        <AlertTriangle className="w-6 h-6 text-red-500" strokeWidth={3} />
                     </div>
                  </div>
               </Card>

               <Card className="bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] shadow-xl overflow-hidden group">
                  <div className="p-6 flex justify-between items-start relative">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                     <div className="relative z-10">
                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-60">Table Turnover</p>
                        <h3 className="text-3xl font-black text-foreground mt-2 tracking-tighter">{kpi.turnover > 0 ? kpi.turnover + ' MIN' : 'N/A'}</h3>
                        <div className="text-[10px] text-blue-500 font-black mt-2 flex items-center gap-1 uppercase tracking-widest">
                           <Clock className="w-3 h-3" strokeWidth={3} /> Cycle Time
                        </div>
                     </div>
                     <div className="p-4 bg-blue-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-500 shadow-inner">
                        <Armchair className="w-6 h-6 text-blue-500" strokeWidth={3} />
                     </div>
                  </div>
               </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

               {/* Hourly Volume */}
               <Card className="lg:col-span-2 bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] shadow-2xl overflow-hidden">
                  <CardHeader className="p-8 border-b border-border bg-muted/5">
                     <CardTitle className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-3">
                        <TrendingUp className="w-4 h-4 text-primary" strokeWidth={3} /> Hourly Load Distribution
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                     <div className="h-[350px] w-full">
                        {hourlyData.length === 0 ? (
                           <div className="h-full flex items-center justify-center text-muted uppercase font-black text-[10px] tracking-widest opacity-40">Zero Data Point Signal</div>
                        ) : (
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={hourlyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                 <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
                                       <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.3} />
                                    </linearGradient>
                                 </defs>
                                 <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-5" vertical={false} />
                                 <XAxis dataKey="time" stroke="currentColor" className="opacity-40" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                                 <YAxis stroke="currentColor" className="opacity-40" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                                 <Tooltip
                                    cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                                    contentStyle={{
                                       backgroundColor: 'var(--card)',
                                       border: '1px solid var(--border)',
                                       borderRadius: '1.25rem',
                                       boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                                       backdropFilter: 'blur(16px)',
                                       padding: '12px'
                                    }}
                                    itemStyle={{ color: 'var(--foreground)', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase' }}
                                    labelStyle={{ display: 'none' }}
                                 />
                                 <Bar dataKey="orders" fill="url(#barGradient)" radius={[8, 8, 4, 4]} maxBarSize={32} />
                              </BarChart>
                           </ResponsiveContainer>
                        )}
                     </div>
                  </CardContent>
               </Card>

               {/* Order Type Split */}
               <Card className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] shadow-2xl overflow-hidden">
                  <CardHeader className="p-8 border-b border-border bg-muted/5">
                     <CardTitle className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-3">
                        <Utensils className="w-4 h-4 text-primary" strokeWidth={3} /> Channel Fragmentation
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 flex flex-col items-center justify-center min-h-[400px]">
                     <div className="h-[250px] w-full relative">
                        {orderTypeData.length === 0 ? (
                           <div className="h-full flex items-center justify-center text-muted uppercase font-black text-[10px] tracking-widest opacity-40">Empty_Set</div>
                        ) : (
                           <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                 <Pie
                                    data={orderTypeData}
                                    innerRadius={70}
                                    outerRadius={95}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                 >
                                    {orderTypeData.map((entry, index) => (
                                       <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                 </Pie>
                                 <Tooltip
                                    contentStyle={{
                                       backgroundColor: 'var(--card)',
                                       border: '1px solid var(--border)',
                                       borderRadius: '1.25rem',
                                       backdropFilter: 'blur(16px)',
                                       boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
                                    }}
                                    itemStyle={{ color: 'var(--foreground)', fontWeight: '900', fontSize: '10px', textTransform: 'uppercase' }}
                                 />
                              </PieChart>
                           </ResponsiveContainer>
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                           <span className="text-4xl font-black text-foreground italic tracking-tighter">{kpi.totalOrders}</span>
                           <span className="text-[9px] text-muted font-black uppercase tracking-widest opacity-40">AGGREGATE_VOL</span>
                        </div>
                     </div>
                     <div className="w-full space-y-4 mt-8">
                        {orderTypeData.map((type) => (
                           <div key={type.name} className="flex justify-between items-center group">
                              <div className="flex items-center gap-3">
                                 <div className="w-2.5 h-2.5 rounded-full shadow-lg" style={{ backgroundColor: type.color }} />
                                 <span className="text-[10px] font-black text-muted uppercase tracking-widest group-hover:text-foreground transition-colors">{type.name}</span>
                              </div>
                              <span className="font-mono font-black text-foreground text-sm">{type.value}</span>
                           </div>
                        ))}
                     </div>
                  </CardContent>
               </Card>
            </div>

            {/* Order Flow Timeline */}
            <Card className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] shadow-2xl overflow-hidden">
               <CardHeader className="p-8 border-b border-border bg-muted/5">
                  <CardTitle className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-3">
                     <Clock className="w-4 h-4 text-primary" strokeWidth={3} /> Node Latency & Internal Service Flow
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-10">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

                     {/* Step 1 */}
                     <div className="relative p-8 bg-muted/5 rounded-3xl border border-border flex flex-col items-center text-center group hover:bg-muted/10 transition-colors">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform">
                           <ClipboardList className="w-6 h-6 text-primary" strokeWidth={3} />
                        </div>
                        <p className="text-[11px] font-black text-foreground uppercase italic tracking-tighter">Order_Origin</p>
                        <p className="text-[9px] text-muted font-black uppercase tracking-widest mt-1 opacity-40">Node_Start</p>

                        <div className="hidden md:flex absolute top-1/2 -right-8 w-8 h-8 z-10 items-center justify-center bg-card rounded-full border border-border shadow-lg">
                           <ArrowRight className="w-4 h-4 text-primary" strokeWidth={3} />
                        </div>
                     </div>

                     {/* Step 2 */}
                     <div className="relative p-8 bg-muted/5 rounded-3xl border border-border flex flex-col items-center text-center group hover:bg-muted/10 transition-colors">
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform">
                           <CheckCircle2 className="w-6 h-6 text-purple-500" strokeWidth={3} />
                        </div>
                        <p className="text-[11px] font-black text-foreground uppercase italic tracking-tighter">Kitchen_Sync</p>
                        <p className="text-[10px] text-primary font-black mt-1 font-mono">{serviceFlow.toKitchen} MIN</p>

                        <div className="hidden md:flex absolute top-1/2 -right-8 w-8 h-8 z-10 items-center justify-center bg-card rounded-full border border-border shadow-lg">
                           <ArrowRight className="w-4 h-4 text-primary" strokeWidth={3} />
                        </div>
                     </div>

                     {/* Step 3 */}
                     <div className="relative p-8 bg-muted/5 rounded-3xl border border-border flex flex-col items-center text-center group hover:bg-muted/10 transition-colors">
                        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform">
                           <Utensils className="w-6 h-6 text-orange-500" strokeWidth={3} />
                        </div>
                        <p className="text-[11px] font-black text-foreground uppercase italic tracking-tighter">Production_Ready</p>
                        <p className="text-[10px] text-primary font-black mt-1 font-mono">{serviceFlow.toReady} MIN</p>

                        <div className="hidden md:flex absolute top-1/2 -right-8 w-8 h-8 z-10 items-center justify-center bg-card rounded-full border border-border shadow-lg">
                           <ArrowRight className="w-4 h-4 text-primary" strokeWidth={3} />
                        </div>
                     </div>

                     {/* Step 4 */}
                     <div className="relative p-8 bg-muted/5 rounded-3xl border border-border flex flex-col items-center text-center group hover:bg-muted/10 transition-colors">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform">
                           <Truck className="w-6 h-6 text-emerald-500" strokeWidth={3} />
                        </div>
                        <p className="text-[11px] font-black text-foreground uppercase italic tracking-tighter">Settle_Vector</p>
                        <p className="text-[10px] text-primary font-black mt-1 font-mono">{serviceFlow.toServed} MIN</p>
                     </div>

                  </div>
                  <div className="mt-8 flex items-center justify-center gap-8 bg-muted/5 p-4 rounded-2xl border border-dashed border-border">
                     <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-muted uppercase tracking-[0.3em]">Total_Cycle_Latency:</span>
                        <span className="text-lg font-black text-foreground italic font-mono">{serviceFlow.total} MIN</span>
                     </div>
                     <span className="text-[9px] font-black text-muted/40 uppercase tracking-widest italic">Requires KDS node engagement for extreme accuracy</span>
                  </div>
               </CardContent>
            </Card>

            {/* Bottom Section: Tables & Staff */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

               {/* Table Stats */}
               <Card className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] shadow-2xl overflow-hidden">
                  <CardHeader className="p-8 border-b border-border bg-muted/5">
                     <CardTitle className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-3">
                        <Armchair className="w-4 h-4 text-primary" strokeWidth={3} /> Spatial Utilization Analytics
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                     <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                        <table className="w-full text-sm text-left border-collapse">
                           <thead className="text-[9px] font-black text-muted uppercase bg-muted/5 border-b border-border sticky top-0 backdrop-blur-xl z-10 tracking-widest">
                              <tr>
                                 <th className="px-8 py-5">NODE_IDENT</th>
                                 <th className="px-8 py-5">SESSIONS</th>
                                 <th className="px-8 py-5">LATENCY</th>
                                 <th className="px-8 py-5 text-right">GROSS_REV</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-border">
                              {tableStats.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted uppercase font-black text-[10px] tracking-widest opacity-40">No spatial load detected</td></tr>}
                              {tableStats.map((table) => (
                                 <tr key={table.id} className="hover:bg-muted/5 transition-colors group">
                                    <td className="px-8 py-5 font-black text-foreground italic group-hover:text-primary transition-colors text-lg">{table.id}</td>
                                    <td className="px-8 py-5 font-mono text-xs text-muted font-black uppercase">
                                       {table.usage} <span className="opacity-40">TXN</span>
                                    </td>
                                    <td className="px-8 py-5 font-mono text-xs text-muted font-black">{table.avgTurnover}</td>
                                    <td className="px-8 py-5 text-right font-mono text-foreground font-black text-base">
                                       <span className="text-[10px] mr-1 opacity-30 font-sans NOT-italic">ETB</span>
                                       {table.revenue.toLocaleString()}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </CardContent>
               </Card>

               {/* Staff Performance Context */}
               <Card className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] shadow-2xl overflow-hidden">
                  <CardHeader className="p-8 border-b border-border bg-muted/5">
                     <CardTitle className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={3} /> Human Resource Efficiency
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                     <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                        <table className="w-full text-sm text-left border-collapse">
                           <thead className="text-[9px] font-black text-muted uppercase bg-muted/5 border-b border-border sticky top-0 backdrop-blur-xl z-10 tracking-widest">
                              <tr>
                                 <th className="px-8 py-5">HUMAN_NODE</th>
                                 <th className="px-8 py-5">VOLUME</th>
                                 <th className="px-8 py-5">SPEED_COEFF</th>
                                 <th className="px-8 py-5 text-right">ERR_VECTOR</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-border">
                              {staffStats.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted uppercase font-black text-[10px] tracking-widest opacity-40">No active human nodes</td></tr>}
                              {staffStats.map((staff) => (
                                 <tr key={staff.name} className="hover:bg-muted/5 transition-colors group">
                                    <td className="px-8 py-5">
                                       <div className="font-black text-foreground uppercase italic group-hover:text-primary transition-colors">{staff.name}</div>
                                       <div className="text-[9px] text-muted font-black uppercase tracking-widest opacity-40 mt-1">{staff.role}</div>
                                    </td>
                                    <td className="px-8 py-5 font-mono text-xs text-muted font-black">{staff.orders}</td>
                                    <td className="px-8 py-5 font-mono text-xs text-muted font-black">{staff.speed}</td>
                                    <td className="px-8 py-5 text-right">
                                       {staff.errors === 0 ? (
                                          <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[9px] tracking-[0.2em] px-3 py-1">ULTRA_PERFECT</Badge>
                                       ) : (
                                          <Badge className="bg-red-500/10 text-red-500 border-none font-black text-[9px] tracking-[0.2em] px-3 py-1">{staff.errors} V-ERRORS</Badge>
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
