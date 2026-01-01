import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { Button, cn } from '../components/ui';
import { RefreshCw } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import BillModal from '../components/BillModal';
import ReceiptVerificationModal from '../components/ReceiptVerificationModal';
import PaymentVerificationModal, { FloatingPaymentButton } from '../components/PaymentVerificationModal';
import { CreateOrderModal } from '../components/CreateOrderModal';
import type { Order, Table } from '../types';

const WaiterDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<'floor' | 'my-orders'>('floor');
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [activeBillOrder, setActiveBillOrder] = useState<Order | null>(null);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTableData, setSelectedTableData] = useState<Table | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: tablesData } = await supabase
        .from('tables')
        .select(`*, current_order:orders!current_order_id(id, status, payment_status, total_amount, waiter_id, table_id, order_number)`)
        .order('table_number', { ascending: true });

      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .is('closed_at', null)
        .order('created_at', { ascending: true });

      setTables((tablesData as any[]) || []);
      setOrders((ordersData as Order[]) || []);
    } catch (err) {
      console.error('Waiter fetch error', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('waiter_live_v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const groupedTables = useMemo(() => {
    const groups: Record<string, Table[]> = {};
    tables.forEach((t: any) => {
      const zone = (t.zone as string) || 'General';
      groups[zone] = groups[zone] || [];
      groups[zone].push(t);
    });
    return groups;
  }, [tables]);

  const billingQueue = useMemo(() => {
    return orders.filter(o => o.payment_status !== 'paid');
  }, [orders]);

  const appendOrderId = (id?: string) => {
    // helper for CreateOrderModal prop; kept no-op here
    return id;
  };

  return (
    <DashboardLayout
      title="Waiter Station"
      subtitle={`Floor • ${profile?.full_name || 'Staff'}`}
      actions={
        <div className="flex gap-3">
          <Button
            onClick={fetchData}
            variant="outline"
            size="icon"
            className="border-white/10 bg-white/5 h-10 w-10"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 h-10">
            <button
              onClick={() => setViewMode('floor')}
              className={cn(
                'px-6 text-[10px] font-black uppercase rounded-lg transition-all',
                viewMode === 'floor' ? 'bg-primary text-black' : 'text-gray-500 hover:text-white'
              )}
            >
              Floor Map
            </button>
            <button
              onClick={() => setViewMode('my-orders')}
              className={cn(
                'px-6 text-[10px] font-black uppercase rounded-lg transition-all',
                viewMode === 'my-orders' ? 'bg-primary text-black' : 'text-gray-500 hover:text-white'
              )}
            >
              Active Tasks ({orders.length})
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-8 animate-in fade-in duration-500">
        <AnimatePresence mode="wait">
          {viewMode === 'floor' ? (
            <div className="space-y-10">
              {Object.entries(groupedTables).map(([zone, zoneTables]) => (
                <div key={zone} className="space-y-6">
                  {/* Floor zone content preserved minimal */}
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">{zone}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {zoneTables.map((t: any) => (
                      <div key={t.id} className="p-4 bg-white/[0.02] rounded-2xl text-center">Table {t.table_number}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
              {/* My orders / billing queue */}
              <div className="space-y-4">
                {orders.map(o => (
                  <div key={o.id} className="p-4 bg-white/[0.02] rounded-xl">{o.order_number} — {o.status}</div>
                ))}
              </div>
              <div className="space-y-4">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-400">Billing Queue</h4>
                {billingQueue.map(b => (
                  <div key={b.id} className="p-3 bg-white/[0.02] rounded-xl">{b.order_number} — {b.payment_status}</div>
                ))}
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

      <CreateOrderModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setSelectedTableData(null);
        }}
        onOrderCreated={fetchData}
        initialTableId={selectedTableData?.id}
        initialTableNo={selectedTableData?.number}
        appendOrderId={appendOrderId as any}
      />
    </DashboardLayout>
  );
};

export default WaiterDashboard;
return (
  <DashboardLayout
    title="Waiter Station"
    subtitle={`Floor • ${profile?.full_name || 'Staff'}`}
    actions={
      <div className="flex gap-3">
        <Button
          onClick={fetchData}
          variant="outline"
          size="icon"
          className="border-white/10 bg-white/5 h-10 w-10"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 h-10">
          <button
            onClick={() => setViewMode('floor')}
            className={cn(
              "px-6 text-[10px] font-black uppercase rounded-lg transition-all",
              viewMode === 'floor' ? "bg-primary text-black" : "text-gray-500 hover:text-white"
            )}
          >
            Floor Map
          </button>
          <button
            onClick={() => setViewMode('my-orders')}
            className={cn(
              "px-6 text-[10px] font-black uppercase rounded-lg transition-all",
              viewMode === 'my-orders' ? "bg-primary text-black" : "text-gray-500 hover:text-white"
            )}
          >
            Active Tasks ({orders.length})
          </button>
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
                {/* ... keep your existing floor content here exactly as before ... */}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
            {/* ... keep your existing kitchenPipeline / billingQueue content here ... */}
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

    <ReceiptVerificationModal
      isOpen={isVerifyOpen}
      onClose={() => setIsVerifyOpen(false)}
    />

    <PaymentVerificationModal
      isOpen={isPaymentOpen}
      onClose={() => setIsPaymentOpen(false)}
      orders={billingQueue.filter(o => o.payment_status !== 'paid')}
      onPaymentSuccess={() => fetchData()}
    />

    <FloatingPaymentButton
      count={billingQueue.filter(o => o.payment_status === 'pending').length}
      onClick={() => setIsPaymentOpen(true)}
    />

    <CreateOrderModal
      isOpen={isCreateOpen}
      onClose={() => {
        setIsCreateOpen(false);
        setSelectedTableData(null);
      }}
      onOrderCreated={fetchData}
      initialTableId={selectedTableData?.id}
      initialTableNo={selectedTableData?.number}
      appendOrderId={appendOrderId}
    />
  </DashboardLayout>
);
