
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { Order, Table } from '../types';
/* Added Badge to the imports from ./ui */
import { Button, showToast, cn, Badge } from '../components/ui';
import { 
  Clock, 
  RefreshCw,
  LayoutGrid,
  Lock,
  Receipt,
  PlusCircle,
  Timer
} from 'lucide-react';
import { PaymentVerificationModal, FloatingPaymentButton } from '../components/PaymentVerificationModal';
import { ReceiptVerificationModal } from '../components/ReceiptVerificationModal';
import { CreateOrderModal } from '../components/CreateOrderModal';
import { OrderCard } from '../components/OrderCard';
import { BillModal } from '../components/BillModal';
import { motion, AnimatePresence } from 'framer-motion';

const WaiterDashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]); 
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  
  const [selectedTableData, setSelectedTableData] = useState<{id: string, number: string} | null>(null);
  const [appendOrderId, setAppendOrderId] = useState<string | null>(null);
  const [activeBillOrder, setActiveBillOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'floor' | 'my-orders'>('floor');

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data: tableData } = await supabase.from('tables').select('*').order('table_number');
      if (tableData) setTables(tableData as Table[]);

      const { data: orderData } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id, quantity, price, 
            menu_item:menu (name)
          )
        `)
        .eq('waiter_id', user.id)
        .is('closed_at', null)
        .in('status', ['pending', 'accepted', 'preparing', 'ready', 'served', 'paid'])
        .order('created_at', { ascending: true });
        
      if (orderData) setOrders(orderData as Order[]);
    } catch (err: any) {
      showToast("Sync Failed: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('waiter_sync_v22')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchData]);

  const handleTableAction = (table: Table) => {
    setSelectedTableData({ id: table.id, number: table.table_number });
    setAppendOrderId(table.current_order_id || null);
    setIsCreateOpen(true);
  };

  const handleOrderAction = async (action: string, orderId: string) => {
    const target = orders.find(o => o.id === orderId);
    
    if (action === 'append' && target) {
      setSelectedTableData({ id: target.table_id, number: target.table_number });
      setAppendOrderId(target.id);
      setIsCreateOpen(true);
    } else if (action === 'pay') {
      if (target) {
        setActiveBillOrder(target);
        setIsBillModalOpen(true);
      } else {
        setIsPaymentOpen(true);
      }
    } else if (action === 'served' && target) {
      // INSTANT BILL POPUP LOGIC
      setActiveBillOrder(target);
      setIsBillModalOpen(true);
      await fetchData();
    } else {
      await fetchData();
    }
  };

  const kitchenPipeline = useMemo(() => 
    orders.filter(o => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)), 
  [orders]);

  const billingQueue = useMemo(() => 
    orders.filter(o => ['served', 'paid'].includes(o.status)), 
  [orders]);

  const groupedTables = useMemo(() => {
    const groups: Record<string, Table[]> = {};
    tables.forEach(t => {
      const zone = t.zone || 'Main Hall';
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(t);
    });
    return groups;
  }, [tables]);

  return (
    <DashboardLayout title="Waiter Station" subtitle={`Floor • ${profile?.full_name || 'Staff'}`}
      actions={
        <div className="flex gap-3">
            <Button onClick={fetchData} variant="outline" size="icon" className="border-white/10 bg-white/5 h-10 w-10"><RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} /></Button>
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 h-10">
               <button onClick={() => setViewMode('floor')} className={cn("px-6 text-[10px] font-black uppercase rounded-lg transition-all", viewMode === 'floor' ? "bg-primary text-black" : "text-gray-500 hover:text-white")}>Floor Map</button>
               <button onClick={() => setViewMode('my-orders')} className={cn("px-6 text-[10px] font-black uppercase rounded-lg transition-all", viewMode === 'my-orders' ? "bg-primary text-black" : "text-gray-500 hover:text-white")}>Active Tasks ({orders.length})</button>
            </div>
        </div>
      }
    >
      <div className="space-y-8 animate-in fade-in duration-500">
        <AnimatePresence mode="wait">
          {viewMode === 'floor' ? (
            <div className="space-y-10">
               {(Object.entries(groupedTables) as [string, Table[]][]).map(([zone, zoneTables]) => (
                 <div key={zone} className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 flex items-center gap-3">
                       <div className="h-px flex-1 bg-white/5" />
                       <LayoutGrid className="w-3 h-3" /> {zone}
                       <div className="h-px flex-1 bg-white/5" />
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                       {zoneTables.map((table) => {
                          const isOccupied = table.status === 'occupied';
                          const isDirty = table.status === 'needs_cleaning';
                          return (
                            <motion.div 
                              key={table.id} 
                              whileHover={{ scale: 1.02 }} 
                              onClick={() => !isDirty && handleTableAction(table)}
                              className={cn(
                                "group relative h-48 rounded-[2.5rem] border-2 flex flex-col items-center justify-center gap-1 transition-all duration-300 cursor-pointer", 
                                table.status === 'available' && "bg-white/[0.02] border-white/5 hover:border-white/20",
                                isOccupied && "bg-red-500/10 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.15)] ring-4 ring-red-500/5",
                                isDirty && "bg-yellow-500/10 border-yellow-500/50 border-dashed cursor-not-allowed"
                              )}
                            >
                               <span className={cn("text-5xl font-black transition-colors", isOccupied ? "text-red-500" : isDirty ? "text-yellow-500" : "text-white")}>
                                  {table.table_number}
                               </span>
                               <span className={cn("text-[9px] font-black uppercase tracking-widest opacity-60", isOccupied ? "text-red-400" : isDirty ? "text-yellow-500" : "text-zinc-500")}>
                                  {table.status.replace('_', ' ')}
                               </span>
                               {isDirty && <Lock className="w-4 h-4 text-yellow-500 mt-2 opacity-40" />}
                            </motion.div>
                          );
                       })}
                    </div>
                 </div>
               ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
              <div className="space-y-6">
                 <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                       <Timer className="w-5 h-5 text-orange-500" /> Kitchen Pipeline
                    </h3>
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">{kitchenPipeline.length}</Badge>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {kitchenPipeline.map(order => <OrderCard key={order.id} order={order} role="waiter" onAction={handleOrderAction} />)}
                    {kitchenPipeline.length === 0 && <div className="h-40 flex items-center justify-center border border-dashed border-white/5 rounded-3xl opacity-20 text-[10px] font-black uppercase tracking-widest">Pipeline Empty</div>}
                 </div>
              </div>
              
              <div className="space-y-6">
                 <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                       <Receipt className="w-5 h-5 text-green-500" /> Billing Queue
                    </h3>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">{billingQueue.length}</Badge>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {billingQueue.map(order => <OrderCard key={order.id} order={order} role="waiter" onAction={handleOrderAction} />)}
                    {billingQueue.length === 0 && <div className="h-40 flex items-center justify-center border border-dashed border-white/5 rounded-3xl opacity-20 text-[10px] font-black uppercase tracking-widest">No Active Bills</div>}
                 </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <BillModal 
        isOpen={isBillModalOpen} 
        onClose={() => setIsBillModalOpen(false)} 
        order={activeBillOrder} 
        onSuccess={() => fetchData()} 
      />

      <ReceiptVerificationModal isOpen={isVerifyOpen} onClose={() => setIsVerifyOpen(false)} />
      <PaymentVerificationModal 
        isOpen={isPaymentOpen} 
        onClose={() => setIsPaymentOpen(false)} 
        orders={billingQueue.filter(o => o.payment_status !== 'paid')} 
        onPaymentSuccess={() => fetchData()} 
      />
      <FloatingPaymentButton count={billingQueue.filter(o => o.payment_status === 'pending').length} onClick={() => setIsPaymentOpen(true)} />
      <CreateOrderModal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); setSelectedTableData(null); }} onOrderCreated={fetchData} initialTableId={selectedTableData?.id} initialTableNo={selectedTableData?.number} appendOrderId={appendOrderId} />
    </div>
  );
};

export default WaiterDashboard;
