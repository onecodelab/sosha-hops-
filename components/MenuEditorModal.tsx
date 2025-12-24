
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Dialog, Button, Input, cn, showToast, Badge } from './ui';
import { 
  X, Plus, Trash2, Loader2, Info, 
  ChefHat, BookOpen, Utensils, Clock, Users 
} from 'lucide-react';
import { MenuItem, Ingredient } from '../types';

interface MenuEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingItem?: MenuItem | null;
}

interface IngredientRow {
  localId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
}

export const MenuEditorModal: React.FC<MenuEditorModalProps> = ({ 
  isOpen, onClose, onSuccess, editingItem 
}) => {
  const [loading, setLoading] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [activeSection, setActiveSection] = useState<number>(1);

  // Section 1: Basic Info
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Main Course');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  // Section 2: Recipe Meta
  const [prepTime, setPrepTime] = useState<number>(10);
  const [cookTime, setCookTime] = useState<number>(15);
  const [servings, setServings] = useState<number>(1);
  const [instructions, setInstructions] = useState('');

  // Section 3: Recipe Ingredients
  const [recipeRows, setRecipeRows] = useState<IngredientRow[]>([
    { localId: crypto.randomUUID(), ingredientId: '', quantity: 1, unit: 'g' }
  ]);

  useEffect(() => {
    if (isOpen) {
      fetchIngredients();
      if (editingItem) {
        setName(editingItem.name);
        setCategory(editingItem.category);
        setDescription(editingItem.description || '');
        setPrice(editingItem.price);
        setImageUrl(editingItem.image_url || '');
        setIsAvailable(editingItem.is_available);
        fetchRecipeData(editingItem.id);
      } else {
        resetForm();
      }
    }
  }, [isOpen, editingItem]);

  const resetForm = () => {
    setName('');
    setCategory('Main Course');
    setDescription('');
    setPrice(0);
    setImageUrl('');
    setIsAvailable(true);
    setPrepTime(10);
    setCookTime(15);
    setServings(1);
    setInstructions('');
    setRecipeRows([{ localId: crypto.randomUUID(), ingredientId: '', quantity: 1, unit: 'g' }]);
    setActiveSection(1);
  };

  const fetchIngredients = async () => {
    const { data } = await supabase
      .from('ingredients')
      .select('id, name, unit_type')
      .order('name');
    if (data) setIngredients(data as any);
  };

  const fetchRecipeData = async (menuId: string) => {
    const { data: recipe } = await supabase
      .from('recipes')
      .select('*')
      .eq('menu_item_id', menuId)
      .maybeSingle();

    if (recipe) {
      setPrepTime(recipe.prep_time);
      setCookTime(recipe.cook_time);
      setServings(recipe.servings);
      setInstructions(recipe.instructions || '');

      const { data: ingRows } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipe.id);

      if (ingRows && ingRows.length > 0) {
        setRecipeRows(ingRows.map(r => ({
          localId: r.id,
          ingredientId: r.ingredient_id,
          quantity: r.quantity,
          unit: r.unit
        })));
      }
    }
  };

  const addIngredientRow = () => {
    setRecipeRows([...recipeRows, { localId: crypto.randomUUID(), ingredientId: '', quantity: 1, unit: 'g' }]);
  };

  const removeIngredientRow = (localId: string) => {
    if (recipeRows.length > 1) {
      setRecipeRows(recipeRows.filter(r => r.localId !== localId));
    }
  };

  const updateRow = (localId: string, field: keyof IngredientRow, value: any) => {
    setRecipeRows(recipeRows.map(r => r.localId === localId ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    // Basic Validations
    if (!name || price <= 0) {
      showToast("Please provide a name and valid price", "error");
      return;
    }
    const validIngredients = recipeRows.filter(r => r.ingredientId && r.quantity > 0);
    if (validIngredients.length === 0) {
      showToast("At least one ingredient is required", "error");
      return;
    }

    setLoading(true);
    try {
      // 1. Save Menu Item
      const menuPayload = {
        name: name.trim(),
        category,
        description: description.trim() || null,
        price: parseFloat(price.toString()),
        image_url: imageUrl.trim() || null,
        status: isAvailable ? 'available' : 'unavailable'
      };

      let menuItemId = editingItem?.id;

      if (editingItem) {
        const { error } = await supabase.from('menu_items').update(menuPayload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('menu_items').insert(menuPayload).select().single();
        if (error) throw error;
        menuItemId = data.id;
      }

      // 2. Save Recipe
      const recipePayload = {
        menu_item_id: menuItemId,
        prep_time: prepTime,
        cook_time: cookTime,
        servings: servings,
        instructions: instructions.trim()
      };

      const { data: existingRecipe } = await supabase.from('recipes').select('id').eq('menu_item_id', menuItemId).maybeSingle();
      let recipeId = existingRecipe?.id;

      if (recipeId) {
        const { error } = await supabase.from('recipes').update(recipePayload).eq('id', recipeId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('recipes').insert(recipePayload).select().single();
        if (error) throw error;
        recipeId = data.id;
      }

      // 3. Save Ingredients (Sync strategy: Delete and Re-insert)
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
      
      const ingredientsPayload = validIngredients.map(r => ({
        recipe_id: recipeId,
        ingredient_id: r.ingredientId,
        quantity: r.quantity,
        unit: r.unit
      }));

      const { error: ingError } = await supabase.from('recipe_ingredients').insert(ingredientsPayload);
      if (ingError) throw ingError;

      showToast(editingItem ? "Dish updated successfully" : "New dish created", "success");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      const msg = err.message || (typeof err === 'string' ? err : "Failed to save dish");
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const categories = ["Breakfast", "Main Course", "Dessert", "Drinks", "Salads", "Soup", "dessert", "salade", "Green Salads"];
  const units = ["g", "kg", "ml", "L", "piece", "tbsp", "tsp", "cup"];

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={editingItem ? "Edit Menu Item" : "Create New Menu Item"}>
      <div className="flex flex-col gap-6 max-h-[75vh] overflow-y-auto custom-scrollbar pr-2 pt-2">
        
        {/* Navigation Tabs */}
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
           {[1, 2, 3].map(num => (
             <button
               key={num}
               onClick={() => setActiveSection(num)}
               className={cn(
                 "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                 activeSection === num ? "bg-primary text-black" : "text-gray-500 hover:text-white"
               )}
             >
                {num === 1 ? 'Basic' : num === 2 ? 'Details' : 'Ingredients'}
             </button>
           ))}
        </div>

        {/* Section 1: Basic Info */}
        {activeSection === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Dish Name *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Grilled Salmon" className="bg-black/20" />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Category</label>
                   <select 
                     value={category} 
                     onChange={e => setCategory(e.target.value)}
                     className="w-full h-11 bg-black/40 border border-border rounded-lg px-3 text-sm text-white focus:border-primary/50 outline-none"
                   >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Price (ETB) *</label>
                   <Input type="number" value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)} placeholder="0.00" className="bg-black/20 font-mono text-primary font-bold" />
                </div>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Description</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
                  className="w-full h-24 bg-black/20 border border-border rounded-xl p-3 text-sm outline-none focus:border-primary/50 resize-none" 
                  placeholder="Describe the dish..."
                />
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Image URL</label>
                <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="bg-black/20" />
             </div>
             <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-sm font-bold text-gray-300">Available for Order</span>
                <button 
                  onClick={() => setIsAvailable(!isAvailable)}
                  className={cn("w-12 h-6 rounded-full transition-all relative", isAvailable ? "bg-primary" : "bg-gray-700")}
                >
                   <div className={cn("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", isAvailable ? "translate-x-6" : "translate-x-0")} />
                </button>
             </div>
          </div>
        )}

        {/* Section 2: Recipe Meta */}
        {activeSection === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Prep (Min)
                   </label>
                   <Input type="number" value={prepTime} onChange={e => setPrepTime(parseInt(e.target.value) || 0)} className="bg-black/20" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                      <Utensils className="w-3 h-3" /> Cook (Min)
                   </label>
                   <Input type="number" value={cookTime} onChange={e => setCookTime(parseInt(e.target.value) || 0)} className="bg-black/20" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                      <Users className="w-3 h-3" /> Servings
                   </label>
                   <Input type="number" value={servings} onChange={e => setServings(parseInt(e.target.value) || 0)} className="bg-black/20" />
                </div>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Kitchen Instructions</label>
                <textarea 
                  value={instructions} 
                  onChange={e => setInstructions(e.target.value)}
                  className="w-full h-40 bg-black/20 border border-border rounded-xl p-3 text-sm outline-none focus:border-primary/50 resize-none" 
                  placeholder="Step by step preparation guide..."
                />
             </div>
          </div>
        )}

        {/* Section 3: Ingredients */}
        {activeSection === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-400">Recipe Ingredients</h4>
                <Button size="sm" variant="outline" onClick={addIngredientRow} className="h-8 text-[10px] border-white/10">
                   <Plus className="w-3 h-3 mr-1" /> Add Ingredient
                </Button>
             </div>
             
             <div className="space-y-3">
                {recipeRows.map((row, idx) => (
                  <div key={row.localId} className="flex items-center gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
                     <div className="flex-1">
                        <select 
                          value={row.ingredientId} 
                          onChange={e => updateRow(row.localId, 'ingredientId', e.target.value)}
                          className="w-full h-10 bg-black/40 border border-border rounded-lg px-2 text-xs text-white outline-none focus:border-primary/50"
                        >
                           <option value="">Select Ingredient</option>
                           {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                     </div>
                     <div className="w-20">
                        <Input 
                          type="number" 
                          value={row.quantity} 
                          onChange={e => updateRow(row.localId, 'quantity', parseFloat(e.target.value) || 0)} 
                          className="h-10 text-center text-xs"
                          placeholder="Qty"
                        />
                     </div>
                     <div className="w-20">
                        <select 
                          value={row.unit} 
                          onChange={e => updateRow(row.localId, 'unit', e.target.value)}
                          className="w-full h-10 bg-black/40 border border-border rounded-lg px-2 text-xs text-white outline-none focus:border-primary/50"
                        >
                           {units.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                     </div>
                     <button onClick={() => removeIngredientRow(row.localId)} className="text-gray-500 hover:text-red-500 p-1">
                        <X className="w-4 h-4" />
                     </button>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="flex gap-3 pt-6 border-t border-white/5 sticky bottom-0 bg-card py-4">
           <Button variant="ghost" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
           <Button onClick={handleSave} className="flex-1 bg-primary text-black font-black" isLoading={loading}>
              {loading ? 'Saving...' : editingItem ? 'Update Dish' : 'Create Dish'}
           </Button>
        </div>
      </div>
    </Dialog>
  );
};
