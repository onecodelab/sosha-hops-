
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
              special_instructions,
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
            {/* Premium Multi-Theme KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
               {[
                  { label: 'Revenue Today', val: kpi.revenue, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', prefix: 'ETB' },
                  { label: 'Total Orders', val: kpi.orders, icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                  { label: 'System Issues', val: kpi.issues, icon: AlertCircle, color: kpi.issues > 0 ? 'text-red-500' : 'text-muted', bg: kpi.issues > 0 ? 'bg-red-500/10' : 'bg-muted/10', border: kpi.issues > 0 ? 'border-red-500/20' : 'border-border' },
                  { label: 'Staff Active', val: kpi.staffActive, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }
               ].map((k, i) => (
                  <div key={i} className="bg-card border border-border rounded-3xl p-6 group hover:border-primary/30 transition-all shadow-xl">
                     <div className="flex justify-between items-start">
                        <div>
                           <p className="text-[10px] text-muted uppercase font-black tracking-widest">{k.label}</p>
                           <h3 className="text-3xl font-black text-foreground mt-2 tracking-tighter">
                              {k.prefix && <span className="text-xs font-black mr-1 opacity-40">{k.prefix}</span>}
                              {k.val.toLocaleString()}
                           </h3>
                        </div>
                        <div className={cn("p-3 rounded-2xl group-hover:scale-110 transition-transform", k.bg)}>
                           <k.icon className={cn("w-6 h-6", k.color)} strokeWidth={3} />
                        </div>
                     </div>
                  </div>
               ))}
            </div>

            <SoshaCard indicatorColor="blue" className="shadow-2xl">
               <div className="flex items-center justify-between mb-8 pl-1">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-blue-500/10 rounded-2xl">
                        <List className="w-6 h-6 text-blue-500" strokeWidth={3} />
                     </div>
                     <SoshaCardTitle>Active Traffic Monitor</SoshaCardTitle>
                  </div>
                  <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-4 py-1.5 font-mono text-xs font-black shadow-lg">
                     {liveActiveOrders.length} FLOWING
                  </Badge>
               </div>
               {liveActiveOrders.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-muted bg-muted/5 rounded-[2rem] border border-border border-dashed">
                     <p className="font-black text-[10px] uppercase tracking-widest">No active traffic monitored</p>
                  </div>
               ) : (
                  <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar snap-x">
                     {liveActiveOrders.map(order => (
                        <div key={order.id} className="min-w-[340px] snap-start">
                           <OrderCard order={order} role="manager" onAction={handleOrderAction} />
                        </div>
                     ))}
                  </div>
               )}
            </SoshaCard>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <SoshaCard className="lg:col-span-2 shadow-2xl">
                  <div className="flex items-center gap-4 mb-8">
                     <div className="p-3 bg-purple-500/10 rounded-2xl">
                        <Timer className="w-6 h-6 text-purple-500" strokeWidth={3} />
                     </div>
                     <SoshaCardTitle>Service Velocity</SoshaCardTitle>
                  </div>
                  <div className="h-[250px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={serviceFlow} layout="vertical" margin={{ left: 0, right: 20 }}>
                           <XAxis type="number" hide />
                           <YAxis dataKey="step" type="category" width={80} tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 900 }} />
                           <Tooltip
                              cursor={{ fill: 'rgba(var(--primary-rgb),0.05)' }}
                              contentStyle={{
                                 backgroundColor: 'var(--card)',
                                 border: '1px solid var(--border)',
                                 borderRadius: '1rem',
                                 fontSize: '10px',
                                 fontWeight: 'bold'
                              }}
                           />
                           <Bar dataKey="time" barSize={32} radius={[0, 8, 8, 0]}>
                              {serviceFlow.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.time > entry.target ? '#EF4444' : 'var(--primary)'} />
                              ))}
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </SoshaCard>

               <SoshaCard className="h-full shadow-2xl">
                  <div className="flex items-center gap-4 mb-8">
                     <div className="p-3 bg-emerald-500/10 rounded-2xl">
                        <Users className="w-6 h-6 text-emerald-500" strokeWidth={3} />
                     </div>
                     <SoshaCardTitle>Active Team</SoshaCardTitle>
                  </div>
                  <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                     {shiftStaff.map((staff, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-3xl bg-muted/5 border border-border group hover:bg-muted/10 transition-all">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center text-xs font-black text-muted group-hover:text-primary transition-colors shadow-inner">
                                 {staff.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                 <p className="text-sm font-black text-foreground capitalize leading-none">{staff.name}</p>
                                 <p className="text-[10px] text-muted capitalize font-bold mt-1.5">{staff.role} • {staff.duration}</p>
                              </div>
                           </div>
                           <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
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
