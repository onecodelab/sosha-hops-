
import React, { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { Order } from '../types';
import { Button, Badge, showToast, cn } from '../components/ui';
import { SoshaCard, SoshaCardTitle } from '../components/SoshaCard';
import { Plus, User, Bell, Utensils, TrendingUp, ScanLine, Clock, CreditCard, RefreshCw } from 'lucide-react';
import { PaymentVerificationModal, FloatingPaymentButton } from '../components/PaymentVerificationModal';
import { ReceiptVerificationModal } from '../components/ReceiptVerificationModal';
import { CreateOrderModal } from '../components/CreateOrderModal';
import { OrderCard } from '../components/OrderCard';

const WaiterDashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]); 
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [appendOrderId, setAppendOrderId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *, 
          order_items (
            quantity, 
            price, 
            special_instructions, 
            menu_item:menu_items (name, category)
          )
        `)
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      if (data) setOrders(data as Order[]);
    } catch (err: any) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
      console.error("Fetch orders error:", errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchOrders();
    
    // Timer for elapsed minutes
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    
    // Real-time listener for orders and tables
    const channel = supabase.channel('waiter_station_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        // Refresh orders on any change (insert, update, delete)
        fetchOrders();
        
        // Notify waiter if their order is ready
        if (payload.eventType === 'UPDATE' && payload.new.status === 'ready' && payload.new.waiter_id === user?.id) {
          showToast(`🔔 Order for Table ${payload.new.table_number || ''} is READY!`, 'success');
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        // Refresh orders because table status changes are tied to floor data
        fetchOrders(); 
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      clearInterval(timer); 
    };
  }, [user?.id, fetchOrders]);

  const handleOrderAction = async (action: string, orderId: string) => {
    if (action === 'served') {
      const { error } = await supabase.from('orders').update({ status: 'served', served_at: new Date().toISOString() }).eq('id', orderId);
      if (error) showToast("Failed to mark as served", "error");
    } else if (action === 'pay') {
      setIsPaymentOpen(true);
    } else if (action === 'append') {
      setAppendOrderId(orderId);
      setIsCreateOpen(true);
    }
    fetchOrders();
  };

  const handleCloseModal = () => {
    setIsCreateOpen(false);
    setAppendOrderId(null);
    setSelectedTable('');
  };

  const myOrders = orders.filter(o => o.waiter_id === user?.id);
  const myActiveOrdersList = myOrders.filter(o => ['pending', 'accepted', 'preparing', 'ready', 'served'].includes(o.status));
  
  const openTablesCount = new Set(myActiveOrdersList.map(o => o.table_number)).size;
  const activeOrdersCount = myActiveOrdersList.length;
  const todaySales = myOrders.filter(o => ['served', 'completed', 'paid'].includes(o.status)).reduce((sum, o) => sum + (o.total_amount || 0), 0);
  
  const unpaidServedOrders = myOrders.filter(o => o.status === 'served');

  const myTables = Array.from(new Set(myActiveOrdersList.map(o => o.table_number))).map(tNo => {
    const tableOrders = myActiveOrdersList.filter(o => o.table_number === tNo);
    const oldestOrder = [...tableOrders].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    const totalBill = tableOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const lastStatus = tableOrders[tableOrders.length - 1].status;
    const elapsed = oldestOrder ? Math.floor((currentTime.getTime() - new Date(oldestOrder.created_at).getTime()) / 60000) : 0;
    return { tableNo: tNo, elapsed, orderCount: tableOrders.length, totalBill, status: lastStatus };
  }).sort((a,b) => a.elapsed - b.elapsed); 

  return (
    <DashboardLayout title="Waiter Station" subtitle={`Live Overview • ${profile?.full_name || 'Staff'}`}
      actions={
        <div className="flex gap-3">
            <Button onClick={fetchOrders} variant="outline" size="icon" className="border-white/10 bg-white/5">
               <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button onClick={() => setIsVerifyOpen(true)} variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border border-white/10 backdrop-blur-md">
               <ScanLine className="mr-2 h-4 w-4" /> Verify
            </Button>
            <Button onClick={() => { setAppendOrderId(null); setSelectedTable(''); setIsCreateOpen(true); }} className="bg-primary text-black font-bold hover:bg-primary/90 shadow-[0_0_20px_rgba(255,184,0,0.3)]">
               <Plus className="mr-2 h-4 w-4" /> New Order
            </Button>
        </div>
      }
    >
      <div className="space-y-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
          <SoshaCard className="p-5" indicatorColor="orange">
            <div className="flex flex-col justify-between h-full">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">My Tables</p>
                <div className="flex justify-between items-end">
                  <h3 className="text-4xl font-bold text-white tracking-tighter">{openTablesCount}</h3>
                  <User className="w-6 h-6 text-primary opacity-80" />
                </div>
            </div>
          </SoshaCard>
          <SoshaCard className="p-5">
            <div className="flex flex-col justify-between h-full">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Orders</p>
                <div className="flex justify-between items-end">
                  <h3 className="text-4xl font-bold text-white tracking-tighter">{activeOrdersCount}</h3>
                  <Utensils className="w-6 h-6 text-blue-400 opacity-80" />
                </div>
            </div>
          </SoshaCard>
          <SoshaCard className="p-5 col-span-2 lg:col-span-1">
            <div className="flex flex-col justify-between h-full">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">My Sales</p>
                <div className="flex justify-between items-end">
                  <h3 className="text-4xl font-bold text-white tracking-tighter">ETB {todaySales.toLocaleString()}</h3>
                  <TrendingUp className="w-6 h-6 text-green-500 opacity-80" />
                </div>
            </div>
          </SoshaCard>
        </div>

        {/* Main Content Split */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-[calc(100vh-340px)] min-h-[500px]">
          
          {/* Left: My Tables */}
          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between px-1">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                   <User className="w-5 h-5 text-primary" /> My Tables
                </h3>
                <span className="text-sm font-bold bg-white/10 px-3 py-1 rounded-full text-white">{myTables.length} Active</span>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar pb-10">
                {myTables.length === 0 && !isLoading && (
                   <div className="h-60 flex flex-col items-center justify-center text-gray-500 bg-white/5 rounded-[2rem] border border-white/5 border-dashed">
                      <p>No active tables</p>
                      <Button variant="ghost" onClick={() => { setAppendOrderId(null); setIsCreateOpen(true); }} className="mt-2 text-primary">Start New Table</Button>
                   </div>
                )}
                {myTables.map((table) => (
                   <div key={table.tableNo} className="relative p-5 rounded-[1.5rem] bg-[#0A0A0A] border border-white/10 shadow-lg group hover:border-primary/30 transition-all">
                         <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-4">
                               <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 text-2xl font-bold text-white shadow-inner">
                                  {table.tableNo}
                               </div>
                               <div>
                                  <div className="flex items-center gap-2">
                                     <p className="text-xs text-gray-400 font-mono font-bold flex items-center bg-black/40 px-2 py-0.5 rounded">
                                        <Clock className="w-3 h-3 mr-1" /> {table.elapsed}m
                                     </p>
                                     {table.elapsed > 45 && <span className="text-[10px] text-red-500 font-bold px-1.5 py-0.5 bg-red-500/10 rounded animate-pulse">Late</span>}
                                  </div>
                                  <p className="text-sm font-medium text-gray-300 mt-1">{table.orderCount} Orders</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-lg font-bold text-primary font-mono">ETB {table.totalBill.toLocaleString()}</p>
                               <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded border", table.status === 'ready' ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-gray-800 text-gray-400 border-gray-700")}>
                                  {table.status}
                               </span>
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-3">
                            <Button size="sm" variant="secondary" className="bg-white/5 hover:bg-white/10 border-white/10" onClick={() => { setSelectedTable(table.tableNo); setAppendOrderId(null); setIsCreateOpen(true); }}>
                               <Plus className="w-3 h-3 mr-2" /> Add Order
                            </Button>
                            <Button size="sm" className="bg-green-600/20 text-green-500 hover:bg-green-600/30 border border-green-600/20" onClick={() => setIsPaymentOpen(true)}>
                               <CreditCard className="w-3 h-3 mr-2" /> Pay Bill
                            </Button>
                         </div>
                   </div>
                ))}
             </div>
          </div>

          {/* Right: Active Orders */}
          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between px-1">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                   <Bell className="w-5 h-5 text-blue-400" /> Active Orders
                </h3>
                <div className="flex gap-2">
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20 px-3">{myActiveOrdersList.filter(o => o.status === 'ready').length} Ready</Badge>
                  <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-3">{myActiveOrdersList.filter(o => o.status === 'preparing').length} Cooking</Badge>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar pb-10">
                {myActiveOrdersList.length === 0 && !isLoading && (
                   <div className="h-40 flex items-center justify-center text-gray-500 bg-white/5 rounded-[2rem] border border-white/5 border-dashed">
                      No active orders
                   </div>
                )}
                {myActiveOrdersList.map(order => (
                   <OrderCard key={order.id} order={order} role="waiter" onAction={handleOrderAction} />
                ))}
             </div>
          </div>
        </div>
      </div>

      <ReceiptVerificationModal isOpen={isVerifyOpen} onClose={() => setIsVerifyOpen(false)} />
      <PaymentVerificationModal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} orders={unpaidServedOrders} onPaymentSuccess={fetchOrders} />
      <FloatingPaymentButton count={unpaidServedOrders.length} onClick={() => setIsPaymentOpen(true)} />
      <CreateOrderModal 
        isOpen={isCreateOpen} 
        onClose={handleCloseModal} 
        onOrderCreated={fetchOrders} 
        initialTableNo={selectedTable} 
        appendOrderId={appendOrderId}
      />
    </DashboardLayout>
  );
};

export default WaiterDashboard;
