
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { MenuDish, Ingredient } from '../types';
import { calculateCostPerPlate, checkDishAvailability, RecipeIngredient } from '../lib/menuEconomics';

export const useMenu = (filterAvailable = false) => {
  const [menuItems, setMenuItems] = useState<MenuDish[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Menu Items
      const { data: menuData, error: menuError } = await supabase
        .from('menu')
        .select('*')
        .order('name', { ascending: true });

      if (menuError) throw menuError;

      // 2. Fetch Recipes with Ingredients
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .select(`
          menu_item_id,
          recipe_ingredients (
            ingredient_id,
            quantity_needed,
            unit_type,
            out_of_stock_impact,
            ingredient:ingredients (
              id,
              name,
              current_stock,
              unit_type,
              cost_per_unit,
              weight_per_unit
            )
          )
        `);

      if (recipeError) throw recipeError;

      // 3. Map Intelligence
      const recipeMap = new Map<string, any[]>();
      recipeData?.forEach(r => {
        recipeMap.set(r.menu_item_id, r.recipe_ingredients);
      });

      let items = (menuData || []).map(item => {
        const ingredients = (recipeMap.get(item.id) || []) as RecipeIngredient[];
        const costPerPlate = calculateCostPerPlate(ingredients);
        const availability = checkDishAvailability(ingredients);

        return {
          ...item,
          cost_per_plate: costPerPlate,
          is_available: availability.isAvailable,
          availability_reason: availability.reason,
          stock_quantity: ingredients.length > 0 ?
            Math.min(...ingredients.map(ri => ri.ingredient ? ri.ingredient.current_stock : 999)) : 999
        };
      }) as MenuDish[];

      if (filterAvailable) {
        items = items.filter(i => i.is_available);
      }

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
    fetchData();
    // Real-time sync for menu, recipes, and ingredients to satisfy "event-driven" rule
    const menuSub = supabase.channel('menu_economics_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipe_ingredients' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(menuSub); };
  }, []);

  return { menuItems, categories, loading, refreshMenu: fetchData };
};
