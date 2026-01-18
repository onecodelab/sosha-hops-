
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input, showToast, cn, Dialog } from '../components/ui';
import {
   Users, Award, Clock, Search, UserPlus, Phone,
   MoreVertical, ShieldCheck, Timer, TrendingUp, Filter, RefreshCw,
   DollarSign, Banknote, CheckCircle, XCircle, Edit2
} from 'lucide-react';
import { supabase } from '../supabase';
import { InviteStaffModal } from '../components/InviteStaffModal';
import { UserProfile } from '../types';
import { useAuth } from '../AuthContext';

const AdminStaffPerformance: React.FC = () => {
   const { profile: currentUserProfile } = useAuth();
   const [loading, setLoading] = useState(true);
   const [staff, setStaff] = useState<UserProfile[]>([]);
   const [activeShifts, setActiveShifts] = useState<any[]>([]);
   const [leaderboard, setLeaderboard] = useState<any[]>([]);
   const [searchTerm, setSearchTerm] = useState('');
   const [isRefreshing, setIsRefreshing] = useState(false);
   const [isInviteOpen, setIsInviteOpen] = useState(false);

   // Edit State
   const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
   const [editForm, setEditForm] = useState({
      base_salary: '',
      pay_period: 'monthly' as any,
      is_salary_approved: false
   });

   useEffect(() => {
      fetchData();
   }, []);

   const fetchData = async () => {
      setIsRefreshing(true);
      try {
         const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('*')
            .order('is_online', { ascending: false });

         if (userError) throw userError;
         setStaff(userData as UserProfile[]);

         const { data: shiftData } = await supabase.from('staff_shifts').select('*').eq('status', 'active');
         if (shiftData) setActiveShifts(shiftData);

         const thirtyDaysAgo = new Date();
         thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
         const { data: orderData } = await supabase.from('orders').select('waiter_id, total_amount').gte('created_at', thirtyDaysAgo.toISOString()).in('status', ['closed', 'paid', 'served']);

         if (orderData) {
            const salesMap = new Map();
            orderData.forEach((o) => {
               if (!o.waiter_id) return;
               const staffMember = userData?.find(u => u.id === o.waiter_id);
               const current = salesMap.get(o.waiter_id) || { name: staffMember?.full_name || 'Staff', orders: 0, sales: 0 };
               salesMap.set(o.waiter_id, { ...current, orders: current.orders + 1, sales: current.sales + (o.total_amount || 0) });
            });
            setLeaderboard(Array.from(salesMap.entries()).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.sales - a.sales).slice(0, 10));
         }
      } catch (err: any) {
         showToast(err.message || "Sync failed", "error");
      } finally {
         setLoading(false);
         setIsRefreshing(false);
      }
   };

   const handleOpenEdit = (s: UserProfile) => {
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

   const filteredRoster = staff.filter(s =>
      s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase())
   );

   const isOwner = currentUserProfile?.role === 'owner';

   return (
      <DashboardLayout
         title="Staff Performance"
         subtitle="Operational efficiency and roster management"
         actions={
            <div className="flex gap-2">
               <Button variant="outline" onClick={fetchData} disabled={isRefreshing} size="icon">
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
               </Button>
               <Button onClick={() => setIsInviteOpen(true)} className="bg-primary text-black font-bold">
                  <UserPlus className="w-4 h-4 mr-2" /> Add Staff
               </Button>
            </div>
         }
      >
         <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <Card className="lg:col-span-1 bg-[#09090b] border-border">
                  <CardHeader className="border-b border-border pb-4">
                     <CardTitle className="text-lg flex items-center gap-2">
                        <Timer className="w-5 h-5 text-green-500" /> Active Shifts
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-y-auto max-h-[300px]">
                     {activeShifts.length === 0 ? <div className="p-8 text-center text-muted italic">No active shifts</div> :
                        activeShifts.map(s => <div key={s.id} className="p-4 border-b border-border text-sm text-gray-300">{s.staff_name} active since {new Date(s.clock_in_time).toLocaleTimeString()}</div>)
                     }
                  </CardContent>
               </Card>

               <Card className="lg:col-span-2 bg-[#09090b] border-border">
                  <CardHeader className="border-b border-border pb-4 flex flex-row items-center justify-between">
                     <CardTitle className="text-lg flex items-center gap-2">
                        <Award className="w-5 h-5 text-primary" /> Top Performers (30 Days)
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                     <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                           <thead className="text-xs text-muted uppercase bg-black/20 font-black">
                              <tr><th className="px-6 py-4">Staff Member</th><th className="px-6 py-4 text-center">Orders</th><th className="px-6 py-4 text-right">Sales</th></tr>
                           </thead>
                           <tbody>
                              {leaderboard.map((item, idx) => (
                                 <tr key={item.id} className="hover:bg-white/5 border-b border-border last:border-0 transition-colors">
                                    <td className="px-6 py-4 font-bold text-white">{item.name}</td>
                                    <td className="px-6 py-4 text-center">{item.orders}</td>
                                    <td className="px-6 py-4 text-right text-primary font-bold">ETB {item.sales.toLocaleString()}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </CardContent>
               </Card>
            </div>

            <Card className="bg-[#09090b] border-border">
               <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4">
                  <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5 text-blue-400" /> Staff Roster</CardTitle>
                  <Input placeholder="Search name..." className="w-full md:w-64 bg-black/40 border-border" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
               </CardHeader>
               <CardContent className="p-0">
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted uppercase bg-black/20 font-black">
                           <tr>
                              <th className="px-6 py-4">Staff Member</th>
                              <th className="px-6 py-4">Role</th>
                              <th className="px-6 py-4">Compensation</th>
                              <th className="px-6 py-4">Approval</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                           {filteredRoster.map(s => (
                              <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                                 <td className="px-6 py-4">
                                    <p className="font-bold text-white">{s.full_name}</p>
                                    <p className="text-[10px] text-muted">{s.email}</p>
                                 </td>
                                 <td className="px-6 py-4 capitalize text-gray-400 font-bold">{s.role}</td>
                                 <td className="px-6 py-4">
                                    <p className="font-mono text-white text-xs">{s.base_salary ? `ETB ${s.base_salary.toLocaleString()} / ${s.pay_period}` : '-'}</p>
                                 </td>
                                 <td className="px-6 py-4">
                                    {s.base_salary ? (
                                       s.is_salary_approved ? (
                                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Approved</Badge>
                                       ) : (
                                          <Badge variant="warning" className="animate-pulse">Pending</Badge>
                                       )
                                    ) : <span className="text-gray-600 italic">Not set</span>}
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(s)} className="text-primary hover:bg-primary/10">
                                       <Edit2 className="w-4 h-4 mr-1" /> Edit
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
            <Dialog isOpen={!!editingStaff} onClose={() => setEditingStaff(null)} title={`Edit Compensation: ${editingStaff?.full_name}`}>
               <div className="space-y-6 pt-2">
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex gap-3">
                     <DollarSign className="w-5 h-5 text-primary shrink-0" />
                     <p className="text-xs text-gray-400">Update staff pay details. Final approval requires Owner verification.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Base Salary (ETB)</label>
                        <Input type="number" value={editForm.base_salary} onChange={e => setEditForm({ ...editForm, base_salary: e.target.value })} placeholder="0.00" className="bg-black/20" />
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
                        <p className="text-sm font-bold text-white">Approved Status</p>
                        <p className="text-[10px] text-gray-500">Only Owners can authorize payments</p>
                     </div>
                     <button
                        disabled={!isOwner}
                        onClick={() => setEditForm({ ...editForm, is_salary_approved: !editForm.is_salary_approved })}
                        className={cn(
                           "w-12 h-6 rounded-full transition-all relative",
                           editForm.is_salary_approved ? "bg-green-600" : "bg-gray-700",
                           !isOwner && "opacity-50 cursor-not-allowed"
                        )}
                     >
                        <div className={cn("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", editForm.is_salary_approved ? "translate-x-6" : "translate-x-0")} />
                     </button>
                  </div>

                  <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                     <Button variant="ghost" onClick={() => setEditingStaff(null)}>Cancel</Button>
                     <Button onClick={handleSaveEdit} className="bg-primary text-black font-bold">Update Staff Profile</Button>
                  </div>
               </div>
            </Dialog>

            <InviteStaffModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} onSuccess={fetchData} />
         </div>
      </DashboardLayout>
   );
};

export default AdminStaffPerformance;
