
import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useLayoutConfig } from '../contexts/LayoutContext';
import { BaroCard } from '../components/BaroCard';
import { Badge, Button, cn, showToast, Dialog, Input } from '../components/ui';
import {
   Armchair, Clock, CheckCircle2, User, RefreshCw,
   AlertTriangle, History, Eye, MapPin,
   Users, TrendingUp, Timer, BarChart3,
   Calendar, Zap, LayoutGrid, Search, Filter, Plus,
   Sparkles, Trash2, Lock, CreditCard, ChevronRight, Edit3, Share2
} from 'lucide-react';
import { Table, TableZone, Order } from '../types';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { RoleGuard } from '../components/RoleGuard';
import { analyticsService, TableMetric } from '../services/analyticsService';
import { motion, AnimatePresence } from 'framer-motion';
import { FloorMapCanvas } from '../components/FloorMapCanvas';
import { TableOrderHistory } from '../components/TableOrderHistory';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { enrichOrdersWithProfiles } from '../utils/orderProfileEnrichment';

const TableStatus: React.FC = () => {
   const navigate = useNavigate();
   const { profile } = useAuth();
   const { hasPermission } = useRoleAccess();
   const { activeBranchId } = useBranch();
   const { t } = useLanguage();
   const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
   const [zoneFilter, setZoneFilter] = useState<TableZone | 'all'>('all');
   const [statusFilter, setStatusFilter] = useState<string>('all');
   const [currentTime, setCurrentTime] = useState(new Date());
   // Add Table Modal State
   const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
   const [newTableData, setNewTableData] = useState({
      table_number: '',
      zone: 'indoor',
      capacity_min: 2,
      capacity_max: 4,
      pos_x: 50,
      pos_y: 50
   });
   const [isAddingTable, setIsAddingTable] = useState(false);

   // Edit/Setup Mode State
   const [isSetupMode, setIsSetupMode] = useState(false);
   const [isEditModalOpen, setIsEditModalOpen] = useState(false);
   const [editingTableId, setEditingTableId] = useState<string | null>(null);

   // Default to 'Live' mode instead of 'Data'
   const [isAnalyticsMode, setIsAnalyticsMode] = useState(false);
   const [isMapView, setIsMapView] = useState(false);
   const canViewAnalytics = hasPermission('canViewAnalytics');

   // Table History State
   const [selectedTableHistory, setSelectedTableHistory] = useState<{ id: string, number: string } | null>(null);
   const [tableOrders, setTableOrders] = useState<Order[]>([]);
   const [historyLoading, setHistoryLoading] = useState(false);
   const [historyView, setHistoryView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
   const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

   // 1. Fetch Live Data (Filtered by Active Branch)
   const { data: tables, isLoading, refetch } = useQuery({
      queryKey: ['live-floor-detailed', activeBranchId],
        queryFn: async () => {
          let selectString = `
            *,
            current_order:orders!current_order_id(status, payment_status, source, waiter_id, order_number),
            sessions:table_sessions(id, seated_at, is_active)
          `;

          let { data, error } = await supabase
             .from('tables')
             .select(selectString)
             .eq('branch_id', activeBranchId)
             .order('table_number', { ascending: true });

          // Fallback if qr_token or map positions missing
          if (error && (error.message.includes('qr_token') || error.message.includes('pos_x'))) {
            selectString = `
              id, table_number, capacity, shape, status, branch_id, organization_id, zone, capacity_min, capacity_max,
              current_order:orders!current_order_id(status, payment_status, source, waiter_id, order_number),
              sessions:table_sessions(id, seated_at, is_active)
            `;
            const { data: retryData, error: retryError } = await supabase
               .from('tables')
               .select(selectString)
               .eq('branch_id', activeBranchId)
               .order('table_number', { ascending: true });
            data = retryData;
            error = retryError;
          }

          if (error) throw error;
          return (data || []).map(t => ({
             ...t,
             active_session: Array.isArray(t.sessions) ? t.sessions.find((s: any) => s.is_active) : null,
             needs_cleanup: t.status === 'occupied' && t.current_order?.status === 'paid'
          }));
        },
      enabled: !!activeBranchId
   });

   // 2. Fetch Analytics Data
   const [analyticsRange, setAnalyticsRange] = useState<'today' | 'week' | 'month'>('today');
   const { data: analyticsData } = useQuery({
      queryKey: ['floor-analytics-overlay', analyticsRange, activeBranchId],
      queryFn: () => analyticsService.getFloorMetrics(analyticsRange, activeBranchId),
      enabled: isAnalyticsMode && canViewAnalytics && !!activeBranchId
   });

   useEffect(() => {
      if (!activeBranchId) return;

      const channel = supabase.channel(`floor-sync-${activeBranchId}`)
         .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'tables',
            filter: `branch_id=eq.${activeBranchId}`
         }, () => refetch())
         .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `branch_id=eq.${activeBranchId}`
         }, () => refetch())
         .subscribe();

      const timer = setInterval(() => setCurrentTime(new Date()), 10000);
      return () => {
         supabase.removeChannel(channel);
         clearInterval(timer);
      };
   }, [refetch, activeBranchId]);

   useEffect(() => {
      if (!activeBranchId || !profile?.id) return;

      const cleanupOrphanedOrders = async () => {
         try {
            const { data, error } = await supabase.functions.invoke('manage-floor', {
               body: {
                  action: 'cleanup_orphaned_orders',
                  branch_id: activeBranchId
               }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            if (data?.cleaned > 0) {
               showToast(data.message, 'success');
               refetch();
            }
         } catch (err) {
            console.warn('Orphaned order cleanup skipped:', err);
         }
      };

      cleanupOrphanedOrders();
   }, [activeBranchId, profile?.id, refetch]);

   const stats = useMemo(() => {
      if (!tables) return { total: 0, available: 0, occupied: 0, dirty: 0, occupancy: 0 };
      const counts = tables.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as any);
      const total = tables.length;
      const occupied = counts['occupied'] || 0;
      return {
         total, available: counts['available'] || 0, occupied,
         dirty: counts['needs_cleaning'] || 0, occupancy: total > 0 ? Math.round((occupied / total) * 100) : 0
      };
   }, [tables]);

   const filteredTables = useMemo(() => {
      return tables?.filter(t => {
         const zoneMatch = zoneFilter === 'all' || t.zone?.toLowerCase() === zoneFilter.toLowerCase();
         const statusMatch = statusFilter === 'all' || t.status === statusFilter || (statusFilter === 'cleanup' && t.needs_cleanup);
         return zoneMatch && statusMatch;
      });
   }, [tables, zoneFilter, statusFilter]);

   const generateToken = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);

   const isChatbotReleaseCandidate = useCallback((table: any) => {
      return table?.status === 'occupied' && (table?.current_order?.source === 'chatbot' || !table?.current_order?.waiter_id);
   }, []);

   const handleCancelAndRelease = useCallback(async (table: any) => {
      if (!table?.id) return;
      if (!isChatbotReleaseCandidate(table)) {
         showToast("This order is not eligible for chatbot release", "warning");
         return;
      }

      const confirmed = window.confirm(
         `Cancel the chatbot order on table #${table.table_number} and release the table?`
      );
      if (!confirmed) return;

      try {
         // Session Health Check
         const { data: { session } } = await supabase.auth.getSession();
         if (!session) {
            showToast("Session expired. Please log in again.", "error");
            navigate('/login');
            return;
         }

         const { data, error } = await supabase.functions.invoke('manage-floor', {
            body: {
               action: 'cancel_and_release_table',
               table_id: table.id
            }
         });

         if (error) {
            console.error("[TableStatus] Edge Function Error:", error);
            throw error;
         }
         
         if (data?.error) {
            console.error("[TableStatus] Edge Function Logic Error:", data);
            throw new Error(data.details || data.error);
         }

         showToast(data?.message || `Table #${table.table_number} released`, 'success');
         refetch();
      } catch (err: any) {
         console.error("[TableStatus] handleCancelAndRelease Exception:", err);
         showToast(err.message || 'Failed to cancel and release table', 'error');
      }
   }, [isChatbotReleaseCandidate, refetch]);

   const handleQuickOrder = useCallback((table: any) => {
      // 1. Setup Mode Behavior
      if (isSetupMode) {
         openEditModal(table);
         return;
      }

      // 2. Already Occupied Check
      if (table.status !== 'available') {
         if (isChatbotReleaseCandidate(table)) {
            handleCancelAndRelease(table);
            return;
         }
         showToast("This table is already occupied", "warning");
         return;
      }

      // 3. Desktop/Analytics Check
      if (isAnalyticsMode) return; 
      
      const chatLink = `/order-chat/${table.id}${table.qr_token ? `?token=${table.qr_token}` : ''}`;
      navigate(chatLink);
   }, [isSetupMode, isAnalyticsMode, navigate, handleCancelAndRelease, isChatbotReleaseCandidate]);


   const openEditModal = (table: any) => {
      setEditingTableId(table.id);
      setNewTableData({
         table_number: table.table_number,
         zone: table.zone || 'indoor',
         capacity_min: table.capacity_min || 2,
         capacity_max: table.capacity_max || 4,
         pos_x: table.pos_x || 50,
         pos_y: table.pos_y || 50
      });
      setIsEditModalOpen(true);
   };

   const openAddTableModal = () => {
      const defaultZone = zoneFilter === 'all' ? 'indoor' : zoneFilter;
      // Set default position based on zone
      const zonePositions: Record<string, { x: number; y: number }> = {
         indoor: { x: 40, y: 45 },
         outdoor: { x: 50, y: 80 },
         bar: { x: 20, y: 15 },
         vip: { x: 75, y: 18 }
      };
      const pos = zonePositions[defaultZone] || { x: 50, y: 50 };
      setNewTableData({
         table_number: '',
         zone: defaultZone,
         capacity_min: 2,
         capacity_max: 4,
         pos_x: pos.x,
         pos_y: pos.y
      });
      setIsAddTableModalOpen(true);
   };

   const handleAddTable = async () => {
      if (!newTableData.table_number.trim()) {
         showToast('Please enter a table number', 'error');
         return;
      }
      setIsAddingTable(true);
      try {
          const payload = {
            table_number: newTableData.table_number.trim(),
            zone: newTableData.zone,
            capacity_min: newTableData.capacity_min,
            capacity_max: newTableData.capacity_max,
            pos_x: newTableData.pos_x,
            pos_y: newTableData.pos_y,
            status: 'available',
            branch_id: activeBranchId,
            organization_id: profile?.organization_id,
            qr_token: generateToken()
          };

          let { error } = await supabase.from('tables').insert(payload);

          // Fallback for missing columns
          if (error && (error.message.includes('qr_token') || error.message.includes('pos_x'))) {
            const { qr_token, pos_x, pos_y, ...clean } = payload as any;
            const { error: retryError } = await supabase.from('tables').insert(clean);
            error = retryError;
          }

          if (error) throw error;
         showToast(`Table ${newTableData.table_number} created successfully!`, 'success');
         setIsAddTableModalOpen(false);
         refetch();
      } catch (err: any) {
         showToast(err.message || 'Failed to create table', 'error');
      } finally {
         setIsAddingTable(false);
      }
   };

   const handleUpdateTable = async () => {
      if (!editingTableId) return;
      setIsAddingTable(true);
      try {
         const payload = {
            table_number: newTableData.table_number.trim(),
            zone: newTableData.zone,
            capacity_min: newTableData.capacity_min,
            capacity_max: newTableData.capacity_max,
            pos_x: newTableData.pos_x,
            pos_y: newTableData.pos_y
         };
         
         let { error } = await supabase
            .from('tables')
            .update(payload)
            .eq('id', editingTableId)
            .eq('organization_id', profile?.organization_id);

         // Fallback for missing position columns
         if (error && error.message.includes('pos_x')) {
            const { pos_x, pos_y, ...clean } = payload as any;
            const { error: retryError } = await supabase
               .from('tables')
               .update(clean)
               .eq('id', editingTableId)
               .eq('organization_id', profile?.organization_id);
            error = retryError;
         }

         if (error) throw error;
         showToast('Table updated successfully', 'success');
         setIsEditModalOpen(false);
         refetch();
      } catch (err: any) {
         showToast(err.message || 'Failed to update table', 'error');
      } finally {
         setIsAddingTable(false);
      }
   };

   const handleDeleteTable = async (tableOrId?: any) => {
      const targetId = typeof tableOrId === 'string' ? tableOrId : (tableOrId?.id || editingTableId);
      const targetTable = typeof tableOrId === 'string' ? tables?.find(t => t.id === tableOrId) : tableOrId;
      if (!targetId) return;
      if (!confirm('Are you sure you want to delete this table?')) return;

      setIsAddingTable(true);
      try {
         if (targetTable?.status === 'occupied') {
            const canCancelChatbotOrder = targetTable.current_order?.source === 'chatbot' || !targetTable.current_order?.waiter_id;

            if (canCancelChatbotOrder) {
               const { data, error } = await supabase.functions.invoke('manage-floor', {
                  body: {
                     action: 'cancel_and_release_table',
                     table_id: targetId
                  }
               });

               if (error) throw error;
               if (data?.error) throw new Error(data.error);
            } else {
               throw new Error('Release the active staff order before deleting this table.');
            }
         }

         const { error } = await supabase.from('tables').delete().eq('id', targetId).eq('organization_id', profile?.organization_id);
         if (error) throw error;

         showToast('Table deleted successfully', 'success');
         setIsEditModalOpen(false);
         refetch();
      } catch (err: any) {
         showToast(err.message || 'Failed to delete table', 'error');
      } finally {
         setIsAddingTable(false);
      }
   };

   const fetchTableOrders = useCallback(async (tableId: string) => {
      setHistoryLoading(true);
      try {
         const { data, error } = await supabase
            .from('orders')
            .select(`
               *,
               order_items (
                  id,
                  quantity,
                  price,
                  menu_item:menu!menu_item_id (name)
               )
            `)
            .eq('table_id', tableId)
            .order('created_at', { ascending: false });

         if (error) throw error;
         setTableOrders(await enrichOrdersWithProfiles((data || []) as Order[]));
      } catch (err: any) {
         showToast("Failed to load table history", "error");
      } finally {
         setHistoryLoading(false);
      }
   }, []);

   const handleViewHistory = useCallback((id: string, num: string) => {
      setSelectedTableHistory({ id, number: num });
      fetchTableOrders(id);
   }, [fetchTableOrders]);

   useLayoutConfig({
      title: t('tableStatus.title'),
      subtitle: isAnalyticsMode ? t('tableStatus.subtitleData') : t('tableStatus.subtitleLive')
   });

   return (
      <>
         <div className="space-y-6 animate-in fade-in duration-500 pb-20">

            <div className="flex flex-col gap-4 bg-card/60 backdrop-blur-xl p-4 md:p-6 rounded-[2rem] border border-primary/20 shadow-2xl">
               {/* Zone Filter and Refresh Button Row */}
               <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 flex-1">
                     {['all', 'indoor', 'outdoor', 'vip', 'bar'].map(z => (
                        <button
                           key={z}
                           onClick={() => setZoneFilter(z as any)}
                           className={cn(
                              "px-5 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap border shrink-0",
                              zoneFilter === z ? "bg-primary text-black border-primary shadow-lg" : "bg-muted/5 text-muted border-white/5 hover:text-foreground hover:bg-muted/10"
                           )}
                        >
                           {t(`tableStatus.filters.${z}`)}
                        </button>
                     ))}
                  </div>
                  <Button variant="ghost" onClick={() => { refetch(); }} size="sm" className="h-9 w-9 md:h-10 md:w-10 p-0 rounded-xl bg-muted/5 border border-primary/20 text-muted hover:text-foreground transition-all shrink-0">
                     <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                  </Button>
               </div>

               <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  {/* View Toggles & Analytics */}
                  <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
                     {canViewAnalytics && (
                        <div className="flex flex-col gap-3 w-full md:w-auto">
                           {isAnalyticsMode && (
                              <div className="flex bg-muted/10 p-1 rounded-xl border border-border animate-in fade-in slide-in-from-top-2">
                                 {(['today', 'week', 'month'] as const).map(r => (
                                    <button
                                       key={r}
                                       onClick={() => setAnalyticsRange(r)}
                                       className={cn(
                                          "flex-1 md:flex-none px-4 py-1.5 text-[9px] uppercase font-black tracking-[0.2em] rounded-lg transition-all",
                                          analyticsRange === r ? "bg-card text-foreground shadow-sm border border-border" : "text-muted hover:text-foreground"
                                       )}
                                    >
                                       {t(`analytics.period.${r}`)}
                                    </button>
                                 ))}
                              </div>
                           )}
                           
                           <div className="flex bg-muted/10 p-1 rounded-xl border border-primary/20 shadow-inner w-full md:w-auto">
                              <button
                                 onClick={() => { setIsAnalyticsMode(false); setIsMapView(false); }}
                                 className={cn("flex-1 px-3 py-2 text-[9px] md:text-[10px] uppercase font-black tracking-widest rounded-lg transition-all flex items-center justify-center gap-2", !isAnalyticsMode && !isMapView ? "bg-primary text-black shadow-md" : "text-muted hover:text-foreground")}
                              >
                                 <LayoutGrid className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={3} /> {t('tableStatus.view.live')}
                              </button>
                              <button
                                 onClick={() => { setIsAnalyticsMode(false); setIsMapView(true); }}
                                 className={cn("flex-1 px-3 py-2 text-[9px] md:text-[10px] uppercase font-black tracking-widest rounded-lg transition-all flex items-center justify-center gap-2", isMapView ? "bg-blue-500 text-white shadow-md" : "text-muted hover:text-foreground")}
                              >
                                 <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={3} /> {t('tableStatus.view.map')}
                              </button>
                              <button
                                 onClick={() => { setIsAnalyticsMode(true); setIsMapView(false); }}
                                 className={cn("flex-1 px-3 py-2 text-[9px] md:text-[10px] uppercase font-black tracking-widest rounded-lg transition-all flex items-center justify-center gap-2", isAnalyticsMode ? "bg-purple-500 text-white shadow-md" : "text-muted hover:text-foreground")}
                              >
                                 <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={3} /> {t('tableStatus.view.data')}
                              </button>
                           </div>
                        </div>
                     )}
                  </div>

                  <div className="flex items-center gap-2 mt-2 md:mt-0 w-full md:w-auto">
                     <RoleGuard allowedRoles={['owner', 'admin']}>
                        <div className="flex gap-2 w-full md:w-auto">
                           <button
                              onClick={() => setIsSetupMode(!isSetupMode)}
                              className={cn(
                                 "flex-1 md:flex-none px-4 py-2 text-[9px] md:text-[10px] uppercase font-black tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 border",
                                 isSetupMode
                                    ? "bg-orange-500 text-white border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.4)] animate-pulse"
                                    : "bg-muted/10 text-muted border-border hover:text-foreground"
                              )}
                           >
                              <Zap className="w-3 h-3" /> {isSetupMode ? t('tableStatus.actions.syncOn') : t('tableStatus.actions.setup')}
                           </button>

                           <Button onClick={openAddTableModal} size="sm" className="flex-1 md:flex-none h-10 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest shadow-inner">
                              <Plus className="w-3 h-3 mr-1 md:mr-2" strokeWidth={3} /> {t('tableStatus.actions.table')}
                           </Button>
                        </div>
                     </RoleGuard>
                  </div>
               </div>
            </div>

            {!isAnalyticsMode && (
               <div className="flex flex-wrap items-center gap-2 md:gap-4 shrink-0">
                  <StatPill label={t('tableStatus.stats.total')} value={stats.total} icon={MapPin} />
                  <StatPill label={t('tableStatus.stats.inUse')} value={stats.occupied} icon={Users} color="red" />
                  <StatPill label={t('tableStatus.stats.load')} value={`${stats.occupancy}%`} icon={TrendingUp} color="blue" />
               </div>
            )}

            {/* Floor Map View */}
            {isMapView && filteredTables && (
               <FloorMapCanvas
                  tables={filteredTables}
                  onTableClick={handleQuickOrder}
                  currentTime={currentTime}
               />
            )}

            {/* Card Grid View (Desktop) */}
            {!isMapView && (
               <>
                  {/* Mobile List View */}
                  <div className="md:hidden space-y-4">
                     {filteredTables?.map((table) => {
                        const metric = analyticsData?.find(m => m.table_id === table.id);
                        const score = metric?.score || 0;
                        let scoreColor = "text-red-500 bg-red-500/10 border-red-500/20";
                        if (score >= 90) scoreColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
                        else if (score >= 80) scoreColor = "text-green-500 bg-green-500/10 border-green-500/20";
                        else if (score >= 65) scoreColor = "text-primary bg-primary/10 border-primary/20";
                        else if (score >= 50) scoreColor = "text-orange-500 bg-orange-500/10 border-orange-500/20";

                        return (
                           <div key={table.id} className="bg-card/60 backdrop-blur-xl border border-primary/20 rounded-3xl p-5 flex items-center justify-between shadow-xl">
                              <div className="flex items-center gap-5">
                                 <div className={cn("w-14 h-14 rounded-2xl flex flex-col items-center justify-center border font-black shadow-inner", scoreColor)}>
                                    <span className="text-lg leading-none">{table.table_number}</span>
                                    {isAnalyticsMode && <span className="text-[7px] mt-1 opacity-60 uppercase">{score}pts</span>}
                                 </div>
                                 <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                       <span className="text-[9px] font-black uppercase text-muted tracking-widest">{table.zone}</span>
                                       {metric?.is_camper && <div className="w-2 h-2 rounded-full bg-red-500 animate-ping shadow-[0_0_10px_rgba(239,68,68,0.5)]" />}
                                    </div>
                                     <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                           <span className="text-[10px] font-black text-primary mr-0.5">ETB</span>
                                           <span className="text-xs font-black text-foreground">{metric?.revenue_per_hour || 0}<span className="text-[8px] opacity-40 ml-0.5">/hr</span></span>
                                        </div>
                                       {table.active_session && (
                                          <div className="flex items-center gap-1.5">
                                             <Timer className="w-3.5 h-3.5 text-muted" />
                                             <span className="text-[10px] font-bold text-muted">
                                                {Math.floor((currentTime.getTime() - new Date(table.active_session.seated_at).getTime()) / 60000)}m
                                              </span>
                                           </div>
                                        )}
                                     </div>
                                  </div>
                              </div>
                                 <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                       if (isAnalyticsMode) {
                                          setSelectedTableHistory({ id: table.id, number: table.table_number });
                                          fetchTableOrders(table.id);
                                       } else if (isChatbotReleaseCandidate(table)) {
                                          handleCancelAndRelease(table);
                                       } else {
                                          handleQuickOrder(table);
                                       }
                                    }}
                                  disabled={!isAnalyticsMode && table.status !== 'available' && !isChatbotReleaseCandidate(table)}
                                  className={cn(
                                     "h-12 w-12 rounded-2xl border transition-all flex items-center justify-center group",
                                     (!isAnalyticsMode && table.status !== 'available' && !isChatbotReleaseCandidate(table)) 
                                        ? "bg-muted/5 border-border cursor-not-allowed opacity-40" 
                                        : "bg-muted/5 border-primary/20 hover:bg-primary/10"
                                  )}
                               >
                                  <ChevronRight className={cn("w-6 h-6 transition-colors", (!isAnalyticsMode && table.status !== 'available' && !isChatbotReleaseCandidate(table)) ? "text-muted" : "text-muted group-hover:text-primary")} strokeWidth={3} />
                               </Button>
                           </div>
                        );
                     })}
                  </div>

                  {/* Desktop Grid View */}
                  <div className="hidden md:grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                     {filteredTables?.map((table) => {
                        const metric = analyticsData?.find(m => m.table_id === table.id);
                        return (
                           <TableCard
                              key={table.id}
                              table={table}
                              currentTime={currentTime}
                              onQuickOrder={handleQuickOrder}
                              onCancelAndRelease={handleCancelAndRelease}
                              isAnalyticsMode={isAnalyticsMode}
                              isSetupMode={isSetupMode}
                              onEdit={() => openEditModal(table)}
                              onDelete={() => handleDeleteTable(table)}
                              metric={metric}
                              onViewHistory={handleViewHistory}
                           />
                        );
                     })}
                  </div>
               </>
            )}
         </div>

         {/* Table Order History Dialog */}
         <Dialog
            isOpen={!!selectedTableHistory}
            onClose={() => setSelectedTableHistory(null)}
            title={`${t('tableStatus.historyTitle')}: #${selectedTableHistory?.number}`}
         >
            <div className="space-y-6">
               <div className="flex bg-black/40 p-1.5 rounded-xl border border-primary/10 backdrop-blur-md self-start w-fit">
                  {(['daily', 'weekly', 'monthly'] as const).map(v => (
                     <button
                        key={v}
                        onClick={() => setHistoryView(v)}
                        className={cn(
                           "px-4 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest",
                           historyView === v ? "bg-primary text-black shadow-lg" : "text-gray-500 hover:text-white"
                        )}
                     >
                        {t(`tableStatus.historyPeriod.${v}`)}
                     </button>
                  ))}
               </div>

               <div className="max-h-[65vh] overflow-y-auto px-4 -mx-4 custom-scrollbar space-y-2">
                  {historyLoading ? (
                     <div className="flex flex-col items-center justify-center py-20 opacity-30">
                        <RefreshCw className="w-10 h-10 animate-spin mb-4 text-primary" strokeWidth={3} />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">{t('tableStatus.syncingHistory')}</p>
                     </div>
                  ) : (
                     <TableOrderHistory
                        orders={tableOrders}
                        view={historyView}
                        onOrderClick={(order) => setSelectedOrder(order)}
                     />
                  )}
               </div>

               <div className="pt-6 border-t border-primary/10">
                  <button
                     onClick={() => setSelectedTableHistory(null)}
                     className="w-full bg-white text-black font-black rounded-xl h-12 uppercase tracking-widest text-xs shadow-xl transition-transform active:scale-95"
                  >
                     {t('tableStatus.exitHistory')}
                  </button>
               </div>
            </div>
         </Dialog>

         <OrderDetailsModal
            isOpen={!!selectedOrder}
            onClose={() => setSelectedOrder(null)}
            order={selectedOrder}
         />

         {/* Add Table Modal */}
         <Dialog isOpen={isAddTableModalOpen} onClose={() => !isAddingTable && setIsAddTableModalOpen(false)} title="Add New Table">
            <div className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Table Number/Name</label>
                  <Input
                     placeholder="e.g. T7, VIP-1, B3..."
                     value={newTableData.table_number}
                     onChange={e => setNewTableData({ ...newTableData, table_number: e.target.value })}
                     className="bg-black/60 border-white/10 h-12 font-bold text-lg"
                     autoFocus
                  />
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Zone</label>
                  <select
                     value={newTableData.zone}
                     onChange={e => setNewTableData({ ...newTableData, zone: e.target.value })}
                     className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary/50"
                  >
                     <option value="indoor">{t('tableStatus.filters.indoor')}</option>
                     <option value="outdoor">{t('tableStatus.filters.outdoor')}</option>
                     <option value="vip">{t('tableStatus.filters.vip')}</option>
                     <option value="bar">{t('tableStatus.filters.bar')}</option>
                  </select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('tableStatus.minCapacity')}</label>
                     <Input
                        type="number"
                        value={newTableData.capacity_min}
                        onChange={e => setNewTableData({ ...newTableData, capacity_min: parseInt(e.target.value) || 1 })}
                        className="bg-black/60 border-white/10 h-11 font-mono"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('tableStatus.maxCapacity')}</label>
                     <Input
                        type="number"
                        value={newTableData.capacity_max}
                        onChange={e => setNewTableData({ ...newTableData, capacity_max: parseInt(e.target.value) || 2 })}
                        className="bg-black/60 border-white/10 h-11 font-mono"
                     />
                  </div>
               </div>

               {/* Position on Floor Map */}
               <div className="space-y-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                     <MapPin className="w-3 h-3" /> {t('tableStatus.mapPosition')}
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <div className="flex justify-between">
                           <span className="text-[9px] text-zinc-500">{t('tableStatus.xPos')}</span>
                           <span className="text-[9px] font-mono text-zinc-400">{newTableData.pos_x}%</span>
                        </div>
                        <input
                           type="range"
                           min={5}
                           max={95}
                           value={newTableData.pos_x}
                           onChange={e => setNewTableData({ ...newTableData, pos_x: parseInt(e.target.value) })}
                           className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                     </div>
                     <div className="space-y-1">
                        <div className="flex justify-between">
                           <span className="text-[9px] text-zinc-500">{t('tableStatus.yPos')}</span>
                           <span className="text-[9px] font-mono text-zinc-400">{newTableData.pos_y}%</span>
                        </div>
                        <input
                           type="range"
                           min={5}
                           max={95}
                           value={newTableData.pos_y}
                           onChange={e => setNewTableData({ ...newTableData, pos_y: parseInt(e.target.value) })}
                           className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                     </div>
                  </div>
               </div>

               <div className="pt-4 space-y-3">
                  <Button
                     onClick={handleAddTable}
                     disabled={isAddingTable || !newTableData.table_number.trim()}
                     className="w-full bg-primary text-black font-black h-14 rounded-2xl shadow-xl shadow-primary/20 text-sm uppercase tracking-widest"
                     isLoading={isAddingTable}
                  >
                     {isAddingTable ? t('common.loading') : t('tableStatus.addTableTitle')}
                  </Button>
                  <Button
                     variant="ghost"
                     onClick={() => setIsAddTableModalOpen(false)}
                     disabled={isAddingTable}
                     className="w-full text-zinc-500 text-xs font-bold uppercase tracking-widest"
                  >
                     {t('common.cancel')}
                  </Button>
               </div>
            </div>
         </Dialog>

         {/* Edit Table Modal */}
         <Dialog isOpen={isEditModalOpen} onClose={() => !isAddingTable && setIsEditModalOpen(false)} title="Edit Table Details">
            <div className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Table Number/Name</label>
                  <Input
                     placeholder="e.g. T7, VIP-1, B3..."
                     value={newTableData.table_number}
                     onChange={e => setNewTableData({ ...newTableData, table_number: e.target.value })}
                     className="bg-black/60 border-white/10 h-12 font-bold text-lg"
                     autoFocus
                  />
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Zone</label>
                  <select
                     value={newTableData.zone}
                     onChange={e => setNewTableData({ ...newTableData, zone: e.target.value })}
                     className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary/50"
                  >
                     <option value="indoor">{t('tableStatus.filters.indoor')}</option>
                     <option value="outdoor">{t('tableStatus.filters.outdoor')}</option>
                     <option value="vip">{t('tableStatus.filters.vip')}</option>
                     <option value="bar">{t('tableStatus.filters.bar')}</option>
                  </select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('tableStatus.minCapacity')}</label>
                     <Input
                        type="number"
                        value={newTableData.capacity_min}
                        onChange={e => setNewTableData({ ...newTableData, capacity_min: parseInt(e.target.value) || 1 })}
                        className="bg-black/60 border-white/10 h-11 font-mono"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('tableStatus.maxCapacity')}</label>
                     <Input
                        type="number"
                        value={newTableData.capacity_max}
                        onChange={e => setNewTableData({ ...newTableData, capacity_max: parseInt(e.target.value) || 2 })}
                        className="bg-black/60 border-white/10 h-11 font-mono"
                     />
                  </div>
               </div>

               {/* Position on Floor Map */}
               <div className="space-y-3 p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                  <label className="text-[10px] font-black uppercase tracking-widest text-orange-400 flex items-center gap-2">
                     <MapPin className="w-3 h-3" /> Adjust Map Position
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <div className="flex justify-between">
                           <span className="text-[9px] text-zinc-500">{t('tableStatus.xPos')}</span>
                           <span className="text-[9px] font-mono text-zinc-400">{newTableData.pos_x}%</span>
                        </div>
                        <input
                           type="range"
                           min={5}
                           max={95}
                           value={newTableData.pos_x}
                           onChange={e => setNewTableData({ ...newTableData, pos_x: parseInt(e.target.value) })}
                           className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                     </div>
                     <div className="space-y-1">
                        <div className="flex justify-between">
                           <span className="text-[9px] text-zinc-500">{t('tableStatus.yPos')}</span>
                           <span className="text-[9px] font-mono text-zinc-400">{newTableData.pos_y}%</span>
                        </div>
                        <input
                           type="range"
                           min={5}
                           max={95}
                           value={newTableData.pos_y}
                           onChange={e => setNewTableData({ ...newTableData, pos_y: parseInt(e.target.value) })}
                           className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                     </div>
                  </div>
               </div>

               <div className="pt-4 space-y-3">
                  <Button
                     onClick={handleUpdateTable}
                     disabled={isAddingTable || !newTableData.table_number.trim()}
                     className="w-full bg-orange-500 text-black font-black h-14 rounded-2xl shadow-xl shadow-orange-500/20 text-sm uppercase tracking-widest hover:bg-orange-400"
                     isLoading={isAddingTable}
                  >
                     {isAddingTable ? t('common.loading') : t('tableStatus.saveChanges')}
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                     <Button
                        variant="ghost"
                        onClick={handleDeleteTable}
                        disabled={isAddingTable}
                        className="w-full text-red-500 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold uppercase tracking-widest"
                     >
                        {t('tableStatus.deleteTable')}
                     </Button>
                     <Button
                        variant="ghost"
                        onClick={() => setIsEditModalOpen(false)}
                        disabled={isAddingTable}
                        className="w-full text-zinc-500 text-xs font-bold uppercase tracking-widest"
                     >
                        {t('common.cancel')}
                     </Button>
                  </div>
               </div>
            </div>
         </Dialog>
      </>
   );
};

