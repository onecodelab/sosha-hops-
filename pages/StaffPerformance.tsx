
import React, { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { 
  Users, UserCheck, Clock, TrendingUp, Zap, 
  Search, Filter, Activity, Award, ShieldAlert, CreditCard, Timer, Loader2,
  Wallet, Banknote, HandCoins
} from 'lucide-react';
import { Badge, Button, Input, cn, showToast, Dialog } from '../components/ui';
import { SoshaCard, SoshaCardTitle } from '../components/SoshaCard';
import { supabase } from '../supabase';
import { UserProfile, StaffShift, StaffAction, StaffPerformanceDaily, Role, TipsLedger } from '../types';

const StaffPerformance: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeStaff, setActiveStaff] = useState<(UserProfile & { stats?: StaffPerformanceDaily, shift?: StaffShift })[]>([]);
  const [recentActions, setRecentActions] = useState<StaffAction[]>([]);
  const [leaderboard, setLeaderboard] = useState<StaffPerformanceDaily[]>([]);
  const [tips, setTips] = useState<TipsLedger[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [activeActionFilter, setActiveActionFilter] = useState<string>('all');
  const [detailTab, setDetailTab] = useState<'overview' | 'shifts' | 'actions' | 'financial' | 'quality'>('overview');

  const selectedStaff = useMemo(() => 
    activeStaff.find(s => s.id === selectedStaffId), 
  [activeStaff, selectedStaffId]);

  useEffect(() => {
    fetchInitialData();

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);

    const shiftsSub = supabase.channel('staff_shifts_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_shifts' }, () => fetchInitialData())
      .subscribe();

    const actionsSub = supabase.channel('staff_actions_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_actions' }, (payload) => {
        setRecentActions(prev => [payload.new as StaffAction, ...prev].slice(0, 50));
        fetchInitialData(); 
      })
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(shiftsSub);
      supabase.removeChannel(actionsSub);
    };
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const { data: usersData } = await supabase.from('profiles').select('*');
      const { data: perfData } = await supabase.from('staff_performance_daily').select('*').eq('date', todayStr);
      const { data: shiftsData } = await supabase.from('staff_shifts').select('*').is('clock_out_time', null);
      const { data: actionsData } = await supabase.from('staff_actions').select('*, staff:profiles(full_name, role)').order('created_at', { ascending: false }).limit(50);
      const { data: tipsData } = await supabase.from('tips_ledger').select('*').gte('created_at', todayStr);
      
      const leaderboardData = await supabase.from('staff_performance_daily').select('*, staff:profiles(full_name, role)').eq('date', todayStr).order('revenue_attributed', { ascending: false });

      const combined = (usersData || []).map(u => {
        const stats = perfData?.find(p => p.staff_id === u.id);
        const shift = shiftsData?.find(s => s.staff_id === u.id);
        return { ...u, stats, shift };
      });

      setActiveStaff(combined);
      setRecentActions(actionsData as StaffAction[] || []);
      setLeaderboard(leaderboardData.data as StaffPerformanceDaily[] || []);
      setTips(tipsData as TipsLedger[] || []);

    } catch (err: any) {
      console.error("Staff Performance Fetch Error:", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  const tipStats = useMemo(() => {
    const total = tips.reduce((sum, t) => sum + (t.amount || 0), 0);
    const cash = tips.filter(t => t.tip_type === 'cash').reduce((sum, t) => sum + (t.amount || 0), 0);
    const digital = tips.filter(t => t.tip_type === 'digital').reduce((sum, t) => sum + (t.amount || 0), 0);
    return { total, cash, digital };
  }, [tips]);

  const getShiftDuration = (clockIn: string) => {
    const diff = Math.max(0, currentTime.getTime() - new Date(clockIn).getTime());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const filteredStaff = useMemo(() => 
    activeStaff.filter(s => s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || s.email?.toLowerCase().includes(searchTerm.toLowerCase())),
  [activeStaff, searchTerm]);

  const clockedInStaff = useMemo(() => 
    activeStaff.filter(s => s.shift && s.role !== 'owner'),
  [activeStaff]);

  const filteredActions = useMemo(() => 
    recentActions.filter(a => activeActionFilter === 'all' || a.action_type === activeActionFilter),
  [recentActions, activeActionFilter]);

  const getTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff/60)}h ago`;
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

  return (
    <DashboardLayout title="Intelligence" subtitle="Real-time personnel throughput and service quality audits">
      <div className="space-y-10 animate-in fade-in duration-500">
        
        {/* TOP: Tips Ledger Widget */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <SoshaCard className="p-6 bg-green-500/5 border-green-500/20" indicatorColor="green">
              <div className="flex justify-between items-start mb-4">
                 <div>
                    <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Total Tips Today</p>
                    <h3 className="text-3xl font-black text-white mt-1">ETB {tipStats.total.toLocaleString()}</h3>
                 </div>
                 <div className="p-3 bg-green-500/10 rounded-2xl border border-green-500/20">
                    <HandCoins className="w-6 h-6 text-green-400" />
                 </div>
              </div>
              <div className="flex gap-4">
                 <div className="flex-1 bg-black/40 p-3 rounded-xl border border-white/5">
                    <p className="text-[8px] font-black text-gray-500 uppercase">Cash</p>
                    <p className="text-sm font-bold text-white font-mono">{tipStats.cash.toLocaleString()}</p>
                 </div>
                 <div className="flex-1 bg-black/40 p-3 rounded-xl border border-white/5">
                    <p className="text-[8px] font-black text-gray-500 uppercase">Digital</p>
                    <p className="text-sm font-bold text-white font-mono">{tipStats.digital.toLocaleString()}</p>
                 </div>
              </div>
           </SoshaCard>

           <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {clockedInStaff.slice(0, 2).map(staff => (
                <SoshaCard key={staff.id} className="p-5 flex items-center gap-4 bg-primary/5 border-primary/20">
                   <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                      <span className="text-primary font-black text-lg">{staff.full_name?.charAt(0)}</span>
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{staff.full_name}</p>
                      <div className="flex items-center justify-between mt-1">
                         <span className="text-[10px] text-gray-500 font-bold uppercase">{getShiftDuration(staff.shift!.clock_in_time)} active</span>
                         <Badge className="bg-primary text-black text-[8px] font-black uppercase">Live</Badge>
                      </div>
                   </div>
                </SoshaCard>
              ))}
              {clockedInStaff.length === 0 && (
                <div className="col-span-full h-full flex items-center justify-center border border-dashed border-white/10 rounded-[2rem] text-gray-600 text-xs">
                   No staff currently live on shift
                </div>
              )}
           </div>
        </div>

        {/* ROSTER DIRECTORY */}
        <div>
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted flex items-center gap-2">
                 <UserCheck className="w-4 h-4" /> Roster Directory
              </h3>
              <div className="relative w-64">
                 <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                 <Input 
                   placeholder="Search roster..." 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="pl-9 h-9 bg-black/40 border-white/5 text-xs rounded-xl"
                 />
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredStaff.map(staff => {
                 const staffTips = tips.filter(t => t.staff_id === staff.id).reduce((sum, t) => sum + (t.amount || 0), 0);
                 return (
                 <SoshaCard 
                   key={staff.id} 
                   indicatorColor={staff.shift ? (staff.role === 'kitchen' ? 'red' : 'green') : 'default'}
                   isInteractive
                   onClick={() => setSelectedStaffId(staff.id)}
                   className="p-5 flex flex-col h-full min-h-[220px]"
                 >
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black uppercase overflow-hidden">
                             {staff.full_name?.charAt(0)}
                          </div>
                          <div>
                             <h4 className="text-sm font-bold text-white truncate max-w-[120px]">{staff.full_name}</h4>
                             <p className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                                {getRoleIcon(staff.role)} {staff.role}
                             </p>
                          </div>
                       </div>
                       <Badge className={cn("text-[8px] font-black uppercase border", staff.shift ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-zinc-800 text-zinc-500 border-zinc-700")}>
                          {staff.shift ? 'On Shift' : 'Clocked Out'}
                       </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-auto">
                       <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                          <p className="text-[8px] font-black text-gray-500 uppercase">Rev Today</p>
                          <p className="text-base font-black text-white font-mono mt-1">ETB {staff.stats?.revenue_attributed?.toLocaleString() || 0}</p>
                       </div>
                       <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                          <p className="text-[8px] font-black text-gray-500 uppercase">Tips</p>
                          <p className="text-base font-black text-green-500 font-mono mt-1">+{staffTips.toLocaleString()}</p>
                       </div>
                    </div>
                 </SoshaCard>
              )})}
           </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
           <div className="xl:col-span-2">
              <SoshaCard className="p-0 border-white/5 h-full overflow-hidden" indicatorColor="purple">
                 <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                          <Activity className="w-5 h-5 text-purple-400" />
                       </div>
                       <div>
                          <SoshaCardTitle className="text-sm font-black uppercase tracking-widest">Live Accountability Log</SoshaCardTitle>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Automated service audit</p>
                       </div>
                    </div>
                 </div>
                 <div className="overflow-y-auto max-h-[500px] custom-scrollbar p-2">
                    {filteredActions.length === 0 ? (
                       <div className="py-20 text-center text-gray-600 italic text-sm">No activity detected.</div>
                    ) : (
                       <div className="space-y-1">
                          {filteredActions.map(action => (
                             <div key={action.id} className="group flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all">
                                <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                                   {getRoleIcon(action.role as Role || 'waiter')}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-sm font-bold text-white capitalize">{action.staff_name || 'Staff'}</span>
                                      <Badge variant="secondary" className="text-[8px] font-black uppercase py-0 px-1.5 border-white/5 bg-zinc-900">
                                         {action.action_type.replace('_', ' ')}
                                      </Badge>
                                   </div>
                                </div>
                                <div className="text-right shrink-0">
                                   <p className="text-[10px] font-mono font-black text-gray-500 uppercase tracking-tighter">{getTimeAgo(action.created_at)}</p>
                                </div>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
              </SoshaCard>
           </div>

           <div className="xl:col-span-1">
              <SoshaCard className="p-0 border-white/5 h-full overflow-hidden" indicatorColor="yellow">
                 <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                       <Award className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                       <SoshaCardTitle className="text-sm font-black uppercase tracking-widest">Revenue Attribution</SoshaCardTitle>
                       <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Ranking by Sales</p>
                    </div>
                 </div>
                 <div className="p-4 space-y-3">
                    {leaderboard.map((item, idx) => (
                       <div key={item.id} className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between group hover:border-primary/20 transition-all">
                          <div className="flex items-center gap-4">
                             <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs", idx === 0 ? "bg-primary text-black" : "bg-zinc-800 text-gray-400")}>
                                {idx + 1}
                             </div>
                             <div>
                                <p className="text-sm font-bold text-white capitalize">{item.staff_name || 'Staff'}</p>
                                <span className="text-[9px] font-black text-primary uppercase">ETB {item.revenue_attributed.toLocaleString()}</span>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </SoshaCard>
           </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      <Dialog 
        isOpen={!!selectedStaffId} 
        onClose={() => setSelectedStaffId(null)} 
        title={selectedStaff ? `Analysis: ${selectedStaff.full_name}` : 'Personnel Audit'}
      >
         <div className="space-y-6">
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
               <button onClick={() => setDetailTab('overview')} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all", detailTab === 'overview' ? "bg-white/10 text-white" : "text-gray-500")}>Overview</button>
               <button onClick={() => setDetailTab('financial')} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all", detailTab === 'financial' ? "bg-white/10 text-white" : "text-gray-500")}>Financials</button>
            </div>

            <div className="min-h-[200px]">
               {detailTab === 'overview' && (
                  <div className="space-y-4 animate-in fade-in">
                     <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                        <p className="text-[10px] font-black text-gray-500 uppercase">Base Salary Status</p>
                        <div className="flex items-center justify-between mt-2">
                           <span className="text-xl font-black text-white font-mono">
                              {selectedStaff?.base_salary ? `ETB ${selectedStaff.base_salary.toLocaleString()} / ${selectedStaff.pay_period}` : 'N/A'}
                           </span>
                           {selectedStaff?.is_salary_approved ? (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Approved</Badge>
                           ) : (
                              <Badge variant="warning">Pending Approval</Badge>
                           )}
                        </div>
                     </div>
                     <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex justify-between items-center">
                        <p className="text-[10px] font-black text-gray-500 uppercase">Role Authorization</p>
                        <span className="text-sm font-bold text-white capitalize">{selectedStaff?.role}</span>
                     </div>
                  </div>
               )}
               {detailTab === 'financial' && (
                  <div className="space-y-4 animate-in fade-in">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-black/20 border border-white/5 rounded-2xl">
                           <p className="text-[8px] font-black text-gray-500 uppercase mb-1">Sales Attribution</p>
                           <p className="text-lg font-black text-white font-mono">ETB {selectedStaff?.stats?.revenue_attributed?.toLocaleString() || 0}</p>
                        </div>
                        <div className="p-4 bg-black/20 border border-white/5 rounded-2xl">
                           <p className="text-[8px] font-black text-gray-500 uppercase mb-1">Tips Received</p>
                           <p className="text-lg font-black text-green-500 font-mono">ETB {tips.filter(t => t.staff_id === selectedStaffId).reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString()}</p>
                        </div>
                     </div>
                  </div>
               )}
            </div>

            <div className="pt-6 border-t border-white/5">
               <Button onClick={() => setSelectedStaffId(null)} className="w-full bg-primary text-black font-black rounded-xl">Close Analysis</Button>
            </div>
         </div>
      </Dialog>
    </DashboardLayout>
  );
};

export default StaffPerformance;
