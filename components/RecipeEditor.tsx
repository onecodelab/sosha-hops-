
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { MenuDish, Ingredient } from '../types';
import { Input, Button, showToast, cn } from './ui';
import { Search, Plus, Trash2, Save, Loader2, ChefHat, Info, BookOpen, X } from 'lucide-react';

interface RecipeEditorProps {
  dish: MenuDish;
  onSaved: () => void;
}

interface LocalMapping {
  ingredient_id: string;
  name: string;
  quantity_needed: number;
  unit_type: string;
}

export const RecipeEditor: React.FC<RecipeEditorProps> = ({ dish, onSaved }) => {
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [selectedMappings, setSelectedMappings] = useState<LocalMapping[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      setErrorDetails(null);

      const handleTableError = (tableLabel: string, error: any) => {
        console.error(`[RecipeEditor] ${tableLabel} error:`, error);
        if (error?.code === '42P01') {
          const message = `${tableLabel} Table Error: missing or misconfigured. Run the Blueprint SQL v7.0 in Supabase, then refresh.`;
          setErrorDetails(message);
          showToast(message, 'error');
        } else {
          const message = error?.message || `Failed to load ${tableLabel} data.`;
          setErrorDetails(message);
          showToast(message, 'error');
        }
      };

      try {
        // 1. Fetch master ingredient names and units
        const { data: ingData, error: ingError } = await supabase
          .from('ingredients')
          .select('id, name, unit_type')
          .eq('is_active', true)
          .order('name');

        if (ingError) {
          handleTableError('Ingredients', ingError);
          return;
        }

        if (ingData) {
          setAllIngredients(ingData as any[]);
          if (ingData.length === 0) {
            setErrorDetails(
              'Inventory Registry is empty. Seed ingredients in the Inventory tab before mapping them to this dish.'
            );
          }
        }

        // 2. Ensure Recipe Header exists for this dish
        const { data: existingRecipe, error: headerError } = await supabase
          .from('recipes')
          .select('id')
          .eq('menu_item_id', dish.id)
          .maybeSingle();

        if (headerError) {
          handleTableError('Recipes', headerError);
          return;
        }

        let currentId = existingRecipe?.id as string | undefined;

        if (!currentId) {
          const { data: newRecipe, error: createError } = await supabase
            .from('recipes')
            .insert({
              menu_item_id: dish.id,
              name: dish.name,
              status: 'published'
            })
            .select()
            .single();
          
          if (createError) {
            handleTableError('Recipes', createError);
            return;
          }
          currentId = newRecipe.id;
        }

        setRecipeId(currentId || null);

        // 3. Load existing ingredients linked to this recipe
        const { data: mappings, error: mapError } = await supabase
          .from('recipe_ingredients')
          .select(`
            ingredient_id,
            quantity_needed,
            unit_type,
            ingredient:ingredients(name, unit_type)
          `)
          .eq('recipe_id', currentId);

        if (mapError) {
          handleTableError('Recipe Ingredients', mapError);
          return;
        }

        if (mappings) {
          setSelectedMappings(
            mappings.map((m: any) => ({
              ingredient_id: m.ingredient_id,
              name: m.ingredient?.name || 'Unknown',
              quantity_needed: m.quantity_needed || 0,
              unit_type: m.unit_type || m.ingredient?.unit_type || 'g'
            }))
          );
        }
      } catch (err: any) {
        console.error('Initialization error:', err);
        showToast('Failed to load recipe system', 'error');
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
      unit_type: item.unit_type || 'g'
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

  const handleCommit = async () => {
    if (!recipeId) return;
    setSaving(true);
    try {
      // 1. Standard Overwrite: Wipe existing links
      const { error: deleteError } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', recipeId);

      if (deleteError) throw deleteError;

      // 2. Insert new mappings
      if (selectedMappings.length > 0) {
        const payload = selectedMappings.map(m => ({
          recipe_id: recipeId,
          ingredient_id: m.ingredient_id,
          quantity_needed: m.quantity_needed,
          unit_type: m.unit_type || 'g'
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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Diagnostics */}
      {errorDetails && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-start gap-3 text-xs text-red-300">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-black uppercase tracking-[0.2em] text-[9px] mb-1">Recipe System Diagnostics</p>
            <p className="leading-relaxed">{errorDetails}</p>
          </div>
        </div>
      )}

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
           className="pl-12 bg-black/40 border-white/10 h-12 rounded-2xl focus:border-primary/50"
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
                      <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest opacity-40">{item.unit_type} Spec</span>
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
                <thead className="bg-black/60 text-[10px] font-black uppercase text-gray-500 tracking-widest sticky top-0 z-10 border-b border-white/5">
                  <tr>
                      <th className="px-8 py-5">Ingredient Name</th>
                      <th className="px-8 py-5 w-40 text-center">Qty Needed</th>
                      <th className="px-8 py-5 w-24">Unit</th>
                      <th className="px-8 py-5 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {selectedMappings.length > 0 ? (
                    selectedMappings.map(m => (
                      <tr key={m.ingredient_id} className="group hover:bg-white/[0.01] transition-colors">
                        <td className="px-8 py-4 font-bold text-white">{m.name}</td>
                        <td className="px-8 py-4">
                           <Input 
                             type="number" 
                             value={m.quantity_needed}
                             onChange={e => updateQty(m.ingredient_id, e.target.value)}
                             className="h-10 w-24 mx-auto bg-black/40 border-white/10 text-center font-mono text-primary font-bold rounded-lg"
                           />
                        </td>
                        <td className="px-8 py-4">
                           <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{m.unit_type}</span>
                        </td>
                        <td className="px-8 py-4 text-right">
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
      </div>

      {/* Save Button */}
      <div className="pt-4 space-y-4">
        <Button 
          onClick={handleCommit} 
          disabled={saving}
          className="w-full bg-primary text-black font-black h-16 rounded-2xl shadow-xl shadow-primary/20 text-xs uppercase tracking-[0.2em] transition-all hover:scale-[1.01] active:scale-95"
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
