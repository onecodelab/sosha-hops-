
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
   Truck,
   Bell,
   X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OrderCard } from '../components/OrderCard';
import { orderService } from '../services/orderService';

interface KitchenNotification {
   id: string;
   orderNumber: string;
   tableNumber: string;
   itemCount: number;
   type: 'new' | 'update';
}

const KitchenDashboard: React.FC = () => {
   const { activeBranchId } = useBranch();
   const [orders, setOrders] = useState<Order[]>([]);
   const [loading, setLoading] = useState(true);
   const [isSyncing, setIsSyncing] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [notifications, setNotifications] = useState<KitchenNotification[]>([]);

   const ordersRef = useRef<Order[]>([]);
   const isFirstLoadRef = useRef(true);
   const notifiedKeysRef = useRef<Set<string>>(new Set());

   // Sync ref with orders state
   useEffect(() => {
      ordersRef.current = orders;
   }, [orders]);

   const playNotificationSound = () => {
      try {
         const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
         
         if (audioCtx.state === 'suspended') {
            audioCtx.resume();
         }

         // Upward C-major triad chime
         // Note 1: C5 (523.25 Hz)
         const osc1 = audioCtx.createOscillator();
         const gain1 = audioCtx.createGain();
         osc1.type = 'sine';
         osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime);
         gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
         gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
         osc1.connect(gain1);
         gain1.connect(audioCtx.destination);
         osc1.start();
         osc1.stop(audioCtx.currentTime + 0.35);

         // Note 2: E5 (659.25 Hz) after 90ms
         setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime);
            gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start();
            osc2.stop(audioCtx.currentTime + 0.4);
         }, 90);

         // Note 3: G5 (783.99 Hz) after 180ms
         setTimeout(() => {
            const osc3 = audioCtx.createOscillator();
            const gain3 = audioCtx.createGain();
            osc3.type = 'sine';
            osc3.frequency.setValueAtTime(783.99, audioCtx.currentTime);
            gain3.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain3.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.55);
            osc3.connect(gain3);
            gain3.connect(audioCtx.destination);
            osc3.start();
            osc3.stop(audioCtx.currentTime + 0.55);
         }, 180);
      } catch (e) {
         console.warn("Failed to play sound:", e);
      }
   };

   const triggerNewOrderNotification = (order: Order, isUpdate: boolean) => {
      // 1. Play sound
      playNotificationSound();

      // 2. Add notification card
      const id = Math.random().toString(36).substring(2, 11);
      const newNotification: KitchenNotification = {
         id,
         orderNumber: order.order_number,
         tableNumber: order.table_number || 'N/A',
         itemCount: order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
         type: isUpdate ? 'update' : 'new'
      };

      setNotifications(prev => [newNotification, ...prev]);

      // 3. Auto-remove after 8 seconds
      setTimeout(() => {
         setNotifications(prev => prev.filter(n => n.id !== id));
      }, 8000);
   };

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

         const data = await orderService.fetchActiveOrders(activeBranchId);
         
         // Compare to trigger notifications/sound
         if (!isFirstLoadRef.current) {
            data.forEach(newOrder => {
               const prevOrder = ordersRef.current.find(o => o.id === newOrder.id);
               const isIncoming = newOrder.status === 'pending' && !(newOrder.source === 'chatbot' && !newOrder.waiter_id);
               
               if (isIncoming) {
                  const itemsCount = newOrder.order_items?.length || 0;
                  if (!prevOrder) {
                     // New order
                     const key = `new-order-${newOrder.id}`;
                     if (!notifiedKeysRef.current.has(key)) {
                        notifiedKeysRef.current.add(key);
                        triggerNewOrderNotification(newOrder, false);
                     }
                  } else {
                     // Existing order - check if new items were appended
                     const prevItemsCount = prevOrder.order_items?.length || 0;
                     if (itemsCount > prevItemsCount) {
                        const key = `update-order-${newOrder.id}-${itemsCount}`;
                        if (!notifiedKeysRef.current.has(key)) {
                           notifiedKeysRef.current.add(key);
                           triggerNewOrderNotification(newOrder, true);
                        }
                     }
                  }
               }
            });
         } else {
            isFirstLoadRef.current = false;
         }

         setOrders(data);
         setError(null);
      } catch (err: any) {
         console.error("Kitchen fetch error:", err);
         setError(err.message);
         showToast(err.message, "error");
      } finally {
         setLoading(false);
         setIsSyncing(false);
      }
   }, [activeBranchId]);

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
         .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'order_items'
         }, () => fetchOrders())
         .subscribe();

      const interval = setInterval(() => {
         fetchOrders();
      }, 5000);

      return () => {
         supabase.removeChannel(channel);
         clearInterval(interval);
      };
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
   const preparedOrders = useMemo(() =>
      orders.filter(o => o.status === 'ready' && !(o.source === 'chatbot' && !o.waiter_id)),
      [orders]
   );

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
            <Button onClick={fetchOrders} variant="outline" size="sm" className="bg-primary/5 border-primary/20 h-10 px-4">
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
               <div className="w-[85vw] lg:w-auto shrink-0 snap-center flex flex-col min-h-0 bg-card/60 backdrop-blur-xl border border-primary/20 rounded-[2rem] overflow-hidden shadow-2xl relative group hover:border-yellow-500/30 transition-all h-full">
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
               <div className="w-[85vw] lg:w-auto shrink-0 snap-center flex flex-col min-h-0 bg-card/60 backdrop-blur-xl border border-primary/20 rounded-[2rem] overflow-hidden shadow-2xl relative group hover:border-orange-500/30 transition-all h-full">
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
               <div className="w-[85vw] lg:w-auto shrink-0 snap-center flex flex-col min-h-0 bg-card/60 backdrop-blur-xl border border-primary/20 rounded-[2rem] overflow-hidden shadow-2xl relative group hover:border-emerald-500/30 transition-all h-full">
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

         {/* Floating Notification Sidebar Stack */}
         <div className="fixed top-24 right-6 z-50 flex flex-col gap-3 w-80 max-w-[calc(100vw-3rem)] pointer-events-none">
            <style>{`
               @keyframes shrink-progress {
                  from { width: 100%; }
                  to { width: 0%; }
               }
            `}</style>
            <AnimatePresence>
               {notifications.map(notification => (
                  <motion.div
                     key={notification.id}
                     initial={{ opacity: 0, x: 100, scale: 0.9 }}
                     animate={{ opacity: 1, x: 0, scale: 1 }}
                     exit={{ opacity: 0, x: 100, scale: 0.9 }}
                     transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                     className="pointer-events-auto bg-card/90 backdrop-blur-xl border border-primary/30 rounded-2xl p-4 shadow-2xl relative overflow-hidden flex gap-3 hover:border-primary/50 transition-all duration-300"
                  >
                     {/* Progress bar */}
                     <div 
                        className="absolute bottom-0 left-0 h-1 bg-primary/80" 
                        style={{ animation: 'shrink-progress 8s linear forwards' }} 
                     />
                     
                     <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
                        <Bell className="w-5 h-5 animate-[bounce_1.5s_infinite]" />
                     </div>

                     <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                              {notification.type === 'new' ? 'New Order!' : 'Order Updated!'}
                           </span>
                           <button
                              onClick={() => {
                                 setNotifications(prev => prev.filter(n => n.id !== notification.id));
                              }}
                              className="text-muted hover:text-foreground transition-colors p-0.5"
                           >
                              <X className="w-3.5 h-3.5" />
                           </button>
                        </div>
                        <h4 className="text-sm font-bold text-foreground mt-0.5 font-sans leading-tight">
                           Table {notification.tableNumber}
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-1 flex justify-between font-mono">
                           <span>{notification.itemCount} items</span>
                           <span>{notification.orderNumber.substring(0, 15)}</span>
                        </p>
                     </div>
                  </motion.div>
               ))}
            </AnimatePresence>
         </div>
      </>
   );
};

export default KitchenDashboard;
