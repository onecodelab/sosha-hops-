import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { useRoleAccess } from './useRoleAccess';
import { Role } from '../types';

interface InventoryItemBase {
    id: string;
    name: string;
    category: string;
    unit_type: string;
    is_active: boolean;
}

interface WaiterInventoryItem extends InventoryItemBase {
    is_available: boolean;
}

interface ManagerInventoryItem extends InventoryItemBase {
    current_stock: number;
    par_min: number;
    par_max: number;
}

interface AdminInventoryItem extends ManagerInventoryItem {
    cost_per_unit: number;
    supplier_id?: string;
    sku: string;
    expiry_days: number;
}

export type RoleAwareInventoryItem = WaiterInventoryItem | ManagerInventoryItem | AdminInventoryItem;

export const useRoleAwareInventory = () => {
    const [items, setItems] = useState<RoleAwareInventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { isOwnerOrAdmin, hasPermission, role } = useRoleAccess();

    const selectFields = useMemo(() => {
        // Admin/Owner: full access to all fields
        if (isOwnerOrAdmin) {
            return 'id, name, category, unit_type, is_active, current_stock, par_min, par_max, cost_per_unit, supplier_id, sku, expiry_days';
        }
        // Manager/Kitchen: stock counts but no cost data
        if (hasPermission('canViewInventoryStock')) {
            return 'id, name, category, unit_type, is_active, current_stock, par_min, par_max';
        }
        // Waiter/Others: basic info only (availability status)
        return 'id, name, category, unit_type, is_active';
    }, [isOwnerOrAdmin, hasPermission]);

    const fetchInventory = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('ingredients')
                .select(selectFields)
                .eq('is_active', true);

            if (fetchError) throw fetchError;

            // Transform data based on role for consistent typing
            const transformedData = (data || []).map(item => {
                if (!hasPermission('canViewInventoryStock')) {
                    // For waiters: simplified availability boolean
                    return {
                        ...item,
                        is_available: true,
                    } as WaiterInventoryItem;
                }
                return item as RoleAwareInventoryItem;
            });

            setItems(transformedData);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch inventory');
            console.error('Inventory fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory();

        const sub = supabase
            .channel('role_aware_inventory')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, fetchInventory)
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [selectFields]);

    return {
        items,
        loading,
        error,
        refetch: fetchInventory,
        role,
        canViewCost: hasPermission('canViewInventoryCost'),
        canViewStock: hasPermission('canViewInventoryStock'),
    };
};
