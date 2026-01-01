
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { MenuDish } from '../types';

export const useMenu = (filterAvailable = false) => {
  const [menuItems, setMenuItems] = useState<MenuDish[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Switched to 'menu' table as per the source of truth requirements
      let query = supabase.from('menu').select('id, name, price, category, image_url').order('name', { ascending: true });

      // Note: The 'menu' table context provided only contains: id, name, price, category, image_url
      // We ignore filterAvailable if the column doesn't exist, assuming all items in 'menu' are active.

      const { data, error } = await query;
      if (error) throw error;

      const items = (data || []).map(item => ({
        ...item,
        is_available: true, // Default to true as 'menu' table lacks this column
        stock_quantity: 999 // Default to high as 'menu' table lacks this column
      })) as MenuDish[];

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
    const sub = supabase.channel('menu_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  return { menuItems, categories, loading, refreshMenu: fetchData };
};
