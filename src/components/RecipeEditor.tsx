
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { MenuDish, Ingredient, Unit } from '@/types';
import { getConversionFactor, calculateMargins, RecipeIngredient, calculateIngredientCost } from '../lib/menuEconomics';
import { Input, Button, showToast, cn, Badge } from './ui';
import { Search, Plus, Trash2, Save, Loader2, ChefHat, Info, BookOpen, X, AlertTriangle } from 'lucide-react';

interface RecipeEditorProps {
  dish: MenuDish;
  onSaved: () => void;
}

interface LocalMapping {
  ingredient_id: string;
  name: string;
  quantity_needed: number;
  unit_id: string;          // Recipe Unit ID
  inventory_unit_id: string; // Original Inventory Unit ID
  inventory_unit_name: string; // For display
  cost_per_unit: number;    // Cost per Inventory Unit
  weight_per_unit: number;  // Grams/ML per piece
  yield_unit_name: string;  // Custom name (e.g. Cup)
  out_of_stock_impact: 'kills_dish' | 'disable_variant' | 'optional';
}

export const RecipeEditor: React.FC<RecipeEditorProps> = ({ dish, onSaved }) => {
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedMappings, setSelectedMappings] = useState<LocalMapping[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      setErrorState(null);
      try {
        // 1. Fetch master ingredient names, units, and COSTS
        let { data: ingData, error: ingError } = await supabase
          .from('ingredients')
          .select(`
            id, name, cost_per_unit, weight_per_unit, yield_unit_name,
            unit_id, units(id, abbreviation, name, type)
          `)
          .eq('is_active', true)
          .order('name');

        // Fallback if yield_unit_name doesn't exist yet (migration not applied)
        if (ingError && ingError.message.includes('yield_unit_name')) {
          console.warn("Backwards Compatibility: ingredients.yield_unit_name missing from schema. Falling back...");
          const { data: retryData, error: retryError } = await supabase
            .from('ingredients')
            .select(`
              id, name, cost_per_unit, weight_per_unit,
              unit_id, units(id, abbreviation, name, type)
            `)
            .eq('is_active', true)
            .order('name');
          ingData = retryData;
          ingError = retryError;
        }

        if (ingError) throw new Error(`Ingredients Table Error: ${ingError.message}`);
        if (ingData) setAllIngredients(ingData as any[]);

        // 1b. Fetch Units
        const { data: unitData } = await supabase.from('units').select('*').order('name');
        if (unitData) setUnits(unitData);

        // 2. Ensure Recipe Header exists for this dish
        let { data: existingRecipe, error: recFetchError } = await supabase
          .from('recipes')
          .select('id')
          .eq('menu_item_id', dish.id)
          .maybeSingle();

        if (recFetchError) throw new Error(`Recipes Table Error: ${recFetchError.message}`);

        let currentId = existingRecipe?.id;

        if (!currentId) {
          // Fetch Organization ID for initialization
          const { data: { user: authUser } } = await supabase.auth.getUser();
          const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', authUser?.id)
            .single();

          if (!profile?.organization_id) throw new Error("Organization context missing. Please re-login.");

          const { data: newRecipe, error: createError } = await supabase
            .from('recipes')
            .insert({
              menu_item_id: dish.id,
              name: dish.name,
              status: 'published',
              organization_id: profile.organization_id // Hardened requirement
            })
            .select()
            .single();

          if (createError) {
            // Handle race condition: if it failed because it was JUST created by another call
            if (createError.code === '23505') {
              const { data: retryFetch } = await supabase
                .from('recipes')
                .select('id')
                .eq('menu_item_id', dish.id)
                .maybeSingle();
              currentId = retryFetch?.id;
            } else {
              throw new Error(`Recipe Creation Failed: ${createError.message}`);
            }
          } else {
            currentId = newRecipe.id;
          }
        }

        setRecipeId(currentId);

        // 3. Load existing ingredients linked to this recipe
        let { data: mappings, error: mapError } = await supabase
          .from('recipe_ingredients')
          .select(`
            ingredient_id,
            quantity_needed,
            unit_id,
            out_of_stock_impact,
            ingredient:ingredients(name, unit_id, cost_per_unit, weight_per_unit, yield_unit_name, units(*))
          `)
          .eq('recipe_id', currentId);

        // Fallback for missing yield_unit_name
        if (mapError && mapError.message.includes('yield_unit_name')) {
          const { data: retryData, error: retryError } = await supabase
            .from('recipe_ingredients')
            .select(`
              ingredient_id,
              quantity_needed,
              unit_id,
              out_of_stock_impact,
              ingredient:ingredients(name, unit_id, cost_per_unit, weight_per_unit, units(*))
            `)
            .eq('recipe_id', currentId);
          mappings = retryData as any;
          mapError = retryError;
        }

        if (mapError) throw new Error(`Mapping Table Error: ${mapError.message}`);

        if (mappings) {
          setSelectedMappings(mappings.map((m: any) => ({
            ingredient_id: m.ingredient_id,
            name: m.ingredient?.name || 'Unknown',
            quantity_needed: m.quantity_needed || 0,
            unit_id: m.unit_id || m.ingredient?.unit_id || '',
            inventory_unit_id: m.ingredient?.unit_id || '',
            inventory_unit_name: m.ingredient?.units?.abbreviation || 'unit',
            cost_per_unit: m.ingredient?.cost_per_unit || 0,
            weight_per_unit: m.ingredient?.weight_per_unit || 1,
            yield_unit_name: m.ingredient?.yield_unit_name || 'None',
            out_of_stock_impact: m.out_of_stock_impact || 'kills_dish'
          })));
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
        setErrorState(err.message || "Unknown database error");
        showToast("Failed to load recipe system", "error");
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [dish.id]);

  const addIngredient = (item: Ingredient) => {
    if (selectedMappings.some(m => m.ingredient_id === item.id)) {
      showToast(`${item.name} is already listed`, "warning");
      setSearchTerm('');
      return;
    }

    setSelectedMappings(prev => [...prev, {
      ingredient_id: item.id,
      name: item.name,
      quantity_needed: 1,
      unit_id: item.unit_id || '', // Default to inventory unit
      inventory_unit_id: item.unit_id || '',
      inventory_unit_name: item.units?.abbreviation || 'unit',
      cost_per_unit: item.cost_per_unit || 0,
      weight_per_unit: item.weight_per_unit || 1,
      yield_unit_name: item.yield_unit_name || 'Piece',
      out_of_stock_impact: 'kills_dish'
    }]);
    setSearchTerm('');
  };

  const removeIngredient = (id: string) => {
    setSelectedMappings(prev => prev.filter(m => m.ingredient_id !== id));
  };

  const updateQty = (id: string, val: string) => {
    const num = parseFloat(val) || 0;
    setSelectedMappings(prev => prev.map(m =>
      m.ingredient_id === id ? { ...m, quantity_needed: num } : m
    ));
  };

  const updateUnit = (id: string, unitId: string) => {
    setSelectedMappings(prev => prev.map(m =>
      m.ingredient_id === id ? { ...m, unit_id: unitId } : m
    ));
  };

  const updateImpact = (id: string, impact: any) => {
    setSelectedMappings(prev => prev.map(m =>
      m.ingredient_id === id ? { ...m, out_of_stock_impact: impact } : m
    ));
  };

  const handleCommit = async () => {
    if (!recipeId) return;
    setSaving(true);
    try {
      // Fetch organization_id to satisfy Kernel hardening constraints
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      const orgId = profile?.organization_id;
      if (!orgId) throw new Error("Organization context missing. Please re-login.");

      const { error: deleteError } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', recipeId);

      if (deleteError) throw deleteError;

      if (selectedMappings.length > 0) {
        const payload = selectedMappings.map(m => ({
          recipe_id: recipeId,
          ingredient_id: m.ingredient_id,
          quantity_needed: m.quantity_needed,
          unit_id: m.unit_id,
          out_of_stock_impact: m.out_of_stock_impact,
          organization_id: orgId // Hardened multi-tenancy requirement
        }));

        const { error: insertError } = await supabase
          .from('recipe_ingredients')
          .insert(payload);

        if (insertError) throw insertError;
      }

      showToast(`Recipe for ${dish.name} updated!`, "success");
      onSaved();
    } catch (err: any) {
      showToast(err.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const totalCost = useMemo(() => {
    return selectedMappings.reduce((sum, m) => {
      // Pass the unit registry so UUIDs can be resolved correctly
      return sum + calculateIngredientCost(m as unknown as RecipeIngredient, units);
    }, 0);
  }, [selectedMappings, units]);

  const { marginPercent } = useMemo(() => {
    return calculateMargins(dish.price, totalCost);
  }, [dish.price, totalCost]);

  const filteredResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return allIngredients.filter(i =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !selectedMappings.some(m => m.ingredient_id === i.id)
    ).slice(0, 5);
  }, [allIngredients, searchTerm, selectedMappings]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Initializing Recipe Logic...</p>
      </div>
    );
  }

  if (errorState) {
    return (
      <div className="py-20 flex flex-col items-center text-center px-6">
        <div className="p-4 bg-red-500/10 rounded-full mb-4">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h3 className="text-white font-bold text-lg mb-2">Schema Initialization Failed</h3>
        <p className="text-xs text-gray-500 mb-6 max-w-xs">{errorState}</p>
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-left">
          <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1">Recommended Fix:</p>
          <p className="text-[10px] text-gray-400">Please run the <strong>Full System Blueprint SQL</strong> found in the Setup Guide to initialize your inventory and recipe tables.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Search Header */}
      <div className="relative">
        <Search className={cn(
          "absolute left-4 top-3.5 h-4 w-4 transition-colors",
          isFocused ? "text-primary" : "text-gray-500"
        )} />
        <Input
          placeholder="Search master ingredients..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          className="pl-12 bg-black/40 border-white/10 h-10 md:h-12 text-sm md:text-base rounded-2xl focus:border-primary/50"
        />

        {isFocused && searchTerm && (
          <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {filteredResults.length > 0 ? (
              filteredResults.map(item => (
                <button
                  key={item.id}
                  onMouseDown={(e) => { e.preventDefault(); addIngredient(item); }}
                  className="w-full text-left px-5 py-4 hover:bg-primary/10 flex justify-between items-center transition-colors border-b border-white/5 last:border-0 group"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white block group-hover:text-primary">{item.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest opacity-40">{item.units?.abbreviation || 'UNIT'} Spec</span>
                  </div>
                  <Plus className="w-4 h-4 text-primary opacity-40 group-hover:opacity-100" />
                </button>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-gray-500 text-xs italic">No matching ingredients.</div>
            )}
          </div>
        )}
      </div>

      {/* Mapping List */}
      <div className="rounded-[2rem] bg-black/30 border border-white/5 overflow-hidden">
        <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="bg-black/60 text-[9px] md:text-[10px] font-black uppercase text-gray-500 tracking-widest sticky top-0 z-10 border-b border-white/5">
              <tr>
                <th className="px-3 md:px-4 py-3 md:py-5">Ingredient</th>
                <th className="px-3 md:px-4 py-3 md:py-5 text-center">Portion</th>
                <th className="px-3 md:px-4 py-3 md:py-5 text-center whitespace-nowrap">Impact Flag</th>
                <th className="px-3 md:px-4 py-3 md:py-5 text-right whitespace-nowrap">Cost (ETB)</th>
                <th className="px-3 md:px-4 py-3 md:py-5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {selectedMappings.length > 0 ? (
                selectedMappings.map(m => (
                  <tr key={m.ingredient_id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-white whitespace-nowrap">{m.name}</span>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[8px] text-gray-600 uppercase font-black tracking-tighter">Inv Unit:</span>
                          <Badge variant="outline" className="text-[7px] px-1 h-3 border-gray-800 text-gray-500 uppercase">{m.inventory_unit_name}</Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-center gap-2">
                        <Input
                          type="number"
                          value={m.quantity_needed}
                          onChange={e => updateQty(m.ingredient_id, e.target.value)}
                          className="h-10 w-16 bg-black/40 border-white/10 text-center font-mono text-primary font-bold rounded-lg"
                        />
                        <select
                          value={m.unit_id}
                          onChange={e => updateUnit(m.ingredient_id, e.target.value)}
                          className="w-full bg-black/60 border border-primary/20 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-primary/50 appearance-none"
                        >
                          {(() => {
                            const uniqueOptions = new Map();
                            units
                              .filter(u => u.type !== 'count' || (m.yield_unit_name && m.yield_unit_name !== 'None'))
                              .forEach(u => {
                                const label = u.type === 'count' ? m.yield_unit_name : u.abbreviation;
                                if (!uniqueOptions.has(label)) {
                                  uniqueOptions.set(label, u.id);
                                }
                              });
                            
                            return Array.from(uniqueOptions.entries()).map(([label, id]) => (
                              <option key={id} value={id} className="bg-[#0A0A0A] text-white">
                                {label}
                              </option>
                            ));
                          })()}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={m.out_of_stock_impact}
                        onChange={e => updateImpact(m.ingredient_id, e.target.value)}
                        className="bg-black/60 border border-primary/20 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-primary/50 w-full appearance-none"
                      >
                        <option value="kills_dish" className="bg-[#0A0A0A] text-white">Kills Entire Dish</option>
                        <option value="removes_option" className="bg-[#0A0A0A] text-white">Removes Choice</option>
                        <option value="warning_only" className="bg-[#0A0A0A] text-white">Warning Only</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-white text-xs">
                      {calculateIngredientCost(m as unknown as RecipeIngredient, units).toFixed(2)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button onClick={() => removeIngredient(m.ingredient_id)} className="text-gray-700 hover:text-red-500 transition-colors p-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <ChefHat className="w-12 h-12 text-white" />
                      <p className="font-black uppercase tracking-widest text-[10px]">No Ingredients Linked</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-black/60 p-4 px-8 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Total Cost</p>
              <p className="text-sm font-black text-white font-mono">ETB {totalCost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Profit Margin</p>
              <Badge className={cn(
                "text-[9px] font-black uppercase",
                marginPercent > 40 ? "bg-green-500/10 text-green-500" :
                  marginPercent > 20 ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500"
              )}>
                {marginPercent.toFixed(0)}% Margin
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Selling Price</p>
            <p className="text-sm font-black text-primary font-mono">ETB {dish.price.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4 space-y-4">
        <Button
          onClick={handleCommit}
          disabled={saving}
          className="w-full bg-primary text-black font-black h-12 md:h-16 rounded-2xl shadow-xl shadow-primary/20 text-[10px] md:text-xs uppercase tracking-[0.2em] transition-all hover:scale-[1.01] active:scale-95"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Commit Recipe Logic
        </Button>
        <div className="flex items-center gap-2 justify-center text-gray-600 bg-white/5 p-4 rounded-xl">
          <Info className="w-4 h-4" />
          <p className="text-[10px] uppercase font-black tracking-widest">
            This configuration triggers automated stock deduction upon order completion.
          </p>
        </div>
      </div>
    </div>
  );
};
