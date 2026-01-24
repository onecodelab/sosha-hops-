
import React, { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { useBranch } from '../contexts/BranchContext';
import { Badge, cn, showToast, Button } from '../components/ui';
import {
   Clock, CheckCircle2, RefreshCw, AlertTriangle,
   ChefHat, Loader2, Info, WifiOff, LayoutPanelTop, Terminal
} from 'lucide-react';
import { Order } from '../types';
import { OrderCard } from '../components/OrderCard';

const KitchenDashboard: React.FC = () => {
   const { activeBranchId } = useBranch();
   const [orders, setOrders] = useState<Order[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [isSyncing, setIsSyncing] = useState(false);

   const fetchOrders = useCallback(async () => {
      setIsSyncing(true);
      try {
         // MASTER KITCHEN QUERY - Filtered by Branch
         let query = supabase
            .from('orders')
            .select(`
          id, 
          order_number, 
          table_id, 
          table_number, 
          status, 
          total_amount, 
          created_at, 
          waiter_id,
          source,
          payment_status,
          customer_notes,
          waiter:profiles!waiter_id (full_name),
          order_items (
            id, 
            order_id,
            menu_id:menu_item_id,
            price,
            quantity, 
            special_instructions,
            menu_item:menu (name)
          )
        `)
            .is('closed_at', null)
            .in('status', ['pending', 'accepted', 'preparing', 'ready'])
            .order('created_at', { ascending: true });

         if (activeBranchId) {
            query = query.eq('branch_id', activeBranchId);
         }

         const { data, error: fetchError } = await query;

         if (fetchError) throw fetchError;

         setOrders(data as unknown as Order[] || []);
         setError(null);
      } catch (err: any) {
         console.error("Kitchen Sync Error Details:", err);
         setError(err.message || 'Database connection error');
         showToast("Kitchen Sync Failed", "error");
      } finally {
         setLoading(false);
         setIsSyncing(false);
      }
   }, [activeBranchId]);

   useEffect(() => {
      fetchOrders();

      // Multi-table real-time listener for maximum reliability
      const channel = supabase.channel('kitchen_live_v7')
         .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
            console.debug("Kitchen: Orders updated, refreshing...");
            fetchOrders();
         })
         .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
            console.debug("Kitchen: Items updated, refreshing...");
            fetchOrders();
         })
         .subscribe();

      return () => { supabase.removeChannel(channel); };
   }, [fetchOrders]);

   const handleOrderAction = async (action: string, orderId: string) => {
      const now = new Date().toISOString();
      const update: any = { last_updated: now };

      if (action === 'accepted') {
         update.status = 'preparing';
         update.accepted_at = now;
      } else if (action === 'ready') {
         update.status = 'ready';
         update.ready_at = now;
      }

      try {
         const { error } = await supabase.from('orders').update(update).eq('id', orderId);
         if (error) throw error;
         showToast(`Kitchen status updated`, "success");
         fetchOrders();
      } catch (err: any) {
         showToast(err.message, "error");
      }
   };

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
         <div className="space-y-6 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 min-h-[750px]">
               {/* Column: Incoming */}
               <div className="flex flex-col h-full bg-card/60 backdrop-blur-xl rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                     <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                        <h3 className="font-black text-gray-400 text-[11px] uppercase tracking-[0.2em]">Incoming</h3>
                     </div>
                     <Badge className="bg-yellow-500 text-black font-black px-3 py-1 rounded-full">{orders.filter(o => o.status === 'pending').length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                     {orders.filter(o => o.status === 'pending').map(o => (
                        <OrderCard key={o.id} order={o} role="kitchen" onAction={handleOrderAction} />
                     ))}
                     {orders.filter(o => o.status === 'pending').length === 0 && <EmptyState label="Queue is empty" icon={LayoutPanelTop} />}
                  </div>
               </div>

               {/* Column: Accepted */}
               <div className="flex flex-col h-full bg-card/60 backdrop-blur-xl rounded-[3rem] border border-orange-500/20 overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-white/5 flex justify-between items-center bg-orange-500/5">
                     <div className="flex items-center gap-3">
                        <ChefHat className="w-4 h-4 text-orange-500" />
                        <h3 className="font-black text-orange-500/70 text-[11px] uppercase tracking-[0.2em]">Accepted</h3>
                     </div>
                     <Badge className="bg-orange-500 text-black font-black px-3 py-1 rounded-full">{orders.filter(o => ['accepted', 'preparing'].includes(o.status)).length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                     {orders.filter(o => ['accepted', 'preparing'].includes(o.status)).map(o => (
                        <OrderCard key={o.id} order={o} role="kitchen" onAction={handleOrderAction} />
                     ))}
                     {orders.filter(o => ['accepted', 'preparing'].includes(o.status)).length === 0 && <EmptyState label="No accepted orders" icon={ChefHat} />}
                  </div>
               </div>

               {/* Column: Prepared */}
               <div className="flex flex-col h-full bg-card/60 backdrop-blur-xl rounded-[3rem] border border-green-500/20 overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-white/5 flex justify-between items-center bg-green-500/5">
                     <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <h3 className="font-black text-green-500/70 text-[11px] uppercase tracking-[0.2em]">Prepared</h3>
                     </div>
                     <Badge className="bg-green-500 text-black font-black px-3 py-1 rounded-full">{orders.filter(o => o.status === 'ready').length}</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                     {orders.filter(o => o.status === 'ready').map(o => (
                        <OrderCard key={o.id} order={o} role="kitchen" />
                     ))}
                     {orders.filter(o => o.status === 'ready').length === 0 && <EmptyState label="Preparation clear" icon={CheckCircle2} />}
                  </div>
               </div>
            </div>
         </div>
      </DashboardLayout>
   );
};

const EmptyState = ({ label, icon: Icon }: { label: string, icon: any }) => (
   <div className="h-40 flex flex-col items-center justify-center text-gray-700 opacity-20 py-10 transition-opacity group-hover:opacity-40">
      <Icon className="w-12 h-12 mb-4" />
      <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
   </div>
);

export default KitchenDashboard;
