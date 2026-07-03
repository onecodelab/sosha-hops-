import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MenuDish, Ingredient } from '@/types';
import { calculateCostPerPlate, checkDishAvailability, RecipeIngredient, calculateIngredientCost } from '../lib/menuEconomics';
import { useBranch } from '../contexts/BranchContext';

export const useMenu = (filterAvailable = false) => {
  const { activeBranchId } = useBranch();
  const [menuItems, setMenuItems] = useState<MenuDish[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Menu Details (Broken View)
      let query = supabase.from('view_menu_details').select('*');
      if (activeBranchId) {
        query = query.or(`branch_id.eq.${activeBranchId},branch_id.is.null`);
      }
      const { data: rawItems, error } = await query.order('name', { ascending: true });
      if (error) throw error;

      // 2. Fetch Recipe Context for HEALING (Fail-safe for broken views)
      const { data: recipes } = await supabase
        .from('recipe_ingredients')
        .select('*, ingredient:ingredients(cost_per_unit, weight_per_unit, unit_id, unit_type, units(*))');

      const { data: unitsRegistry } = await supabase.from('units').select('*');

      // 3. Apply Client-Side Cost Healing
      const items = (rawItems || []).map(item => {
        const itemRecipe = recipes?.filter(r => r.recipe_id === item.recipe_id);
        
        if (itemRecipe && itemRecipe.length > 0) {
          // Rule: Client-calculated cost is the absolute source of truth.
          const healedCost = itemRecipe.reduce((sum, ri) => sum + calculateIngredientCost(ri, unitsRegistry || []), 0);
          
          console.log(`[UniversalHealer] Applied accurate cost to ${item.name}: ETB ${healedCost}`);
          
          return { 
            ...item, 
            cost_per_plate: healedCost,
            margin: item.price - healedCost,
            margin_percent: item.price > 0 ? ((item.price - healedCost) / item.price) * 100 : 0
          };
        }
        return item as MenuDish;
      });

      setMenuItems(items);
      const cats = Array.from(new Set(items.map(i => i.category))).sort();
      setCategories(cats);
    } catch (err) {
      console.error('Menu fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch even if activeBranchId is null to show global items
    fetchData();
    // Real-time sync for menu, recipes, and ingredients to satisfy "event-driven" rule
    const menuSub = supabase.channel('menu_economics_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipe_ingredients' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(menuSub); };
  }, [activeBranchId]);

  return { menuItems, categories, loading, refreshMenu: fetchData };
};
