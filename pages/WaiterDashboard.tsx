import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { Order } from '../types';
import { Button, Card, CardContent, Badge, showToast, cn } from '../components/ui';
import { 
  Plus, User, Bell, Utensils, TrendingUp, ScanLine, Clock, CreditCard 
} from 'lucide-react';
import { PaymentVerificationModal, FloatingPaymentButton } from '../components/PaymentVerificationModal';
import { ReceiptVerificationModal } from '../components/ReceiptVerificationModal';
import { CreateOrderModal } from '../components/CreateOrderModal';
import { OrderCard } from '../components/OrderCard';

const WaiterDashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]); 
  
  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  
  // Derived State
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchOrders();
    
    // Clock for elapsed time calculations
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);

    // Realtime subscription
    const channel = supabase
      .channel('waiter_orders')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
           fetchOrders();
           if (payload.eventType === 'UPDATE' && payload.new.status === 'ready' && payload.new.waiter_id === user?.id) {
             showToast(`🔔 Order ${payload.new.order_number || ''} is READY!`, 'success');
           }
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      clearInterval(timer);
    }
  }, [user]);

  const fetchOrders = async () => {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00`;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          price,
          special_instructions,
          menu_item:menu (name, category)
        )
      `)
      .gte('created_at', startOfDay)
      .order('created_at', { ascending: false });

    if (!error && data) {
       setOrders(data as Order[]);
    }
  };

  const handleOrderAction = async (action: string, orderId: string) => {
    if (action === 'served') {
        await supabase.from('orders').update({ status: 'served', served_at: new Date().toISOString() }).eq('id', orderId);
        showToast('Order marked as served');
    } else if (action === 'pay') {
        setIsPaymentOpen(true);
    }
    fetchOrders();
  };

  // --- Calculations ---
  // Waiter sees orders they created (waiter_id matches)
  const myOrders = orders.filter(o => o.waiter_id === user?.id);

  const openTablesCount = new Set(
    myOrders
      .filter(o => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status))
      .map(o => o.table_number)
  ).size;

  const activeOrdersCount = myOrders.filter(o => 
    ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)
  ).length;

  const todaySales = myOrders
    .filter(o => ['served', 'completed', 'paid'].includes(o.status))
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Service time calculation
  const servedOrders = myOrders.filter(o => o.status === 'served' || o.status === 'paid' || o.status === 'completed');
  let totalServiceMinutes = 0;
  let validServiceCount = 0;
  
  servedOrders.forEach(o => {
     if (o.served_at && o.created_at) {
        const diff = (new Date(o.served_at).getTime() - new Date(o.created_at).getTime()) / 60000;
        if (diff > 0 && diff < 120) {
           totalServiceMinutes += diff;
           validServiceCount++;
        }
     }
  });
  const avgServiceTime = validServiceCount > 0 ? `${Math.round(totalServiceMinutes / validServiceCount)}m` : '0m';


  // Lists
  const myActiveOrdersList = myOrders.filter(o => 
    ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)
  );

  const unpaidServedOrders = myOrders.filter(o => 
    o.status === 'served'
  );

  // Group by table
  const myTables = Array.from(new Set(myActiveOrdersList.map(o => o.table_number))).map(tNo => {
    const tableOrders = myActiveOrdersList.filter(o => o.table_number === tNo);
    const oldestOrder = [...tableOrders].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    const totalBill = tableOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const lastStatus = tableOrders[tableOrders.length - 1].status;
    const elapsed = Math.floor((currentTime.getTime() - new Date(oldestOrder.created_at).getTime()) / 60000);
    
    return {
      tableNo: tNo,
      elapsed,
      orderCount: tableOrders.length,
      totalBill,
      status: lastStatus,
    };
  }).sort((a,b) => a.elapsed - b.elapsed); 

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'served': return 'bg-emerald-600/20 text-emerald-500 border-emerald-500/30';
      case 'pending': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      default: return 'bg-gray-800 text-gray-400';
    }
  };

  return (
    <DashboardLayout 
      title="Waiter Station" 
      subtitle={`Welcome back, ${profile?.name || 'Staff'}`}
      actions={
        <div className="flex gap-2">
            <Button onClick={() => setIsVerifyOpen(true)} variant="secondary" className="bg-gray-800 text-white hover:bg-gray-700">
               <ScanLine className="mr-2 h-4 w-4" /> Verify Receipt
            </Button>
            <Button onClick={() => { setSelectedTable(''); setIsCreateOpen(true); }} className="bg-primary text-black font-bold hover:bg-primary/90">
               <Plus className="mr-2 h-4 w-4" /> New Order
            </Button>
        </div>
      }
    >
      <div className="space-y-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#1A1A1A] border-gray-800 p-4 flex flex-col justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase">My Open Tables</p>
            <div className="flex justify-between items-end">
              <h3 className="text-2xl font-bold text-white">{openTablesCount}</h3>
              <User className="w-5 h-5 text-primary opacity-50" />
            </div>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800 p-4 flex flex-col justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase">Active Orders</p>
            <div className="flex justify-between items-end">
              <h3 className="text-2xl font-bold text-white">{activeOrdersCount}</h3>
              <Utensils className="w-5 h-5 text-blue-400 opacity-50" />
            </div>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800 p-4 flex flex-col justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase">My Sales Today</p>
            <div className="flex justify-between items-end">
              <h3 className="text-2xl font-bold text-white">ETB {todaySales.toLocaleString()}</h3>
              <TrendingUp className="w-5 h-5 text-green-500 opacity-50" />
            </div>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800 p-4 flex flex-col justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase">Avg Service Time</p>
            <div className="flex justify-between items-end">
              <h3 className="text-2xl font-bold text-white">{avgServiceTime}</h3>
              <Clock className="w-5 h-5 text-orange-400 opacity-50" />
            </div>
          </Card>
        </div>

        {/* Main Content Split */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-[calc(100vh-320px)] min-h-[500px]">
          
          {/* Left: My Tables */}
          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                   <User className="w-5 h-5 text-primary" /> My Tables
                </h3>
                <span className="text-xs text-gray-500">{myTables.length} Active</span>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {myTables.length === 0 && (
                   <div className="h-40 flex flex-col items-center justify-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                      <p>No active tables</p>
                      <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(true)} className="mt-2 text-primary">Start New Table</Button>
                   </div>
                )}
                {myTables.map((table) => (
                   <Card key={table.tableNo} className="bg-[#1A1A1A] border-gray-800 group hover:border-gray-700 transition-colors">
                      <CardContent className="p-4">
                         <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                               <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700">
                                  <span className="text-xl font-bold text-white">{table.tableNo}</span>
                               </div>
                               <div>
                                  <div className="flex items-center gap-2">
                                     <p className="text-xs text-gray-400 font-mono flex items-center">
                                        <Clock className="w-3 h-3 mr-1" /> {table.elapsed}m
                                     </p>
                                     {table.elapsed > 45 && <span className="text-[10px] text-red-500 font-bold px-1.5 py-0.5 bg-red-500/10 rounded">Long Stay</span>}
                                  </div>
                                  <p className="text-sm font-medium text-gray-300 mt-0.5">{table.orderCount} Orders</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-lg font-bold text-primary">ETB {table.totalBill.toLocaleString()}</p>
                               <Badge variant="secondary" className={cn("text-[10px] uppercase", getStatusColor(table.status))}>
                                  {table.status}
                               </Badge>
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-2 mt-2">
                            <Button 
                               size="sm" 
                               variant="secondary" 
                               className="h-9 text-xs"
                               onClick={() => {
                                  setSelectedTable(table.tableNo);
                                  setIsCreateOpen(true);
                               }}
                            >
                               <Plus className="w-3 h-3 mr-2" /> Add Order
                            </Button>
                            <Button 
                               size="sm" 
                               className="h-9 text-xs bg-green-600/20 text-green-500 hover:bg-green-600/30 border border-green-600/20"
                               onClick={() => setIsPaymentOpen(true)}
                            >
                               <CreditCard className="w-3 h-3 mr-2" /> Pay Bill
                            </Button>
                         </div>
                      </CardContent>
                   </Card>
                ))}
             </div>
          </div>

          {/* Right: Active Orders */}
          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                   <Bell className="w-5 h-5 text-blue-400" /> Active Orders
                </h3>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                     {myActiveOrdersList.filter(o => o.status === 'ready').length} Ready
                  </Badge>
                  <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                     {myActiveOrdersList.filter(o => o.status === 'preparing').length} Cooking
                  </Badge>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {myActiveOrdersList.length === 0 && (
                   <div className="h-40 flex items-center justify-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                      No active orders
                   </div>
                )}
                {myActiveOrdersList.map(order => (
                   <OrderCard 
                      key={order.id} 
                      order={order} 
                      role="waiter" 
                      onAction={handleOrderAction} 
                   />
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* --- Modals --- */}
      
      <ReceiptVerificationModal 
         isOpen={isVerifyOpen}
         onClose={() => setIsVerifyOpen(false)}
      />

      <PaymentVerificationModal 
        isOpen={isPaymentOpen} 
        onClose={() => setIsPaymentOpen(false)} 
        orders={unpaidServedOrders}
        onPaymentSuccess={fetchOrders}
      />
      
      <FloatingPaymentButton 
         count={unpaidServedOrders.length} 
         onClick={() => setIsPaymentOpen(true)} 
      />

      <CreateOrderModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        onOrderCreated={fetchOrders}
        initialTableNo={selectedTable}
      />
      
    </DashboardLayout>
  );
};

export default WaiterDashboard;