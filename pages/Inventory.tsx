import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, cn, showToast, Badge, Dialog } from '../components/ui';
import {
  Search, RefreshCw, Edit3, Database, Scale,
  AlertTriangle, Package, ArrowUpDown, Info, Tag, Calendar, DollarSign, Loader2, Lock, Eye
} from 'lucide-react';
import { supabase } from '../supabase';
import { Ingredient } from '../types';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { RoleGuard } from '../components/RoleGuard';

type SortField = 'name' | 'current_stock' | 'total_value';
type SortOrder = 'asc' | 'desc';

interface FormData {
  current_stock: number;
  par_min: number;
  par_max: number;
  cost_per_unit: number;
  expiry_days: number;
  unit_type: string;
  weight_per_unit: number;
}

const Inventory: React.FC = () => {
  const { hasPermission, isOwnerOrAdmin } = useRoleAccess();
  const canViewCost = hasPermission('canViewInventoryCost');
  const canViewStock = hasPermission('canViewInventoryStock');

  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Ingredient | null>(null);
  const [linkedRecipes, setLinkedRecipes] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    current_stock: 0,
    par_min: 0,
    par_max: 0,
    cost_per_unit: 0,
    expiry_days: 0,
    unit_type: 'g',
    weight_per_unit: 1
  });

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    fetchInventory();
    const sub = supabase.channel('ingredients_sync_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, () => fetchInventory())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      setInventory(data as Ingredient[]);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = async (ingredient: Ingredient) => {
    setSelectedItem(ingredient);
    setFormData({
      current_stock: Number(ingredient.current_stock) || 0,
      par_min: Number(ingredient.par_min) || 0,
      par_max: Number(ingredient.par_max) || 0,
      cost_per_unit: Number(ingredient.cost_per_unit) || 0,
      expiry_days: Number(ingredient.expiry_days) || 0,
      unit_type: ingredient.unit_type || 'g',
      weight_per_unit: Number(ingredient.weight_per_unit) || 1
    });

    try {
      const { data } = await supabase
        .from('recipe_ingredients')
        .select(`recipe_id, recipes(name)`)
        .eq('ingredient_id', ingredient.id);

      if (data) {
        setLinkedRecipes(data.map((d: any) => d.recipes));
      } else {
        setLinkedRecipes([]);
      }
    } catch (e) {
      setLinkedRecipes([]);
    }

    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    setSubmitting(true);

    try {
      const updatePayload = {
        current_stock: Number(formData.current_stock),
        par_min: Number(formData.par_min),
        par_max: Number(formData.par_max),
        cost_per_unit: Number(formData.cost_per_unit),
        expiry_days: Math.floor(Number(formData.expiry_days)),
        unit_type: formData.unit_type,
        weight_per_unit: Number(formData.weight_per_unit),
        updated_at: new Date().toISOString()
      };

      if (updatePayload.par_max < updatePayload.par_min && updatePayload.par_max > 0) {
        throw new Error("Par Max cannot be less than Par Min");
      }

      const { error } = await supabase
        .from('ingredients')
        .update(updatePayload)
        .eq('id', selectedItem.id);

      if (error) {
        console.error("Database Save Error:", error);
        throw new Error(`DB Error: ${error.message}. Please run the SQL Hardening Script.`);
      }

      await fetchInventory();
      showToast(`Master record for ${selectedItem.name} updated!`, "success");
      setIsModalOpen(false);
      setSelectedItem(null);

    } catch (err: any) {
      console.error("Critical Save failure:", err);
      showToast(err.message || "Failed to save changes", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const processedInventory = useMemo(() => {
    let result = inventory.filter(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

    result.sort((a, b) => {
      let valA: any, valB: any;
      if (sortField === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
      } else if (sortField === 'current_stock') {
        valA = Number(a.current_stock) || 0;
        valB = Number(b.current_stock) || 0;
      } else if (sortField === 'total_value') {
        valA = (Number(a.current_stock) || 0) * (Number(a.cost_per_unit) || 0);
        valB = (Number(b.current_stock) || 0) * (Number(b.cost_per_unit) || 0);
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [inventory, searchTerm, sortField, sortOrder]);

  const stats = useMemo(() => {
    const totalValue = inventory.reduce((sum, i) => sum + ((Number(i.current_stock) || 0) * (Number(i.cost_per_unit) || 0)), 0);
    const lowStockCount = inventory.filter(i => (Number(i.current_stock) || 0) < (Number(i.par_min) || 0)).length;
    return { totalValue, lowStockCount };
  }, [inventory]);

  const getStockStatus = (item: Ingredient) => {
    const current = Number(item.current_stock) || 0;
    const min = Number(item.par_min) || 0;
    if (current <= 0) return 'Out of Stock';
    if (current < min) return 'Low stock';
    return 'In stock';
  };
  return (
    <DashboardLayout title="Inventory Management" subtitle="Master Registry Control">
      <div className="space-y-6 animate-in fade-in duration-500">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-primary/5 border-primary/20 p-5 rounded-2xl shadow-sm">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.1em]">Total Asset Valuation</p>
            <h3 className="text-2xl font-black text-white mt-1">ETB {(stats.totalValue || 0).toLocaleString()}</h3>
          </Card>
          <Card className={cn("p-5 rounded-2xl border shadow-sm transition-colors", stats.lowStockCount > 0 ? "bg-red-500/5 border-red-500/20" : "bg-white/5 border-white/5")}>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.1em]">Re-order Alerts</p>
            <h3 className={cn("text-2xl font-black mt-1", stats.lowStockCount > 0 ? "text-red-400" : "text-white")}>{stats.lowStockCount} Low SKUs</h3>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-4 bg-card/40 p-3 rounded-[1.5rem] border border-white/5 backdrop-blur-xl">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-11 bg-black/40 border-white/10 h-11 rounded-xl"
            />
          </div>
          <Button onClick={fetchInventory} variant="outline" size="icon" className="h-11 w-11 bg-white/5 border-white/10">
            <RefreshCw className={cn("h-4 w-4 text-gray-400", loading && "animate-spin")} />
          </Button>
        </div>

        <Card className="bg-card/30 border-white/5 rounded-[2rem] overflow-hidden backdrop-blur-sm shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-gray-500 uppercase bg-black/60 border-b border-white/5 font-black tracking-widest">
                <tr>
                  <th className="px-8 py-5 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('name')}>
                    <div className="flex items-center gap-2">Ingredient {sortField === 'name' && <ArrowUpDown className="w-3 h-3" />}</div>
                  </th>
                  {canViewStock && (
                    <th className="px-8 py-5 cursor-pointer hover:text-white transition-colors text-center" onClick={() => toggleSort('current_stock')}>
                      <div className="flex items-center gap-2 justify-center">Stock Level {sortField === 'current_stock' && <ArrowUpDown className="w-3 h-3" />}</div>
                    </th>
                  )}
                  <th className="px-8 py-5 text-center">Unit</th>
                  {canViewCost && (
                    <th className="px-8 py-5 text-right">Cost/Unit</th>
                  )}
                  {canViewCost && (
                    <th className="px-8 py-5 cursor-pointer hover:text-white transition-colors text-right" onClick={() => toggleSort('total_value')}>
                      <div className="flex items-center gap-2 justify-end">Value {sortField === 'total_value' && <ArrowUpDown className="w-3 h-3" />}</div>
                    </th>
                  )}
                  <th className="px-8 py-5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {processedInventory.map((item) => {
                  const status = getStockStatus(item);
                  const stockVal = Number(item?.current_stock) || 0;
                  const costVal = Number(item?.cost_per_unit) || 0;
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-5">
                        <p className="font-bold text-white text-base">{item.name || 'Unnamed'}</p>
                        <p className="text-[9px] text-gray-500 uppercase font-black mt-1">SKU: {item.sku || 'N/A'}</p>
                      </td>
                      {canViewStock && (
                        <td className="px-8 py-5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge className={cn(
                              "px-2 py-0.5 rounded-full text-[8px] font-black uppercase border",
                              status === 'In stock' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                status === 'Low stock' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                  "bg-red-500/10 text-red-500 border-red-500/20"
                            )}>
                              {status}
                            </Badge>
                            {status === 'Low stock' && <span className="text-[8px] font-black text-yellow-500 uppercase flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> LOW</span>}
                          </div>
                        </td>
                      )}
                      <td className="px-8 py-5 text-center">
                        <Badge variant="outline" className="text-[10px] font-black uppercase text-gray-500 border-white/10">{item.unit_type || 'unit'}</Badge>
                      </td>
                      {canViewCost && (
                        <td className="px-8 py-5 text-right">
                          <span className="font-mono text-gray-300">ETB {costVal.toLocaleString()}</span>
                        </td>
                      )}
                      {canViewCost && (
                        <td className="px-8 py-5 text-right">
                          <span className="font-mono text-white font-black text-lg">
                            {(stockVal * costVal).toLocaleString()}
                          </span>
                        </td>
                      )}
                      <td className="px-8 py-5 text-right">
                        <RoleGuard
                          allowedRoles={['owner', 'admin', 'manager']}
                          fallback={
                            <Button size="sm" variant="ghost" disabled className="h-10 px-4 rounded-xl font-bold text-xs uppercase text-gray-600">
                              <Eye className="w-4 h-4 mr-2" /> View Only
                            </Button>
                          }
                        >
                          <Button size="sm" variant="ghost" onClick={() => handleEditClick(item)} className="h-10 px-4 rounded-xl hover:bg-primary/10 hover:text-primary transition-all font-bold text-xs uppercase">
                            <Edit3 className="w-4 h-4 mr-2" /> Adjust
                          </Button>
                        </RoleGuard>
                      </td>
                    </tr>
                  )
                })}
                {processedInventory.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="py-32 text-center text-gray-600">
                      <Database className="w-16 h-16 mx-auto mb-4 opacity-10" />
                      <p className="font-black uppercase tracking-[0.2em] text-xs">No SKUs Matched</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog isOpen={isModalOpen} onClose={() => !submitting && setIsModalOpen(false)} title="Ingredient Master Adjustment">
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">

          <div className="grid grid-cols-2 gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">SKU Identity</p>
              <p className="text-sm font-mono text-primary font-bold">{selectedItem?.sku || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Master Unit</p>
              <select
                value={formData.unit_type}
                onChange={e => setFormData({ ...formData, unit_type: e.target.value })}
                className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-sm text-primary font-bold outline-none focus:border-primary/50 w-full"
              >
                <option value="g">g (Grams)</option>
                <option value="kg">kg (Kilograms)</option>
                <option value="ml">ml (Milliliters)</option>
                <option value="l">l (Liters)</option>
                <option value="pcs">pcs (Pieces)</option>
                <option value="slice">slice (Slices)</option>
                <option value="unit">unit (General)</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Ingredient Name</p>
              <p className="text-sm text-white font-bold">{selectedItem?.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Category</p>
              <p className="text-sm text-white font-bold">{selectedItem?.category}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" /> Stock Configuration
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Current Stock</label>
                <Input
                  type="number"
                  step="any"
                  value={formData.current_stock}
                  onChange={e => setFormData({ ...formData, current_stock: parseFloat(e.target.value) || 0 })}
                  className="bg-black/60 border-white/10 text-primary font-mono font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Par Min</label>
                <Input
                  type="number"
                  value={formData.par_min}
                  onChange={e => setFormData({ ...formData, par_min: parseFloat(e.target.value) || 0 })}
                  className="bg-black/60 border-white/10 font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Par Max</label>
                <Input
                  type="number"
                  value={formData.par_max}
                  onChange={e => setFormData({ ...formData, par_max: parseFloat(e.target.value) || 0 })}
                  className="bg-black/60 border-white/10 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" /> Valuation & Life
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Cost Per Unit (ETB)</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 w-4 h-4 text-gray-600" />
                  <Input
                    type="number"
                    step="any"
                    value={formData.cost_per_unit}
                    onChange={e => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="pl-9 bg-black/60 border-white/10 font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Expiry Days</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-600" />
                  <Input
                    type="number"
                    value={formData.expiry_days}
                    onChange={e => setFormData({ ...formData, expiry_days: parseInt(e.target.value) || 0 })}
                    className="pl-9 bg-black/60 border-white/10 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col gap-3">
            {(formData.unit_type === 'pcs' || formData.unit_type === 'slice' || formData.unit_type === 'unit') && (
              <div className="mb-6 p-5 bg-primary/5 border border-primary/20 rounded-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <Scale className="w-4 h-4 text-primary" />
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Yield Mapping (Conversion)</h4>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <p className="text-[10px] text-gray-500 mb-2">How much does <strong>1 {formData.unit_type}</strong> weigh/measure in your base unit?</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-2">
                      <label className="text-[9px] font-bold text-gray-500 uppercase">Weight per Piece (Grams/ML)</label>
                      <Input
                        type="number"
                        value={formData.weight_per_unit}
                        onChange={e => setFormData({ ...formData, weight_per_unit: parseFloat(e.target.value) || 1 })}
                        className="bg-black/60 border-white/10 font-mono text-primary font-bold"
                      />
                    </div>
                    <div className="pt-6">
                      <Badge className="bg-primary/20 text-primary border-primary/20 font-black h-11 px-4">
                        1 {formData.unit_type} = {formData.weight_per_unit}g/ml
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <Button
              onClick={handleSave}
              className="w-full bg-primary text-black font-black h-14 rounded-2xl shadow-xl shadow-primary/10 text-sm uppercase tracking-widest transition-all hover:scale-[1.01]"
              isLoading={submitting}
            >
              {submitting ? "Processing Update..." : "Finalize Audit Updates"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              className="text-gray-500 text-xs font-bold uppercase tracking-widest"
              disabled={submitting}
            >
              Discard Changes
            </Button>
          </div>
        </div>
      </Dialog>
    </DashboardLayout>
  );
};

export default Inventory;
