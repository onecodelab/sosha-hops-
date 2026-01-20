
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { SoshaCard } from '../components/SoshaCard';
import { Badge, Button, cn, showToast, Dialog, Input } from '../components/ui';
import {
   Armchair, Clock, CheckCircle2, User, RefreshCw,
   AlertTriangle, History, Eye, MapPin,
   Users, TrendingUp, DollarSign, Timer, BarChart3,
   Calendar, Zap, LayoutGrid, Search, Filter, Plus,
   Sparkles, Trash2, Lock
} from 'lucide-react';
import { Table, TableZone, Order } from '../types';
import { useAuth } from '../AuthContext';
import { CreateOrderModal } from '../components/CreateOrderModal';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { RoleGuard } from '../components/RoleGuard';
import { analyticsService, TableMetric } from '../services/analyticsService';
import { motion, AnimatePresence } from 'framer-motion';
import { FloorMapCanvas } from '../components/FloorMapCanvas';

const TableStatus: React.FC = () => {
   const { profile } = useAuth();
   const { hasPermission } = useRoleAccess();
   const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
   const [zoneFilter, setZoneFilter] = useState<TableZone | 'all'>('all');
   const [statusFilter, setStatusFilter] = useState<string>('all');
   const [currentTime, setCurrentTime] = useState(new Date());
   const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
   const [orderInitialTable, setOrderInitialTable] = useState('');
   const [orderAppendId, setOrderAppendId] = useState<string | null>(null);

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

   // New: Analytics Mode State (Starts in Analytics for Owners)
   const [isAnalyticsMode, setIsAnalyticsMode] = useState(true);
   const [isMapView, setIsMapView] = useState(false);
   const canViewAnalytics = hasPermission('canViewAnalytics');

   // 1. Fetch Live Data
   const { data: tables, isLoading, refetch } = useQuery({
      queryKey: ['live-floor-detailed'],
      queryFn: async () => {
         const { data, error } = await supabase
            .from('tables')
            .select(`
          *,
          current_order:orders!current_order_id(status, payment_status),
          sessions:table_sessions(id, seated_at, is_active)
        `)
            .order('table_number', { ascending: true });

         if (error) throw error;
         return (data || []).map(t => ({
            ...t,
            active_session: Array.isArray(t.sessions) ? t.sessions.find((s: any) => s.is_active) : null,
            needs_cleanup: t.status === 'occupied' && t.current_order?.status === 'paid'
         }));
      }
   });

   // 2. Fetch Analytics Data
   const [analyticsRange, setAnalyticsRange] = useState<'today' | 'week' | 'month'>('today');
   const { data: analyticsData } = useQuery({
      queryKey: ['floor-analytics-overlay', analyticsRange],
      queryFn: () => analyticsService.getFloorMetrics(analyticsRange),
      enabled: isAnalyticsMode && canViewAnalytics
   });

   useEffect(() => {
      const channel = supabase.channel('floor-sync-v10')
         .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => refetch())
         .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refetch())
         .subscribe();
      const timer = setInterval(() => setCurrentTime(new Date()), 10000);
      return () => { supabase.removeChannel(channel); clearInterval(timer); };
   }, [refetch]);

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

   const handleQuickOrder = (table: any) => {
      // 1. Setup Mode Behavior
      if (isSetupMode) {
         openEditModal(table);
         return;
      }

      // 2. Standard Order Behavior
      if (isAnalyticsMode) return; // Disable quick actions in analytics mode
      setOrderInitialTable(table.table_number.toString());
      setOrderAppendId(table.status === 'occupied' ? table.current_order_id : null);
      setIsOrderModalOpen(true);
   };

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
         const { error } = await supabase.from('tables').insert({
            table_number: newTableData.table_number.trim(),
            zone: newTableData.zone,
            capacity_min: newTableData.capacity_min,
            capacity_max: newTableData.capacity_max,
            pos_x: newTableData.pos_x,
            pos_y: newTableData.pos_y,
            status: 'available'
         });
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
         const { error } = await supabase
            .from('tables')
            .update({
               table_number: newTableData.table_number.trim(),
               zone: newTableData.zone,
               capacity_min: newTableData.capacity_min,
               capacity_max: newTableData.capacity_max,
               pos_x: newTableData.pos_x,
               pos_y: newTableData.pos_y
            })
            .eq('id', editingTableId);

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

   const handleDeleteTable = async () => {
      if (!editingTableId) return;
      if (!confirm('Are you sure you want to delete this table?')) return;

      setIsAddingTable(true);
      try {
         const { error } = await supabase.from('tables').delete().eq('id', editingTableId);
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

   return (
      <DashboardLayout title="Floor Status" subtitle={isAnalyticsMode ? "Performance Heatmap (Today)" : "Real-time occupancy visualization"}>
         <div className="space-y-6 animate-in fade-in duration-500 pb-20">

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 p-4 rounded-[2rem] border border-white/5">
               {/* Zone Filter */}
               <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto w-full md:w-auto no-scrollbar">
                  {['all', 'indoor', 'outdoor', 'vip', 'bar'].map(z => (
                     <button key={z} onClick={() => setZoneFilter(z as any)} className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", zoneFilter === z ? "bg-primary text-black" : "text-gray-500 hover:text-white")}>{z}</button>
                  ))}
               </div>

               <div className="flex gap-2">
                  {/* Analytics Toggle (Restricted) */}
                  {canViewAnalytics && (
                     <div className="flex items-center gap-2">
                        {isAnalyticsMode && (
                           <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 animate-in slide-in-from-right-4 duration-300">
                              {(['today', 'week', 'month'] as const).map(r => (
                                 <button
                                    key={r}
                                    onClick={() => setAnalyticsRange(r)}
                                    className={cn(
                                       "px-3 py-1 text-[9px] uppercase font-black tracking-widest rounded-md transition-all",
                                       analyticsRange === r ? "bg-primary text-black" : "text-zinc-500 hover:text-white"
                                    )}
                                 >
                                    {r}
                                 </button>
                              ))}
                           </div>
                        )}
                        <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                           <button
                              onClick={() => { setIsAnalyticsMode(false); setIsMapView(false); }}
                              className={cn("px-3 py-1.5 text-[10px] uppercase font-black tracking-wider rounded-md transition-all flex items-center gap-2", !isAnalyticsMode && !isMapView ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white")}
                           >
                              <LayoutGrid className="w-3 h-3" /> Live
                           </button>
                           <button
                              onClick={() => { setIsAnalyticsMode(false); setIsMapView(true); }}
                              className={cn("px-3 py-1.5 text-[10px] uppercase font-black tracking-wider rounded-md transition-all flex items-center gap-2", isMapView ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-white")}
                           >
                              <MapPin className="w-3 h-3" /> Map
                           </button>
                           <button
                              onClick={() => { setIsAnalyticsMode(true); setIsMapView(false); }}
                              className={cn("px-3 py-1.5 text-[10px] uppercase font-black tracking-wider rounded-md transition-all flex items-center gap-2", isAnalyticsMode ? "bg-primary text-black" : "text-zinc-500 hover:text-white")}
                           >
                              <TrendingUp className="w-3 h-3" /> Analytics
                           </button>
                        </div>
                     </div>
                  )}

                  <RoleGuard allowedRoles={['owner', 'admin']}>
                     <div className="flex gap-2">
                        <button
                           onClick={() => setIsSetupMode(!isSetupMode)}
                           className={cn(
                              "px-3 py-1.5 text-[10px] uppercase font-black tracking-wider rounded-lg transition-all flex items-center gap-2 border",
                              isSetupMode
                                 ? "bg-orange-500 text-black border-orange-500 animate-pulse"
                                 : "bg-black/40 text-zinc-500 border-white/5 hover:text-white"
                           )}
                        >
                           <AlertTriangle className="w-3.5 h-3.5" />
                           {isSetupMode ? 'Setup ON' : 'Setup'}
                        </button>

                        <Button variant="outline" onClick={openAddTableModal} size="sm" className="border-primary/30 bg-primary/10 text-primary rounded-lg hover:bg-primary/20">
                           <Plus className="w-3.5 h-3.5 mr-2" /> Add Table
                        </Button>
                     </div>
                  </RoleGuard>

                  <Button variant="outline" onClick={() => refetch()} size="sm" className="border-white/10 bg-white/5 rounded-lg"><RefreshCw className={cn("w-3.5 h-3.5 mr-2", isLoading && "animate-spin")} /> Refresh</Button>
               </div>
            </div>

            {!isAnalyticsMode && (
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <StatPill label="Total" value={stats.total} icon={MapPin} />
                  <StatPill label="Free" value={stats.available} icon={CheckCircle2} color="green" />
                  <StatPill label="In Use" value={stats.occupied} icon={Users} color="red" />
                  <StatPill label="Dirty" value={stats.dirty} icon={Sparkles} color="yellow" />
                  <StatPill label="Load" value={`${stats.occupancy}%`} icon={TrendingUp} color="blue" />
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

            {/* Card Grid View */}
            {!isMapView && (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredTables?.map((table) => {
                     const metric = analyticsData?.find(m => m.table_id === table.id);
                     return (
                        <TableCard
                           key={table.id}
                           table={table}
                           currentTime={currentTime}
                           onQuickOrder={handleQuickOrder}
                           isAnalyticsMode={isAnalyticsMode}
                           metric={metric}
                        />
                     );
                  })}
               </div>
            )}
         </div>

         <CreateOrderModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} initialTableNo={orderInitialTable} appendOrderId={orderAppendId} onOrderCreated={refetch} />

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
                     <option value="indoor">Indoor</option>
                     <option value="outdoor">Outdoor</option>
                     <option value="vip">VIP</option>
                     <option value="bar">Bar</option>
                  </select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Min Capacity</label>
                     <Input
                        type="number"
                        value={newTableData.capacity_min}
                        onChange={e => setNewTableData({ ...newTableData, capacity_min: parseInt(e.target.value) || 1 })}
                        className="bg-black/60 border-white/10 h-11 font-mono"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Max Capacity</label>
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
                     <MapPin className="w-3 h-3" /> Map Position
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <div className="flex justify-between">
                           <span className="text-[9px] text-zinc-500">X Position</span>
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
                           <span className="text-[9px] text-zinc-500">Y Position</span>
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
                     {isAddingTable ? 'Creating...' : 'Create Table'}
                  </Button>
                  <Button
                     variant="ghost"
                     onClick={() => setIsAddTableModalOpen(false)}
                     disabled={isAddingTable}
                     className="w-full text-zinc-500 text-xs font-bold uppercase tracking-widest"
                  >
                     Cancel
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
                     <option value="indoor">Indoor</option>
                     <option value="outdoor">Outdoor</option>
                     <option value="vip">VIP</option>
                     <option value="bar">Bar</option>
                  </select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Min Capacity</label>
                     <Input
                        type="number"
                        value={newTableData.capacity_min}
                        onChange={e => setNewTableData({ ...newTableData, capacity_min: parseInt(e.target.value) || 1 })}
                        className="bg-black/60 border-white/10 h-11 font-mono"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Max Capacity</label>
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
                           <span className="text-[9px] text-zinc-500">X Position</span>
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
                           <span className="text-[9px] text-zinc-500">Y Position</span>
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
                     {isAddingTable ? 'Saving...' : 'Save Changes'}
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                     <Button
                        variant="ghost"
                        onClick={handleDeleteTable}
                        disabled={isAddingTable}
                        className="w-full text-red-500 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold uppercase tracking-widest"
                     >
                        Delete Table
                     </Button>
                     <Button
                        variant="ghost"
                        onClick={() => setIsEditModalOpen(false)}
                        disabled={isAddingTable}
                        className="w-full text-zinc-500 text-xs font-bold uppercase tracking-widest"
                     >
                        Cancel
                     </Button>
                  </div>
               </div>
            </div>
         </Dialog>
      </DashboardLayout>
   );
};

const StatPill = ({ label, value, icon: Icon, color }: any) => {
   const colors: any = { default: 'text-gray-400', green: 'text-green-500 bg-green-500/10', red: 'text-red-500 bg-red-500/10', yellow: 'text-yellow-500 bg-yellow-500/10', blue: 'text-blue-400 bg-blue-400/10' };
   return <div className={cn("px-5 py-4 rounded-[1.5rem] border border-white/5 flex flex-col gap-1 transition-all", colors[color || 'default'])}><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span><Icon className="w-3.5 h-3.5 opacity-60" /></div><span className="text-2xl font-black tracking-tighter">{value}</span></div>;
};

interface TableCardProps {
   table: any;
   currentTime: Date;
   onQuickOrder: (table: any) => void;
   isAnalyticsMode?: boolean;
   metric?: TableMetric;
}

const TableCard: React.FC<TableCardProps> = ({ table, currentTime, onQuickOrder, isAnalyticsMode, metric }) => {
   const isOccupied = table.status === 'occupied';
   const isDirty = table.status === 'needs_cleaning';
   const isAvailable = table.status === 'available';
   const elapsedMins = table.active_session ? Math.floor((currentTime.getTime() - new Date(table.active_session.seated_at).getTime()) / 60000) : 0;

   // 1. Analytics View Render
   if (isAnalyticsMode) {
      const score = metric?.score || 0;
      let scoreColor = "text-red-500";
      let grade = "F";

      if (score >= 90) { scoreColor = "text-green-500"; grade = "A"; }
      else if (score >= 80) { scoreColor = "text-green-400"; grade = "B"; }
      else if (score >= 65) { scoreColor = "text-primary"; grade = "C"; }
      else if (score >= 50) { scoreColor = "text-orange-400"; grade = "D"; }
      else { scoreColor = "text-red-500"; grade = "F"; }

      return (
         <SoshaCard className={cn(
            "p-0 flex flex-col h-64 transition-all duration-500 group relative overflow-hidden bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem]",
            "hover:border-primary/50 hover:shadow-[0_0_50px_rgba(255,193,7,0.15)] pulse-border"
         )}>
            {/* Glossy Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />

            <div className="p-6 flex flex-col h-full relative z-10">
               <div className="flex justify-between items-start mb-4">
                  <div>
                     <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-1 block">Station</span>
                     <h3 className="text-4xl font-black tracking-tighter text-white leading-none">{table.table_number}</h3>
                  </div>
                  <div className="relative flex items-center justify-center">
                     <svg className="w-16 h-16 transform -rotate-90">
                        <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                        <motion.circle
                           cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4"
                           strokeDasharray={176}
                           initial={{ strokeDashoffset: 176 }}
                           animate={{ strokeDashoffset: 176 - (176 * score) / 100 }}
                           transition={{ duration: 1.5, ease: "easeOut" }}
                           className={scoreColor}
                        />
                     </svg>
                     <div className="absolute flex flex-col items-center">
                        <span className={cn("text-2xl font-black tracking-tighter", scoreColor)}>{grade}</span>
                     </div>
                  </div>
               </div>

               <div className="mt-auto grid grid-cols-1 gap-2">
                  <div className="flex flex-col p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
                     <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500 mb-1">Rev / Hour</span>
                     <div className="flex items-end justify-between">
                        <span className="text-xl font-black tracking-tighter text-white">ETB {metric?.revenue_per_hour || 0}</span>
                        <Zap className="w-3.5 h-3.5 text-primary mb-1" />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                     <div className="flex flex-col p-2.5 rounded-xl bg-white/5 border border-white/5">
                        <span className="text-[8px] uppercase font-black tracking-widest text-zinc-500 mb-0.5">Turnover</span>
                        <span className="text-sm font-bold text-white">{metric?.avg_duration_minutes || 0}m</span>
                     </div>
                     <div className="flex flex-col p-2.5 rounded-xl bg-white/5 border border-white/5">
                        <span className="text-[8px] uppercase font-black tracking-widest text-zinc-500 mb-0.5">Sessions</span>
                        <span className="text-sm font-bold text-white">{metric?.total_sessions || 0}</span>
                     </div>
                  </div>
               </div>

               {/* Absolute Badges for Alerts */}
               <div className="absolute top-2 right-20 flex gap-1">
                  {metric?.is_camper && (
                     <div className="p-1.5 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/20 animate-bounce">
                        <AlertTriangle className="w-3 h-3" />
                     </div>
                  )}
                  {metric?.reopen_abuse && (
                     <div className="p-1.5 rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/20 animate-pulse">
                        <RefreshCw className="w-3 h-3" />
                     </div>
                  )}
               </div>
            </div>

            <style>{`
               .pulse-border:hover {
                  animation: border-pulse 2s infinite;
               }
               @keyframes border-pulse {
                  0% { border-color: rgba(255, 193, 7, 0.1); }
                  50% { border-color: rgba(255, 193, 7, 0.5); }
                  100% { border-color: rgba(255, 193, 7, 0.1); }
               }
            `}</style>
         </SoshaCard>
      );
   }

   // 2. Sleek & Small Live Logic
   return (
      <SoshaCard
         onClick={() => onQuickOrder(table)}
         className={cn(
            "p-0 flex flex-col h-40 transition-all duration-300 group relative overflow-hidden bg-black/40 backdrop-blur-2xl border border-white/5 rounded-[2rem] cursor-pointer",
            "hover:border-primary/40 hover:scale-[1.02]",
            isOccupied && "border-red-500/30",
            isDirty && "border-yellow-500/30",
            table.needs_cleanup && "border-purple-500/40"
         )}>

         <div className="p-4 h-full flex flex-col items-center justify-center relative z-10">
            <div className="flex flex-col items-center gap-1">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 opacity-50">Station</span>
               <h3 className={cn(
                  "text-4xl font-black tracking-tighter transition-all duration-500",
                  isOccupied ? "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]" :
                     isDirty ? "text-yellow-500" : "text-white/90"
               )}>
                  {table.table_number}
               </h3>
            </div>

            <div className="mt-3 flex flex-col items-center gap-2">
               <Badge className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-white/5",
                  table.needs_cleanup ? "bg-purple-500/20 text-purple-400 border-purple-500/20" :
                     isOccupied ? "bg-red-500/20 text-red-400 border-red-500/20" :
                        isDirty ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/20" :
                           "bg-green-500/20 text-green-400 border-green-500/20"
               )}>
                  {table.needs_cleanup ? 'Ready' : table.status.replace('_', ' ')}
               </Badge>

               {isOccupied && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/20 border border-white/5">
                     <Clock className="w-2.5 h-2.5 text-zinc-500" />
                     <span className="text-[10px] font-bold text-zinc-400">{elapsedMins}m</span>
                  </div>
               )}
            </div>
         </div>

         {/* Selection Glow */}
         {isOccupied && <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />}

         {/* Hover Overlay for Actions (Lightweight) */}
         <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <div className="bg-primary text-black p-2 rounded-full shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300">
               <Plus className="w-4 h-4" />
            </div>
         </div>
      </SoshaCard>
   );
};

export default TableStatus;
