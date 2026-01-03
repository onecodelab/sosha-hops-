
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { SoshaCard, SoshaCardTitle } from '../components/SoshaCard';
import { 
  TrendingUp, Users, ShoppingBag, AlertTriangle, 
  RefreshCw, DollarSign, Activity, ClipboardList, List, Eye, Filter, User
} from 'lucide-react';
import { cn, Badge, Button, showToast } from '../components/ui';
import { supabase } from '../supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { ActiveOrdersModal } from '../components/ActiveOrdersModal';
import { PaymentVerificationModal } from '../components/PaymentVerificationModal';
import { OrderCard } from '../components/OrderCard';
import { Order, UserProfile } from '../types';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [allRecentOrders, setAllRecentOrders] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [stats, setStats] = useState({ totalRevenue: 0, activeOrdersCount: 0 });
  
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: rev } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', `${today}T00:00:00`)
        .in('status', ['completed', 'paid', 'served']);

      const { data: active, error: activeErr } = await supabase
        .from('orders')
        .select(`
          *, 
          waiter:profiles!orders_waiter_id_fkey (id, full_name),
          order_items (
            id,
            quantity, 
            price,
            menu_item:menu (name)
          )
        `)
        .neq('status', 'paid')
        .neq('status', 'closed')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (activeErr) throw activeErr;

      const { data: feed } = await supabase
        .from('orders')
        .select(`*, waiter:profiles!orders_waiter_id_fkey (full_name)`)
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: staff } = await supabase.from('profiles').select('*').in('role', ['waiter', 'manager']);
      if (staff) setStaffList(staff as UserProfile[]);

      setStats({
        totalRevenue: rev?.reduce((acc, o) => acc + (o.total_amount || 0), 0) || 0,
        activeOrdersCount: active?.filter(o => !['served', 'paid'].includes(o.status)).length || 0
      });

      setActiveOrders((active || []) as Order[]);
      setAllRecentOrders(feed || []);
    } catch (err: any) { 
      console.error(err);
    } finally { 
      setLoading(false); 
    }
  }, []);

  const debouncedSync = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      fetchDashboardData();
    }, 1000);
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchDashboardData();
    const sub = supabase.channel('admin_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => debouncedSync()).subscribe();
    return () => { 
      supabase.removeChannel(sub); 
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [debouncedSync]);

  const handleOrderAction = async (action: string, orderId: string) => {
    if (action === 'served') {
      // OrderCard already performed the database update internally.
      // Simply trigger a sync to update the Process Bills filter
      debouncedSync();
    }
  };

  // Fix: handlePaymentSuccess signature now matches onPaymentSuccess: () => void
  const handlePaymentSuccess = () => {
    debouncedSync();
  };

  const filteredActiveOrders = useMemo(() => {
    const list = activeOrders.filter(o => !['served', 'paid', 'closed'].includes(o.status));
    if (selectedStaffId === 'all') return list;
    return list.filter(o => o.waiter_id === selectedStaffId);
  }, [activeOrders, selectedStaffId]);

  const servedUnpaidOrders = useMemo(() => {
    return activeOrders.filter(o => o.status === 'served' && o.payment_status === 'unpaid');
  }, [activeOrders]);

  return (
    <DashboardLayout title="Executive Dashboard" subtitle="System oversight">
      <div className="space-y-8 animate-in fade-in duration-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <SoshaCard className="p-6" indicatorColor="yellow">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Revenue Today</p>
              <h3 className="text-3xl font-black text-white mt-2">ETB {stats.totalRevenue.toLocaleString()}</h3>
           </SoshaCard>
           <SoshaCard 
              className="p-6 cursor-pointer hover:border-blue-500/30 transition-all" 
              indicatorColor="blue"
              onClick={() => setIsModalOpen(true)}
           >
              <div className="flex justify-between items-start">
                 <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">In Kitchen</p>
                    <h3 className="text-3xl font-black text-white mt-2">{stats.activeOrdersCount}</h3>
                 </div>
                 <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                    <Activity className="w-5 h-5" />
                 </div>
              </div>
           </SoshaCard>
        </div>

        <div className="space-y-6">
           <div className="flex flex-col md:flex-row md:items-center justify-between px-2 gap-4">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                 <List className="w-5 h-5 text-primary" /> Live Production Board
              </h3>
              
              <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
                 <div className="flex items-center gap-2 px-3 text-gray-500">
                    <User className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Staff:</span>
                 </div>
                 <select 
                   value={selectedStaffId}
                   onChange={(e) => setSelectedStaffId(e.target.value)}
                   className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-primary transition-all min-w-[160px]"
                 >
                    <option value="all">Global View</option>
                    {staffList.map(s => (
                       <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                    ))}
                 </select>
                 <Button variant="ghost" size="icon" onClick={fetchDashboardData} className="h-8 w-8 hover:bg-white/10">
                    <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                 </Button>
              </div>
           </div>
           
           {filteredActiveOrders.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/10 rounded-[2.5rem] text-gray-600 gap-3">
                 <Activity className="w-12 h-12 opacity-10" />
                 <p className="italic text-sm font-medium">Kitchen is currently clear</p>
              </div>
           ) : (
              <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar snap-x">
                 {filteredActiveOrders.map(order => (
                    <div key={order.id} className="min-w-[320px] snap-start">
                       <OrderCard order={order} role="manager" onAction={handleOrderAction} />
                    </div>
                 ))}
              </div>
           )}
        </div>

        <SoshaCard className="p-6" indicatorColor="purple">
           <div className="flex items-center justify-between mb-6">
              <SoshaCardTitle className="flex items-center gap-2">
                 <ClipboardList className="w-5 h-5 text-purple-400" /> Transaction Audit
              </SoshaCardTitle>
              <Badge variant="outline" className="text-[10px] uppercase border-purple-500/30 text-purple-400">Activity Timeline</Badge>
           </div>
           <div className="space-y-3">
              {allRecentOrders.map(order => (
                 <div key={order.id} className="p-4 bg-black/40 border border-white/5 rounded-2xl flex justify-between items-center group hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-primary/30 transition-all">
                          <span className="text-xs font-bold text-gray-500 group-hover:text-primary">T-{order.table_number}</span>
                       </div>
                       <div>
                          <p className="text-sm font-black text-white">#{order.order_number || order.id.slice(0,5)}</p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                             {order.waiter?.full_name || 'System Staff'}
                          </p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-black text-primary font-mono">ETB {order.total_amount.toLocaleString()}</p>
                       <Badge variant="outline" className={cn("text-[8px] uppercase px-1.5", 
                          order.status === 'paid' ? "border-green-500/50 text-green-500 bg-green-500/5" :
                          order.status === 'served' ? "border-purple-500/50 text-purple-500 bg-purple-500/5" : "border-gray-700 text-gray-500"
                       )}>{order.status}</Badge>
                    </div>
                 </div>
              ))}
           </div>
        </SoshaCard>
      </div>

      <ActiveOrdersModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} orders={activeOrders.filter(o => !['served', 'paid'].includes(o.status))} />
      <PaymentVerificationModal 
        isOpen={isPaymentOpen} 
        onClose={() => setIsPaymentOpen(false)} 
        orders={servedUnpaidOrders} 
        onPaymentSuccess={handlePaymentSuccess} 
      />
    </DashboardLayout>
  );
};

export default AdminDashboard;
