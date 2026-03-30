
import React, { useState, useEffect } from 'react';
import { useLayoutConfig } from '../contexts/LayoutContext';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input, showToast, cn, Dialog } from '../components/ui';
import {
   Users, Award, Clock, Search, UserPlus,
   Timer, TrendingUp, Filter, RefreshCw,
   DollarSign, CheckCircle, Edit2, Zap, AlertTriangle, Trash2, MapPin
} from 'lucide-react';
import { supabase } from '../supabase';
import { InviteStaffModal } from '../components/InviteStaffModal';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { useLanguage } from '../contexts/LanguageContext';
import { StaffOrderHistory } from '../components/StaffOrderHistory';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { Order, UserProfile } from '../types';

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
   const { branches, activeBranchId } = useBranch();
   const { t } = useLanguage();
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
      is_salary_approved: false,
      home_branch_id: ''
   });

   // Delete Confirmation State
   const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
   const [isDeleting, setIsDeleting] = useState(false);

   // Detailed View State
   const [selectedStaffHistory, setSelectedStaffHistory] = useState<{ id: string, name: string } | null>(null);
   const [staffOrders, setStaffOrders] = useState<Order[]>([]);
   const [historyLoading, setHistoryLoading] = useState(false);
   const [historyView, setHistoryView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
   const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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
            end_date: end.toISOString(),
            p_branch_id: activeBranchId
         });

         if (error) throw error;
         setMetrics(data || []);

         // 3. Fetch Active Shifts
         let shiftQuery = supabase.from('staff_shifts').select('*').eq('status', 'active');
         if (activeBranchId) {
            shiftQuery = shiftQuery.eq('branch_id', activeBranchId);
         }
         const { data: shiftData } = await shiftQuery;
         if (shiftData) setActiveShifts(shiftData);

      } catch (err: any) {
         showToast(err.message || "Sync failed", "error");
      } finally {
         setLoading(false);
         setIsRefreshing(false);
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
                  menu_item:menu!menu_item_id (name)
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
         if (m.total_sales > 50000) labels.push({ text: t('staffPerformance.labels.topEarner'), color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' });
         if (m.orders_per_shift > 15) labels.push({ text: t('staffPerformance.labels.highEfficiency'), color: 'text-blue-400 border-blue-400/30 bg-blue-400/10' });
         if (m.total_orders > 50 && m.avg_order_value < 100) labels.push({ text: t('staffPerformance.labels.highVolLowVal'), color: 'text-orange-400 border-orange-400/30 bg-orange-400/10' });
      }
      else if (activeTab === 'kitchen') {
         if (m.total_orders > 200) labels.push({ text: t('staffPerformance.labels.machine'), color: 'text-red-400 border-red-400/30 bg-red-400/10' });
         if (m.orders_per_shift > 50) labels.push({ text: t('staffPerformance.labels.shiftLeader'), color: 'text-green-400 border-green-400/30 bg-green-400/10' });
      }

      // Universal
      if (m.shifts_count === 0) labels.push({ text: t('staffPerformance.labels.inactive'), color: 'text-zinc-500 border-zinc-500/30 bg-zinc-500/10' });

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
         is_salary_approved: s.is_salary_approved || false,
         home_branch_id: s.home_branch_id || ''
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
               is_salary_approved: editForm.is_salary_approved,
               home_branch_id: editForm.home_branch_id || null
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

   const handleDeleteStaff = async () => {
      if (!staffToDelete) return;
      setIsDeleting(true);
      try {
         const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', staffToDelete);

         if (error) throw error;
         showToast("Staff profile deleted successfully", "success");
         setStaffToDelete(null);
         fetchData();
      } catch (err: any) {
         showToast(err.message, "error");
      } finally {
         setIsDeleting(false);
      }
   };

   const isOwner = currentUserProfile?.role === 'owner';
   const rankedList = getRankedData();

   useLayoutConfig({
      title: t('staffPerformance.title'),
      subtitle: t('staffPerformance.subtitle'),
      actions: (
         <div className="flex items-center gap-2">
            <div className="flex bg-primary/5 p-1 rounded-lg border border-primary/20">
               {(['today', '7d', '30d'] as const).map(range => (
                  <button
                     key={range}
                     onClick={() => setTimeRange(range)}
                     className={cn(
                        "px-3 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-wider",
                        timeRange === range ? "bg-primary text-black" : "text-gray-400 hover:text-white"
                     )}
                  >
                     {range === 'today' ? t('staffPerformance.today') : range === '7d' ? t('staffPerformance.days7') : t('staffPerformance.days30')}
                  </button>
               ))}
            </div>
            <Button onClick={() => setIsInviteOpen(true)} className="bg-white text-black font-bold h-9">
               <UserPlus className="w-4 h-4 mr-2" /> {t('staffPerformance.addStaff')}
            </Button>
         </div>
      )
   });

   return (
      <>
         <div className="space-y-6 animate-in fade-in duration-500">

            {/* Active Shifts Ticker */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               {activeShifts.map(s => (
                  <div key={s.id} className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <div>
                           <p className="font-bold text-emerald-400 text-xs uppercase">{s.staff_name}</p>
                           <p className="text-[10px] text-emerald-500/60 font-mono">{t('staffPerformance.clockedIn')}: {new Date(s.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                     </div>
                     <Timer className="w-4 h-4 text-emerald-500/50" />
                  </div>
               ))}
               {activeShifts.length === 0 && (
                  <div className="col-span-full bg-primary/5 border border-primary/20 p-3 rounded-xl flex items-center justify-center gap-2 text-gray-500 text-xs uppercase font-bold tracking-widest">
                     <Clock className="w-4 h-4" /> {t('staffPerformance.noActiveShifts')}
                  </div>
               )}
            </div>

            {/* Performance Board */}
            <Card className="bg-[#09090b] border-primary/20">
               <CardHeader className="border-b border-primary/20 pb-0">
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
                        <thead className="text-[10px] md:text-xs text-gray-500 uppercase bg-black/40 font-black tracking-wider">
                           <tr>
                              <th className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">{t('staffPerformance.rankAndStaff')}</th>
                              <th className="px-3 md:px-6 py-3 md:py-4 text-right whitespace-nowrap">{t('staffPerformance.orders')}</th>
                              <th className="px-3 md:px-6 py-3 md:py-4 text-right whitespace-nowrap">{t('staffPerformance.salesGenerated')}</th>
                              <th className="px-3 md:px-6 py-3 md:py-4 text-center whitespace-nowrap">{t('staffPerformance.efficiency')}</th>
                              <th className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">{t('staffPerformance.insight')}</th>
                              <th className="px-3 md:px-6 py-3 md:py-4 text-right whitespace-nowrap">{t('staffPerformance.action')}</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-primary/10">
                           {rankedList.length === 0 ? (
                              <tr>
                                 <td colSpan={6} className="px-6 py-12 text-center text-gray-500 uppercase font-bold tracking-widest text-xs">
                                    {t('staffPerformance.noData')}
                                 </td>
                              </tr>
                           ) : rankedList.map((m, idx) => (
                              <tr key={m.staff_id} className="hover:bg-white/[0.02] transition-colors group">
                                 <td className="px-3 md:px-6 py-3 md:py-4">
                                    <div className="flex items-center gap-2 md:gap-3">
                                       <div className={cn(
                                          "w-5 h-5 md:w-6 md:h-6 shrink-0 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-black border",
                                          idx === 0 ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/50" :
                                             idx === 1 ? "bg-zinc-400/20 text-zinc-400 border-zinc-400/50" :
                                                idx === 2 ? "bg-amber-700/20 text-amber-700 border-amber-700/50" :
                                                   "bg-white/5 text-gray-500 border-white/10"
                                       )}>
                                          {idx + 1}
                                       </div>
                                       <div className="flex flex-col min-w-[5rem]">
                                          <p className="font-bold text-white text-xs md:text-sm whitespace-nowrap">{m.staff_name}</p>
                                          <p className="text-[9px] md:text-[10px] text-gray-500 font-mono whitespace-nowrap">{m.shifts_count} {t('staffPerformance.shifts')} • {m.hours_worked} {t('staffPerformance.hours')}</p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-3 md:px-6 py-3 md:py-4 text-right font-mono text-white text-xs md:text-sm">
                                    {m.total_orders.toLocaleString()}
                                 </td>
                                 <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                                    <div className="flex flex-col items-end">
                                       <span className="font-bold text-primary text-xs md:text-sm font-mono whitespace-nowrap">{t('adminDashboard.etb')} {m.total_sales.toLocaleString()}</span>
                                       {m.total_orders > 0 && <span className="text-[8px] md:text-[9px] text-gray-500 whitespace-nowrap">{t('staffPerformance.snapshot.aov')}: {Math.round(m.avg_order_value)}</span>}
                                    </div>
                                 </td>
                                 <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                       <Badge variant="outline" className="font-mono text-[9px] md:text-[10px] border-white/10 bg-white/5 whitespace-nowrap py-0 h-4 md:h-5">
                                          {m.orders_per_shift} / shift
                                       </Badge>
                                       <span className="text-[8px] md:text-[9px] text-gray-600 font-medium whitespace-nowrap">
                                          {activeTab === 'kitchen' ? 'Throughput' : 'Processed'}
                                       </span>
                                    </div>
                                 </td>
                                 <td className="px-3 md:px-6 py-3 md:py-4">
                                    <div className="flex flex-wrap gap-1 md:gap-1.5 min-w-[7rem]">
                                       {getSmartLabels(m).map((label, i) => (
                                          <span key={i} className={cn("px-1 md:px-1.5 py-0 md:py-0.5 h-4 md:h-auto flex items-center rounded text-[8px] md:text-[9px] font-black uppercase tracking-wider border whitespace-nowrap", label.color)}>
                                             {label.text}
                                          </span>
                                       ))}
                                    </div>
                                 </td>
                                 <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                                    <div className="flex items-center justify-end gap-1 md:gap-2">
                                       <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                             setSelectedStaffHistory({ id: m.staff_id, name: m.staff_name });
                                             fetchStaffOrders(m.staff_id);
                                          }}
                                          className="h-7 md:h-9 px-2 md:px-3 bg-primary/5 border border-primary/10 text-primary hover:bg-primary hover:text-black font-black text-[9px] md:text-[10px] uppercase tracking-widest rounded-lg md:rounded-xl transition-all whitespace-nowrap"
                                       >
                                          {t('staffPerformance.viewHistory')}
                                       </Button>
                                       <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleOpenEdit(m.staff_id)}
                                          className="h-7 w-7 md:h-9 md:w-9 p-0 hover:bg-white/10 rounded-lg md:rounded-xl shrink-0"
                                       >
                                          <Edit2 className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
                                       </Button>
                                       <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setStaffToDelete(m.staff_id)}
                                          className="h-7 w-7 md:h-9 md:w-9 p-0 hover:bg-red-500/10 hover:text-red-500 rounded-lg md:rounded-xl shrink-0"
                                       >
                                          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                                       </Button>
                                    </div>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </CardContent>
            </Card>

            {/* Edit Compensation Modal */}
            <Dialog isOpen={!!editingStaff} onClose={() => setEditingStaff(null)} title={`${t('staffPerformance.personnelFile')}: ${editingStaff?.full_name}`}>
               <div className="space-y-6 pt-2">

                  {/* Performance Snapshot */}
                  {(() => {
                     const m = metrics.find(met => met.staff_id === editingStaff?.id);
                     if (!m) return null;
                     return (
                        <div className="grid grid-cols-3 gap-3">
                           <div className="bg-primary/5 border border-primary/10 p-3 rounded-2xl">
                              <p className="text-[10px] font-black text-gray-500 uppercase">{t('staffPerformance.snapshot.orders30d')}</p>
                              <p className="text-xl font-black text-white font-mono mt-1">{m.total_orders}</p>
                           </div>
                           <div className="bg-primary/5 border border-primary/10 p-3 rounded-2xl">
                              <p className="text-[10px] font-black text-gray-500 uppercase">{t('staffPerformance.snapshot.sales30d')}</p>
                              <p className="text-xl font-black text-primary font-mono mt-1">{Math.round(m.total_sales / 1000)}k</p>
                           </div>
                           <div className="bg-primary/5 border border-primary/10 p-3 rounded-2xl">
                              <p className="text-[10px] font-black text-gray-500 uppercase">{t('staffPerformance.snapshot.aov')}</p>
                              <p className="text-xl font-black text-white font-mono mt-1">{Math.round(m.avg_order_value)}</p>
                           </div>
                        </div>
                     );
                  })()}

                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex gap-3">
                     <DollarSign className="w-5 h-5 text-primary shrink-0" />
                     <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wider">{t('staffPerformance.compensation')}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{t('staffPerformance.compensationSubtitle')}</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t('staffPerformance.homeBranch')}</label>
                        <div className="relative">
                           <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-500 pointer-events-none" />
                           <select
                              value={editForm.home_branch_id}
                              onChange={e => setEditForm({ ...editForm, home_branch_id: e.target.value })}
                              className="w-full h-11 bg-black/20 border border-gray-700 rounded-lg px-9 text-sm text-white focus:outline-none appearance-none"
                           >
                              <option value="">Select Branch</option>
                              {branches.map(b => (
                                 <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                           </select>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t('staffPerformance.baseSalary')} ({t('adminDashboard.etb')})</label>
                        <Input
                           type="number"
                           value={editForm.base_salary}
                           onChange={e => setEditForm({ ...editForm, base_salary: e.target.value === '' ? '' : e.target.value } as any)}
                           placeholder="0.00"
                           className="bg-black/20"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t('staffPerformance.payPeriod')}</label>
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

                  <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-primary/10">
                     <div>
                        <p className="text-sm font-bold text-white">{t('staffPerformance.salaryApproval')}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-0.5">{t('staffPerformance.payrollIssuance')}</p>
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

                  <div className="flex gap-3 justify-end pt-4 border-t border-primary/10">
                     <Button variant="ghost" onClick={() => setEditingStaff(null)} className="rounded-xl text-xs font-bold uppercase tracking-widest">{t('staffPerformance.discard')}</Button>
                     <Button onClick={handleSaveEdit} className="bg-primary text-black font-black rounded-xl text-xs tracking-widest uppercase shadow-xl hover:scale-[1.02] active:scale-95 transition-all">{t('staffPerformance.updateRecord')}</Button>
                  </div>
               </div>
            </Dialog>

            {/* Staff Order History Dialog */}
            <Dialog
               isOpen={!!selectedStaffHistory}
               onClose={() => setSelectedStaffHistory(null)}
               title={`${t('staffPerformance.orderHistoryTitle')}: ${selectedStaffHistory?.name}`}
               className="max-w-4xl"
            >
               <div className="space-y-6">
                  {/* View Filters */}
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
                           {t(`staffPerformance.periods.${v}`)}
                        </button>
                     ))}
                  </div>

                  <div className="max-h-[65vh] overflow-y-auto px-4 -mx-4 custom-scrollbar space-y-2">
                     {historyLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30">
                           <RefreshCw className="w-10 h-10 animate-spin mb-4" />
                           <p className="text-[10px] font-black uppercase tracking-[0.3em]">{t('staffPerformance.syncingHistory')}</p>
                        </div>
                     ) : (
                        <StaffOrderHistory
                           orders={staffOrders}
                           view={historyView}
                           onOrderClick={(order) => setSelectedOrder(order)}
                        />
                     )}
                  </div>
               </div>
            </Dialog>

            <OrderDetailsModal
               isOpen={!!selectedOrder}
               onClose={() => setSelectedOrder(null)}
               order={selectedOrder}
            />

            <InviteStaffModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} onSuccess={fetchData} />

            {/* Delete Confirmation Dialog */}
            <Dialog isOpen={!!staffToDelete} onClose={() => !isDeleting && setStaffToDelete(null)} title={t('staffPerformance.confirmDeletion')}>
               <div className="space-y-6 pt-2">
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 text-red-500">
                     <AlertTriangle className="w-5 h-5 shrink-0" />
                     <div>
                        <p className="text-xs font-bold uppercase tracking-wider">{t('staffPerformance.permanentAction')}</p>
                        <p className="text-[10px] opacity-80 mt-0.5">{t('staffPerformance.deletionWarning')}</p>
                     </div>
                  </div>

                  <p className="text-sm text-gray-300 px-1">
                     {t('staffPerformance.deleteConfirmationPrompt')} <span className="text-white font-bold">{metrics.find(m => m.staff_id === staffToDelete)?.staff_name}</span>?
                  </p>

                  <div className="flex gap-3 justify-end pt-4">
                     <Button variant="ghost" onClick={() => setStaffToDelete(null)} disabled={isDeleting} className="rounded-xl text-xs font-bold uppercase tracking-widest text-gray-500">{t('common.cancel')}</Button>
                     <Button onClick={handleDeleteStaff} isLoading={isDeleting} className="bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs tracking-widest uppercase shadow-xl transition-all">{t('staffPerformance.deleteProfile')}</Button>
                  </div>
               </div>
            </Dialog>
         </div>
      </>
   );
};

export default AdminStaffPerformance;
