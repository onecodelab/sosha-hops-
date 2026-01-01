
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

const TableStatus: React.FC = () => {
  const { profile } = useAuth();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [zoneFilter, setZoneFilter] = useState<TableZone | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderInitialTable, setOrderInitialTable] = useState('');
  const [orderAppendId, setOrderAppendId] = useState<string | null>(null);

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
    setOrderInitialTable(table.table_number.toString());
    setOrderAppendId(table.status === 'occupied' ? table.current_order_id : null);
    setIsOrderModalOpen(true);
  };

  return (
    <DashboardLayout title="Floor Status" subtitle="Real-time occupancy visualization">
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
           <StatPill label="Total" value={stats.total} icon={MapPin} />
           <StatPill label="Free" value={stats.available} icon={CheckCircle2} color="green" />
           <StatPill label="In Use" value={stats.occupied} icon={Users} color="red" />
           <StatPill label="Dirty" value={stats.dirty} icon={Sparkles} color="yellow" />
           <StatPill label="Load" value={`${stats.occupancy}%`} icon={TrendingUp} color="blue" />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 p-4 rounded-[2rem] border border-white/5">
           <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto w-full md:w-auto no-scrollbar">
              {['all', 'indoor', 'outdoor', 'vip', 'bar'].map(z => (
                <button key={z} onClick={() => setZoneFilter(z as any)} className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", zoneFilter === z ? "bg-primary text-black" : "text-gray-500 hover:text-white")}>{z}</button>
              ))}
           </div>
           <div className="flex gap-2">
             <Button variant="outline" onClick={() => refetch()} size="sm" className="border-white/10 bg-white/5"><RefreshCw className={cn("w-3.5 h-3.5 mr-2", isLoading && "animate-spin")} /> Refresh</Button>
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           {filteredTables?.map((table) => (
              <TableCard key={table.id} table={table} currentTime={currentTime} onQuickOrder={handleQuickOrder} />
           ))}
        </div>
      </div>

      <CreateOrderModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} initialTableNo={orderInitialTable} appendOrderId={orderAppendId} onOrderCreated={refetch} />
    </DashboardLayout>
  );
};

const StatPill = ({ label, value, icon: Icon, color }: any) => {
   const colors: any = { default: 'text-gray-400', green: 'text-green-500 bg-green-500/10', red: 'text-red-500 bg-red-500/10', yellow: 'text-yellow-500 bg-yellow-500/10', blue: 'text-blue-400 bg-blue-400/10' };
   return <div className={cn("px-5 py-4 rounded-[1.5rem] border border-white/5 flex flex-col gap-1 transition-all", colors[color || 'default'])}><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span><Icon className="w-3.5 h-3.5 opacity-60" /></div><span className="text-2xl font-black tracking-tighter">{value}</span></div>;
};

const TableCard: React.FC<{ table: any; currentTime: Date; onQuickOrder: (table: any) => void; }> = ({ table, currentTime, onQuickOrder }) => {
   const isOccupied = table.status === 'occupied';
   const isDirty = table.status === 'needs_cleaning';
   const isAvailable = table.status === 'available';
   const elapsedMins = table.active_session ? Math.floor((currentTime.getTime() - new Date(table.active_session.seated_at).getTime()) / 60000) : 0;
   
   return (
      <SoshaCard className={cn(
        "p-0 flex flex-col h-64 border-2 transition-all duration-500 group relative overflow-hidden",
        isAvailable && "border-green-500/20 bg-green-500/5",
        isOccupied && "border-red-600 bg-red-500/10 shadow-[0_0_40px_rgba(239,68,68,0.15)] animate-pulse",
        isDirty && "border-yellow-500/30 bg-yellow-500/10",
        table.needs_cleanup && "border-purple-600 bg-purple-500/10 shadow-[0_0_40px_rgba(147,51,234,0.2)] animate-none"
      )}>
         <div className="p-6 h-full flex flex-col items-center justify-center text-center">
            <h3 className={cn("text-6xl font-black tracking-tighter transition-colors", isOccupied ? "text-red-500" : isDirty ? "text-yellow-500" : "text-white")}>
                {table.table_number}
            </h3>
            
            <Badge className={cn("mt-4 text-[10px] font-black uppercase px-3 py-1 shadow-lg", 
                table.needs_cleanup ? "bg-purple-600 text-white" : 
                isOccupied ? "bg-red-600 text-white" :
                isDirty ? "bg-yellow-500 text-black" : "bg-green-600 text-white"
            )}>
              {table.needs_cleanup ? 'PAID - READY' : table.status.replace('_', ' ')}
            </Badge>

            {isOccupied && (
               <p className="mt-2 text-xs font-black text-white flex items-center gap-1">
                  <Clock className="w-3 h-3 text-red-500" /> {elapsedMins}m Stay
               </p>
            )}
         </div>
         
         <div className="absolute inset-0 bg-black/95 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 gap-3 z-20">
            {table.needs_cleanup ? (
               <div className="text-center space-y-2">
                  <Trash2 className="w-8 h-8 text-purple-400 mx-auto" />
                  <p className="text-[10px] font-black text-purple-400 uppercase leading-tight">Payment OK<br/>Reset at station</p>
               </div>
            ) : isOccupied ? (
               <Button size="sm" className="w-full h-12 rounded-xl bg-primary text-black font-black uppercase text-[10px] tracking-widest shadow-2xl" onClick={() => onQuickOrder(table)}>
                  <Plus className="w-4 h-4 mr-2" /> Add More Items
               </Button>
            ) : isAvailable ? (
               <Button size="sm" className="w-full h-12 rounded-xl bg-primary text-black font-black uppercase text-[10px] tracking-widest shadow-2xl" onClick={() => onQuickOrder(table)}>
                  <Plus className="w-4 h-4 mr-2" /> New Order
               </Button>
            ) : (
               <div className="text-center opacity-40">
                  <Lock className="w-8 h-8 mx-auto text-zinc-500" />
               </div>
            )}
         </div>
      </SoshaCard>
   );
};

export default TableStatus;
