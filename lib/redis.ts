
import { Redis } from '@upstash/redis';

/**
 * Global Redis client for real-time inventory checks.
 * Uses HTTP-based stateless client from @upstash/redis.
 */
export const redis = new Redis({
    url: import.meta.env.VITE_UPSTASH_REDIS_REST_URL,
    token: import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN || import.meta.env.TOKEN, // Handling both names
});

/**
 * Helper to generate consistent Redis keys.
 */
export const getStockKey = (branchId: string, ingredientId: string) => `stock:${branchId}:${ingredientId}`;
