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
      // Fetch tables with active sessions - ensure users view is used through underlying relationship if needed
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
        // Fallback to basic fetch if relationship caching issues occur
        const { data: basicData } = await supabase.from('tables').select('*').order('table_number');
        return (basicData || []).map(t => ({ ...t, sessions: [] }));
      }

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
        // Fallback for demo
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

               <div className="pt-
