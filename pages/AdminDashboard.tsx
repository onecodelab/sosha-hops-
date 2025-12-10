import React from 'react';
import { 
  AreaChart, Area, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip
} from 'recharts';
import { DashboardLayout } from '../components/DashboardLayout';
import { 
  TrendingUp, TrendingDown, Users, 
  ShoppingBag, ChefHat, Utensils, AlertOctagon, AlertTriangle
} from 'lucide-react';
import { cn } from '../components/ui';

// --- Components ---

const KPICard = ({ title, value, subtext, trend, trendValue, icon: Icon, chartData, color = "primary" }: any) => {
    const isPositive = trend === 'up';
    const trendColor = isPositive ? 'text-[#84CC16]' : 'text-red-500';
    const trendBg = isPositive ? 'bg-[#84CC16]/10' : 'bg-red-500/10';
    const TrendIcon = isPositive ? TrendingUp : TrendingDown;
    
    // Color mapping
    const accentColor = color === 'primary' ? '#FFB800' : color === 'success' ? '#84CC16' : color === 'danger' ? '#EF4444' : '#3B82F6';

    return (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-[20px] p-5 shadow-lg hover:border-gray-700 transition-all group h-full flex flex-col justify-between relative overflow-hidden">
             <div className="flex justify-between items-start mb-2 relative z-10">
               <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
               </div>
               <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", `bg-[${accentColor}]/10`)}>
                  <Icon className="w-5 h-5" style={{ color: accentColor }} />
               </div>
            </div>
            
            {/* Middle Section: Chart or Subtext */}
            <div className="flex-1 min-h-[40px] relative z-10 flex items-end">
                {chartData ? (
                    <div className="w-full h-[50px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={accentColor} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={accentColor} stopOpacity={0}/>
                                </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="value" stroke={accentColor} strokeWidth={2} fill={`url(#grad-${color})`} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="text-sm font-medium text-white mb-1">{subtext}</p>
                )}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800 relative z-10">
               <div className={cn("flex items-center text-xs font-bold px-2 py-1 rounded-md", trendColor, trendBg)}>
                  <TrendIcon className="w-3 h-3 mr-1" /> {trendValue}
               </div>
               <span className="text-[10px] text-gray-500 font-medium uppercase">Last 24 Hours</span>
            </div>
            
            {/* Background Glow */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 opacity-10 blur-3xl rounded-full" style={{ backgroundColor: accentColor }} />
        </div>
    );
};

const AdminDashboard: React.FC = () => {
  // --- Dummy Data ---
  
  const revenueChartData = [
    { value: 4000 }, { value: 3000 }, { value: 9800 }, { value: 8780 }, 
    { value: 5890 }, { value: 4390 }, { value: 6490 }, { value: 8490 }, { value: 11490 }
  ];

  const kitchenData = [
    { name: 'Appetizers', active: 12, delayed: 1 },
    { name: 'Main Course', active: 28, delayed: 4 },
    { name: 'Desserts', active: 5, delayed: 0 },
    { name: 'Drinks', active: 8, delayed: 0 },
  ];

  const healthScore = 85;
  const healthData = [
      { name: 'Score', value: healthScore, color: '#84CC16' },
      { name: 'Remaining', value: 100 - healthScore, color: '#333' }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Operations Overview</h2>
            <p className="text-sm text-gray-400">Real-time snapshot of restaurant performance</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-right hidden md:block">
                <p className="text-xs text-gray-400 uppercase tracking-widest">Current Shift</p>
                <p className="text-sm font-bold text-white">Manager: <span className="text-primary">Sarah J.</span></p>
             </div>
          </div>
        </div>

        {/* 1. KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <KPICard 
             title="Today's Revenue" 
             value="ETB 45,987" 
             trend="up" 
             trendValue="+12.5%" 
             icon={Utensils} 
             chartData={revenueChartData}
             color="primary"
          />
          <KPICard 
             title="Order Volume" 
             value="142 Orders" 
             subtext="Peak: 1pm - 2pm"
             trend="up" 
             trendValue="18 orders/hr" 
             icon={ShoppingBag} 
             color="success"
          />
          <KPICard 
             title="Inventory Health" 
             value="3 Critical" 
             subtext="Value: ETB 125,000"
             trend="down" 
             trendValue="5 Expiring Soon" 
             icon={AlertOctagon} 
             color="danger"
          />
          <KPICard 
             title="Staff Load" 
             value="8 Active" 
             subtext="Bottleneck: Kitchen"
             trend="up" 
             trendValue="17 orders/staff" 
             icon={Users} 
             color="info"
          />
        </div>

        {/* 2. Middle Section: Kitchen & Business Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Kitchen Status (Wide) */}
          <div className="lg:col-span-2 bg-[#1A1A1A] border border-gray-800 rounded-[20px] p-6 shadow-lg">
             <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <ChefHat className="w-5 h-5 text-primary" /> Kitchen Status
                    </h3>
                    <p className="text-xs text-gray-500">Active dishes and delay monitoring</p>
                </div>
                <div className="flex gap-4">
                   <div className="text-right">
                      <p className="text-xs text-gray-500">Avg Prep Time</p>
                      <p className="text-lg font-bold text-white font-mono">18m <span className="text-xs text-red-400 font-normal">(+3m)</span></p>
                   </div>
                </div>
             </div>

             <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={kitchenData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <XAxis type="number" hide />
                      <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                        contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: '8px' }}
                      />
                      <Bar dataKey="active" stackId="a" fill="#333" radius={[0, 4, 4, 0]} barSize={20} name="Active Orders" />
                      <Bar dataKey="delayed" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={20} name="Delayed" />
                   </BarChart>
                </ResponsiveContainer>
             </div>
             <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                {kitchenData.map(d => (
                    <div key={d.name} className="bg-black/20 rounded-lg p-2 border border-white/5">
                        <p className="text-gray-400 mb-1">{d.name}</p>
                        <div className="flex justify-center items-center gap-2">
                            <span className="text-white font-bold">{d.active}</span>
                            {d.delayed > 0 && <span className="text-red-500 font-bold">({d.delayed}!)</span>}
                        </div>
                    </div>
                ))}
             </div>
          </div>

          {/* Business Health Score (Narrow) */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-[20px] p-6 shadow-lg flex flex-col items-center justify-center relative">
             <h3 className="text-lg font-bold text-white mb-2 absolute top-6 left-6">Health Score</h3>
             
             <div className="w-[200px] h-[200px] relative mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={healthData}
                            innerRadius={70}
                            outerRadius={85}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                        >
                            <Cell key="score" fill="#84CC16" />
                            <Cell key="bg" fill="#262626" />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-bold text-white">{healthScore}</span>
                    <span className="text-xs text-gray-400 uppercase tracking-widest mt-1">Good</span>
                </div>
             </div>

             <div className="w-full mt-6 space-y-3">
                 <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-400">Delays</span>
                    <span className="text-red-400 font-bold">High (4)</span>
                 </div>
                 <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-400">Inventory</span>
                    <span className="text-[#FFB800] font-bold">Warning</span>
                 </div>
                 <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-400">Quality</span>
                    <span className="text-[#84CC16] font-bold">Excellent</span>
                 </div>
             </div>
          </div>
        </div>

        {/* 3. Bottom Row: Tables & Loss Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           
           {/* Tables Status */}
           <div className="bg-[#1A1A1A] border border-gray-800 rounded-[20px] p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-bold text-white">Table Service</h3>
                 <span className="text-xs bg-gray-800 text-white px-2 py-1 rounded">24/28 Occupied</span>
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                 {Array.from({length: 28}).map((_, i) => {
                     const status = i < 20 ? 'occupied' : i < 22 ? 'waiting' : i < 24 ? 'cleaning' : 'free';
                     const colors = {
                         occupied: 'bg-gray-700',
                         waiting: 'bg-red-500 animate-pulse',
                         cleaning: 'bg-yellow-500/50',
                         free: 'border border-gray-700'
                     };
                     return (
                         <div key={i} className={cn("aspect-square rounded-md flex items-center justify-center text-[10px] font-bold text-white/50", colors[status])}>
                             {i+1}
                         </div>
                     )
                 })}
              </div>
              <div className="flex gap-4 mt-4 text-xs">
                 <div className="flex items-center gap-2 text-gray-400"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/> Long Wait (2)</div>
                 <div className="flex items-center gap-2 text-gray-400"><div className="w-2 h-2 rounded-full bg-yellow-500/50"/> Needs Cleaning (3)</div>
              </div>
           </div>

           {/* Loss Indicators */}
           <div className="bg-[#1A1A1A] border border-gray-800 rounded-[20px] p-6 shadow-lg">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" /> Loss Indicators
              </h3>
              
              <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500/10 rounded-lg text-red-500"><Utensils className="w-4 h-4" /></div>
                          <div>
                              <p className="text-sm font-bold text-white">Remade Dishes</p>
                              <p className="text-xs text-gray-500">2 items sent back to kitchen</p>
                          </div>
                      </div>
                      <span className="text-red-500 font-bold">- ETB 850</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500/10 rounded-lg text-red-500"><AlertOctagon className="w-4 h-4" /></div>
                          <div>
                              <p className="text-sm font-bold text-white">Canceled Orders</p>
                              <p className="text-xs text-gray-500">4 orders canceled after prep</p>
                          </div>
                      </div>
                      <span className="text-red-500 font-bold">- ETB 1,200</span>
                  </div>
                  
                  <div className="pt-2 flex justify-between items-center border-t border-gray-800">
                      <span className="text-sm text-gray-400">Est. Daily Waste Cost</span>
                      <span className="text-xl font-bold text-white">ETB 2,050</span>
                  </div>
              </div>
           </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
