
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { SoshaCard, SoshaCardTitle } from '../components/SoshaCard';
import {
   TrendingUp, Users, ShoppingBag, AlertTriangle,
   RefreshCw, DollarSign, Activity, ClipboardList, List, Eye, Filter, User, ShieldCheck, Search, Calendar
} from 'lucide-react';
import { cn, Badge, Button, showToast, Card } from '../components/ui';
import { supabase } from '../supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { ActiveOrdersModal } from '../components/ActiveOrdersModal';
import { PaymentVerificationModal } from '../components/PaymentVerificationModal';
import { OrderCard } from '../components/OrderCard';
import { Order, UserProfile } from '../types';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { useBranch } from '../contexts/BranchContext';

const AdminDashboard: React.FC = () => {
   const navigate = useNavigate();
   const { activeBranchId } = useBranch();
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
   const [searchQuery, setSearchQuery] = useState('');
   const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'all'>('week');

   const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   const fetchDashboardData = useCallback(async () => {
      if (!activeBranchId) return;
      try {
         let dateLimit = new Date();
         if (dateFilter === 'yesterday') {
            dateLimit.setDate(dateLimit.getDate() - 1);
         } else if (dateFilter === 'week') {
            dateLimit.setDate(dateLimit.getDate() - 7);
         } else if (dateFilter === 'month') {
            dateLimit.setMonth(dateLimit.getMonth() - 1);
         }
         const startDate = dateFilter === 'today' || dateFilter === 'yesterday'
            ? dateLimit.toISOString().split('T')[0]
            : dateLimit.toISOString().split('T')[0];

         const { data: rev } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('branch_id', activeBranchId)
            .gte('created_at', `${new Date().toISOString().split('T')[0]}T00:00:00`)
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
            .eq('branch_id', activeBranchId)
            .neq('status', 'paid')
            .neq('status', 'closed')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

         if (activeErr) throw activeErr;

         // Define date boundaries precisely
         const now = new Date();
         const localToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

         let queryStart: string | null = null;
         let queryEnd: string | null = null;

         if (dateFilter === 'today') {
            queryStart = localToday.toISOString();
         } else if (dateFilter === 'yesterday') {
            queryStart = new Date(localToday.getTime() - 86400000).toISOString();
            queryEnd = localToday.toISOString();
         } else if (dateFilter === 'week') {
            queryStart = new Date(localToday.getTime() - 7 * 86400000).toISOString();
         }

         // Function to execute order fetch with specific fields
         const fetchWithFields = async (fields: string) => {
            let q = supabase.from('orders').select(fields).eq('branch_id', activeBranchId);
            if (queryStart) q = q.gte('created_at', queryStart);
            if (queryEnd) q = q.lt('created_at', queryEnd);
            return q.order('created_at', { ascending: false }).limit(searchQuery ? 100 : 50);
         };

         const richFields = `
             *, 
             waiter:profiles!orders_waiter_id_fkey (full_name, role),
             closed_by_user:profiles!orders_closed_by_id_fkey (full_name, role),
             order_items (
                id,
                quantity,
                price,
                menu_item:menu (name)
             )
          `;

         const fallbackFields = `
             *, 
             waiter:profiles!orders_waiter_id_fkey (full_name, role),
             order_items (
                id,
                quantity,
                price,
                menu_item:menu (name)
             )
          `;

         let feedData = [];
         try {
            // 1. Try with rich relationships (including closed_by)
            const { data: feed, error: feedErr } = await fetchWithFields(richFields);
            if (feedErr) throw feedErr;
            feedData = feed || [];
         } catch (richErr: any) {
            console.log("Rich query failed, trying simple query:", richErr.message);
            // 2. Fallback to simple (no closed_by join)
            const { data: simpleFeed, error: simpleErr } = await fetchWithFields(fallbackFields);
            if (!simpleErr) {
               feedData = simpleFeed || [];
            } else {
               console.error("Simple query also failed:", simpleErr);
            }
         }

         const { data: staff } = await supabase
            .from('profiles')
            .select('*')
            .eq('home_branch_id', activeBranchId)
            .in('role', ['waiter', 'manager']);
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
   }, [dateFilter, searchQuery]); // Added missing dependencies to prevent stale closure

   const debouncedSync = useCallback(() => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
         fetchDashboardData();
      }, 1000);
   }, [fetchDashboardData]);

   useEffect(() => {
      if (!activeBranchId) return;
      fetchDashboardData();
      const sub = supabase.channel('admin_sync')
         .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `branch_id=eq.${activeBranchId}`
         }, () => debouncedSync())
         .subscribe();
      return () => {
         supabase.removeChannel(sub);
         if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      };
   }, [debouncedSync, dateFilter, activeBranchId]);

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
      let filtered = allRecentOrders;

      if (transactionFilter !== 'all') {
         filtered = filtered.filter(o => {
            if (transactionFilter === 'cash') return o.payment_method === 'cash';
            if (transactionFilter === 'digital') return o.payment_method && o.payment_method !== 'cash';
            return true;
         });
      }

      if (searchQuery) {
         const query = searchQuery.toLowerCase();
         filtered = filtered.filter(o =>
            o.order_number?.toLowerCase().includes(query) ||
            o.table_number?.toString().toLowerCase().includes(query) ||
            o.id.toLowerCase().includes(query) ||
            o.waiter?.full_name?.toLowerCase().includes(query) ||
            o.closed_by_user?.full_name?.toLowerCase().includes(query)
         );
      }

      return filtered;
   }, [allRecentOrders, transactionFilter, searchQuery]);

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
      <DashboardLayout title="Executive Dashboard" subtitle="Mission Control" className="h-full md:h-screen md:overflow-hidden">
         <div className="space-y-3 animate-in fade-in duration-500 h-full flex flex-col overflow-y-auto md:overflow-hidden">

            {/* Top Compact Metrics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 shrink-0">
               <Card variant="elevated" className="p-4 md:p-5 border-l-4 border-l-yellow-500 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                     <DollarSign className="w-12 h-12" />
                  </div>
                  <div className="flex flex-col">
                     <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-2">Revenue Today</p>
                     <h3 className="text-2xl font-black text-foreground tracking-tight">ETB {stats.totalRevenue.toLocaleString()}</h3>
                  </div>
               </Card>

               <Card
                  variant="interactive"
                  className="p-4 md:p-5 border-l-4 border-l-blue-500 rounded-2xl relative overflow-hidden group"
                  onClick={() => setIsModalOpen(true)}
               >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                     <Activity className="w-12 h-12" />
                  </div>
                  <div className="flex flex-col">
                     <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-2">Active / In Kitchen</p>
                     <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-black text-foreground tracking-tight">{stats.activeOrdersCount}</h3>
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                     </div>
                  </div>
               </Card>

               {/* Stats Row Spacing/Filler */}
               <div className="hidden lg:block lg:col-span-2" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto md:h-full md:min-h-0 md:flex-1 pb-20 md:pb-0">
               {/* Left Col: Live Production Board (Takes 4 cols) */}
               <div className="lg:col-span-4 flex flex-col md:min-h-0 space-y-4 h-[500px] md:h-auto shrink-0">
                  <div className="flex items-center justify-between px-2 shrink-0">
                     <h3 className="text-[10px] font-black text-gray-500 flex items-center gap-2 uppercase tracking-[0.2em]">
                        <List className="w-3.5 h-3.5 text-primary" /> Live Production
                     </h3>

                     <div className="flex items-center gap-2">
                        <select
                           value={selectedStaffId}
                           onChange={(e) => setSelectedStaffId(e.target.value)}
                           className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black text-white hover:border-primary/30 transition-all outline-none"
                        >
                           <option value="all">ALL STAFF</option>
                           {staffList.map(s => (
                              <option key={s.id} value={s.id}>{s.full_name}</option>
                           ))}
                        </select>
                        <Button variant="outline" size="icon" onClick={fetchDashboardData} className="h-9 w-9">
                           <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                        </Button>
                     </div>
                  </div>

                  <Card variant="default" className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-black/40">
                     {filteredActiveOrders.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-700 gap-4 opacity-40">
                           <Activity className="w-8 h-8" />
                           <span className="text-[10px] font-black uppercase tracking-[0.3em]">Operational Clear</span>
                        </div>
                     ) : (
                        <div className="space-y-3">
                           {filteredActiveOrders.map(order => (
                              <div key={order.id} className="w-full">
                                 <OrderCard order={order} role="manager" onAction={handleOrderAction} />
                              </div>
                           ))}
                        </div>
                     )}
                  </Card>
               </div>

               {/* Right Col: Transaction Audit (Takes 8 cols) */}
               <div className="lg:col-span-8 flex flex-col md:min-h-0 h-[600px] md:h-auto shrink-0">
                  <Card variant="elevated" className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden" indicatorColor="purple">
                     <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 gap-4 shrink-0 border-b border-white/5">
                        <h3 className="flex items-center gap-3 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                           <ClipboardList className="w-4 h-4 text-primary" /> Transaction Log
                        </h3>

                        <div className="flex flex-wrap items-center gap-3">
                           {/* Search Bar */}
                           <div className="relative group">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 group-focus-within:text-primary transition-colors" />
                              <input
                                 type="text"
                                 placeholder="Audit Search..."
                                 value={searchQuery}
                                 onChange={(e) => setSearchQuery(e.target.value)}
                                 className="bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-[10px] text-white focus:outline-none focus:border-primary/50 transition-all w-40 font-bold"
                              />
                           </div>

                           {/* Date Filter */}
                           <div className="flex bg-black/60 rounded-xl p-1 border border-white/5">
                              {(['today', 'yesterday', 'week', 'all'] as const).map((d) => (
                                 <button
                                    key={d}
                                    onClick={() => setDateFilter(d)}
                                    className={cn(
                                       "px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all",
                                       dateFilter === d ? "bg-primary text-black" : "text-gray-500 hover:text-gray-300"
                                    )}
                                 >
                                    {d}
                                 </button>
                              ))}
                           </div>

                           <div className="flex gap-1.5 pl-3 border-l border-white/10">
                              {(['all', 'cash', 'digital'] as const).map((filter) => (
                                 <Button
                                    key={filter}
                                    variant={transactionFilter === filter ? 'glass' : 'ghost'}
                                    size="sm"
                                    onClick={() => setTransactionFilter(filter)}
                                    className={cn(
                                       "h-8 px-4",
                                       transactionFilter === filter && "border-primary/20 text-primary"
                                    )}
                                 >
                                    {filter}
                                 </Button>
                              ))}
                           </div>
                        </div>
                     </div>

                     <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10">
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
                                       <div className="flex flex-col">
                                          <span className="font-mono text-[10px] font-black text-white group-hover:text-primary transition-colors truncate max-w-[80px] md:max-w-none">
                                             #{order.order_number || order.id.slice(0, 4)}
                                          </span>
                                          <span className="text-[9px] text-gray-500 font-mono">
                                             {new Date(order.closed_at || order.paid_at || order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                       </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                       <div className="flex flex-col items-start gap-1">
                                          <span className="font-bold text-gray-200 text-xs">T-{order.table_number}</span>
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
                              <p className="text-xs mb-2">No records found</p>
                              {searchQuery && (
                                 <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => setSearchQuery('')}
                                    className="text-[10px] text-primary h-auto p-0"
                                 >
                                    Clear Search
                                 </Button>
                              )}
                           </div>
                        )}
                     </div>
                  </Card>
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
