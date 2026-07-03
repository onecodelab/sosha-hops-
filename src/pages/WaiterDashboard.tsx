import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLayoutConfig } from '../contexts/LayoutContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { useLanguage } from '../contexts/LanguageContext';
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
  const { language } = useLanguage();
  const isAm = language === 'am';
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
    title: isAm ? "የኔ ጣቢያ" : "My Station",
    subtitle: (
      <span className="flex items-center gap-1.5 uppercase font-black tracking-widest text-[10px]">
        <span className="text-zinc-500">{isAm ? "ጣቢያ •" : "Floor •"}</span>
        <span className="text-primary italic">{profile?.full_name || (isAm ? 'አስተናጋጅ' : 'Staff Member')}</span>
      </span>
    ),
    actions: (
      <div className="flex gap-2 sm:gap-3">
        <Button
          onClick={() => {
            setSelectedTableData(null);
            setAppendOrderId(null);
            setIsCreateOpen(true);
          }}
          className="bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black border-2 border-yellow-200 h-10 sm:h-11 px-5 sm:px-7 font-black uppercase text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:shadow-[0_0_30px_rgba(245,158,11,0.8)] transition-all hover:scale-105 active:scale-95"
        >
          <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" /> <span>{isAm ? "አዲስ ትዕዛዝ +" : "NEW ORDER"}</span>
        </Button>
        <Button onClick={refreshAll} variant="outline" size="icon" className="border-white/15 bg-white/5 hover:bg-white/15 h-10 w-10 sm:h-11 sm:w-11 text-white shadow-md"><RefreshCw className={cn("h-4 w-4 sm:h-5 sm:w-5", isLoading && "animate-spin text-yellow-400")} /></Button>
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
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3 sm:p-5 shadow-2xl backdrop-blur-xl space-y-3">
            {/* Luxury Minimalist POS Command Ribbon (Apple / Square Style) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {/* CARD 1: FLOOR AVAILABILITY */}
              <div className="bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/50 rounded-xl p-3 sm:p-4 transition-all flex flex-col justify-between min-h-[85px] sm:min-h-[105px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider truncate">
                    {isAm ? "ነፃ ጠረጴዛዎች" : "FREE FLOOR"}
                  </span>
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                </div>
                <div className="my-1 flex items-baseline gap-1 sm:gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {tables.filter(t => t.status === 'available').length}
                  </span>
                  <span className="text-[10px] sm:text-xs font-medium text-zinc-500">
                    / {tables.length}
                  </span>
                </div>
                <div className="mt-1 flex items-center">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[8px] sm:text-[9px] font-bold tracking-widest uppercase truncate border border-emerald-500/20">
                    🟢 {isAm ? "ነፃ" : "AVAILABLE"}
                  </span>
                </div>
              </div>

              {/* CARD 2: OCCUPIED LOAD */}
              <div className="bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/50 rounded-xl p-3 sm:p-4 transition-all flex flex-col justify-between min-h-[85px] sm:min-h-[105px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider truncate">
                    {isAm ? "የተያዙ ጠረጴዛዎች" : "ACTIVE TABLES"}
                  </span>
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 shrink-0" />
                </div>
                <div className="my-1 flex items-baseline gap-1 sm:gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {tables.filter(t => t.status === 'occupied').length}
                  </span>
                  <span className="text-[10px] sm:text-xs font-medium text-zinc-500">
                    {isAm ? "ጠረጴዛዎች" : "tables"}
                  </span>
                </div>
                <div className="mt-1 flex items-center">
                  <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-mono text-[8px] sm:text-[9px] font-bold tracking-widest uppercase truncate border border-red-500/20">
                    🔴 {isAm ? "የተያዘ" : "OCCUPIED"}
                  </span>
                </div>
              </div>

              {/* CARD 3: ACTIVE WORKLOAD */}
              <div className="bg-zinc-800/40 hover:bg-zinc-800/70 border border-yellow-500/30 rounded-xl p-3 sm:p-4 transition-all flex flex-col justify-between min-h-[85px] sm:min-h-[105px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] sm:text-xs font-bold text-yellow-500/90 uppercase tracking-wider truncate">
                    {isAm ? "የኔ ትዕዛዞች" : "MY WORKLOAD"}
                  </span>
                  <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />
                </div>
                <div className="my-1 flex items-baseline gap-1 sm:gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-yellow-400 tracking-tight">
                    {orders.length}
                  </span>
                  <span className="text-[10px] sm:text-xs font-medium text-zinc-500">
                    {isAm ? "ትዕዛዞች" : "orders"}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 overflow-hidden">
                  <span className="px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 font-mono text-[8px] sm:text-[9px] font-bold tracking-widest uppercase truncate border border-yellow-400/20">
                    ⚡ {isAm ? "በስራ ላይ" : "ACTIVE"}
                  </span>
                  {kitchenPipeline.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-orange-500 text-black font-mono text-[8px] sm:text-[9px] font-black shrink-0">
                      +{kitchenPipeline.length} {isAm ? "ወጥ ቤት" : "KITCHEN"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tactical Sync Status Bar for Mobile & Desktop */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center gap-2 pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] sm:text-xs font-bold uppercase text-zinc-400 tracking-wider">
                  {isAm ? "የሲስተም ሁኔታ: " : "Station Telemetry: "} <span className="text-green-400 font-mono">{isAm ? "መስመር ላይ (ONLINE) ✓" : "ONLINE & SYNCED ✓"}</span>
                </span>
              </div>
              <Button onClick={refreshAll} variant="ghost" size="sm" className="h-7 sm:h-8 px-3 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 text-zinc-300 transition-all border border-zinc-700/50 rounded-lg">
                <RefreshCw className={cn("h-3 w-3 mr-1.5 text-yellow-400", isLoading && "animate-spin")} />
                {isAm ? "አድስ (SYNC)" : "Sync Station"}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Production Pipeline - 3 Column Layout */}
        <div className="flex-1 min-h-0 px-2 pb-32">
          {/* Unassigned Chat Orders Banner - Sleek, Compact Multi-Order Dispatch Center */}
          {unassignedChatOrders.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="mb-6 p-4 sm:p-5 md:p-6 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 border-2 sm:border-4 border-yellow-200 dark:border-yellow-300 rounded-2xl sm:rounded-3xl relative overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.5)] z-20"
            >
              {/* Decorative background glow and stripes */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/30 via-transparent to-transparent pointer-events-none" />
              
              {/* Compact Sleek Header Bar */}
              {/* Compact Sleek Header Bar */}
              <div className="flex items-center justify-between gap-2 sm:gap-3 w-full pb-3 border-b border-black/15 z-10 relative flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-black text-yellow-400 flex items-center justify-center shadow-lg shrink-0 border border-yellow-400/30">
                    <Bell className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm sm:text-xl font-black text-black uppercase tracking-tight whitespace-nowrap drop-shadow-sm">
                      {isAm ? "የኤአይ (AI) ትዕዛዞች" : "AI Chatbot Orders"}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-black text-yellow-400 font-mono text-[10px] sm:text-xs font-black uppercase tracking-wider animate-pulse shadow">
                      {unassignedChatOrders.length} {isAm ? "በመጠባበቅ ላይ" : "WAITING"}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white font-mono text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  <span className="hidden xs:inline">{isAm ? "አዲስ " : "LIVE "}</span>{isAm ? "ይመደብ" : "DISPATCH"}
                </div>
              </div>

              {/* Responsive Compact Grid Tray with Unmistakable Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-3.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1 z-10 relative w-full">
                {unassignedChatOrders.map(order => (
                  <div
                    key={order.id}
                    className="group relative bg-black/95 hover:bg-black text-left border-2 border-yellow-400/50 hover:border-yellow-300 p-3.5 rounded-2xl shadow-xl transition-all duration-200 flex flex-col justify-between overflow-hidden"
                  >
                    {/* Glowing top border accent */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 opacity-90" />

                    {/* Top Row: Table Info & Item Count */}
                    <div className="flex items-start justify-between gap-2 w-full mt-1">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] font-bold text-yellow-400/80 uppercase tracking-wider block truncate">
                          #{order.order_number}
                        </span>
                        <h5 className="text-lg sm:text-xl font-black tracking-tight text-white group-hover:text-yellow-300 truncate">
                          {isAm ? "ጠረጴዛ" : "Table"} {order.table_number || '??'}
                        </h5>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-white/10 text-white font-mono text-[10px] font-black tracking-wider uppercase shrink-0">
                        {order.order_items?.length || 1} {isAm ? "ምግቦች" : "items"}
                      </span>
                    </div>

                    {/* Bottom Row: Unmistakable Full-Width Action Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (order.table_id) handleInstantClaim(order.id, order.table_id);
                        else {
                          setSelectedChatOrder(order);
                          setIsClaimModalOpen(true);
                        }
                      }}
                      className="mt-3 w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 active:scale-95 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_15px_rgba(250,204,21,0.4)] flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-yellow-200"
                    >
                      <Zap className="w-4 h-4 fill-black text-black animate-bounce shrink-0" />
                      <span>{isAm ? "ትዕዛዙን ተቀበል" : "CLAIM ORDER"}</span>
                    </button>
                  </div>
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
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 truncate">{isAm ? "በወጥ ቤት ያሉ" : "Kitchen Pipeline"}</h3>
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
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500">{isAm ? "ምንም ትዕዛዝ የለም" : "Pipeline Clear"}</span>
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
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500 truncate">{isAm ? "ለአገልግሎት ዝግጁ" : "Ready to Serve"}</h3>
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
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500">{isAm ? "ሁሉም ቀርቧል" : "All Served"}</span>
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
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 truncate">{isAm ? "የሂሳብ ክፍያ ጥያቄዎች" : "Billing Queue"}</h3>
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
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">{isAm ? "ክፍያ የለም" : "No Pending Bills"}</span>
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
        title={isAm ? "ትዕዛዝ ተቀበል" : "Claim Chat Order"}
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">{isAm ? "ጠረጴዛ ምረጥ" : "Assign to Table"}</label>
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
