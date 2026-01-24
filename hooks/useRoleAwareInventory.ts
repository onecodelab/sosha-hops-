import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { useRoleAccess } from './useRoleAccess';
import { Role } from '../types';
import { useBranch } from '../contexts/BranchContext';

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
    const { activeBranchId } = useBranch();

    const selectFields = useMemo(() => {
        // We always fetch the global ingredient fields
        let fields = 'id, name, category, unit_type, is_active';

        if (isOwnerOrAdmin) {
            fields += ', cost_per_unit, supplier_id, sku, expiry_days';
        }

        // Add the branch-specific stock details
        // We use !branch_inventory(current_stock...) to join the table
        // Note: Field names in branch_inventory must match what the UI expects or we transform them
        if (hasPermission('canViewInventoryStock')) {
            fields += ', branch_inventory(current_stock, par_min, par_max)';
        }

        return fields;
    }, [isOwnerOrAdmin, hasPermission]);

    const fetchInventory = async () => {
        if (!activeBranchId) return;

        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('ingredients')
                .select(selectFields)
                .eq('is_active', true)
                .eq('branch_inventory.branch_id', activeBranchId);

            if (fetchError) throw fetchError;

            // Transform data based on role for consistent typing
            const transformedData = (data || []).map(item => {
                // Flatten branch_inventory data back to the top-level for UI compatibility
                const stockData = Array.isArray(item.branch_inventory)
                    ? item.branch_inventory[0]
                    : item.branch_inventory;

                const normalizedItem = {
                    ...item,
                    current_stock: stockData?.current_stock ?? 0,
                    par_min: stockData?.par_min ?? 0,
                    par_max: stockData?.par_max ?? 0,
                };

                if (!hasPermission('canViewInventoryStock')) {
                    // For waiters: simplified availability boolean
                    return {
                        ...normalizedItem,
                        is_available: normalizedItem.current_stock > 0,
                    } as WaiterInventoryItem;
                }
                return normalizedItem as RoleAwareInventoryItem;
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

        // Subscribe to both ingredients and branch_inventory changes
        const ingredientsChannel = supabase
            .channel('ingredients_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, fetchInventory)
            .subscribe();

        const branchInventoryChannel = supabase
            .channel('branch_inventory_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'branch_inventory',
                filter: `branch_id=eq.${activeBranchId}`
            }, fetchInventory)
            .subscribe();

        return () => {
            supabase.removeChannel(ingredientsChannel);
            supabase.removeChannel(branchInventoryChannel);
        };
    }, [selectFields, activeBranchId]);

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
