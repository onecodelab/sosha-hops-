import React, { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, cn } from '../components/ui';
import { 
  Search, AlertTriangle, Package, TrendingDown, Truck, 
  Calendar, DollarSign, RefreshCw, AlertOctagon, ArrowRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const Inventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // --- Mock Data ---

  const inventoryStats = {
    totalValue: 125430,
    valueTrend: -2.5, // percent
    dailyWaste: 2050,
    wasteTrend: +12, // percent up from avg
  };

  const ingredients = [
    { id: 1, name: "Beef Fillet", quantity: 12, unit: "kg", par: 15, location: "Freezer A", status: "low", cost: 850, usage: 3.5, supplier: "Meat Masters Ltd" },
    { id: 2, name: "Avocados", quantity: 45, unit: "pcs", par: 30, location: "Pantry", status: "ok", cost: 25, usage: 12, supplier: "Fresh Greens" },
    { id: 3, name: "Cheddar Cheese", quantity: 0.5, unit: "kg", par: 5, location: "Fridge 2", status: "critical", cost: 1200, usage: 0.8, supplier: "Dairy King" },
    { id: 4, name: "Burger Buns", quantity: 120, unit: "pcs", par: 100, location: "Pantry", status: "ok", cost: 15, usage: 40, supplier: "City Bakery" },
    { id: 5, name: "Tomatoes", quantity: 8, unit: "kg", par: 10, location: "Fridge 1", status: "low", cost: 60, usage: 2.5, supplier: "Fresh Greens" },
    { id: 6, name: "Espresso Beans", quantity: 2, unit: "kg", par: 10, location: "Bar Shelf", status: "critical", cost: 1800, usage: 0.9, supplier: "Tomoca" },
    { id: 7, name: "Olive Oil", quantity: 15, unit: "L", par: 5, location: "Pantry", status: "ok", cost: 800, usage: 0.2, supplier: "Global Imports" },
  ];

  const expiryItems = [
    { name: "Milk (Whole)", days: 2, qty: "10 L" },
    { name: "Chicken Breast", days: 3, qty: "5 kg" },
    { name: "Yogurt", days: 6, qty: "4 kg" },
    { name: "Lettuce", days: 7, qty: "12 heads" },
  ];

  const varianceData = [
    { name: 'Beef', expected: 15, actual: 12, variance: -3 },
    { name: 'Coffee', expected: 3, actual: 2, variance: -1 },
    { name: 'Cheese', expected: 1, actual: 0.5, variance: -0.5 },
  ];

  const reorderSuggestions = ingredients
    .filter(i => i.status === 'low' || i.status === 'critical')
    .map(i => ({
      ...i,
      suggestedQty: Math.ceil((i.par * 1.5) - i.quantity), // Order enough to reach 1.5x par
    }));

  // --- Helpers ---

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'low': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getDepletionDays = (qty: number, usage: number) => {
    if (usage === 0) return 999;
    return Math.floor(qty / usage);
  };

  const filteredIngredients = ingredients.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Inventory Management</h1>
            <p className="text-gray-400 text-sm">Stock tracking, expiry alerts, and smart reordering</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:text-white">
              <RefreshCw className="w-4 h-4 mr-2" /> Sync
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
                      <h3 className="text-2xl font-bold text-white mt-1">ETB {inventoryStats.totalValue.toLocaleString()}</h3>
                   </div>
                   <div className="p-2 bg-primary/10 rounded-full">
                      <DollarSign className="w-5 h-5 text-primary" />
                   </div>
                </div>
                <div className="mt-4 flex items-center text-xs">
                   <span className="text-red-400 flex items-center font-bold">
                      <TrendingDown className="w-3 h-3 mr-1" /> {Math.abs(inventoryStats.valueTrend)}%
                   </span>
                   <span className="text-gray-500 ml-2">vs last week</span>
                </div>
             </CardContent>
          </Card>

          {/* Waste Tracking */}
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
                   <AlertTriangle className="w-4 h-4 text-primary" /> Critical Low Stock (Empty in &lt; 3 Days)
                </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <div className="divide-y divide-gray-800">
                   {ingredients
                      .filter(i => getDepletionDays(i.quantity, i.usage) < 3)
                      .map(i => (
                         <div key={i.id} className="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                               <div>
                                  <p className="font-bold text-white text-sm">{i.name}</p>
                                  <p className="text-xs text-gray-500">{i.quantity} {i.unit} remaining</p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-sm font-bold text-primary">{getDepletionDays(i.quantity, i.usage) === 0 ? 'Today' : `${getDepletionDays(i.quantity, i.usage)} Days`}</p>
                               <p className="text-xs text-gray-500">Depletion Forecast</p>
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
                          <th className="px-6 py-4">Usage (Daily)</th>
                          <th className="px-6 py-4 text-center">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                       {filteredIngredients.map((item) => (
                          <tr key={item.id} className="hover:bg-white/5 transition-colors">
                             <td className="px-6 py-4 font-medium text-white">
                                {item.name}
                                <div className="text-xs text-gray-500 font-normal">{item.supplier}</div>
                             </td>
                             <td className="px-6 py-4 text-gray-300">
                                {item.quantity} <span className="text-gray-500 text-xs">{item.unit}</span>
                                <div className="text-xs text-gray-600">Par: {item.par}</div>
                             </td>
                             <td className="px-6 py-4 text-gray-400">{item.location}</td>
                             <td className="px-6 py-4 text-gray-300">~{item.usage} {item.unit}</td>
                             <td className="px-6 py-4 text-center">
                                <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold border", getStatusColor(item.status))}>
                                   {item.status === 'critical' ? 'OUT / CRITICAL' : item.status.toUpperCase()}
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
                    <div className="text-xs text-center text-gray-500 mt-2">
                       Significant discrepancy in <span className="text-red-400">Beef Fillet</span> (-3kg)
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
                             <td className="px-4 py-3 text-gray-300">ETB {(item.suggestedQty * item.cost).toLocaleString()}</td>
                             <td className="px-4 py-3 text-right">
                                <Button size="sm" className="h-8">
                                   Order <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                             </td>
                          </tr>
                       ))}
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
