
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { Order } from '../types';
import { Button, Badge, showToast, cn, Card } from '../components/ui';
import {
   RefreshCw,
   Monitor,
   Terminal,
   Clock,
   CheckCircle2,
   ChefHat,
   LayoutPanelTop
} from 'lucide-react';
import { OrderCard } from '../components/OrderCard';
import { orderService } from '../services/orderService';

const KitchenDashboard: React.FC = () => {
   const [orders, setOrders] = useState<Order[]>([]);
   const [loading, setLoading] = useState(true);
   const [isSyncing, setIsSyncing] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const fetchOrders = useCallback(async () => {
      setIsSyncing(true);
      try {
         const { data, error: fetchErr } = await supabase
            .from('orders')
            .select(`
               *,
               order_items (
                  id,
                  quantity,
                  menu_item:menu (name)
               )
            `)
            .neq('status', 'paid')
            .neq('status', 'closed')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: true });

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
      fetchOrders();
      const channel = supabase.channel('kitchen_sync')
         .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
         .subscribe();
      return () => { supabase.removeChannel(channel); };
   }, [fetchOrders]);

   const handleOrderAction = async (action: string, orderId: string) => {
      try {
         if (action === 'accepted' || action === 'ready') {
            await orderService.updateStatus(orderId, action as any);
            showToast(`Order marked as ${action}`, "success");
         }
         await fetchOrders();
      } catch (err: any) {
         showToast(err.message, "error");
      }
   };

   // Column Logic
   const incomingOrders = useMemo(() => orders.filter(o => o.status === 'pending'), [orders]);
   const acceptedOrders = useMemo(() => orders.filter(o => ['accepted', 'preparing'].includes(o.status)), [orders]);
   const preparedOrders = useMemo(() => orders.filter(o => o.status === 'ready'), [orders]);

   return (
      <DashboardLayout title="Kitchen Display" subtitle="Live Production Board"
         actions={
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
         }
      >
         <div className="space-y-6 animate-in fade-in duration-700 h-full flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 pb-20">
               {/* INCOMING */}
               <div className="flex flex-col min-h-0 bg-black/40 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.1)] relative group hover:border-yellow-500/20 transition-all">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
                  <div className="p-6 border-b border-white/5 bg-black/20 flex items-center justify-between relative z-10">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500/80">Incoming</h3>
                     </div>
                     <Badge variant="default" className="font-mono bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-lg backdrop-blur-md">{incomingOrders.length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-10">
                     {incomingOrders.map(order => (
                        <OrderCard key={order.id} order={order} role="kitchen" onAction={handleOrderAction} />
                     ))}
                     {incomingOrders.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                           <Monitor className="w-12 h-12 text-yellow-500" />
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500">Queue Clear</span>
                        </div>
                     )}
                  </div>
               </div>

               {/* ACCEPTED (PREPARING) */}
               <div className="flex flex-col min-h-0 bg-black/40 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(249,115,22,0.1)] relative group hover:border-orange-500/20 transition-all">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
                  <div className="p-6 border-b border-white/5 bg-black/20 flex items-center justify-between relative z-10">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500/80">Prep Station</h3>
                     </div>
                     <Badge variant="default" className="font-mono bg-orange-500/10 text-orange-500 border-orange-500/20 shadow-lg backdrop-blur-md">{acceptedOrders.length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-10">
                     {acceptedOrders.map(order => (
                        <OrderCard key={order.id} order={order} role="kitchen" onAction={handleOrderAction} />
                     ))}
                     {acceptedOrders.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                           <ChefHat className="w-12 h-12 text-orange-500" />
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Station Idle</span>
                        </div>
                     )}
                  </div>
               </div>

               {/* PREPARED (READY) */}
               <div className="flex flex-col min-h-0 bg-black/40 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(34,197,94,0.1)] relative group hover:border-green-500/20 transition-all">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
                  <div className="p-6 border-b border-white/5 bg-black/20 flex items-center justify-between relative z-10">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-green-500/80">Ready to Serve</h3>
                     </div>
                     <Badge variant="default" className="font-mono bg-green-500/10 text-green-500 border-green-500/20 shadow-lg backdrop-blur-md">{preparedOrders.length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-10">
                     {preparedOrders.map(order => (
                        <OrderCard key={order.id} order={order} role="kitchen" onAction={handleOrderAction} />
                     ))}
                     {preparedOrders.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                           <CheckCircle2 className="w-12 h-12 text-green-500" />
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500">All Cleared</span>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
      </DashboardLayout>
   );
};

export default KitchenDashboard;
