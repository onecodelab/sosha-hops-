
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { MenuItem } from '../types';

export const useMenu = (filterAvailable = false) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMenu = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('menu_items')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (filterAvailable) {
        query = query.eq('status', 'available');
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      
      const mapped = (data || []).map((item: any) => ({
        ...item,
        is_available: item.status === 'available'
      }));
      
      setMenuItems(mapped as MenuItem[]);
    } catch (err: any) {
      console.error('Error fetching menu:', err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();

    // Subscribe to realtime changes on the menu_items table
    const subscription = supabase
      .channel('menu_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchMenu();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [filterAvailable]);

  // Derived state: Group items by category
  const categories = Array.from(new Set(menuItems.map(i => i.category)));

  return { 
    menuItems, 
    categories,
    loading, 
    error, 
    refreshMenu: fetchMenu 
  };
};
