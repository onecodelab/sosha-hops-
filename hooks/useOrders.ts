import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { Order } from '../types';
import { orderService } from '../services/orderService';
import { useBranch } from '../contexts/BranchContext';
import { showToast } from '../components/ui';

export const useOrders = (waiterId?: string) => {
    const { activeBranchId } = useBranch();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchOrders = useCallback(async () => {
        if (!activeBranchId) return;
        setIsLoading(true);
        try {
            const data = await orderService.fetchActiveOrders(activeBranchId, waiterId);
            setOrders(data);
        } catch (err: any) {
            showToast("Order Sync Failed: " + err.message, "error");
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId, waiterId]);

    useEffect(() => {
        if (!activeBranchId) return;
        fetchOrders();

        const channelName = waiterId ? `waiter_sync_${waiterId}` : `branch_sync_${activeBranchId}`;

        // Subscription filter: Listen for either the waiter's orders OR any unassigned chatbot orders
        // Note: Real-time filtering is simple. To be safe, we listen for everything in the branch
        // and let fetchOrders() handle the specific filtering according to orderService rules.
        const orderFilter = `branch_id=eq.${activeBranchId}`;

        const sub = supabase.channel(channelName)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: orderFilter
            }, () => fetchOrders())
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'order_items'
                // We'd ideally filter order_items too, but they don't have branch_id.
                // Re-fetching when ANY order_item changes is the current fallback.
            }, () => fetchOrders())
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [fetchOrders, waiterId, activeBranchId]);

    const kitchenPipeline = useMemo(() =>
        orders.filter(o =>
            ['pending', 'accepted', 'preparing', 'ready'].includes(o.status) &&
            !(o.source === 'chatbot' && !o.waiter_id) // Exclude unassigned chatbot orders (they go to verification queue)
        ),
        [orders]
    );

    const billingQueue = useMemo(() =>
        orders.filter(o => ['served', 'paid'].includes(o.status)),
        [orders]
    );

    return {
        orders,
        kitchenPipeline,
        billingQueue,
        isLoading,
        refresh: fetchOrders
    };
};
