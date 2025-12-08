import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { Button, Card, CardContent, Badge, showToast } from '../components/ui';
import { Clock, CheckCircle2, Flame, Bell } from 'lucide-react';

const KitchenDashboard: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchOrders();

    const subscription = supabase
      .channel('kitchen_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); }
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          menu_item:menu (name)
        )
      `)
      .in('status', ['verified', 'accepted', 'preparing', 'ready'])
      .order('created_at', { ascending: true }); // Oldest first for kitchen

    if (data) setOrders(data);
  };

  const updateStatus = async (orderId: string, currentStatus: string) => {
    const nextStatusMap: Record<string, string> = {
      'verified': 'accepted',
      'accepted': 'preparing',
      'preparing': 'ready',
    };
    const next = nextStatusMap[currentStatus];
    if (!next) return;

    await supabase.from('orders').update({ status: next }).eq('id', orderId);
    // Optimistic update handled by realtime subscription usually, but for snapiness:
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: next } : o));
    
    if (next === 'ready') showToast('Order marked as Ready!');
  };

  const columns = [
    { id: 'verified', label: 'Incoming', color: 'border-blue-500', icon: <Bell className="w-5 h-5"/> },
    { id: 'accepted', label: 'Prep', color: 'border-purple-500', icon: <CheckCircle2 className="w-5 h-5"/> },
    { id: 'preparing', label: 'Cooking', color: 'border-orange-500', icon: <Flame className="w-5 h-5"/> },
    { id: 'ready', label: 'Ready to Serve', color: 'border-green-500', icon: <CheckCircle2 className="w-5 h-5"/> },
  ];

  return (
    <DashboardLayout title="Kitchen Display" subtitle="Live Order Tracking">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 h-[calc(100vh-140px)] overflow-hidden">
        {columns.map(col => (
          <div key={col.id} className="flex flex-col h-full bg-card/50 rounded-xl border border-border">
            <div className={`p-4 border-b border-border flex items-center gap-2 font-bold ${col.id === 'incoming' ? 'text-blue-400' : 'text-white'}`}>
              {col.icon} {col.label}
              <Badge className="ml-auto" variant="secondary">
                {orders.filter(o => o.status === col.id).length}
              </Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {orders.filter(o => o.status === col.id).map(order => (
                <Card key={order.id} className={`bg-gray-900 border-l-4 ${col.color}`}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-lg font-bold">Table {order.table_no}</span>
                       <span className="text-xs text-gray-500 flex items-center gap-1">
                         <Clock className="w-3 h-3"/> {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </span>
                    </div>
                    
                    <div className="space-y-1 mb-4">
                      {order.order_items.map((item: any, idx: number) => (
                        <div key={idx} className="font-medium text-gray-200">
                          <span className="text-primary font-bold">{item.quantity}x</span> {item.menu_item?.name}
                        </div>
                      ))}
                    </div>

                    {col.id !== 'ready' && (
                      <Button 
                        onClick={() => updateStatus(order.id, order.status)} 
                        className="w-full"
                        variant={col.id === 'preparing' ? 'primary' : 'secondary'}
                      >
                        {col.id === 'verified' ? 'Accept' : col.id === 'accepted' ? 'Start Cooking' : 'Mark Ready'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              {orders.filter(o => o.status === col.id).length === 0 && (
                <div className="text-center text-gray-600 mt-10">Empty</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default KitchenDashboard;