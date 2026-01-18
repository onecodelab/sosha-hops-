
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { SoshaCard, SoshaCardTitle } from '../components/SoshaCard';
import {
   TrendingUp, Users, ShoppingBag, AlertTriangle,
   RefreshCw, DollarSign, Activity, ClipboardList, List, Eye, Filter, User, ShieldCheck
} from 'lucide-react';
import { cn, Badge, Button, showToast } from '../components/ui';
import { supabase } from '../supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { ActiveOrdersModal } from '../components/ActiveOrdersModal';
import { PaymentVerificationModal } from '../components/PaymentVerificationModal';
import { OrderCard } from '../components/OrderCard';
import { Order, UserProfile } from '../types';
import { OrderDetailsModal } from '../components/OrderDetailsModal';

const AdminDashboard: React.FC = () => {
   const navigate = useNavigate();
   const [loading, setLoading] = useState(true);
   const [actionInProgress, setActionInProgress] = useState(false);
   const [activeOrders, setActiveOrders] = useState<Order[]>([]);
   const [allRecentOrders, setAllRecentOrders] = useState<any[]>([]);
   const [staffList, setStaffList] = useState<UserProfile[]>([]);
   const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [isPaymentOpen, setIsPaymentOpen] = useState(false);
   const [stats, setStats] = useState({ totalRevenue: 0, activeOrdersCount: 0 });

   const [transactionFilter, setTransactionFilter] = useState<'all' | 'cash' | 'digital'>('all');
   const [selectedDetailsOrder, setSelectedDetailsOrder] = useState<Order | null>(null);
   const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

   const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   const fetchDashboardData = useCallback(async () => {
      try {
         const today = new Date().toISOString().split('T')[0];

         const { data: rev } = await supabase
            .from('orders')
            .select('total_amount')
            .gte('created_at', `${today}T00:00:00`)
            .in('status', ['closed', 'paid', 'served']);

         const { data: active, error: activeErr } = await supabase
            .from('orders')
            .select(`
          *, 
          waiter:profiles!orders_waiter_id_fkey (id, full_name),
          order_items (
            id,
            quantity, 
            price,
            menu_item:menu (name)
          )
        `)
            .neq('status', 'paid')
            .neq('status', 'closed')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

         if (activeErr) throw activeErr;

         // Updated query to fetch closed_by details with robust fallback
         let feedData = [];
         try {
            const { data: feed, error: feedErr } = await supabase
               .from('orders')
               .select(`
                   *, 
                   waiter:profiles!orders_waiter_id_fkey (full_name, role),
                   closed_by_user:profiles(full_name, role),
                   order_items (
                      id,
                      quantity,
                      price,
                      menu_item:menu (name)
                   )
               `)
               .order('created_at', { ascending: false })
               .limit(20);

            if (feedErr) throw feedErr;
            feedData = feed || [];
         } catch (auditErr) {
            console.error("Audit Query Error (Retrying simple):", auditErr);
            const { data: simpleFeed } = await supabase
               .from('orders')
               .select(`
                  *, 
                  waiter:profiles!orders_waiter_id_fkey (full_name, role),
                  order_items (
                    id,
                    quantity,
                    price,
                    menu_item:menu (name)
                  )
               `)
               .order('created_at', { ascending: false })
               .limit(20);
            feedData = simpleFeed || [];
         }

         const { data: staff } = await supabase.from('profiles').select('*').in('role', ['waiter', 'manager']);
         if (staff) setStaffList(staff as UserProfile[]);

         setStats({
            totalRevenue: rev?.reduce((acc, o) => acc + (o.total_amount || 0), 0) || 0,
            activeOrdersCount: active?.filter(o => !['served', 'paid'].includes(o.status)).length || 0
         });

         setActiveOrders((active || []) as Order[]);
         setAllRecentOrders(feedData);
      } catch (err: any) {
         console.error(err);
      } finally {
         setLoading(false);
      }
   }, []);

   const debouncedSync = useCallback(() => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
         fetchDashboardData();
      }, 1000);
   }, [fetchDashboardData]);

   useEffect(() => {
      fetchDashboardData();
      const sub = supabase.channel('admin_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => debouncedSync()).subscribe();
      return () => {
         supabase.removeChannel(sub);
         if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      };
   }, [debouncedSync]);

   const handleOrderAction = async (action: string, orderId: string) => {
      if (action === 'served') {
         // OrderCard already performed the database update internally.
         // Simply trigger a sync to update the Process Bills filter
         debouncedSync();
      }
   };

   // Fix: handlePaymentSuccess signature now matches onPaymentSuccess: () => void
   const handlePaymentSuccess = () => {
      debouncedSync();
   };

   const filteredActiveOrders = useMemo(() => {
      const list = activeOrders.filter(o => !['served', 'paid', 'closed'].includes(o.status));
      if (selectedStaffId === 'all') return list;
      return list.filter(o => o.waiter_id === selectedStaffId);
   }, [activeOrders, selectedStaffId]);

   const servedUnpaidOrders = useMemo(() => {
      return activeOrders.filter(o => o.status === 'served' && o.payment_status === 'unpaid');
   }, [activeOrders]);

   const filteredAuditLog = useMemo(() => {
      if (transactionFilter === 'all') return allRecentOrders;
      return allRecentOrders.filter(o => {
         if (transactionFilter === 'cash') return o.payment_method === 'cash';
         if (transactionFilter === 'digital') return o.payment_method && o.payment_method !== 'cash';
         return true;
      });
   }, [allRecentOrders, transactionFilter]);

   const getPaymentIcon = (method?: string) => {
      if (method === 'cash') return <DollarSign className="w-3 h-3 text-green-500" />;
      if (['telebirr', 'abyssinia', 'cbe'].includes(method || '')) return <Activity className="w-3 h-3 text-blue-500" />;
      return <AlertTriangle className="w-3 h-3 text-gray-500" />;
   };

   const handleRowClick = (order: any) => {
      setSelectedDetailsOrder(order);
      setIsDetailsModalOpen(true);
   };

   return (
      <DashboardLayout title="Executive Dashboard" subtitle="Mission Control" className="overflow-hidden h-screen">
         <div className="space-y-3 animate-in fade-in duration-500 h-full flex flex-col">

            {/* Top Compact Metrics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
               <SoshaCard className="p-3 border-l-4 border-l-yellow-500 rounded-sm" indicatorColor="yellow">
                  <div className="flex justify-between items-center">
                     <div>
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Revenue Today</p>
                        <h3 className="text-xl font-black text-foreground tracking-tight">ETB {stats.totalRevenue.toLocaleString()}</h3>
                     </div>
                     <DollarSign className="w-4 h-4 text-yellow-500 opacity-50" />
                  </div>
               </SoshaCard>

               <SoshaCard
                  className="p-3 cursor-pointer hover:bg-white/5 transition-colors border-l-4 border-l-blue-500 rounded-sm"
                  indicatorColor="blue"
                  onClick={() => setIsModalOpen(true)}
               >
                  <div className="flex justify-between items-center">
                     <div>
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Active / In Kitchen</p>
                        <h3 className="text-xl font-black text-foreground tracking-tight">{stats.activeOrdersCount}</h3>
                     </div>
                     <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
                  </div>
               </SoshaCard>

               {/* Consolidated Quick Actions / Status could go here in remaining col slots if needed, using placeholders for now to maintain grid */}
               <div className="hidden lg:block lg:col-span-2">
                  {/* Spacing or additional future compact metrics */}
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 flex-1">
               {/* Left Col: Live Production Board (Takes 4 cols) */}
               <div className="lg:col-span-4 flex flex-col min-h-0 space-y-2">
                  <div className="flex items-center justify-between px-1 shrink-0">
                     <h3 className="text-xs font-black text-foreground flex items-center gap-2 uppercase tracking-widest opacity-70">
                        <List className="w-3 h-3" /> Live Production
                     </h3>

                     <div className="flex items-center gap-1 scale-90 origin-right">
                        <select
                           value={selectedStaffId}
                           onChange={(e) => setSelectedStaffId(e.target.value)}
                           className="bg-black/40 border-b border-white/20 px-2 py-1 text-[10px] font-bold text-white focus:outline-none hover:bg-white/5 transition-all text-right"
                        >
                           <option value="all">ALL STAFF</option>
                           {staffList.map(s => (
                              <option key={s.id} value={s.id}>{s.full_name}</option>
                           ))}
                        </select>
                        <Button variant="ghost" size="icon" onClick={fetchDashboardData} className="h-6 w-6 hover:bg-white/10 rounded-sm">
                           <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
                        </Button>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2 bg-black/20 p-2 rounded-lg border border-white/5">
                     {filteredActiveOrders.length === 0 ? (
                        <div className="h-20 flex items-center justify-center text-gray-700 gap-2">
                           <Activity className="w-4 h-4 opacity-50" />
                           <span className="text-[10px] font-mono">ALL CLEAR</span>
                        </div>
                     ) : (
                        filteredActiveOrders.map(order => (
                           <div key={order.id} className="scale-95 origin-top-left w-full mb-[-10px]">
                              <OrderCard order={order} role="manager" onAction={handleOrderAction} />
                           </div>
                        ))
                     )}
                  </div>
               </div>

               {/* Right Col: Transaction Audit (Takes 8 cols) */}
               <div className="lg:col-span-8 flex flex-col min-h-0">
                  <SoshaCard className="flex-1 flex flex-col min-h-0 bg-transparent border-0 p-0" indicatorColor="purple">
                     <div className="flex items-center justify-between mb-2 px-1 shrink-0">
                        <SoshaCardTitle className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-70">
                           <ClipboardList className="w-3 h-3" /> Transaction Log
                        </SoshaCardTitle>

                        <div className="flex gap-1">
                           {(['all', 'cash', 'digital'] as const).map((filter) => (
                              <button
                                 key={filter}
                                 onClick={() => setTransactionFilter(filter)}
                                 className={cn(
                                    "px-3 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-sm transition-all border border-transparent",
                                    transactionFilter === filter
                                       ? "bg-purple-900/50 text-purple-200 border-purple-500/20"
                                       : "text-gray-600 hover:text-gray-400"
                                 )}
                              >
                                 {filter}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar border border-white/5 rounded-lg bg-black/20">
                        <table className="w-full text-left border-collapse">
                           <thead className="sticky top-0 bg-black/90 text-[9px] font-black uppercase text-gray-600 tracking-wider z-10 backdrop-blur-sm">
                              <tr>
                                 <th className="px-3 py-2">ID / Time</th>
                                 <th className="px-3 py-2">Table / Type</th>
                                 <th className="px-3 py-2 hidden sm:table-cell">Staff</th>
                                 <th className="px-3 py-2 text-right">Total</th>
                                 <th className="px-3 py-2 text-right">Status</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-white/5">
                              {filteredAuditLog.map(order => (
                                 <tr
                                    key={order.id}
                                    onClick={() => handleRowClick(order)}
                                    className="group hover:bg-white/10 transition-all cursor-pointer text-xs"
                                 >
                                    <td className="px-3 py-2.5">
                                       <div className="flex items-center gap-2">
                                          <span className="font-mono text-gray-400 group-hover:text-primary transition-colors">#{order.order_number || order.id.slice(0, 4)}</span>
                                          <span className="text-[10px] text-gray-600 font-mono">
                                             {new Date(order.closed_at || order.paid_at || order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                       </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                       <div className="flex items-center gap-2">
                                          <span className="font-bold text-gray-200">T-{order.table_number}</span>
                                          <span className="px-1.5 py-0.5 text-[8px] bg-white/5 rounded-sm uppercase tracking-tighter text-gray-500">{order.order_type || 'Dine'}</span>
                                       </div>
                                    </td>
                                    <td className="px-3 py-2.5 hidden sm:table-cell">
                                       <div className="flex flex-col">
                                          <span className="text-[10px] text-white font-black truncate max-w-[80px]">{order.waiter?.full_name || 'Sys'}</span>
                                          <span className="text-[8px] text-primary uppercase font-bold">{(order as any).waiter?.role || (order.closed_by_user ? 'Admin' : 'Staff')}</span>
                                       </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono font-black text-white">
                                       {order.total_amount.toLocaleString()}
                                       {order.tip_amount > 0 && <span className="text-[8px] text-green-500 ml-1">+Tip</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                       <div className="flex items-center justify-end gap-2">
                                          {order.payment_method && (
                                             <span className="text-[9px] font-black uppercase text-zinc-500 bg-white/5 px-2 py-0.5 rounded-sm">{order.payment_method}</span>
                                          )}
                                          <span className={cn("text-[9px] uppercase font-black px-1.5 py-0.5 rounded-sm",
                                             order.status === 'paid' ? "text-green-500 bg-green-500/10" :
                                                order.status === 'served' ? "text-purple-400 bg-purple-500/10" : "text-gray-500"
                                          )}>
                                             {order.status}
                                          </span>
                                       </div>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>

                        {filteredAuditLog.length === 0 && (
                           <div className="text-center py-10 opacity-30">
                              <ClipboardList className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-xs">No records</p>
                           </div>
                        )}
                     </div>
                  </SoshaCard>
               </div>
            </div>
         </div>

         <ActiveOrdersModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} orders={activeOrders.filter(o => !['served', 'paid'].includes(o.status))} />
         <PaymentVerificationModal
            isOpen={isPaymentOpen}
            onClose={() => setIsPaymentOpen(false)}
            orders={servedUnpaidOrders}
            onPaymentSuccess={handlePaymentSuccess}
         />
         <OrderDetailsModal
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            order={selectedDetailsOrder}
         />
      </DashboardLayout>
   );
};

export default AdminDashboard;
