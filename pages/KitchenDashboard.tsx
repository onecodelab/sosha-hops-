import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, cn, showToast } from '../components/ui';
import { 
  Clock, CheckCircle2, Flame, Bell, AlertTriangle, 
  Utensils, ChefHat, Timer, AlertOctagon 
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const KitchenDashboard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- Mock Data for Analytics ---
  const delayedDishes = [
    { name: "Special Burger", count: 4, avgDelay: "5m" },
    { name: "Steak", count: 2, avgDelay: "8m" },
    { name: "Pasta Carbonara", count: 1, avgDelay: "3m" },
  ];

  const remakeStats = [
    { reason: "Overcooked", count: 3 },
    { reason: "Cold", count: 1 },
    { reason: "Wrong Item", count: 1 },
  ];

  useEffect(() => {
    fetchOrders();

    // Update timers every minute
    const timerInterval = setInterval(() => setCurrentTime(new Date()), 60000);

    const subscription = supabase
      .channel('kitchen_orders_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();
        if (payload.eventType === 'INSERT') {
           showToast('🔔 New Ticket Received!', 'success');
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(subscription); 
      clearInterval(timerInterval);
    }
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          menu_item:menu (name, category)
        )
      `)
      .in('status', ['verified', 'accepted', 'preparing', 'ready'])
      .order('created_at', { ascending: true }); // Oldest first is standard for FIFO Kitchen

    if (data) setOrders(data);
  };

  const updateStatus = async (orderId: string, nextStatus: string) => {
    await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));
    
    if (nextStatus === 'ready') showToast(`Table ${orders.find(o => o.id === orderId)?.table_no} Ready!`);
  };

  // --- Helpers ---

  const getElapsedMinutes = (dateStr: string) => {
    const start = new Date(dateStr).getTime();
    const now = currentTime.getTime();
    return Math.floor((now - start) / 60000);
  };

  // --- KPI Calculations ---
  
  const activeCount = orders.filter(o => o.status !== 'ready').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;
  const delayedCount = orders.filter(o => getElapsedMinutes(o.created_at) > 20).length;
  
  const totalMinutes = orders.reduce((acc, o) => acc + getElapsedMinutes(o.created_at), 0);
  const avgPrepTime = orders.length ? Math.floor(totalMinutes / orders.length) : 0;

  // Station Load (Derived from active order items)
  const stationLoad = orders
    .filter(o => o.status !== 'ready')
    .flatMap(o => o.order_items)
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

  // --- Render ---

  return (
    <DashboardLayout title="Kitchen Display System" subtitle="Live Production Board">
      {/* Strict Grid Layout: 3 Rows (KPI, Tickets, Insights) */}
      <div className="grid grid-rows-[auto_1fr_auto] h-[calc(100vh-140px)] gap-4 w-full">
        
        {/* Row 1: KPI Cards */}
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

        {/* Row 2: Ticket Board (Main Area) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0 overflow-hidden">
           
           {/* Column 1: Queue (Incoming) */}
           <div className="flex flex-col h-full bg-black/20 rounded-xl border border-gray-800/50 overflow-hidden">
              <div className="flex-none p-3 border-b border-gray-800 bg-[#1A1A1A] flex justify-between items-center">
                 <h3 className="font-bold text-gray-400 flex items-center gap-2 text-sm">
                    <Bell className="w-4 h-4" /> Incoming / Queue
                 </h3>
                 <Badge variant="secondary" className="bg-gray-800 text-gray-300">
                    {orders.filter(o => ['verified', 'pending'].includes(o.status)).length}
                 </Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                 {orders.filter(o => ['verified', 'pending'].includes(o.status)).map(order => (
                    <TicketCard 
                       key={order.id} 
                       order={order} 
                       elapsed={getElapsedMinutes(order.created_at)}
                       onAction={() => updateStatus(order.id, 'preparing')}
                       actionLabel="Start Cooking"
                       actionColor="primary"
                    />
                 ))}
                 {orders.filter(o => ['verified', 'pending'].includes(o.status)).length === 0 && (
                    <div className="h-full flex items-center justify-center text-gray-600 italic text-sm">No new tickets</div>
                 )}
              </div>
           </div>

           {/* Column 2: Active Prep */}
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
                    <TicketCard 
                       key={order.id} 
                       order={order} 
                       elapsed={getElapsedMinutes(order.created_at)}
                       onAction={() => updateStatus(order.id, 'ready')}
                       actionLabel="Mark Ready"
                       actionColor="success"
                    />
                 ))}
              </div>
           </div>

           {/* Column 3: Ready */}
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
                    <TicketCard 
                       key={order.id} 
                       order={order} 
                       elapsed={getElapsedMinutes(order.created_at)}
                       isReady
                    />
                 ))}
              </div>
           </div>

        </div>

        {/* Row 3: Bottom Insights (Fixed Height) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-48 flex-none overflow-hidden">
           
           {/* Station Load */}
           <Card className="bg-[#1A1A1A] border-gray-800 overflow-hidden h-full flex flex-col">
              <CardHeader className="py-2 border-b border-gray-800 flex-none">
                 <CardTitle className="text-xs font-bold text-white flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-primary" /> Station Load
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-2 flex-1 min-h-0">
                 <div className="h-full w-full">
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
              </CardContent>
           </Card>

           {/* Delay Insights */}
           <Card className="bg-[#1A1A1A] border-gray-800 overflow-hidden h-full flex flex-col">
              <CardHeader className="py-2 border-b border-gray-800 flex-none">
                 <CardTitle className="text-xs font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-500" /> Top Delays (Today)
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto min-h-0">
                 <div className="divide-y divide-gray-800">
                    {delayedDishes.map((dish, i) => (
                       <div key={i} className="flex justify-between items-center p-2 hover:bg-white/5 text-[10px]">
                          <span className="font-bold text-gray-300">{dish.name}</span>
                          <div className="flex items-center gap-2">
                             <span className="text-gray-500">{dish.count} delayed</span>
                             <span className="text-red-400 font-mono font-bold">+{dish.avgDelay}</span>
                          </div>
                       </div>
                    ))}
                 </div>
              </CardContent>
           </Card>

           {/* Quality & Service */}
           <Card className="bg-[#1A1A1A] border-gray-800 overflow-hidden h-full flex flex-col">
              <CardHeader className="py-2 border-b border-gray-800 flex-none">
                 <CardTitle className="text-xs font-bold text-white flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-orange-500" /> Quality Check
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3 flex-1 overflow-y-auto">
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400">Avg Pickup</span>
                    <span className="text-xs font-bold text-primary">3m 45s</span>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Remake Reasons</p>
                    <div className="flex flex-wrap gap-1">
                       {remakeStats.map(stat => (
                          <Badge key={stat.reason} variant="secondary" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20 px-1 py-0">
                             {stat.reason} ({stat.count})
                          </Badge>
                       ))}
                    </div>
                 </div>
              </CardContent>
           </Card>

        </div>
      </div>
    </DashboardLayout>
  );
};

// --- Helper Functions and Components outside main component ---

const getTimerColor = (minutes: number) => {
  if (minutes > 20) return "text-red-500 animate-pulse";
  if (minutes > 15) return "text-yellow-500";
  return "text-gray-400";
};

const getTimerBg = (minutes: number) => {
  if (minutes > 20) return "bg-red-500/10 border-red-500/30";
  if (minutes > 15) return "bg-yellow-500/10 border-yellow-500/30";
  return "bg-black/20 border-gray-800";
};

function TicketCard({ order, elapsed, onAction, actionLabel, actionColor, isReady }: any) {
  const timerColor = getTimerColor(elapsed);
  const timerBg = getTimerBg(elapsed);

  return (
    <div className={cn("rounded-lg border bg-[#1A1A1A] p-3 relative shadow-sm transition-all", timerBg)}>
       <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/5">
                <span className="text-lg font-bold text-white">{order.table_no}</span>
             </div>
             <div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold mb-0.5">
                   <Clock className={cn("w-3 h-3", timerColor)} />
                   <span className={timerColor}>{elapsed}m</span>
                </div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">#{order.id.slice(0,6)}</span>
             </div>
          </div>
          {isReady && (
             <div className="animate-pulse">
                <Badge className="bg-green-500 text-black font-bold border-none hover:bg-green-500 text-[10px]">PICKUP</Badge>
             </div>
          )}
       </div>

       <div className="space-y-1 mb-3">
          {order.order_items?.map((item: any, idx: number) => (
             <div key={idx} className="flex gap-2 text-xs">
                <span className="font-bold text-primary w-4 text-right">{item.quantity}</span>
                <span className="text-gray-200 line-clamp-1">{item.menu_item?.name}</span>
             </div>
          ))}
       </div>

       {!isReady && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
             <Button 
                size="sm" 
                onClick={onAction}
                className={cn(
                   "w-full text-[10px] font-bold h-7",
                   actionColor === 'success' ? "bg-green-600 hover:bg-green-700" : 
                   "bg-primary text-black hover:bg-primary/90"
                )}
             >
                {actionLabel}
             </Button>
             <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10">
                <AlertTriangle className="w-3 h-3" />
             </Button>
          </div>
       )}
    </div>
  );
}

export default KitchenDashboard;