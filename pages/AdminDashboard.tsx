
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

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allRecentOrders, setAllRecentOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalRevenue: 0, activeOrdersCount: 0, staffActive: 0, lowStock: 0 });

  const fetchDashboardData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Stats
      const { data: rev } = await supabase.from('orders').select('total_amount').gte('created_at', `${today}T00:00:00`).in('status', ['completed', 'paid', 'served']);
      const { count: act } = await supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'accepted', 'preparing', 'ready', 'served']);
      
      setStats({
        totalRevenue: rev?.reduce((acc, o) => acc + (o.total_amount || 0), 0) || 0,
        activeOrdersCount: act || 0,
        staffActive: 0,
        lowStock: 0
      });

      // 2. Feed - Explicit joins to avoid ambiguity
      const { data: feed } = await supabase
        .from('orders')
        .select(`
          *, 
          waiter:profiles!orders_waiter_id_fkey (full_name), 
          order_items (
            quantity, 
            menu_item:menu_items!order_items_menu_item_id_fkey (name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      setAllRecentOrders(feed || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <DashboardLayout title="Executive Dashboard" subtitle="System oversight">
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <SoshaCard className="p-6" indicatorColor="yellow">
              <p className="text-[10px] font-black text-muted uppercase tracking-widest">Revenue Today</p>
              <h3 className="text-2xl font-black text-white mt-2">ETB {stats.totalRevenue.toLocaleString()}</h3>
           </SoshaCard>
           <SoshaCard className="p-6" indicatorColor="blue">
              <p className="text-[10px] font-black text-muted uppercase tracking-widest">Active Tickets</p>
              <h3 className="text-2xl font-black text-white mt-2">{stats.activeOrdersCount}</h3>
           </SoshaCard>
        </div>

        <SoshaCard className="p-6" indicatorColor="purple">
           <SoshaCardTitle className="mb-6">Live Order Feed</SoshaCardTitle>
           <div className="space-y-3">
              {allRecentOrders.map(order => (
                 <div key={order.id} className="p-4 bg-black/40 border border-white/5 rounded-2xl flex justify-between items-center">
                    <div>
                       <p className="text-sm font-black text-white">#{order.order_number || order.id.slice(0,5)}</p>
                       <p className="text-[10px] text-gray-500 font-bold uppercase">Table {order.table_number} • {order.waiter?.full_name || 'System'}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-black text-primary">ETB {order.total_amount.toLocaleString()}</p>
                       <Badge variant="outline" className="text-[8px] uppercase">{order.status}</Badge>
                    </div>
                 </div>
              ))}
           </div>
        </SoshaCard>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
