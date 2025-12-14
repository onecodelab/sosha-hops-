import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, Badge, cn, Button, showToast } from '../components/ui';
import { 
  Users, Award, Clock, AlertTriangle, TrendingUp, 
  Zap, UserCheck, AlertCircle, Loader2, Plus, UserX, UserCog, Mail
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { InviteStaffModal } from '../components/InviteStaffModal';

const StaffPerformance: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [workloadData, setWorkloadData] = useState<any[]>([]);
  const [remakesData, setRemakesData] = useState<any[]>([]);
  const [activeStaffCount, setActiveStaffCount] = useState(0);
  const [speedData, setSpeedData] = useState<any[]>([]);
  
  // Management State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchData();

    // Subscribe to changes
    const ordersSub = supabase.channel('staff_perf_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_issues' }, () => fetchData())
      .subscribe();
      
    return () => { supabase.removeChannel(ordersSub); };
  }, []);

  const fetchData = async () => {
    try {
        setLoading(true);
        const todayStr = new Date().toISOString().split('T')[0];
        const startOfDay = `${todayStr}T00:00:00`;

        // 1. Fetch Staff (Users) with online status
        // Note: With new RLS, standard staff can see all users (policy: "Staff can view all users")
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('*')
            .order('is_online', { ascending: false });

        if (userError) throw userError;
        
        setAllUsers(users || []);
        
        // Filter for specific roles for performance tracking
        const trackableStaff = users?.filter(u => ['waiter', 'manager', 'kitchen', 'owner'].includes(u.role)) || [];
        
        const activeCount = trackableStaff.filter(u => u.is_online).length || 0;
        setActiveStaffCount(activeCount);
        setStaffList(trackableStaff);

        // 2. Fetch Today's Orders
        const { data: orders, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .gte('created_at', startOfDay);

        if (orderError) throw orderError;

        // --- Process Leaderboard (Orders & Score) ---
        const statsMap = new Map<string, { orders: number, sales: number, speedSum: number, speedCount: number }>();
        
        trackableStaff.forEach(u => {
            statsMap.set(u.id, { orders: 0, sales: 0, speedSum: 0, speedCount: 0 });
        });

        orders?.forEach((o: any) => {
            if (o.verified_by) {
                const current = statsMap.get(o.verified_by);
                if (current) {
                    // Count orders
                    if (['paid', 'served', 'ready_to_pay', 'verified', 'accepted', 'ready', 'preparing'].includes(o.status)) {
                        current.orders += 1;
                        current.sales += (o.total_amount || 0);
                    }
                    
                    // Calc Speed (Served - Created)
                    if (o.served_at && o.created_at) {
                         const diff = (new Date(o.served_at).getTime() - new Date(o.created_at).getTime()) / 60000;
                         if (diff > 0 && diff < 120) { // Filter outliers
                             current.speedSum += diff;
                             current.speedCount += 1;
                         }
                    }
                }
            }
        });

        const lbData = trackableStaff.map(u => {
            const stats = statsMap.get(u.id) || { orders: 0, sales: 0, speedSum: 0, speedCount: 0 };
            
            // Formula: (Orders * 2) + (Sales / 100)
            const rawScore = (stats.orders * 2) + (stats.sales / 100); 
            const score = Math.min(100, Math.round(rawScore)); 

            const avgSpeed = stats.speedCount > 0 ? Math.round(stats.speedSum / stats.speedCount) : 0;

            return {
                id: u.id,
                name: u.full_name || u.email?.split('@')[0],
                role: u.role,
                orders: stats.orders,
                sales: stats.sales,
                score: stats.orders > 0 ? score : 0,
                avgSpeed
            };
        }).sort((a, b) => b.score - a.score).slice(0, 10) || [];

        setLeaderboard(lbData);

        // --- Process Speed Data for Chart ---
        const speedChartData = lbData.filter(s => s.orders > 0).slice(0, 5).map(s => ({
            name: s.name,
            time: s.avgSpeed || 0,
            target: 15
        }));
        setSpeedData(speedChartData);

        // --- Process Workload (Hourly) ---
        const hours = ['10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm'];
        const workloadMap: Record<string, any> = {};

        hours.forEach(h => {
            workloadMap[h] = { time: h };
            // Initialize top 3 staff with 0
            lbData.slice(0, 3).forEach(s => workloadMap[h][s.name] = 0);
        });

        orders?.forEach((o: any) => {
            const date = new Date(o.created_at);
            let hour = date.getHours();
            const ampm = hour >= 12 ? 'pm' : 'am';
            const h12 = hour % 12 || 12;
            const timeKey = `${h12}${ampm}`;

            if (workloadMap[timeKey]) {
                const staff = trackableStaff.find(u => u.id === o.verified_by);
                if (staff) {
                     const name = staff.full_name || staff.email?.split('@')[0];
                     if (workloadMap[timeKey][name] !== undefined) {
                         workloadMap[timeKey][name]++;
                     }
                }
            }
        });
        setWorkloadData(Object.values(workloadMap));

        // --- Fetch Order Issues ---
        try {
            const { data: issues, error: issueError } = await supabase
                .from('order_issues')
                .select('*')
                .gte('created_at', startOfDay)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (!issueError && issues) {
                setRemakesData(issues);
            } else {
                 setRemakesData([]);
            }
        } catch (e) {
            console.log("Issues table likely missing, skipping.");
        }

    } catch (err) {
        console.error("Staff Perf Fetch Error:", err);
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm("Are you sure you want to delete this staff profile? This cannot be undone.")) return;
    try {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        showToast("Staff profile deleted.", "success");
        fetchData();
    } catch (err: any) {
        showToast("Failed to delete staff: " + err.message, "error");
    }
  };

  const colors = ["#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B"];
  const isOwner = profile?.role === 'owner';

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Staff Management & Performance</h1>
            <p className="text-gray-400 text-sm">Efficiency metrics, shift tracking, and quality control</p>
          </div>
          <div className="flex gap-3">
             <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-lg border border-green-500/20">
                <UserCheck className="w-4 h-4 text-green-500" />
                <span className="text-sm font-bold text-green-400">{activeStaffCount} Online</span>
             </div>
             {isOwner && (
                <Button onClick={() => setIsInviteOpen(true)} className="bg-primary text-black font-bold h-8">
                   <Plus className="w-4 h-4 mr-1" /> Invite Staff
                </Button>
             )}
             <Button variant="outline" onClick={fetchData} className="h-8 w-8 p-0 border-gray-700">
                <Loader2 className={cn("w-4 h-4", loading && "animate-spin")} />
             </Button>
          </div>
        </div>

        {/* Top Section: Leaderboard & Shift */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Leaderboard Table */}
          <Card className="xl:col-span-2 bg-[#1A1A1A] border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                 <Award className="w-5 h-5 text-primary" /> Top Performers (Today)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[350px]">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800 sticky top-0 backdrop-blur-sm z-10">
                    <tr>
                      <th className="px-6 py-4">Rank</th>
                      <th className="px-6 py-4">Staff Member</th>
                      <th className="px-6 py-4 text-center">Orders</th>
                      <th className="px-6 py-4 text-right">Sales</th>
                      <th className="px-6 py-4 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {leaderboard.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-gray-500">No active staff data today.</td></tr>
                    )}
                    {leaderboard.map((staff, index) => (
                      <tr key={staff.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                           <div className={cn(
                             "w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs",
                             index === 0 ? "bg-[#FFB800] text-black" : 
                             index === 1 ? "bg-gray-300 text-black" : 
                             index === 2 ? "bg-orange-700 text-white" : "bg-gray-800 text-gray-400"
                           )}>
                              {index + 1}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="font-bold text-white capitalize">{staff.name}</div>
                           <div className="text-xs text-gray-500 capitalize">{staff.role}</div>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-300">
                           {staff.orders}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-primary font-bold">
                           ETB {staff.sales.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                           <span className={cn(
                             "text-lg font-bold",
                             staff.score >= 90 ? "text-green-500" : staff.score >= 50 ? "text-primary" : "text-gray-500"
                           )}>
                             {staff.score}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Shift Attendance / Staff List */}
          <Card className="bg-[#1A1A1A] border-gray-800 flex flex-col max-h-[430px]">
            <CardHeader>
               <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" /> Staff Directory
               </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
               {allUsers.map((staff, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-gray-800/50 group">
                     <div className="flex items-center gap-3">
                        <div className="relative">
                           <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 capitalize">
                              {staff.full_name?.charAt(0) || staff.email?.charAt(0)}
                           </div>
                           <div className={cn("absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1A1A1A]", staff.is_online ? "bg-green-500" : "bg-gray-500")} />
                        </div>
                        <div>
                           <p className="text-sm font-bold text-white capitalize flex items-center gap-1">
                               {staff.full_name || staff.email?.split('@')[0]}
                               {staff.role === 'owner' && <Badge variant="outline" className="text-[9px] border-primary/40 text-primary py-0 px-1">OWNER</Badge>}
                           </p>
                           <p className="text-xs text-gray-500 capitalize">{staff.role}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        {isOwner && staff.role !== 'owner' ? (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteStaff(staff.id)}
                            >
                                <UserX className="w-4 h-4" />
                            </Button>
                        ) : (
                            <div className="text-xs text-gray-500">
                                {staff.is_online ? "Online" : "Away"}
                            </div>
                        )}
                     </div>
                  </div>
               ))}
            </CardContent>
          </Card>

        </div>

        {/* Middle Section: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           
           {/* Order Handling Speed */}
           <Card className="bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" /> Service Speed (Avg. Mins)
                 </CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="h-[250px] w-full">
                    {speedData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500">
                           No served orders today to calculate speed
                        </div>
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={speedData} layout="vertical" margin={{ left: 20, right: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                          <XAxis type="number" stroke="#666" unit="m" />
                          <YAxis dataKey="name" type="category" stroke="#999" width={80} />
                          <Tooltip 
                             cursor={{fill: 'rgba(255,255,255,0.05)'}}
                             contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#fff' }}
                          />
                          <Bar dataKey="time" name="Avg Minutes" barSize={20} radius={[0, 4, 4, 0]}>
                             {speedData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.time > entry.target ? '#EF4444' : '#84CC16'} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                    )}
                 </div>
              </CardContent>
           </Card>

           {/* Workload Distribution */}
           <Card className="bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" /> Workload Distribution (Today)
                 </CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={workloadData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                          <XAxis dataKey="time" stroke="#666" />
                          <YAxis stroke="#666" />
                          <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }} />
                          {leaderboard.slice(0, 3).map((staff, idx) => (
                              <Area 
                                key={staff.id}
                                type="monotone" 
                                dataKey={staff.name} 
                                stackId="1" 
                                stroke={colors[idx % colors.length]} 
                                fill={colors[idx % colors.length]} 
                                fillOpacity={0.3} 
                              />
                          ))}
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="flex justify-center gap-4 text-xs text-gray-400 mt-2 flex-wrap">
                    {leaderboard.slice(0, 3).map((staff, idx) => (
                        <span key={staff.id} style={{ color: colors[idx % colors.length] }} className="font-bold">
                            {staff.name}
                        </span>
                    ))}
                 </div>
              </CardContent>
           </Card>

        </div>

        {/* Bottom Section: Remakes & Quality */}
        <div className="grid grid-cols-1 gap-6">
           
           {/* Errors & Remakes */}
           <Card className="bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" /> Quality Control (Issues Log)
                 </CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="space-y-3">
                    {remakesData.length === 0 && (
                        <div className="p-8 text-center bg-black/20 rounded-lg border border-dashed border-gray-800">
                            <p className="text-gray-500 text-sm">No issues reported in `order_issues` today.</p>
                        </div>
                    )}
                    {remakesData.map((item) => (
                       <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                          <div className="flex items-center gap-4">
                             <div className="text-xs text-gray-500 font-mono w-24">
                                {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                             </div>
                             <div>
                                <p className="text-sm font-bold text-white capitalize">{item.issue_type}</p>
                                <p className="text-xs text-gray-400">{item.description}</p>
                             </div>
                          </div>
                          <Badge variant="outline" className="border-red-500/20 text-red-400">{item.status}</Badge>
                       </div>
                    ))}
                 </div>
              </CardContent>
           </Card>

        </div>
        
        {/* Modals */}
        <InviteStaffModal 
            isOpen={isInviteOpen} 
            onClose={() => setIsInviteOpen(false)} 
            onSuccess={fetchData} 
        />

      </div>
    </DashboardLayout>
  );
};

export default StaffPerformance;