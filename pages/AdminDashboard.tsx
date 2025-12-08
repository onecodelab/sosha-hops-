import React, { useEffect, useState } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, 
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { MenuItem } from '../types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge, Dialog, showToast, cn } from '../components/ui';
import { 
  TrendingUp, TrendingDown, AlertTriangle, DollarSign, Clock, Users, 
  AlertCircle, ArrowUpRight, ArrowDownRight, Package, Utensils, 
  ClipboardList, Plus, Database, Search, FileText, UserPlus, Filter 
} from 'lucide-react';
import { MENU_SEED_DATA } from '../utils/seedData';

// --- Mock Data Generators for Visualization ---
const generateRevenueData = () => Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  revenue: Math.floor(Math.random() * 5000) + 1000,
  profit: Math.floor(Math.random() * 2000) + 500,
}));

const generateStaffData = () => [
  { name: 'Sarah', orders: 45, speed: 92, complaints: 0 },
  { name: 'Mike', orders: 38, speed: 78, complaints: 1 },
  { name: 'Jessica', orders: 52, speed: 95, complaints: 0 },
  { name: 'David', orders: 20, speed: 65, complaints: 2 },
];

const ORDER_TYPES = [
  { name: 'Dine-in', value: 65, color: '#217BF4' },
  { name: 'Takeaway', value: 25, color: '#FFB039' },
  { name: 'Delivery', value: 10, color: '#10B981' },
];

