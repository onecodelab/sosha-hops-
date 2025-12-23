
import React, { useEffect, useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
} from 'recharts';
import { DashboardLayout } from '../components/DashboardLayout';
import { SoshaCard, SoshaCardTitle } from '../components/SoshaCard';
import { 
  TrendingUp, Users, ShoppingBag, AlertTriangle, 
  RefreshCw, DollarSign, ArrowUpRight, ClipboardList, Trash2,
  Bot, Utensils, Bike, Package, CheckCircle2, XCircle, Search, Clock, ChevronRight, Eye, Filter
} from 'lucide-react';
import { cn, Badge, Button, Dialog, showToast, Input } from '../components/ui';
import { supabase } from '../supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { ActiveOrdersModal } from '../components/ActiveOrdersModal';
import { Order, OrderSource, PaymentStatus } from '../types';

const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [activeOrdersList, setActiveOrdersList] = useState<Order[]>([]);
  const [allRecentOrders, setAllRecentOrders] = useState<Order[]>([]);
  
  // Filters
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'unpaid' | 'paid' | 'failed'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'chatbot' | 'dine_in'>('all');
  const [staffSearch, setStaffSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState<'15m' | '1h' | 'all'>('all');

  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeOrdersCount: 0,
    staffActive: 0,
    lowStock: 0
  });
  const [revenueChartData, setRevenueChartData] = useState<any[]>([]);
  const [bestSellers, setBestSellers] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data: revenueData } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', todayISO)
        .in('status', ['completed', 'paid', 'served']);
      
      const totalRevenue = revenueData?.reduce((acc, o) => acc + (o.total_amount || 0), 0) || 0;

      const { data: activeOrders } = await supabase
        .from('orders')
        .select('*, order_items(quantity, menu_item:menu(name)), waiter:users(full_name)')
        .gte('created_at', todayISO)
        .in('status', ['pending', 'accepted', 'preparing', 'ready'])
        .order('created_at', { ascending: false });

      setActiveOrdersList(activeOrders as Order[] || []);
      setStats(prev => ({ ...prev, totalRevenue, activeOrdersCount: activeOrders?.length || 0 }));

      const { data: recentFeed } = await supabase
        .from('orders')
        .select('*, waiter:users(full_name)')
        .order('created_at', { ascending: false })
        .limit(50);
      setAllRecentOrders(recentFeed as Order[] || []);

      const { count: staffActive } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true);
      setStats(prev => ({ ...prev, staffActive: staffActive || 0 }));

      const { data: ingredients } = await supabase.from('ingredients').select('current_stock, par_min');
      const lowStockCount = ingredients?.filter(i => i.current_stock <= i.par_min).length || 0;
      setStats(prev => ({ ...prev, lowStock: lowStockCount }));

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: chartOrders } = await supabase.from('orders').select('total_amount, created_at').gte('created_at', sevenDaysAgo.toISOString()).neq('status', 'cancelled');
      const dailyMap = new Map();
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyMap.set(d.toLocaleDateString('en-US', { weekday: 'short' }), 0);
      }
      chartOrders?.forEach(o => {
        const day = new Date(o.created_at).toLocaleDateString('en-US', { weekday: 'short' });
        if (dailyMap.has(day)) dailyMap.set(day, dailyMap.get(day) + (o.total_amount || 0));
      });
      setRevenueChartData(Array.from(dailyMap.entries()).map(([day, value]) => ({ day, value })).reverse());

      const { data: orderItems } = await supabase.from('order_items').select('quantity, price, menu_item:menu(name)').gte('created_at', todayISO);
      const salesMap = new Map();
      orderItems?.forEach((item: any) => {
        const name = item.menu_item?.name || 'Unknown';
        const current = salesMap.get(name) || { count: 0, revenue: 0 };
        salesMap.set(name, { count: current.count + item.quantity, revenue: current.revenue + ((item.price || 0) * item.quantity) });
      });
      setBestSellers(Array.from(salesMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count).slice(0, 5));

    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const channel = supabase.channel('admin_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDashboardData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const { error } = await supabase.rpc('cleanup_old_orders');
      if (error) throw error;
      showToast("System reset success.", "success");
      fetchDashboardData();
      setIsCleanupModalOpen(false);
    } catch (err: any) {
      showToast(err.message || "Failed to cleanup orders", "error");
    } finally {
      setIsCleaningUp(false);
    }
  };

  const filteredFeed = useMemo(() => {
    return allRecentOrders.filter(order => {
      const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;
      const matchesSource = sourceFilter === 'all' || order.source === sourceFilter;
      const matchesStaff = !staffSearch || 
                           order.order_handler_name?.toLowerCase().includes(staffSearch.toLowerCase()) ||
                           order.waiter?.full_name?.toLowerCase().includes(staffSearch.toLowerCase());
      
      let matchesTime = true;
      if (timeFilter !== 'all') {
        const diffMs = Date.now() - new Date(order.created_at).getTime();
        const diffMins = diffMs / 60000;
        if (timeFilter === '15m') matchesTime = diffMins <= 15;
        if (timeFilter === '1h') matchesTime = diffMins <= 60;
      }

      return matchesPayment && matchesSource && matchesStaff && matchesTime;
    });
  }, [allRecentOrders, paymentFilter, sourceFilter, staffSearch, timeFilter]);

  const getTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const getSourceIcon = (source: OrderSource) => {
    switch (source) {
      case 'chatbot': return <Bot className="w-3 h-3" />;
      case 'delivery': return <Bike className="w-3 h-3" />;
      case 'takeaway': return <Package className="w-3 h-3" />;
      default: return <Utensils className="w-3 h-3" />;
    }
  };

  const getSourceColor = (source: OrderSource) => {
    switch (source) {
      case 'chatbot': return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case 'delivery': return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case 'takeaway': return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      default: return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'paid': return "bg-green-500/10 text-green-500 border-green-500/20";
      case 'failed': return "bg-red-500/20 text-red-500 border-red-500/40 font-black";
      case 'split': return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      default: return "bg-red-500/10 text-red-400 border-red-500/20";
    }
  };

  return (
    <DashboardLayout 
      title="Executive Dashboard" 
      subtitle="Comprehensive system oversight"
      actions={
        <div className="flex gap-2">
          <Button onClick={() => setIsCleanupModalOpen(true)} variant="outline" className="gap-2 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/5 bg-card">
            <Trash2 className="w-4 h-4" /> Daily Reset
          </Button>
          <Button onClick={fetchDashboardData} variant="outline" className="gap-2 bg-card border-border">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      }
    >
      <div className="space-y-8 animate-in fade-in duration-500">
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard title="Total Revenue" value={`ETB ${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} color="primary" />
          <StatCard title="Active Orders" value={stats.activeOrdersCount.toString()} icon={ShoppingBag} color="blue" isProminent onClick={() => setIsOrdersModalOpen(true)} />
          <StatCard title="Staff Active" value={stats.staffActive.toString()} icon={Users} color="green" />
          <StatCard title="Low Stock" value={stats.lowStock.toString()} icon={AlertTriangle} color="red" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SoshaCard className="lg:col-span-2 p-6" indicatorColor="blue">
             <div className="flex justify-between items-center mb-6">
                <div><SoshaCardTitle className="text-xl font-black">Revenue Flow</SoshaCardTitle></div>
                <Badge variant="outline" className="border-blue-500/30 text-blue-400">7 Days</Badge>
             </div>
             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="day" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{fill: 'rgba(255,255,255,0.03)'}} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }} />
                      <Bar dataKey="value" fill="#FFB800" radius={[4, 4, 0, 0]} barSize={40} />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </SoshaCard>

          <SoshaCard className="p-6" indicatorColor="yellow">
             <SoshaCardTitle className="text-xl mb-6 font-black">Best Sellers</SoshaCardTitle>
             <div className="space-y-4">
                {bestSellers.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">#{idx + 1}</div>
                       <div><p className="text-sm font-bold text-foreground truncate max-w-[120px]">{item.name}</p><p className="text-[10px] text-muted font-bold uppercase">{item.count} units</p></div>
                    </div>
                    <div className="text-right"><p className="text-sm font-bold text-primary">ETB {item.revenue.toLocaleString()}</p></div>
                  </div>
                ))}
             </div>
          </SoshaCard>
        </div>

        <div className="grid grid-cols-1 gap-6 pb-20">
           <SoshaCard className="p-6 overflow-visible" indicatorColor="purple">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                 <div><SoshaCardTitle className="text-xl flex items-center gap-2 font-black">Live Order Feed</SoshaCardTitle></div>
                 <div className="flex flex-wrap gap-2">
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                        {(['15m', '1h', 'all'] as const).map(f => (
                           <button key={f} onClick={() => setTimeFilter(f)} className={cn("px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all", timeFilter === f ? "bg-primary text-black" : "text-gray-500 hover:text-white")}>{f}</button>
                        ))}
                    </div>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                 {filteredFeed.map((order) => (
                    <div key={order.id} className="relative p-5 rounded-[2rem] bg-black/40 border border-white/5 hover:border-primary/20 transition-all group overflow-hidden flex flex-col gap-4">
                       <div className="flex justify-between items-start">
                          <div className="flex flex-col"><span className="text-sm font-black text-white font-mono">#{order.order_number || order.id.slice(0, 8)}</span></div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted bg-white/5 px-2 py-1 rounded-lg"><Clock className="w-3 h-3" /> {getTimeAgo(order.created_at)}</div>
                       </div>
                       <div className="flex flex-wrap gap-2">
                          <Badge className={cn("text-[9px] uppercase font-black px-2 py-0.5 border", getPaymentStatusColor(order.payment_status || 'unpaid'))}>{order.payment_status || 'unpaid'}</Badge>
                          <Badge variant="secondary" className="text-[9px] uppercase font-black px-2 py-0.5 border border-white/5 bg-zinc-900">{order.status}</Badge>
                       </div>
                       <div className="flex justify-between items-baseline pt-2 border-t border-white/5 mt-auto">
                          <span className="text-xs font-black text-primary font-mono">ETB {order.total_amount.toLocaleString()}</span>
                       </div>
                    </div>
                 ))}
              </div>
           </SoshaCard>
        </div>
      </div>
      <ActiveOrdersModal isOpen={isOrdersModalOpen} onClose={() => setIsOrdersModalOpen(false)} orders={activeOrdersList} />
      <Dialog isOpen={isCleanupModalOpen} onClose={() => setIsCleanupModalOpen(false)} title="Cleanup Old Orders">
        <div className="space-y-6 pt-2">
           <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex gap-4 items-start">
              <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0 mt-1" />
              <div><p className="text-sm font-bold text-white mb-1">Operational Reset</p><p className="text-xs text-gray-400">Expire old orders and reset association.</p></div>
           </div>
           <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setIsCleanupModalOpen(false)} disabled={isCleaningUp}>Cancel</Button>
              <Button onClick={handleCleanup} className="bg-yellow-500 text-black font-bold" isLoading={isCleaningUp}>Confirm</Button>
           </div>
        </div>
      </Dialog>
    </DashboardLayout>
  );
};

const StatCard = ({ title, value, icon: Icon, color, onClick, isProminent }: any) => {
  const colors = { primary: "text-primary bg-primary/10 border-primary/20", blue: "text-blue-400 bg-blue-500/10 border-blue-500/20", green: "text-green-400 bg-green-500/10 border-green-500/20", red: "text-red-400 bg-red-500/10 border-red-500/20" };
  return (
    <SoshaCard className={cn("p-6", onClick && "cursor-pointer", isProminent && "border-2 border-blue-500/30")} onClick={onClick}>
       <div className="flex justify-between items-start">
          <div><p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">{title}</p><h3 className={cn("font-black text-foreground mt-2 tracking-tighter", isProminent ? "text-4xl" : "text-2xl")}>{value}</h3></div>
          <div className={cn("p-3 rounded-2xl border", colors[color as keyof typeof colors])}><Icon className="w-5 h-5" /></div>
       </div>
    </SoshaCard>
  );
};

export default AdminDashboard;
