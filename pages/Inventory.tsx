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
import { useBranch } from '../contexts/BranchContext';

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
  const { activeBranchId } = useBranch();
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
    if (!activeBranchId) return;
    fetchInventory();

    // Subscribe to both ingredients (for global info) and branch_inventory (for stock)
    const ingredientsSub = supabase.channel('ingredients_sync_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, () => fetchInventory())
      .subscribe();

    const branchSub = supabase.channel('branch_inventory_sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'branch_inventory',
        filter: `branch_id=eq.${activeBranchId}`
      }, () => fetchInventory())
      .subscribe();

    return () => {
      supabase.removeChannel(ingredientsSub);
      supabase.removeChannel(branchSub);
    };
  }, [activeBranchId]);

  const fetchInventory = async () => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      // Since 'view_inventory_intelligence' might not be fully branch-aware yet for all fields,
      // we'll fetch from ingredients and join branch_inventory for the current branch truth.
      // We still use intelligence view if possible, but let's favor branch truth for operational fields.
      const { data, error } = await supabase
        .from('ingredients')
        .select(`
          *,
          branch_inventory!left(current_stock, par_min, par_max, last_updated)
        `)
        .eq('is_active', true)
        .eq('branch_inventory.branch_id', activeBranchId);

      if (error) throw error;

      // Transform data to flatten branch_inventory
      const flattened = (data || []).map(item => {
        const bStock = Array.isArray(item.branch_inventory) ? item.branch_inventory[0] : item.branch_inventory;
        return {
          ...item,
          current_stock: bStock?.current_stock ?? 0,
          par_min: bStock?.par_min ?? 0,
          par_max: bStock?.par_max ?? 0,
          // Fallback for intelligence fields if missing
          days_of_stock_left: (item as any).days_of_stock_left ?? (bStock?.current_stock > 0 ? 30 : 0),
          revenue_at_risk_7d: (item as any).revenue_at_risk_7d ?? 0,
          velocity_ratio: (item as any).velocity_ratio ?? 1.0
        };
      });

      setInventory(flattened as any[]);
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
    if (!selectedItem || !activeBranchId) return;
    setSubmitting(true);

    try {
      // 1. Update Global Ingredient Definitions
      const globalUpdate = {
        cost_per_unit: Number(formData.cost_per_unit),
        expiry_days: Math.floor(Number(formData.expiry_days)),
        unit_type: formData.unit_type,
        weight_per_unit: Number(formData.weight_per_unit),
        updated_at: new Date().toISOString()
      };

      const { error: globalErr } = await supabase
        .from('ingredients')
        .update(globalUpdate)
        .eq('id', selectedItem.id);

      if (globalErr) throw globalErr;

      // 2. Update Branch-Specific Reality (UPSERT into branch_inventory)
      if (formData.par_max < formData.par_min && formData.par_max > 0) {
        throw new Error("Par Max cannot be less than Par Min");
      }

      const branchUpdate = {
        branch_id: activeBranchId,
        ingredient_id: selectedItem.id,
        current_stock: Number(formData.current_stock),
        par_min: Number(formData.par_min),
        par_max: Number(formData.par_max),
        last_updated: new Date().toISOString()
      };

      const { error: branchErr } = await supabase
        .from('branch_inventory')
        .upsert(branchUpdate, { onConflict: 'branch_id,ingredient_id' });

      if (branchErr) throw branchErr;

      await fetchInventory();
      showToast(`Inventory for ${selectedItem.name} updated in this branch!`, "success");
      setIsModalOpen(false);
      setSelectedItem(null);

    } catch (err: any) {
      console.error("Critical Save failure:", err);
      showToast(err.message || "Failed to save changes", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for Smart Labels
  const getSmartLabels = (item: any) => {
    const labels = [];

    // 1. Critical High Risk
    if (item.revenue_at_risk_7d > 5000 && item.days_of_stock_left < 3) {
      labels.push({ text: 'CRITICAL', color: 'bg-red-500 text-white' });
    }

    // 2. Velocity
    if (item.velocity_ratio > 1.3) labels.push({ text: 'Velocity High', color: 'bg-orange-500/20 text-orange-400' });
    if (item.velocity_ratio < 0.8 && item.days_of_stock_left > 14) labels.push({ text: 'Slow Moving', color: 'bg-blue-500/20 text-blue-400' });

    // 3. Days Left
    if (item.days_of_stock_left < 3) labels.push({ text: '< 3 Days', color: 'bg-red-500/10 text-red-500 border border-red-500/20' });
    else if (item.days_of_stock_left < 7) labels.push({ text: '< 7 Days', color: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' });

    // 4. Waste Risk
    if (item.days_of_stock_left > 60 && item.cost_per_unit > 100) {
      labels.push({ text: 'Overstock Risk', color: 'bg-purple-500/20 text-purple-400' });
    }

    return labels;
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
          <div className="bg-[#1A1A1A] border border-gray-800 p-5 rounded-2xl shadow-sm">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.1em]">Total Asset Valuation</p>
            <h3 className="text-2xl font-black text-white mt-1">ETB {(stats.totalValue || 0).toLocaleString()}</h3>
          </div>
          <div className={cn("p-5 rounded-2xl border shadow-sm transition-colors", stats.lowStockCount > 0 ? "bg-[#1A1A1A] border-red-500/50" : "bg-[#1A1A1A] border-gray-800")}>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.1em]">Re-order Alerts</p>
            <h3 className={cn("text-2xl font-black mt-1", stats.lowStockCount > 0 ? "text-red-400" : "text-white")}>{stats.lowStockCount} Low SKUs</h3>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-4 bg-[#1A1A1A] p-3 rounded-[1.5rem] border border-gray-800 shadow-xl">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-11 bg-black/40 border-gray-800 h-11 rounded-xl focus:border-primary/50"
            />
          </div>
          <Button onClick={fetchInventory} variant="outline" size="icon" className="h-11 w-11 bg-black/40 border-gray-800 hover:bg-black hover:border-gray-700">
            <RefreshCw className={cn("h-4 w-4 text-gray-400", loading && "animate-spin")} />
          </Button>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-[2rem] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-zinc-500 uppercase bg-black/40 border-b border-white/5 font-bold tracking-widest backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 text-left w-[25%]">Item Details</th>
                  {canViewStock && <th className="px-6 py-4 text-center w-[15%]">Supply Health</th>}
                  {canViewCost && <th className="px-6 py-4 text-right w-[25%]">Financial & Risk</th>}
                  <th className="px-6 py-4 text-left w-[25%]">Intelligence & Status</th>
                  <th className="px-6 py-4 text-right w-[10%]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {processedInventory.map((item) => {
                  const status = getStockStatus(item);
                  const stockVal = Number(item?.current_stock) || 0;
                  const costVal = Number(item?.cost_per_unit) || 0;
                  const totalVal = stockVal * costVal;
                  const riskVal = (item as any).revenue_at_risk_7d || 0;
                  const daysLeft = (item as any).days_of_stock_left || 0;

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group border-b border-white/5 last:border-0">

                      {/* 1. Item Details */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm tracking-tight">{item.name || 'Unnamed'}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-zinc-500 font-mono bg-white/5 px-1.5 py-0.5 rounded uppercase tracking-wider">{item.sku || '---'}</span>
                            <span className="text-[10px] text-zinc-500 font-medium">per {item.unit_type || 'unit'}</span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Supply Health (Days Left + Stock) */}
                      {canViewStock && (
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <div className="flex items-baseline gap-1">
                              <span className={cn(
                                "text-lg font-black font-mono tracking-tighter",
                                daysLeft < 3 ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                                  daysLeft < 7 ? "text-yellow-400" : "text-emerald-400"
                              )}>
                                {daysLeft > 90 ? '90+' : Math.round(daysLeft)}
                              </span>
                              <span className="text-[10px] font-bold text-zinc-600 uppercase">Days</span>
                            </div>
                            <span className="text-[10px] font-medium text-zinc-400 mt-1">
                              {stockVal.toLocaleString()} {item.unit_type}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* 3. Financial & Risk */}
                      {canViewCost && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono text-zinc-300 font-medium text-sm">
                              ETB {totalVal.toLocaleString()}
                            </span>
                            {riskVal > 0 ? (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                                <AlertTriangle className="w-3 h-3 text-red-500" />
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">
                                  Risk: {riskVal.toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-700 font-medium">Safe</span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* 4. Intelligence & Status */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {getSmartLabels(item).map((label, idx) => (
                            <span key={idx} className={cn("px-2 py-1 rounded border text-[9px] font-black uppercase tracking-wider shadow-sm", label.color)}>
                              {label.text}
                            </span>
                          ))}
                          {getSmartLabels(item).length === 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/5 border border-emerald-500/10 text-emerald-500/60 text-[9px] font-bold uppercase tracking-wider">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" /> Stable
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Action */}
                      <td className="px-6 py-4 text-right">
                        <RoleGuard
                          allowedRoles={['owner', 'admin']}
                          fallback={<Eye className="w-4 h-4 text-zinc-700 mx-auto" />}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditClick(item)}
                            className="h-8 w-8 p-0 rounded-lg hover:bg-white/10 hover:text-white transition-all"
                          >
                            <Edit3 className="w-4 h-4 text-zinc-400" />
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
        </div>
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
                  value={formData.current_stock === 0 ? '0' : formData.current_stock}
                  onChange={e => setFormData({ ...formData, current_stock: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
                  className="bg-black/60 border-white/10 text-primary font-mono font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Par Min</label>
                <Input
                  type="number"
                  value={formData.par_min === 0 ? '0' : formData.par_min}
                  onChange={e => setFormData({ ...formData, par_min: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
                  className="bg-black/60 border-white/10 font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Par Max</label>
                <Input
                  type="number"
                  value={formData.par_max === 0 ? '0' : formData.par_max}
                  onChange={e => setFormData({ ...formData, par_max: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
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
                    value={formData.cost_per_unit === 0 ? '0' : formData.cost_per_unit}
                    onChange={e => setFormData({ ...formData, cost_per_unit: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
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
                    value={formData.expiry_days === 0 ? '0' : formData.expiry_days}
                    onChange={e => setFormData({ ...formData, expiry_days: e.target.value === '' ? '' : parseInt(e.target.value) } as any)}
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
