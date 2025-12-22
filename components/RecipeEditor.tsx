import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { Input, Button, cn, showToast, Badge, Card } from './ui';
import { Search, Plus, Trash2, Loader2, Info, DollarSign, Calculator, ChefHat } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Ingredient, MenuItem } from '../types';

interface RecipeItem {
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
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [qty, setQty] = useState<string>('1');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchRecipe();
    fetchAllIngredients();
  }, [menuItem.id]);

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
      setRecipeItems(data as RecipeItem[]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllIngredients = async () => {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (!error && data) setAllIngredients(data);
  };

  const filteredCatalog = useMemo(() => {
    if (!searchTerm) return [];
    return allIngredients.filter(i => 
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 5);
  }, [allIngredients, searchTerm]);

  const handleAddIngredient = async () => {
    if (!selectedIngredient || !qty) return;
    setAdding(true);

    try {
      const { error } = await supabase
        .from('recipe_items')
        .insert({
          menu_id: menuItem.id,
          ingredient_id: selectedIngredient.id,
          qty_per_item: parseFloat(qty)
        });

      if (error) throw error;
      showToast(t('menu.ingredientAdded'), 'success');
      fetchRecipe();
      setSelectedIngredient(null);
      setSearchTerm('');
      setQty('1');
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveIngredient = async (id: string) => {
    try {
      const { error } = await supabase.from('recipe_items').delete().eq('id', id);
      if (error) throw error;
      showToast(t('menu.ingredientRemoved'), 'success');
      setRecipeItems(prev => prev.filter(item => item.id !== id));
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const totalRecipeCost = useMemo(() => {
    return recipeItems.reduce((sum, item) => {
      return sum + (item.qty_per_item * (item.ingredient?.cost_per_unit || 0));
    }, 0);
  }, [recipeItems]);

  const profit = menuItem.price - totalRecipeCost;
  const margin = menuItem.price > 0 ? (profit / menuItem.price) * 100 : 0;

  return (
    <div className="space-y-6 pt-2 animate-in slide-in-from-bottom-2 duration-300">
      <div className="bg-black/20 border border-gray-800 rounded-2xl p-4 space-y-4">
         <div className="space-y-2 relative">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{t('menu.addIngredient')}</label>
            <div className="flex gap-2">
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                  <Input 
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setIsSearching(true); }}
                    onFocus={() => setIsSearching(true)}
                    placeholder={t('menu.searchIngredient')}
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
                                <p className="text-[10px] text-gray-500 font-mono">{ing.sku || 'No SKU'}</p>
                             </div>
                             <Badge variant="outline" className="text-[9px] border-zinc-800 text-zinc-400">{ing.unit_type}</Badge>
                          </button>
                       ))}
                    </div>
                  )}
               </div>
               <div className="w-24">
                  <Input 
                    type="number" 
                    value={qty} 
                    onChange={e => setQty(e.target.value)} 
                    placeholder="Qty"
                    className="bg-black/40 border-gray-700 h-10 font-mono text-center"
                  />
               </div>
               <Button 
                  onClick={handleAddIngredient} 
                  disabled={!selectedIngredient || adding}
                  className="bg-primary text-black font-black w-10 h-10 p-0 rounded-xl"
               >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
               </Button>
            </div>
         </div>
      </div>

      <div className="min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar border border-gray-800 rounded-2xl bg-black/10">
         {loading ? (
            <div className="flex items-center justify-center py-20 text-muted">
               <Loader2 className="w-6 h-6 animate-spin mr-2" />
               <span className="text-xs font-bold uppercase tracking-widest">Loading Recipe...</span>
            </div>
         ) : recipeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-600 gap-2">
               <ChefHat className="w-10 h-10 opacity-20" />
               <p className="text-xs font-medium italic">{t('menu.noRecipe')}</p>
            </div>
         ) : (
            <table className="w-full text-sm text-left">
               <thead className="text-[9px] text-gray-500 uppercase bg-black/40 border-b border-gray-800 sticky top-0 font-black tracking-widest">
                  <tr>
                     <th className="px-4 py-3">Ingredient</th>
                     <th className="px-4 py-3 text-center">Qty / Unit</th>
                     <th className="px-4 py-3 text-right">Cost</th>
                     <th className="px-4 py-3 w-10"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-800">
                  {recipeItems.map(item => {
                     const itemCost = item.qty_per_item * (item.ingredient?.cost_per_unit || 0);
                     return (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                           <td className="px-4 py-3">
                              <p className="font-bold text-white text-xs">{item.ingredient?.name}</p>
                              <p className="text-[9px] text-gray-500 font-mono uppercase">{item.ingredient?.sku}</p>
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

      <div className="grid grid-cols-2 gap-4">
         <Card className="bg-black/20 border-gray-800 p-4">
            <div className="flex justify-between items-start mb-2">
               <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{t('menu.totalCost')}</p>
               <Calculator className="w-3.5 h-3.5 text-gray-600" />
            </div>
            <p className="text-2xl font-black text-white font-mono">ETB {totalRecipeCost.toLocaleString()}</p>
         </Card>
         <Card className={cn(
           "p-4 border",
           margin > 60 ? "bg-green-500/5 border-green-500/20" : margin > 40 ? "bg-yellow-500/5 border-yellow-500/20" : "bg-red-500/5 border-red-500/20"
         )}>
            <div className="flex justify-between items-start mb-2">
               <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{t('menu.margin')}</p>
               <DollarSign className={cn("w-3.5 h-3.5", margin > 60 ? "text-green-500" : margin > 40 ? "text-yellow-500" : "text-red-500")} />
            </div>
            <p className={cn("text-2xl font-black font-mono", margin > 60 ? "text-green-400" : margin > 40 ? "text-yellow-400" : "text-red-400")}>
               {margin.toFixed(1)}%
            </p>
         </Card>
      </div>
      <style>{`
         .custom-scrollbar::-webkit-scrollbar { width: 4px; }
         .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
      `}</style>
    </div>
  );
};