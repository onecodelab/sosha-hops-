
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input, showToast, cn, Dialog } from '../components/ui';
import {
   Users, Award, Clock, Search, UserPlus,
   Timer, TrendingUp, Filter, RefreshCw,
   DollarSign, CheckCircle, Edit2, Zap, AlertTriangle
} from 'lucide-react';
import { supabase } from '../supabase';
import { InviteStaffModal } from '../components/InviteStaffModal';
import { UserProfile } from '../types';
import { useAuth } from '../AuthContext';

interface PerformanceMetric {
   staff_id: string;
   staff_name: string;
   role: string;
   total_orders: number;
   total_sales: number;
   shifts_count: number;
   hours_worked: number;
   avg_order_value: number;
   orders_per_shift: number;
   sales_per_hour: number;
}

const AdminStaffPerformance: React.FC = () => {
   const { profile: currentUserProfile } = useAuth();
   const [loading, setLoading] = useState(true);
   const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
   const [activeShifts, setActiveShifts] = useState<any[]>([]);
   const [isRefreshing, setIsRefreshing] = useState(false);
   const [isInviteOpen, setIsInviteOpen] = useState(false);

   // Filter States
   const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '90d'>('30d');
   const [activeTab, setActiveTab] = useState<'waiter' | 'kitchen' | 'manager'>('waiter');
   const [searchTerm, setSearchTerm] = useState('');

   // Edit State
   const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
   const [editForm, setEditForm] = useState({
      base_salary: '',
      pay_period: 'monthly' as any,
      is_salary_approved: false
   });

   useEffect(() => {
      fetchData();
   }, [timeRange]);

   const fetchData = async () => {
      setIsRefreshing(true);
      try {
         // 1. Calculate Date Range
         const end = new Date();
         const start = new Date();
         if (timeRange === 'today') start.setHours(0, 0, 0, 0);
         else if (timeRange === '7d') start.setDate(start.getDate() - 7);
         else if (timeRange === '30d') start.setDate(start.getDate() - 30);
         else start.setDate(start.getDate() - 90);

         // 2. Fetch Metrics via RPC
         const { data, error } = await supabase.rpc('get_staff_performance_metrics', {
            start_date: start.toISOString(),
            end_date: end.toISOString()
         });

         if (error) throw error;
         setMetrics(data || []);

         // 3. Fetch Active Shifts
         const { data: shiftData } = await supabase.from('staff_shifts').select('*').eq('status', 'active');
         if (shiftData) setActiveShifts(shiftData);

      } catch (err: any) {
         showToast(err.message || "Sync failed", "error");
      } finally {
         setLoading(false);
         setIsRefreshing(false);
      }
   };

   // --- Ranking Logic ---
   const getRankedData = () => {
      let filtered = metrics.filter(m => m.role === activeTab);

      // Search Filter
      if (searchTerm) {
         filtered = filtered.filter(m => m.staff_name.toLowerCase().includes(searchTerm.toLowerCase()));
      }

      // Ranking: Sort by Sales for Waiter/Manager, Orders for Kitchen
      return filtered.sort((a, b) => {
         if (activeTab === 'kitchen') return b.total_orders - a.total_orders;
         return b.total_sales - a.total_sales;
      });
   };

   // --- Smart Labels ---
   const getSmartLabels = (m: PerformanceMetric) => {
      const labels = [];

      if (activeTab === 'waiter') {
         if (m.total_sales > 50000) labels.push({ text: 'Top Earner', color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' });
         if (m.orders_per_shift > 15) labels.push({ text: 'High Efficiency', color: 'text-blue-400 border-blue-400/30 bg-blue-400/10' });
         if (m.total_orders > 50 && m.avg_order_value < 100) labels.push({ text: 'High Vol / Low Val', color: 'text-orange-400 border-orange-400/30 bg-orange-400/10' });
      }
      else if (activeTab === 'kitchen') {
         if (m.total_orders > 200) labels.push({ text: 'Machine', color: 'text-red-400 border-red-400/30 bg-red-400/10' });
         if (m.orders_per_shift > 50) labels.push({ text: 'Shift Leader', color: 'text-green-400 border-green-400/30 bg-green-400/10' });
      }

      // Universal
      if (m.shifts_count === 0) labels.push({ text: 'Inactive', color: 'text-zinc-500 border-zinc-500/30 bg-zinc-500/10' });

      return labels;
   };

   const handleOpenEdit = async (staffId: string) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', staffId).single();
      if (data) {
         handleEditState(data);
      }
   };

   const handleEditState = (s: UserProfile) => {
      setEditingStaff(s);
      setEditForm({
         base_salary: s.base_salary?.toString() || '',
         pay_period: s.pay_period || 'monthly',
         is_salary_approved: s.is_salary_approved || false
      });
   };

   const handleSaveEdit = async () => {
      if (!editingStaff) return;
      try {
         const { error } = await supabase
            .from('profiles')
            .update({
               base_salary: editForm.base_salary ? parseFloat(editForm.base_salary) : null,
               pay_period: editForm.pay_period,
               is_salary_approved: editForm.is_salary_approved
            })
            .eq('id', editingStaff.id);

         if (error) throw error;
         showToast("Compensation updated successfully", "success");
         setEditingStaff(null);
         fetchData();
      } catch (err: any) {
         showToast(err.message, "error");
      }
   };

   const isOwner = currentUserProfile?.role === 'owner';
   const rankedList = getRankedData();

   return (
      <DashboardLayout
         title="Staff Intelligence"
         subtitle="Performance metrics and roster management"
         actions={
            <div className="flex items-center gap-2">
               <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                  {(['today', '7d', '30d'] as const).map(range => (
                     <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={cn(
                           "px-3 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-wider",
                           timeRange === range ? "bg-primary text-black" : "text-gray-400 hover:text-white"
                        )}
                     >
                        {range === 'today' ? 'Today' : range === '7d' ? '7 Days' : '30 Days'}
                     </button>
                  ))}
               </div>
               <Button onClick={() => setIsInviteOpen(true)} className="bg-white text-black font-bold h-9">
                  <UserPlus className="w-4 h-4 mr-2" /> Add Staff
               </Button>
            </div>
         }
      >
         <div className="space-y-6 animate-in fade-in duration-500">

            {/* Active Shifts Ticker */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               {activeShifts.map(s => (
                  <div key={s.id} className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <div>
                           <p className="font-bold text-emerald-400 text-xs uppercase">{s.staff_name}</p>
                           <p className="text-[10px] text-emerald-500/60 font-mono">Clocked In: {new Date(s.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                     </div>
                     <Timer className="w-4 h-4 text-emerald-500/50" />
                  </div>
               ))}
               {activeShifts.length === 0 && (
                  <div className="col-span-full bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-center gap-2 text-gray-500 text-xs uppercase font-bold tracking-widest">
                     <Clock className="w-4 h-4" /> No Active Shifts
                  </div>
               )}
            </div>

            {/* Performance Board */}
            <Card className="bg-[#09090b] border-white/10">
               <CardHeader className="border-b border-white/10 pb-0">
                  <div className="flex items-center gap-6">
                     {(['waiter', 'kitchen', 'manager'] as const).map(role => (
                        <button
                           key={role}
                           onClick={() => setActiveTab(role)}
                           className={cn(
                              "pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all",
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
                        <thead className="text-xs text-gray-500 uppercase bg-black/40 font-black tracking-wider">
                           <tr>
                              <th className="px-6 py-4">Rank & Staff</th>
                              <th className="px-6 py-4 text-right">Orders</th>
                              <th className="px-6 py-4 text-right">Sales Generated</th>
                              <th className="px-6 py-4 text-center">Efficiency</th>
                              <th className="px-6 py-4">Insight</th>
                              <th className="px-6 py-4 text-right">Action</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                           {rankedList.length === 0 ? (
                              <tr>
                                 <td colSpan={6} className="px-6 py-12 text-center text-gray-500 uppercase font-bold tracking-widest text-xs">
                                    No Data for this period
                                 </td>
                              </tr>
                           ) : rankedList.map((m, idx) => (
                              <tr key={m.staff_id} className="hover:bg-white/[0.02] transition-colors group">
                                 <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                       <div className={cn(
                                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border",
                                          idx === 0 ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/50" :
                                             idx === 1 ? "bg-zinc-400/20 text-zinc-400 border-zinc-400/50" :
                                                idx === 2 ? "bg-amber-700/20 text-amber-700 border-amber-700/50" :
                                                   "bg-white/5 text-gray-500 border-white/10"
                                       )}>
                                          {idx + 1}
                                       </div>
                                       <div>
                                          <p className="font-bold text-white text-sm">{m.staff_name}</p>
                                          <p className="text-[10px] text-gray-500 font-mono">{m.shifts_count} Shifts • {m.hours_worked} Hrs</p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 text-right font-mono text-white">
                                    {m.total_orders.toLocaleString()}
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <div className="flex flex-col items-end">
                                       <span className="font-bold text-primary font-mono">ETB {m.total_sales.toLocaleString()}</span>
                                       {m.total_orders > 0 && <span className="text-[9px] text-gray-500">AOV: {Math.round(m.avg_order_value)}</span>}
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                       <Badge variant="outline" className="font-mono text-[10px] border-white/10 bg-white/5">
                                          {m.orders_per_shift} / shift
                                       </Badge>
                                       <span className="text-[9px] text-gray-600 font-medium">
                                          {activeTab === 'kitchen' ? 'Throughput' : 'Processed'}
                                       </span>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1.5">
                                       {getSmartLabels(m).map((label, i) => (
                                          <span key={i} className={cn("px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border", label.color)}>
                                             {label.text}
                                          </span>
                                       ))}
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <Button
                                       size="sm"
                                       variant="ghost"
                                       onClick={() => handleOpenEdit(m.staff_id)}
                                       className="h-8 w-8 p-0 hover:bg-white/10"
                                    >
                                       <Edit2 className="w-4 h-4 text-gray-400" />
                                    </Button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </CardContent>
            </Card>

            {/* Edit Compensation Modal */}
            <Dialog isOpen={!!editingStaff} onClose={() => setEditingStaff(null)} title={`Personnel Master File: ${editingStaff?.full_name}`}>
               <div className="space-y-6 pt-2">

                  {/* Performance Snapshot */}
                  {(() => {
                     const m = metrics.find(met => met.staff_id === editingStaff?.id);
                     if (!m) return null;
                     return (
                        <div className="grid grid-cols-3 gap-3">
                           <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
                              <p className="text-[10px] font-black text-gray-500 uppercase">30D Orders</p>
                              <p className="text-xl font-black text-white font-mono mt-1">{m.total_orders}</p>
                           </div>
                           <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
                              <p className="text-[10px] font-black text-gray-500 uppercase">30D Sales</p>
                              <p className="text-xl font-black text-primary font-mono mt-1">{Math.round(m.total_sales / 1000)}k</p>
                           </div>
                           <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
                              <p className="text-[10px] font-black text-gray-500 uppercase">AOV</p>
                              <p className="text-xl font-black text-white font-mono mt-1">{Math.round(m.avg_order_value)}</p>
                           </div>
                        </div>
                     );
                  })()}

                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex gap-3">
                     <DollarSign className="w-5 h-5 text-primary shrink-0" />
                     <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wider">Salary & Compensation</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Adjust base pay and authorization status. Changes are logged for audit.</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Base Salary (ETB)</label>
                        <Input
                           type="number"
                           value={editForm.base_salary}
                           onChange={e => setEditForm({ ...editForm, base_salary: e.target.value === '' ? '' : e.target.value } as any)}
                           placeholder="0.00"
                           className="bg-black/20"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Pay Period</label>
                        <select
                           value={editForm.pay_period}
                           onChange={e => setEditForm({ ...editForm, pay_period: e.target.value as any })}
                           className="w-full h-11 bg-black/20 border border-gray-700 rounded-lg px-3 text-sm text-white"
                        >
                           <option value="monthly">Monthly</option>
                           <option value="weekly">Weekly</option>
                           <option value="hourly">Hourly</option>
                        </select>
                     </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                     <div>
                        <p className="text-sm font-bold text-white">Salary Approval</p>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-0.5">Required for payroll issuance</p>
                     </div>
                     <button
                        disabled={!isOwner}
                        onClick={() => setEditForm({ ...editForm, is_salary_approved: !editForm.is_salary_approved })}
                        className={cn(
                           "w-12 h-6 rounded-full transition-all relative",
                           editForm.is_salary_approved ? "bg-emerald-600 shadow-[0_0_15px_rgba(5,150,105,0.4)]" : "bg-gray-700",
                           !isOwner && "opacity-50 cursor-not-allowed"
                        )}
                     >
                        <div className={cn("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", editForm.is_salary_approved ? "translate-x-6" : "translate-x-0")} />
                     </button>
                  </div>

                  <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                     <Button variant="ghost" onClick={() => setEditingStaff(null)} className="rounded-xl text-xs font-bold uppercase tracking-widest">Discard</Button>
                     <Button onClick={handleSaveEdit} className="bg-primary text-black font-black rounded-xl text-xs tracking-widest uppercase shadow-xl hover:scale-[1.02] active:scale-95 transition-all">Update Master Record</Button>
                  </div>
               </div>
            </Dialog>

            <InviteStaffModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} onSuccess={fetchData} />
         </div>
      </DashboardLayout>
   );
};

export default AdminStaffPerformance;
