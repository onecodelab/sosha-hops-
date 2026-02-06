import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env files
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Helper to find variable with multiple possible names
const getEnv = (key: string, altKey?: string) => {
    const val = process.env[key] || (altKey ? process.env[altKey] : undefined);
    return val ? val.trim() : '';
};

// GET CREDENTIALS
const supabaseUrl = getEnv('SUPABASE_URL', 'REACT_APP_SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY');
const redisUrl = getEnv('UPSTASH_REDIS_REST_URL', 'VITE_UPSTASH_REDIS_REST_URL');
const redisToken = getEnv('UPSTASH_REDIS_REST_TOKEN', 'VITE_UPSTASH_REDIS_REST_TOKEN');

// VALIDATION: Crash early if keys are missing
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ CRITICAL ERROR: Missing Supabase Credentials.');
    process.exit(1);
}

// Client with Retry Logic for Unstable Internet
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: {
        fetch: (url, options) => {
            return fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
        }
    }
});

const redis = new Redis({
    url: redisUrl,
    token: redisToken,
});

/**
 * Syncs SQL Stock levels to Redis
 */
async function syncInventory(branchId?: string) {
    console.log(`🚀 Starting Inventory Sync...`);

    try {
        let query = supabase.from('branch_inventory').select('branch_id, ingredient_id, current_stock');
        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query;

        if (error) throw error;

        if (!data || data.length === 0) {
            console.log('⚠️ No inventory records found in Supabase.');
            return;
        }

        console.log(`📦 Found ${data.length} items. Syncing to Redis...`);

        const pipeline = redis.pipeline();

        for (const item of data) {
            const key = `stock:${item.branch_id}:${item.ingredient_id}`;
            const stockValue = item.current_stock ?? 0;
            pipeline.set(key, stockValue);
        }

        const results = await pipeline.exec();
        console.log(`✅ Successfully synced ${results.length} items to Redis.`);

    } catch (err: any) {
        console.error('❌ Sync Failed:', err.message);
        if (err.cause) console.error('   Cause:', err.cause);
    }
}

// Run if called directly
const targetBranch = process.argv[2];
syncInventory(targetBranch).catch(console.error);
