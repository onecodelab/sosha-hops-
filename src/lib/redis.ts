
import { Redis } from '@upstash/redis';

/**
 * Global Redis client for real-time inventory checks.
 * Uses HTTP-based stateless client from @upstash/redis.
 */
// Safe environment variable retrieval
const REDIS_URL = import.meta.env.VITE_UPSTASH_REDIS_REST_URL || import.meta.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN || import.meta.env.UPSTASH_REDIS_REST_TOKEN || import.meta.env.TOKEN;

/**
 * Global Redis client for real-time inventory checks.
 * Uses HTTP-based stateless client from @upstash/redis.
 */
export const redis = (REDIS_URL && REDIS_TOKEN)
    ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
    : null;

/**
 * Helper to generate consistent Redis keys.
 */
export const getStockKey = (branchId: string, ingredientId: string) => `stock:${branchId}:${ingredientId}`;
