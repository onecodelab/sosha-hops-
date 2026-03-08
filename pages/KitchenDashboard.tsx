
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
                  menu_item:menu (name)
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
   const acceptedOrders = useMemo(() => orders.filter(o => ['accepted', 'preparing'].includes(o.status)), [orders]);
   const preparedOrders = useMemo(() => orders.filter(o => o.status === 'ready'), [orders]);

   useLayoutConfig({
      title: "Kitchen Display",
      subtitle: "Live Production Board",
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
         <div className="space-y-6 animate-in fade-in duration-700 h-full flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0 pb-20">
               {/* INCOMING */}
               <div className="flex flex-col min-h-0 bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] overflow-hidden shadow-2xl relative group hover:border-yellow-500/30 transition-all">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
                  <div className="p-8 border-b border-border bg-muted/5 flex items-center justify-between relative z-10">
                     <div className="flex items-center gap-4">
                        <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-yellow-500">Incoming</h3>
                     </div>
                     <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 px-4 py-1.5 font-mono text-xs font-black shadow-lg">{incomingOrders.length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
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
               <div className="flex flex-col min-h-0 bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] overflow-hidden shadow-2xl relative group hover:border-orange-500/30 transition-all">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
                  <div className="p-8 border-b border-border bg-muted/5 flex items-center justify-between relative z-10">
                     <div className="flex items-center gap-4">
                        <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500">Prep Station</h3>
                     </div>
                     <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-4 py-1.5 font-mono text-xs font-black shadow-lg">{acceptedOrders.length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
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
               <div className="flex flex-col min-h-0 bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] overflow-hidden shadow-2xl relative group hover:border-emerald-500/30 transition-all">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
                  <div className="p-8 border-b border-border bg-muted/5 flex items-center justify-between relative z-10">
                     <div className="flex items-center gap-4">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500">Ready to Serve</h3>
                     </div>
                     <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-4 py-1.5 font-mono text-xs font-black shadow-lg">{preparedOrders.length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
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
