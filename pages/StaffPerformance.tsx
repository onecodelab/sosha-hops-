
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import {
   Users, UserCheck, Clock, TrendingUp, Zap,
   Search, Filter, Activity, Award, ShieldAlert, CreditCard, Timer, Loader2,
   Wallet, Banknote, HandCoins, DollarSign
} from 'lucide-react';
import { Badge, Button, Input, cn, showToast, Dialog, Card, CardHeader, CardTitle, CardContent } from '../components/ui';
import { supabase } from '../supabase';
import { Role } from '../types';
import { useBranch } from '../contexts/BranchContext';

const StaffPerformance: React.FC = () => {
   const { activeBranchId } = useBranch();
   const [loading, setLoading] = useState(true);
   const [metrics, setMetrics] = useState<any[]>([]);
   const [activeShifts, setActiveShifts] = useState<any[]>([]);
   const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('today');
   const [activeTab, setActiveTab] = useState<'waiter' | 'kitchen' | 'manager'>('waiter');
   const [searchTerm, setSearchTerm] = useState('');
   const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

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
               <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 backdrop-blur-md">
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
            <Card className="bg-[#09090b] border-white/10 overflow-hidden">
               <CardHeader className="border-b border-white/10 pb-0 bg-white/[0.02]">
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
                        <tbody className="divide-y divide-white/5">
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
                                       onClick={() => setSelectedStaffId(m.staff_id)}
                                       className="h-9 w-9 p-0 bg-white/5 border border-white/5 hover:bg-primary hover:text-black transition-all rounded-xl"
                                    >
                                       <Zap className="w-4 h-4" />
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

         {/* Personnel Master File (Details) */}
         <Dialog
            isOpen={!!selectedStaffId}
            onClose={() => setSelectedStaffId(null)}
            title="Personnel Master File"
         >
            {(() => {
               const staff = metrics.find(m => m.staff_id === selectedStaffId);
               if (!staff) return null;
               return (
                  <div className="space-y-6 p-2">
                     {/* 30D Stats Card */}
                     <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                           <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Total Orders</p>
                           <p className="text-xl font-black text-white font-mono mt-1">{staff.total_orders}</p>
                        </div>
                        <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                           <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Total Sales</p>
                           <p className="text-xl font-black text-primary font-mono mt-1">{Math.round(staff.total_sales / 1000)}k</p>
                        </div>
                        <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                           <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">AOV</p>
                           <p className="text-xl font-black text-white font-mono mt-1">{Math.round(staff.avg_order_value)}</p>
                        </div>
                     </div>

                     <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl flex gap-4">
                        <Award className="w-6 h-6 text-primary shrink-0" />
                        <div>
                           <h4 className="text-sm font-bold text-white uppercase tracking-wider">Efficiency Breakdown</h4>
                           <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-widest">
                              {staff.orders_per_shift} Orders per shift • ETB {staff.sales_per_hour} per hour
                           </p>
                        </div>
                     </div>

                     <div className="pt-6 border-t border-white/5">
                        <Button
                           onClick={() => setSelectedStaffId(null)}
                           className="w-full bg-primary text-black font-black rounded-xl h-12 uppercase tracking-widest text-xs shadow-xl shadow-primary/10 transition-transform active:scale-95"
                        >
                           Close Audit
                        </Button>
                     </div>
                  </div>
               );
            })()}
         </Dialog>
      </DashboardLayout>
   );
};

export default StaffPerformance;