const StatPill = ({ label, value, icon: Icon, color }: any) => {
   const colors: any = {
      default: 'text-muted border-primary/20 bg-muted/5',
      green: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10',
      red: 'text-red-500 border-red-500/20 bg-red-500/10',
      yellow: 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10',
      blue: 'text-blue-500 border-blue-500/20 bg-blue-500/10'
   };
   return (
      <div className={cn("px-3 md:px-4 py-2 md:py-3 rounded-xl md:rounded-2xl border flex items-center gap-2 md:gap-3 transition-all shadow-md group flex-1 md:flex-none justify-center md:justify-start", colors[color || 'default'])}>
         <Icon className="w-4 h-4 md:w-5 md:h-5 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" strokeWidth={3} />
         <div className="flex flex-col items-start justify-center gap-0.5 min-w-[3rem]">
            <span className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em] opacity-50 leading-none truncate w-full">{label}</span>
            <span className="text-sm md:text-base font-black tracking-tighter text-foreground leading-none">{value}</span>
         </div>
      </div>
   );
};

interface TableCardProps {
   table: any;
   currentTime: Date;
   onQuickOrder: (table: any) => void;
   onCancelAndRelease?: (table: any) => void;
   isAnalyticsMode?: boolean;
   isSetupMode?: boolean;
   onEdit?: () => void;
   onDelete?: () => void;
   metric?: TableMetric;
   onViewHistory?: (tableId: string, tableNumber: string) => void;
}

