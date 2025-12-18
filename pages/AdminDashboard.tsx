
import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell
} from 'recharts';
import { DashboardLayout } from '../components/DashboardLayout';
import { SoshaCard, SoshaCardTitle } from '../components/SoshaCard';
import { 
  TrendingUp, Users, ShoppingBag, AlertTriangle, 
  RefreshCw, DollarSign, ArrowUpRight, ClipboardList, Package
} from 'lucide-react';
import { cn, Badge, Button } from '../components/ui';
import { supabase } from '../supabase';
import { useLanguage } from '../contexts/LanguageContext';

interface ActivityEvent {
  id: string;
  type: 'order' | 'po' | 'restock';
  description: string;
  timestamp: string;
}

const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeOrders: 0,
    staffActive: 0,
    lowStock: 0
  });
  const [revenueChartData, setRevenueChartData] = useState<any[]>([]);
  const [bestSellers, setBestSellers] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // 1. Stats Calculation
      // Revenue (Today)
      const { data: revenueData } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', todayISO)
        .in('status', ['completed', 'paid', 'served']);
      
      const totalRevenue = revenueData?.reduce((acc, o) => acc + (o.total_amount || 0), 0) || 0;

      // Active Orders
      const { count: activeOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'accepted', 'preparing', 'ready']);

      // Staff Active
      const { count: staffActive } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true);

      // Low Stock Items
      const { data: ingredients } = await supabase
        .from('ingredients')
        .select('current_stock, par_min');
      const lowStockCount = ingredients?.filter(i => i.current_stock <= i.par_min).length || 0;

      setStats({
        totalRevenue,
        activeOrders: activeOrders || 0,
        staffActive: staffActive || 0,
        lowStock: lowStockCount
      });

      // 2. Revenue Chart (Last 7 Days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: chartOrders } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .neq('status', 'cancelled');

      const dailyMap = new Map();
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyMap.set(d.toLocaleDateString('en-US', { weekday: 'short' }), 0);
      }

      chartOrders?.forEach(o => {
        const day = new Date(o.created_at).toLocaleDateString('en-US', { weekday: 'short' });
        if (dailyMap.has(day)) {
          dailyMap.set(day, dailyMap.get(day) + (o.total_amount || 0));
        }
      });

      const chartData = Array.from(dailyMap.entries())
        .map(([day, value]) => ({ day, value }))
        .reverse();
      setRevenueChartData(chartData);

      // 3. Best Sellers (Last 30 Days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('quantity, price, menu_item:menu(name)')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const salesMap = new Map();
      orderItems?.forEach((item: any) => {
        const name = item.menu_item?.name || 'Unknown';
        const current = salesMap.get(name) || { count: 0, revenue: 0 };
        salesMap.set(name, {
          count: current.count + item.quantity,
          revenue: current.revenue + (item.price * item.quantity)
        });
      });

      const sellers = Array.from(salesMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setBestSellers(sellers);

      // 4. Recent Activity
      const [
        { data: latestOrders },
        { data: latestPOs },
        { data: latestRestock }
      ] = await Promise.all([
        supabase.from('orders').select('order_number, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('purchase_orders').select('po_number, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('restock_requests').select('reason, created_at, ingredient:ingredients(name)').order('created_at', { ascending: false }).limit(5)
      ]);

      const events: ActivityEvent[] = [];
      latestOrders?.forEach(o => events.push({ id: o.order_number, type: 'order', description: `New Order #${o.order_number} received`, timestamp: o.created_at }));
      latestPOs?.forEach(p => events.push({ id: p.po_number, type: 'po', description: `Manager created ${p.po_number}`, timestamp: p.created_at }));
      latestRestock?.forEach((r: any) => events.push({ id: r.id, type: 'restock', description: `Kitchen requested ${r.ingredient?.name || 'items'}`, timestamp: r.created_at }));

      setRecentActivity(events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5));

    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const channel = supabase.channel('admin_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDashboardData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <DashboardLayout 
      title="Executive Dashboard" 
      subtitle="Comprehensive system oversight"
      actions={
        <Button onClick={fetchDashboardData} variant="outline" className="gap-2">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </Button>
      }
    >
      <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* 1. Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard 
            title="Total Revenue (Today)" 
            value={`ETB ${stats.totalRevenue.toLocaleString()}`} 
            icon={DollarSign} 
            color="primary"
          />
          <StatCard 
            title="Active Orders" 
            value={stats.activeOrders.toString()} 
            icon={ShoppingBag} 
            color="blue"
          />
          <StatCard 
            title="Staff Active" 
            value={stats.staffActive.toString()} 
            icon={Users} 
            color="green"
          />
          <StatCard 
            title="Low Stock Items" 
            value={stats.lowStock.toString()} 
            icon={AlertTriangle} 
            color="red"
          />
        </div>

        {/* 2. Main Content Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Revenue Chart */}
          <SoshaCard className="lg:col-span-2 p-6" indicatorColor="blue">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <SoshaCardTitle className="text-xl">Weekly Revenue Flow</SoshaCardTitle>
                  <p className="text-sm text-muted">Daily performance tracking</p>
                </div>
                <Badge variant="outline" className="border-blue-500/30 text-blue-400">Last 7 Days</Badge>
             </div>

             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="day" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.03)'}}
                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                      />
                      <Bar dataKey="value" fill="#FFB800" radius={[4, 4, 0, 0]} barSize={40} />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </SoshaCard>

          {/* Best Sellers */}
          <SoshaCard className="p-6" indicatorColor="yellow">
             <SoshaCardTitle className="text-xl mb-6">Best Sellers</SoshaCardTitle>
             <div className="space-y-4">
                {bestSellers.length === 0 && <p className="text-muted text-center py-10">No sales data yet.</p>}
                {bestSellers.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                          #{idx + 1}
                       </div>
                       <div>
                          <p className="text-sm font-bold text-foreground truncate max-w-[120px]">{item.name}</p>
                          <p className="text-xs text-muted">{item.count} orders</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-bold text-primary">ETB {item.revenue.toLocaleString()}</p>
                       <div className="flex items-center gap-1 text-[10px] text-green-500 font-bold justify-end">
                          <TrendingUp className="w-2 h-2" /> Top Tier
                       </div>
                    </div>
                  </div>
                ))}
             </div>
          </SoshaCard>
        </div>

        {/* 3. Bottom Row: Activity Feed */}
        <div className="grid grid-cols-1 gap-6">
           <SoshaCard className="p-6" indicatorColor="purple">
              <div className="flex justify-between items-center mb-6">
                 <SoshaCardTitle className="text-xl flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-purple-400" /> Recent Activity
                 </SoshaCardTitle>
                 <button onClick={() => fetchDashboardData()} className="text-xs font-bold text-primary hover:underline uppercase tracking-widest">
                    Live Feed Active
                 </button>
              </div>

              <div className="space-y-3">
                 {recentActivity.length === 0 && <p className="text-muted text-center py-6">Waiting for activity...</p>}
                 {recentActivity.map((event, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-black/20 border border-border group hover:border-primary/30 transition-all">
                       <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-3 rounded-xl",
                            event.type === 'order' ? "bg-blue-500/10 text-blue-400" : 
                            event.type === 'po' ? "bg-purple-500/10 text-purple-400" : 
                            "bg-orange-500/10 text-orange-400"
                          )}>
                             {event.type === 'order' ? <ShoppingBag className="w-5 h-5" /> : 
                              event.type === 'po' ? <Truck className="w-5 h-5" /> : 
                              <Package className="w-5 h-5" />}
                          </div>
                          <div>
                             <p className="text-sm font-bold text-foreground">{event.description}</p>
                             <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 
                                {new Date(event.timestamp).toLocaleDateString()}
                             </p>
                          </div>
                       </div>
                       <ArrowUpRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                 ))}
              </div>
           </SoshaCard>
        </div>

      </div>
    </DashboardLayout>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  icon: any;
  color: 'primary' | 'blue' | 'green' | 'red';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color }) => {
  const colors = {
    primary: "text-primary bg-primary/10 border-primary/20 shadow-primary/5",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-blue-500/5",
    green: "text-green-400 bg-green-500/10 border-green-500/20 shadow-green-500/5",
    red: "text-red-400 bg-red-500/10 border-red-500/20 shadow-red-500/5",
  };

  return (
    <SoshaCard className="p-6">
       <div className="flex justify-between items-start">
          <div>
             <p className="text-xs font-bold text-muted uppercase tracking-wider">{title}</p>
             <h3 className="text-2xl font-bold text-foreground mt-2 tracking-tight">{value}</h3>
          </div>
          <div className={cn("p-3 rounded-2xl border transition-transform group-hover:scale-110", colors[color])}>
             <Icon className="w-5 h-5" />
          </div>
       </div>
    </SoshaCard>
  );
};

const Truck = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5h-4v6Z"/><path d="M16 13V7l4 3v3"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
);

export default AdminDashboard;
