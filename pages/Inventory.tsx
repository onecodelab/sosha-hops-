
import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, cn, showToast, Badge, Dialog } from '../components/ui';
import { 
  Search, AlertTriangle, Package, Calendar, RefreshCw, 
  Plus, Edit3, PackagePlus, History, BarChart3, ClipboardCheck, Check, Truck, ArrowRight
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
  
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [isParModalOpen, setIsParModalOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [isStocktakeOpen, setIsStocktakeOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<any>(null);
  
  const [parForm, setParForm] = useState({ par_min: 0, par_max: 0 });
  const [restockForm, setRestockForm] = useState({ qty_received: '', note: '' });
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
      const { data: stockData } = await supabase.from('ingredient_overview').select('*');
      setIngredients(stockData || []);

      const { data: eventData } = await supabase
        .from('inventory_events')
        .select(`*, ingredient:ingredients(name, unit_type), performer:profiles(full_name)`)
        .order('created_at', { ascending: false }).limit(50);
      setEvents(eventData || []);
    } catch (err: any) {
      console.error("Sync error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
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
    if (!restockForm.qty_received || !selectedIngredient) return;
    setSubmitting(true);
    try {
      const qty = parseFloat(restockForm.qty_received);
      // HARDENED: Only insert event. Trigger tr_inventory_sync handles stock calculation.
      const { error } = await supabase.from('inventory_events').insert({
        ingredient_id: selectedIngredient.id, 
        event_type: 'purchase', 
        qty_change: qty, 
        reason: restockForm.note || 'Manual receipt', 
        performed_by: user?.id
      });
      if (error) throw error;
      showToast(`Stock increased by ${qty} ${selectedIngredient.unit_type}`, "success");
      setIsRestockOpen(false);
    } catch (err: any) { showToast(err.message, "error"); } finally { setSubmitting(false); }
  };

  const submitStocktake = async () => {
    setSubmitting(true);
    try {
      const adjustmentEvents = [];
      for (const ing of ingredients) {
        const counted = stocktakeData[ing.id] ?? ing.current_stock;
        const delta = counted - ing.current_stock;
        if (delta !== 0) {
          adjustmentEvents.push({ 
            ingredient_id: ing.id, 
            event_type: 'adjustment', 
            qty_change: delta, 
            reason: 'Physical stocktake adjustment', 
            performed_by: user?.id 
          });
        }
      }
      if (adjustmentEvents.length > 0) {
        const { error } = await supabase.from('inventory_events').insert(adjustmentEvents);
        if (error) throw error;
      }
      showToast("Inventory reconciled successfully", "success");
      setIsStocktakeOpen(false);
    } catch (err: any) { showToast(err.message, "error"); } finally { setSubmitting(false); }
  };

  const sortedAndFiltered = useMemo(() => {
    let list = ingredients.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    list.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [ingredients, searchTerm, sortConfig]);

  return (
    <DashboardLayout title="Inventory Core" subtitle="Deterministic stock levels and audit logs"
      actions={
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => { 
             const initial = {}; ingredients.forEach(i => initial[i.id] = i.current_stock);
             setStocktakeData(initial); setIsStocktakeOpen(true); 
           }} className="border-primary/20 text-primary bg-black/40"><ClipboardCheck className="w-4 h-4 mr-2" /> Stocktake</Button>
           <Button variant="outline" onClick={fetchData} size="icon" className="bg-white/5"><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /></Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-black/40 p-1 rounded-xl border border-white/5 w-fit">
            <button onClick={() => setActiveTab('stock')} className={cn("px-6 py-2 text-[10px] font-black uppercase rounded-lg transition-all", activeTab === 'stock' ? "bg-primary text-black" : "text-gray-500")}>Stock Levels</button>
            <button onClick={() => setActiveTab('logs')} className={cn("px-6 py-2 text-[10px] font-black uppercase rounded-lg transition-all", activeTab === 'logs' ? "bg-primary text-black" : "text-gray-500")}>Audit Ledger</button>
        </div>

        <Card className="bg-[#080808]/60 border-white/5 overflow-hidden">
           {activeTab === 'stock' ? (
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-gray-500 uppercase bg-black/60 border-b border-white/5 font-black">
                       <tr>
                          <th className="px-6 py-5 cursor-pointer" onClick={() => handleSort('name')}>Ingredient</th>
                          <th className="px-6 py-5">Current Stock</th>
                          <th className="px-6 py-5">Status</th>
                          <th className="px-6 py-5">Thresholds</th>
                          <th className="px-6 py-5"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {sortedAndFiltered.map((item) => (
                          <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                             <td className="px-6 py-4 font-bold text-white">{item.name}<p className="text-[9px] text-gray-500 font-mono">{item.sku || 'NO-SKU'}</p></td>
                             <td className="px-6 py-4 font-mono text-primary font-bold">{item.current_stock} {item.unit_type}</td>
                             <td className="px-6 py-4">
                                <Badge className={cn("text-[9px] font-black", item.stock_status === 'LOW' ? "bg-yellow-500/10 text-yellow-500" : item.stock_status === 'EMPTY' ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500")}>{item.stock_status}</Badge>
                             </td>
                             <td className="px-6 py-4 text-xs text-gray-500">Min: {item.par_min} / Max: {item.par_max}</td>
                             <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => { setSelectedIngredient(item); setParForm({ par_min: item.par_min, par_max: item.par_max }); setIsParModalOpen(true); }} className="p-2 bg-white/5 rounded-xl hover:text-primary"><Edit3 className="w-4 h-4" /></button>
                                   <button onClick={() => { setSelectedIngredient(item); setRestockForm({ qty_received: '', note: '' }); setIsRestockOpen(true); }} className="p-2 bg-primary/10 text-primary rounded-xl"><PackagePlus className="w-4 h-4" /></button>
                                </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           ) : (
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-gray-500 uppercase bg-black/60 border-b border-white/5 font-black">
                       <tr><th>Timestamp</th><th>Ingredient</th><th>Type</th><th>Change</th><th>Performer</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {events.map((e) => (
                          <tr key={e.id} className="hover:bg-white/[0.01]">
                             <td className="px-6 py-4 text-gray-500 font-mono text-[10px]">{new Date(e.created_at).toLocaleString()}</td>
                             <td className="px-6 py-4 font-bold text-white">{e.ingredient?.name}</td>
                             <td className="px-6 py-4"><Badge className="capitalize text-[9px]">{e.event_type}</Badge></td>
                             <td className="px-6 py-4 font-mono font-black text-white">{e.qty_change > 0 ? '+' : ''}{e.qty_change}</td>
                             <td className="px-6 py-4 text-xs text-gray-400">{e.performer?.full_name || 'System'}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           )}
        </Card>
      </div>

      <Dialog isOpen={isParModalOpen} onClose={() => setIsParModalOpen(false)} title="Threshold Configuration">
         <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2"><label className="text-[10px] font-black uppercase text-gray-500">Min Par</label><Input type="number" value={parForm.par_min} onChange={e => setParForm({...parForm, par_min: parseFloat(e.target.value) || 0})} /></div>
               <div className="space-y-2"><label className="text-[10px] font-black uppercase text-gray-500">Max Target</label><Input type="number" value={parForm.par_max} onChange={e => setParForm({...parForm, par_max: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <Button onClick={submitParUpdate} className="w-full bg-primary text-black font-black" isLoading={submitting}>Update Thresholds</Button>
         </div>
      </Dialog>

      <Dialog isOpen={isRestockOpen} onClose={() => setIsRestockOpen(false)} title={`Receive Stock: ${selectedIngredient?.name}`}>
         <div className="space-y-4 pt-2">
            <div className="space-y-2"><label className="text-[10px] font-black uppercase text-gray-500">Qty Received ({selectedIngredient?.unit_type})</label><Input type="number" value={restockForm.qty_received} onChange={e => setRestockForm({...restockForm, qty_received: e.target.value})} className="text-primary font-bold text-lg" /></div>
            <div className="space-y-2"><label className="text-[10px] font-black uppercase text-gray-500">Note</label><Input value={restockForm.note} onChange={e => setRestockForm({...restockForm, note: e.target.value})} placeholder="e.g. Delivery from Meat Masters" /></div>
            <Button onClick={submitRestock} className="w-full bg-primary text-black font-black" isLoading={submitting} disabled={!restockForm.qty_received}>Commit Audit Entry</Button>
         </div>
      </Dialog>

      <Dialog isOpen={isStocktakeOpen} onClose={() => setIsStocktakeOpen(false)} title="Physical Stocktake Adjustment">
         <div className="flex flex-col h-[60vh] gap-4">
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
               {ingredients.map(i => (
                  <div key={i.id} className="p-3 bg-white/5 rounded-xl flex items-center justify-between border border-white/5">
                     <span className="text-xs font-bold text-white truncate max-w-[150px]">{i.name}</span>
                     <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-mono">System: {i.current_stock}</span>
                        <Input type="number" value={stocktakeData[i.id] ?? i.current_stock} onChange={e => setStocktakeData({...stocktakeData, [i.id]: parseFloat(e.target.value) || 0})} className="w-20 h-8 text-center font-mono" />
                     </div>
                  </div>
               ))}
            </div>
            <Button onClick={submitStocktake} className="bg-primary text-black font-black h-12" isLoading={submitting}><Check className="w-4 h-4 mr-2" /> Reconcile All Counts</Button>
         </div>
      </Dialog>
    </DashboardLayout>
  );
};

export default Inventory;
