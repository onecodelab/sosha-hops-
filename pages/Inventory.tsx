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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card/60 backdrop-blur-xl border border-border p-8 rounded-[2.5rem] shadow-2xl relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <div className="relative z-10 flex flex-col gap-2">
              <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Total Asset Valuation</p>
              <h3 className="text-4xl font-black text-foreground tracking-tighter">
                <span className="text-xs font-black mr-1 opacity-40">ETB</span>
                {(stats.totalValue || 0).toLocaleString()}
              </h3>
            </div>
            <div className="absolute top-6 right-6 p-4 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6 text-primary" strokeWidth={3} />
            </div>
          </div>
          <div className={cn(
            "p-8 rounded-[2.5rem] border shadow-2xl transition-all relative group overflow-hidden",
            stats.lowStockCount > 0 ? "bg-red-500/5 border-red-500/20" : "bg-card/60 backdrop-blur-xl border-border"
          )}>
            {stats.lowStockCount > 0 && <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent pointer-events-none" />}
            <div className="relative z-10 flex flex-col gap-2">
              <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Re-order Alerts</p>
              <h3 className={cn("text-4xl font-black tracking-tighter", stats.lowStockCount > 0 ? "text-red-500" : "text-foreground")}>
                {stats.lowStockCount} <span className="text-xs font-black opacity-40">Low SKUs</span>
              </h3>
            </div>
            <div className={cn("absolute top-6 right-6 p-4 rounded-2xl group-hover:scale-110 transition-transform", stats.lowStockCount > 0 ? "bg-red-500/10" : "bg-muted/10")}>
              <AlertTriangle className={cn("w-6 h-6", stats.lowStockCount > 0 ? "text-red-500" : "text-muted")} strokeWidth={3} />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-6 bg-card/60 backdrop-blur-xl p-6 rounded-[2.5rem] border border-border shadow-2xl">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-14 bg-muted/10 border-border h-14 rounded-2xl focus:border-primary/50 text-sm font-bold shadow-inner"
            />
          </div>
          <Button onClick={fetchInventory} variant="ghost" className="h-14 w-14 p-0 rounded-2xl bg-muted/5 border border-border text-muted hover:text-foreground transition-all">
            <RefreshCw className={cn("h-6 w-6", loading && "animate-spin")} strokeWidth={3} />
          </Button>
        </div>

        <div className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-muted uppercase bg-muted/10 border-b border-border font-black tracking-[0.2em] backdrop-blur-md">
                <tr>
                  <th className="px-8 py-6 text-left w-[25%]">Asset Node</th>
                  {canViewStock && <th className="px-8 py-6 text-center w-[15%]">Stock Health</th>}
                  {canViewCost && <th className="px-8 py-6 text-right w-[25%]">Risk & Valuation</th>}
                  <th className="px-8 py-6 text-left w-[25%]">Intelligence</th>
                  <th className="px-8 py-6 text-right w-[10%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {processedInventory.map((item) => {
                  const status = getStockStatus(item);
                  const stockVal = Number(item?.current_stock) || 0;
                  const costVal = Number(item?.cost_per_unit) || 0;
                  const totalVal = stockVal * costVal;
                  const riskVal = (item as any).revenue_at_risk_7d || 0;
                  const daysLeft = (item as any).days_of_stock_left || 0;

                  return (
                    <tr key={item.id} className="hover:bg-primary/[0.02] transition-colors group">

                      {/* 1. Item Details */}
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-foreground text-base tracking-tight">{item.name || 'Unnamed'}</span>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] text-muted font-black bg-muted/10 px-2 py-0.5 rounded-lg uppercase tracking-widest shadow-inner">{item.sku || '---'}</span>
                            <span className="text-[10px] text-muted font-black uppercase tracking-widest opacity-60">per {item.unit_type || 'unit'}</span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Supply Health (Days Left + Stock) */}
                      {canViewStock && (
                        <td className="px-8 py-6 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-baseline gap-2">
                              <span className={cn(
                                "text-2xl font-black tracking-tighter",
                                daysLeft < 3 ? "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]" :
                                  daysLeft < 7 ? "text-amber-500" : "text-emerald-500"
                              )}>
                                {daysLeft > 90 ? '90+' : Math.round(daysLeft)}
                              </span>
                              <span className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40">Days</span>
                            </div>
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest opacity-60">
                              {stockVal.toLocaleString()} {item.unit_type}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* 3. Financial & Risk */}
                      {canViewCost && (
                        <td className="px-8 py-6 text-right">
                          <div className="flex flex-col items-end gap-2">
                            <span className="font-black text-foreground text-base tracking-tight">
                              <span className="text-[10px] font-black mr-1 opacity-40">ETB</span>
                              {totalVal.toLocaleString()}
                            </span>
                            {riskVal > 0 ? (
                              <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-red-500/10 border border-red-500/20 shadow-sm animate-pulse">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500" strokeWidth={3} />
                                <span className="text-[9px] font-black text-red-500 uppercase tracking-[0.2em]">
                                  Risk: {riskVal.toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[9px] font-black text-emerald-500/40 uppercase tracking-[0.2em]">Asset Secured</span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* 4. Intelligence & Status */}
                      <td className="px-8 py-6">
                        <div className="flex flex-wrap gap-2">
                          {getSmartLabels(item).map((label, idx) => (
                            <span key={idx} className={cn("px-4 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest shadow-lg", label.color)}>
                              {label.text}
                            </span>
                          ))}
                          {getSmartLabels(item).length === 0 && (
                            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-widest shadow-lg">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" /> Optimized
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Action */}
                      <td className="px-8 py-6 text-right">
                        <RoleGuard
                          allowedRoles={['owner', 'admin']}
                          fallback={<Eye className="w-5 h-5 text-muted mx-auto opacity-20" />}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditClick(item)}
                            className="h-12 w-12 p-0 rounded-2xl bg-muted/5 border border-border text-muted hover:text-primary transition-all shadow-inner"
                          >
                            <Edit3 className="w-5 h-5" strokeWidth={3} />
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

      <Dialog isOpen={isModalOpen} onClose={() => !submitting && setIsModalOpen(false)} title="Intelligence Node: Master Adjustment">
        <div className="space-y-8 max-h-[75vh] overflow-y-auto px-1 py-2 custom-scrollbar">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-8 bg-muted/5 border border-border rounded-[2rem] shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <div className="space-y-1.5 relative z-10">
              <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">Node Identity (SKU)</p>
              <p className="text-sm font-mono text-primary font-black uppercase">{selectedItem?.sku || 'N/A'}</p>
            </div>
            <div className="space-y-1.5 relative z-10">
              <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">Master Metric Unit</p>
              <select
                value={formData.unit_type}
                onChange={e => setFormData({ ...formData, unit_type: e.target.value })}
                className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-black outline-none focus:border-primary/50 w-full transition-all shadow-sm"
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
            <div className="space-y-1.5 relative z-10">
              <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">Asset Descriptor</p>
              <p className="text-base text-foreground font-black tracking-tight">{selectedItem?.name}</p>
            </div>
            <div className="space-y-1.5 relative z-10">
              <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">Asset Class</p>
              <p className="text-[10px] text-foreground font-black uppercase tracking-widest">{selectedItem?.category}</p>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Scale className="w-4 h-4 text-primary" strokeWidth={3} />
              </div>
              Stock Capacity Protocol
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2.5">
                <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Live Reality (Current)</label>
                <Input
                  type="number"
                  step="any"
                  value={formData.current_stock === 0 ? '0' : formData.current_stock}
                  onChange={e => setFormData({ ...formData, current_stock: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
                  className="bg-muted/10 border-border text-primary font-mono font-black h-12 rounded-xl text-lg shadow-inner"
                />
              </div>
              <div className="space-y-2.5">
                <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Lower Bound (Min)</label>
                <Input
                  type="number"
                  value={formData.par_min === 0 ? '0' : formData.par_min}
                  onChange={e => setFormData({ ...formData, par_min: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
                  className="bg-muted/10 border-border text-foreground font-mono font-black h-12 rounded-xl text-lg shadow-inner"
                />
              </div>
              <div className="space-y-2.5">
                <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Upper Bound (Max)</label>
                <Input
                  type="number"
                  value={formData.par_max === 0 ? '0' : formData.par_max}
                  onChange={e => setFormData({ ...formData, par_max: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
                  className="bg-muted/10 border-border text-foreground font-mono font-black h-12 rounded-xl text-lg shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <DollarSign className="w-4 h-4 text-emerald-500" strokeWidth={3} />
              </div>
              Valuation & Lifecycle
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Acquisition Cost (ETB)</label>
                <div className="relative group">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-emerald-500 transition-colors" strokeWidth={3} />
                  <Input
                    type="number"
                    step="any"
                    value={formData.cost_per_unit === 0 ? '0' : formData.cost_per_unit}
                    onChange={e => setFormData({ ...formData, cost_per_unit: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}
                    className="pl-12 bg-muted/10 border-border text-foreground font-mono font-black h-12 rounded-xl shadow-inner text-lg"
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Shelf Stability (Days)</label>
                <div className="relative group">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-amber-500 transition-colors" strokeWidth={3} />
                  <Input
                    type="number"
                    value={formData.expiry_days === 0 ? '0' : formData.expiry_days}
                    onChange={e => setFormData({ ...formData, expiry_days: e.target.value === '' ? '' : parseInt(e.target.value) } as any)}
                    className="pl-12 bg-muted/10 border-border text-foreground font-mono font-black h-12 rounded-xl shadow-inner text-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col gap-4">
            {(formData.unit_type === 'pcs' || formData.unit_type === 'slice' || formData.unit_type === 'unit') && (
              <div className="mb-8 p-6 bg-primary/5 border border-primary/20 rounded-[2rem] animate-in zoom-in-95 duration-500 shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <Scale className="w-5 h-5 text-primary" strokeWidth={3} />
                  <h4 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em]">Yield Mapping Protocol</h4>
                </div>
                <div className="space-y-4 relative z-10">
                  <p className="text-[11px] text-muted font-bold leading-relaxed px-1">Configure conversion ratio: define the mass/volume equivalent for a single discrete unit.</p>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 w-full space-y-2">
                      <label className="text-[9px] font-black text-muted uppercase tracking-widest px-1">Base Metric Weight (g/ml)</label>
                      <Input
                        type="number"
                        value={formData.weight_per_unit}
                        onChange={e => setFormData({ ...formData, weight_per_unit: parseFloat(e.target.value) || 1 })}
                        className="bg-muted/10 border-border font-mono text-primary font-black h-12 rounded-xl shadow-inner text-lg"
                      />
                    </div>
                    <div className="pt-2 md:pt-6 w-full md:w-auto">
                      <div className="bg-primary/10 border border-primary/30 rounded-2xl h-14 px-6 flex items-center justify-center gap-3 shadow-lg">
                        <span className="text-[10px] font-black text-primary uppercase">1 {formData.unit_type}</span>
                        <div className="w-3 h-[1px] bg-primary/30" />
                        <span className="text-xl font-black text-primary tracking-tighter">{formData.weight_per_unit}g/ml</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <Button
              onClick={handleSave}
              className="w-full bg-foreground text-background font-black h-16 rounded-[2rem] shadow-2xl text-[10px] uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
              isLoading={submitting}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              {submitting ? "Processing Node Sync..." : "Confirm Intelligence Update"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              className="text-muted text-[9px] font-black uppercase tracking-[0.2em] h-12 hover:text-foreground transition-colors"
              disabled={submitting}
            >
              Terminate Session
            </Button>
          </div>
        </div>
      </Dialog>
    </DashboardLayout>
  );
};

export default Inventory;
