
import React, { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { SoshaCard } from '../components/SoshaCard';
import { Badge, cn, showToast, Button } from '../components/ui';
import { Clock, CheckCircle2, Flame, Bell, AlertTriangle, Utensils, Timer, RefreshCw, ServerCrash, HelpCircle } from 'lucide-react';
import { Order } from '../types';
import { OrderCard } from '../components/OrderCard';

const KitchenDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const today = new Date().toISOString().split('T')[0];
      
      // EXPLICIT JOIN SYNTAX: We use !constraint_name to tell Supabase exactly which link to follow
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *, 
          waiter:profiles!orders_waiter_id_fkey (full_name),
          order_items (
            id,
            quantity, 
            special_instructions, 
            menu_item:menu_items!order_items_menu_item_id_fkey (name)
          )
        `)
        .gte('created_at', `${today}T00:00:00`)
        .in('status', ['pending', 'accepted', 'preparing', 'ready'])
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      
      const normalizedOrders = (data || []).map((o: any) => ({
        ...o,
        waiter: o.waiter ? (Array.isArray(o.waiter) ? o.waiter[0] : o.waiter) : null,
        order_items: (o.order_items || []).map((item: any) => ({
          ...item,
          menu_item: item.menu_item ? (Array.isArray(item.menu_item) ? item.menu_item[0] : item.menu_item) : null
        }))
      }));

      setOrders(normalizedOrders as Order[]);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const sub = supabase.channel('kitchen_v5').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders()).subscribe();
    return () => { supabase.removeChannel(sub); clearInterval(timer); };
  }, [fetchOrders]);

  const handleOrderAction = async (action: string, orderId: string) => {
    const update: any = { last_updated: new Date().toISOString() };
    if (action === 'accepted') update.status = 'preparing';
    else if (action === 'ready') update.status = 'ready';

    try {
      const { error } = await supabase.from('orders').update(update).eq('id', orderId);
      if (error) throw error;
      fetchOrders();
    } catch (err: any) { showToast(err.message, "error"); }
  };
  
  if (error) {
    return (
      <DashboardLayout title="Kitchen Display" subtitle="System Diagnostics">
        <div className="flex flex-col items-center justify-center h-[70vh] gap-6 max-w-2xl mx-auto px-6">
           <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-[3rem] text-red-500">
              <ServerCrash className="w-16 h-16" />
           </div>
           <div className="text-center">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Database Mapping Error</h2>
              <p className="text-gray-400 mt-4 text-sm leading-relaxed">
                The database link between <b>Order Items</b> and <b>Menu Items</b> is ambiguous. 
                Please ensure you have run the provided SQL fix in your Supabase dashboard.
              </p>
              <div className="mt-8 p-6 bg-white/[0.02] border border-white/10 rounded-2xl text-left">
                <div className="font-mono text-[10px] text-gray-500 break-all">
                   <p><span className="text-white">Code:</span> {error.code}</p>
                   <p><span className="text-white">Message:</span> {error.message}</p>
                </div>
              </div>
           </div>
           <Button onClick={fetchOrders} className="w-full bg-primary text-black font-black h-12">
              <RefreshCw className="w-4 h-4 mr-2" /> Retry Connection
           </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Kitchen Display" subtitle="Live Production Board">
      <div className="flex flex-col gap-6 w-full animate-in fade-in duration-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-[800px]">
           <div className="flex flex-col h-full bg-card rounded-[2.5rem] border border-white/5 overflow-hidden">
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                 <h3 className="font-black text-gray-300 text-[10px] uppercase tracking-widest">Incoming</h3>
                 <Badge>{orders.filter(o => o.status === 'pending').length}</Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                 {orders.filter(o => o.status === 'pending').map(o => <OrderCard key={o.id} order={o} role="kitchen" onAction={handleOrderAction} />)}
              </div>
           </div>
           <div className="flex flex-col h-full bg-card rounded-[2.5rem] border border-orange-500/20 overflow-hidden">
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-orange-500/10 text-orange-400">
                 <h3 className="font-black text-[10px] uppercase tracking-widest">Preparing</h3>
                 <Badge className="bg-orange-500/20 text-orange-400">{orders.filter(o => ['accepted', 'preparing'].includes(o.status)).length}</Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                 {orders.filter(o => ['accepted', 'preparing'].includes(o.status)).map(o => <OrderCard key={o.id} order={o} role="kitchen" onAction={handleOrderAction} />)}
              </div>
           </div>
           <div className="flex flex-col h-full bg-card rounded-[2.5rem] border border-green-500/20 overflow-hidden">
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-green-500/10 text-green-500">
                 <h3 className="font-black text-[10px] uppercase tracking-widest">Ready</h3>
                 <Badge className="bg-green-500/20 text-green-500">{orders.filter(o => o.status === 'ready').length}</Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                 {orders.filter(o => o.status === 'ready').map(o => <OrderCard key={o.id} order={o} role="kitchen" />)}
              </div>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default KitchenDashboard;
