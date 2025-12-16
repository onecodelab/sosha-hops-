
import React, { useEffect, useState } from 'react';
import { 
  AreaChart, Area, ResponsiveContainer, 
  BarChart, Bar, XAxis, Tooltip
} from 'recharts';
import { DashboardLayout } from '../components/DashboardLayout';
import { SoshaCard, SoshaCardTitle } from '../components/SoshaCard';
import { BestDishCard } from '../components/BestDishCard';
import { 
  TrendingUp, TrendingDown, Users, 
  ShoppingBag, ChefHat, Utensils, AlertOctagon, AlertTriangle, RefreshCw
} from 'lucide-react';
import { cn } from '../components/ui';
import { supabase } from '../supabase';
import { useLanguage } from '../contexts/LanguageContext';

const KPICard = ({ title, value, subtext, trend, trendValue, icon: Icon, chartData, color = "primary", loading }: any) => {
    const isPositive = trend === 'up';
    const trendColor = isPositive ? 'text-[#84CC16]' : 'text-red-500';
    const trendBg = isPositive ? 'bg-[#84CC16]/10' : 'bg-red-500/10';
    const TrendIcon = isPositive ? TrendingUp : TrendingDown;
    
    // Color mapping
    const accentColor = color === 'primary' ? '#FFB800' : color === 'success' ? '#84CC16' : color === 'danger' ? '#EF4444' : '#3B82F6';
    const glowColor = color === 'primary' ? 'yellow' : color === 'success' ? 'green' : color === 'danger' ? 'red' : 'blue';

    return (
        <SoshaCard indicatorColor={glowColor as any} className="h-full flex flex-col justify-between">
             <div className="flex justify-between items-start mb-2 relative z-10">
               <div>
                  <p className="text-xs font-bold text-muted uppercase tracking-wider">{title}</p>
                  {loading ? (
                    <div className="h-8 w-24 bg-gray-800 rounded animate-pulse mt-1" />
                  ) : (
                    <h3 className="text-3xl font-bold text-foreground mt-2 tracking-tight">{value}</h3>
                  )}
               </div>
               <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5", `bg-[${accentColor}]/10`)}>
                  <Icon className="w-6 h-6" style={{ color: accentColor }} />
               </div>
            </div>
            
            <div className="flex-1 min-h-[40px] relative z-10 flex items-end my-4">
                {chartData ? (
                    <div className="w-full h-[60px]">
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
                    <p className="text-sm font-medium text-muted">{subtext}</p>
                )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
               <div className={cn("flex items-center text-xs font-bold px-2.5 py-1.5 rounded-lg border border-white/5", trendColor, trendBg)}>
                  <TrendIcon className="w-3 h-3 mr-1.5" /> {trendValue}
               </div>
               <span className="text-[10px] text-muted font-bold uppercase tracking-wider">vs Yesterday</span>
            </div>
        </SoshaCard>
    );
};

const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ revenue: 0, orders: 0, inventoryCritical: 0, staffActive: 0 });
  const [tableStatus, setTableStatus] = useState<Record<string, { status: string, elapsed: number }>>({});

  useEffect(() => {
    fetchDashboardData();
    const channels = [
        supabase.channel('admin_orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDashboardData()),
        supabase.channel('admin_inventory').on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => fetchDashboardData()),
    ];
    channels.forEach(c => c.subscribe());
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, []);

  const fetchDashboardData = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        
        const { data: todayOrders } = await supabase.from('orders').select('total_amount, status, created_at').gte('created_at', `${todayStr}T00:00:00`);
        let rev = 0, count = 0;
        if (todayOrders) {
            count = todayOrders.length;
            rev = todayOrders.filter(o => o.status !== 'cancelled').reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
        }

        const { data: inventory } = await supabase.from('inventory').select('quantity, par_level');
        let critical = 0;
        if (inventory) critical = inventory.filter((i: any) => i.quantity <= (i.par_level || 0)).length;

        const { count: staffCount } = await supabase.from('users').select('*', { count: 'exact', head: true });

        const { data: activeOrders } = await supabase.from('orders').select('table_no, created_at').not('status', 'in', '("paid","cancelled")');
        const tStatus: Record<string, { status: string, elapsed: number }> = {};
        const now = new Date();

        if (activeOrders) {
            activeOrders.forEach((o: any) => {
                const created = new Date(o.created_at);
                const elapsed = Math.floor((now.getTime() - created.getTime()) / 60000);
                const tNo = o.table_no.toString().replace(/^T/i, ''); 
                tStatus[tNo] = { status: 'occupied', elapsed };
            });
        }

        setStats({ revenue: rev, orders: count, inventoryCritical: critical, staffActive: staffCount || 0 });
        setTableStatus(tStatus);
      } catch (err) { console.error("Dashboard fetch error:", err); } finally { setLoading(false); }
  };

  const revenueChartData = [{ value: 4000 }, { value: 3000 }, { value: 9800 }, { value: 8780 }, { value: 5890 }, { value: 4390 }, { value: 6490 }, { value: 8490 }, { value: 11490 }];
  const kitchenData = [
    { name: 'Appetizers', active: 12, delayed: 1 },
    { name: 'Main Course', active: 28, delayed: 4 },
    { name: 'Desserts', active: 5, delayed: 0 },
    { name: 'Drinks', active: 8, delayed: 0 },
  ];
  
  const activeTablesCount = Object.keys(tableStatus).length;

  return (
    <DashboardLayout title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} 
      actions={
         <div className="flex items-center gap-3">
             <div className="text-right hidden md:block px-4 py-2 bg-card/50 rounded-xl border border-border backdrop-blur-sm">
                <p className="text-[10px] text-muted uppercase tracking-widest font-bold">Current Shift</p>
                <p className="text-sm font-bold text-foreground">Manager: <span className="text-primary">Sarah J.</span></p>
             </div>
             <button onClick={fetchDashboardData} className="p-3 bg-card border border-border rounded-xl hover:bg-white/10 text-muted hover:text-white transition-colors">
                <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
             </button>
         </div>
      }
    >
      <div className="space-y-8">
        
        {/* 1. KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <KPICard title={t('dashboard.kpi.revenue')} value={`ETB ${stats.revenue.toLocaleString()}`} trend="up" trendValue="+12.5%" icon={Utensils} chartData={revenueChartData} color="primary" loading={loading} />
          <KPICard title={t('dashboard.kpi.orders')} value={`${stats.orders} Orders`} subtext="Peak: 1pm - 2pm" trend="up" trendValue="18 orders/hr" icon={ShoppingBag} color="success" loading={loading} />
          <KPICard title={t('dashboard.kpi.inventory')} value={`${stats.inventoryCritical} ${t('dashboard.kpi.critical')}`} subtext="Items below Par Level" trend="down" trendValue="Needs Restock" icon={AlertOctagon} color="danger" loading={loading} />
          <KPICard title={t('dashboard.kpi.staff')} value={`${stats.staffActive} ${t('dashboard.kpi.active')}`} subtext="Registered Users" trend="up" trendValue="100% Coverage" icon={Users} color="info" loading={loading} />
        </div>

        {/* 2. Middle Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Kitchen Status */}
          <SoshaCard className="lg:col-span-2" indicatorColor="orange">
             <div className="flex justify-between items-center mb-6">
                <div>
                    <SoshaCardTitle className="flex items-center gap-2">
                        <ChefHat className="w-5 h-5 text-primary" /> {t('dashboard.kitchenStatus')}
                    </SoshaCardTitle>
                    <p className="text-xs text-muted mt-1">Active dishes and delay monitoring</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted uppercase font-bold">{t('dashboard.avgPrepTime')}</p>
                    <p className="text-2xl font-bold text-foreground font-mono tracking-tight">18m <span className="text-sm text-red-400 font-medium">(+3m)</span></p>
                </div>
             </div>

             <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={kitchenData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <XAxis type="number" hide />
                      <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px' }} />
                      <Bar dataKey="active" stackId="a" fill="#333" radius={[0, 4, 4, 0]} barSize={24} name="Active Orders" />
                      <Bar dataKey="delayed" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={24} name="Delayed" />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </SoshaCard>

          {/* Best Dish Card (Replaced Health Score) */}
          <BestDishCard 
            name="Grilled Salmon Salad"
            category="Signature Dish"
            totalOrders={142}
            rating={4.9}
            revenueShare={24}
            imageUrl="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80"
          />
        </div>

        {/* 3. Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <SoshaCard>
              <div className="flex justify-between items-center mb-6">
                 <SoshaCardTitle>{t('dashboard.tableService')}</SoshaCardTitle>
                 <span className="text-xs font-bold bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/5">
                    {activeTablesCount}/28 {t('dashboard.occupied')}
                 </span>
              </div>
              
              <div className="grid grid-cols-7 gap-3">
                 {Array.from({length: 28}).map((_, i) => {
                     const tNum = (i + 1).toString();
                     const info = tableStatus[tNum];
                     const isOccupied = !!info;
                     const isLongWait = info?.elapsed > 45;

                     let statusColor = 'border border-border text-muted hover:bg-white/5 hover:border-white/20'; 
                     if (isOccupied) {
                         if (isLongWait) statusColor = 'bg-red-500 text-white font-bold border-none shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse';
                         else statusColor = 'bg-white/20 text-white font-bold border-none';
                     }

                     return (
                         <div key={i} className={cn("aspect-square rounded-xl flex items-center justify-center text-xs transition-all relative group cursor-default", statusColor)}>
                             {tNum}
                         </div>
                     )
                 })}
              </div>
           </SoshaCard>

           <SoshaCard indicatorColor="red">
              <SoshaCardTitle className="mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" /> {t('dashboard.lossIndicators')}
              </SoshaCardTitle>
              
              <div className="space-y-4">
                  {[{i:Utensils, t:t('dashboard.remadeDishes'), s:'2 items sent back', v:'- ETB 850'}, {i:AlertOctagon, t:t('dashboard.canceledOrders'), s:'4 orders canceled', v:'- ETB 1,200'}].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors">
                          <div className="flex items-center gap-4">
                              <div className="p-3 bg-red-500/10 rounded-xl text-red-500"><item.i className="w-5 h-5" /></div>
                              <div>
                                  <p className="text-sm font-bold text-foreground">{item.t}</p>
                                  <p className="text-xs text-muted">{item.s}</p>
                              </div>
                          </div>
                          <span className="text-red-500 font-bold font-mono">{item.v}</span>
                      </div>
                  ))}
                  
                  <div className="pt-4 flex justify-between items-center border-t border-white/5 mt-4">
                      <span className="text-sm text-muted font-medium">{t('dashboard.estWaste')}</span>
                      <span className="text-xl font-bold text-foreground tracking-tight">ETB 2,050</span>
                  </div>
              </div>
           </SoshaCard>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
