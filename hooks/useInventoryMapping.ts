
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

/**
 * Hook to fetch the mapping of Menu Item ID -> Ingredient IDs.
 * Used by the Redis Viewer to know which keys to check.
 */
export const useInventoryMapping = () => {
    const [mapping, setMapping] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMapping = async () => {
            const { data, error } = await supabase
                .from('recipe_ingredients')
                .select(`
                    ingredient_id,
                    recipe:recipes!inner(menu_item_id)
                `)
                .eq('out_of_stock_impact', 'kills_dish');

            if (error) {
                console.error('Failed to fetch inventory mapping:', error);
                setLoading(false);
                return;
            }

            const newMapping: Record<string, string[]> = {};
            data.forEach((row: any) => {
                const dishId = row.recipe.menu_item_id;
                if (!newMapping[dishId]) newMapping[dishId] = [];
                newMapping[dishId].push(row.ingredient_id);
            });

            setMapping(newMapping);
            setLoading(false);
        };

        fetchMapping();
    }, []);

    return { mapping, loading };
};
