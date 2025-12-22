
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { SoshaCard } from '../components/SoshaCard';
import { Badge, Button, cn, showToast } from '../components/ui';
import { 
  Armchair, Clock, CheckCircle2, User, RefreshCw, 
  AlertTriangle, History, Eye, ClipboardList
} from 'lucide-react';
import { Table, Order } from '../types';
import { ActiveOrdersModal } from '../components/ActiveOrdersModal';

const TableStatus: React.FC = () => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: tables, isLoading, refetch } = useQuery({
    queryKey: ['live-tables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tables')
        .select(`
          *,
          orders:current_order_id(
            *,
            order_items(quantity, menu_item:menu(name)),
            waiter:users(full_name)
          )
        `)
        .order('table_number', { ascending: true });
      if (error) throw error;
      return data as Table[];
    }
  });

  useEffect(() => {
    const channel = supabase.channel('tables_live_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tables')
        .update({ status: newStatus, last_updated: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      showToast(`Table marked as ${newStatus.replace('_', ' ')}`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'occupied': return { 
        color: 'border-red-500/40 text-red-400 bg-red-500/5', 
        glow: 'red', 
        label: 'Occupied' 
      };
      case 'needs_cleaning': return { 
        color: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/5', 
        glow: 'yellow', 
        label: 'Needs Cleaning' 
      };
      case 'reserved': return { 
        color: 'border-blue-500/40 text-blue-400 bg-blue-500/5', 
        glow: 'blue', 
        label: 'Reserved' 
      };
      default: return { 
        color: 'border-green-500/20 text-green-500/60 bg-green-500/5', 
        glow: 'green', 
        label: 'Available' 
      };
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff/60)}h ago`;
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  return (
    <DashboardLayout 
      title="Floor Management" 
      subtitle="Real-time table status and turnaround monitoring"
      actions={
        <div className="flex items-center gap-3">
           <Button variant="outline" onClick={() => refetch()} size="sm" className="gap-2 border-white/10 bg-white/5">
              <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} /> Refresh Floor
           </Button>
        </div>
      }
    >
      <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* Legend */}
        <div className="flex flex-wrap gap-6 bg-card/50 border border-white/5 p-5 rounded-[2rem] backdrop-blur-xl shadow-2xl">
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" /> Available
           </div>
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> Occupied
           </div>
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" /> Dirty
           </div>
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" /> Reserved
           </div>
        </div>

        {/* Tables Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
           {tables?.map((table) => {
              const config = getStatusConfig(table.status);
              const tableOrder = table.orders as Order | undefined;

              return (
                <SoshaCard 
                  key={table.id} 
                  indicatorColor={config.glow as any}
                  className={cn("p-6 border-2 transition-all duration-500 flex flex-col h-[280px]", config.color)}
                >
                   <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-black/40 flex items-center justify-center border border-white/10 text-3xl font-black text-white shadow-2xl">
                        {table.table_number}
                      </div>
                      <Badge className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-1", config.color)}>
                        {config.label}
                      </Badge>
                   </div>

                   <div className="flex-1 space-y-3">
                      {table.status === 'occupied' && tableOrder ? (
                        <div className="space-y-2 animate-in fade-in zoom-in duration-500">
                           <div className="flex items-center gap-2 text-xs text-white font-bold">
                              <User className="w-3 h-3 text-primary" /> {tableOrder.waiter?.full_name || 'Staff'}
                           </div>
                           <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                              <ClipboardList className="w-3 h-3" /> #{tableOrder.order_number || tableOrder.id.slice(0,5)}
                           </div>
                           <div className="text-sm text-primary font-mono font-black">
                              ETB {tableOrder.total_amount?.toLocaleString() || '0'}
                           </div>
                        </div>
                      ) : table.status === 'needs_cleaning' ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-yellow-500/80 animate-pulse text-center">
                           <AlertTriangle className="w-6 h-6" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Cleaning</span>
                        </div>
                      ) : table.status === 'reserved' ? (
                         <div className="flex flex-col items-center justify-center h-full gap-2 text-blue-500/80 text-center">
                            <Clock className="w-6 h-6" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Reserved Table</span>
                         </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-20 text-center">
                           <Armchair className="w-8 h-8 mb-2" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Ready for Guests</span>
                        </div>
                      )}
                   </div>

                   <div className="pt-4 border-t border-white/5 flex items-center justify-between mt-auto">
                      <span className="text-[9px] text-gray-500 flex items-center gap-1 font-bold uppercase tracking-tighter">
                        <History className="w-3 h-3" /> {getTimeAgo(table.last_updated)}
                      </span>
                      
                      <div className="flex gap-2">
                        {table.status === 'occupied' && tableOrder && (
                           <button 
                             onClick={() => handleViewOrder(tableOrder)}
                             className="p-2 bg-red-500/20 text-red-500 rounded-xl hover:bg-red-500/40 transition-all active:scale-90"
                             title="View Order"
                           >
                              <Eye className="w-4 h-4" />
                           </button>
                        )}
                        {table.status === 'needs_cleaning' && (
                          <button 
                            onClick={() => handleUpdateStatus(table.id, 'available')}
                            className="p-2 bg-green-500/20 text-green-500 rounded-xl hover:bg-green-500/40 transition-all active:scale-90"
                            title="Mark as Cleaned"
                          >
                             <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {table.status === 'available' && (
                           <button 
                             onClick={() => handleUpdateStatus(table.id, 'reserved')}
                             className="p-2 bg-blue-500/20 text-blue-500 rounded-xl hover:bg-blue-500/40 transition-all active:scale-90"
                             title="Reserve Table"
                           >
                              <Clock className="w-4 h-4" />
                           </button>
                        )}
                        {table.status === 'reserved' && (
                           <button 
                             onClick={() => handleUpdateStatus(table.id, 'available')}
                             className="p-2 bg-gray-500/20 text-gray-500 rounded-xl hover:bg-gray-500/40 transition-all active:scale-90"
                             title="Release Reservation"
                           >
                              <History className="w-4 h-4" />
                           </button>
                        )}
                      </div>
                   </div>
                </SoshaCard>
              );
           })}
        </div>

        {isLoading && (
          <div className="h-64 flex flex-col items-center justify-center gap-4 text-primary">
             <RefreshCw className="w-10 h-10 animate-spin" />
             <span className="text-xs font-bold tracking-[0.2em] uppercase opacity-50">Mapping Floor...</span>
          </div>
        )}
      </div>

      <ActiveOrdersModal 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
        orders={selectedOrder ? [selectedOrder] : []} 
      />
    </DashboardLayout>
  );
};

export default TableStatus;
