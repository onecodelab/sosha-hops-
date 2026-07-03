import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, cn } from '../components/ui';
import { supabase } from '@/lib/supabase';
import { useBranch } from '../contexts/BranchContext';
import { RefreshCw, Bot, User, Globe, Utensils, AlertCircle } from 'lucide-react';

import { BaroLogo } from '../components/BaroLogo';

const statuses: Record<string, { name: string, color: string }> = {
  'completed': { name: "Completed", color: "#10B981" },
  'paid': { name: "Completed", color: "#10B981" },
  'closed': { name: "Completed", color: "#10B981" },
  'pending': { name: "Pending", color: "#F59E0B" },
  'served': { name: "Pending", color: "#F59E0B" },
  'active': { name: "Pending", color: "#F59E0B" },
  'cancelled': { name: "Cancelled", color: "#EF4444" },
};

const getStatusDisplay = (status: string) => {
   return statuses[status?.toLowerCase()] || { name: status || 'Unknown', color: "#6B7280" };
};

const getSourceDisplay = (source: string) => {
  switch (source?.toLowerCase()) {
    case 'chatbot': return { name: 'Chatbot', icon: <Bot className="w-3 h-3" />, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
    case 'dine_in': return { name: 'Waiter', icon: <Utensils className="w-3 h-3" />, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'takeaway': return { name: 'Takeaway', icon: <Globe className="w-3 h-3" />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    case 'delivery': return { name: 'Delivery', icon: <Globe className="w-3 h-3" />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    case 'reservation': return { name: 'Reservation', icon: <Globe className="w-3 h-3" />, color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' };
    default: return { name: 'POS', icon: <User className="w-3 h-3" />, color: 'bg-primary/10 text-primary border-primary/20' };
  }
};

const MenuTransactions = () => {
  const { activeBranchId } = useBranch();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchTransactions = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            price,
            special_instructions,
            menu_item:menu!menu_item_id (name)
          )
        `)
        .eq('branch_id', activeBranchId)
        .order('created_at', { ascending: false });

      const now = new Date();
      const localToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (dateFilter === 'today') {
         query = query.gte('created_at', localToday.toISOString());
      } else if (dateFilter === 'yesterday') {
         const yesterday = new Date(localToday.getTime() - 86400000);
         query = query.gte('created_at', yesterday.toISOString()).lt('created_at', localToday.toISOString());
      } else if (dateFilter === 'week') {
         const lastWeek = new Date(localToday.getTime() - 7 * 86400000);
         query = query.gte('created_at', lastWeek.toISOString());
      } else if (dateFilter === 'month') {
         const lastMonth = new Date(localToday.getFullYear(), localToday.getMonth() - 1, localToday.getDate());
         query = query.gte('created_at', lastMonth.toISOString());
      } else if (dateFilter === 'custom' && startDate && endDate) {
         const start = new Date(startDate);
         start.setHours(0, 0, 0, 0);
         const end = new Date(endDate);
         end.setHours(23, 59, 59, 999);
         query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }

      query = query.limit(100);

      const { data: feed, error: feedErr } = await query;

      if (feedErr) throw feedErr;

      const profileIds = Array.from(new Set(
        (feed || []).flatMap((order) => [order.waiter_id, order.closed_by_id]).filter(Boolean)
      ));

      let profiles: any[] | null = [];
      if (profileIds.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('id', profileIds);
        if (!error) profiles = data;
      }

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const enriched = (feed || []).map((order: any) => ({
        ...order,
        waiter: order.waiter_id ? profileMap.get(order.waiter_id) || null : null,
        closed_by_user: order.closed_by_id ? profileMap.get(order.closed_by_id) || null : null,
      }));

      setOrders(enriched);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, dateFilter, startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
    
    if (!activeBranchId) return;
    const sub = supabase.channel('menu_transactions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `branch_id=eq.${activeBranchId}`
      }, () => fetchTransactions())
      .subscribe();
      
    return () => {
      supabase.removeChannel(sub);
    };
  }, [fetchTransactions, activeBranchId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div />
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-primary/5 rounded-xl p-1 border border-primary/20 backdrop-blur-md">
            {(['today', 'yesterday', 'week', 'month', 'all', 'custom'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  dateFilter === d ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-muted hover:text-foreground opacity-60"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right duration-300">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5 text-[10px] font-bold text-foreground focus:outline-none focus:border-primary/50 transition-all [color-scheme:dark]"
              />
              <span className="text-muted opacity-40 text-[10px] font-black uppercase tracking-tighter">To</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5 text-[10px] font-bold text-foreground focus:outline-none focus:border-primary/50 transition-all [color-scheme:dark]"
              />
              <Button 
                variant="primary" 
                size="sm" 
                onClick={fetchTransactions}
                className="h-9 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest"
              >
                Pull
              </Button>
            </div>
          )}

          <Button variant="outline" size="icon" onClick={fetchTransactions} className="h-10 w-10 rounded-xl border-primary/20 bg-primary/5 shadow-inner hover:bg-primary/10">
            <RefreshCw className={`w-4 h-4 text-primary ${loading ? 'animate-spin' : ''}`} strokeWidth={3} />
          </Button>
        </div>
      </div>

      <Card className="border-primary/10 shadow-2xl shadow-black/50">
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="text-xl">Order History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase bg-black/40 text-muted-foreground border-b border-white/5">
                <tr>
                  <th className="px-6 py-5 font-black tracking-widest">Order ID</th>
                  <th className="px-6 py-5 font-black tracking-widest whitespace-nowrap text-center">Source</th>
                  <th className="px-6 py-5 font-black tracking-widest whitespace-nowrap">Handled By</th>
                  <th className="px-6 py-5 font-black tracking-widest whitespace-nowrap">Date & Time</th>
                  <th className="px-6 py-5 font-black tracking-widest whitespace-nowrap">Payment</th>
                  <th className="px-6 py-5 font-black tracking-widest whitespace-nowrap">Total</th>
                  <th className="px-6 py-5 font-black tracking-widest whitespace-nowrap">Paid</th>
                  <th className="px-6 py-5 font-black tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.length === 0 && !loading && (
                   <tr>
                    <td colSpan={8} className="px-6 py-20 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-3 opacity-30">
                           <Globe className="w-10 h-10" />
                           <span className="text-[10px] font-black uppercase tracking-[0.2em]">No records found for the selected period</span>
                        </div>
                     </td>
                   </tr>
                )}
                {orders.map((order) => {
                  const staffName = order.waiter?.full_name || order.closed_by_user?.full_name || 'System';
                  const source = getSourceDisplay(order.source || (order.waiter_id ? 'dine_in' : 'pos'));
                  const statusDisplay = getStatusDisplay(order.status);
                  const orderDate = new Date(order.closed_at || order.paid_at || order.created_at);
                  
                  // Paid vs Total calculation
                  const totalAmount = order.total_amount || 0;
                  const amountPaid = order.amount_paid || 0;
                  const isUnderpaid = amountPaid < totalAmount && order.status !== 'cancelled' && order.status !== 'pending';
                  const isOverpaid = amountPaid > totalAmount;

                  // Clean order ID: ensure no double ORD-
                  const displayOrderId = order.order_number 
                    ? (order.order_number.startsWith('ORD-') ? order.order_number : `ORD-${order.order_number}`)
                    : order.id.slice(0, 8);

                  return (
                  <tr key={order.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-6 py-5 font-black text-foreground whitespace-nowrap uppercase tracking-tighter text-xs">
                      {displayOrderId}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                       <div className="flex justify-center">
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${source.color} text-[8px] font-black uppercase tracking-widest shadow-sm`}>
                             {source.icon}
                             {source.name}
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary shadow-inner">
                          {staffName.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-xs tracking-tight">{staffName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-muted-foreground whitespace-nowrap text-[11px] font-medium">
                      {new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      }).format(orderDate)}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      {order.payment_method ? (
                         <Badge variant="outline" className="uppercase text-[9px] font-black border-primary/20 bg-primary/5">{order.payment_method}</Badge>
                      ) : (
                         <span className="text-red-500/40 italic text-[9px] font-black tracking-widest">UNPAID</span>
                      )}
                    </td>
                    <td className="px-6 py-5 font-black text-muted-foreground whitespace-nowrap">
                      <span className="text-[9px] mr-1 opacity-40 font-sans">ETB</span>
                      {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-5 font-black whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] opacity-40 font-sans">ETB</span>
                          <span className={cn(
                            "text-sm",
                            isUnderpaid ? "text-red-500" : isOverpaid ? "text-emerald-500" : "text-primary"
                          )}>
                            {amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        {isOverpaid && (
                          <div className="flex items-center gap-1 text-[7px] font-black text-emerald-500 uppercase tracking-tighter bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10 w-fit animate-pulse">
                            <RefreshCw className="w-2 h-2" /> Overpaid / Tip
                          </div>
                        )}
                        {isUnderpaid && (
                          <div className="flex items-center gap-1 text-[7px] font-black text-red-500 uppercase tracking-tighter bg-red-500/5 px-1.5 py-0.5 rounded border border-red-500/10 w-fit">
                            <AlertCircle className="w-2 h-2" /> Underpaid
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                          style={{ backgroundColor: statusDisplay.color, boxShadow: `0 0 10px ${statusDisplay.color}44` }}
                        />
                        <span className="font-black uppercase tracking-widest text-[9px]" style={{ color: statusDisplay.color }}>
                          {statusDisplay.name}
                        </span>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MenuTransactions;
