import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { Order, CartItem } from '../types';
import { useMenu } from '../hooks/useMenu';
import { Button, Card, CardContent, Input, Badge, Dialog, showToast, cn } from '../components/ui';
import { 
  Plus, Minus, Search, ShoppingBag, Check, CreditCard, Clock, 
  QrCode, User, Bell, Utensils, TrendingUp, AlertCircle, Bot, ScanLine
} from 'lucide-react';
import QRScanner from '../components/QRScanner';
import { PaymentVerificationModal, FloatingPaymentButton } from '../components/PaymentVerificationModal';
import { ReceiptVerificationModal } from '../components/ReceiptVerificationModal';

const WaiterDashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]); 
  
  // Use the new hook
  const { menuItems, categories, loading: menuLoading } = useMenu(true);

  // Modal & Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  
  const [tableNo, setTableNo] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Derived State
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchOrders();
    
    // Clock for elapsed time calculations
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);

    // Realtime subscription
    const subscription = supabase
      .channel('orders_waiter_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();
        if (payload.eventType === 'UPDATE' && payload.new.status === 'ready' && payload.new.verified_by === user?.id) {
          showToast(`🔔 Order for Table ${payload.new.table_no} is READY!`, 'success');
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(subscription); 
      clearInterval(timer);
    }
  }, [user]);

  const fetchOrders = async () => {
    // Optimization: Only fetch orders from "today"
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00`;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          price_at_time,
          menu_item:menu (name, category)
        )
      `)
      .gte('created_at', startOfDay) // Server-side date filter
      .order('created_at', { ascending: false });

    if (!error && data) {
       // We still perform some client-side filtering to segregate "My" orders vs general pool if needed,
       // but strictly speaking, the Waiter Dashboard usually shows orders relevant to the logged-in waiter.
       // However, sometimes waiters help each other, so we fetch all today's orders but highlight "mine".
       const relevantOrders = data as Order[];
       setOrders(relevantOrders);
    }
  };

  // --- Actions ---
  const updateStatus = async (orderId: string, status: string) => {
    const updateData: any = { status };
    if (status === 'verified') updateData.verified_by = user?.id;
    
    // If marking served and it was unclaimed, claim it now
    const order = orders.find(o => o.id === orderId);
    if (order && !order.verified_by) {
        updateData.verified_by = user?.id;
    }
    
    await supabase.from('orders').update(updateData).eq('id', orderId);
    showToast(`Order status: ${status}`);
    fetchOrders();
  };

  const submitOrder = async () => {
    if (!tableNo || cart.length === 0) return;
    try {
      const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          table_no: tableNo,
          status: 'verified', // Directly verify since I'm creating it
          verified_by: user?.id,
          total_amount: cartTotal,
        })
        .select()
        .single();

      if (error || !order) throw error;

      const itemsPayload = cart.map(i => ({
        order_id: order.id,
        menu_item_id: i.id,
        quantity: i.quantity,
        price_at_time: i.price
      }));

      await supabase.from('order_items').insert(itemsPayload);

      showToast(`Order for Table ${tableNo} sent to kitchen!`);
      setIsCreateOpen(false);
      setCart([]);
      setTableNo('');
      fetchOrders();
    } catch (err) {
      showToast('Failed to create order', 'error');
    }
  };

  // --- Helpers ---
  const getElapsedMinutes = (dateStr: string) => {
    const start = new Date(dateStr).getTime();
    const now = currentTime.getTime();
    return Math.floor((now - start) / 60000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'verified': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'accepted': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'preparing': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'ready': return 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse';
      case 'served': return 'bg-emerald-600/20 text-emerald-500 border-emerald-500/30';
      case 'paid': return 'bg-green-600/20 text-green-500 border-green-600/30';
      default: return 'bg-gray-800 text-gray-400';
    }
  };

  // --- Filtering & Logic ---
  const myOrders = orders.filter(o => o.verified_by === user?.id || o.verified_by === null);

  // 1. Open Tables: Unique tables with active status (pending, preparing, ready)
  const openTablesCount = new Set(
    myOrders
      .filter(o => ['pending', 'verified', 'accepted', 'preparing', 'ready'].includes(o.status))
      .map(o => o.table_no)
  ).size;

  // 2. Active Orders: Total orders in active states
  const activeOrdersCount = myOrders.filter(o => 
    ['pending', 'verified', 'accepted', 'preparing', 'ready'].includes(o.status)
  ).length;

  // 3. Sales Today: Sum of served/paid
  const todaySales = myOrders
    .filter(o => ['served', 'paid', 'ready_to_pay'].includes(o.status))
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // 4. Avg Service Time: (served_at - created_at)
  const servedOrders = myOrders.filter(o => o.status === 'served' || o.status === 'paid');
  let totalServiceMinutes = 0;
  let validServiceCount = 0;
  
  servedOrders.forEach(o => {
     if (o.served_at && o.created_at) {
        const diff = (new Date(o.served_at).getTime() - new Date(o.created_at).getTime()) / 60000;
        if (diff > 0 && diff < 120) { // Filter outliers
           totalServiceMinutes += diff;
           validServiceCount++;
        }
     }
  });
  const avgServiceTime = validServiceCount > 0 ? `${Math.round(totalServiceMinutes / validServiceCount)}m` : '0m';


  // Lists for UI
  const myActiveOrdersList = myOrders.filter(o => 
    ['verified', 'accepted', 'preparing', 'ready', 'served', 'ready_to_pay', 'pending'].includes(o.status)
  );

  const unpaidServedOrders = myOrders.filter(o => 
    ['served', 'ready_to_pay'].includes(o.status) && 
    o.status !== 'paid'
  );
  
  const myTables = Array.from(new Set(myActiveOrdersList.map(o => o.table_no))).map(tNo => {
    const tableOrders = myActiveOrdersList.filter(o => o.table_no === tNo);
    // Sort to find oldest for elapsed time
    const oldestOrder = [...tableOrders].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    const totalBill = tableOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const lastStatus = tableOrders[tableOrders.length - 1].status; 
    
    return {
      tableNo: tNo,
      seatedAt: oldestOrder.created_at,
      elapsed: getElapsedMinutes(oldestOrder.created_at),
      orderCount: tableOrders.length,
      totalBill,
      status: lastStatus,
      orders: tableOrders
    };
  }).sort((a,b) => a.elapsed - b.elapsed); 

  // Filter Menu
  const filteredMenu = menuItems.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <DashboardLayout 
      title="Waiter Station" 
      subtitle={`Welcome back, ${profile?.name || 'Staff'}`}
      actions={
        <div className="flex gap-2">
            <Button onClick={() => setIsVerifyOpen(true)} variant="secondary" className="bg-gray-800 text-white hover:bg-gray-700">
               <ScanLine className="mr-2 h-4 w-4" /> Verify Receipt
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-primary text-black font-bold hover:bg-primary/90">
               <Plus className="mr-2 h-4 w-4" /> New Order
            </Button>
        </div>
      }
    >
      <div className="space-y-6">
        
        {/* 1. KPI Cards */}
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

        {/* 2. Main Content Split */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-[calc(100vh-320px)] min-h-[500px]">
          
          {/* Left: My Tables */}
          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                   <User className="w-5 h-5 text-primary" /> My Tables
                </h3>
                <span className="text-xs text-gray-500">{myTables.length} Active</span>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-3 pr-1">
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
                               <Badge variant={table.status === 'served' ? 'default' : 'secondary'} className={cn("text-[10px] uppercase", getStatusColor(table.status))}>
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
                                  setTableNo(table.tableNo);
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

             <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {myActiveOrdersList.length === 0 && (
                   <div className="h-40 flex items-center justify-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                      No active orders
                   </div>
                )}
                {myActiveOrdersList.map(order => (
                   <div key={order.id} className={cn("relative p-4 rounded-xl border flex flex-col gap-3 transition-all", order.verified_by === null ? "bg-purple-900/10 border-purple-500/30" : "bg-[#1A1A1A] border-gray-800")}>
                      {order.status === 'ready' && (
                         <div className="absolute top-4 right-4 animate-bounce">
                            <span className="flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                         </div>
                      )}
                      
                      <div className="flex justify-between items-start">
                         <div>
                            <span className="text-sm font-bold text-white">Table {order.table_no}</span>
                            <span className="mx-2 text-gray-600">|</span>
                            <span className="text-xs text-gray-400 font-mono">
                               {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                               <span className="ml-1 opacity-50">({getElapsedMinutes(order.created_at)}m ago)</span>
                            </span>
                         </div>
                         <div className="flex items-center gap-2">
                            {order.verified_by === null && (
                                <Badge variant="secondary" className="bg-purple-500 text-white border-purple-400 text-[10px] animate-pulse">
                                    <Bot className="w-3 h-3 mr-1" /> Unclaimed Bot Order
                                </Badge>
                            )}
                            <Badge className={cn("text-[10px] uppercase", getStatusColor(order.status))}>
                                {order.status}
                            </Badge>
                         </div>
                      </div>

                      <div className="bg-black/20 p-2 rounded-lg text-sm text-gray-300 space-y-1">
                         {order.order_items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between">
                               <span><span className="text-primary font-bold">{item.quantity}x</span> {item.menu_item?.name}</span>
                               <span className="text-gray-600">ETB {item.price_at_time * item.quantity}</span>
                            </div>
                         ))}
                      </div>

                      <div className="flex justify-end gap-2">
                         {order.status === 'ready' && (
                            <Button size="sm" onClick={() => updateStatus(order.id, 'served')} className="bg-green-600 hover:bg-green-700 text-white w-full">
                               <Check className="w-4 h-4 mr-2" /> Mark Served
                            </Button>
                         )}
                         {order.status === 'served' && (
                            <Button size="sm" onClick={() => setIsPaymentOpen(true)} variant="outline" className="w-full border-gray-700 hover:bg-gray-800">
                               Request Payment
                            </Button>
                         )}
                         {['verified', 'accepted', 'preparing', 'pending'].includes(order.status) && (
                            <p className="text-xs text-gray-500 italic py-2 text-center w-full">
                               {order.status === 'preparing' ? 'Kitchen is cooking...' : order.status === 'pending' ? 'Pending kitchen review...' : 'Waiting for kitchen...'}
                            </p>
                         )}
                      </div>
                   </div>
                ))}
             </div>
          </div>

        </div>

      </div>

      {/* --- Modals --- */}
      
      {/* Receipt Verification Modal */}
      <ReceiptVerificationModal 
         isOpen={isVerifyOpen}
         onClose={() => setIsVerifyOpen(false)}
      />

      {/* Payment Verification Modal */}
      <PaymentVerificationModal 
        isOpen={isPaymentOpen} 
        onClose={() => setIsPaymentOpen(false)} 
        orders={unpaidServedOrders}
        onPaymentSuccess={() => {
          fetchOrders();
        }}
      />
      
      <FloatingPaymentButton 
         count={unpaidServedOrders.length} 
         onClick={() => setIsPaymentOpen(true)} 
      />

      {/* Create Order Modal */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Order">
        <div className="flex flex-col h-[70vh]">
          <div className="flex gap-4 mb-4">
             <div className="w-1/3">
               <label className="text-xs font-bold text-gray-500 mb-1 block uppercase">Table No.</label>
               <div className="flex gap-2">
                 <Input 
                   type="number" 
                   value={tableNo} 
                   onChange={(e) => setTableNo(e.target.value)} 
                   placeholder="#"
                   className="text-lg font-bold h-12 bg-black/20"
                 />
                 <Button variant="secondary" size="icon" className="h-12 w-12" onClick={() => setIsScannerOpen(true)}>
                   <QrCode className="w-5 h-5" />
                 </Button>
               </div>
             </div>
             <div className="flex-1">
               <label className="text-xs font-bold text-gray-500 mb-1 block uppercase">Search Menu</label>
               <div className="relative">
                 <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
                 <Input 
                   value={searchTerm} 
                   onChange={(e) => setSearchTerm(e.target.value)} 
                   className="pl-9 h-12 bg-black/20"
                   placeholder="Burger, Pizza, etc."
                 />
               </div>
             </div>
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none">
            <Button 
               size="sm" 
               variant={selectedCategory === 'All' ? 'primary' : 'outline'}
               onClick={() => setSelectedCategory('All')}
               className="rounded-full px-4"
            >
               All
            </Button>
            {categories.map(cat => (
               <Button 
                  key={cat}
                  size="sm"
                  variant={selectedCategory === cat ? 'primary' : 'outline'}
                  onClick={() => setSelectedCategory(cat)}
                  className="rounded-full px-4 whitespace-nowrap"
               >
                  {cat}
               </Button>
            ))}
          </div>

          <div className="flex-1 flex gap-4 overflow-hidden">
             {/* Menu List */}
             <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {menuLoading && <p className="text-center text-gray-500 mt-4">Loading menu...</p>}
                {!menuLoading && filteredMenu.length === 0 && (
                   <div className="text-center text-gray-500 mt-10">
                      <Utensils className="w-10 h-10 mx-auto opacity-20 mb-2" />
                      <p>No items found</p>
                   </div>
                )}
                {filteredMenu.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-gray-600 transition-colors cursor-pointer group" onClick={() => addToCart(item)}>
                       <div className="flex items-center gap-3">
                           <div className="h-10 w-10 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-700 overflow-hidden">
                             {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                             ) : (
                                item.name.slice(0,2).toUpperCase()
                             )}
                           </div>
                          <div>
                            <p className="font-bold text-sm text-gray-200">{item.name}</p>
                            <p className="text-xs text-gray-500">ETB {item.price}</p>
                          </div>
                       </div>
                       <Button size="sm" variant="ghost" className="text-primary opacity-0 group-hover:opacity-100"><Plus className="h-4 w-4"/></Button>
                    </div>
                  ))
                }
             </div>

             {/* Cart Summary */}
             <div className="w-1/3 bg-[#0A0A0A] border border-gray-800 rounded-xl p-4 flex flex-col shadow-xl">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-white border-b border-gray-800 pb-2"><ShoppingBag className="h-4 w-4 text-primary"/> Order</h3>
                <div className="flex-1 overflow-y-auto space-y-3">
                   {cart.map(item => (
                     <div key={item.id} className="text-sm bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                       <div className="flex justify-between items-start">
                         <span className="flex-1 text-gray-300 font-medium">{item.name}</span>
                         <span className="font-mono ml-2 text-white">x{item.quantity}</span>
                       </div>
                       <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-500">ETB {item.price * item.quantity}</span>
                          <div className="flex items-center gap-1">
                             <button onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }} className="p-1 hover:bg-gray-700 rounded text-red-400"><Minus className="h-3 w-3"/></button>
                             <button onClick={(e) => { e.stopPropagation(); addToCart(item); }} className="p-1 hover:bg-gray-700 rounded text-green-400"><Plus className="h-3 w-3"/></button>
                          </div>
                       </div>
                     </div>
                   ))}
                   {cart.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                        <ShoppingBag className="w-8 h-8 opacity-20" />
                        <p className="text-xs">Cart empty</p>
                      </div>
                   )}
                </div>
                <div className="border-t border-gray-800 pt-3 mt-2">
                   <div className="flex justify-between text-lg font-bold mb-4 text-white">
                     <span>Total</span>
                     <span className="text-primary">ETB {cart.reduce((a,b) => a + (b.price*b.quantity), 0)}</span>
                   </div>
                   <Button className="w-full bg-primary text-black font-bold hover:bg-primary/90" onClick={submitOrder} disabled={cart.length === 0 || !tableNo}>
                     Send to Kitchen
                   </Button>
                </div>
             </div>
          </div>
        </div>
      </Dialog>
      
      {/* Scanner Overlay */}
      {isScannerOpen && (
        <QRScanner 
          onScan={(data) => { setTableNo(data); setIsScannerOpen(false); showToast(`Table ${data} scanned!`); }} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}
    </DashboardLayout>
  );

  function addToCart(item: any) {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.reduce((acc, item) => {
      if (item.id === id) {
        if (item.quantity > 1) return [...acc, { ...item, quantity: item.quantity - 1 }];
        return acc;
      }
      return [...acc, item];
    }, [] as CartItem[]));
  }
};

export default WaiterDashboard;