import React, { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, Badge, cn } from '../components/ui';
import { ArrowUpRight, ArrowDownRight, TrendingUp, AlertOctagon, DollarSign, Clock, Filter } from 'lucide-react';

const MenuAnalytics: React.FC = () => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

  // --- Mock Data ---

  const topSellingItems = [
    { id: 1, name: "Special Burger", category: "Main", orders: 142, revenue: 42600, margin: 45 },
    { id: 2, name: "Avocado Smoothie", category: "Drinks", orders: 98, revenue: 14700, margin: 70 },
    { id: 3, name: "Fasting Firfir", category: "Breakfast", orders: 85, revenue: 12750, margin: 35 },
    { id: 4, name: "Tuna Sandwich", category: "Snack", orders: 64, revenue: 10240, margin: 55 },
    { id: 5, name: "Macchiato", category: "Drinks", orders: 210, revenue: 6300, margin: 85 },
  ];

  const outOfStockItems = [
    { id: 101, name: "Mango Juice", avgDaily: 4500, lostToday: 3200 },
    { id: 102, name: "Cheesecake", avgDaily: 2800, lostToday: 1500 },
  ];

  // Matrix Data: x = Orders (Popularity), y = Margin (Profitability)
  const matrixData = [
    { name: 'Burger', x: 142, y: 45, type: 'Star' }, // High Pop, High Margin
    { name: 'Macchiato', x: 210, y: 85, type: 'Star' },
    { name: 'Water', x: 180, y: 90, type: 'Star' },
    { name: 'Steak', x: 40, y: 30, type: 'Dog' }, // Low Pop, Low Margin
    { name: 'Lobster', x: 20, y: 60, type: 'Puzzle' }, // Low Pop, High Margin
    { name: 'Fries', x: 150, y: 25, type: 'Plow Horse' }, // High Pop, Low Margin
    { name: 'Salad', x: 60, y: 75, type: 'Puzzle' },
    { name: 'Soup', x: 30, y: 40, type: 'Dog' },
  ];

  // Hourly Heatmap Data (08:00 to 22:00)
  const heatmapData = Array.from({ length: 15 }, (_, i) => {
    const hour = i + 8;
    const isPeak = (hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 21);
    const base = isPeak ? 80 : 20;
    const value = Math.floor(base + Math.random() * 40);
    return { hour, value };
  });

  const getIntensityColor = (value: number) => {
    if (value > 90) return 'bg-[#84CC16]'; // High (Green)
    if (value > 60) return 'bg-[#84CC16]/70';
    if (value > 40) return 'bg-[#FFB800]'; // Med (Yellow)
    if (value > 20) return 'bg-[#FFB800]/50';
    return 'bg-gray-800'; // Low
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header & Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Menu Analytics</h1>
            <p className="text-gray-400 text-sm">Profitability and popularity insights</p>
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

        {/* Top Section: Tables & Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Top Selling Items Table */}
          <Card className="lg:col-span-2 bg-[#1A1A1A] border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Top Performers</CardTitle>
              <Badge variant="success" className="bg-[#84CC16]/10 text-[#84CC16] border-[#84CC16]/20">
                <TrendingUp className="w-3 h-3 mr-1" /> Strong Growth
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Orders</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {topSellingItems.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                        <td className="px-4 py-3 text-gray-400">{item.category}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{item.orders}</td>
                        <td className="px-4 py-3 text-right font-mono text-primary">ETB {item.revenue.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            "px-2 py-1 rounded text-xs font-bold",
                            item.margin > 60 ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                          )}>
                            {item.margin}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Out of Stock / Lost Revenue */}
          <div className="space-y-6">
             <Card className="bg-[#1A1A1A] border-gray-800 border-l-4 border-l-red-500">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <AlertOctagon className="w-5 h-5 text-red-500" /> Out of Stock
                   </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   {outOfStockItems.map(item => (
                      <div key={item.id} className="p-3 bg-red-500/5 rounded-lg border border-red-500/10">
                         <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-gray-200">{item.name}</span>
                            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">Unavailable</span>
                         </div>
                         <div className="flex justify-between text-xs text-gray-400">
                            <span>Avg. Daily Rev:</span>
                            <span>ETB {item.avgDaily}</span>
                         </div>
                         <div className="mt-2 pt-2 border-t border-red-500/10 flex justify-between items-center">
                            <span className="text-xs font-bold text-red-400">Est. Lost Today</span>
                            <span className="font-mono text-red-500 font-bold">- ETB {item.lostToday}</span>
                         </div>
                      </div>
                   ))}
                   {outOfStockItems.length === 0 && <p className="text-gray-500 text-sm">All items in stock.</p>}
                </CardContent>
             </Card>

             {/* Margin Highlights */}
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1A1A1A] border border-gray-800 p-4 rounded-xl flex flex-col justify-between">
                   <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Opportunity</div>
                   <div className="text-2xl font-bold text-[#84CC16]">Salads</div>
                   <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3 text-[#84CC16]" /> High Margin
                   </div>
                </div>
                <div className="bg-[#1A1A1A] border border-gray-800 p-4 rounded-xl flex flex-col justify-between">
                   <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Trap</div>
                   <div className="text-2xl font-bold text-red-400">Steak</div>
                   <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <ArrowDownRight className="w-3 h-3 text-red-400" /> Low Margin
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Middle Section: Matrix & Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Profit vs Popularity Matrix */}
          <Card className="lg:col-span-2 bg-[#1A1A1A] border-gray-800">
             <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                   <DollarSign className="w-5 h-5 text-primary" /> Menu Matrix
                </CardTitle>
             </CardHeader>
             <CardContent>
                <div className="h-[300px] w-full relative">
                   <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                         <XAxis type="number" dataKey="x" name="Orders" stroke="#666" label={{ value: 'Popularity (Orders)', position: 'bottom', fill: '#666', fontSize: 12 }} />
                         <YAxis type="number" dataKey="y" name="Margin" stroke="#666" label={{ value: 'Profit Margin %', angle: -90, position: 'left', fill: '#666', fontSize: 12 }} />
                         <RechartsTooltip 
                            cursor={{ strokeDasharray: '3 3' }} 
                            content={({ active, payload }) => {
                               if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                     <div className="bg-gray-900 border border-gray-700 p-2 rounded shadow-xl text-xs">
                                        <p className="font-bold text-white mb-1">{data.name}</p>
                                        <p className="text-gray-400">Type: <span className="text-primary">{data.type}</span></p>
                                        <p className="text-gray-400">Orders: {data.x}</p>
                                        <p className="text-gray-400">Margin: {data.y}%</p>
                                     </div>
                                  );
                               }
                               return null;
                            }}
                         />
                         {/* Quadrant Lines */}
                         <ReferenceLine x={100} stroke="#444" strokeDasharray="5 5" />
                         <ReferenceLine y={50} stroke="#444" strokeDasharray="5 5" />
                         
                         {/* Labels for Quadrants */}
                         <text x="180" y="30" fill="#84CC16" fontSize="10" fontWeight="bold">STARS</text>
                         <text x="180" y="280" fill="#FFB800" fontSize="10" fontWeight="bold">PLOW HORSES</text>
                         <text x="30" y="30" fill="#A855F7" fontSize="10" fontWeight="bold">PUZZLES</text>
                         <text x="30" y="280" fill="#EF4444" fontSize="10" fontWeight="bold">DOGS</text>

                         <Scatter name="Items" data={matrixData} fill="#FFB800">
                            {matrixData.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={
                                  entry.type === 'Star' ? '#84CC16' : 
                                  entry.type === 'Dog' ? '#EF4444' : 
                                  entry.type === 'Puzzle' ? '#A855F7' : '#FFB800'
                               } />
                            ))}
                         </Scatter>
                      </ScatterChart>
                   </ResponsiveContainer>
                </div>
             </CardContent>
          </Card>

          {/* Hourly Heatmap */}
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                   <Clock className="w-5 h-5 text-blue-400" /> Hourly Intensity
                </CardTitle>
             </CardHeader>
             <CardContent>
                <div className="flex flex-col gap-2 h-full justify-center pb-4">
                   {heatmapData.map((slot) => (
                      <div key={slot.hour} className="flex items-center gap-3 group">
                         <span className="text-xs font-mono text-gray-500 w-12 text-right">
                            {slot.hour}:00
                         </span>
                         <div className="flex-1 h-6 bg-gray-900 rounded-md overflow-hidden relative">
                            <div 
                               className={cn("h-full transition-all duration-500", getIntensityColor(slot.value))} 
                               style={{ width: `${slot.value}%` }}
                            />
                            <div className="absolute inset-0 flex items-center px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-[10px] font-bold text-black drop-shadow-sm">{slot.value} Sales</span>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </CardContent>
          </Card>

        </div>

      </div>
    </DashboardLayout>
  );
};

export default MenuAnalytics;
