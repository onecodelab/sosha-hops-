
import { useState, useEffect, useCallback } from 'react';
import { redis, getStockKey } from '../lib/redis';
import { useBranch } from '../contexts/BranchContext';

/**
 * Hook to peek into Redis for live stock levels.
 * This is "the Viewer" layer.
 */
export const useRedisStock = (ingredientIds: string[]) => {
    const { activeBranchId } = useBranch();
    const [stockMap, setStockMap] = useState<Record<string, number>>({});
    const [lastCheck, setLastCheck] = useState<number>(Date.now());

    const fetchLiveStock = useCallback(async () => {
        if (!activeBranchId || ingredientIds.length === 0) return;

        try {
            if (!redis) return;

            // Create pipeline for efficiency
            const pipeline = redis.pipeline();
            for (const id of ingredientIds) {
                pipeline.get(getStockKey(activeBranchId, id));
            }

            const results = await pipeline.exec();

            const newMap: Record<string, number> = {};
            ingredientIds.forEach((id, index) => {
                // Fallback to null if key doesn't exist (means we use SQL value)
                const val = results[index];
                if (val !== null && val !== undefined) {
                    newMap[id] = Number(val);
                }
            });

            setStockMap(newMap);
            setLastCheck(Date.now());
        } catch (err) {
            console.error('Redis Peak Error:', err);
            // Fail gracefully: if Redis is down, we just don't populate the map,
            // and UI will fallback to SQL-based 'is_available'.
        }
    }, [activeBranchId, ingredientIds]);

    useEffect(() => {
        fetchLiveStock();

        // Pulse check: re-fetch every 30 seconds for passive updates 
        // (Actual order placement will be managed by the Guard).
        const interval = setInterval(fetchLiveStock, 30000);
        return () => clearInterval(interval);
    }, [fetchLiveStock]);

    return { stockMap, refreshStock: fetchLiveStock, lastCheck };
};
