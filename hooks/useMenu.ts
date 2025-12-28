
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { MenuItem, Category } from '../types';

export const useMenu = (filterAvailable = false) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch menu items directly; category is a TEXT field on menu_items
      let query = supabase
        .from('menu_items')
        .select('*')
        .order('name', { ascending: true });

      if (filterAvailable) {
        query = query.eq('is_available', true);
      }

      const { data: menuData, error: menuError } = await query;

      if (menuError) throw menuError;

      const items = (menuData as MenuItem[] | null) || [];
      setMenuItems(items);

      // Derive category list from existing menu items
      const uniqueCategories = Array.from(
        new Set(items.map(item => item.category || 'Uncategorized'))
      );

      const derivedCategories: Category[] = uniqueCategories.map(name => ({
        id: name,
        name,
      }));

      setCategories(derivedCategories);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching menu data:', err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to menu item changes only
    const menuSub = supabase
      .channel('menu_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(menuSub);
    };
  }, [filterAvailable]);

  return { 
    menuItems, 
    categories,
    loading, 
    error, 
    refreshMenu: fetchData 
  };
};
