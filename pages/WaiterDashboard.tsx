import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { supabase } from '../supabase';
import { Order, Table } from '../types';
import { Button, showToast, cn, Badge, Card } from '../components/ui';
import {
  Clock,
  RefreshCw,
  LayoutGrid,
  Lock,
  Receipt,
  PlusCircle,
  Timer,
  MessageSquare,
  ChefHat
} from 'lucide-react';
import { PaymentVerificationModal, FloatingPaymentButton } from '../components/PaymentVerificationModal';
import { ReceiptVerificationModal } from '../components/ReceiptVerificationModal';
import { CreateOrderModal } from '../components/CreateOrderModal';
import { OrderCard } from '../components/OrderCard';
import { BillModal } from '../components/BillModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrders } from '../hooks/useOrders';
import { orderService } from '../services/orderService';
import { Dialog } from '../components/ui';

const WaiterDashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const { activeBranchId } = useBranch();
  const [tables, setTables] = useState<Table[]>([]);
  const { orders, kitchenPipeline, readyOrders, billingQueue, isLoading: ordersLoading, refresh: refreshOrders } = useOrders(user?.id);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);

  const [selectedTableData, setSelectedTableData] = useState<{ id: string, number: string } | null>(null);
  const [appendOrderId, setAppendOrderId] = useState<string | null>(null);
  const [activeBillOrder, setActiveBillOrder] = useState<Order | null>(null);
  const [selectedChatOrder, setSelectedChatOrder] = useState<Order | null>(null);
  const [selectedClaimTable, setSelectedClaimTable] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [isSyncingTables, setIsSyncingTables] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const fetchTables = useCallback(async () => {
    if (!activeBranchId) {
      setTables([]);
      setIsSyncingTables(false);
      return;
    }
    setIsSyncingTables(true);
    try {
      const { data: tableData, error: tableErr } = await supabase
        .from('tables')
        .select('*')
        .eq('branch_id', activeBranchId)
        .order('table_number');

      if (tableErr) throw tableErr;
      if (tableData) setTables(tableData as Table[]);
    } catch (err: any) {
      showToast("Sync Failed: " + err.message, "error");
    } finally {
      setIsSyncingTables(false);
    }
  }, [activeBranchId]);

  const refreshAll = useCallback(() => {
    fetchTables();
    refreshOrders();
  }, [fetchTables, refreshOrders]);

  useEffect(() => {
    if (!activeBranchId) return;
    fetchTables();
    const channelName = `waiter_tables_${activeBranchId}`;
    const sub = supabase.channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tables',
        filter: `branch_id=eq.${activeBranchId}`
      }, () => fetchTables())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchTables, activeBranchId]);

  const handleTableAction = (table: Table) => {
    setSelectedTableData({ id: table.id, number: table.table_number });
    setAppendOrderId(table.current_order_id || null);
    setIsSidebarCollapsed(true);
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
        setIsSidebarCollapsed(true);
        setIsBillModalOpen(true);
      } else {
        setIsSidebarCollapsed(true);
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

  const handleClaimOrder = async () => {
    if (!selectedChatOrder || !selectedClaimTable || claiming) return;

    setClaiming(true);
    try {
      await orderService.claimChatbotOrder(selectedChatOrder.id, user!.id, selectedClaimTable);
      showToast("Order claimed successfully", "success");
      setIsClaimModalOpen(false);
      setSelectedChatOrder(null);
      setSelectedClaimTable(null);
      refreshAll();
    } catch (err: any) {
      showToast("Claim failed: " + err.message, "error");
    } finally {
      setClaiming(false);
    }
  };

  const isLoading = ordersLoading || isSyncingTables;

  return (
    <DashboardLayout
      title="Waiter Station"
      isSidebarCollapsed={isSidebarCollapsed}
      onSidebarCollapseChange={setIsSidebarCollapsed}
      subtitle={
        <span className="flex items-center gap-1.5 uppercase font-black tracking-widest text-[10px]">
          <span className="text-zinc-500">Floor •</span>
          <span className="text-primary italic">{profile?.full_name || 'Staff Member'}</span>
        </span>
      }
      actions={
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setSelectedTableData(null);
              setAppendOrderId(null);
              setIsSidebarCollapsed(true);
              setIsCreateOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-black h-10 px-6 font-black uppercase text-[10px] rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-[1.05] active:scale-[0.95]"
          >
            <PlusCircle className="w-4 h-4" /> New Order
          </Button>
          <Button onClick={refreshAll} variant="outline" size="icon" className="border-white/10 bg-white/5 hover:bg-white/10 h-10 w-10 text-white"><RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} /></Button>
        </div>
      }
    >
      <motion.div
        initial="hidden"
        animate={isCreateOpen || isBillModalOpen || isPaymentOpen || isClaimModalOpen ? "modalOpen" : "show"}
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            scale: 1,
            filter: 'blur(0px)',
            transition: {
              staggerChildren: 0.1,
              delayChildren: 0.2
            }
          },
          modalOpen: {
            scale: 0.98,
            opacity: 0.6,
            filter: 'blur(4px)',
            transition: { duration: 0.4, ease: "circOut" }
          }
        }}
        className="space-y-10"
      >
        {/* Standardized Glass HUD */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0 },
            modalOpen: { opacity: 0.4 }
          }}
        >
          <Card variant="elevated" className="mx-2 p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group border-primary/10">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-50" />

            <div className="flex items-center gap-12 z-10 w-full md:w-auto justify-between md:justify-start">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Floor Availability</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-foreground tracking-tighter">{tables.filter(t => t.status === 'available').length}</span>
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">/ {tables.length} FREE</span>
                </div>
              </div>

              <div className="w-px h-10 bg-white/5 hidden md:block" />

              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Table Load</span>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-red-500 tracking-tighter drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">{tables.filter(t => t.status === 'occupied').length}</span>
                  <Badge variant="destructive" className="text-[8px] h-4">Occupied</Badge>
                </div>
              </div>

              <div className="w-px h-10 bg-white/5 hidden md:block" />

              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Workload</span>
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-primary tracking-tighter drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]">{orders.length}</span>
                  {kitchenPipeline.length > 0 && <Badge variant="warning" className="text-[8px] h-4">+{kitchenPipeline.length} Pipeline</Badge>}
                </div>
              </div>
            </div>

            <div className="z-10 hidden lg:block">
              <Button onClick={refreshAll} variant="outline" size="sm" className="h-10 px-6">
                <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                Sync Station
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Task View Only */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 px-2 pb-32">
          {/* Ready to Serve - CRITICAL FOR WAITER */}
          <motion.div
            variants={{
              hidden: { opacity: 0, x: -20 },
              show: { opacity: 1, x: 0 },
              modalOpen: { opacity: 0.2, filter: 'grayscale(1)' }
            }}
            className="space-y-6 col-span-full"
          >
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-3">
                <ChefHat className="w-5 h-5 text-green-500" /> Ready to Serve
              </h3>
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 font-mono">
                {readyOrders.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {readyOrders.map(order =>
                <OrderCard key={order.id} order={order} role="waiter" onAction={handleOrderAction} />
              )}
              {readyOrders.length === 0 && (
                <div className="h-24 flex flex-col gap-2 items-center justify-center border border-dashed border-white/5 rounded-3xl opacity-20 text-[10px] font-black uppercase tracking-widest col-span-full">
                  All orders served
                </div>
              )}
            </div>
          </motion.div>

          {/* Unassigned Chat Orders */}
          {orders.filter(o => o.source === 'chatbot' && !o.waiter_id).length > 0 && (
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 },
                modalOpen: { opacity: 0.1 }
              }}
              className="space-y-6 col-span-full"
            >
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-primary" /> Unassigned Chat Orders
                </h3>
                <Badge variant="glass" className="bg-primary/10 text-primary border-primary/20 font-mono">
                  {orders.filter(o => o.source === 'chatbot' && !o.waiter_id).length} New
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.filter(o => o.source === 'chatbot' && !o.waiter_id).map(order => (
                  <Card key={order.id} variant="elevated" className="p-6 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Incoming Chat Order</div>
                        <h4 className="text-lg font-black text-foreground tracking-tight">{order.order_number}</h4>
                      </div>
                      <Badge variant="outline" className="text-xs uppercase font-mono">Chatbot</Badge>
                    </div>

                    <div className="flex-1 space-y-2">
                      {order.order_items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs font-medium border-b border-white/5 pb-1">
                          <span className="text-zinc-400">
                            <span className="text-primary mr-2">{item.quantity}x</span>
                            {item.menu_item?.name}
                          </span>
                          <span className="text-zinc-500 font-mono">ETB {item.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest">Estimated Total</span>
                        <span className="text-sm font-black text-primary font-mono">ETB {order.total_amount.toLocaleString()}</span>
                      </div>
                      <Button
                        onClick={() => {
                          setSelectedChatOrder(order);
                          if (order.table_id) setSelectedClaimTable(order.table_id);
                          setIsClaimModalOpen(true);
                        }}
                        className="w-full bg-primary hover:bg-primary/90 text-black font-black uppercase text-[10px] h-10 rounded-xl mt-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Claim & Assign Table
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Kitchen Pipeline */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0 }
            }}
            className="space-y-6"
          >
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
          </motion.div>

          {/* Billing Queue */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0 }
            }}
            className="space-y-6"
          >
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
          </motion.div>
        </div>
      </motion.div>

      {/* Claim Modal */}
      <Dialog
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        title="Claim Chat Order"
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Assign to Table</label>
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
              {tables.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedClaimTable(t.id)}
                  disabled={t.status !== 'available' && t.id !== selectedChatOrder?.table_id}
                  className={cn(
                    "h-12 rounded-xl text-xs font-black uppercase transition-all border flex items-center justify-center shadow-sm",
                    selectedClaimTable === t.id
                      ? "bg-primary text-black border-primary shadow-primary/20"
                      : (t.status === 'available' || t.id === selectedChatOrder?.table_id)
                        ? "bg-white/5 text-foreground border-white/10 hover:border-primary/50 hover:bg-primary/10"
                        : "bg-red-500/5 text-red-500/30 border-red-500/10 opacity-50 cursor-not-allowed"
                  )}
                >
                  {t.table_number}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex gap-3">
            <Button variant="outline" onClick={() => setIsClaimModalOpen(false)} className="flex-1 py-3 h-12 rounded-xl font-black uppercase text-[10px]">Cancel</Button>
            <Button
              onClick={handleClaimOrder}
              disabled={!selectedClaimTable || claiming}
              className="flex-1 py-3 h-12 rounded-xl bg-primary hover:bg-primary/90 text-black font-black uppercase text-[10px] shadow-lg shadow-primary/20"
            >
              {claiming ? 'Claiming...' : 'Verify & Claim'}
            </Button>
          </div>
        </div>
      </Dialog >

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
      <CreateOrderModal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); setSelectedTableData(null); setAppendOrderId(null); }} onOrderCreated={refreshAll} initialTableId={selectedTableData?.id} initialTableNo={selectedTableData?.number} appendOrderId={appendOrderId} />
    </DashboardLayout>
  );
};

export default WaiterDashboard;
