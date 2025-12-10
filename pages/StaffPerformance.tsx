import React from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, Badge, cn } from '../components/ui';
import { 
  Users, Award, Clock, AlertTriangle, TrendingUp, 
  Zap, UserCheck, UserX, AlertCircle 
} from 'lucide-react';

const StaffPerformance: React.FC = () => {
  
  // --- Mock Data ---

  const staffLeaderboard = [
    { id: 1, name: "Sarah J.", role: "Manager", orders: 45, sales: 15400, upsells: 12, score: 98 },
    { id: 2, name: "David M.", role: "Waiter", orders: 62, sales: 12800, upsells: 8, score: 94 },
    { id: 3, name: "Hana A.", role: "Waiter", orders: 58, sales: 11200, upsells: 15, score: 92 },
    { id: 4, name: "Yonas B.", role: "Waiter", orders: 41, sales: 8500, upsells: 3, score: 85 },
    { id: 5, name: "Tigist L.", role: "Kitchen", orders: 0, sales: 0, upsells: 0, score: 96 },
  ];

  const shiftData = [
    { name: "Sarah J.", role: "Manager", login: "08:00 AM", status: "online", duration: "6h 30m" },
    { name: "David M.", role: "Waiter", login: "08:30 AM", status: "online", duration: "6h 00m" },
    { name: "Hana A.", role: "Waiter", login: "11:00 AM", status: "online", duration: "3h 30m" },
    { name: "Michael K.", role: "Waiter", login: "08:00 AM", logout: "02:00 PM", status: "offline", duration: "6h 00m" },
    { name: "Tigist L.", role: "Kitchen", login: "07:30 AM", status: "online", duration: "7h 00m" },
  ];

  // Avg time from Order -> Kitchen Ready (minutes)
  const speedData = [
    { name: 'David M.', time: 12, target: 15 },
    { name: 'Hana A.', time: 14, target: 15 },
    { name: 'Yonas B.', time: 18, target: 15 }, // Slower
    { name: 'Sarah J.', time: 10, target: 15 },
  ];

  // Workload (Orders per hour per waiter)
  const workloadData = [
    { time: '12pm', David: 4, Hana: 2, Yonas: 3 },
    { time: '1pm', David: 8, Hana: 6, Yonas: 5 },
    { time: '2pm', David: 12, Hana: 10, Yonas: 8 }, // Peak
    { time: '3pm', David: 6, Hana: 8, Yonas: 4 },
    { time: '4pm', David: 3, Hana: 4, Yonas: 2 },
  ];

  const remakesData = [
    { id: 1, dish: "Special Burger", waiter: "Yonas B.", cook: "Tigist L.", reason: "Wrong toppings", time: "1:15 PM" },
    { id: 2, dish: "Macchiato", waiter: "David M.", cook: "Barista 1", reason: "Cold", time: "2:30 PM" },
    { id: 3, dish: "Steak", waiter: "Hana A.", cook: "Chef K.", reason: "Overcooked", time: "12:45 PM" },
  ];

  // Idle vs Pressure stats (Percentages)
  const pressureData = [
    { name: "David M.", idle: 20, active: 50, overload: 30 },
    { name: "Hana A.", idle: 15, active: 60, overload: 25 },
    { name: "Yonas B.", idle: 40, active: 40, overload: 20 },
    { name: "Tigist L.", idle: 10, active: 40, overload: 50 }, // Kitchen busy
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Staff Performance</h1>
            <p className="text-gray-400 text-sm">Efficiency metrics, shift tracking, and quality control</p>
          </div>
          <div className="flex gap-3">
             <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-lg border border-green-500/20">
                <UserCheck className="w-4 h-4 text-green-500" />
                <span className="text-sm font-bold text-green-400">8 Online</span>
             </div>
             <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-lg border border-gray-700">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-300">12 Total Staff</span>
             </div>
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-4">Rank</th>
                      <th className="px-6 py-4">Staff Member</th>
                      <th className="px-6 py-4 text-center">Orders</th>
                      <th className="px-6 py-4 text-right">Sales</th>
                      <th className="px-6 py-4 text-center">Upsells</th>
                      <th className="px-6 py-4 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {staffLeaderboard.filter(s => s.role !== 'Kitchen').map((staff, index) => (
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
                           <div className="font-bold text-white">{staff.name}</div>
                           <div className="text-xs text-gray-500">{staff.role}</div>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-300">
                           {staff.orders}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-primary font-bold">
                           ETB {staff.sales.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                           <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded-md font-bold text-xs border border-blue-500/20">
                             {staff.upsells}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <span className={cn(
                             "text-lg font-bold",
                             staff.score >= 95 ? "text-green-500" : staff.score >= 85 ? "text-primary" : "text-red-500"
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

          {/* Shift Attendance */}
          <Card className="bg-[#1A1A1A] border-gray-800 flex flex-col">
            <CardHeader>
               <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" /> Shift Attendance
               </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pr-2 space-y-3">
               {shiftData.map((staff, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-gray-800/50">
                     <div className="flex items-center gap-3">
                        <div className="relative">
                           <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                              {staff.name.charAt(0)}
                           </div>
                           <div className={cn(
                              "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1A1A1A]",
                              staff.status === 'online' ? "bg-green-500" : "bg-gray-500"
                           )} />
                        </div>
                        <div>
                           <p className="text-sm font-bold text-white">{staff.name}</p>
                           <p className="text-xs text-gray-500">{staff.role}</p>
                        </div>
                     </div>
                     <div className="text-right text-xs">
                        <p className={staff.status === 'online' ? "text-green-400 font-bold" : "text-gray-500"}>
                           {staff.status === 'online' ? 'Online' : 'Logged Out'}
                        </p>
                        <p className="text-gray-500">{staff.duration}</p>
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
                    <Zap className="w-5 h-5 text-yellow-500" /> Service Speed (Order → Ready)
                 </CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="h-[250px] w-full">
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
                 </div>
                 <div className="flex justify-center gap-6 text-xs text-gray-400 mt-2">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#84CC16]"/> On Target (&lt;15m)</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#EF4444]"/> Slow (&gt;15m)</span>
                 </div>
              </CardContent>
           </Card>

           {/* Workload Distribution */}
           <Card className="bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" /> Workload Distribution (Hourly)
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
                          <Area type="monotone" dataKey="David" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                          <Area type="monotone" dataKey="Hana" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
                          <Area type="monotone" dataKey="Yonas" stackId="1" stroke="#EC4899" fill="#EC4899" fillOpacity={0.3} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="flex justify-center gap-6 text-xs text-gray-400 mt-2">
                    <span className="text-blue-500 font-bold">David M.</span>
                    <span className="text-purple-500 font-bold">Hana A.</span>
                    <span className="text-pink-500 font-bold">Yonas B.</span>
                 </div>
              </CardContent>
           </Card>

        </div>

        {/* Bottom Section: QC & Load */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* Errors & Remakes */}
           <Card className="lg:col-span-2 bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" /> Quality Control (Remakes)
                 </CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="space-y-3">
                    {remakesData.map((item) => (
                       <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                          <div className="flex items-center gap-4">
                             <div className="text-xs text-gray-500 font-mono w-16">{item.time}</div>
                             <div>
                                <p className="text-sm font-bold text-white">{item.dish}</p>
                                <p className="text-xs text-gray-400">Reason: <span className="text-red-400">{item.reason}</span></p>
                             </div>
                          </div>
                          <div className="text-right text-xs">
                             <p className="text-gray-300">Waiter: {item.waiter}</p>
                             <p className="text-gray-500">Cook: {item.cook}</p>
                          </div>
                       </div>
                    ))}
                    {remakesData.length === 0 && <p className="text-gray-500 text-sm">No reported issues today.</p>}
                 </div>
              </CardContent>
           </Card>

           {/* Workload Indicators */}
           <Card className="bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-400" /> Efficiency Breakdown
                 </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                 {pressureData.map(staff => (
                    <div key={staff.name}>
                       <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-bold text-white">{staff.name}</span>
                          <span className={cn(
                             "font-bold",
                             staff.overload > 40 ? "text-red-500" : "text-gray-400"
                          )}>
                             {staff.overload > 40 ? "Overloaded" : "Optimal"}
                          </span>
                       </div>
                       <div className="h-2 w-full rounded-full flex overflow-hidden bg-gray-800">
                          <div style={{ width: `${staff.idle}%` }} className="bg-gray-600 h-full" title="Idle" />
                          <div style={{ width: `${staff.active}%` }} className="bg-green-500 h-full" title="Active" />
                          <div style={{ width: `${staff.overload}%` }} className="bg-red-500 h-full" title="Overload" />
                       </div>
                       <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                          <span>Idle {staff.idle}%</span>
                          <span>Busy {staff.overload}%</span>
                       </div>
                    </div>
                 ))}
                 <div className="flex justify-center gap-4 text-[10px] text-gray-400 border-t border-gray-800 pt-3">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-gray-600 rounded-full"/> Idle</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full"/> Active</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"/> Overload</div>
                 </div>
              </CardContent>
           </Card>

        </div>

      </div>
    </DashboardLayout>
  );
};

export default StaffPerformance;
