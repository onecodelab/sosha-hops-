import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, cn, showToast } from '../components/ui';
import { 
  Search, AlertTriangle, Package, TrendingDown, Truck, 
  Calendar, DollarSign, RefreshCw, AlertOctagon, ArrowRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabase';

const Inventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
     setLoading(true);
     const { data, error } = await supabase.from('inventory').select('*').order('name');
     if (error) {
        showToast("Failed to fetch inventory", "error");
     } else {
        setIngredients(data || []);
     }
     setLoading(false);
  };

  // --- Derived Metrics from Real Data ---

  // 1. Total Value
  const totalValue = ingredients.reduce((acc, item) => acc + (item.quantity * item.cost_per_unit), 0);
  
  // 2. Critical Items
  const criticalItems = ingredients.filter(i => {
     // If unit is kg/L, treat quantity as float. Par level is simple number.
     // Simple logic: if qty < par_level * 0.3 => Critical
     return i.status === 'critical' || i.quantity < (i.par_level * 0.3);
  });

  // 3. Reorder Suggestions (Low or Critical)
  const reorderSuggestions = ingredients
    .filter(i => i.status === 'low' || i.status === 'critical' || i.quantity < i.par_level)
    .map(i => ({
      ...i,
      suggestedQty: Math.max(0, Math.ceil((i.par_level * 1.5) - i.quantity)), // Order to reach 1.5x par
    }));

  // --- Static/Mock Data for UI Elements not yet in DB ---
  const inventoryStats = {
    dailyWaste: 2050,
    wasteTrend: +12, // percent up from avg
  };

  const expiryItems = [
    { name: "Milk (Whole)", days: 2, qty: "10 L" },
    { name: "Chicken Breast", days: 3, qty: "5 kg" },
  ];

  const varianceData = [
    { name: 'Beef', expected: 15, actual: 12, variance: -3 },
    { name: 'Coffee', expected: 3, actual: 2, variance: -1 },
  ];

  // --- Helpers ---

  const getStatusColor = (status: string, quantity: number, par: number) => {
    // Override DB status if we detect low stock
    if (quantity <= 0) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (quantity < par * 0.3) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (quantity < par) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';

    switch (status) {
      case 'ok': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'low': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const filteredIngredients = ingredients.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (i.location && i.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Inventory Management</h1>
            <p className="text-gray-400 text-sm">Stock tracking from real-time database</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:text-white" onClick={fetchInventory}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Sync
            </Button>
            <Button>
              <Package className="w-4 h-4 mr-2" /> Add Item
            </Button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Value Snapshot */}
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-6">
                <div className="flex justify-between items-start">
                   <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Value</p>
                      <h3 className="text-2xl font-bold text-white mt-1">ETB {totalValue.toLocaleString()}</h3>
                   </div>
                   <div className="p-2 bg-primary/10 rounded-full">
                      <DollarSign className="w-5 h-5 text-primary" />
                   </div>
                </div>
                <div className="mt-4 flex items-center text-xs">
                   <span className="text-gray-500">Calculated from {ingredients.length} items</span>
                </div>
             </CardContent>
          </Card>

          {/* Waste Tracking (Static for demo) */}
          <Card className="bg-[#1A1A1A] border-gray-800">
             <CardContent className="p-6">
                <div className="flex justify-between items-start">
                   <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Today's Waste</p>
                      <h3 className="text-2xl font-bold text-white mt-1">ETB {inventoryStats.dailyWaste.toLocaleString()}</h3>
                   </div>
                   <div className="p-2 bg-red-500/10 rounded-full">
                      <AlertOctagon className="w-5 h-5 text-red-500" />
                   </div>
                </div>
                <div className="mt-4 flex items-center text-xs">
                   <span className="text-red-400 flex items-center font-bold">
                      +{inventoryStats.wasteTrend}%
                   </span>
                   <span className="text-gray-500 ml-2">above avg</span>
                </div>
             </CardContent>
          </Card>

          {/* Critical Items Forecast */}
          <Card className="bg-[#1A1A1A] border-gray-800 md:col-span-2">
             <CardHeader className="py-4 border-b border-gray-800">
                <CardTitle className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                   <AlertTriangle className="w-4 h-4 text-primary" /> Low Stock Alerts
                </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <div className="divide-y divide-gray-800 max-h-[140px] overflow-y-auto">
                   {criticalItems.length === 0 && <p className="p-4 text-sm text-gray-500">Stock levels look good.</p>}
                   {criticalItems.map(i => (
                         <div key={i.id} className="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                               <div>
                                  <p className="font-bold text-white text-sm">{i.name}</p>
                                  <p className="text-xs text-gray-500">{i.quantity} {i.unit} remaining</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-sm font-bold text-red-500">Below Par</p>
                               <p className="text-xs text-gray-500">Par: {i.par_level}</p>
                            </div>
                         </div>
                      ))}
                </div>
             </CardContent>
          </Card>

        </div>

        {/* Middle Section: Stock Table & Expiry */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
           
           {/* Current Stock Table */}
           <Card className="xl:col-span-2 bg-[#1A1A1A] border-gray-800 flex flex-col h-[600px]">
              <CardHeader className="flex flex-row items-center justify-between py-5 border-b border-gray-800">
                 <CardTitle className="text-white">Current Stock</CardTitle>
                 <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                    <Input 
                      placeholder="Search ingredients..." 
                      className="pl-9 bg-black/20 border-gray-700 focus:border-primary/50" 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-black/20 sticky top-0 backdrop-blur-sm z-10">
                       <tr>
                          <th className="px-6 py-4">Ingredient</th>
                          <th className="px-6 py-4">Quantity</th>
                          <th className="px-6 py-4">Location</th>
                          <th className="px-6 py-4">Est. Value</th>
                          <th className="px-6 py-4 text-center">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                       {filteredIngredients.length === 0 && (
                          <tr><td colSpan={5} className="p-8 text-center text-gray-500">No ingredients found. Try seeding data in Settings.</td></tr>
                       )}
                       {filteredIngredients.map((item) => (
                          <tr key={item.id} className="hover:bg-white/5 transition-colors">
                             <td className="px-6 py-4 font-medium text-white">
                                {item.name}
                                <div className="text-xs text-gray-500 font-normal">{item.supplier}</div>
                             </td>
                             <td className="px-6 py-4 text-gray-300">
                                {item.quantity} <span className="text-gray-500 text-xs">{item.unit}</span>
                                <div className="text-xs text-gray-600">Par: {item.par_level}</div>
                             </td>
                             <td className="px-6 py-4 text-gray-400">{item.location || '-'}</td>
                             <td className="px-6 py-4 text-gray-300">ETB {(item.quantity * item.cost_per_unit).toLocaleString()}</td>
                             <td className="px-6 py-4 text-center">
                                <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold border", getStatusColor(item.status, item.quantity, item.par_level))}>
                                   {item.quantity < item.par_level ? 'LOW' : 'OK'}
                                </span>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </CardContent>
           </Card>

           {/* Right Column: Expiry & Variance */}
           <div className="space-y-6">
              
              {/* Expiry Tracking */}
              <Card className="bg-[#1A1A1A] border-gray-800">
                 <CardHeader className="pb-3">
                    <CardTitle className="text-white flex items-center gap-2">
                       <Calendar className="w-5 h-5 text-orange-400" /> Expiry Alerts
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    {expiryItems.map((item, i) => (
                       <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                          <div>
                             <p className="font-bold text-gray-200 text-sm">{item.name}</p>
                             <p className="text-xs text-gray-500">{item.qty} in stock</p>
                          </div>
                          <div className="text-right">
                             <p className="text-sm font-bold text-orange-400">{item.days} Days</p>
                             <p className="text-[10px] text-gray-500 uppercase">Remaining</p>
                          </div>
                       </div>
                    ))}
                 </CardContent>
              </Card>

              {/* Variance Widget */}
              <Card className="bg-[#1A1A1A] border-gray-800">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm uppercase tracking-wider">Stock Variance (Audit)</CardTitle>
                 </CardHeader>
                 <CardContent>
                    <div className="h-[200px] w-full">
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={varianceData} layout="vertical" margin={{ left: 10, right: 10 }}>
                             <XAxis type="number" hide />
                             <YAxis dataKey="name" type="category" width={50} tick={{fill: '#6b7280', fontSize: 12}} />
                             <Tooltip 
                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', color: '#fff' }}
                             />
                             <Bar dataKey="expected" fill="#333" radius={[0, 4, 4, 0]} barSize={12} name="Expected" />
                             <Bar dataKey="variance" fill="#EF4444" radius={[4, 0, 0, 4]} barSize={12} name="Missing" />
                          </BarChart>
                       </ResponsiveContainer>
                    </div>
                 </CardContent>
              </Card>

           </div>
        </div>

        {/* Bottom Section: Auto-Reorder */}
        <Card className="bg-[#1A1A1A] border-gray-800">
           <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                 <Truck className="w-5 h-5 text-blue-400" /> Smart Reorder Suggestions
              </CardTitle>
           </CardHeader>
           <CardContent>
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800">
                       <tr>
                          <th className="px-4 py-3">Supplier</th>
                          <th className="px-4 py-3">Ingredient</th>
                          <th className="px-4 py-3">Current</th>
                          <th className="px-4 py-3">Suggested Order</th>
                          <th className="px-4 py-3">Est. Cost</th>
                          <th className="px-4 py-3 text-right">Action</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                       {reorderSuggestions.map(item => (
                          <tr key={item.id} className="hover:bg-white/5 transition-colors">
                             <td className="px-4 py-3 font-medium text-blue-400">{item.supplier}</td>
                             <td className="px-4 py-3 text-white">{item.name}</td>
                             <td className="px-4 py-3 text-gray-400">{item.quantity} {item.unit}</td>
                             <td className="px-4 py-3 text-primary font-bold">{item.suggestedQty} {item.unit}</td>
                             <td className="px-4 py-3 text-gray-300">ETB {(item.suggestedQty * item.cost_per_unit).toLocaleString()}</td>
                             <td className="px-4 py-3 text-right">
                                <Button size="sm" className="h-8">
                                   Order <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                             </td>
                          </tr>
                       ))}
                       {reorderSuggestions.length === 0 && (
                          <tr><td colSpan={6} className="p-4 text-center text-gray-500">No reorders needed.</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default Inventory;