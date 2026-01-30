
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { SoshaCard, SoshaCardTitle } from '../components/SoshaCard';
import { Badge, Button, cn, showToast } from '../components/ui';
import {
   Users, AlertCircle, TrendingUp, Clock,
   BarChart3, Timer, Loader2, List
} from 'lucide-react';
import {
   BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Order } from '../types';
import { PaymentVerificationModal, FloatingPaymentButton } from '../components/PaymentVerificationModal';
import { OrderCard } from '../components/OrderCard';

const ManagerDashboard: React.FC = () => {
   const [loading, setLoading] = useState(true);
   const [orders, setOrders] = useState<Order[]>([]);
   const [isPaymentOpen, setIsPaymentOpen] = useState(false);
   const [kpi, setKpi] = useState({ revenue: 0, orders: 0, issues: 0, staffActive: 0 });
   const [staffPerf, setStaffPerf] = useState<any[]>([]);
   const [shiftStaff, setShiftStaff] = useState<any[]>([]);
   const [serviceFlow, setServiceFlow] = useState<any[]>([]);
   const [avgServiceTime, setAvgServiceTime] = useState("0m");

   const fetchDashboardData = useCallback(async () => {
      try {
         const todayStr = new Date().toISOString().split('T')[0];
         const { data: todayOrders } = await supabase
            .from('orders')
            .select(`
            *, 
            waiter:profiles!orders_waiter_id_fkey (full_name),
            order_items (
              quantity, 
              menu_item:menu (name)
            )
          `)
            .gte('created_at', `${todayStr}T00:00:00`)
            .order('created_at', { ascending: false });

         setOrders(todayOrders as Order[] || []);

         const { data: allStaff } = await supabase.from('profiles').select('*').in('role', ['waiter', 'kitchen', 'manager', 'security']);
         const { data: issuesData } = await supabase.from('operational_issues').select('*').gte('created_at', `${todayStr}T00:00:00`);

         const activeOrders = todayOrders || [];
         const revenue = activeOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (o.total_amount || 0), 0);
         const issuesCount = (issuesData?.filter((i: any) => i.status === 'open').length || 0) + activeOrders.filter(o => o.status === 'cancelled').length;

         const staffActivityMap = new Set(activeOrders.map(o => o.waiter_id).filter(Boolean));
         const activeStaffCount = allStaff?.filter((u: any) => u.is_online || staffActivityMap.has(u.id)).length || 0;

         setKpi({ revenue, orders: activeOrders.length, issues: issuesCount, staffActive: activeStaffCount });

         const stageCounts = { order: 0, prep: 0, pickup: 0, pay: 0 };
         let totalServedTime = 0, servedCount = 0;
         activeOrders.forEach(o => {
            if (['pending'].includes(o.status)) stageCounts.order++;
            else if (['accepted', 'preparing'].includes(o.status)) stageCounts.prep++;
            else if (['ready'].includes(o.status)) stageCounts.pickup++;
            else if (['served', 'closed', 'paid'].includes(o.status)) {
               stageCounts.pay++;
               if (o.served_at && o.created_at) {
                  const diff = (new Date(o.served_at).getTime() - new Date(o.created_at).getTime()) / 60000;
                  if (diff > 0 && diff < 120) { totalServedTime += diff; servedCount++; }
               }
            }
         });
         setServiceFlow([{ step: 'Order', time: stageCounts.order, target: 5 }, { step: 'Prep', time: stageCounts.prep, target: 8 }, { step: 'Pickup', time: stageCounts.pickup, target: 4 }, { step: 'Pay', time: stageCounts.pay > 20 ? 20 : stageCounts.pay, target: 10 }]);
         setAvgServiceTime(servedCount > 0 ? `${Math.round(totalServedTime / servedCount)}m` : "0m");

         const staffMap: Record<string, any> = {};
         allStaff?.forEach((u: any) => { staffMap[u.id] = { id: u.id, name: u.full_name || u.email.split('@')[0], role: u.role, orders: 0, sales: 0, errors: 0 }; });
         activeOrders.forEach(o => {
            if (o.waiter_id && staffMap[o.waiter_id]) {
               staffMap[o.waiter_id].orders++;
               staffMap[o.waiter_id].sales += o.total_amount || 0;
               if (o.status === 'cancelled') staffMap[o.waiter_id].errors++;
            }
         });
         setStaffPerf(Object.values(staffMap).filter((s: any) => s.orders > 0).sort((a: any, b: any) => b.orders - a.orders).slice(0, 10));
         setShiftStaff(allStaff?.filter((u: any) => u.is_online || staffActivityMap.has(u.id)).map((u: any) => ({ name: u.full_name || u.email.split('@')[0], role: u.role, duration: u.shift_start ? `${Math.round((new Date().getTime() - new Date(u.shift_start).getTime()) / 3600000 * 10) / 10}h` : 'Active' })) || []);
      } catch (err: any) {
         console.error("Manager Dashboard Error:", err);
      } finally { setLoading(false); }
   }, []);

   useEffect(() => {
      fetchDashboardData();
      const subs = [
         supabase.channel('mgr_orders_v4').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDashboardData()),
      ];
      subs.forEach(s => s.subscribe());
      return () => { subs.forEach(s => supabase.removeChannel(subs[0])); }
   }, [fetchDashboardData]);

   const handleOrderAction = async (action: string, orderId: string) => {
      if (action === 'served') {
         // Internal logic handled by OrderCard. Simply refresh dashboards to show update.
         fetchDashboardData();
      }
   };

   const liveActiveOrders = orders.filter(o => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status));
   const unpaidServedOrders = orders.filter(o => o.status === 'served' && o.payment_status === 'unpaid');

   return (
      <DashboardLayout title="Ops Dashboard" subtitle="Daily operations and staff oversight">
         <div className="space-y-6">
            {/* Vibrant 2x2 Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
               {/* Revenue - Gold Theme */}
               <div className="relative overflow-hidden rounded-[2rem] p-4 md:p-6 bg-gradient-to-br from-amber-500/20 via-black to-black border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.1)] group">
                  <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                     <TrendingUp className="w-12 h-12 text-amber-500" />
                  </div>
                  <div className="relative z-10">
                     <p className="text-[9px] md:text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 md:mb-2">Revenue Today</p>
                     <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                        <span className="text-lg align-top opacity-50 mr-1">ETB</span>
                        {kpi.revenue.toLocaleString()}
                     </h3>
                  </div>
               </div>

               {/* Orders - Blue Theme */}
               <div className="relative overflow-hidden rounded-[2rem] p-4 md:p-6 bg-gradient-to-br from-blue-500/20 via-black to-black border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)] group">
                  <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                     <BarChart3 className="w-12 h-12 text-blue-500" />
                  </div>
                  <div className="relative z-10">
                     <p className="text-[9px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1 md:mb-2">Total Orders</p>
                     <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">{kpi.orders}</h3>
                  </div>
               </div>

               {/* Issues - Red Theme (or Gray if 0) */}
               <div className={cn(
                  "relative overflow-hidden rounded-[2rem] p-4 md:p-6 bg-gradient-to-br border shadow-lg group transition-all",
                  kpi.issues > 0
                     ? "from-red-500/20 via-black to-black border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.2)]"
                     : "from-zinc-800/50 via-black to-black border-white/5"
               )}>
                  <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                     <AlertCircle className={cn("w-12 h-12", kpi.issues > 0 ? "text-red-500" : "text-zinc-600")} />
                  </div>
                  <div className="relative z-10">
                     <p className={cn("text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 md:mb-2", kpi.issues > 0 ? "text-red-500" : "text-zinc-500")}>Issues</p>
                     <h3 className={cn("text-2xl md:text-3xl font-black tracking-tight", kpi.issues > 0 ? "text-white" : "text-zinc-400")}>{kpi.issues}</h3>
                  </div>
               </div>

               {/* Staff - Green Theme */}
               <div className="relative overflow-hidden rounded-[2rem] p-4 md:p-6 bg-gradient-to-br from-green-500/20 via-black to-black border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.1)] group">
                  <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                     <Users className="w-12 h-12 text-green-500" />
                  </div>
                  <div className="relative z-10">
                     <p className="text-[9px] md:text-[10px] font-black text-green-500 uppercase tracking-widest mb-1 md:mb-2">Staff Active</p>
                     <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">{kpi.staffActive}</h3>
                  </div>
               </div>
            </div>

            <SoshaCard indicatorColor="purple" className="border-purple-500/20">
               <div className="flex flex-row items-center justify-between mb-4 md:mb-6 pl-1">
                  <SoshaCardTitle className="flex items-center gap-3">
                     <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400">
                        <List className="w-4 h-4" />
                     </span>
                     <span>Live Active Orders</span>
                  </SoshaCardTitle>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 px-3 py-1 text-[10px] uppercase font-black tracking-wider">
                     {liveActiveOrders.length} Active
                  </Badge>
               </div>
               {liveActiveOrders.length === 0 ? (<div className="h-32 flex items-center justify-center text-gray-500 bg-white/5 rounded-2xl border border-white/5 border-dashed">No active orders.</div>) : (
                  <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                     {liveActiveOrders.map(order => (
                        <div key={order.id} className="min-w-[320px]">
                           <OrderCard order={order} role="manager" onAction={handleOrderAction} />
                        </div>
                     ))}
                  </div>
               )}
            </SoshaCard>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <SoshaCard className="lg:col-span-2">
                  <SoshaCardTitle className="flex items-center gap-2 mb-6"><Timer className="w-5 h-5 text-orange-400" /> Service Flow</SoshaCardTitle>
                  <div className="h-[200px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={serviceFlow} layout="vertical" margin={{ left: 10, right: 10 }}>
                           <XAxis type="number" hide />
                           <YAxis dataKey="step" type="category" width={50} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                           <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }} />
                           <Bar dataKey="time" barSize={24} radius={[0, 6, 6, 0]}>
                              {serviceFlow.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.time > entry.target ? '#EF4444' : '#8B5CF6'} />))}
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </SoshaCard>
               <SoshaCard className="h-[400px]">
                  <SoshaCardTitle className="flex items-center gap-2 mb-4"><Clock className="w-5 h-5 text-green-500" /> Active Team</SoshaCardTitle>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                     {shiftStaff.map((staff, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center text-xs font-black text-gray-400 group-hover:text-white group-hover:border-primary/50 transition-colors">
                                 {staff.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-white capitalize">{staff.name}</p>
                                 <p className="text-[10px] text-gray-500 capitalize font-bold">{staff.role} • {staff.duration}</p>
                              </div>
                           </div>
                           <div className="relative">
                              <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse" />
                           </div>
                        </div>
                     ))}
                  </div>
               </SoshaCard>
            </div>
         </div>
         <PaymentVerificationModal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} orders={unpaidServedOrders} onPaymentSuccess={fetchDashboardData} />
         <FloatingPaymentButton count={unpaidServedOrders.length} onClick={() => setIsPaymentOpen(true)} />
      </DashboardLayout>
   );
};

export default ManagerDashboard;
