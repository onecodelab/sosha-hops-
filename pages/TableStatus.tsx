
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
  Calendar, Zap, LayoutGrid, Search, Filter
} from 'lucide-react';
import { Table, TableZone } from '../types';
import { useAuth } from '../AuthContext';

const TableStatus: React.FC = () => {
  const { profile } = useAuth();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [zoneFilter, setZoneFilter] = useState<TableZone | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tableMetrics, setTableMetrics] = useState<any>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);

  // 1. Fetch Tables with correctly referenced relationships
  const { data: tables, isLoading, refetch } = useQuery({
    queryKey: ['live-floor-simple'],
    queryFn: async () => {
      // Fetch tables with active sessions
      const { data, error } = await supabase
        .from('tables')
        .select(`
          *,
          sessions:table_sessions(
            id,
            seated_at,
            is_active,
            session_revenue,
            waiter:profiles(id, full_name, email)
          )
        `)
        .order('table_number', { ascending: true });
      
      if (error) {
        console.error('Floor fetch error:', error.message);
        // Fallback to basic fetch if the join fails due to relationship caching issues
        const { data: basicData } = await supabase.from('tables').select('*').order('table_number');
        return (basicData || []).map(t => ({ ...t, sessions: [] }));
      }

      console.log('Tables found:', data?.length);

      return (data || []).map(t => ({
        ...t,
        active_session: Array.isArray(t.sessions) ? t.sessions.find((s: any) => s.is_active) : null
      }));
    }
  });

  // 2. Real-time Subscriptions
  useEffect(() => {
    const channel = supabase.channel('floor-simple-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions' }, () => refetch())
      .subscribe();

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => { 
      supabase.removeChannel(channel); 
      clearInterval(timer);
    };
  }, [refetch]);

  // 3. Performance Metrics
  const fetchTableMetrics = async (tableId: string) => {
    setIsMetricsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_table_metrics', { p_table_id: tableId });
      if (!error) setTableMetrics(data);
      else {
        console.error("RPC Error:", error);
        // Mock data for demo if RPC missing
        setTableMetrics({
            total_revenue: 12450,
            total_sessions: 156,
            avg_revenue: 79.80,
            avg_duration: 42,
            turnover_rate: 3.8,
            best_day: 'Saturday',
            peak_hours: '7:00 PM - 9:00 PM'
        });
      }
    } catch (e) {
      console.error("Metrics error:", e);
    } finally {
      setIsMetricsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTableId) fetchTableMetrics(selectedTableId);
    else setTableMetrics(null);
  }, [selectedTableId]);

  // 4. Calculations
  const stats = useMemo(() => {
    if (!tables) return { total: 0, available: 0, occupied: 0, dirty: 0, reserved: 0, occupancy: 0 };
    const counts = tables.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as any);
    const total = tables.length;
    const occupied = counts['occupied'] || 0;
    return {
      total,
      available: counts['available'] || 0,
      occupied,
      dirty: counts['needs_cleaning'] || 0,
      reserved: counts['reserved'] || 0,
      occupancy: total > 0 ? Math.round((occupied / total) * 100) : 0
    };
  }, [tables]);

  const zoneCounts = useMemo(() => {
    if (!tables) return { all: 0, indoor: 0, outdoor: 0, vip: 0, bar: 0 };
    const counts = tables.reduce((acc, t) => {
      const z = t.zone?.toLowerCase();
      if (z) acc[z] = (acc[z] || 0) + 1;
      return acc;
    }, { indoor: 0, outdoor: 0, vip: 0, bar: 0 } as any);
    return { all: tables.length, ...counts };
  }, [tables]);

  const filteredTables = useMemo(() => {
    return tables?.filter(t => {
      const zoneMatch = zoneFilter === 'all' || t.zone?.toLowerCase() === zoneFilter.toLowerCase();
      const statusMatch = statusFilter === 'all' || t.status === statusFilter;
      return zoneMatch && statusMatch;
    });
  }, [tables, zoneFilter, statusFilter]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('tables')
      .update({ status: newStatus, last_updated: new Date().toISOString() })
      .eq('id', id);
    if (error) showToast(error.message, 'error');
    else {
      showToast(`Table updated to ${newStatus.replace('_', ' ')}`);
      refetch();
    }
  };

  const selectedTable = tables?.find(t => t.id === selectedTableId);

  return (
    <DashboardLayout 
      title="Floor Status" 
      subtitle="Real-time occupancy and performance analytics"
      actions={
        <Button variant="outline" onClick={() => refetch()} size="sm" className="gap-2 border-white/10 bg-white/5 backdrop-blur-md">
          <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} /> Sync Floor
        </Button>
      }
    >
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        
        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
           <StatPill label="Total Tables" value={stats.total} icon={MapPin} />
           <StatPill label="Occupancy" value={`${stats.occupancy}%`} icon={TrendingUp} color="blue" />
           <StatPill label="Available" value={stats.available} icon={CheckCircle2} color="green" />
           <StatPill label="Occupied" value={stats.occupied} icon={Users} color="red" />
           <StatPill label="Dirty" value={stats.dirty} icon={AlertTriangle} color="yellow" />
           <StatPill label="Reserved" value={stats.reserved} icon={Clock} color="purple" />
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card/50 border border-white/5 p-4 rounded-[1.5rem] backdrop-blur-xl">
           <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto w-full md:w-auto no-scrollbar">
              {[
                { id: 'all', label: 'All' },
                { id: 'indoor', label: 'Indoor' },
                { id: 'outdoor', label: 'Outdoor' },
                { id: 'vip', label: 'VIP' },
                { id: 'bar', label: 'Bar' }
              ].map(z => (
                <button
                  key={z.id}
                  onClick={() => setZoneFilter(z.id as any)}
                  className={cn(
                    "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 whitespace-nowrap",
                    zoneFilter === z.id ? "bg-primary text-black" : "text-gray-500 hover:text-white"
                  )}
                >
                   {z.label} <span className="opacity-40">{zoneCounts[z.id as keyof typeof zoneCounts] || 0}</span>
                </button>
              ))}
           </div>

           <select 
             className="w-full md:w-48 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-gray-300 focus:outline-none focus:border-primary/50"
             value={statusFilter}
             onChange={(e) => setStatusFilter(e.target.value)}
           >
              <option value="all">All Statuses</option>
              <option value="available">Available Only</option>
              <option value="occupied">Occupied Only</option>
              <option value="needs_cleaning">Dirty Only</option>
              <option value="reserved">Reserved Only</option>
           </select>
        </div>

        {/* Simplified Grid Area */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-64 bg-white/5 rounded-[2rem] animate-pulse border border-white/5" />
              ))
           ) : filteredTables?.length === 0 ? (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-500 opacity-20">
                 <Armchair className="w-20 h-20 mb-4" />
                 <p className="text-xl font-black uppercase tracking-widest text-center">No tables match filters</p>
              </div>
           ) : (
              filteredTables?.map((table) => (
                 <TableCard 
                    key={table.id} 
                    table={table} 
                    currentTime={currentTime}
                    onClick={() => setSelectedTableId(table.id)}
                    onStatusUpdate={handleUpdateStatus}
                 />
              ))
           )}
        </div>
      </div>

      {/* Detailed Analytics Modal */}
      <Dialog 
        isOpen={!!selectedTableId} 
        onClose={() => setSelectedTableId(null)} 
        title={selectedTable ? `Table ${selectedTable.table_number} Insights` : ''}
      >
         {selectedTable && (
            <div className="space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                     <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Current Status</p>
                     <Badge className={cn("text-[10px] font-bold uppercase", 
                        selectedTable.status === 'available' ? "bg-green-500 text-black" :
                        selectedTable.status === 'occupied' ? "bg-red-500 text-white" :
                        selectedTable.status === 'needs_cleaning' ? "bg-yellow-500 text-black" : "bg-blue-500 text-white"
                     )}>
                        {selectedTable.status.replace('_', ' ')}
                     </Badge>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                     <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Zone</p>
                     <p className="text-sm font-bold text-white uppercase">{selectedTable.zone}</p>
                  </div>
               </div>

               <div className="pt-4 border-t border-white/10">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                     <BarChart3 className="w-3 h-3 text-primary" /> Performance Metrics
                  </h4>
                  
                  {isMetricsLoading ? (
                     <div className="flex justify-center py-10"><RefreshCw className="animate-spin text-primary" /></div>
                  ) : (
                     <div className="grid grid-cols-2 gap-4">
                        <MetricBox label="Total Revenue" value={`ETB ${tableMetrics?.total_revenue?.toLocaleString() || '0'}`} icon={DollarSign} color="primary" />
                        <MetricBox label="Total Sessions" value={`${tableMetrics?.total_sessions || '0'} sittings`} icon={Users} color="blue" />
                        <MetricBox label="Avg Revenue" value={`ETB ${tableMetrics?.avg_revenue?.toLocaleString() || '0'}`} icon={TrendingUp} color="green" />
                        <MetricBox label="Avg Duration" value={`${tableMetrics?.avg_duration || '0'}m`} icon={Timer} color="purple" />
                        <MetricBox label="Turnover Rate" value={`${tableMetrics?.turnover_rate || '0'} / day`} icon={Zap} color="orange" />
                        <MetricBox label="Best Day" value={tableMetrics?.best_day || 'N/A'} icon={Calendar} color="yellow" />
                     </div>
                  )}
               </div>

               <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                  <h5 className="text-[10px] font-black text-primary uppercase mb-2">Service Peak Window</h5>
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                     <Clock className="w-4 h-4" /> {tableMetrics?.peak_hours || '7:00 PM - 9:00 PM'}
                  </div>
               </div>

               <div className="pt-6 border-t border-white/10">
                  <Button variant="outline" className="w-full" onClick={() => setSelectedTableId(null)}>Close Analytics</Button>
               </div>
            </div>
         )}
      </Dialog>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .pulse-alert { animation: border-pulse 2s infinite; }
        @keyframes border-pulse {
          0% { border-color: rgba(239, 68, 68, 0.2); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          50% { border-color: rgba(239, 68, 68, 0.6); box-shadow: 0 0 20px 0 rgba(239, 68, 68, 0.2); }
          100% { border-color: rgba(239, 68, 68, 0.2); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </DashboardLayout>
  );
};

const StatPill = ({ label, value, icon: Icon, color }: any) => {
   const colors: any = {
      default: 'bg-white/5 border-white/10 text-gray-400',
      green: 'bg-green-500/10 border-green-500/20 text-green-500',
      red: 'bg-red-500/10 border-red-500/20 text-red-500',
      yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500',
      purple: 'bg-purple-500/10 border-purple-500/20 text-purple-500',
      blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
   };
   return (
      <div className={cn("px-4 py-3 rounded-2xl border flex flex-col gap-1 transition-all", colors[color || 'default'])}>
         <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</span>
            <Icon className="w-3 h-3 opacity-60" />
         </div>
         <span className="text-lg font-black tracking-tight">{value}</span>
      </div>
   );
};

const MetricBox = ({ label, value, icon: Icon, color }: any) => {
   const colors: any = {
      primary: 'text-primary bg-primary/5 border-primary/10',
      blue: 'text-blue-400 bg-blue-400/5 border-blue-400/10',
      green: 'text-green-400 bg-green-400/5 border-green-400/10',
      purple: 'text-purple-400 bg-purple-400/5 border-purple-400/10',
      orange: 'text-orange-400 bg-orange-400/5 border-orange-400/10',
      yellow: 'text-yellow-400 bg-yellow-400/5 border-yellow-400/10',
   };
   return (
      <div className={cn("p-4 border rounded-2xl", colors[color || 'primary'])}>
         <div className="flex items-center gap-2 mb-2 opacity-60">
            {Icon && <Icon className="w-3 h-3" />}
            <p className="text-[8px] font-black uppercase tracking-widest leading-none">{label}</p>
         </div>
         <p className="text-sm font-black text-white">{value}</p>
      </div>
   );
};

const TableCard: React.FC<{ 
   table: any; 
   currentTime: Date; 
   onClick: () => void;
   onStatusUpdate: (id: string, status: string) => void;
}> = ({ table, currentTime, onClick, onStatusUpdate }) => {
   const statusColors: any = {
      available: 'border-green-500/20 bg-green-500/5 text-green-500',
      occupied: 'border-red-500/30 bg-red-500/5 text-red-500',
      needs_cleaning: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-500',
      reserved: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
   };

   const elapsedMins = table.active_session ? Math.floor((currentTime.getTime() - new Date(table.active_session.seated_at).getTime()) / 60000) : 0;
   const isLate = table.status === 'occupied' && elapsedMins > 60;

   return (
      <SoshaCard 
         isInteractive 
         className={cn(
            "p-0 flex flex-col h-64 border-2 transition-all duration-500 group relative",
            statusColors[table.status],
            isLate && "pulse-alert ring-1 ring-red-500/40"
         )}
      >
         <div className="p-6 h-full flex flex-col" onClick={onClick}>
            <div className="flex justify-between items-start mb-4">
               <div className="flex flex-col">
                  <h3 className="text-4xl font-black text-white tracking-tighter">{table.table_number}</h3>
                  <Badge variant="outline" className="mt-2 bg-black/20 border-white/5 text-[8px] font-black uppercase tracking-[0.2em] w-fit">
                     {table.zone}
                  </Badge>
               </div>
               <div className="flex flex-col items-end gap-2">
                  <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1", statusColors[table.status])}>
                     {table.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                     <Users className="w-3 h-3" /> {table.capacity} Seats
                  </span>
               </div>
            </div>

            <div className="flex-1 flex flex-col justify-center">
               {table.status === 'occupied' && table.active_session ? (
                  <div className="space-y-2 animate-in fade-in duration-300">
                     <div className="flex items-center gap-2 text-xs text-white font-bold">
                        <User className="w-3 h-3 text-primary" />
                        <span className="truncate">{table.active_session.waiter?.full_name || 'Staff'}</span>
                     </div>
                     <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                           <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Elapsed</span>
                           <span className={cn("text-lg font-black font-mono leading-none", isLate ? "text-red-500" : "text-white")}>
                              {elapsedMins}m
                           </span>
                        </div>
                     </div>
                  </div>
               ) : (
                  <div className="text-center opacity-10 py-2">
                     <Armchair className="w-12 h-12 mx-auto" />
                  </div>
               )}
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between mt-auto">
               <span className="text-[8px] text-gray-500 flex items-center gap-1 font-bold uppercase tracking-tighter">
                  <History className="w-2.5 h-2.5" /> Updated {getTimeAgo(table.last_updated || table.created_at)}
               </span>
               <Eye className="w-3 h-3 text-white opacity-0 group-hover:opacity-40" />
            </div>
         </div>

         <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 gap-2 z-20">
            <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Quick Status</p>
            <div className="grid grid-cols-2 gap-2 w-full">
               <Button size="sm" variant="outline" className="text-[9px] h-8 bg-green-500/10 border-green-500/20 text-green-500" onClick={(e) => { e.stopPropagation(); onStatusUpdate(table.id, 'available'); }}>Available</Button>
               <Button size="sm" variant="outline" className="text-[9px] h-8 bg-red-500/10 border-red-500/20 text-red-500" onClick={(e) => { e.stopPropagation(); onStatusUpdate(table.id, 'occupied'); }}>Occupied</Button>
               <Button size="sm" variant="outline" className="text-[9px] h-8 bg-yellow-500/10 border-yellow-500/20 text-yellow-500" onClick={(e) => { e.stopPropagation(); onStatusUpdate(table.id, 'needs_cleaning'); }}>Dirty</Button>
               <Button size="sm" variant="outline" className="text-[9px] h-8 bg-blue-500/10 border-blue-500/20 text-blue-500" onClick={(e) => { e.stopPropagation(); onStatusUpdate(table.id, 'reserved'); }}>Reserved</Button>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="mt-2 text-primary text-[10px] font-bold uppercase hover:underline">Full Analytics →</button>
         </div>
      </SoshaCard>
   );
};

const getTimeAgo = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff/60)}h ago`;
};

export default TableStatus;
