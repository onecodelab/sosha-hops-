import React, { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { Card, Badge, cn, showToast } from '../components/ui';
import { 
  Clock, CheckCircle2, Flame, Bell, AlertTriangle, 
  Utensils, ChefHat, Timer, AlertOctagon 
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Order } from '../types';
import { OrderCard } from '../components/OrderCard';

// Simple beep for notification
const playNotificationSound = () => {
    try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;
        oscillator.start();
        setTimeout(() => oscillator.stop(), 200);
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

const KitchenDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchOrders();

    // Update timers every minute
    const timerInterval = setInterval(() => setCurrentTime(new Date()), 60000);

    const subscription = supabase
      .channel('kitchen_orders_sub')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'orders' }, 
        (payload) => {
          fetchOrders();
          if (payload.eventType === 'INSERT') {
             playNotificationSound();
             showToast('🔔 New Ticket Received!', 'success');
          }
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(subscription); 
      clearInterval(timerInterval);
    }
  }, []);

  const fetchOrders = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          special_instructions,
          menu_item:menu (name, category)
        )
      `)
      .gte('created_at', `${today}T00:00:00`)
      .in('status', ['pending', 'accepted', 'preparing', 'ready'])
      .order('created_at', { ascending: true }); // FIFO

    if (data) setOrders(data as Order[]);
  };

  const handleOrderAction = async (action: string, orderId: string) => {
    const update: any = {};
    if (action === 'accepted') {
        update.status = 'preparing';
        update.accepted_at = new Date().toISOString();
        update.preparing_at = new Date().toISOString();
    } else if (action === 'preparing') {
        update.status = 'preparing';
        update.preparing_at = new Date().toISOString();
    } else if (action === 'ready') {
        update.status = 'ready';
        update.ready_at = new Date().toISOString();
    }

    await supabase.from('orders').update(update).eq('id', orderId);
    
    // Optimistic Update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...update } : o));
    
    if (update.status === 'ready') showToast(`Order marked READY!`);
  };

  // --- KPI Calculations ---
  
  const activeCount = orders.filter(o => o.status !== 'ready').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;
  
  const getElapsedMinutes = (dateStr: string) => {
    const start = new Date(dateStr).getTime();
    const now = currentTime.getTime();
    return Math.floor((now - start) / 60000);
  };

  const totalMinutes = orders.reduce((acc, o) => acc + getElapsedMinutes(o.created_at), 0);
  const avgPrepTime = orders.length ? Math.floor(totalMinutes / orders.length) : 0;
  const delayedCount = orders.filter(o => getElapsedMinutes(o.created_at) > 20).length;

  // Station Load
  const stationLoad = orders
    .filter(o => o.status !== 'ready')
    .flatMap(o => o.order_items || [])
    .reduce((acc: any, item: any) => {
       const cat = item.menu_item?.category || 'General';
       let station = 'General';
       if (['Main', 'Steak', 'Burger', 'Fasting'].some(k => cat.includes(k))) station = 'Grill & Hot';
       else if (['Salad', 'Soup', 'Breakfast'].some(k => cat.includes(k))) station = 'Pantry/Salad';
       else if (['Juice', 'Drinks', 'Coffee'].some(k => cat.includes(k))) station = 'Bar';
       
       acc[station] = (acc[station] || 0) + item.quantity;
       return acc;
    }, {});

  const stationData = Object.entries(stationLoad).map(([name, count]) => ({ name, count: Number(count) }));

  // Kitchen Load Level
  const totalItems = stationData.reduce((a, b) => a + b.count, 0);
  const loadLevel = totalItems > 30 ? "High" : totalItems > 15 ? "Normal" : "Low";
  const loadColor = loadLevel === "High" ? "text-red-500" : loadLevel === "Normal" ? "text-yellow-500" : "text-green-500";

  return (
    <DashboardLayout title="Kitchen Display System" subtitle="Live Production Board">
      <div className="grid grid-rows-[auto_1fr_auto] h-[calc(100vh-140px)] gap-4 w-full">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-none">
          <Card className="bg-[#1A1A1A] border-gray-800 p-4">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold">Active Tickets</p>
                   <h3 className="text-2xl font-bold text-white mt-1">{activeCount}</h3>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-full">
                   <Utensils className="w-5 h-5 text-blue-500" />
                </div>
             </div>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800 p-4">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold">Avg Prep Time</p>
                   <div className="flex items-baseline gap-2 mt-1">
                      <h3 className={cn("text-2xl font-bold", avgPrepTime > 15 ? "text-red-500" : "text-white")}>
                         {avgPrepTime}m
                      </h3>
                      <span className="text-xs text-gray-500">Target: 15m</span>
                   </div>
                </div>
                <div className="p-2 bg-purple-500/10 rounded-full">
                   <Timer className="w-5 h-5 text-purple-500" />
                </div>
             </div>
          </Card>
          <Card className={cn("bg-[#1A1A1A] border-gray-800 p-4", delayedCount > 0 && "border-red-500/50")}>
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold">Delayed Tickets</p>
                   <h3 className={cn("text-2xl font-bold mt-1", delayedCount > 0 ? "text-red-500" : "text-white")}>
                      {delayedCount}
                   </h3>
                </div>
                <div className="p-2 bg-red-500/10 rounded-full">
                   <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
             </div>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800 p-4">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold">Kitchen Load</p>
                   <h3 className={cn("text-2xl font-bold mt-1", loadColor)}>
                      {loadLevel}
                   </h3>
                </div>
                <div className="p-2 bg-orange-500/10 rounded-full">
                   <Flame className="w-5 h-5 text-orange-500" />
                </div>
             </div>
          </Card>
        </div>

        {/* Ticket Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0 overflow-hidden">
           
           {/* Queue */}
           <div className="flex flex-col h-full bg-black/20 rounded-xl border border-gray-800/50 overflow-hidden">
              <div className="flex-none p-3 border-b border-gray-800 bg-[#1A1A1A] flex justify-between items-center">
                 <h3 className="font-bold text-gray-400 flex items-center gap-2 text-sm">
                    <Bell className="w-4 h-4" /> Incoming / Queue
                 </h3>
                 <Badge variant="secondary" className="bg-gray-800 text-gray-300">
                    {orders.filter(o => ['pending'].includes(o.status)).length}
                 </Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                 {orders.filter(o => ['pending'].includes(o.status)).map(order => (
                    <OrderCard 
                       key={order.id} 
                       order={order} 
                       role="kitchen"
                       onAction={handleOrderAction}
                    />
                 ))}
                 {orders.filter(o => ['pending'].includes(o.status)).length === 0 && (
                    <div className="h-full flex items-center justify-center text-gray-600 italic text-sm">No new tickets</div>
                 )}
              </div>
           </div>

           {/* Active Prep */}
           <div className="flex flex-col h-full bg-black/20 rounded-xl border border-gray-800/50 overflow-hidden">
              <div className="flex-none p-3 border-b border-gray-800 bg-[#1A1A1A] flex justify-between items-center">
                 <h3 className="font-bold text-orange-400 flex items-center gap-2 text-sm">
                    <Flame className="w-4 h-4" /> Active Prep
                 </h3>
                 <Badge variant="secondary" className="bg-orange-500/10 text-orange-400 border-orange-500/20">
                    {orders.filter(o => ['accepted', 'preparing'].includes(o.status)).length}
                 </Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                 {orders.filter(o => ['accepted', 'preparing'].includes(o.status)).map(order => (
                    <OrderCard 
                       key={order.id} 
                       order={order} 
                       role="kitchen"
                       onAction={handleOrderAction}
                    />
                 ))}
              </div>
           </div>

           {/* Ready */}
           <div className="flex flex-col h-full bg-black/20 rounded-xl border border-gray-800/50 overflow-hidden">
              <div className="flex-none p-3 border-b border-gray-800 bg-[#1A1A1A] flex justify-between items-center">
                 <h3 className="font-bold text-green-500 flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Ready for Pickup
                 </h3>
                 <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                    {readyCount}
                 </Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                 {orders.filter(o => o.status === 'ready').map(order => (
                    <OrderCard 
                       key={order.id} 
                       order={order} 
                       role="kitchen"
                    />
                 ))}
              </div>
           </div>

        </div>

        {/* Bottom Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-48 flex-none overflow-hidden">
           {/* Station Load */}
           <Card className="bg-[#1A1A1A] border-gray-800 overflow-hidden h-full flex flex-col">
              <div className="p-3">
                 <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-primary" /> Station Load
                 </h3>
                 <div className="h-32 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={stationData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={80} tick={{fill: '#9CA3AF', fontSize: 10}} />
                          <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }} />
                          <Bar dataKey="count" fill="#FFB800" radius={[0, 4, 4, 0]} barSize={16}>
                            {stationData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.count > 10 ? '#EF4444' : entry.count > 5 ? '#FFB800' : '#84CC16'} />
                            ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </Card>
           
           {/* Placeholder for Quality */}
           <Card className="bg-[#1A1A1A] border-gray-800 overflow-hidden h-full col-span-2">
              <div className="p-3">
                 <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-orange-500" /> System Status
                 </h3>
                 <div className="mt-4 flex gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"/> Real-time Connection Active</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"/> Audio Alerts Enabled</div>
                 </div>
              </div>
           </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default KitchenDashboard;