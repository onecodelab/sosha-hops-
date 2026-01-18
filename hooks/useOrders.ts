import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { Order } from '../types';
import { orderService } from '../services/orderService';
import { showToast } from '../components/ui';

export const useOrders = (waiterId?: string) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await orderService.fetchActiveOrders(waiterId);
            setOrders(data);
        } catch (err: any) {
            showToast("Order Sync Failed: " + err.message, "error");
        } finally {
            setIsLoading(false);
        }
    }, [waiterId]);

    useEffect(() => {
        fetchOrders();

        const channelName = waiterId ? `waiter_sync_${waiterId}` : 'kitchen_sync_all';
        const sub = supabase.channel(channelName)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: waiterId ? `waiter_id=eq.${waiterId}` : undefined
            }, () => fetchOrders())
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'order_items'
            }, () => fetchOrders())
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [fetchOrders, waiterId]);

    const kitchenPipeline = useMemo(() =>
        orders.filter(o => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)),
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
