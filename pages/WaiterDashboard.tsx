import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { Order, Table } from '../types';
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
import { useOrders } from '../hooks/useOrders';
import { orderService } from '../services/orderService';

const WaiterDashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const { orders, kitchenPipeline, billingQueue, isLoading: ordersLoading, refresh: refreshOrders } = useOrders(user?.id);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);

  const [selectedTableData, setSelectedTableData] = useState<{ id: string, number: string } | null>(null);
  const [appendOrderId, setAppendOrderId] = useState<string | null>(null);
  const [activeBillOrder, setActiveBillOrder] = useState<Order | null>(null);
  const [isSyncingTables, setIsSyncingTables] = useState(false);

  const fetchTables = useCallback(async () => {
    setIsSyncingTables(true);
    try {
      const { data: tableData } = await supabase.from('tables').select('*').order('table_number');
      if (tableData) setTables(tableData as Table[]);
    } catch (err: any) {
      showToast("Sync Failed: " + err.message, "error");
    } finally {
      setIsSyncingTables(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchTables();
    refreshOrders();
  }, [fetchTables, refreshOrders]);

  useEffect(() => {
    fetchTables();
    const sub = supabase.channel('waiter_tables_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchTables())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchTables]);

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
      // Logic for marking served is handled in OrderCard via handleMarkServed calling orderService.markServed
      // We removed the auto-popup of BillModal here to allow serving multiple tables quickly.
      refreshAll();
    } else {
      refreshAll();
    }
  };

  const isLoading = ordersLoading || isSyncingTables;

  return (
    <DashboardLayout
      title="Waiter Station"
      subtitle={
        <span className="flex items-center gap-1.5 uppercase font-black tracking-widest text-[10px]">
          <span className="text-zinc-500">Floor •</span>
          <span className="text-primary italic">{profile?.full_name || 'Staff Member'}</span>
        </span>
      }
      actions={
        <div className="flex gap-3">
          <Button onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary/90 text-black h-10 px-6 font-black uppercase text-[10px] rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
            <PlusCircle className="w-4 h-4" /> New Order
          </Button>
          <Button onClick={refreshAll} variant="outline" size="icon" className="border-white/10 bg-white/5 hover:bg-white/10 h-10 w-10 text-white"><RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} /></Button>
        </div>
      }
    >
      <div className="space-y-10 animate-in fade-in duration-700">
        {/* Sleek Glassmorphic HUD */}
        <div className="mx-2 p-1.5 rounded-[2rem] bg-[#0A0A0A]/80 backdrop-blur-xl border border-white/5 shadow-2xl flex flex-col md:flex-row items-center gap-1 md:gap-8 justify-between relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

          <div className="flex items-center gap-8 pl-8 py-3 z-10 w-full md:w-auto justify-between md:justify-start">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">Availability</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-foreground spacing-tighter">{tables.filter(t => t.status === 'available').length}</span>
                <span className="text-[10px] font-bold text-zinc-600">/ {tables.length}</span>
              </div>
            </div>

            <div className="w-px h-8 bg-white/5 hidden md:block" />

            <div className="flex flex-col">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">Occupied</span>
              <span className="text-3xl font-black text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">{tables.filter(t => t.status === 'occupied').length}</span>
            </div>

            <div className="w-px h-8 bg-white/5 hidden md:block" />

            <div className="flex flex-col">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">Active Tasks</span>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-primary drop-shadow-[0_0_10px_rgba(251,191,36,0.2)]">{orders.length}</span>
                {kitchenPipeline.length > 0 && <span className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-2 rounded-full border border-orange-500/20">+{kitchenPipeline.length} Queue</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Task View Only */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 px-2 pb-32">
          {/* Kitchen Pipeline */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-3">
                <Timer className="w-5 h-5 text-orange-500" /> Kitchen Pipeline
              </h3>
              <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 font-mono">{kitchenPipeline.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kitchenPipeline.map(order => <OrderCard key={order.id} order={order} role="waiter" onAction={handleOrderAction} />)}
              {kitchenPipeline.length === 0 && (
                <div className="h-40 flex flex-col gap-2 items-center justify-center border border-dashed border-white/5 rounded-3xl opacity-20 text-[10px] font-black uppercase tracking-widest col-span-full">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Timer className="w-5 h-5" /></div>
                  No Pending Orders
                </div>
              )}
            </div>
          </div>

          {/* Billing Queue */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-3">
                <Receipt className="w-5 h-5 text-green-500" /> Billing Queue
              </h3>
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 font-mono">{billingQueue.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {billingQueue.map(order => <OrderCard key={order.id} order={order} role="waiter" onAction={handleOrderAction} />)}
              {billingQueue.length === 0 && (
                <div className="h-40 flex flex-col gap-2 items-center justify-center border border-dashed border-white/5 rounded-3xl opacity-20 text-[10px] font-black uppercase tracking-widest col-span-full">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Receipt className="w-5 h-5" /></div>
                  No Active Bills
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BillModal
        isOpen={isBillModalOpen}
        onClose={() => { setIsBillModalOpen(false); refreshAll(); }}
        order={activeBillOrder}
        onSuccess={() => refreshAll()}
      />

      <ReceiptVerificationModal isOpen={isVerifyOpen} onClose={() => setIsVerifyOpen(false)} />
      <PaymentVerificationModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        orders={billingQueue.filter(o => o.payment_status !== 'paid')}
        onPaymentSuccess={() => refreshAll()}
      />
      <FloatingPaymentButton count={billingQueue.filter(o => o.payment_status === 'pending').length} onClick={() => setIsPaymentOpen(true)} />
      <CreateOrderModal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); setSelectedTableData(null); }} onOrderCreated={refreshAll} initialTableId={selectedTableData?.id} initialTableNo={selectedTableData?.number} appendOrderId={appendOrderId} />
    </DashboardLayout>
  );
};

export default WaiterDashboard;
