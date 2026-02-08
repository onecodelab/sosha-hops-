
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { BaroCard, BaroCardTitle } from '../components/BaroCard';
import {
   TrendingUp, Users, ShoppingBag, AlertTriangle,
   RefreshCw, DollarSign, Activity, ClipboardList, List, Eye, Filter, User, ShieldCheck, Search, Calendar, LayoutList
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
                special_instructions,
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
                special_instructions,
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
      return <AlertTriangle className="w-3 h-3 text-muted" />;
   };

   const handleRowClick = (order: any) => {
      setSelectedDetailsOrder(order);
      setIsDetailsModalOpen(true);
   };

   return (
      <DashboardLayout title="Executive Dashboard" subtitle="Mission Control" className="h-full md:h-screen md:overflow-hidden">
         <div className="space-y-3 animate-in fade-in duration-500 h-full flex flex-col overflow-y-auto md:overflow-hidden">

            {/* Top Compact Metrics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 shrink-0">
               <Card className="bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] shadow-xl overflow-hidden group">
                  <div className="p-6 relative">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                     <div className="relative z-10 flex flex-col">
                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-60 mb-2">Revenue Today</p>
                        <h3 className="text-3xl font-black text-foreground tracking-tighter">
                           <span className="text-sm mr-1 opacity-40">ETB</span>
                           {stats.totalRevenue.toLocaleString()}
                        </h3>
                     </div>
                     <div className="absolute bottom-4 right-4 p-3 bg-amber-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-500 shadow-inner">
                        <DollarSign className="w-5 h-5 text-amber-500" strokeWidth={3} />
                     </div>
                  </div>
               </Card>

               <Card
                  className="bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] shadow-xl overflow-hidden group cursor-pointer hover:border-primary/50 transition-all"
                  onClick={() => setIsModalOpen(true)}
               >
                  <div className="p-6 relative">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                     <div className="relative z-10 flex flex-col">
                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-60 mb-2">Live Activity</p>
                        <div className="flex items-center gap-3">
                           <h3 className="text-3xl font-black text-foreground tracking-tighter">{stats.activeOrdersCount}</h3>
                           <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse shadow-glow" />
                        </div>
                     </div>
                     <div className="absolute bottom-4 right-4 p-3 bg-blue-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-500 shadow-inner">
                        <Activity className="w-5 h-5 text-blue-500" strokeWidth={3} />
                     </div>
                  </div>
               </Card>

               {/* Stats Row Spacing/Filler */}
               <div className="hidden lg:block lg:col-span-2" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto md:h-full md:min-h-0 md:flex-1 pb-20 md:pb-0">
               {/* Left Col: Live Production Board (Takes 4 cols) */}
               <div className="lg:col-span-4 flex flex-col md:min-h-0 space-y-4 h-[500px] md:h-auto shrink-0">
                  <div className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] p-8 flex flex-col h-full shadow-2xl">
                     <div className="flex items-center justify-between mb-8">
                        <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-3 opacity-60">
                           <LayoutList className="w-4 h-4 text-primary" strokeWidth={3} /> Live System Production
                        </h3>

                        <div className="flex items-center gap-3">
                           <select
                              value={selectedStaffId}
                              onChange={(e) => setSelectedStaffId(e.target.value)}
                              className="bg-muted/10 border border-border rounded-xl px-4 py-2 text-[10px] font-black text-foreground hover:border-primary/30 transition-all outline-none uppercase tracking-widest"
                           >
                              <option value="all">ALL_NODES</option>
                              {staffList.map(s => (
                                 <option key={s.id} value={s.id}>{s.full_name.toUpperCase()}</option>
                              ))}
                           </select>
                           <Button variant="outline" size="icon" onClick={fetchDashboardData} className="h-10 w-10 rounded-xl border-border bg-muted/5">
                              <RefreshCw className={cn("w-4 h-4 text-primary", loading && "animate-spin")} strokeWidth={3} />
                           </Button>
                        </div>
                     </div>

                     <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-4 pr-3">
                        {filteredActiveOrders.length === 0 ? (
                           <div className="h-full flex flex-col items-center justify-center text-muted gap-4 opacity-30 mt-10">
                              <Activity className="w-12 h-12" strokeWidth={3} />
                              <span className="text-[10px] font-black uppercase tracking-[0.4em] italic text-center text-muted">Operational_Clear<br />Wait_State_Active</span>
                           </div>
                        ) : (
                           <div className="space-y-4">
                              {filteredActiveOrders.map(order => (
                                 <div key={order.id} className="w-full">
                                    <OrderCard order={order} role="manager" onAction={handleOrderAction} />
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>
               </div>

               {/* Right Col: Transaction Audit (Takes 8 cols) */}
               <div className="lg:col-span-8 flex flex-col md:min-h-0 h-[600px] md:h-auto shrink-0">
                  <Card className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] flex-1 flex flex-col min-h-0 p-0 overflow-hidden shadow-2xl">
                     <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-8 gap-6 shrink-0 border-b border-border bg-muted/5">
                        <h3 className="flex items-center gap-3 text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-60">
                           <ClipboardList className="w-4 h-4 text-primary" strokeWidth={3} /> Finalized_Node_Audit
                        </h3>

                        <div className="flex flex-wrap items-center gap-4">
                           {/* Search Bar */}
                           <div className="relative group">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" strokeWidth={3} />
                              <input
                                 type="text"
                                 placeholder="AUDIT_QUERY..."
                                 value={searchQuery}
                                 onChange={(e) => setSearchQuery(e.target.value)}
                                 className="bg-muted/10 border border-border rounded-[1.2rem] pl-11 pr-5 py-2.5 text-[10px] text-foreground font-black focus:outline-none focus:border-primary/50 transition-all w-48 uppercase tracking-widest placeholder:opacity-30"
                              />
                           </div>

                           {/* Date Filter */}
                           <div className="flex bg-muted/10 rounded-[1.2rem] p-1.5 border border-border backdrop-blur-md">
                              {(['today', 'yesterday', 'week', 'all'] as const).map((d) => (
                                 <button
                                    key={d}
                                    onClick={() => setDateFilter(d)}
                                    className={cn(
                                       "px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all",
                                       dateFilter === d ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-muted hover:text-foreground opacity-60"
                                    )}
                                 >
                                    {d}
                                 </button>
                              ))}
                           </div>

                           <div className="flex gap-2 pl-4 border-l border-border">
                              {(['all', 'cash', 'digital'] as const).map((filter) => (
                                 <button
                                    key={filter}
                                    onClick={() => setTransactionFilter(filter)}
                                    className={cn(
                                       "px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border",
                                       transactionFilter === filter
                                          ? "bg-primary/10 border-primary/20 text-primary"
                                          : "bg-transparent border-transparent text-muted opacity-60 hover:opacity-100"
                                    )}
                                 >
                                    {filter}
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>

                     <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                           <thead className="sticky top-0 bg-muted/5 border-b border-border text-[9px] font-black uppercase text-muted tracking-widest z-10 backdrop-blur-xl">
                              <tr>
                                 <th className="px-6 py-4">IDENT_VECTOR</th>
                                 <th className="px-6 py-4">SPATIAL_NODE</th>
                                 <th className="px-6 py-4 hidden sm:table-cell">HUMAN_ORIGIN</th>
                                 <th className="px-6 py-4 text-right">GROSS_VAL</th>
                                 <th className="px-6 py-4 text-right">STATUS</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-border">
                              {filteredAuditLog.map(order => (
                                 <tr
                                    key={order.id}
                                    onClick={() => handleRowClick(order)}
                                    className="group hover:bg-muted/5 transition-all cursor-pointer"
                                 >
                                    <td className="px-6 py-5">
                                       <div className="flex flex-col">
                                          <span className="font-mono text-xs font-black text-foreground group-hover:text-primary transition-colors">
                                             #{order.order_number || order.id.slice(0, 4).toUpperCase()}
                                          </span>
                                          <span className="text-[9px] text-muted font-black opacity-40 uppercase tracking-widest">
                                             {new Date(order.closed_at || order.paid_at || order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-5">
                                       <div className="flex flex-col items-start gap-1">
                                          <span className="font-black text-foreground text-xs uppercase italic group-hover:text-primary">T-{order.table_number}</span>
                                          <span className="px-2 py-0.5 text-[8px] bg-primary/5 text-primary border border-primary/10 rounded-full font-black uppercase tracking-tighter opacity-70">{order.order_type || 'DINE-IN'}</span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-5 hidden sm:table-cell">
                                       <div className="flex flex-col">
                                          <span className="text-[10px] text-foreground font-black uppercase italic group-hover:text-primary">{order.waiter?.full_name || 'SYSTEM_NODE'}</span>
                                          <span className="text-[8px] text-muted font-black uppercase tracking-[0.2em] opacity-40">{(order as any).waiter?.role || (order.closed_by_user ? 'ADMIN' : 'STAFF')}</span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-5 text-right font-mono font-black text-foreground text-sm">
                                       <span className="text-[9px] mr-1 opacity-20 font-sans NOT-italic">ETB</span>
                                       {order.total_amount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                       <div className="flex items-center justify-end gap-3">
                                          {order.payment_method && (
                                             <span className="text-[9px] font-black uppercase text-muted bg-muted/10 px-3 py-1 rounded-full border border-border">{order.payment_method}</span>
                                          )}
                                          <span className={cn("text-[9px] uppercase font-black px-3 py-1 rounded-full border tracking-[0.1em]",
                                             order.status === 'paid' ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" :
                                                order.status === 'served' ? "text-purple-500 bg-purple-500/10 border-purple-500/20" : "text-muted bg-muted/5 border-border"
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
                           <div className="text-center py-20 opacity-30 mt-10">
                              <ClipboardList className="w-16 h-16 mx-auto mb-4" strokeWidth={3} />
                              <p className="text-[10px] font-black uppercase tracking-[0.4em]">Zero_Result_Found</p>
                              {searchQuery && (
                                 <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => setSearchQuery('')}
                                    className="text-[10px] font-black text-primary mt-4 uppercase tracking-[0.2em] h-auto p-0"
                                 >
                                    Reset_Global_Query
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
