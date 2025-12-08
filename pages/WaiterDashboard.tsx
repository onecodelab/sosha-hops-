import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { MenuItem, Order, OrderItem, CartItem } from '../types';
import { Button, Card, CardContent, Input, Badge, Dialog, showToast, cn } from '../components/ui';
import { Plus, Minus, Search, ShoppingBag, Check, X, CreditCard, Clock } from 'lucide-react';

const WaiterDashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'billing'>('pending');
  const [orders, setOrders] = useState<any[]>([]); 
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  // Create Order State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tableNo, setTableNo] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchOrders();
    fetchMenu();
    
    // Realtime subscription for Waiter
    const subscription = supabase
      .channel('orders_waiter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        // Optimistic update or refetch
        fetchOrders();
        
        if (payload.eventType === 'UPDATE') {
          const newStatus = payload.new.status;
          // Notify if ready and verified by me
          if (newStatus === 'ready' && payload.new.verified_by === user?.id) {
            showToast(`🔔 Table ${payload.new.table_no} is READY!`, 'success');
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); }
  }, [user]);

  const fetchOrders = async () => {
    // Fetch orders related to this waiter (or all pending if creating)
    // For pending tab: Show ALL pending orders (waiters help each other verify)
    // For active/billing: Show orders verified by THIS user
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          price_at_time,
          menu_item:menu (name)
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) setOrders(data);
  };

  const fetchMenu = async () => {
    const { data } = await supabase.from('menu').select('*').eq('is_available', true);
    if (data) setMenuItems(data);
  };

  // --- Cart Logic ---
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.reduce((acc, item) => {
      if (item.id === id) {
        if (item.quantity > 1) return [...acc, { ...item, quantity: item.quantity - 1 }];
        return acc;
      }
      return [...acc, item];
    }, [] as CartItem[]));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const submitOrder = async () => {
    if (!tableNo || cart.length === 0) return;
    
    try {
      // 1. Create Order
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          table_no: tableNo,
          status: 'pending',
          total_amount: cartTotal,
        })
        .select()
        .single();

      if (error || !order) throw error;

      // 2. Create Items
      const itemsPayload = cart.map(i => ({
        order_id: order.id,
        menu_item_id: i.id,
        quantity: i.quantity,
        price_at_time: i.price
      }));

      await supabase.from('order_items').insert(itemsPayload);

      showToast(`Order for Table ${tableNo} created!`);
      setIsCreateOpen(false);
      setCart([]);
      setTableNo('');
      fetchOrders();
    } catch (err) {
      showToast('Failed to create order', 'error');
    }
  };

  // --- Order Actions ---
  const updateStatus = async (orderId: string, status: string) => {
    const updateData: any = { status };
    if (status === 'verified') updateData.verified_by = user?.id; // Claim the order
    
    await supabase.from('orders').update(updateData).eq('id', orderId);
    showToast(`Order marked as ${status}`);
    fetchOrders();
  };

  // --- Filtering Orders for Tabs ---
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const activeOrders = orders.filter(o => 
    o.verified_by === user?.id && ['verified', 'accepted', 'preparing', 'ready', 'served'].includes(o.status)
  );
  const billingOrders = orders.filter(o => 
    o.verified_by === user?.id && ['served', 'ready_to_pay'].includes(o.status)
  );

  const getFilteredOrders = () => {
    if (activeTab === 'pending') return pendingOrders;
    if (activeTab === 'active') return activeOrders;
    return billingOrders;
  };

  return (
    <DashboardLayout 
      title="Waiter Dashboard" 
      subtitle={`Service Panel - ${profile?.name || 'Staff'}`}
      actions={
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Order
        </Button>
      }
    >
      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-900/50 p-1 rounded-lg w-fit mb-6">
        {['pending', 'active', 'billing'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize",
              activeTab === tab ? "bg-primary text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Order Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {getFilteredOrders().map((order) => (
          <Card key={order.id} className="border-t-4 border-t-primary">
            <CardContent className="p-4 pt-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">Table {order.table_no}</h3>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" /> 
                    {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
                <Badge variant={order.status === 'ready' ? 'success' : 'secondary'}>
                  {order.status.replace('_', ' ')}
                </Badge>
              </div>

              <div className="space-y-2 mb-4 border-t border-b border-gray-800 py-3">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-300">
                      <span className="font-bold text-primary mr-2">{item.quantity}x</span>
                      {item.menu_item?.name || 'Unknown Item'}
                    </span>
                    <span className="text-gray-500">
                      {(item.price_at_time * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mb-4 font-bold">
                <span>Total</span>
                <span className="text-xl">ETB {order.total_amount}</span>
              </div>

              {/* Actions based on status */}
              <div className="grid gap-2">
                {order.status === 'pending' && (
                  <Button size="sm" onClick={() => updateStatus(order.id, 'verified')}>
                    Verify & Send to Kitchen
                  </Button>
                )}
                {order.status === 'ready' && (
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(order.id, 'served')}>
                    Mark Served
                  </Button>
                )}
                {order.status === 'served' && (
                  <Button size="sm" onClick={() => updateStatus(order.id, 'ready_to_pay')}>
                    Request Payment
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {getFilteredOrders().length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-500">
            No orders found in {activeTab} tab.
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Order">
        <div className="flex flex-col h-[70vh]">
          <div className="flex gap-4 mb-4">
             <div className="w-1/3">
               <label className="text-sm font-medium mb-1 block">Table No.</label>
               <Input 
                 type="number" 
                 value={tableNo} 
                 onChange={(e) => setTableNo(e.target.value)} 
                 placeholder="#"
                 className="text-lg font-bold"
               />
             </div>
             <div className="flex-1">
               <label className="text-sm font-medium mb-1 block">Search Menu</label>
               <div className="relative">
                 <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                 <Input 
                   value={searchTerm} 
                   onChange={(e) => setSearchTerm(e.target.value)} 
                   className="pl-9"
                   placeholder="Burger, Pizza, etc."
                 />
               </div>
             </div>
          </div>

          <div className="flex-1 flex gap-4 overflow-hidden">
             {/* Menu List */}
             <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {menuItems
                  .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded-md bg-gray-900/50 border border-border">
                       <div className="flex items-center gap-3">
                          {item.image_url && <img src={item.image_url} alt="" className="w-10 h-10 rounded bg-gray-800 object-cover" />}
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-gray-400">ETB {item.price}</p>
                          </div>
                       </div>
                       <Button size="sm" variant="ghost" onClick={() => addToCart(item)}><Plus className="h-4 w-4"/></Button>
                    </div>
                  ))
                }
             </div>

             {/* Cart Summary */}
             <div className="w-1/3 bg-gray-900/80 rounded-lg p-4 flex flex-col">
                <h3 className="font-bold mb-3 flex items-center gap-2"><ShoppingBag className="h-4 w-4"/> Cart</h3>
                <div className="flex-1 overflow-y-auto space-y-2">
                   {cart.map(item => (
                     <div key={item.id} className="text-sm">
                       <div className="flex justify-between items-start">
                         <span className="flex-1">{item.name}</span>
                         <span className="font-mono ml-2">x{item.quantity}</span>
                       </div>
                       <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-gray-500">ETB {item.price * item.quantity}</span>
                          <div className="flex items-center gap-1">
                             <button onClick={() => removeFromCart(item.id)} className="p-1 hover:text-red-400"><Minus className="h-3 w-3"/></button>
                             <button onClick={() => addToCart(item)} className="p-1 hover:text-green-400"><Plus className="h-3 w-3"/></button>
                          </div>
                       </div>
                     </div>
                   ))}
                   {cart.length === 0 && <p className="text-xs text-gray-500 text-center py-4">Cart empty</p>}
                </div>
                <div className="border-t border-gray-700 pt-3 mt-2">
                   <div className="flex justify-between font-bold mb-3">
                     <span>Total</span>
                     <span>ETB {cartTotal}</span>
                   </div>
                   <Button className="w-full" onClick={submitOrder} disabled={cart.length === 0 || !tableNo}>
                     Create Order
                   </Button>
                </div>
             </div>
          </div>
        </div>
      </Dialog>
    </DashboardLayout>
  );
};

export default WaiterDashboard;