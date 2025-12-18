
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
     // Option 1: Use Menu as Inventory Source
     // We map menu items to the structure expected by the inventory UI
     const { data, error } = await supabase
        .from('menu')
        .select('*')
        .order('stock_quantity', { ascending: true }); // Show low stock first

     if (error) {
        showToast("Failed to fetch inventory data", "error");
     } else {
        const mappedItems = (data || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            quantity: item.stock_quantity || 0,
            unit: 'units', 
            location: 'Main Kitchen', 
            // Using Sales Price as proxy for value since cost isn't in menu table yet
            cost_per_unit: item.price, 
            par_level: 10, // Default threshold
            supplier: 'Central Kitchen',
            // Determine status based on stock level
            status: (item.stock_quantity || 0) <= 0 ? 'critical' : (item.stock_quantity || 0) <= 10 ? 'low' : 'ok'
        }));
        setIngredients(mappedItems);
     }
     setLoading(false);
  };

  // --- Derived Metrics from Real Data ---

  // 1. Total Value (Estimated based on sales price * stock)
  const totalValue = ingredients.reduce((acc, item) => acc + (item.quantity * item.cost_per_unit), 0);
  
  // 2. Critical Items (Stock <= 10)
  const criticalItems = ingredients.filter(i => (i.quantity || 0) <= 10);

  // 3. Reorder Suggestions (Low or Critical)
  const reorderSuggestions = ingredients
    .filter(i => i.status === 'low' || i.status === 'critical' || i.quantity <= i.par_level)
    .slice(0, 10) // Limit to top 10 for display
    .map(i => ({
      ...i,
      suggestedQty: Math.max(0, Math.ceil((i.par_level * 2) - i.quantity)), // Order to reach 2x par
    }));

  // --- Static/Mock Data for UI Elements not yet in DB ---
  const inventoryStats = {
    dailyWaste: 0, // Not tracked in menu table
    wasteTrend: 0, 
  };

  const expiryItems = [
    { name: "Fresh Milk", days: 2, qty: "5 L" }, // Mock data preserved
    { name: "Sliced Cheese", days: 3, qty: "2 kg" },
  ];

  const varianceData = [
    { name: 'Stock Check', expected: 100, actual: 98, variance: -2 },
  ];

  // --- Helpers ---

  const getStatusColor = (status: string, quantity: number, par: number) => {
    if (quantity <= 0) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (quantity <= 10) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';

    return 'bg-green-500/10 text-green-500 border-green-500/20';
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
            <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
            <p className="text-muted text-sm">Tracking menu item availability & stock levels</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-border text-muted hover:text-white" onClick={fetchInventory}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Sync
            </Button>
            {/* Future: Add Stock Adjustment Modal */}
            <Button disabled className="opacity-50 cursor-not-allowed">
              <Package className="w-4 h-4 mr-2" /> Adjust Stock
            </Button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Value Snapshot */}
          <Card>
             <CardContent className="p-6">
                <div className="flex justify-between items-start">
                   <div>
                      <p className="text-xs font-bold text-muted uppercase tracking-wider">Total Stock Value</p>
                      <h3 className="text-2xl font-bold text-foreground mt-1">ETB {totalValue.toLocaleString()}</h3>
                   </div>
                   <div className="p-2 bg-primary/10 rounded-full">
                      <DollarSign className="w-5 h-5 text-primary" />
                   </div>
                </div>
                <div className="mt-4 flex items-center text-xs">
                   <span className="text-muted">Estimated (Retail Price)</span>
                </div>
             </CardContent>
          </Card>

          {/* Item Count */}
          <Card>
             <CardContent className="p-6">
                <div className="flex justify-between items-start">
                   <div>
                      <p className="text-xs font-bold text-muted uppercase tracking-wider">Tracked Items</p>
                      <h3 className="text-2xl font-bold text-foreground mt-1">{ingredients.length}</h3>
                   </div>
                   <div className="p-2 bg-blue-500/10 rounded-full">
                      <Package className="w-5 h-5 text-blue-500" />
                   </div>
                </div>
                <div className="mt-4 flex items-center text-xs">
                   <span className="text-muted">From Menu</span>
                </div>
             </CardContent>
          </Card>

          {/* Critical Items Forecast */}
          <Card className="md:col-span-2">
             <CardHeader className="py-4 border-b border-border">
                <CardTitle className="text-sm font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                   <AlertTriangle className="w-4 h-4 text-primary" /> Low Stock Alerts (≤ 10)
                </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <div className="divide-y divide-border max-h-[140px] overflow-y-auto custom-scrollbar">
                   {criticalItems.length === 0 && <p className="p-4 text-sm text-muted">Stock levels look good.</p>}
                   {criticalItems.map(i => (
                         <div key={i.id} className="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3">
                               <div className={cn("w-2 h-2 rounded-full animate-pulse", i.quantity === 0 ? "bg-red-500" : "bg-yellow-500")} />
                               <div>
                                  <p className="font-bold text-foreground text-sm">{i.name}</p>
                                  <p className="text-xs text-muted">{i.quantity} units remaining</p>
                                </div>
                            </div>
                            <div className="text-right">
                               <p className={cn("text-sm font-bold", i.quantity === 0 ? "text-red-500" : "text-yellow-500")}>
                                  {i.quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                               </p>
                               <p className="text-xs text-muted">Par: 10</p>
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
           <Card className="xl:col-span-2 flex flex-col h-[600px]">
              <CardHeader className="flex flex-row items-center justify-between py-5 border-b border-border">
                 <CardTitle className="text-foreground">Current Inventory</CardTitle>
                 <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                    <Input 
                      placeholder="Search items..." 
                      className="pl-9 bg-black/20 border-border focus:border-primary/50" 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-auto custom-scrollbar">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted uppercase bg-black/20 sticky top-0 backdrop-blur-sm z-10">
                       <tr>
                          <th className="px-6 py-4">Item Name</th>
                          <th className="px-6 py-4">Stock Level</th>
                          <th className="px-6 py-4">Location</th>
                          <th className="px-6 py-4">Est. Value</th>
                          <th className="px-6 py-4 text-center">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                       {loading && (
                          <tr><td colSpan={5} className="p-8 text-center text-muted">Loading inventory...</td></tr>
                       )}
                       {!loading && filteredIngredients.length === 0 && (
                          <tr><td colSpan={5} className="p-8 text-center text-muted">No menu items found.</td></tr>
                       )}
                       {filteredIngredients.map((item) => (
                          <tr key={item.id} className="hover:bg-white/5 transition-colors">
                             <td className="px-6 py-4 font-medium text-foreground">
                                {item.name}
                                <div className="text-xs text-muted font-normal">{item.supplier}</div>
                             </td>
                             <td className="px-6 py-4 text-gray-300">
                                {item.quantity} <span className="text-muted text-xs">units</span>
                             </td>
                             <td className="px-6 py-4 text-gray-400">{item.location}</td>
                             <td className="px-6 py-4 text-gray-300">ETB {(item.quantity * item.cost_per_unit).toLocaleString()}</td>
                             <td className="px-6 py-4 text-center">
                                <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold border", getStatusColor(item.status, item.quantity, item.par_level))}>
                                   {item.quantity === 0 ? 'EMPTY' : item.quantity <= 10 ? 'LOW' : 'GOOD'}
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
              
              {/* Expiry Tracking (Mock) */}
              <Card>
                 <CardHeader className="pb-3">
                    <CardTitle className="text-foreground flex items-center gap-2">
                       <Calendar className="w-5 h-5 text-orange-400" /> Expiry Alerts
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    {expiryItems.map((item, i) => (
                       <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                          <div>
                             <p className="font-bold text-gray-200 text-sm">{item.name}</p>
                             <p className="text-xs text-muted">{item.qty} in stock</p>
                          </div>
                          <div className="text-right">
                             <p className="text-sm font-bold text-orange-400">{item.days} Days</p>
                             <p className="text-[10px] text-muted uppercase">Remaining</p>
                          </div>
                       </div>
                    ))}
                 </CardContent>
              </Card>

              {/* Variance Widget (Mock) */}
              <Card>
                 <CardHeader className="pb-2">
                    <CardTitle className="text-foreground text-sm uppercase tracking-wider">Stock Variance</CardTitle>
                 </CardHeader>
                 <CardContent>
                    <div className="h-[200px] w-full">
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={varianceData} layout="vertical" margin={{ left: 10, right: 10 }}>
                             <XAxis type="number" hide />
                             <YAxis dataKey="name" type="category" width={50} tick={{fill: '#6b7280', fontSize: 12}} />
                             <Tooltip 
                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: '#fff' }}
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
        <Card>
           <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                 <Truck className="w-5 h-5 text-blue-400" /> Replenishment Suggestions
              </CardTitle>
           </CardHeader>
           <CardContent>
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted uppercase bg-black/20 border-b border-border">
                       <tr>
                          <th className="px-4 py-3">Source</th>
                          <th className="px-4 py-3">Item Name</th>
                          <th className="px-4 py-3">Current</th>
                          <th className="px-4 py-3">Restock Amount</th>
                          <th className="px-4 py-3">Est. Cost</th>
                          <th className="px-4 py-3 text-right">Action</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                       {reorderSuggestions.map(item => (
                          <tr key={item.id} className="hover:bg-white/5 transition-colors">
                             <td className="px-4 py-3 font-medium text-blue-400">{item.supplier}</td>
                             <td className="px-4 py-3 text-foreground">{item.name}</td>
                             <td className="px-4 py-3 text-muted">{item.quantity} units</td>
                             <td className="px-4 py-3 text-primary font-bold">{item.suggestedQty} units</td>
                             <td className="px-4 py-3 text-gray-300">ETB {(item.suggestedQty * item.cost_per_unit).toLocaleString()}</td>
                             <td className="px-4 py-3 text-right">
                                <Button size="sm" className="h-8">
                                   Restock <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                             </td>
                          </tr>
                       ))}
                       {reorderSuggestions.length === 0 && (
                          <tr><td colSpan={6} className="p-4 text-center text-muted">No reorders needed. All items > 10 units.</td></tr>
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