const TableCard: React.FC<TableCardProps> = React.memo(({ table, currentTime, onQuickOrder, onCancelAndRelease, isAnalyticsMode, isSetupMode, onEdit, onDelete, metric, onViewHistory }) => {
   const { profile } = useAuth();
   const { t } = useLanguage();
   const isOccupied = table.status === 'occupied';
   const isDirty = table.status === 'needs_cleaning';
   const isChatbotReleaseCandidate = isOccupied && (table.current_order?.source === 'chatbot' || !table.current_order?.waiter_id);
   const elapsedMins = table.active_session ? Math.floor((currentTime.getTime() - new Date(table.active_session.seated_at).getTime()) / 60000) : 0;

   // Theme-aware status colors
   const statusStyles = {
      available: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      occupied: "text-red-500 bg-red-500/10 border-red-500/20",
      needs_cleaning: "text-amber-500 bg-amber-500/10 border-amber-500/20"
   };

   // Heatmap color logic
   const score = metric?.score || 0;
   let heatColor = "text-muted border-border bg-muted/5";
   if (isAnalyticsMode) {
      if (score >= 90) heatColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/25";
      else if (score >= 80) heatColor = "text-green-500 bg-green-500/10 border-green-500/25";
      else if (score >= 65) heatColor = "text-primary bg-primary/10 border-primary/25";
      else if (score >= 50) heatColor = "text-orange-500 bg-orange-500/10 border-orange-500/25";
      else heatColor = "text-red-500 bg-red-500/10 border-red-500/25";
   }

   return (
      <motion.div
         layout
         initial={{ opacity: 0, scale: 0.95 }}
         animate={{ opacity: 1, scale: 1 }}
         transition={{ duration: 0.4 }}
         className={cn(
            "bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] p-6 shadow-2xl relative group transition-all duration-500",
            isAnalyticsMode ? heatColor : "hover:scale-[1.02] hover:border-primary/30",
            isDirty && !isAnalyticsMode && "bg-amber-500/5 border-amber-500/20"
         )}
      >
         <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-muted tracking-widest">{table.zone}</span>
                  {metric?.is_camper && (
                     <div className="flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-full">
                        <Zap className="w-2.5 h-2.5 text-red-500" />
                        <span className="text-[8px] font-black text-red-500 uppercase">{t('tableStatus.camper')}</span>
                     </div>
                  )}
               </div>
               <h3 className="text-3xl font-black text-foreground tracking-tighter">#{table.table_number}</h3>
            </div>
            <div className="flex flex-col items-end gap-2">
               {isSetupMode ? (
                  <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                        className="h-10 w-10 p-0 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400 border border-blue-400/50"
                      >
                        <Edit3 className="w-4 h-4" strokeWidth={3} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                        className="h-10 w-10 p-0 rounded-xl bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-400 border border-red-400/50"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={3} />
                      </Button>
                  </div>
               ) : (
                  <div className={cn("p-3 rounded-2xl shadow-inner", isAnalyticsMode ? heatColor : statusStyles[table.status as keyof typeof statusStyles])}>
                     <Armchair className="w-6 h-6" strokeWidth={3} />
                  </div>
               )}
            </div>
         </div>

         {isAnalyticsMode ? (
            <div className="space-y-4">
               <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/5 border border-border p-3 rounded-2xl">
                     <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">{t('tableStatus.metrics.score')}</p>
                     <p className="text-lg font-black text-foreground">{score}%</p>
                  </div>
                   <div className="bg-muted/5 border border-border p-3 rounded-2xl">
                      <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">{t('tableStatus.metrics.orders')}</p>
                      <p className="text-lg font-black text-foreground">{metric?.orders_count || 0}</p>
                   </div>
               </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/5 border border-primary/10">
                   <div className="flex items-center gap-1">
                      <span className="text-[10px] font-black text-primary mr-1">ETB</span>
                      <span className="text-xs font-black text-foreground">{metric?.revenue_per_hour || 0}<span className="text-[8px] opacity-40">/hr</span></span>
                   </div>
                  <Button
                     size="sm"
                     variant="ghost"
                     onClick={() => onViewHistory?.(table.id, table.table_number)}
                     className="h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-all"
                  >
                     <History className="w-3.5 h-3.5 mr-1.5" /> {t('tableStatus.metrics.history')}
                  </Button>
               </div>
            </div>
         ) : (
            <div className="space-y-6">
               <div className="flex flex-wrap gap-2">
                  <Badge className={cn("px-3 py-1 font-black text-[9px] uppercase tracking-widest shadow-md", statusStyles[table.status as keyof typeof statusStyles])}>
                     {table.status}
                  </Badge>
                  {isOccupied && (
                     <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-3 py-1 font-black text-[9px] uppercase tracking-widest">
                        {elapsedMins}{t('tableStatus.elapsedIn')}
                     </Badge>
                  )}
               </div>

               <div className="pt-4 border-t border-border flex gap-3">
                  {isChatbotReleaseCandidate ? (
                     <Button
                        onClick={() => onCancelAndRelease?.(table)}
                        className="flex-1 font-black rounded-2xl h-12 text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 bg-red-500 text-white hover:bg-red-400"
                     >
                        Cancel & Release
                     </Button>
                  ) : (
                     <Button
                        onClick={() => onQuickOrder(table)}
                        disabled={table.status !== 'available'}
                        className={cn(
                           "flex-1 font-black rounded-2xl h-12 text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95",
                           table.status === 'available' 
                              ? "bg-foreground text-background hover:bg-foreground/90" 
                              : "bg-muted/10 text-muted border border-border cursor-not-allowed opacity-50"
                        )}
                     >
                        {t('tableStatus.quickOrder')}
                     </Button>
                  )}
                  <Button
                     variant="ghost"
                     size="sm"
                     onClick={(e) => {
                        e.stopPropagation();
                        const link = `${window.location.origin}/order-chat/${table.id}${table.qr_token ? `?token=${table.qr_token}` : ''}`;
                        navigator.clipboard.writeText(link);
                        showToast("Chatbot link copied to clipboard", "success");
                     }}
                     className="w-12 h-12 rounded-2xl bg-muted/5 border border-border text-muted hover:text-primary transition-all shrink-0"
                  >
                     <Share2 className="w-4 h-4" />
                  </Button>
                  <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => onViewHistory?.(table.id, table.table_number)}
                     className="w-12 h-12 rounded-2xl bg-muted/5 border border-border text-muted hover:text-foreground transition-all shrink-0"
                  >
                     <History className="w-4 h-4" />
                  </Button>
               </div>
            </div>
         )}
      </motion.div>
   );
});

export default TableStatus;
