import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, cn, showToast } from '../components/ui';
import { 
  Users, AlertCircle, TrendingUp, Clock, AlertTriangle, 
  CheckCircle2, BarChart3, Timer
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { Order } from '../types';
import { PaymentVerificationModal, FloatingPaymentButton } from '../components/PaymentVerificationModal';

const ManagerDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  // --- Realtime Data Fetching ---
  useEffect(() => {
    fetchOrders();

    const subscription = supabase
      .channel('manager_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(subscription); 
    }
  }, []);

  const fetchOrders = async () => {
     const { data } = await supabase.from('orders').select('*');
     if (data) setOrders(data as Order[]);
  };

  // --- Filter Logic ---
  const unpaidServedOrders = orders.filter(o => 
    ['served', 'ready_to_pay'].includes(o.status) && o.status !== 'paid'
  );

  // --- Mock Data ---

  const kpiData = {
    revenue: 45200,
    orders: 142,
    issues: 5, // 3 complaints + 2 remakes
    staffActive: 8
  };

  const staffPerformance = [
    { id: 1, name: "David M.", role: "Waiter", orders: 42, sales: 12500, avgTime: "14m", errors: 0 },
    { id: 2, name: "Hana A.", role: "Waiter", orders: 38, sales: 11200, avgTime: "16m", errors: 1 },
    { id: 3, name: "Sarah J.", role: "Waiter", orders: 35, sales: 9800, avgTime: "13m", errors: 0 },
    { id: 4, name: "Yonas B.", role: "Waiter", orders: 27, sales: 7500, avgTime: "21m", errors: 2 },
  ];

  const shiftOverview = [
    { name: "David M.", role: "Waiter", since: "08:00 AM", duration: "6h" },
    { name: "Hana A.", role: "Waiter", since: "08:30 AM", duration: "5.5h" },
    { name: "Tigist L.", role: "Kitchen", since: "07:00 AM", duration: "7h" },
    { name: "Abebe K.", role: "Kitchen", since: "07:00 AM", duration: "7h" },
    { name: "Security 1", role: "Security", since: "06:00 AM", duration: "8h" },
  ];

  // Service Flow Data
  const flowData = [
    { step: 'Order', time: 2, target: 3 },
    { step: 'Prep', time: 18, target: 15 }, // Bottleneck
    { step: 'Pickup', time: 4, target: 2 },
    { step: 'Pay', time: 5, target: 5 },
  ];

  const stationDelays = [
    { station: 'Grill', count: 4 },
    { station: 'Salad', count: 1 },
    { station: 'Bar', count: 0 },
  ];

  const complaintsLog = [
    { id: 101, type: 'Remake', table: 'T5', staff: 'Yonas B.', reason: 'Steak overcooked', time: '12:45 PM', status: 'resolved' },
    { id: 102, type: 'Complaint', table: 'T2', staff: 'David M.', reason: 'Slow service', time: '1:15 PM', status: 'pending' },
    { id: 103, type: 'Cancel', table: 'T8', staff: 'Hana A.', reason: 'Changed mind', time: '1:30 PM', status: 'pending' },
  ];

  const [issues, setIssues] = useState(complaintsLog);

  const resolveIssue = (id: number) => {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status: 'resolved' } : i));
    showToast('Issue marked as resolved');
  };

  // Determine Bottleneck
  const slowStep = flowData.reduce((prev, curr) => (curr.time - curr.target) > (prev.time - prev.target) ? curr : prev);
  const bottleneckLabel = slowStep.time > slowStep.target ? slowStep.step : "None";

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Branch Manager</h1>
            <p className="text-gray-400 text-sm">Daily operations and staff oversight</p>
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
                   <h3 className="text-2xl font-bold text-white mt-1">ETB {kpiData.revenue.toLocaleString()}</h3>
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
                   <h3 className="text-2xl font-bold text-white mt-1">{kpiData.orders}</h3>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-full">
                   <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
             </CardContent>
          </Card>
          <Card className={cn("bg-[#1A1A1A] border-gray-800", kpiData.issues > 0 && "border-red-500/30")}>
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Guest Issues</p>
                   <h3 className={cn("text-2xl font-bold mt-1", kpiData.issues > 0 ? "text-red-500" : "text-white")}>
                      {kpiData.issues}
                   </h3>
                   {kpiData.issues > 0 && <span className="text-xs text-red-400">Action Required</span>}
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
                   <h3 className="text-2xl font-bold text-white mt-1">{kpiData.staffActive}</h3>
                </div>
                <div className="p-2 bg-green-500/10 rounded-full">
                   <Users className="w-5 h-5 text-green-500" />
                </div>
             </CardContent>
          </Card>
        </div>

        {/* 2. Service Flow & Shift Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* Service Flow Analysis */}
           <Card className="lg:col-span-2 bg-[#1A1A1A] border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-white flex items-center gap-2">
                    <Timer className="w-5 h-5 text-orange-400" /> Service Flow & Bottlenecks
                 </CardTitle>
                 {bottleneckLabel !== 'None' && (
                    <Badge variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/20 animate-pulse">
                       Bottleneck: {bottleneckLabel}
                    </Badge>
                 )}
              </CardHeader>
              <CardContent>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Chart */}
                    <div className="h-[200px] w-full">
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={flowData} layout="vertical" margin={{ left: 10, right: 10 }}>
                             <XAxis type="number" hide />
                             <YAxis dataKey="step" type="category" width={50} tick={{fill: '#9CA3AF', fontSize: 12}} />
                             <Tooltip 
                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }}
                             />
                             <Bar dataKey="time" barSize={20} radius={[0, 4, 4, 0]}>
                                {flowData.map((entry, index) => (
                                   <Cell key={`cell-${index}`} fill={entry.time > entry.target ? '#EF4444' : '#3B82F6'} />
                                ))}
                             </Bar>
                          </BarChart>
                       </ResponsiveContainer>
                       <div className="flex justify-center gap-4 text-xs text-gray-500 mt-2">
                          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#3B82F6]"/> Normal</span>
                          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#EF4444]"/> Delayed</span>
                       </div>
                    </div>

                    {/* Insights Panel */}
                    <div className="space-y-4">
                       <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Station Delays</h4>
                       <div className="grid grid-cols-3 gap-3">
                          {stationDelays.map(s => (
                             <div key={s.station} className={cn(
                                "p-3 rounded-lg border text-center",
                                s.count > 0 ? "bg-red-500/5 border-red-500/20" : "bg-gray-800/50 border-gray-700"
                             )}>
                                <div className="text-xs text-gray-500 mb-1">{s.station}</div>
                                <div className={cn("text-xl font-bold", s.count > 0 ? "text-red-500" : "text-gray-300")}>
                                   {s.count}
                                </div>
                             </div>
                          ))}
                       </div>
                       <div className="pt-4 border-t border-gray-800">
                          <div className="flex justify-between items-center text-sm">
                             <span className="text-gray-400">Avg Service Time</span>
                             <span className="font-bold text-white">29 min <span className="text-red-400 text-xs">(+4m)</span></span>
                          </div>
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>

           {/* Shift Overview Sidebar */}
           <Card className="bg-[#1A1A1A] border-gray-800 flex flex-col h-[380px]">
              <CardHeader className="pb-2">
                 <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-green-500" /> Active Shift
                 </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto pr-2 space-y-3">
                 {shiftOverview.map((staff, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-black/20 hover:bg-white/5 transition-colors border border-gray-800/50">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                             {staff.name.charAt(0)}
                          </div>
                          <div>
                             <p className="text-sm font-bold text-white">{staff.name}</p>
                             <p className="text-[10px] text-gray-500">{staff.role} • On for {staff.duration}</p>
                          </div>
                       </div>
                       <div className="w-2 h-2 rounded-full bg-green-500" title="Online" />
                    </div>
                 ))}
              </CardContent>
           </Card>

        </div>

        {/* 3. Staff Performance Table */}
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
                          <th className="px-6 py-4">Avg Speed</th>
                          <th className="px-6 py-4 text-right">Errors</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                       {staffPerformance.map((staff) => (
                          <tr key={staff.id} className="hover:bg-white/5 transition-colors">
                             <td className="px-6 py-4">
                                <span className="font-bold text-white">{staff.name}</span>
                                <span className="ml-2 text-xs text-gray-500">{staff.role}</span>
                             </td>
                             <td className="px-6 py-4 text-gray-300">{staff.orders}</td>
                             <td className="px-6 py-4 text-primary font-mono">{staff.sales.toLocaleString()}</td>
                             <td className="px-6 py-4">
                                <span className={cn(
                                   "px-2 py-1 rounded text-xs font-bold",
                                   parseInt(staff.avgTime) > 20 ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                                )}>
                                   {staff.avgTime}
                                </span>
                             </td>
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

        {/* 4. Issues Log */}
        <Card className="bg-[#1A1A1A] border-gray-800">
           <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                 <AlertTriangle className="w-5 h-5 text-red-500" /> Operational Issues Log
              </CardTitle>
           </CardHeader>
           <CardContent className="p-0">
              <div className="divide-y divide-gray-800">
                 {issues.length === 0 && (
                    <div className="p-8 text-center text-gray-500">No active issues. Great job!</div>
                 )}
                 {issues.map((issue) => (
                    <div key={issue.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                       <div className="flex items-center gap-4">
                          <div className={cn(
                             "p-2 rounded-lg",
                             issue.type === 'Remake' ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"
                          )}>
                             <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div>
                             <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{issue.type}</span>
                                <Badge variant="outline" className="border-gray-700 text-gray-400 text-[10px]">{issue.time}</Badge>
                                {issue.status === 'resolved' && <Badge variant="success" className="bg-green-500/10 text-green-500 border-green-500/20">Resolved</Badge>}
                             </div>
                             <p className="text-sm text-gray-400 mt-0.5">
                                {issue.reason} • <span className="text-gray-500">Table {issue.table} ({issue.staff})</span>
                             </p>
                          </div>
                       </div>
                       
                       {issue.status !== 'resolved' && (
                          <Button 
                             size="sm" 
                             variant="outline" 
                             className="border-green-500/20 text-green-500 hover:bg-green-500/10"
                             onClick={() => resolveIssue(issue.id)}
                          >
                             <CheckCircle2 className="w-4 h-4 mr-2" /> Resolve
                          </Button>
                       )}
                    </div>
                 ))}
              </div>
           </CardContent>
        </Card>

      </div>

      {/* Payment System */}
      <PaymentVerificationModal 
        isOpen={isPaymentOpen} 
        onClose={() => setIsPaymentOpen(false)} 
        orders={unpaidServedOrders}
        onPaymentSuccess={() => {
          fetchOrders();
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