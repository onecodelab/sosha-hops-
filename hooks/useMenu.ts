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
        .from('menu')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (filterAvailable) {
        query = query.eq('is_available', true); // Corrected column name
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setMenuItems(data as MenuItem[]);
    } catch (err: any) {
      console.error('Error fetching menu:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();

    // Subscribe to realtime changes on the menu table
    const subscription = supabase
      .channel('menu_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, () => {
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