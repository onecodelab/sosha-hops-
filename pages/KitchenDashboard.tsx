
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { SoshaCard } from '../components/SoshaCard';
import { Badge, cn, showToast } from '../components/ui';
import { Clock, CheckCircle2, Flame, Bell, AlertTriangle, Utensils, ChefHat, Timer, AlertOctagon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Order } from '../types';
import { OrderCard } from '../components/OrderCard';
import { ClockInWidget } from '../components/ClockInWidget';

const playNotificationSound = () => {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = 800; gain.gain.value = 0.1;
        osc.start(); setTimeout(() => osc.stop(), 200);
    } catch (e) { console.error(e); }
};

const KitchenDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchOrders();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const sub = supabase.channel('kitchen_orders_sub').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          fetchOrders();
          if (payload.eventType === 'INSERT') { playNotificationSound(); showToast('New Ticket Received!', 'success'); }
        }).subscribe();
    return () => { supabase.removeChannel(sub); clearInterval(timer); }
  }, []);

  const fetchOrders = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items (quantity, special_instructions, menu_items (name, category))`)
        .gte('created_at', `${today}T00:00:00`)
        .in('status', ['pending', 'accepted', 'preparing', 'ready'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (data) setOrders(data as Order[]);
    } catch (err: any) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
      console.error("Kitchen Fetch Error:", errorMsg);
    }
  };

  const handleOrderAction = async (action: string, orderId: string) => {
    const update: any = {};
    if (action === 'accepted') { update.status = 'preparing'; update.accepted_at = new Date().toISOString(); update.preparing_at = new Date().toISOString(); }
    else if (action === 'preparing') { update.status = 'preparing'; update.preparing_at = new Date().toISOString(); }
    else if (action === 'ready') { update.status = 'ready'; update.ready_at = new Date().toISOString(); }

    await supabase.from('orders').update(update).eq('id', orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...update } : o));
    if (update.status === 'ready') showToast(`Order marked READY!`);
  };
  
  const activeCount = orders.filter(o => o.status !== 'ready').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;
  const getElapsed = (d: string) => Math.floor((currentTime.getTime() - new Date(d).getTime()) / 60000);
  const totalMins = orders.reduce((acc, o) => acc + getElapsed(o.created_at), 0);
  const avgPrep = orders.length ? Math.floor(totalMins / orders.length) : 0;
  const delayed = orders.filter(o => getElapsed(o.created_at) > 20).length;

  const stationLoad = orders.filter(o => o.status !== 'ready').flatMap(o => o.order_items || []).reduce((acc: any, item: any) => {
       const cat = item.menu_item?.category || 'General';
       let s = 'General';
       if (['Main', 'Steak', 'Burger', 'Fasting'].some(k => cat.includes(k))) s = 'Grill & Hot';
       else if (['Salad', 'Soup', 'Breakfast'].some(k => cat.includes(k))) s = 'Pantry';
       else if (['Juice', 'Drinks', 'Coffee'].some(k => cat.includes(k))) s = 'Bar';
       acc[s] = (acc[s] || 0) + item.quantity; return acc;
    }, {});
  const stationData = Object.entries(stationLoad).map(([name, count]) => ({ name, count: Number(count) }));
  const loadLevel = stationData.reduce((a, b) => a + b.count, 0) > 30 ? "High" : "Normal";

  return (
    <DashboardLayout title="Kitchen Display" subtitle="Live Production Board">
      <div className="flex flex-col gap-6 w-full animate-in fade-in duration-700">
        
        {/* Shift Control */}
        <ClockInWidget />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 flex-none">
          <SoshaCard className="p-5" indicatorColor="red">
             <div className="flex justify-between items-start">
                <div><p className="text-xs text-gray-500 uppercase font-bold">Active Tickets</p><h3 className="text-3xl font-bold text-white mt-1">{activeCount}</h3></div>
                <div className="p-3 bg-blue-500/10 rounded-xl"><Utensils className="w-6 h-6 text-blue-500" /></div>
             </div>
          </SoshaCard>
          <SoshaCard className="p-5">
             <div className="flex justify-between items-start">
                <div><p className="text-xs text-gray-500 uppercase font-bold">Avg Prep Time</p><div className="flex items-baseline gap-2 mt-1"><h3 className={cn("text-3xl font-bold", avgPrep > 15 ? "text-red-500" : "text-white")}>{avgPrep}m</h3><span className="text-xs text-gray-500">Target: 15m</span></div></div>
                <div className="p-3 bg-purple-500/10 rounded-xl"><Timer className="w-6 h-6 text-purple-500" /></div>
             </div>
          </SoshaCard>
          <SoshaCard className={cn("p-5", delayed > 0 && "border-red-500/50")}>
             <div className="flex justify-between items-start">
                <div><p className="text-xs text-gray-500 uppercase font-bold">Delayed Tickets</p><h3 className={cn("text-3xl font-bold mt-1", delayed > 0 ? "text-red-500" : "text-white")}>{delayed}</h3></div>
                <div className="p-3 bg-red-500/10 rounded-xl"><AlertTriangle className="w-6 h-6 text-red-500" /></div>
             </div>
          </SoshaCard>
          <SoshaCard className="p-5">
             <div className="flex justify-between items-start">
                <div><p className="text-xs text-gray-500 uppercase font-bold">Kitchen Load</p><h3 className={cn("text-3xl font-bold mt-1", loadLevel === 'High' ? "text-red-500" : "text-green-500")}>{loadLevel}</h3></div>
                <div className="p-3 bg-orange-500/10 rounded-xl"><Flame className="w-6 h-6 text-orange-500" /></div>
             </div>
          </SoshaCard>
        </div>

        {/* Ticket Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 min-h-[700px] lg:h-[800px]">
           {/* Queue */}
           <div className="flex flex-col h-full bg-[#0A0A0A]/80 rounded-[2.5rem] border border-white/5 backdrop-blur-md overflow-hidden shadow-2xl">
              <div className="flex-none p-5 border-b border-white/5 bg-white/5 flex justify-between items-center">
                 <h3 className="font-bold text-gray-300 flex items-center gap-2 text-sm uppercase tracking-wider"><Bell className="w-4 h-4" /> Incoming</h3>
                 <Badge className="bg-gray-800 text-white font-mono">{orders.filter(o => o.status === 'pending').length}</Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/20">
                 {orders.filter(o => o.status === 'pending').map(o => <OrderCard key={o.id} order={o} role="kitchen" onAction={handleOrderAction} />)}
              </div>
           </div>
           
           {/* Active Prep */}
           <div className="flex flex-col h-full bg-[#0A0A0A]/80 rounded-[2.5rem] border border-orange-500/20 backdrop-blur-md overflow-hidden shadow-[0_0_50px_rgba(249,115,22,0.1)]">
              <div className="flex-none p-5 border-b border-white/5 bg-orange-500/10 flex justify-between items-center">
                 <h3 className="font-bold text-orange-400 flex items-center gap-2 text-sm uppercase tracking-wider"><Flame className="w-4 h-4" /> Cooking</h3>
                 <Badge className="bg-orange-500/20 text-orange-400 font-mono">{orders.filter(o => ['accepted', 'preparing'].includes(o.status)).length}</Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/20">
                 {orders.filter(o => ['accepted', 'preparing'].includes(o.status)).map(o => <OrderCard key={o.id} order={o} role="kitchen" onAction={handleOrderAction} />)}
              </div>
           </div>
           
           {/* Ready */}
           <div className="flex flex-col h-full bg-[#0A0A0A]/80 rounded-[2.5rem] border border-green-500/20 backdrop-blur-md overflow-hidden shadow-[0_0_50px_rgba(34,197,94,0.05)]">
              <div className="flex-none p-5 border-b border-white/5 bg-green-500/10 flex justify-between items-center">
                 <h3 className="font-bold text-green-500 flex items-center gap-2 text-sm uppercase tracking-wider"><CheckCircle2 className="w-4 h-4" /> Ready</h3>
                 <Badge className="bg-green-500/20 text-green-500 font-mono">{readyCount}</Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/20">
                 {orders.filter(o => o.status === 'ready').map(o => <OrderCard key={o.id} order={o} role="kitchen" />)}
              </div>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default KitchenDashboard;
