
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
      // Switched to 'view_menu_details' for Single Source of Truth
      const { data, error } = await supabase
        .from('view_menu_details')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      // Type assertion as 'view_menu_details' matches MenuDish structure + extra fields
      const items = (data || []) as MenuDish[];

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
