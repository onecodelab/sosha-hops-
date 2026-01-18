
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
                  waiter:profiles!orders_waiter_id_fkey (full_name),
                  closed_by_user:profiles(full_name)
               `)
               .order('created_at', { ascending: false })
               .limit(20);

            if (feedErr) throw feedErr;
            feedData = feed || [];
         } catch (auditErr) {
            console.error("Audit Query Error (Retrying simple):", auditErr);
            const { data: simpleFeed } = await supabase
               .from('orders')
               .select(`*, waiter:profiles!orders_waiter_id_fkey (full_name)`)
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

   return (
      <DashboardLayout title="Executive Dashboard" subtitle="System oversight">
         <div className="space-y-8 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <SoshaCard className="p-6" indicatorColor="yellow">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Revenue Today</p>
                  <h3 className="text-3xl font-black text-foreground mt-2">ETB {stats.totalRevenue.toLocaleString()}</h3>
               </SoshaCard>
               <SoshaCard
                  className="p-6 cursor-pointer hover:border-blue-500/30 transition-all"
                  indicatorColor="blue"
                  onClick={() => setIsModalOpen(true)}
               >
                  <div className="flex justify-between items-start">
                     <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">In Kitchen</p>
                        <h3 className="text-3xl font-black text-foreground mt-2">{stats.activeOrdersCount}</h3>
                     </div>
                     <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                        <Activity className="w-5 h-5" />
                     </div>
                  </div>
               </SoshaCard>
            </div>

            <div className="space-y-6">
               <div className="flex flex-col md:flex-row md:items-center justify-between px-2 gap-4">
                  <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                     <List className="w-5 h-5 text-primary" /> Live Production Board
                  </h3>

                  <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
                     <div className="flex items-center gap-2 px-3 text-gray-500">
                        <User className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Staff:</span>
                     </div>
                     <select
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-primary transition-all min-w-[160px]"
                     >
                        <option value="all">Global View</option>
                        {staffList.map(s => (
                           <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                        ))}
                     </select>
                     <Button variant="ghost" size="icon" onClick={fetchDashboardData} className="h-8 w-8 hover:bg-white/10">
                        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                     </Button>
                  </div>
               </div>

               {filteredActiveOrders.length === 0 ? (
                  <div className="h-60 flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/10 rounded-[2.5rem] text-gray-600 gap-3">
                     <Activity className="w-12 h-12 opacity-10" />
                     <p className="italic text-sm font-medium">Kitchen is currently clear</p>
                  </div>
               ) : (
                  <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar snap-x">
                     {filteredActiveOrders.map(order => (
                        <div key={order.id} className="min-w-[320px] snap-start">
                           <OrderCard order={order} role="manager" onAction={handleOrderAction} />
                        </div>
                     ))}
                  </div>
               )}
            </div>

            <SoshaCard className="p-6" indicatorColor="purple">
               <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                  <SoshaCardTitle className="flex items-center gap-2">
                     <ClipboardList className="w-5 h-5 text-purple-400" /> Transaction Audit
                  </SoshaCardTitle>

                  <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                     {(['all', 'cash', 'digital'] as const).map((filter) => (
                        <button
                           key={filter}
                           onClick={() => setTransactionFilter(filter)}
                           className={cn(
                              "px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                              transactionFilter === filter
                                 ? "bg-purple-500 text-white shadow-lg"
                                 : "text-gray-500 hover:text-white"
                           )}
                        >
                           {filter}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="space-y-4">
                  {filteredAuditLog.map(order => (
                     <div key={order.id} className="p-5 bg-black/40 border border-white/5 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center group hover:border-primary/20 transition-all gap-4">
                        {/* Left Side: Table, Order #, Type, Time */}
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-white/5 flex flex-col items-center justify-center border border-white/5 group-hover:border-primary/30 transition-all shrink-0">
                              <span className="text-[10px] font-black text-gray-400 uppercase">T-{order.table_number}</span>
                              <Badge variant="ghost" className="p-0 text-[8px] opacity-60 text-primary uppercase font-black">{order.order_type || 'Dine'}</Badge>
                           </div>
                           <div>
                              <div className="flex items-center gap-2">
                                 <p className="text-sm font-black text-foreground">#{order.order_number || order.id.slice(0, 5)}</p>
                                 <span className="text-[10px] text-gray-600 font-mono bg-white/5 px-2 py-0.5 rounded-full">
                                    {new Date(order.closed_at || order.paid_at || order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-1.5">
                                 <div className="flex items-center gap-1.5">
                                    <User className="w-3 h-3 text-gray-600" />
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Wait: {order.waiter?.full_name || 'System'}</span>
                                 </div>
                                 {order.closed_by_user && (
                                    <div className="flex items-center gap-1.5 border-l border-white/10 pl-4">
                                       <ShieldCheck className="w-3 h-3 text-purple-400" />
                                       <span className="text-[10px] text-purple-400 font-bold uppercase tracking-tighter">Done: {order.closed_by_user.full_name}</span>
                                    </div>
                                 )}
                              </div>
                              {order.transaction_reference && (
                                 <p className="text-[9px] text-blue-400/80 font-mono mt-2 flex items-center gap-1.5 bg-blue-500/5 px-2 py-1 rounded-lg border border-blue-500/10">
                                    <Activity className="w-2.5 h-2.5" /> REF: {order.transaction_reference}
                                 </p>
                              )}
                           </div>
                        </div>

                        {/* Right Side: Financial Breakdown & Status */}
                        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                           <div className="flex items-center gap-4">
                              {/* Financial transparency breakdown */}
                              <div className="hidden sm:flex flex-col items-end opacity-40 group-hover:opacity-100 transition-opacity">
                                 <p className="text-[9px] font-mono text-gray-500">Sub: {(order.subtotal_amount || 0).toLocaleString()} • VAT: {(order.vat_amount || 0).toLocaleString()}</p>
                                 <p className="text-[9px] font-mono text-primary/80 font-bold">Total: {order.total_amount.toLocaleString()}</p>
                              </div>

                              <div className="text-right">
                                 <div className="flex items-center justify-end gap-2 mb-1">
                                    {order.payment_method && (
                                       <Badge variant="outline" className="text-[8px] uppercase px-2 py-0.5 border-white/10 text-gray-400 flex items-center gap-1.5 bg-white/5">
                                          {getPaymentIcon(order.payment_method)} {order.payment_method}
                                       </Badge>
                                    )}
                                    <div className="flex flex-col items-end">
                                       <p className="text-lg font-black text-primary font-mono leading-none">ETB {order.total_amount.toLocaleString()}</p>
                                       {order.tip_amount > 0 && <span className="text-[9px] text-green-400 font-bold tracking-tighter">+ ETB {order.tip_amount} TIP</span>}
                                    </div>
                                 </div>
                              </div>
                           </div>

                           <div className="flex items-center gap-3">
                              {/* Verification Badge */}
                              {order.verified && (
                                 <div className="flex items-center gap-1.5 text-[9px] font-black text-green-500 uppercase bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                    <ShieldCheck className="w-3 h-3" /> Verified
                                 </div>
                              )}

                              {/* Overpayment check */}
                              {order.amount_paid > order.total_amount && (
                                 <span className="text-[8px] font-bold text-gray-600">Paid: {order.amount_paid.toLocaleString()}</span>
                              )}

                              <Badge variant="outline" className={cn("text-[9px] uppercase font-black px-3 py-1 rounded-xl shadow-inner",
                                 order.status === 'paid' ? "border-green-500/30 text-green-500 bg-green-500/10" :
                                    order.status === 'served' ? "border-purple-500/30 text-purple-400 bg-purple-500/10" :
                                       order.status === 'closed' ? "border-gray-700 text-gray-500 bg-gray-800/20" : "border-gray-800 text-gray-600"
                              )}>{order.status}</Badge>
                           </div>
                        </div>
                     </div>
                  ))}
                  {filteredAuditLog.length === 0 && (
                     <div className="text-center py-16 bg-white/5 rounded-[2rem] border border-dashed border-white/10">
                        <ClipboardList className="w-12 h-12 mx-auto text-gray-700 mb-4 opacity-20" />
                        <p className="text-gray-500 italic font-medium">No transactions found matching this filter.</p>
                     </div>
                  )}
               </div>
            </SoshaCard>
         </div>

         <ActiveOrdersModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} orders={activeOrders.filter(o => !['served', 'paid'].includes(o.status))} />
         <PaymentVerificationModal
            isOpen={isPaymentOpen}
            onClose={() => setIsPaymentOpen(false)}
            orders={servedUnpaidOrders}
            onPaymentSuccess={handlePaymentSuccess}
         />
      </DashboardLayout>
   );
};

export default AdminDashboard;
