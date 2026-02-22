
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import {
   Users, UserCheck, Clock, TrendingUp, Zap,
   Search, Filter, Activity, Award, ShieldAlert, CreditCard, Timer, Loader2,
   Wallet, Banknote, HandCoins, DollarSign, RefreshCw
} from 'lucide-react';
import { Badge, Button, Input, cn, showToast, Dialog, Card, CardHeader, CardTitle, CardContent } from '../components/ui';
import { supabase } from '../supabase';
import { Role, Order } from '../types';
import { useBranch } from '../contexts/BranchContext';
import { StaffOrderHistory } from '../components/StaffOrderHistory';
import { OrderDetailsModal } from '../components/OrderDetailsModal';

const StaffPerformance: React.FC = () => {
   const { activeBranchId } = useBranch();
   const [loading, setLoading] = useState(true);
   const [metrics, setMetrics] = useState<any[]>([]);
   const [activeShifts, setActiveShifts] = useState<any[]>([]);
   const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('today');
   const [activeTab, setActiveTab] = useState<'waiter' | 'kitchen' | 'manager'>('waiter');
   const [searchTerm, setSearchTerm] = useState('');
   const [selectedStaffHistory, setSelectedStaffHistory] = useState<{ id: string, name: string } | null>(null);
   const [staffOrders, setStaffOrders] = useState<Order[]>([]);
   const [historyLoading, setHistoryLoading] = useState(false);
   const [historyView, setHistoryView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
   const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

   useEffect(() => {
      fetchData();
      const interval = setInterval(fetchData, 60000);
      return () => clearInterval(interval);
   }, [timeRange]);

   const fetchData = async () => {
      setLoading(true);
      try {
         const end = new Date();
         const start = new Date();
         if (timeRange === '7d') start.setDate(start.getDate() - 7);
         else if (timeRange === '30d') start.setDate(start.getDate() - 30);
         else start.setHours(0, 0, 0, 0);

         // Fetch Stats via RPC
         const { data: stats, error: rpcError } = await supabase.rpc('get_staff_performance_metrics', {
            start_date: start.toISOString(),
            end_date: end.toISOString(),
            p_branch_id: activeBranchId
         });

         if (rpcError) throw rpcError;

         // Fetch Active Shifts
         let shiftQuery = supabase.from('staff_shifts').select('*').eq('status', 'active');
         if (activeBranchId) {
            shiftQuery = shiftQuery.eq('branch_id', activeBranchId);
         }
         const { data: shiftData } = await shiftQuery;

         setMetrics(stats || []);
         setActiveShifts(shiftData || []);
      } catch (err: any) {
         console.error("Fetch error:", err);
         showToast(err.message || "Failed to fetch intelligence data", "error");
      } finally {
         setLoading(false);
      }
   };

   const fetchStaffOrders = async (staffId: string) => {
      setHistoryLoading(true);
      try {
         const { data, error } = await supabase
            .from('orders')
            .select(`
               *,
               waiter:profiles!orders_waiter_id_fkey (id, full_name, role),
               order_items (
                  id,
                  quantity,
                  price,
                  menu_item:menu (name)
               )
            `)
            .eq('waiter_id', staffId)
            .order('created_at', { ascending: false });

         if (error) throw error;
         setStaffOrders(data as unknown as Order[] || []);
      } catch (err: any) {
         showToast("Failed to load history", "error");
      } finally {
         setHistoryLoading(false);
      }
   };

   const getRankedData = () => {
      let filtered = metrics.filter(m => m.role === activeTab);
      if (searchTerm) {
         filtered = filtered.filter(m => m.staff_name?.toLowerCase().includes(searchTerm.toLowerCase()));
      }
      return filtered.sort((a, b) => {
         if (activeTab === 'kitchen') return b.total_orders - a.total_orders;
         return b.total_sales - a.total_sales;
      });
   };

   const getSmartLabels = (m: any) => {
      const labels = [];
      const isTop = getRankedData().indexOf(m) === 0 && m.total_orders > 0;

      if (isTop) labels.push({ text: 'TOP PERFORMER', color: 'bg-yellow-500/20 text-yellow-500' });

      if (activeTab === 'waiter') {
         if (m.avg_order_value > 1000) labels.push({ text: 'HIGH EFFICIENCY', color: 'bg-emerald-500/20 text-emerald-500' });
      } else if (activeTab === 'kitchen') {
         if (m.total_orders > 50) labels.push({ text: 'MACHINE', color: 'bg-red-500/20 text-red-500' });
      }

      if (m.shifts_count === 0 && timeRange !== 'today') {
         labels.push({ text: 'INACTIVE', color: 'bg-zinc-800 text-gray-500' });
      }

      return labels;
   };

   const getRoleIcon = (role: Role) => {
      switch (role) {
         case 'owner': return <Award className="w-3 h-3 text-yellow-500" />;
         case 'manager': return <Zap className="w-3 h-3 text-purple-500" />;
         case 'waiter': return <UserCheck className="w-3 h-3 text-orange-500" />;
         case 'kitchen': return <Activity className="w-3 h-3 text-red-500" />;
         default: return <Users className="w-3 h-3" />;
      }
   };

   const rankedList = getRankedData();

   return (
      <DashboardLayout title="Intelligence" subtitle="Real-time personnel throughput and service quality audits">
         <div className="space-y-10 animate-in fade-in duration-500">

            {/* Top Stats Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div className="flex bg-primary/5 p-1.5 rounded-xl border border-primary/20 backdrop-blur-md">
                  {(['today', '7d', '30d'] as const).map(range => (
                     <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={cn(
                           "px-4 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest",
                           timeRange === range ? "bg-primary text-black shadow-lg" : "text-gray-500 hover:text-white"
                        )}
                     >
                        {range}
                     </button>
                  ))}
               </div>

               <div className="flex items-center gap-3">
                  <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                     <p className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {activeShifts.length} Live Personnel
                     </p>
                  </div>
               </div>
            </div>

            {/* Main Intelligence Board */}
            <Card className="bg-[#09090b] border-primary/20 overflow-hidden">
               <CardHeader className="border-b border-primary/20 pb-0 bg-primary/[0.02]">
                  <div className="flex items-center gap-8">
                     {(['waiter', 'kitchen', 'manager'] as const).map(role => (
                        <button
                           key={role}
                           onClick={() => setActiveTab(role)}
                           className={cn(
                              "pb-4 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all",
                              activeTab === role
                                 ? "border-primary text-primary"
                                 : "border-transparent text-gray-500 hover:text-white"
                           )}
                        >
                           {role}s
                        </button>
                     ))}
                  </div>
               </CardHeader>
               <CardContent className="p-0">
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-gray-500 uppercase bg-black/40 font-black tracking-[0.1em]">
                           <tr>
                              <th className="px-6 py-5">Rank & Staff</th>
                              <th className="px-6 py-5 text-right">Orders</th>
                              <th className="px-6 py-5 text-right">Sales Generated</th>
                              <th className="px-6 py-5 text-center">Efficiency</th>
                              <th className="px-6 py-5">Insight</th>
                              <th className="px-6 py-5 text-right">Action</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-primary/10">
                           {loading ? (
                              <tr>
                                 <td colSpan={6} className="px-6 py-20 text-center">
                                    <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
                                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-4">Syncing Intelligence...</p>
                                 </td>
                              </tr>
                           ) : rankedList.length === 0 ? (
                              <tr>
                                 <td colSpan={6} className="px-6 py-20 text-center text-gray-600 uppercase font-black tracking-widest text-xs">
                                    No data detected for this cycle
                                 </td>
                              </tr>
                           ) : rankedList.map((m, idx) => (
                              <tr key={m.staff_id} className="hover:bg-white/[0.02] transition-all group">
                                 <td className="px-6 py-5">
                                    <div className="flex items-center gap-4">
                                       <div className={cn(
                                          "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border",
                                          idx === 0 ? "bg-primary text-black border-primary" : "bg-black/40 text-gray-500 border-white/10"
                                       )}>
                                          {idx + 1}
                                       </div>
                                       <div>
                                          <p className="font-bold text-white text-sm tracking-tight">{m.staff_name}</p>
                                          <p className="text-[10px] text-gray-500 font-black uppercase mt-0.5">{m.shifts_count} Shifts • {Math.round(m.hours_worked)}h</p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-6 py-5 text-right font-mono font-bold text-white">
                                    {m.total_orders.toLocaleString()}
                                 </td>
                                 <td className="px-6 py-5 text-right font-mono font-bold text-primary">
                                    ETB {m.total_sales.toLocaleString()}
                                 </td>
                                 <td className="px-6 py-5">
                                    <div className="flex flex-col items-center">
                                       <p className="text-[10px] font-black text-white font-mono">ETB {Math.round(m.avg_order_value)}</p>
                                       <p className="text-[9px] text-gray-500 uppercase font-bold">AOV</p>
                                    </div>
                                 </td>
                                 <td className="px-6 py-5">
                                    <div className="flex flex-wrap gap-2">
                                       {getSmartLabels(m).map((label, i) => (
                                          <Badge key={i} className={cn("text-[9px] font-black border-transparent", label.color)}>
                                             {label.text}
                                          </Badge>
                                       ))}
                                    </div>
                                 </td>
                                 <td className="px-6 py-5 text-right">
                                    <Button
                                       variant="ghost"
                                       onClick={() => {
                                          setSelectedStaffHistory({ id: m.staff_id, name: m.staff_name });
                                          fetchStaffOrders(m.staff_id);
                                       }}
                                       className="h-9 px-4 bg-primary/5 border border-primary/10 text-primary hover:bg-primary hover:text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                                    >
                                       Transactions
                                    </Button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </CardContent>
            </Card>
         </div>

         {/* Personnel Master File (Details / History) */}
         <Dialog
            isOpen={!!selectedStaffHistory}
            onClose={() => setSelectedStaffHistory(null)}
            title={`Audit: ${selectedStaffHistory?.name}`}
            className="max-w-4xl"
         >
            <div className="space-y-6">
               <div className="flex bg-primary/5 p-1.5 rounded-xl border border-primary/10 backdrop-blur-md self-start w-fit">
                  {(['daily', 'weekly', 'monthly'] as const).map(v => (
                     <button
                        key={v}
                        onClick={() => setHistoryView(v)}
                        className={cn(
                           "px-4 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest",
                           historyView === v ? "bg-primary text-black shadow-lg" : "text-gray-500 hover:text-white"
                        )}
                     >
                        {v}
                     </button>
                  ))}
               </div>

               <div className="max-h-[65vh] overflow-y-auto px-4 -mx-4 custom-scrollbar space-y-2">
                  {historyLoading ? (
                     <div className="flex flex-col items-center justify-center py-20 opacity-30">
                        <RefreshCw className="w-10 h-10 animate-spin mb-4 text-primary" strokeWidth={3} />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Syncing Personnel History...</p>
                     </div>
                  ) : (
                     <StaffOrderHistory
                        orders={staffOrders}
                        view={historyView}
                        onOrderClick={(order) => setSelectedOrder(order)}
                     />
                  )}
               </div>

               <div className="pt-6 border-t border-primary/10">
                  <Button
                     onClick={() => setSelectedStaffHistory(null)}
                     className="w-full bg-white text-black font-black rounded-xl h-12 uppercase tracking-widest text-xs shadow-xl transition-transform active:scale-95"
                  >
                     Close Personnel Audit
                  </Button>
               </div>
            </div>
         </Dialog>

         <OrderDetailsModal
            isOpen={!!selectedOrder}
            onClose={() => setSelectedOrder(null)}
            order={selectedOrder}
         />
      </DashboardLayout>
   );
};

export default StaffPerformance;
