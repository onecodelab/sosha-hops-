import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLayoutConfig } from '../contexts/LayoutContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { supabase } from '@/lib/supabase';
import { Order, Table } from '@/types';
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
  ChefHat,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Zap,
  Bell
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

  const unassignedChatOrders = useMemo(
    () => orders.filter(o => o.source === 'chatbot' && !o.waiter_id && o.status === 'pending'),
    [orders]
  );


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

  const handleInstantClaim = async (orderId: string, tableId: string) => {
    if (claiming) return;
    setClaiming(true);
    try {
      await orderService.claimChatbotOrder(orderId, user!.id, tableId);
      showToast("Order claimed successfully", "success");
      refreshAll();
    } catch (err: any) {
      showToast("Claim failed: " + err.message, "error");
    } finally {
      setClaiming(false);
    }
  };

  const isLoading = ordersLoading || isSyncingTables;

  useLayoutConfig({
    title: "My Station",
    subtitle: (
      <span className="flex items-center gap-1.5 uppercase font-black tracking-widest text-[10px]">
        <span className="text-zinc-500">Floor •</span>
        <span className="text-primary italic">{profile?.full_name || 'Staff Member'}</span>
      </span>
    ),
    actions: (
      <div className="flex gap-3">
        <Button
          onClick={() => {
            setSelectedTableData(null);
            setAppendOrderId(null);
            setIsCreateOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 text-black h-10 px-6 font-black uppercase text-[10px] rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-[1.05] active:scale-[0.95]"
        >
          <PlusCircle className="w-4 h-4" /> New Order
        </Button>
        <Button onClick={refreshAll} variant="outline" size="icon" className="border-white/10 bg-white/5 hover:bg-white/10 h-10 w-10 text-white"><RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} /></Button>
      </div>
    )
  });

  return (
    <>
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
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 10 },
            show: { opacity: 1, y: 0 },
            modalOpen: { opacity: 0.4 }
          }}
          className="mx-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md relative overflow-hidden group transition-all hover:bg-white/10">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Floor</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">{tables.filter(t => t.status === 'available').length}</span>
                  <span className="text-[8px] font-black text-zinc-600 uppercase">/ {tables.length} FREE</span>
                </div>
              </div>

              <div className="w-px h-6 bg-white/10" />

              <div className="flex flex-col">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Load</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-red-500">{tables.filter(t => t.status === 'occupied').length}</span>
                  <div className="px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[7px] font-black text-red-500 uppercase tracking-widest">Occupied</div>
                </div>
              </div>

              <div className="w-px h-6 bg-white/10" />

              <div className="flex flex-col">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Workload</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-primary">{orders.length}</span>
                  {kitchenPipeline.length > 0 && (
                    <div className="px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[7px] font-black text-primary uppercase tracking-widest">
                       +{kitchenPipeline.length}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden sm:block">
              <Button onClick={refreshAll} variant="ghost" size="sm" className="h-8 px-4 text-[9px] font-black uppercase tracking-widest hover:bg-white/5">
                <RefreshCw className={cn("h-3 w-3 mr-2", isLoading && "animate-spin")} />
                Sync
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Production Pipeline - 3 Column Layout */}
        <div className="flex-1 min-h-0 px-2 pb-32">
          {/* Unassigned Chat Orders Banner - Bold, High-Visibility Alert */}
          {unassignedChatOrders.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="mb-8 p-6 md:p-8 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 border-4 border-yellow-200 dark:border-yellow-300 rounded-[2.5rem] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative overflow-hidden shadow-[0_0_60px_rgba(245,158,11,0.6)] animate-pulse-subtle"
            >
              {/* Decorative background glow and stripes */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent pointer-events-none" />
              <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-yellow-300/30 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center gap-5 z-10">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-3xl bg-black text-yellow-400 flex items-center justify-center shadow-2xl shrink-0 animate-bounce border-2 border-yellow-400/30">
                  <Bell className="w-8 h-8 md:w-10 md:h-10 stroke-[2.5] animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-black text-yellow-400 font-mono text-[10px] md:text-xs font-black uppercase tracking-wider animate-pulse shadow-md">
                      ⚠️ ACTION REQUIRED
                    </span>
                    <span className="px-3 py-1 rounded-full bg-red-600 text-white font-mono text-[10px] md:text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" /> LIVE DISPATCH
                    </span>
                  </div>
                  <h4 className="text-xl md:text-3xl font-black text-black uppercase tracking-tight mt-2 drop-shadow-sm leading-tight">
                    {unassignedChatOrders.length} New Chatbot Order{unassignedChatOrders.length > 1 ? 's' : ''} Detected!
                  </h4>
                  <p className="text-xs md:text-sm font-black text-black/80 uppercase tracking-wider mt-1">
                    Customer{unassignedChatOrders.length > 1 ? 's are' : ' is'} waiting at the table — Assign yourself now to start service
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 overflow-x-auto pb-2 lg:pb-0 w-full lg:w-auto px-1 snap-x no-scrollbar z-10">
                {unassignedChatOrders.map(order => (
                  <Button
                    key={order.id}
                    onClick={() => {
                      if (order.table_id) handleInstantClaim(order.id, order.table_id);
                      else {
                        setSelectedChatOrder(order);
                        setIsClaimModalOpen(true);
                      }
                    }}
                    className="shrink-0 snap-center bg-black hover:bg-black/85 text-yellow-400 border-2 border-yellow-400/50 h-16 md:h-18 px-8 rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 min-w-[170px] group cursor-pointer"
                  >
                    <span className="text-[10px] md:text-xs font-black tracking-widest text-white/80 group-hover:text-white uppercase flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 animate-bounce" /> CLAIM {order.order_number}
                    </span>
                    <span className="text-lg md:text-xl font-black tracking-tight text-yellow-400 group-hover:text-yellow-300">
                      Table {order.table_number || '??'}
                    </span>
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          <div className="flex lg:grid overflow-x-auto lg:overflow-visible lg:grid-cols-3 gap-6 h-full min-h-0 snap-x snap-mandatory no-scrollbar lg:custom-scrollbar pb-2 -mx-4 px-4 lg:-mx-0 lg:px-0">
            {/* COLUMN 1: KITCHEN PIPELINE */}
            <div className="w-[85vw] lg:w-auto shrink-0 snap-center flex flex-col min-h-[500px] bg-card/60 backdrop-blur-xl border border-primary/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative group hover:border-orange-500/30 transition-all h-fit">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
              <div className="px-6 py-5 border-b border-white/5 bg-white/5 flex items-center justify-between relative z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)] shrink-0" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 truncate">Kitchen Pipeline</h3>
                </div>
                <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-4 py-1.5 font-mono text-xs font-black shadow-lg shrink-0">
                  {kitchenPipeline.length}
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar relative z-10 min-h-[300px]">
                {kitchenPipeline.map(order => (
                  <OrderCard key={order.id} order={order} role="waiter" onAction={handleOrderAction} />
                ))}
                {kitchenPipeline.length === 0 && (
                  <div className="h-[300px] flex flex-col items-center justify-center opacity-20 gap-6">
                    <div className="p-6 bg-orange-500/10 rounded-full">
                      <ChefHat className="w-12 h-12 text-orange-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500">Pipeline Clear</span>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 2: READY TO SERVE */}
            <div className="w-[85vw] lg:w-auto shrink-0 snap-center flex flex-col min-h-[500px] bg-card/60 backdrop-blur-xl border border-primary/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative group hover:border-emerald-500/30 transition-all h-fit">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
              <div className="px-6 py-5 border-b border-white/5 bg-white/5 flex items-center justify-between relative z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)] shrink-0" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500 truncate">Ready to Serve</h3>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-4 py-1.5 font-mono text-xs font-black shadow-lg shrink-0">
                  {readyOrders.length}
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar relative z-10 min-h-[300px]">
                {readyOrders.map(order => (
                  <OrderCard key={order.id} order={order} role="waiter" onAction={handleOrderAction} />
                ))}
                {readyOrders.length === 0 && (
                  <div className="h-[300px] flex flex-col items-center justify-center opacity-20 gap-6">
                    <div className="p-6 bg-emerald-500/10 rounded-full">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500">All Served</span>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 3: BILLING QUEUE */}
            <div className="w-[85vw] lg:w-auto shrink-0 snap-center flex flex-col min-h-[500px] bg-card/60 backdrop-blur-xl border border-primary/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative group hover:border-blue-500/30 transition-all h-fit">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
              <div className="px-6 py-5 border-b border-white/5 bg-white/5 flex items-center justify-between relative z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] shrink-0" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 truncate">Billing Queue</h3>
                </div>
                <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-4 py-1.5 font-mono text-xs font-black shadow-lg shrink-0">
                  {billingQueue.length}
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar relative z-10 min-h-[300px]">
                {billingQueue.map(order => (
                  <OrderCard key={order.id} order={order} role="waiter" onAction={handleOrderAction} />
                ))}
                {billingQueue.length === 0 && (
                  <div className="h-[300px] flex flex-col items-center justify-center opacity-20 gap-6">
                    <div className="p-6 bg-blue-500/10 rounded-full">
                      <Receipt className="w-12 h-12 text-blue-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">No Pending Bills</span>
                  </div>
                )}
              </div>
            </div>
          </div>
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
    </>
  );
};

export default WaiterDashboard;
