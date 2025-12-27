
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input, showToast, cn } from '../components/ui';
import { 
  Users, Award, Clock, Search, UserPlus, Phone, 
  MoreVertical, ShieldCheck, Timer, TrendingUp, Filter, RefreshCw
} from 'lucide-react';
import { supabase } from '../supabase';
import { InviteStaffModal } from '../components/InviteStaffModal';

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_online: boolean;
  shift_start: string | null;
  phone: string | null;
}

interface ActiveShift {
  id: string;
  clock_in_time: string;
  staff: {
    full_name: string;
    role: string;
  }
}

interface LeaderboardItem {
  id: string;
  name: string;
  orders: number;
  sales: number;
}

const AdminStaffPerformance: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [activeShifts, setActiveShifts] = useState<ActiveShift[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

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
      setStaff(userData as StaffMember[]);

      const { data: shiftData, error: shiftError } = await supabase
        .from('staff_shifts')
        .select(`id, clock_in_time, staff_id`)
        .eq('status', 'active');

      if (!shiftError && shiftData) {
        const mappedShifts = shiftData.map(s => {
           const staffMember = userData?.find(u => u.id === s.staff_id);
           return {
              id: s.id,
              clock_in_time: s.clock_in_time,
              staff: {
                 full_name: staffMember?.full_name || 'Staff Member',
                 role: staffMember?.role || 'User'
              }
           };
        });
        setActiveShifts(mappedShifts as ActiveShift[]);
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('waiter_id, total_amount')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .in('status', ['completed', 'paid', 'served']);

      if (!orderError && orderData) {
          const salesMap = new Map<string, { name: string, orders: number, sales: number }>();
          orderData.forEach((o) => {
            if (!o.waiter_id) return;
            const staffMember = userData?.find(u => u.id === o.waiter_id);
            const current = salesMap.get(o.waiter_id) || { name: staffMember?.full_name || 'Staff', orders: 0, sales: 0 };
            salesMap.set(o.waiter_id, {
              ...current,
              orders: current.orders + 1,
              sales: current.sales + (o.total_amount || 0)
            });
          });

          setLeaderboard(Array.from(salesMap.entries())
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 10));
      }

    } catch (err: any) {
      console.error("Staff Performance Fetch Error:", err);
      showToast(err.message || "Sync failed", "error");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const getDuration = (startTime: string | null) => {
    if (!startTime) return "-";
    const start = new Date(startTime).getTime();
    const now = new Date().getTime();
    const diff = Math.max(0, now - start);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const filteredRoster = staff.filter(s => 
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <CardContent className="p-0">
               <div className="divide-y divide-border max-h-[400px] overflow-y-auto custom-scrollbar">
                  {activeShifts.length === 0 ? (
                    <div className="p-10 text-center text-muted italic text-sm">No staff currently clocked in</div>
                  ) : (
                    activeShifts.map(s => (
                      <div key={s.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                              <span className="text-green-500 font-bold text-xs">{s.staff?.full_name?.charAt(0)}</span>
                           </div>
                           <div>
                              <p className="text-sm font-bold text-white">{s.staff?.full_name}</p>
                              <p className="text-[10px] text-muted uppercase font-bold">{s.staff?.role}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-mono text-green-400 font-bold">{getDuration(s.clock_in_time)}</p>
                           <p className="text-[9px] text-gray-500">Since {new Date(s.clock_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                      </div>
                    ))
                  )}
               </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 bg-[#09090b] border-border">
             <CardHeader className="border-b border-border pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                   <Award className="w-5 h-5 text-primary" /> Top Performers (30 Days)
                </CardTitle>
                <Badge variant="outline" className="text-xs border-primary/20 text-primary">Revenue Focus</Badge>
             </CardHeader>
             <CardContent className="p-0">
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted uppercase bg-black/20">
                         <tr>
                            <th className="px-6 py-4">Rank</th>
                            <th className="px-6 py-4">Staff Member</th>
                            <th className="px-6 py-4 text-center">Orders Taken</th>
                            <th className="px-6 py-4 text-right">Total Sales</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                         {leaderboard.length === 0 ? (
                           <tr><td colSpan={4} className="p-8 text-center text-muted">No sales data recorded this month</td></tr>
                         ) : (
                           leaderboard.map((item, idx) => (
                             <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4">
                                   <div className={cn(
                                     "w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px]",
                                     idx === 0 ? "bg-primary text-black" : 
                                     idx === 1 ? "bg-gray-400 text-black" : 
                                     idx === 2 ? "bg-orange-600 text-white" : "bg-zinc-800 text-gray-400"
                                   )}>
                                      {idx + 1}
                                   </div>
                                </td>
                                <td className="px-6 py-4">
                                   <p className="font-bold text-white group-hover:text-primary transition-colors">{item.name}</p>
                                </td>
                                <td className="px-6 py-4 text-center font-mono text-gray-300">{item.orders}</td>
                                <td className="px-6 py-4 text-right font-mono text-primary font-bold">ETB {item.sales.toLocaleString()}</td>
                             </tr>
                           ))
                         )}
                      </tbody>
                   </table>
                </div>
             </CardContent>
          </Card>
        </div>

        <Card className="bg-[#09090b] border-border">
           <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4">
              <div>
                 <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" /> Staff Roster
                 </CardTitle>
                 <p className="text-xs text-muted mt-1">Full team directory and status tracking</p>
              </div>
              <div className="relative w-full md:w-64">
                 <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                 <Input 
                   placeholder="Search name or email..." 
                   className="pl-9 bg-black/40 border-border" 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                 />
              </div>
           </CardHeader>
           <CardContent className="p-0">
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted uppercase bg-black/20">
                       <tr>
                          <th className="px-6 py-4">Staff Member</th>
                          <th className="px-6 py-4">Role</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Contact</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                       {loading ? (
                         <tr><td colSpan={5} className="p-10 text-center text-muted italic">Loading roster...</td></tr>
                       ) : filteredRoster.map(s => (
                         <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                            <td className="px-6 py-4">
                               <div className="flex flex-col">
                                  <span className="font-bold text-white">{s.full_name}</span>
                                  <span className="text-[10px] text-muted">{s.email}</span>
                               </div>
                            </td>
                            <td className="px-6 py-4">
                               <Badge variant="outline" className="capitalize text-[10px] border-zinc-800 text-zinc-400">{s.role}</Badge>
                            </td>
                            <td className="px-6 py-4">
                               {s.is_online ? (
                                 <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1 flex w-fit">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Active
                                 </Badge>
                               ) : (
                                 <Badge variant="secondary" className="bg-zinc-800/50 text-zinc-500 border-zinc-800">Inactive</Badge>
                               )}
                            </td>
                            <td className="px-6 py-4 text-zinc-400">
                               {s.phone ? (
                                 <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> {s.phone}
                                 </div>
                               ) : '-'}
                            </td>
                            <td className="px-6 py-4 text-right">
                               <Button variant="ghost" size="icon" className="text-muted hover:text-white">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </CardContent>
        </Card>

        <InviteStaffModal 
            isOpen={isInviteOpen} 
            onClose={() => setIsInviteOpen(false)} 
            onSuccess={fetchData} 
        />
      </div>
    </DashboardLayout>
  );
};

export default AdminStaffPerformance;
