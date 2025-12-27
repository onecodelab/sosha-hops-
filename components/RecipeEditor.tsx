
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { Input, Button, cn, showToast, Badge, Card } from './ui';
import { Search, Plus, Trash2, Loader2, DollarSign, Calculator, ChefHat } from 'lucide-react';
import { Ingredient, MenuItem } from '../types';

interface RecipeItemRow {
  id: string;
  menu_id: string;
  ingredient_id: string;
  qty_per_item: number;
  ingredient: Ingredient;
}

interface RecipeEditorProps {
  menuItem: MenuItem;
}

export const RecipeEditor: React.FC<RecipeEditorProps> = ({ menuItem }) => {
  const [loading, setLoading] = useState(true);
  const [recipeItems, setRecipeItems] = useState<RecipeItemRow[]>([]);
  
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
      const { data, error } = await supabase
        .from('recipe_items')
        .select(`
          *,
          ingredient:ingredients(*)
        `)
        .eq('menu_id', menuItem.id);

      if (error) throw error;
      setRecipeItems(data as any[] || []);
    } catch (err: any) {
      console.error("Fetch recipe error:", err);
      showToast("Failed to load existing ingredients", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllIngredients = async () => {
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (!error && data) setAllIngredients(data as any);
    } catch (err) {
      console.error("Fetch all ingredients error:", err);
    }
  };

  const filteredCatalog = useMemo(() => {
    if (!searchTerm || selectedIngredient) return [];
    return allIngredients.filter(i => 
      i.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [allIngredients, searchTerm, selectedIngredient]);

  const handleAddIngredient = async () => {
    if (!selectedIngredient || !qty || !menuItem?.id) {
        showToast("Missing required data to link ingredient", "error");
        return;
    }
    setAdding(true);

    try {
      // Defensive check for duplicate ingredient
      const isDuplicate = recipeItems.some(i => i.ingredient_id === selectedIngredient.id);
      if (isDuplicate) {
        throw new Error("This ingredient is already in the recipe.");
      }

      const { error } = await supabase
        .from('recipe_items')
        .insert({
          menu_id: menuItem.id,
          ingredient_id: selectedIngredient.id,
          qty_per_item: parseFloat(qty)
        });

      if (error) throw error;
      
      showToast('Ingredient linked successfully', 'success');
      await fetchRecipe(); // Refresh list
      setSelectedIngredient(null);
      setSearchTerm('');
      setQty('1');
    } catch (err: any) {
      showToast(err.message || "Failed to link ingredient", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveIngredient = async (id: string) => {
    try {
      const { error } = await supabase.from('recipe_items').delete().eq('id', id);
      if (error) throw error;
      setRecipeItems(prev => prev.filter(item => item.id !== id));
      showToast("Ingredient removed");
    } catch (err: any) {
      showToast(err.message || "Failed to remove ingredient", "error");
    }
  };

  const totalRecipeCost = useMemo(() => {
    return recipeItems.reduce((sum, item) => {
      const cost = item.ingredient?.cost_per_unit || 0;
      return sum + (item.qty_per_item * cost);
    }, 0);
  }, [recipeItems]);

  const profit = menuItem.price - totalRecipeCost;
  const margin = menuItem.price > 0 ? (profit / menuItem.price) * 100 : 0;

  return (
    <div className="space-y-6 pt-2 animate-in slide-in-from-bottom-2 duration-300">
      
      {/* Search & Add Bar */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
         <div className="space-y-2 relative">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Search & Link Ingredient</label>
            <div className="flex gap-2">
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                  <Input 
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setIsSearching(true); }}
                    onFocus={() => setIsSearching(true)}
                    placeholder="Search by name..."
                    className="pl-9 bg-black/40 border-gray-700 h-10"
                  />
                  {isSearching && filteredCatalog.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#111] border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                       {filteredCatalog.map(ing => (
                          <button
                            key={ing.id}
                            onClick={() => { setSelectedIngredient(ing); setSearchTerm(ing.name); setIsSearching(false); }}
                            className="w-full text-left px-4 py-3 hover:bg-primary/10 border-b border-gray-800/50 last:border-0 transition-colors flex justify-between items-center group"
                          >
                             <div>
                                <p className="font-bold text-white text-sm group-hover:text-primary">{ing.name}</p>
                                <p className="text-[10px] text-gray-500 font-mono uppercase">{ing.sku || 'No SKU'}</p>
                             </div>
                             <Badge variant="outline" className="text-[9px] border-zinc-800 text-zinc-400">{ing.unit_type}</Badge>
                          </button>
                       ))}
                    </div>
                  )}
               </div>
               <div className="w-24 relative">
                  <Input 
                    type="number" 
                    value={qty} 
                    onChange={e => setQty(e.target.value)} 
                    placeholder="Qty"
                    className="bg-black/40 border-gray-700 h-10 font-mono text-center pr-8"
                  />
                  <span className="absolute right-2 top-2.5 text-[8px] font-black text-gray-600 uppercase">Per Dish</span>
               </div>
               <Button 
                  onClick={handleAddIngredient} 
                  disabled={!selectedIngredient || adding || !menuItem?.id}
                  className="bg-primary text-black font-black w-10 h-10 p-0 rounded-xl"
               >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
               </Button>
            </div>
         </div>
      </div>

      {/* Linked Ingredients List */}
      <div className="min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar border border-white/5 rounded-2xl bg-black/10 shadow-inner">
         {loading ? (
            <div className="flex items-center justify-center py-20 text-muted">
               <Loader2 className="w-6 h-6 animate-spin mr-2" />
               <span className="text-xs font-bold uppercase tracking-widest">Syncing Recipe...</span>
            </div>
         ) : recipeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-600 gap-2">
               <ChefHat className="w-10 h-10 opacity-20" />
               <p className="text-xs font-medium italic">No ingredients linked to this dish.</p>
            </div>
         ) : (
            <table className="w-full text-sm text-left">
               <thead className="text-[9px] text-gray-500 uppercase bg-black/40 border-b border-gray-800 sticky top-0 font-black tracking-widest">
                  <tr>
                     <th className="px-4 py-3">Ingredient</th>
                     <th className="px-4 py-3 text-center">Qty / Serving</th>
                     <th className="px-4 py-3 text-right">Cost Impact</th>
                     <th className="px-4 py-3 w-10"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-800">
                  {recipeItems.map(item => {
                     const itemCost = item.qty_per_item * (item.ingredient?.cost_per_unit || 0);
                     return (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                           <td className="px-4 py-3">
                              <p className="font-bold text-white text-xs">{item.ingredient?.name || 'Deleted Ingredient'}</p>
                           </td>
                           <td className="px-4 py-3 text-center">
                              <span className="font-mono text-white text-xs">{item.qty_per_item}</span>
                              <span className="text-[10px] text-gray-500 ml-1">{item.ingredient?.unit_type}</span>
                           </td>
                           <td className="px-4 py-3 text-right font-mono text-primary font-bold">
                              ETB {itemCost.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                           </td>
                           <td className="px-4 py-3 text-right">
                              <button 
                                onClick={() => handleRemoveIngredient(item.id)}
                                className="text-gray-600 hover:text-red-500 transition-colors"
                              >
                                 <Trash2 className="w-3.5 h-3.5" />
                              </button>
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         )}
      </div>

      {/* Financial Health */}
      <div className="grid grid-cols-2 gap-4">
         <Card className="bg-black/20 border-white/5 p-4 rounded-3xl">
            <div className="flex justify-between items-start mb-2">
               <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Recipe Raw Cost</p>
               <Calculator className="w-3.5 h-3.5 text-gray-600" />
            </div>
            <p className="text-2xl font-black text-white font-mono">ETB {totalRecipeCost.toLocaleString()}</p>
         </Card>
         <Card className={cn(
           "p-4 rounded-3xl border transition-all shadow-xl",
           margin > 60 ? "bg-green-500/5 border-green-500/20" : margin > 40 ? "bg-yellow-500/5 border-yellow-500/20" : "bg-red-500/5 border-red-500/20"
         )}>
            <div className="flex justify-between items-start mb-2">
               <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Profit Margin</p>
               <DollarSign className={cn("w-3.5 h-3.5", margin > 60 ? "text-green-500" : margin > 40 ? "text-yellow-500" : "text-red-500")} />
            </div>
            <p className={cn("text-2xl font-black font-mono", margin > 60 ? "text-green-400" : margin > 40 ? "text-yellow-400" : "text-red-400")}>
               {margin.toFixed(1)}%
            </p>
         </Card>
      </div>
    </div>
  );
};
