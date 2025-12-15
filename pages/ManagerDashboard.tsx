import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, cn, showToast } from '../components/ui';
import { 
  Users, AlertCircle, TrendingUp, Clock, AlertTriangle, 
  CheckCircle2, BarChart3, Timer, Loader2, List
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { Order } from '../types';
import { PaymentVerificationModal, FloatingPaymentButton } from '../components/PaymentVerificationModal';
import { OrderCard } from '../components/OrderCard';

const ManagerDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  
  // Data State
  const [kpi, setKpi] = useState({
     revenue: 0,
     orders: 0,
     issues: 0,
     staffActive: 0
  });
  const [staffPerf, setStaffPerf] = useState<any[]>([]);
  const [shiftStaff, setShiftStaff] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [serviceFlow, setServiceFlow] = useState<any[]>([]);
  const [avgServiceTime, setAvgServiceTime] = useState("0m");

  // --- Realtime Data Fetching ---
  useEffect(() => {
    fetchDashboardData();

    const subscriptions = [
       supabase.channel('mgr_orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDashboardData()),
       supabase.channel('mgr_issues').on('postgres_changes', { event: '*', schema: 'public', table: 'operational_issues' }, () => fetchDashboardData()),
       supabase.channel('mgr_users').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchDashboardData()),
    ];

    subscriptions.forEach(s => s.subscribe());

    return () => { 
      subscriptions.forEach(s => supabase.removeChannel(s)); 
    }
  }, []);

  const fetchDashboardData = async () => {
     try {
        const todayStr = new Date().toISOString().split('T')[0];
        const startOfDay = `${todayStr}T00:00:00`;

        // 1. Fetch Orders (Today)
        const { data: todayOrders, error: orderError } = await supabase
           .from('orders')
           .select(`
             *,
             order_items (
               quantity,
               menu_item:menu (name)
             )
           `)
           .gte('created_at', startOfDay)
           .order('created_at', { ascending: false });
        
        if (orderError) throw orderError;
        setOrders(todayOrders as Order[]);

        // 2. Fetch Users (Staff)
        const { data: allStaff, error: userError } = await supabase
           .from('users')
           .select('*')
           .in('role', ['waiter', 'kitchen', 'manager', 'security']);

        // 3. Fetch Operational Issues
        const { data: issuesData, error: issueError } = await supabase
           .from('operational_issues')
           .select('*')
           .gte('created_at', startOfDay)
           .order('created_at', { ascending: false });

        // --- Calculate KPIs ---
        const activeOrders = todayOrders || [];
        const revenue = activeOrders
            .filter(o => o.status !== 'cancelled')
            .reduce((sum, o) => sum + (o.total_amount || 0), 0);
        
        const totalOrders = activeOrders.length;
        
        const dbIssuesCount = issuesData?.filter((i: any) => i.status === 'open').length || 0;
        const cancelledCount = activeOrders.filter(o => o.status === 'cancelled').length;
        const totalIssues = dbIssuesCount + cancelledCount; 

        const staffActivityMap = new Set(activeOrders.map(o => o.waiter_id).filter(Boolean));
        const activeStaffCount = allStaff?.filter((u: any) => 
            u.is_online || staffActivityMap.has(u.id)
        ).length || 0;

        setKpi({
            revenue,
            orders: totalOrders,
            issues: totalIssues,
            staffActive: activeStaffCount
        });

        // --- Process Service Flow ---
        const stageCounts = { order: 0, prep: 0, pickup: 0, pay: 0 };
        let totalServedTime = 0;
        let servedCount = 0;

        activeOrders.forEach(o => {
            if (['pending'].includes(o.status)) stageCounts.order++;
            else if (['accepted', 'preparing'].includes(o.status)) stageCounts.prep++;
            else if (['ready'].includes(o.status)) stageCounts.pickup++;
            else if (['served', 'completed', 'paid'].includes(o.status)) {
                stageCounts.pay++;
                if (o.served_at && o.created_at) {
                    const diff = (new Date(o.served_at).getTime() - new Date(o.created_at).getTime()) / 60000;
                    if (diff > 0 && diff < 120) {
                        totalServedTime += diff;
                        servedCount++;
                    }
                }
            }
        });

        const flowChartData = [
            { step: 'Order', time: stageCounts.order, target: 5 },
            { step: 'Prep', time: stageCounts.prep, target: 8 },
            { step: 'Pickup', time: stageCounts.pickup, target: 4 },
            { step: 'Pay', time: stageCounts.pay > 20 ? 20 : stageCounts.pay, target: 10 }, 
        ];
        setServiceFlow(flowChartData);
        setAvgServiceTime(servedCount > 0 ? `${Math.round(totalServedTime / servedCount)}m` : "0m");

        // --- Process Staff Performance ---
        const staffMap: Record<string, any> = {};
        allStaff?.forEach((u: any) => {
             staffMap[u.id] = { 
                 id: u.id, 
                 name: u.full_name || u.email.split('@')[0], 
                 role: u.role, 
                 orders: 0, 
                 sales: 0, 
                 errors: 0 
             };
        });

        activeOrders.forEach(o => {
             if (o.waiter_id && staffMap[o.waiter_id]) {
                 staffMap[o.waiter_id].orders++;
                 staffMap[o.waiter_id].sales += o.total_amount || 0;
                 if (o.status === 'cancelled') staffMap[o.waiter_id].errors++;
             }
        });

        const perfData = Object.values(staffMap)
            .filter((s: any) => s.orders > 0)
            .sort((a: any, b: any) => b.orders - a.orders)
            .slice(0, 10);
            
        setStaffPerf(perfData);

        const activeShiftStaff = allStaff?.filter((u: any) => u.is_online || staffActivityMap.has(u.id))
            .map((u: any) => ({
                name: u.full_name || u.email.split('@')[0],
                role: u.role,
                duration: u.shift_start ? 
                    `${Math.round((new Date().getTime() - new Date(u.shift_start).getTime()) / 3600000 * 10) / 10}h` : 
                    'Active'
            })) || [];
        setShiftStaff(activeShiftStaff);

        setIssues(issuesData || []);

     } catch (err) {
        console.error("Manager Dashboard Fetch Error:", err);
     } finally {
        setLoading(false);
     }
  };

  const resolveIssue = async (id: string) => {
    try {
        await supabase
            .from('operational_issues')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('id', id);
        showToast('Issue marked as resolved', 'success');
        fetchDashboardData();
    } catch (err) {
        showToast('Failed to resolve issue', 'error');
    }
  };

  const unpaidServedOrders = orders.filter(o => 
    o.status === 'served'
  );
  
  const liveActiveOrders = orders.filter(o => 
    ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)
  );

  const slowStep = serviceFlow.length > 0 ? serviceFlow.reduce((prev, curr) => (curr.time > curr.target) ? curr : prev, serviceFlow[0]) : null;
  const bottleneckLabel = slowStep && slowStep.time > slowStep.target ? slowStep.step : "None";

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="flex items-center gap-3">
             <div>
                <h1 className="text-2xl font-bold text-white">Branch Manager</h1>
                <p className="text-gray-400 text-sm">Daily operations and staff oversight</p>
             </div>
             {loading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          </div>
          <div className="text-right">
             <div className="text-xs text-gray-500 uppercase tracking-widest">Today</div>
             <div className="text-lg font-bold text-white">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          </div>
        </div>

        {/* 1. KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Revenue Today</p>
                   <h3 className="text-2xl font-bold text-white mt-1">ETB {kpi.revenue.toLocaleString()}</h3>
                </div>
                <div className="p-2 bg-primary/10 rounded-full">
                   <TrendingUp className="w-5 h-5 text-primary" />
                </div>
             </CardContent>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Orders</p>
                   <h3 className="text-2xl font-bold text-white mt-1">{kpi.orders}</h3>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-full">
                   <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
             </CardContent>
          </Card>
          <Card className={cn("bg-[#1A1A1A] border-gray-800", kpi.issues > 0 && "border-red-500/30")}>
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Guest Issues</p>
                   <h3 className={cn("text-2xl font-bold mt-1", kpi.issues > 0 ? "text-red-500" : "text-white")}>
                      {kpi.issues}
                   </h3>
                   {kpi.issues > 0 && <span className="text-xs text-red-400">Action Required</span>}
                </div>
                <div className="p-2 bg-red-500/10 rounded-full">
                   <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
             </CardContent>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Staff On Shift</p>
                   <h3 className="text-2xl font-bold text-white mt-1">{kpi.staffActive}</h3>
                </div>
                <div className="p-2 bg-green-500/10 rounded-full">
                   <Users className="w-5 h-5 text-green-500" />
                </div>
             </CardContent>
          </Card>
        </div>

        {/* 2. Live Active Orders (New Section) */}
        <Card className="bg-[#1A1A1A] border-gray-800">
           <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                 <List className="w-5 h-5 text-blue-400" /> Live Active Orders
              </CardTitle>
              <Badge variant="outline" className="border-gray-700 text-gray-400">{liveActiveOrders.length} Active</Badge>
           </CardHeader>
           <CardContent>
              {liveActiveOrders.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                      No active orders at the moment.
                  </div>
              ) : (
                  <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                     {liveActiveOrders.map(order => (
                        <div key={order.id} className="min-w-[300px]">
                           <OrderCard order={order} role="manager" />
                        </div>
                     ))}
                  </div>
              )}
           </CardContent>
        </Card>

        {/* 3. Service Flow & Shift Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <Card className="lg:col-span-2 bg-[#1A1A1A] border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-white flex items-center gap-2">
                    <Timer className="w-5 h-5 text-orange-400" /> Service Flow & Bottlenecks
                 </CardTitle>
                 {bottleneckLabel !== 'None' && (
                    <Badge variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/20 animate-pulse">
                       High Load: {bottleneckLabel}
                    </Badge>
                 )}
              </CardHeader>
              <CardContent>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="h-[200px] w-full">
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={serviceFlow} layout="vertical" margin={{ left: 10, right: 10 }}>
                             <XAxis type="number" hide />
                             <YAxis dataKey="step" type="category" width={50} tick={{fill: '#9CA3AF', fontSize: 12}} />
                             <Tooltip 
                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }}
                             />
                             <Bar dataKey="time" barSize={20} radius={[0, 4, 4, 0]}>
                                {serviceFlow.map((entry, index) => (
                                   <Cell key={`cell-${index}`} fill={entry.time > entry.target ? '#EF4444' : '#3B82F6'} />
                                ))}
                             </Bar>
                          </BarChart>
                       </ResponsiveContainer>
                    </div>

                    <div className="space-y-4">
                       <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Live Metrics</h4>
                       <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 text-center">
                              <p className="text-xs text-gray-500">Pending Orders</p>
                              <p className="text-xl font-bold text-white">{serviceFlow.find(f => f.step === 'Order')?.time || 0}</p>
                          </div>
                          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 text-center">
                              <p className="text-xs text-gray-500">Avg Service Time</p>
                              <p className="text-xl font-bold text-primary">{avgServiceTime}</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>

           <Card className="bg-[#1A1A1A] border-gray-800 flex flex-col h-[380px]">
              <CardHeader className="pb-2">
                 <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-green-500" /> Active Shift
                 </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto pr-2 space-y-3">
                 {shiftStaff.length === 0 && <p className="text-gray-500 text-center text-sm pt-10">No active staff detected.</p>}
                 {shiftStaff.map((staff, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-black/20 hover:bg-white/5 transition-colors border border-gray-800/50">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 capitalize">
                             {staff.name.charAt(0)}
                          </div>
                          <div>
                             <p className="text-sm font-bold text-white capitalize">{staff.name}</p>
                             <p className="text-[10px] text-gray-500 capitalize">{staff.role} • {staff.duration}</p>
                          </div>
                       </div>
                       <div className="w-2 h-2 rounded-full bg-green-500" title="Online" />
                    </div>
                 ))}
              </CardContent>
           </Card>
        </div>

        {/* 4. Staff Performance Table */}
        <Card className="bg-[#1A1A1A] border-gray-800">
           <CardHeader>
              <CardTitle className="text-white">Staff Performance (Live)</CardTitle>
           </CardHeader>
           <CardContent className="p-0">
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800">
                       <tr>
                          <th className="px-6 py-4">Staff Member</th>
                          <th className="px-6 py-4">Orders</th>
                          <th className="px-6 py-4">Sales (ETB)</th>
                          <th className="px-6 py-4 text-right">Errors</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                       {staffPerf.map((staff) => (
                          <tr key={staff.id} className="hover:bg-white/5 transition-colors">
                             <td className="px-6 py-4">
                                <span className="font-bold text-white capitalize">{staff.name}</span>
                                <span className="ml-2 text-xs text-gray-500 capitalize">{staff.role}</span>
                             </td>
                             <td className="px-6 py-4 text-gray-300">{staff.orders}</td>
                             <td className="px-6 py-4 text-primary font-mono">{staff.sales.toLocaleString()}</td>
                             <td className="px-6 py-4 text-right">
                                {staff.errors > 0 ? (
                                   <span className="text-red-400 font-bold">{staff.errors}</span>
                                ) : (
                                   <span className="text-gray-600">-</span>
                                )}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </CardContent>
        </Card>

      </div>

      <PaymentVerificationModal 
        isOpen={isPaymentOpen} 
        onClose={() => setIsPaymentOpen(false)} 
        orders={unpaidServedOrders}
        onPaymentSuccess={() => {
          fetchDashboardData();
        }}
      />
      <FloatingPaymentButton 
         count={unpaidServedOrders.length} 
         onClick={() => setIsPaymentOpen(true)} 
      />
    </DashboardLayout>
  );
};

export default ManagerDashboard;