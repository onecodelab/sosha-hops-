
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { SoshaCard, SoshaCardTitle } from '../components/SoshaCard';
import { 
  TrendingUp, Users, ShoppingBag, AlertTriangle, 
  RefreshCw, DollarSign, ArrowUpRight, ClipboardList, Trash2,
  Bot, Utensils, Bike, Package, CheckCircle2, XCircle, Search, Clock, ChevronRight, Eye, Filter,
  CreditCard, Banknote, Smartphone, Building2, User as UserIcon, MapPin, Hash, Receipt
} from 'lucide-react';
import { cn, Badge, Button, Dialog, showToast, Input } from '../components/ui';
import { supabase } from '../supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { ActiveOrdersModal } from '../components/ActiveOrdersModal';
import { Order, OrderSource, PaymentStatus, PaymentMethod } from '../types';

type RevenuePeriod = 'daily' | 'weekly' | 'monthly' | '3months' | '6months' | '12months';

const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [activeOrdersList, setActiveOrdersList] = useState<Order[]>([]);
  const [allRecentOrders, setAllRecentOrders] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  
  // Filters
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'unpaid' | 'paid' | 'failed'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'chatbot' | 'dine_in' | 'takeaway' | 'delivery'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'cbe' | 'abyssinia' | 'chapa' | 'telebirr' | 'bank'>('all');
  const [staffIdFilter, setStaffIdFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'15m' | '1h' | 'all'>('1h');
  
  // Chart States
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>('weekly');
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueChartData, setRevenueChartData] = useState<any[]>([]);

  // Best Sellers Filter State
  const [bestSellersPeriod, setBestSellersPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [bestSellersLoading, setBestSellersLoading] = useState(false);

  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeOrdersCount: 0,
    staffActive: 0,
    lowStock: 0
  });
  const [bestSellers, setBestSellers] = useState<any[]>([]);

  const fetchRevenueFlow = useCallback(async (period: RevenuePeriod) => {
    setRevenueLoading(true);
    try {
      const now = new Date();
      let startDate = new Date();
      
      switch(period) {
        case 'daily': 
        case 'weekly': 
          startDate.setDate(now.getDate() - 7); 
          break;
        case 'monthly': 
          startDate.setDate(now.getDate() - 30); 
          break;
        case '3months': 
          startDate.setMonth(now.getMonth() - 3); 
          break;
        case '6months': 
          startDate.setMonth(now.getMonth() - 6); 
          break;
        case '12months': 
          startDate.setFullYear(now.getFullYear() - 1); 
          break;
      }

      const { data, error } = await supabase
        .from('orders')
        .select('created_at, total_amount, status, payment_status')
        .gte('created_at', startDate.toISOString())
        .in('status', ['paid', 'completed', 'served'])
        .neq('status', 'cancelled')
        .neq('status', 'rejected');

      if (error) throw error;

      // Aggregation Logic
      const aggregateData = () => {
        const map = new Map<string, { label: string, value: number, count: number }>();
        
        if (period === 'daily' || period === 'weekly' || period === 'monthly') {
          const days = period === 'monthly' ? 30 : 7;
          for (let i = 0; i < days; i++) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const label = period === 'monthly' 
              ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : d.toLocaleDateString('en-US', { weekday: 'short' });
            map.set(key, { label, value: 0, count: 0 });
          }
          data?.forEach(o => {
            const key = o.created_at.split('T')[0];
            if (map.has(key)) {
              const current = map.get(key)!;
              map.set(key, { ...current, value: current.value + (o.total_amount || 0), count: current.count + 1 });
            }
          });
        } else if (period === '3months') {
          for (let i = 0; i < 12; i++) {
            const d = new Date();
            d.setDate(now.getDate() - (i * 7));
            const label = `Wk ${12 - i}`;
            map.set(label, { label, value: 0, count: 0 });
          }
          data?.forEach(o => {
            const d = new Date(o.created_at);
            const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
            const weekIdx = Math.floor(diffDays / 7);
            const label = `Wk ${Math.max(1, 12 - weekIdx)}`;
            if (map.has(label)) {
              const current = map.get(label)!;
              map.set(label, { ...current, value: current.value + (o.total_amount || 0), count: current.count + 1 });
            }
          });
        } else {
          const months = period === '6months' ? 6 : 12;
          for (let i = 0; i < months; i++) {
            const d = new Date();
            d.setMonth(now.getMonth() - i);
            const label = d.toLocaleDateString('en-US', { month: 'short', year: period === '12months' ? '2-digit' : undefined });
            map.set(label, { label, value: 0, count: 0 });
          }
          data?.forEach(o => {
            const d = new Date(o.created_at);
            const label = d.toLocaleDateString('en-US', { month: 'short', year: period === '12months' ? '2-digit' : undefined });
            if (map.has(label)) {
              const current = map.get(label)!;
              map.set(label, { ...current, value: current.value + (o.total_amount || 0), count: current.count + 1 });
            }
          });
        }

        return Array.from(map.values()).reverse();
      };

      setRevenueChartData(aggregateData());
    } catch (err: any) {
      console.error("Revenue flow fetch error:", err.message);
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  const fetchBestSellers = useCallback(async (period: 'daily' | 'weekly' | 'monthly') => {
    setBestSellersLoading(true);
    try {
      const startDate = new Date();
      if (period === 'daily') startDate.setHours(0, 0, 0, 0);
      else if (period === 'weekly') startDate.setDate(startDate.getDate() - 7);
      else if (period === 'monthly') startDate.setDate(startDate.getDate() - 30);
      
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select(`
          quantity, 
          price, 
          menu_items(*), 
          orders!inner(created_at, status)
        `)
        .gte('orders.created_at', startDate.toISOString())
        .neq('orders.status', 'cancelled')
        .neq('orders.status', 'rejected');

      if (error) throw error;

      const salesMap = new Map();
      orderItems?.forEach((item: any) => {
        const name = item.menu_items?.name || 'Unknown';
        const current = salesMap.get(name) || { count: 0, revenue: 0 };
        salesMap.set(name, { 
          count: current.count + item.quantity, 
          revenue: current.revenue + ((item.price || 0) * item.quantity) 
        });
      });
      
      setBestSellers(Array.from(salesMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5));
    } catch (err: any) {
      console.error("Best sellers fetch error:", err.message);
    } finally {
      setBestSellersLoading(false);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      const last24hISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // 1. Total Revenue Today
      const { data: revenueData } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', todayISO)
        .in('status', ['completed', 'paid', 'served']);
      
      const totalRevenue = revenueData?.reduce((acc, o) => acc + (o.total_amount || 0), 0) || 0;

      // 2. Active Orders Count (Optimized)
      const { count: activeCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'accepted', 'preparing', 'ready', 'served'])
        .gte('created_at', last24hISO);

      // 3. Staff Active Count (Optimized)
      const { count: activeStaffCount } = await supabase
        .from('staff_shifts')
        .select('*', { count: 'exact', head: true })
        .is('clock_out_time', null)
        .gte('clock_in_time', last24hISO);

      // 4. Low Stock Count
      const { data: ingredients } = await supabase.from('ingredients').select('current_stock, par_min');
      const lowStockCount = ingredients?.filter(i => i.current_stock <= i.par_min).length || 0;

      // 5. Recent Orders Feed (with items)
      const { data: recentFeed } = await supabase
        .from('orders')
        .select(`
          *, 
          waiter:profiles(id, full_name), 
          order_items(
            quantity, 
            menu_item:menu_items(name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      // 6. Active Orders for Modal (Full data)
      const { data: activeList } = await supabase
        .from('orders')
        .select('*, order_items(quantity, menu_item:menu_items(name)), waiter:profiles(full_name)')
        .in('status', ['pending', 'accepted', 'preparing', 'ready', 'served'])
        .gte('created_at', last24hISO)
        .order('created_at', { ascending: false });

      setStats({
        totalRevenue,
        activeOrdersCount: activeCount || 0,
        staffActive: activeStaffCount || 0,
        lowStock: lowStockCount
      });

      setAllRecentOrders(recentFeed || []);
      setActiveOrdersList(activeList as Order[] || []);

      const { data: staff } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['waiter', 'manager', 'owner']);
      setStaffList(staff || []);

    } catch (err: any) {
      console.error("Dashboard fetch error:", err?.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchRevenueFlow(revenuePeriod);
    fetchBestSellers(bestSellersPeriod);

    // Subscriptions
    const ordersChannel = supabase.channel('admin_orders_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    const shiftsChannel = supabase.channel('admin_shifts_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_shifts' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    // Backup Polling (every 30s)
    const interval = setInterval(fetchDashboardData, 30000);

    return () => { 
      supabase.removeChannel(ordersChannel); 
      supabase.removeChannel(shiftsChannel);
      clearInterval(interval);
    };
  }, [fetchDashboardData, revenuePeriod, bestSellersPeriod]);

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
      const matchesStaff = staffIdFilter === 'all' || order.waiter_id === staffIdFilter;
      
      let matchesMethod = true;
      if (methodFilter !== 'all') {
        if (methodFilter === 'bank') {
          matchesMethod = ['cbe', 'abyssinia'].includes(order.payment_method || '');
        } else {
          matchesMethod = order.payment_method === methodFilter;
        }
      }
      
      let matchesTime = true;
      if (timeFilter !== 'all') {
        const diffMs = Date.now() - new Date(order.created_at).getTime();
        const diffMins = diffMs / 60000;
        if (timeFilter === '15m') matchesTime = diffMins <= 15;
        if (timeFilter === '1h') matchesTime = diffMins <= 60;
      }

      return matchesPayment && matchesSource && matchesStaff && matchesTime && matchesMethod;
    });
  }, [allRecentOrders, paymentFilter, sourceFilter, staffIdFilter, timeFilter, methodFilter]);

  const getTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const getSourceConfig = (source: OrderSource) => {
    switch (source) {
      case 'chatbot': return { icon: <Bot className="w-3 h-3" />, color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20", label: "Chatbot" };
      case 'delivery': return { icon: <Bike className="w-3 h-3" />, color: "bg-purple-500/10 text-purple-400 border-purple-500/20", label: "Delivery" };
      case 'takeaway': return { icon: <Package className="w-3 h-3" />, color: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Takeaway" };
      default: return { icon: <Utensils className="w-3 h-3" />, color: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Dine-in" };
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'paid': return "bg-green-500/10 text-green-500 border-green-500/20";
      case 'failed': return "bg-red-600/20 text-red-500 border-red-600/40 font-black";
      case 'split': return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      default: return "bg-red-500/10 text-red-400 border-red-500/20"; // Unpaid
    }
  };

  const getMethodIcon = (method: PaymentMethod | string | undefined) => {
    switch (method) {
      case 'cash': return <Banknote className="w-3.5 h-3.5" />;
      case 'cbe': 
      case 'abyssinia': return <Building2 className="w-3.5 h-3.5" />;
      case 'chapa':
      case 'telebirr': return <Smartphone className="w-3.5 h-3.5" />;
      default: return <CreditCard className="w-3.5 h-3.5" />;
    }
  };

  const revenuePeriods: { value: RevenuePeriod, label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: '3months', label: '3 Months' },
    { value: '6months', label: '6 Months' },
    { value: '12months', label: '12 Months' },
  ];

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
          <StatCard 
            title="Active Orders" 
            value={stats.activeOrdersCount.toString()} 
            icon={ShoppingBag} 
            color="blue" 
            isProminent 
            onClick={() => navigate('/tables')} 
          />
          <StatCard 
            title="Staff Active" 
            value={stats.staffActive.toString()} 
            icon={Users} 
            color="green" 
            onClick={() => navigate('/admin/staff-performance')} 
          />
          <StatCard title="Low Stock" value={stats.lowStock.toString()} icon={AlertTriangle} color="red" onClick={() => navigate('/inventory')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SoshaCard className="lg:col-span-2 p-6" indicatorColor="blue">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                   <SoshaCardTitle className="text-xl font-black">Revenue Flow</SoshaCardTitle>
                   <p className="text-[10px] text-muted font-bold uppercase tracking-wider mt-1">Aggregated ticket sales</p>
                </div>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 w-full sm:w-auto overflow-x-auto scrollbar-none">
                    {revenuePeriods.map((p) => (
                       <button
                          key={p.value}
                          onClick={() => setRevenuePeriod(p.value)}
                          className={cn(
                             "px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all whitespace-nowrap",
                             revenuePeriod === p.value 
                                ? "bg-primary text-black shadow-lg shadow-primary/10" 
                                : "text-gray-500 hover:text-white"
                          )}
                       >
                          {p.label}
                       </button>
                    ))}
                </div>
             </div>
             {/* Added min-h-[300px] to fix width/height warning */}
             <div className={cn("h-[300px] min-h-[300px] w-full transition-opacity duration-300", revenueLoading ? "opacity-50" : "opacity-100")}>
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis 
                        dataKey="label" 
                        stroke="#71717a" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        interval={revenuePeriod === 'monthly' ? 4 : 0} 
                      />
                      <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `ETB ${v >= 1000 ? (v/1000).toFixed(1) + 'k' : v}`} />
                      <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.03)'}} 
                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-xl shadow-2xl">
                                <p className="text-[10px] font-black text-muted uppercase mb-1">{label}</p>
                                <p className="text-sm font-bold text-white mb-1">Revenue: ETB {data.value.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-primary uppercase">Tickets: {data.count}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#FFB800" 
                        radius={[4, 4, 0, 0]} 
                        barSize={revenuePeriod === 'monthly' ? 8 : revenuePeriod === '3months' ? 16 : 40} 
                      />
                   </BarChart>
                </ResponsiveContainer>
                {revenueChartData.length === 0 && !revenueLoading && (
                   <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-xs text-gray-500 italic">No revenue data for this period</p>
                   </div>
                )}
             </div>
          </SoshaCard>

          <SoshaCard className="p-6" indicatorColor="yellow">
             <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-start">
                   <SoshaCardTitle className="text-xl font-black capitalize">
                      Best Sellers - {bestSellersPeriod}
                   </SoshaCardTitle>
                   {bestSellersLoading && <RefreshCw className="w-4 h-4 animate-spin text-primary" />}
                </div>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 w-fit">
                    {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                       <button
                          key={p}
                          onClick={() => setBestSellersPeriod(p)}
                          className={cn(
                             "px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all",
                             bestSellersPeriod === p 
                                ? "bg-primary text-black shadow-lg shadow-primary/10" 
                                : "text-gray-500 hover:text-white"
                          )}
                       >
                          {p}
                       </button>
                    ))}
                </div>
             </div>

             <div className={cn("space-y-4 transition-opacity duration-300", bestSellersLoading ? "opacity-50" : "opacity-100")}>
                {bestSellers.length === 0 && !bestSellersLoading ? (
                  <div className="py-10 text-center text-muted text-xs italic">No data for this period</div>
                ) : (
                  bestSellers.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">#{idx + 1}</div>
                         <div><p className="text-sm font-bold text-foreground truncate max-w-[120px]">{item.name}</p><p className="text-[10px] text-muted font-bold uppercase">{item.count} units</p></div>
                      </div>
                      <div className="text-right"><p className="text-sm font-bold text-primary">ETB {item.revenue.toLocaleString()}</p></div>
                    </div>
                  ))
                )}
             </div>
          </SoshaCard>
        </div>

        <div className="grid grid-cols-1 gap-6 pb-20">
           <SoshaCard className="p-6 overflow-visible" indicatorColor="purple">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/5 pb-6">
                 <div>
                    <SoshaCardTitle className="text-2xl flex items-center gap-2 font-black">
                       <Receipt className="w-6 h-6 text-purple-400" /> Live Order Feed
                    </SoshaCardTitle>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Real-time terminal transactions</p>
                 </div>
                 <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                    {(['15m', '1h', 'all'] as const).map(f => (
                       <button 
                          key={f} 
                          onClick={() => setTimeFilter(f)} 
                          className={cn(
                             "px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all", 
                             timeFilter === f ? "bg-primary text-black" : "text-gray-500 hover:text-white"
                          )}
                       >
                          {f}
                       </button>
                    ))}
                 </div>
              </div>

              {/* Advanced Filter Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Payment Status</label>
                    <select 
                       value={paymentFilter}
                       onChange={(e) => setPaymentFilter(e.target.value as any)}
                       className="w-full bg-black/40 border border-white/10 rounded-xl px-3 h-10 text-xs font-bold text-gray-300 focus:outline-none focus:border-primary/50"
                    >
                       <option value="all">All Payments</option>
                       <option value="unpaid">Unpaid Only</option>
                       <option value="paid">Paid Only</option>
                       <option value="failed">Failed Only</option>
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Order Source</label>
                    <select 
                       value={sourceFilter}
                       onChange={(e) => setSourceFilter(e.target.value as any)}
                       className="w-full bg-black/40 border border-white/10 rounded-xl px-3 h-10 text-xs font-bold text-gray-300 focus:outline-none focus:border-primary/50"
                    >
                       <option value="all">All Sources</option>
                       <option value="dine_in">Dine-in</option>
                       <option value="takeaway">Takeaway</option>
                       <option value="delivery">Delivery</option>
                       <option value="chatbot">Chatbot</option>
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Payment Method</label>
                    <select 
                       value={methodFilter}
                       onChange={(e) => setMethodFilter(e.target.value as any)}
                       className="w-full bg-black/40 border border-white/10 rounded-xl px-3 h-10 text-xs font-bold text-gray-300 focus:outline-none focus:border-primary/50"
                    >
                       <option value="all">All Methods</option>
                       <option value="cash">Cash</option>
                       <option value="cbe">CBE</option>
                       <option value="abyssinia">Abyssinia</option>
                       <option value="chapa">Chapa</option>
                       <option value="telebirr">Telebirr</option>
                       <option value="bank">Bank Transfer</option>
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Staff Member</label>
                    <select 
                       value={staffIdFilter}
                       onChange={(e) => setStaffIdFilter(e.target.value)}
                       className="w-full bg-black/40 border border-white/10 rounded-xl px-3 h-10 text-xs font-bold text-gray-300 focus:outline-none focus:border-primary/50"
                    >
                       <option value="all">All Waiters</option>
                       {staffList.map(s => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                       ))}
                    </select>
                 </div>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 pb-10">
                 {filteredFeed.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                       <ShoppingBag className="w-12 h-12" />
                       <p className="text-sm font-bold uppercase tracking-widest">No orders match these filters</p>
                    </div>
                 ) : (
                    filteredFeed.map((order) => {
                       const source = getSourceConfig(order.source);
                       const itemsSummary = order.order_items?.map((i: any) => `${i.menu_item?.name} x${i.quantity}`).join(', ') || 'No items';
                       
                       return (
                          <div 
                             key={order.id} 
                             className="relative p-4 rounded-[1.5rem] bg-black/40 border border-white/5 hover:border-primary/20 hover:bg-white/[0.02] transition-all group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 overflow-hidden animate-in slide-in-from-top duration-300"
                          >
                             {/* Left: ID & Source */}
                             <div className="flex items-center gap-4 min-w-[150px]">
                                <div className="flex flex-col">
                                   <span className="text-sm font-black text-white font-mono flex items-center gap-2 group-hover:text-primary transition-colors">
                                      <Hash className="w-3 h-3 opacity-50" />
                                      {order.order_number || order.id.slice(0, 8).toUpperCase()}
                                   </span>
                                   <div className={cn("mt-1.5 px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase flex items-center gap-1 w-fit", source.color)}>
                                      {source.icon} {source.label}
                                   </div>
                                </div>
                             </div>

                             {/* Middle: Items & Staff */}
                             <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-200 truncate pr-4">{itemsSummary}</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                   <div className="flex items-center gap-1 text-[9px] font-bold text-gray-500 uppercase">
                                      <UserIcon className="w-2.5 h-2.5" /> 
                                      {order.waiter?.full_name || 'System'}
                                   </div>
                                   {order.table_number && (
                                      <div className="flex items-center gap-1 text-[9px] font-bold text-gray-500 uppercase">
                                         <MapPin className="w-2.5 h-2.5" /> 
                                         Table {order.table_number}
                                      </div>
                                   )}
                                   <Badge variant="outline" className="bg-zinc-900 border-white/5 text-[8px] uppercase font-black">{order.status}</Badge>
                                </div>
                             </div>

                             {/* Right: Financials & Status */}
                             <div className="flex items-center gap-6 text-right shrink-0">
                                <div className="flex flex-col items-end">
                                   <span className="text-sm font-black text-primary font-mono tracking-tighter">
                                      ETB {order.total_amount.toLocaleString()}
                                   </span>
                                   {order.tip_amount > 0 && (
                                      <span className="text-[9px] font-black text-green-500 uppercase mt-0.5">
                                         +{order.tip_amount} tip
                                      </span>
                                   )}
                                   <div className="flex items-center gap-2 mt-1.5">
                                      <div className="p-1 rounded bg-white/5 border border-white/10 text-gray-500" title={order.payment_method || 'Unknown'}>
                                         {getMethodIcon(order.payment_method)}
                                      </div>
                                      <Badge className={cn("text-[9px] uppercase font-black px-2 py-0.5 border", getPaymentStatusColor(order.payment_status || 'unpaid'))}>
                                         {order.payment_status || 'unpaid'}
                                      </Badge>
                                   </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                   <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-500 bg-white/5 px-2 py-1 rounded-lg">
                                      <Clock className="w-2.5 h-2.5" /> {getTimeAgo(order.created_at)}
                                   </div>
                                   {order.transaction_reference && (
                                      <div className="text-[8px] font-mono text-gray-600 bg-black/40 px-1.5 rounded" title="Reference Number">
                                         {order.transaction_reference.slice(-8)}
                                      </div>
                                   )}
                                </div>
                             </div>
                          </div>
                       );
                    })
                 )}
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
    <SoshaCard className={cn("p-6", onClick && "cursor-pointer group hover:border-primary/40", isProminent && "border-2 border-blue-500/30")} onClick={onClick}>
       <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">{title}</p>
            <h3 className={cn("font-black text-foreground mt-2 tracking-tighter", isProminent ? "text-4xl" : "text-2xl")}>{value}</h3>
            {onClick && <span className="text-[8px] font-bold text-primary uppercase mt-2 block opacity-0 group-hover:opacity-100 transition-opacity">View Details →</span>}
          </div>
          <div className={cn("p-3 rounded-2xl border", colors[color as keyof typeof colors])}><Icon className="w-5 h-5" /></div>
       </div>
    </SoshaCard>
  );
};

export default AdminDashboard;
