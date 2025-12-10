import React, { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, cn } from '../components/ui';
import { 
  ClipboardList, Clock, AlertOctagon, TrendingUp, DollarSign, 
  Armchair, Utensils, Truck, CheckCircle2, AlertTriangle, ArrowRight
} from 'lucide-react';

const OrdersTables: React.FC = () => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  // --- Mock Data ---

  // Hourly Order Volume
  const hourlyData = [
    { time: '10am', orders: 12 },
    { time: '11am', orders: 25 },
    { time: '12pm', orders: 65 }, // Peak
    { time: '1pm', orders: 85 }, // Peak
    { time: '2pm', orders: 55 },
    { time: '3pm', orders: 30 },
    { time: '4pm', orders: 25 },
    { time: '5pm', orders: 40 },
    { time: '6pm', orders: 70 },
    { time: '7pm', orders: 90 }, // Peak
    { time: '8pm', orders: 60 },
    { time: '9pm', orders: 35 },
  ];

  // Dine-in vs Delivery
  const orderTypeData = [
    { name: 'Dine-in', value: 340, color: '#FFB800' },
    { name: 'Delivery', value: 120, color: '#84CC16' },
    { name: 'Takeaway', value: 45, color: '#3B82F6' },
  ];

  // Table Utilization
  const tableStats = [
    { id: 'T5', usage: 12, revenue: 8500, avgTurnover: '45m' },
    { id: 'T2', usage: 11, revenue: 7200, avgTurnover: '50m' },
    { id: 'T8', usage: 10, revenue: 6800, avgTurnover: '40m' },
    { id: 'T1', usage: 3, revenue: 1200, avgTurnover: '35m' }, // Least used
  ];

  // Staff Stats
  const staffStats = [
    { name: 'David M.', role: 'Waiter', orders: 62, speed: '12m', errors: 1 },
    { name: 'Hana A.', role: 'Waiter', orders: 58, speed: '14m', errors: 0 },
    { name: 'Yonas B.', role: 'Waiter', orders: 41, speed: '18m', errors: 3 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Orders & Tables</h1>
            <p className="text-gray-400 text-sm">Throughput analysis and service efficiency</p>
          </div>
          
          <div className="flex bg-[#1A1A1A] p-1 rounded-lg border border-gray-800">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-md capitalize transition-all",
                  period === p 
                    ? "bg-primary text-black shadow-md" 
                    : "text-gray-400 hover:text-white"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Orders</p>
                   <h3 className="text-2xl font-bold text-white mt-1">505</h3>
                   <div className="text-xs text-[#84CC16] font-bold mt-1 flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1" /> +12% vs last {period}
                   </div>
                </div>
                <div className="p-2 bg-primary/10 rounded-full">
                   <ClipboardList className="w-5 h-5 text-primary" />
                </div>
             </CardContent>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Avg Order Value</p>
                   <h3 className="text-2xl font-bold text-white mt-1">ETB 450</h3>
                   <div className="text-xs text-[#84CC16] font-bold mt-1 flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1" /> +5%
                   </div>
                </div>
                <div className="p-2 bg-green-500/10 rounded-full">
                   <DollarSign className="w-5 h-5 text-green-500" />
                </div>
             </CardContent>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Cancellations</p>
                   <h3 className="text-2xl font-bold text-white mt-1">1.2% <span className="text-sm font-normal text-gray-500">(6 orders)</span></h3>
                   <div className="text-xs text-red-500 font-bold mt-1 flex items-center">
                      <AlertOctagon className="w-3 h-3 mr-1" /> 2 remade
                   </div>
                </div>
                <div className="p-2 bg-red-500/10 rounded-full">
                   <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
             </CardContent>
          </Card>
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-5 flex justify-between items-start">
                <div>
                   <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Table Turnover</p>
                   <h3 className="text-2xl font-bold text-white mt-1">45 min</h3>
                   <div className="text-xs text-blue-400 font-bold mt-1 flex items-center">
                      <Clock className="w-3 h-3 mr-1" /> Optimal
                   </div>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-full">
                   <Armchair className="w-5 h-5 text-blue-500" />
                </div>
             </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* Hourly Volume */}
           <Card className="lg:col-span-2 bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white">Order Volume by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={hourlyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                          <XAxis dataKey="time" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                             cursor={{fill: 'rgba(255,255,255,0.05)'}}
                             contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#fff' }}
                          />
                          <Bar dataKey="orders" fill="#FFB800" radius={[4, 4, 0, 0]} maxBarSize={40} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="flex gap-6 mt-4 justify-center">
                    <div className="text-center">
                       <p className="text-xs text-gray-500">Lunch Peak</p>
                       <p className="text-white font-bold">12pm - 2pm</p>
                    </div>
                    <div className="text-center">
                       <p className="text-xs text-gray-500">Dinner Peak</p>
                       <p className="text-white font-bold">7pm - 9pm</p>
                    </div>
                 </div>
              </CardContent>
           </Card>

           {/* Order Type Split */}
           <Card className="bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white">Source Split</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center">
                 <div className="h-[200px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                             data={orderTypeData}
                             innerRadius={60}
                             outerRadius={80}
                             paddingAngle={5}
                             dataKey="value"
                             stroke="none"
                          >
                             {orderTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                             ))}
                          </Pie>
                          <Tooltip 
                             contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '8px' }}
                             itemStyle={{ color: '#fff' }}
                          />
                       </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-3xl font-bold text-white">505</span>
                       <span className="text-xs text-gray-500 uppercase">Total Orders</span>
                    </div>
                 </div>
                 <div className="w-full space-y-3 mt-4">
                    {orderTypeData.map((type) => (
                       <div key={type.name} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                             <span className="text-gray-300">{type.name}</span>
                          </div>
                          <span className="font-bold text-white">{type.value}</span>
                       </div>
                    ))}
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Order Flow Timeline */}
        <Card className="bg-[#1A1A1A] border-gray-800">
           <CardHeader>
              <CardTitle className="text-white">Average Service Flow</CardTitle>
           </CardHeader>
           <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 
                 {/* Step 1 */}
                 <div className="relative p-4 bg-black/20 rounded-xl border border-gray-800 flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
                       <ClipboardList className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-sm font-bold text-white">Placed</p>
                    <p className="text-xs text-gray-500 mt-1">Start</p>
                    
                    <div className="hidden md:flex absolute top-1/2 -right-5 w-6 h-6 z-10 items-center justify-center bg-gray-800 rounded-full border border-gray-700">
                       <ArrowRight className="w-3 h-3 text-gray-400" />
                    </div>
                 </div>

                 {/* Step 2 */}
                 <div className="relative p-4 bg-black/20 rounded-xl border border-gray-800 flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
                       <CheckCircle2 className="w-5 h-5 text-purple-500" />
                    </div>
                    <p className="text-sm font-bold text-white">Kitchen Accept</p>
                    <p className="text-xs text-primary font-bold mt-1">2m avg</p>
                    
                    <div className="hidden md:flex absolute top-1/2 -right-5 w-6 h-6 z-10 items-center justify-center bg-gray-800 rounded-full border border-gray-700">
                       <ArrowRight className="w-3 h-3 text-gray-400" />
                    </div>
                 </div>

                 {/* Step 3 */}
                 <div className="relative p-4 bg-black/20 rounded-xl border border-gray-800 flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-3">
                       <Utensils className="w-5 h-5 text-orange-500" />
                    </div>
                    <p className="text-sm font-bold text-white">Ready</p>
                    <p className="text-xs text-primary font-bold mt-1">15m avg</p>
                    
                    <div className="hidden md:flex absolute top-1/2 -right-5 w-6 h-6 z-10 items-center justify-center bg-gray-800 rounded-full border border-gray-700">
                       <ArrowRight className="w-3 h-3 text-gray-400" />
                    </div>
                 </div>

                 {/* Step 4 */}
                 <div className="relative p-4 bg-black/20 rounded-xl border border-gray-800 flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                       <Truck className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-sm font-bold text-white">Served</p>
                    <p className="text-xs text-primary font-bold mt-1">3m avg</p>
                 </div>

              </div>
              <div className="mt-4 text-center text-xs text-gray-500">
                 Total Cycle Time: <span className="text-white font-bold">20 min</span> (Target: 18 min)
                 <span className="ml-4 text-red-400">12 dishes delayed > 25m today</span>
              </div>
           </CardContent>
        </Card>

        {/* Bottom Section: Tables & Staff */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           
           {/* Table Stats */}
           <Card className="bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white flex items-center gap-2">
                    <Armchair className="w-5 h-5 text-gray-400" /> Table Analytics
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800">
                       <tr>
                          <th className="px-6 py-3">Table</th>
                          <th className="px-6 py-3">Turns</th>
                          <th className="px-6 py-3">Avg Time</th>
                          <th className="px-6 py-3 text-right">Revenue</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                       {tableStats.map((table) => (
                          <tr key={table.id} className="hover:bg-white/5 transition-colors">
                             <td className="px-6 py-3 font-bold text-white">{table.id}</td>
                             <td className="px-6 py-3 text-gray-300">
                                {table.usage} <span className="text-xs text-gray-500">sessions</span>
                             </td>
                             <td className="px-6 py-3 text-gray-300">{table.avgTurnover}</td>
                             <td className="px-6 py-3 text-right font-mono text-primary">ETB {table.revenue.toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </CardContent>
           </Card>

           {/* Staff Performance Context */}
           <Card className="bg-[#1A1A1A] border-gray-800">
              <CardHeader>
                 <CardTitle className="text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" /> Service Quality
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800">
                       <tr>
                          <th className="px-6 py-3">Waiter</th>
                          <th className="px-6 py-3">Volume</th>
                          <th className="px-6 py-3">Avg Speed</th>
                          <th className="px-6 py-3 text-right">Errors</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                       {staffStats.map((staff) => (
                          <tr key={staff.name} className="hover:bg-white/5 transition-colors">
                             <td className="px-6 py-3 font-medium text-white">{staff.name}</td>
                             <td className="px-6 py-3 text-gray-300">{staff.orders}</td>
                             <td className="px-6 py-3 text-gray-300">{staff.speed}</td>
                             <td className="px-6 py-3 text-right">
                                {staff.errors === 0 ? (
                                   <span className="text-green-500 text-xs font-bold">Perfect</span>
                                ) : (
                                   <span className="text-red-400 text-xs font-bold">{staff.errors} Issues</span>
                                )}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </CardContent>
           </Card>

        </div>

      </div>
    </DashboardLayout>
  );
};

export default OrdersTables;