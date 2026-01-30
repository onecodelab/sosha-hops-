
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL || '',
    process.env.REACT_APP_SUPABASE_ANON_KEY || ''
);

const redis = new Redis({
    url: process.env.VITE_UPSTASH_REDIS_REST_URL || '',
    token: process.env.VITE_UPSTASH_REDIS_REST_TOKEN || process.env.TOKEN || '',
});

/**
 * Syncs SQL Stock levels to Redis for a specific branch or all branches.
 */
async function syncInventory(branchId?: string) {
    console.log(`🚀 Starting Inventory Sync to Redis...`);

    let query = supabase.from('branch_inventory').select('branch_id, ingredient_id, current_stock');
    if (branchId) query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) {
        console.error('❌ Failed to fetch SQL inventory:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('⚠️ No inventory records found to sync.');
        return;
    }

    console.log(`📦 Syncing ${data.length} items...`);

    const pipeline = redis.pipeline();

    for (const item of data) {
        const key = `stock:${item.branch_id}:${item.ingredient_id}`;
        pipeline.set(key, item.current_stock);
    }

    const results = await pipeline.exec();
    console.log(`✅ Successfully synced ${results.length} items to Redis.`);
}

// Run if called directly
const targetBranch = process.argv[2];
syncInventory(targetBranch).catch(console.error);
