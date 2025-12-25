
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
      // 1. Fetch Categories
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (catError) throw catError;
      setCategories(catData || []);

      // 2. Fetch Menu with Category Join
      let query = supabase
        .from('menu')
        .select('*, category:categories(name)')
        .order('name', { ascending: true });

      if (filterAvailable) {
        query = query.eq('is_available', true);
      }

      const { data: menuData, error: menuError } = await query;

      if (menuError) throw menuError;
      
      const mappedData = (menuData as any[] || []).map(item => ({
        ...item,
        category_name: item.category?.name || 'Uncategorized'
      }));
      
      setMenuItems(mappedData);
    } catch (err: any) {
      console.error('Error fetching menu data:', err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to updates for both tables
    const menuSub = supabase
      .channel('menu_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchData())
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
