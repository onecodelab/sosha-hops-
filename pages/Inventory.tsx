import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, cn, showToast, Badge, Dialog } from '../components/ui';
import { 
  Search, AlertTriangle, Package, TrendingDown, Truck, 
  Calendar, RefreshCw, AlertOctagon, ArrowRight,
  Plus, User, Edit3, Save, PackagePlus, History, BarChart3, ClipboardCheck, ArrowLeft, Check, Hash, Filter
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

const Inventory: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'stock' | 'logs'>('stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  // Modal States
  const [isParModalOpen, setIsParModalOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [isStocktakeOpen, setIsStocktakeOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<any>(null);
  
  // Form States
  const [parForm, setParForm] = useState({ par_min: 0, par_max: 0 });
  const [restockForm, setRestockForm] = useState({ qty_received: '', expires_at: '', unit_cost: '', note: '' });
  const [stocktakeData, setStocktakeData] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('inventory_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_events' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch from the computed view for stock health and projections
      const { data: stockData, error: stockError } = await supabase.from('ingredient_overview').select('*');
      if (stockError) throw stockError;
      setIngredients(stockData || []);

      // Fetch recent movement logs
      const { data: eventData, error: eventError } = await supabase
        .from('inventory_events')
        .select(`*, ingredient:ingredients(name, unit_type), performer:users(full_name)`)
        .order('created_at', { ascending: false }).limit(40);
      if (eventError) throw eventError;
      setEvents(eventData || []);
    } catch (err: any) {
      console.error("Inventory sync error:", err);
      // Fallback: If view is missing, try raw table
      const { data: rawData } = await supabase.from('ingredients').select('*');
      if (rawData) setIngredients(rawData);
    } finally {
      setLoading(false);
    }
  };

  // --- Panels & Projections ---
  const lowStockAlerts = useMemo(() => ingredients.filter(i => (i.current_stock <= i.par_min) || i.stock_status === 'LOW' || i.stock_status === 'EMPTY'), [ingredients]);
  
  const expiryAlerts = useMemo(() => ingredients.filter(i => i.next_expiry_date).map(i => {
    const days = Math.ceil((new Date(i.next_expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return { ...i, daysLeft: days };
  }).filter(i => i.daysLeft <= 10 && i.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft), [ingredients]);

  const restockSuggestions = useMemo(() => ingredients.map(i => ({ 
    ...i, restock_amount: Math.max(0, (i.par_max || 0) - i.current_stock) 
  })).filter(i => i.restock_amount > 0 && i.current_stock <= i.par_min).sort((a, b) => b.restock_amount - a.restock_amount).slice(0, 6), [ingredients]);

  const sortedAndFilteredIngredients = useMemo(() => {
    let filtered = ingredients.filter(i => 
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (i.location && i.location.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [ingredients, searchTerm, sortConfig]);

  // --- Actions ---
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const openParEdit = (ing: any) => {
    setSelectedIngredient(ing);
    setParForm({ par_min: ing.par_min || 0, par_max: ing.par_max || 0 });
    setIsParModalOpen(true);
  };

  const openRestock = (ing: any) => {
    setSelectedIngredient(ing);
    setRestockForm({ qty_received: '', expires_at: '', unit_cost: '', note: '' });
    setIsRestockOpen(true);
  };

  const startStocktake = () => {
    const initial = {};
    ingredients.forEach(i => initial[i.id] = i.current_stock);
    setStocktakeData(initial);
    setIsStocktakeOpen(true);
  };

  const submitParUpdate = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from('ingredients').update({ 
        par_min: parForm.par_min, 
        par_max: parForm.par_max 
      }).eq('id', selectedIngredient.id);
      
      if (error) throw error;
      showToast(`${selectedIngredient.name} thresholds updated`, "success");
      setIsParModalOpen(false);
      fetchData();
    } catch (err: any) { showToast(err.message, "error"); } finally { setSubmitting(false); }
  };

  const submitRestock = async () => {
    if (!restockForm.qty_received) return;
    setSubmitting(true);
    try {
      const qty = parseFloat(restockForm.qty_received);
      
      // 1. Log event
      await supabase.from('inventory_events').insert({
        ingredient_id: selectedIngredient.id, 
        event_type: 'restock', 
        qty_change: qty, 
        reason: restockForm.note || 'Manual restock via dashboard', 
        performed_by: user?.id
      });

      // 2. Update stock level (assuming increment logic on DB or manually)
      await supabase.rpc('increment_stock', { 
        row_id: selectedIngredient.id, 
        quantity: qty 
      });

      showToast(`Received ${qty}${selectedIngredient.unit_type} of ${selectedIngredient.name}`, "success");
      setIsRestockOpen(false);
      fetchData();
    } catch (err: any) { showToast(err.message, "error"); } finally { setSubmitting(false); }
  };

  const submitStocktake = async () => {
    setSubmitting(true);
    try {
      const { data: stocktake, error: stErr } = await supabase.from('stocktakes').insert({ status: 'completed' }).select().single();
      if (stErr) throw stErr;

      const lines = [], events = [];
      for (const ing of ingredients) {
        const counted = stocktakeData[ing.id] ?? ing.current_stock;
        const delta = counted - ing.current_stock;
        lines.push({ stocktake_id: stocktake.id, ingredient_id: ing.id, system_qty: ing.current_stock, counted_qty: counted });
        if (delta !== 0) {
          events.push({ ingredient_id: ing.id, event_type: 'stocktake', qty_change: delta, reason: 'Stocktake adjustment', performed_by: user?.id });
          // Also update the ingredient table directly if not handled by triggers
          await supabase.from('ingredients').update({ current_stock: counted }).eq('id', ing.id);
        }
      }
      await supabase.from('stocktake_lines').insert(lines);
      if (events.length > 0) await supabase.from('inventory_events').insert(events);
      
      showToast("Inventory reconciled successfully", "success");
      setIsStocktakeOpen(false);
      fetchData();
    } catch (err: any) { showToast(err.message, "error"); } finally { setSubmitting(false); }
  };

  return (
    <DashboardLayout title="Master Inventory" subtitle="Stock roster, automated projections, and supply chain oversight"
      actions={
        <div className="flex gap-2">
           <Button variant="outline" onClick={startStocktake} className="border-primary/20 text-primary hover:bg-primary/5 bg-black/40 backdrop-blur-md">
              <ClipboardCheck className="w-4 h-4 mr-2" /> Stocktake
           </Button>
           <Button variant="outline" onClick={fetchData} size="icon" className="border-white/10 bg-white/5 backdrop-blur-md">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
           </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-20">
        
        {/* Top Intelligence Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* High Risk: Low Stock */}
           <Card className="bg-[#0A0A0A]/80 border-white/5 shadow-2xl backdrop-blur-xl">
              <CardHeader className="border-b border-white/5 py-4 flex flex-row items-center justify-between">
                 <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-red-500">
                    <AlertTriangle className="w-4 h-4" /> Priority Low Stock
                 </CardTitle>
                 <Badge variant="destructive" className="bg-red-500/10 text-red-500 font-mono">{lowStockAlerts.length}</Badge>
              </CardHeader>
              <CardContent className="p-0 max-h-[240px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                 {lowStockAlerts.length === 0 ? <div className="p-10 text-center text-gray-600 text-xs italic">All levels healthy</div> : 
                    lowStockAlerts.map(i => (
                      <div key={i.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] group">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-200 truncate">{i.name}</p>
                            <p className="text-[10px] text-gray-500 font-mono">Current: <span className="text-white">{i.current_stock}</span> / {i.par_min}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => openRestock(i)} className="opacity-0 group-hover:opacity-100 text-primary hover:bg-primary/10 h-8 w-8 p-0 rounded-full transition-opacity">
                            <PackagePlus className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                 }
              </CardContent>
           </Card>

           {/* High Risk: Expiry */}
           <Card className="bg-[#0A0A0A]/80 border-white/5 shadow-2xl backdrop-blur-xl">
              <CardHeader className="border-b border-white/5 py-4 flex flex-row items-center justify-between">
                 <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-blue-400">
                    <Calendar className="w-4 h-4" /> Imminent Expiry
                 </CardTitle>
                 <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-mono">{expiryAlerts.length}</Badge>
              </CardHeader>
              <CardContent className="p-0 max-h-[240px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                 {expiryAlerts.length === 0 ? <div className="p-10 text-center text-gray-600 text-xs italic">No immediate risks</div> : 
                    expiryAlerts.map(i => (
                      <div key={i.id} className="p-4 flex items-center justify-between">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-200 truncate">{i.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Expires: {new Date(i.next_expiry_date).toLocaleDateString()}</p>
                        </div>
                        <span className={cn("text-[10px] font-black px-2 py-1 rounded-lg border", i.daysLeft <= 3 ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20")}>{i.daysLeft}d left</span>
                      </div>
                    ))
                 }
              </CardContent>
           </Card>

           {/* Suggestions */}
           <Card className="bg-[#0A0A0A]/80 border-white/5 shadow-2xl backdrop-blur-xl">
              <CardHeader className="border-b border-white/5 py-4">
                 <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                    <Truck className="w-4 h-4" /> Reorder Suggested
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[240px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                 {restockSuggestions.length === 0 ? <div className="p-10 text-center text-gray-600 text-xs italic">Inventory optimized</div> : 
                    restockSuggestions.map(i => (
                      <div key={i.id} className="p-4 flex items-center justify-between group hover:bg-white/[0.02]">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-200 truncate">{i.name}</p>
                            <p className="text-[10px] text-gray-500">Suggested Order: <span className="text-primary font-black">+{i.restock_amount} {i.unit_type}</span></p>
                        </div>
                        <button onClick={() => openRestock(i)} className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all shadow-lg"><PackagePlus className="w-4 h-4" /></button>
                      </div>
                    ))
                 }
              </CardContent>
           </Card>
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 w-fit backdrop-blur-md">
                <button onClick={() => setActiveTab('stock')} className={cn("px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", activeTab === 'stock' ? "bg-primary text-black shadow-lg shadow-primary/10" : "text-gray-500 hover:text-gray-300")}>Detailed Roster</button>
                <button onClick={() => setActiveTab('logs')} className={cn("px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", activeTab === 'logs' ? "bg-primary text-black shadow-lg shadow-primary/10" : "text-gray-500 hover:text-gray-300")}>Movement Logs</button>
            </div>

            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    placeholder="Filter by name, SKU, or location..." 
                    className="pl-10 h-10 bg-black/40 border-white/10 rounded-xl"
                />
            </div>
        </div>

        {activeTab === 'stock' ? (
           <Card className="bg-[#080808]/60 border-white/5 shadow-2xl overflow-hidden backdrop-blur-lg">
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-gray-500 uppercase bg-black/60 border-b border-white/5 font-black tracking-widest">
                       <tr>
                          <th className="px-6 py-5 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('name')}>Ingredient</th>
                          <th className="px-6 py-5 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('location')}>Storage</th>
                          <th className="px-6 py-5 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('current_stock')}>Inventory Health</th>
                          <th className="px-6 py-5">Thresholds</th>
                          <th className="px-6 py-5 text-center">Projected</th>
                          <th className="px-6 py-5 text-center">Status</th>
                          <th className="px-6 py-5"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {sortedAndFilteredIngredients.map((item) => {
                          const pct = Math.min(100, (item.current_stock / (item.par_max || item.par_min || 1)) * 100);
                          const isLow = item.current_stock <= item.par_min;
                          return (
                             <tr key={item.id} className="hover:bg-white/[0.03] transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 shrink-0">
                                            <Package className="w-4 h-4 text-gray-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-base leading-none mb-1">{item.name}</p>
                                            <p className="text-[10px] text-gray-500 font-mono uppercase">{item.sku || 'No SKU'} • {item.unit_type}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[10px] text-gray-400 font-bold px-2 py-1 bg-white/5 rounded-lg border border-white/5">{item.location || 'Dry Storage'}</span>
                                </td>
                                <td className="px-6 py-4 w-[280px]">
                                   <div className="space-y-1.5">
                                      <div className="flex justify-between items-end">
                                          <span className="text-[10px] font-black text-white font-mono">{item.current_stock} <span className="text-gray-500">{item.unit_type}</span></span>
                                          <span className="text-[10px] text-gray-500 font-bold uppercase">{pct.toFixed(0)}% Fill</span>
                                      </div>
                                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                          <div 
                                            className={cn(
                                                "h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_currentColor]", 
                                                item.current_stock === 0 ? "bg-red-500" : isLow ? "bg-yellow-500" : "bg-green-500"
                                            )} 
                                            style={{ width: `${pct}%` }} 
                                          />
                                      </div>
                                   </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-[10px] font-mono">
                                        <div className="text-center">
                                            <p className="text-gray-500 uppercase text-[8px] mb-0.5">Par</p>
                                            <p className="font-bold text-gray-300">{item.par_min}</p>
                                        </div>
                                        <ArrowRight className="w-2.5 h-2.5 text-gray-700" />
                                        <div className="text-center">
                                            <p className="text-gray-500 uppercase text-[8px] mb-0.5">Target</p>
                                            <p className="font-bold text-primary">{item.par_max}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div>
                                        <p className={cn("text-xs font-black", (item.est_days_left_by_usage || 0) <= 2 ? "text-red-400" : "text-gray-300")}>
                                            {item.est_days_left_by_usage ? `${item.est_days_left_by_usage}d` : 'N/A'}
                                        </p>
                                        <p className="text-[8px] text-gray-600 uppercase font-black tracking-tighter">7d usage avg</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                   <Badge className={cn("text-[9px] font-black uppercase tracking-widest", item.current_stock === 0 ? "bg-red-500/10 text-red-500" : isLow ? "bg-yellow-500/10 text-yellow-500" : "bg-green-500/10 text-green-500")}>
                                       {item.current_stock === 0 ? 'Empty' : isLow ? 'Low' : 'Health OK'}
                                   </Badge>
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => openParEdit(item)} className="p-2 bg-white/5 border border-white/10 rounded-xl hover:border-primary/40 transition-colors" title="Edit Thresholds"><Edit3 className="w-4 h-4 text-gray-400" /></button>
                                      <button onClick={() => openRestock(item)} className="p-2 bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/30 transition-colors" title="Quick Restock"><Truck className="w-4 h-4 text-primary" /></button>
                                   </div>
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </Card>
        ) : (
           <Card className="bg-[#080808]/60 border-white/5 shadow-2xl overflow-hidden backdrop-blur-lg">
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-gray-500 uppercase bg-black/60 border-b border-white/5 font-black tracking-widest">
                       <tr><th className="px-6 py-5">Timestamp</th><th className="px-6 py-5">Ingredient</th><th className="px-6 py-5">Type</th><th className="px-6 py-5">Movement</th><th className="px-6 py-5">Executor</th><th className="px-6 py-5 text-right">Reference / Note</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {events.map((e) => (
                          <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                             <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                                <span className="block text-gray-300">{new Date(e.created_at).toLocaleDateString()}</span>
                                <span className="opacity-40">{new Date(e.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                             </td>
                             <td className="px-6 py-4">
                                <p className="font-bold text-white text-sm">{e.ingredient?.name}</p>
                                <p className="text-[9px] text-gray-600 font-mono uppercase">{e.ingredient?.unit_type} unit</p>
                             </td>
                             <td className="px-6 py-4">
                                <Badge className={cn("capitalize text-[9px] font-black border-none", e.event_type === 'restock' ? "bg-green-500/10 text-green-500" : e.event_type === 'usage' ? "bg-blue-500/10 text-blue-500" : "bg-zinc-800 text-zinc-400")}>
                                    {e.event_type}
                                </Badge>
                             </td>
                             <td className="px-6 py-4">
                                <span className={cn("font-mono font-black text-base", e.qty_change > 0 ? "text-green-400" : "text-red-400")}>
                                    {e.qty_change > 0 ? '+' : ''}{e.qty_change}
                                </span>
                             </td>
                             <td className="px-6 py-4 text-xs text-gray-400 font-medium">{e.performer?.full_name || 'Automated'}</td>
                             <td className="px-6 py-4 text-right text-gray-500 italic text-xs max-w-[200px] truncate">{e.reason}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </Card>
        )}
      </div>

      {/* --- Modals --- */}
      
      <Dialog isOpen={isParModalOpen} onClose={() => setIsParModalOpen(false)} title={`Configure: ${selectedIngredient?.name}`}>
         <div className="space-y-6 pt-2">
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex gap-4 items-start">
                <BarChart3 className="w-6 h-6 text-primary shrink-0 mt-1" />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                    Set the <span className="text-primary font-bold">Minimum Par</span> to trigger low-stock alerts and the <span className="text-primary font-bold">Target Max</span> for automated purchase list generation.
                </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Minimum Par (Alert)</label>
                   <Input type="number" value={parForm.par_min} onChange={e => setParForm({...parForm, par_min: parseFloat(e.target.value) || 0})} className="h-12 bg-black border-white/10 rounded-xl text-lg font-mono text-white" />
               </div>
               <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Target Max (Capacity)</label>
                   <Input type="number" value={parForm.par_max} onChange={e => setParForm({...parForm, par_max: parseFloat(e.target.value) || 0})} className="h-12 bg-black border-white/10 rounded-xl text-lg font-mono text-primary" />
               </div>
            </div>
            <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setIsParModalOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
                <Button onClick={submitParUpdate} className="flex-1 bg-primary text-black font-black rounded-xl" isLoading={submitting}>Update Thresholds</Button>
            </div>
         </div>
      </Dialog>

      <Dialog isOpen={isRestockOpen} onClose={() => setIsRestockOpen(false)} title={`Receive Stock: ${selectedIngredient?.name}`}>
         <div className="space-y-6 pt-2">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Quantity Received</label>
                   <div className="relative">
                       <Input type="number" placeholder="0.00" value={restockForm.qty_received} onChange={e => setRestockForm({...restockForm, qty_received: e.target.value})} className="h-12 bg-black border-white/10 rounded-xl font-mono text-lg text-primary" />
                       <span className="absolute right-3 top-3.5 text-[10px] text-gray-600 font-black uppercase">{selectedIngredient?.unit_type}</span>
                   </div>
               </div>
               <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Total Unit Cost (Opt)</label>
                   <div className="relative">
                       <Input type="number" placeholder="0.00" value={restockForm.unit_cost} onChange={e => setRestockForm({...restockForm, unit_cost: e.target.value})} className="h-12 bg-black border-white/10 rounded-xl font-mono pl-10" />
                       <span className="absolute left-3 top-3.5 text-[10px] text-gray-500 font-bold uppercase tracking-widest">ETB</span>
                   </div>
               </div>
            </div>
            <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Inventory Location / Note</label>
                <textarea 
                    placeholder="Dry shelf A2, Refrigerator B, etc." 
                    value={restockForm.note} 
                    onChange={e => setRestockForm({...restockForm, note: e.target.value})} 
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-sm text-white h-24 outline-none focus:border-primary/40 transition-all resize-none" 
                />
            </div>
            <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setIsRestockOpen(false)} className="flex-1 rounded-xl">Discard</Button>
                <Button onClick={submitRestock} className="flex-1 bg-primary text-black font-black rounded-xl shadow-xl shadow-primary/10" isLoading={submitting} disabled={!restockForm.qty_received}>Commit Receipt</Button>
            </div>
         </div>
      </Dialog>

      <Dialog isOpen={isStocktakeOpen} onClose={() => setIsStocktakeOpen(false)} title="Operational Stocktake / Digital Audit">
         <div className="flex flex-col h-[75vh] w-full max-w-2xl mx-auto space-y-6 pt-2">
            <div className="flex items-center gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl">
                <AlertOctagon className="w-5 h-5 text-yellow-500 shrink-0" />
                <p className="text-[10px] text-gray-400 font-medium">Physical counts will overwrite existing digital levels. All discrepancies will be logged as 'Stocktake' movement events for auditing.</p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
               {ingredients.map(i => {
                  const val = stocktakeData[i.id] ?? i.current_stock;
                  const delta = val - i.current_stock;
                  return (
                    <div key={i.id} className="p-4 bg-white/5 border border-white/5 rounded-[1.5rem] flex items-center justify-between gap-4 group hover:border-white/20 transition-all">
                       <div className="flex-1 min-w-0">
                           <p className="font-bold text-white text-sm truncate">{i.name}</p>
                           <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">System: {i.current_stock} {i.unit_type}</p>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className={cn("text-[9px] font-black uppercase w-14 text-center px-1.5 py-0.5 rounded", delta === 0 ? "text-gray-600 bg-gray-900" : delta > 0 ? "text-green-500 bg-green-500/10" : "text-red-500 bg-red-500/10")}>
                              {delta === 0 ? 'Match' : delta > 0 ? `+${delta}` : delta}
                          </div>
                          <Input type="number" value={val} onChange={e => setStocktakeData({...stocktakeData, [i.id]: parseFloat(e.target.value) || 0})} className="h-10 w-24 bg-black border-white/10 rounded-xl text-center font-mono text-primary font-bold" />
                       </div>
                    </div>
                  );
               })}
            </div>
            <div className="pt-4 border-t border-white/5 flex gap-3">
                <Button variant="ghost" onClick={() => setIsStocktakeOpen(false)} className="flex-1 rounded-xl">Exit Without Save</Button>
                <Button onClick={submitStocktake} className="flex-1 bg-primary text-black font-black rounded-xl shadow-2xl shadow-primary/20" isLoading={submitting}>
                    <Check className="w-4 h-4 mr-2" /> Finish Reconciliation
                </Button>
            </div>
         </div>
      </Dialog>

      <style>{` 
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </DashboardLayout>
  );
};

export default Inventory;