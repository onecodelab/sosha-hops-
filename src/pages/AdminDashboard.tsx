
import React, { useEffect, useState, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLayoutConfig } from '../contexts/LayoutContext';
import { BaroCard, BaroCardTitle } from '../components/BaroCard';
import { OrderCard } from '../components/OrderCard';
import {
   TrendingUp, Users, ShoppingBag, AlertTriangle,
   RefreshCw, DollarSign, Activity, ClipboardList, List, Eye, Filter, User, ShieldCheck, Search, Calendar, LayoutList
} from 'lucide-react';
import { cn, Badge, Button, showToast, Card } from '../components/ui';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { Order, UserProfile } from '@/types';
import { useBranch } from '../contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, Brain, ArrowUpRight } from 'lucide-react';

// Lazy load heavy modals to improve mobile PageSpeed
const ActiveOrdersModal = lazy(() => import('../components/ActiveOrdersModal').then(m => ({ default: m.ActiveOrdersModal })));
const PaymentVerificationModal = lazy(() => import('../components/PaymentVerificationModal').then(m => ({ default: m.PaymentVerificationModal })));
const OrderDetailsModal = lazy(() => import('../components/OrderDetailsModal').then(m => ({ default: m.OrderDetailsModal })));

const AdminDashboard: React.FC = () => {
   const { t } = useLanguage();
   const navigate = useNavigate();
   const { activeBranchId } = useBranch();
   const { organizationId, profile } = useAuth();
   const [loading, setLoading] = useState(true);
   const [actionInProgress, setActionInProgress] = useState(false);
   const [activeOrders, setActiveOrders] = useState<Order[]>([]);
   const [allRecentOrders, setAllRecentOrders] = useState<any[]>([]);
   const [staffList, setStaffList] = useState<UserProfile[]>([]);
   const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [isPaymentOpen, setIsPaymentOpen] = useState(false);
   const [stats, setStats] = useState({ totalRevenue: 0, activeOrdersCount: 0 });
   const [orgCredits, setOrgCredits] = useState<{ used: number; max: number; planTier: string } | null>(null);

   const [transactionFilter, setTransactionFilter] = useState<'all' | 'cash' | 'digital'>('all');
   const [selectedDetailsOrder, setSelectedDetailsOrder] = useState<Order | null>(null);
   const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
   const [searchQuery, setSearchQuery] = useState('');
   const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'all'>('today');

   const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   const fetchDashboardData = useCallback(async () => {
      if (!activeBranchId) return;
      try {
         const enrichOrdersWithProfiles = async (orders: any[]) => {
            const profileIds = Array.from(new Set(
               orders.flatMap((order) => [order.waiter_id, order.closed_by_id]).filter(Boolean)
            ));

            if (profileIds.length === 0) return orders;

            const { data: profiles, error: profileErr } = await supabase
               .from('profiles')
               .select('id, full_name, role')
               .in('id', profileIds);

            if (profileErr) throw profileErr;

            const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
            return orders.map((order) => ({
               ...order,
               waiter: order.waiter_id ? profileMap.get(order.waiter_id) || null : null,
               closed_by_user: order.closed_by_id ? profileMap.get(order.closed_by_id) || null : null,
            }));
         };

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
            .in('status', ['closed', 'paid']);

         const { data: active, error: activeErr } = await supabase
            .from('orders')
            .select(`
          *, 
          order_items (
            id,
            quantity, 
            price,
            menu_item:menu!menu_item_id (name)
          )
        `)
            .eq('branch_id', activeBranchId)
            .neq('status', 'paid')
            .neq('status', 'closed')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

         if (activeErr) throw activeErr;
         const activeWithProfiles = await enrichOrdersWithProfiles(active || []);

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
             order_items (
                id,
                quantity,
                price,
                special_instructions,
                menu_item:menu!menu_item_id (name)
             )
          `;

         const fallbackFields = `
             *, 
             order_items (
                id,
                quantity,
                price,
                special_instructions,
                menu_item:menu!menu_item_id (name)
             )
          `;

         let feedData = [];
         try {
            // 1. Try with rich relationships (including closed_by)
            const { data: feed, error: feedErr } = await fetchWithFields(richFields);
            if (feedErr) throw feedErr;
            feedData = await enrichOrdersWithProfiles(feed || []);
         } catch (richErr: any) {
            console.log("Rich query failed, trying simple query:", richErr.message);
            // 2. Fallback to simple (no closed_by join)
            const { data: simpleFeed, error: simpleErr } = await fetchWithFields(fallbackFields);
            if (!simpleErr) {
               feedData = await enrichOrdersWithProfiles(simpleFeed || []);
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
            activeOrdersCount: activeWithProfiles?.filter(o => !['served', 'paid'].includes(o.status)).length || 0
         });

         setActiveOrders(activeWithProfiles as Order[]);
         setAllRecentOrders(feedData);
      } catch (err: any) {
         console.error(err);
      } finally {
         setLoading(false);
      }
   }, [dateFilter, searchQuery]); // Added missing dependencies to prevent stale closure

   const fetchOrgCredits = useCallback(async () => {
      if (!organizationId) return;

      const { data, error } = await supabase
         .from('organizations')
         .select('used_monthly_credits, max_monthly_credits, plan_tier')
         .eq('id', organizationId)
         .single();

      if (data && !error) {
         setOrgCredits({
            used: data.used_monthly_credits || 0,
            max: data.max_monthly_credits || 10000,
            planTier: data.plan_tier || 'basic'
         });
      }
   }, [organizationId]);

   useEffect(() => {
      fetchOrgCredits();
   }, [fetchOrgCredits]);

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

   useLayoutConfig({
      title: t('adminDashboard.title'),
      subtitle: t('adminDashboard.subtitle'),
      className: "p-3 md:p-3 h-full md:h-screen md:overflow-hidden"
   });

   return (
      <>
         <div className="space-y-3 animate-in fade-in duration-500 h-full flex flex-col overflow-y-auto md:overflow-hidden">

            {/* Top Compact Metrics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-4 shrink-0">
               <Card className="bg-card/60 backdrop-blur-xl border border-primary/20 rounded-[1.5rem] shadow-xl overflow-hidden group">
                  <div className="p-4 relative">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                     <div className="relative z-10 flex flex-col">
                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-60 mb-1">{t('adminDashboard.revenueToday')}</p>
                        <h3 className="text-3xl font-black text-foreground tracking-tighter">
                           <span className="text-sm mr-1 opacity-40">{t('adminDashboard.etb')}</span>
                           {stats.totalRevenue.toLocaleString()}
                        </h3>
                     </div>
                     <div className="absolute bottom-4 right-4 p-3 bg-amber-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-500 shadow-inner">
                        <DollarSign className="w-5 h-5 text-amber-500" strokeWidth={3} />
                     </div>
                  </div>
               </Card>

               <Card
                  className="bg-card/60 backdrop-blur-xl border border-primary/20 rounded-[1.5rem] shadow-xl overflow-hidden group cursor-pointer hover:border-primary/50 transition-all"
                  onClick={() => setIsModalOpen(true)}
               >
                  <div className="p-4 relative">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                     <div className="relative z-10 flex flex-col">
                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-60 mb-1">{t('adminDashboard.liveActivity')}</p>
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


               {profile?.role === 'owner' && (
                  <Card className="bg-card/60 backdrop-blur-xl border border-primary/20 rounded-[1.5rem] shadow-xl overflow-hidden group col-span-2 lg:col-span-2">
                     <div className="p-4 flex h-full items-center">
                        <div className="flex-1 space-y-3">
                           <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                   <div className="p-2 bg-primary/10 rounded-lg">
                                       <Brain className="w-4 h-4 text-primary" />
                                   </div>
                                   <div>
                                       <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-60">
                                           {t(`adminDashboard.chatbotUsage.plans.${orgCredits?.planTier as any || 'basic'}`)}
                                       </p>
                                       <p className="text-xs font-bold text-foreground">{t('adminDashboard.chatbotUsage.subtitle')}</p>
                                   </div>
                               </div>
                               <div className="text-right">
                                   <span className="text-lg font-black text-foreground">{Math.floor((orgCredits?.used || 0) / 20)}</span>
                                   <span className="text-[10px] font-bold text-muted ml-1 italic">/ {Math.floor((orgCredits?.max || 10000) / 20)} {t('adminDashboard.chatbotUsage.ordersServed')}</span>
                               </div>
                           </div>
                           
                           {/* Progress Bar */}
                           <div className="space-y-1.5">
                               <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                                   <motion.div 
                                       initial={{ width: 0 }}
                                       animate={{ width: `${Math.min(((orgCredits?.used || 0) / (orgCredits?.max || 10000)) * 100, 100)}%` }}
                                       className={cn(
                                           "h-full rounded-full transition-all duration-1000",
                                           ((orgCredits?.used || 0) / (orgCredits?.max || 10000)) > 0.8 ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]" : 
                                           ((orgCredits?.used || 0) / (orgCredits?.max || 10000)) > 0.5 ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]" :
                                           "bg-primary shadow-[0_0_10px_rgba(163,230,53,0.4)]"
                                       )}
                                   />
                               </div>
                               <div className="flex justify-between items-center">
                                   <p className="text-[9px] font-bold text-muted uppercase tracking-wider">
                                       {((orgCredits?.used || 0) / (orgCredits?.max || 100) * 100).toFixed(0)}% {t('adminDashboard.chatbotUsage.utilized')}
                                   </p>
                                   <button className="text-[9px] font-black text-primary uppercase tracking-[0.2em] hover:underline flex items-center gap-1">
                                       {t('adminDashboard.chatbotUsage.upgrade')} <ArrowUpRight className="w-2.5 h-2.5" />
                                   </button>
                               </div>
                           </div>
                        </div>
                     </div>
                  </Card>
               )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto md:h-full md:min-h-0 md:flex-1 pb-10 md:pb-0">
               {/* Left Col: Live Production Board (Takes 4 cols) */}
               <div className="lg:col-span-4 flex flex-col md:min-h-0 h-[500px] md:h-full shrink-0 order-last lg:order-first">
                  <div className="bg-card/60 backdrop-blur-xl border border-primary/20 rounded-3xl md:rounded-[2.5rem] p-4 md:p-8 flex flex-col h-full shadow-2xl">
                     <div className="flex items-center justify-between mb-8">
                        <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-3 opacity-60">
                           <LayoutList className="w-4 h-4 text-primary" strokeWidth={3} /> {t('adminDashboard.liveSystemProduction')}
                        </h3>

                        <div className="flex items-center gap-3">
                           <div className="relative group">
                              <select
                                 value={selectedStaffId}
                                 onChange={(e) => setSelectedStaffId(e.target.value)}
                                 className="appearance-none bg-white/5 border border-primary/30 rounded-xl px-4 py-2 pr-10 text-[10px] font-black text-foreground hover:border-primary/60 focus:border-primary/60 transition-all outline-none uppercase tracking-widest cursor-pointer backdrop-blur-md shadow-inner"
                              >
                                 <option value="all" className="bg-[#0A0A0A] text-foreground">{t('adminDashboard.allNodes')}</option>
                                 {staffList.map(s => (
                                    <option key={s.id} value={s.id} className="bg-[#0A0A0A] text-foreground">
                                       {s.full_name.toUpperCase()}
                                    </option>
                                 ))}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                 <Filter className="w-3 h-3 text-primary group-hover:text-primary transition-colors" />
                              </div>
                           </div>
                           <Button variant="outline" size="icon" onClick={fetchDashboardData} className="h-10 w-10 rounded-xl border-primary/20 bg-primary/5 shadow-inner hover:bg-primary/10">
                              <RefreshCw className={cn("w-4 h-4 text-primary", loading && "animate-spin")} strokeWidth={3} />
                           </Button>
                        </div>
                     </div>

                     <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-4 pr-3">
                        {filteredActiveOrders.length === 0 ? (
                           <div className="h-full flex flex-col items-center justify-center text-muted gap-4 opacity-30 mt-10">
                              <Activity className="w-12 h-12" strokeWidth={3} />
                              <span className="text-[10px] font-black uppercase tracking-[0.4em] italic text-center text-muted">{t('adminDashboard.operationalClear')}<br />{t('adminDashboard.waitStateActive')}</span>
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
               <div className="lg:col-span-8 flex flex-col md:min-h-0 h-[650px] md:h-full shrink-0 order-first lg:order-last">
                  <Card className="bg-card/60 backdrop-blur-xl border border-primary/20 rounded-3xl md:rounded-[2.5rem] flex-1 flex flex-col min-h-0 p-0 overflow-hidden shadow-2xl">
                     <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-8 gap-4 md:gap-6 shrink-0 border-b border-primary/20 bg-muted/5">
                        <h3 className="flex items-center gap-3 text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-60">
                           <ClipboardList className="w-4 h-4 text-primary" strokeWidth={3} /> {t('adminDashboard.finalizedNodeAudit')}
                        </h3>

                        <div className="flex flex-wrap items-center gap-4">
                           {/* Search Bar */}
                           <div className="relative group">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary group-hover:text-primary transition-colors" strokeWidth={3} />
                              <input
                                 type="text"
                                 placeholder={t('adminDashboard.auditQuery')}
                                 value={searchQuery}
                                 onChange={(e) => setSearchQuery(e.target.value)}
                                 className="bg-white/5 border border-primary/30 rounded-xl pl-11 pr-5 h-10 text-[10px] text-foreground font-black focus:outline-none focus:border-primary/60 hover:border-primary/60 transition-all w-48 uppercase tracking-widest placeholder:text-primary/20 backdrop-blur-md shadow-inner"
                              />
                           </div>

                           {/* Date Filter */}
                           <div className="flex bg-primary/5 rounded-xl p-1 border border-primary/20 backdrop-blur-md">
                              {(['today', 'yesterday', 'week', 'all'] as const).map((d) => (
                                 <button
                                    key={d}
                                    onClick={() => setDateFilter(d)}
                                    className={cn(
                                       "px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                       dateFilter === d ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-muted hover:text-foreground opacity-60"
                                    )}
                                 >
                                    {t(`adminDashboard.filters.${d}`)}
                                 </button>
                              ))}
                           </div>

                           <div className="flex gap-2 pl-4 border-l border-primary/20 h-10 items-center">
                              {(['all', 'cash', 'digital'] as const).map((filter) => (
                                 <button
                                    key={filter}
                                    onClick={() => setTransactionFilter(filter)}
                                    className={cn(
                                       "px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all border h-full flex items-center justify-center",
                                       transactionFilter === filter
                                          ? "bg-primary/10 border-primary/20 text-primary"
                                          : "bg-transparent border-transparent text-muted opacity-60 hover:opacity-100"
                                    )}
                                 >
                                    {t(`adminDashboard.filters.${filter}`)}
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>

                     <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                           <thead className="sticky top-0 bg-muted/5 border-b border-primary/20 text-[9px] font-black uppercase text-muted tracking-widest z-10 backdrop-blur-xl">
                              <tr>
                                 <th className="px-3 md:px-6 py-3 md:py-4">{t('adminDashboard.identVector')}</th>
                                 <th className="px-3 md:px-6 py-3 md:py-4">{t('adminDashboard.spatialNode')}</th>
                                 <th className="px-3 md:px-6 py-3 md:py-4 hidden sm:table-cell">{t('adminDashboard.humanOrigin')}</th>
                                 <th className="px-3 md:px-6 py-3 md:py-4 text-right">{t('adminDashboard.grossVal')}</th>
                                 <th className="px-3 md:px-6 py-3 md:py-4 text-right">{t('adminDashboard.status')}</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-primary/20">
                              {filteredAuditLog.map(order => (
                                 <tr
                                    key={order.id}
                                    onClick={() => handleRowClick(order)}
                                    className="group hover:bg-muted/5 transition-all cursor-pointer"
                                 >
                                    <td className="px-3 md:px-6 py-4 md:py-5">
                                       <div className="flex flex-col">
                                          <span className="font-mono text-xs font-black text-foreground group-hover:text-primary transition-colors whitespace-nowrap">
                                             #{order.order_number || order.id.slice(0, 4).toUpperCase()}
                                          </span>
                                          <span className="text-[9px] text-muted font-black opacity-40 uppercase tracking-widest whitespace-nowrap">
                                             {new Date(order.closed_at || order.paid_at || order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                       </div>
                                    </td>
                                    <td className="px-3 md:px-6 py-4 md:py-5">
                                       <div className="flex flex-col items-start gap-1">
                                          <span className="font-black text-foreground text-xs uppercase italic group-hover:text-primary whitespace-nowrap">T-{order.table_number}</span>
                                          <span className="px-2 py-0.5 text-[8px] bg-primary/5 text-primary border border-primary/10 rounded-full font-black uppercase tracking-tighter opacity-70 whitespace-nowrap">{order.order_type || t('adminDashboard.dineIn')}</span>
                                       </div>
                                    </td>
                                    <td className="px-3 md:px-6 py-4 md:py-5 hidden sm:table-cell">
                                       <div className="flex flex-col">
                                          <span className="text-[10px] text-foreground font-black uppercase italic group-hover:text-primary whitespace-nowrap">{order.waiter?.full_name || t('adminDashboard.systemNode')}</span>
                                          <span className="text-[8px] text-muted font-black uppercase tracking-[0.2em] opacity-40 whitespace-nowrap">{(order as any).waiter?.role || (order.closed_by_user ? t('adminDashboard.adminRole') : t('adminDashboard.staffRole'))}</span>
                                       </div>
                                    </td>
                                    <td className="px-3 md:px-6 py-4 md:py-5 text-right font-mono font-black text-foreground text-sm whitespace-nowrap">
                                       <span className="text-[9px] mr-1 opacity-20 font-sans NOT-italic">{t('adminDashboard.etb')}</span>
                                       {order.total_amount.toLocaleString()}
                                    </td>
                                    <td className="px-3 md:px-6 py-4 md:py-5 text-right">
                                       <div className="flex items-center justify-end gap-2 md:gap-3">
                                          {order.payment_method && (
                                             <span className="text-[9px] font-black uppercase text-muted bg-muted/10 px-3 py-1 rounded-full border border-primary/20 whitespace-nowrap">{order.payment_method}</span>
                                          )}
                                          <span className={cn("text-[9px] uppercase font-black px-3 py-1 rounded-full border tracking-[0.1em] whitespace-nowrap",
                                             order.status === 'paid' ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" :
                                                order.status === 'served' ? "text-purple-500 bg-purple-500/10 border-purple-500/20" : "text-muted bg-muted/5 border-primary/20"
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
                              <p className="text-[10px] font-black uppercase tracking-[0.4em]">{t('adminDashboard.zeroResultFound')}</p>
                              {searchQuery && (
                                 <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => setSearchQuery('')}
                                    className="text-[10px] font-black text-primary mt-4 uppercase tracking-[0.2em] h-auto p-0"
                                 >
                                    {t('adminDashboard.resetGlobalQuery')}
                                 </Button>
                              )}
                           </div>
                        )}
                     </div>
                  </Card>
               </div>
            </div>
         </div>

         <Suspense fallback={null}>
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
         </Suspense>
      </>
   );
};

export default AdminDashboard;
