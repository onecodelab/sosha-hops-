
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { Input, Button, cn, showToast, Badge, Card } from './ui';
import { Search, Plus, Trash2, Loader2, DollarSign, Calculator, ChefHat, Layers } from 'lucide-react';
import { Ingredient, MenuItem, ERPRecipe, ERPRecipeIngredient } from '../types';
import { useAuth } from '../AuthContext';

interface RecipeEditorProps {
  menuItem: MenuItem;
}

export const RecipeEditor: React.FC<RecipeEditorProps> = ({ menuItem }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<ERPRecipe | null>(null);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [qty, setQty] = useState<string>('1');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (menuItem?.id) {
      fetchRecipe();
      fetchAllIngredients();
    }
  }, [menuItem?.id]);

  const fetchRecipe = async () => {
    setLoading(true);
    try {
      let { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .select(`*, ingredients:recipe_ingredients(*, ingredient:ingredients(*))`)
        .eq('menu_item_id', menuItem.id)
        .maybeSingle();

      if (recipeError) throw recipeError;

      // Auto-create recipe header if it doesn't exist
      if (!recipeData) {
        const { data: newRecipe, error: createError } = await supabase
          .from('recipes')
          .insert({
            menu_item_id: menuItem.id,
            name: `${menuItem.name} Standard Recipe`,
            yield_servings: 1,
            created_by: user?.id
          })
          .select()
          .single();
        
        if (createError) throw createError;
        setRecipe({ ...newRecipe, ingredients: [] });
      } else {
        setRecipe(recipeData as ERPRecipe);
      }
    } catch (err: any) {
      console.error("Fetch recipe error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllIngredients = async () => {
    const { data } = await supabase.from('ingredients').select('*').eq('is_active', true).order('name');
    if (data) setAllIngredients(data as Ingredient[]);
  };

  const updateYield = async (yieldVal: number) => {
    if (!recipe) return;
    try {
      const { error } = await supabase.from('recipes').update({ yield_servings: yieldVal }).eq('id', recipe.id);
      if (error) throw error;
      setRecipe({ ...recipe, yield_servings: yieldVal });
      showToast(`Yield adjusted to ${yieldVal} servings`);
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleAddIngredient = async () => {
    if (!selectedIngredient || !recipe || !qty) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .insert({
          recipe_id: recipe.id,
          ingredient_id: selectedIngredient.id,
          quantity: parseFloat(qty),
          unit: selectedIngredient.unit_type
        })
        .select(`*, ingredient:ingredients(*)`)
        .single();

      if (error) throw error;
      
      setRecipe({ ...recipe, ingredients: [...(recipe.ingredients || []), data as ERPRecipeIngredient] });
      setSelectedIngredient(null);
      setSearchTerm('');
      showToast("Ingredient linked");
    } catch (err: any) { showToast(err.message, 'error'); } finally { setAdding(false); }
  };

  const handleRemoveIngredient = async (id: string) => {
    const { error } = await supabase.from('recipe_ingredients').delete().eq('id', id);
    if (!error) setRecipe(prev => prev ? { ...prev, ingredients: prev.ingredients?.filter(i => i.id !== id) } : null);
  };

  const filteredCatalog = useMemo(() => {
    if (!searchTerm || selectedIngredient) return [];
    return allIngredients.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 5);
  }, [allIngredients, searchTerm, selectedIngredient]);

  const rawCost = useMemo(() => {
    return recipe?.ingredients?.reduce((sum, item) => sum + (item.quantity * (item.ingredient?.cost_per_unit || 0)), 0) || 0;
  }, [recipe]);

  const costPerServing = recipe?.yield_servings ? rawCost / recipe.yield_servings : 0;
  const margin = menuItem.price > 0 ? ((menuItem.price - costPerServing) / menuItem.price) * 100 : 0;

  return (
    <div className="space-y-6 pt-2">
      {/* Yield & Metadata Header */}
      <div className="grid grid-cols-2 gap-4">
         <Card className="bg-black/20 border-white/5 p-4 rounded-3xl">
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
               <Layers className="w-3 h-3" /> Yield Per Batch
            </label>
            <div className="flex items-center gap-3">
               <Input 
                 type="number" 
                 value={recipe?.yield_servings || 1} 
                 onChange={e => updateYield(parseInt(e.target.value) || 1)}
                 className="w-20 h-10 bg-black border-white/10 text-center font-bold text-primary"
               />
               <span className="text-xs text-gray-400 font-bold uppercase">Servings</span>
            </div>
         </Card>
         <Card className="bg-black/20 border-white/5 p-4 rounded-3xl">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
               <ChefHat className="w-3 h-3" /> Prep Time
            </p>
            <div className="flex items-center gap-3">
               <span className="text-lg font-black text-white font-mono">15</span>
               <span className="text-xs text-gray-400 font-bold uppercase">Minutes</span>
            </div>
         </Card>
      </div>

      {/* Ingredient Search & Add */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 relative">
         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Link Batch Ingredients</label>
         <div className="flex gap-2">
            <div className="relative flex-1">
               <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
               <Input 
                 value={searchTerm} 
                 onChange={e => { setSearchTerm(e.target.value); setIsSearching(true); }}
                 placeholder="Search ingredients..." 
                 className="pl-10 h-11 bg-black border-white/10" 
               />
               {isSearching && filteredCatalog.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#111] border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                     {filteredCatalog.map(ing => (
                        <button key={ing.id} onClick={() => { setSelectedIngredient(ing); setSearchTerm(ing.name); setIsSearching(false); }} className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-gray-800/50 last:border-0 flex justify-between items-center group">
                           <div>
                              <p className="font-bold text-white text-sm group-hover:text-primary">{ing.name}</p>
                              <p className="text-[10px] text-gray-500 uppercase">{ing.sku || 'No SKU'}</p>
                           </div>
                           <Badge variant="outline" className="text-[9px]">{ing.unit_type}</Badge>
                        </button>
                     ))}
                  </div>
               )}
            </div>
            <Input type="number" value={qty} onChange={e => setQty(e.target.value)} className="w-24 h-11 bg-black border-white/10 text-center font-mono" placeholder="Qty" />
            <Button onClick={handleAddIngredient} disabled={!selectedIngredient || adding} className="bg-primary text-black font-black h-11 w-11 p-0 rounded-xl">
               {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
            </Button>
         </div>
      </div>

      {/* Linked List */}
      <div className="border border-white/5 rounded-2xl bg-black/10 min-h-[150px] overflow-hidden">
         <table className="w-full text-sm text-left">
            <thead className="text-[9px] text-gray-500 uppercase bg-black/40 border-b border-gray-800 sticky top-0 font-black tracking-widest">
               <tr>
                  <th className="px-4 py-3">Ingredient</th>
                  <th className="px-4 py-3 text-center">Batch Qty</th>
                  <th className="px-4 py-3 text-right">Batch Cost</th>
                  <th className="px-4 py-3 w-10"></th>
               </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
               {recipe?.ingredients?.map(item => (
                  <tr key={item.id} className="hover:bg-white/[0.01]">
                     <td className="px-4 py-3 font-bold text-white text-xs">{item.ingredient?.name}</td>
                     <td className="px-4 py-3 text-center font-mono text-xs">{item.quantity} {item.unit}</td>
                     <td className="px-4 py-3 text-right font-mono text-primary">ETB {(item.quantity * (item.ingredient?.cost_per_unit || 0)).toLocaleString()}</td>
                     <td className="px-4 py-3 text-right">
                        <button onClick={() => handleRemoveIngredient(item.id)} className="text-gray-600 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>

      {/* Analytics Footer */}
      <div className="grid grid-cols-2 gap-4">
         <Card className="bg-black/20 border-white/5 p-4 rounded-3xl">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Cost Per Serving</p>
            <p className="text-2xl font-black text-white font-mono">ETB {costPerServing.toLocaleString()}</p>
         </Card>
         <Card className={cn("p-4 rounded-3xl border transition-all", margin > 50 ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20")}>
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">ERP Profit Margin</p>
            <p className={cn("text-2xl font-black font-mono", margin > 50 ? "text-green-400" : "text-red-400")}>{margin.toFixed(1)}%</p>
         </Card>
      </div>
    </div>
  );
};