const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  
  // -- State --
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 145000,
    profit: 52000,
    cogs: 48000,
    orders: 342,
    aov: 424,
    wasteCost: 3200
  });
  
  // Menu Intelligence Data (Mocked but structured for the table)
  const [menuIntelligence, setMenuIntelligence] = useState<any[]>([]);
  const [inventoryAlerts, setInventoryAlerts] = useState<any[]>([]);
  
  // Modals & Actions
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    // Simulate fetching complex analytics
    setTimeout(() => {
      setMenuIntelligence([
        { id: 1, name: 'Special Burger', sales: 124, revenue: 55800, margin: 65, prepTime: 12, rating: 4.8, status: 'Star' },
        { id: 2, name: 'Truffle Pasta', sales: 98, revenue: 44100, margin: 72, prepTime: 18, rating: 4.9, status: 'Cash Cow' },
        { id: 3, name: 'Lobster Bisque', sales: 12, revenue: 5400, margin: 40, prepTime: 25, rating: 4.2, status: 'Problem' },
        { id: 4, name: 'Caesar Salad', sales: 85, revenue: 12750, margin: 80, prepTime: 5, rating: 4.5, status: 'Star' },
        { id: 5, name: 'Beef Wellington', sales: 8, revenue: 9600, margin: 30, prepTime: 45, rating: 3.5, status: 'Dog' },
      ]);

      setInventoryAlerts([
        { name: 'Premium Beef', stock: '2.5kg', status: 'critical', depletion: '4 hrs' },
        { name: 'Truffle Oil', stock: '1 Bottle', status: 'low', depletion: '1 day' },
        { name: 'Fresh Basil', stock: '0.5kg', status: 'waste_risk', depletion: 'Spoilage Risk' },
      ]);
      
      setLoading(false);
    }, 800);
  }, []);

  const handleSeedMenu = async () => {
    if (!confirm(`This will add demo items to the database. Continue?`)) return;
    setSeeding(true);
    try {
      await supabase.from('menu').insert(MENU_SEED_DATA);
      showToast('Seed data injected successfully');
    } catch (err: any) {
      showToast('Error seeding data', 'error');
    } finally {
      setSeeding(false);
    }
  };

  // --- Components ---

  const KpiCard = ({ title, value, sub, trend, alert }: any) => (
    <div className={cn(
      "bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between h-full relative overflow-hidden",
      alert && "border-l-4 border-l-red-500"
    )}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-muted uppercase tracking-wider">{title}</h3>
        {alert && <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />}
      </div>
      <div className="mt-2">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="flex items-center mt-1 gap-2">
           {trend > 0 ? <ArrowUpRight className="w-4 h-4 text-green-500"/> : <ArrowDownRight className="w-4 h-4 text-red-500"/>}
           <span className={cn("text-xs font-medium", trend > 0 ? "text-green-500" : "text-red-500")}>
             {Math.abs(trend)}% vs last week
           </span>
        </div>
        <p className="text-xs text-muted mt-2">{sub}</p>
      </div>
    </div>
  );

  return (
    <DashboardLayout 
      title="Owner Command Center" 
      subtitle="Operational control & financial signals"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSeedMenu} isLoading={seeding}>
            <Database className="w-4 h-4 mr-2"/> Seed Data
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsItemModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2"/> Add Item
          </Button>
          <Button variant="secondary" size="sm">
            <FileText className="w-4 h-4 mr-2"/> Reports
          </Button>
        </div>
      }
    >
      {/* 1. FINANCIAL HEALTH (Top Row) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard 
          title="Net Revenue (Today)" 
          value={`ETB ${stats.revenue.toLocaleString()}`} 
          trend={12.5} 
          sub="Projected: ETB 180k"
        />
        <KpiCard 
          title="Est. Daily Profit" 
          value={`ETB ${stats.profit.toLocaleString()}`} 
          trend={8.2} 
          sub={`Margin: ${((stats.profit/stats.revenue)*100).toFixed(1)}%`}
        />
        <KpiCard 
          title="Avg Order Value" 
          value={`ETB ${stats.aov}`} 
          trend={-2.4} 
          sub="Target: ETB 450"
        />
        <KpiCard 
          title="COGS Pressure" 
          value={`ETB ${stats.cogs.toLocaleString()}`} 
          trend={-5.1} 
          sub="Waste Alert: High Spoilage"
          alert={true}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* 2. REVENUE TRENDS (Chart) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-foreground">Revenue & Profit Velocity</h3>
              <p className="text-sm text-muted">Real-time hourly breakdown</p>
            </div>
            <Badge variant="outline">Peak: 1:00 PM</Badge>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={generateRevenueData()}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#217BF4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#217BF4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#217BF4" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                <Area type="monotone" dataKey="profit" stroke="#10B981" fillOpacity={1} fill="url(#colorProf)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. OPERATIONAL PULSE */}
        <div className="space-y-4">
          {/* Kitchen Load */}
          <Card className="border-l-4 border-l-yellow-500">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted uppercase flex justify-between">
                 Kitchen Load <FlameIcon load="high" />
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="flex items-end justify-between mb-2">
                 <span className="text-2xl font-bold text-foreground">85%</span>
                 <span className="text-sm text-yellow-500 font-medium">Heavy Load</span>
               </div>
               <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                 <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '85%' }}></div>
               </div>
               <p className="text-xs text-muted mt-2">Avg Prep Time: <span className="text-red-500 font-bold">24 min</span> (Target: 15)</p>
             </CardContent>
          </Card>

          {/* Table Turnover */}
          <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted uppercase">Table Turnover</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="flex items-end justify-between mb-2">
                 <span className="text-2xl font-bold text-foreground">42 min</span>
                 <span className="text-sm text-green-500 font-medium">Efficient</span>
               </div>
               <p className="text-xs text-muted">Rate: 1.2 turns / hour</p>
             </CardContent>
          </Card>

          {/* Order Breakdown */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
             <div className="h-20 w-20">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie data={ORDER_TYPES} innerRadius={15} outerRadius={35} paddingAngle={5} dataKey="value">
                     {ORDER_TYPES.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.color} />
                     ))}
                   </Pie>
                 </PieChart>
               </ResponsiveContainer>
             </div>
             <div className="flex-1 pl-4 text-xs space-y-1">
               {ORDER_TYPES.map(type => (
                 <div key={type.name} className="flex justify-between">
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{backgroundColor: type.color}} />
                      {type.name}
                    </span>
                    <span className="font-bold">{type.value}%</span>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        {/* 4. MENU INTELLIGENCE */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
           <div className="p-5 border-b border-border flex justify-between items-center">
             <div>
               <h3 className="font-bold text-foreground">Menu Performance Matrix</h3>
               <p className="text-sm text-muted">Profitability vs. Operational Cost</p>
             </div>
             <Button variant="ghost" size="sm"><Filter className="w-4 h-4"/></Button>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="bg-black/5 dark:bg-white/5 text-muted uppercase text-xs font-semibold">
                 <tr>
                   <th className="px-5 py-3">Item</th>
                   <th className="px-5 py-3 text-right">Margin</th>
                   <th className="px-5 py-3 text-right">Prep (min)</th>
                   <th className="px-5 py-3 text-right">Sales</th>
                   <th className="px-5 py-3">Signal</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-border">
                 {menuIntelligence.map((item) => (
                   <tr key={item.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                     <td className="px-5 py-3 font-medium text-foreground">{item.name}</td>
                     <td className="px-5 py-3 text-right">
                       <span className={cn(
                         "px-2 py-0.5 rounded text-xs font-bold",
                         item.margin > 60 ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                       )}>{item.margin}%</span>
                     </td>
                     <td className="px-5 py-3 text-right text-muted">
                        <span className={item.prepTime > 20 ? "text-red-500 font-bold" : ""}>{item.prepTime}</span>
                     </td>
                     <td className="px-5 py-3 text-right font-mono">ETB {(item.revenue / 1000).toFixed(1)}k</td>
                     <td className="px-5 py-3">
                       {item.status === 'Problem' && <Badge variant="destructive">Cut?</Badge>}
                       {item.status === 'Star' && <Badge variant="success">Promote</Badge>}
                       {item.status === 'Dog' && <Badge variant="outline" className="text-muted-foreground">Review</Badge>}
                       {item.status === 'Cash Cow' && <Badge variant="warning">Keep</Badge>}
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>

        {/* 5. ACTION CENTER & ALERTS */}
        <div className="space-y-6">
          
          {/* Inventory Alerts */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-5">
             <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
               <AlertCircle className="w-4 h-4 text-red-500" /> 
               Critical Inventory Signals
             </h3>
             <div className="space-y-3">
               {inventoryAlerts.map((alert, i) => (
                 <div key={i} className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-card rounded-md border border-border">
                         <Package className="w-4 h-4 text-muted" />
                       </div>
                       <div>
                         <p className="text-sm font-bold text-foreground">{alert.name}</p>
                         <p className="text-xs text-red-500">Depletion: {alert.depletion}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-mono font-bold text-foreground">{alert.stock}</p>
                       <Button size="sm" variant="outline" className="h-6 text-xs mt-1">Restock</Button>
                    </div>
                 </div>
               ))}
             </div>
          </div>

          {/* Staff Performance */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-5">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-foreground">Staff Velocity</h3>
                <span className="text-xs text-muted">Orders / Speed Index</span>
             </div>
             <div className="space-y-4">
               {generateStaffData().map((staff) => (
                 <div key={staff.name}>
                   <div className="flex justify-between text-xs mb-1">
                     <span className="font-medium text-foreground">{staff.name}</span>
                     <span className={cn(
                       "font-bold",
                       staff.speed < 80 ? "text-red-500" : "text-green-500"
                     )}>Speed: {staff.speed}</span>
                   </div>
                   <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5">
                     <div 
                       className={cn("h-1.5 rounded-full", staff.speed < 80 ? "bg-red-500" : "bg-primary")} 
                       style={{ width: `${staff.speed}%` }}
                     ></div>
                   </div>
                   {staff.complaints > 0 && (
                     <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                       <AlertTriangle className="w-3 h-3"/> {staff.complaints} Customer Complaint(s) today
                     </p>
                   )}
                 </div>
               ))}
             </div>
          </div>

        </div>
      </div>
      
      <Dialog isOpen={isItemModalOpen} onClose={() => setIsItemModalOpen(false)} title="Add Menu Item">
        <p className="text-muted">Form placeholder for adding items...</p>
      </Dialog>
    </DashboardLayout>
  );
};

// Helper for visual flare
const FlameIcon = ({ load }: { load: string }) => {
  const color = load === 'high' ? 'text-red-500' : 'text-green-500';
  return <div className={`flex gap-0.5 ${color}`}><div className="w-1 h-3 bg-current rounded-full animate-bounce"/><div className="w-1 h-4 bg-current rounded-full animate-bounce delay-75"/><div className="w-1 h-2 bg-current rounded-full animate-bounce delay-150"/></div>
}

export default AdminDashboard;