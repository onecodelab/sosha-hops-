
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLayoutConfig } from '../contexts/LayoutContext';
import { supabase } from '../supabase';
import { useBranch } from '../contexts/BranchContext';
import { Order } from '../types';
import { Button, Badge, showToast, cn, Card } from '../components/ui';
import {
   RefreshCw,
   Monitor,
   Terminal,
   Clock,
   CheckCircle2,
   ChefHat,
   LayoutPanelTop,
   Truck
} from 'lucide-react';
import { OrderCard } from '../components/OrderCard';
import { orderService } from '../services/orderService';

const KitchenDashboard: React.FC = () => {
   const { activeBranchId } = useBranch();
   const [orders, setOrders] = useState<Order[]>([]);
   const [loading, setLoading] = useState(true);
   const [isSyncing, setIsSyncing] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const fetchOrders = useCallback(async () => {
      setIsSyncing(true);
      try {
         // SACRED RULE: Strict Branch Isolation
         if (!activeBranchId) {
            setOrders([]);
            setLoading(false);
            setIsSyncing(false);
            return;
         }

         let query = supabase
            .from('orders')
            .select(`
               *,
               waiter:profiles!orders_waiter_id_fkey (full_name),
               order_items (
                  id,
                  quantity,
                  price,
                  special_instructions,
                  created_at,
                  menu_item:menu!menu_item_id (name)
               )
            `)
            .eq('branch_id', activeBranchId)
            .neq('status', 'paid')
            .neq('status', 'closed')
            .neq('status', 'cancelled');

         const { data, error: fetchErr } = await query.order('created_at', { ascending: true });

         if (fetchErr) throw fetchErr;
         setOrders(data || []);
         setError(null);
      } catch (err: any) {
         console.error("Kitchen fetch error:", err);
         setError(err.message);
         showToast(err.message, "error");
      } finally {
         setLoading(false);
         setIsSyncing(false);
      }
   }, []);

   useEffect(() => {
      if (!activeBranchId) return;

      fetchOrders();

      const filter = `branch_id=eq.${activeBranchId}`;
      const channel = supabase.channel(`kitchen_sync_${activeBranchId}`)
         .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: filter
         }, () => fetchOrders())
         .subscribe();
      return () => { supabase.removeChannel(channel); };
   }, [fetchOrders, activeBranchId]);

   const handleOrderAction = async (action: string, orderId: string) => {
      try {
         if (action === 'accepted' || action === 'ready') {
            await orderService.updateStatus(orderId, action as any);
            showToast(`Order marked as ${action}`, "success");
         } else if (action === 'dispatch') {
            await orderService.dispatchForDelivery(orderId);
            showToast(`Order dispatched for delivery`, "success");
         }
         await fetchOrders();
      } catch (err: any) {
         showToast(err.message, "error");
      }
   };

   // Column Logic
   const incomingOrders = useMemo(() =>
      orders.filter(o => o.status === 'pending' && !(o.source === 'chatbot' && !o.waiter_id)),
      [orders]);
   const acceptedOrders = useMemo(() =>
      orders.filter(o => ['accepted', 'preparing'].includes(o.status) && !(o.source === 'chatbot' && !o.waiter_id)),
      [orders]);
   const preparedOrders = useMemo(() => orders.filter(o => o.status === 'ready'), [orders]);

   useLayoutConfig({
      title: "Kitchen Display",
      subtitle: "Live Production Board",
      className: "p-4 md:p-4 flex flex-col min-h-0 overflow-hidden h-full",
      actions: (
         <div className="flex gap-2">
            {error && (
               <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl text-red-500 text-[10px] font-black uppercase">
                  <Terminal className="w-3 h-3" /> Schema Error: {error.slice(0, 30)}...
               </div>
            )}
            <Button onClick={fetchOrders} variant="outline" size="sm" className="bg-white/5 border-white/10 h-10 px-4">
               <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
               Force Reload
            </Button>
         </div>
      )
   });

   return (
      <>
         <div className="flex-1 min-h-0 animate-in fade-in duration-700">
            <div className="flex lg:grid overflow-x-auto lg:overflow-visible lg:grid-cols-3 gap-4 md:gap-6 h-full min-h-0 snap-x snap-mandatory no-scrollbar lg:custom-scrollbar pb-2 -mx-4 px-4 lg:-mx-0 lg:px-0">
               {/* INCOMING */}
               <div className="w-[85vw] lg:w-auto shrink-0 snap-center flex flex-col min-h-0 bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] overflow-hidden shadow-2xl relative group hover:border-yellow-500/30 transition-all h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
                  <div className="px-5 py-4 border-b border-border bg-muted/5 flex items-center justify-between relative z-10 shrink-0">
                     <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.5)] shrink-0" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.4em] text-yellow-500 truncate">Incoming</h3>
                     </div>
                     <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 px-3 md:px-4 py-1.5 font-mono text-[10px] md:text-xs font-black shadow-lg shrink-0">
                        {incomingOrders.length}
                     </Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative z-10">
                     {incomingOrders.map(order => (
                        <OrderCard key={order.id} order={order} role="kitchen" onAction={handleOrderAction} />
                     ))}
                     {incomingOrders.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 gap-6">
                           <div className="p-6 bg-yellow-500/10 rounded-full">
                              <Monitor className="w-12 h-12 text-yellow-500" />
                           </div>
                           <span className="text-[10px] font-black uppercase tracking-[0.4em] text-yellow-500">Queue Clear</span>
                        </div>
                     )}
                  </div>
               </div>

               {/* ACCEPTED (PREPARING) */}
               <div className="w-[85vw] lg:w-auto shrink-0 snap-center flex flex-col min-h-0 bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] overflow-hidden shadow-2xl relative group hover:border-orange-500/30 transition-all h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
                  <div className="px-5 py-4 border-b border-border bg-muted/5 flex items-center justify-between relative z-10 shrink-0">
                     <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)] shrink-0" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.4em] text-orange-500 truncate">Prep Station</h3>
                     </div>
                     <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-3 md:px-4 py-1.5 font-mono text-[10px] md:text-xs font-black shadow-lg shrink-0">
                        {acceptedOrders.length}
                     </Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative z-10">
                     {acceptedOrders.map(order => (
                        <OrderCard key={order.id} order={order} role="kitchen" onAction={handleOrderAction} />
                     ))}
                     {acceptedOrders.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 gap-6">
                           <div className="p-6 bg-orange-500/10 rounded-full">
                              <ChefHat className="w-12 h-12 text-orange-500" />
                           </div>
                           <span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500">Station Idle</span>
                        </div>
                     )}
                  </div>
               </div>

               {/* PREPARED (READY) */}
               <div className="w-[85vw] lg:w-auto shrink-0 snap-center flex flex-col min-h-0 bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] overflow-hidden shadow-2xl relative group hover:border-emerald-500/30 transition-all h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
                  <div className="px-5 py-4 border-b border-border bg-muted/5 flex items-center justify-between relative z-10 shrink-0">
                     <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] shrink-0" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.4em] text-emerald-500 truncate">Ready to Serve</h3>
                     </div>
                     <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 md:px-4 py-1.5 font-mono text-[10px] md:text-xs font-black shadow-lg shrink-0">
                        {preparedOrders.length}
                     </Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative z-10">
                     {preparedOrders.map(order => (
                        <OrderCard key={order.id} order={order} role="kitchen" onAction={handleOrderAction} />
                     ))}
                     {preparedOrders.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 gap-6">
                           <div className="p-6 bg-emerald-500/10 rounded-full">
                              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                           </div>
                           <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500">All Cleared</span>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
      </>
   );
};

export default KitchenDashboard;
