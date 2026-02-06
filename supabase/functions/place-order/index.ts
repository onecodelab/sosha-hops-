
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Initialize Clients
        const sbUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('REACT_APP_SUPABASE_URL');
        const sbKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('REACT_APP_SUPABASE_ANON_KEY');
        const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL') ?? Deno.env.get('VITE_UPSTASH_REDIS_REST_URL');
        const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') ?? Deno.env.get('VITE_UPSTASH_REDIS_REST_TOKEN');

        if (!sbUrl || !sbKey || !redisUrl || !redisToken) {
            throw new Error('Missing environment configuration');
        }

        const supabase = createClient(sbUrl, sbKey);
        const redis = new Redis({ url: redisUrl, token: redisToken });

        // 2. Parse Payload
        const { branch_id, items, order_details, user_id } = await req.json();

        if (!branch_id || !items || items.length === 0) {
            return new Response(JSON.stringify({ error: "Missing required data" }), { status: 400, headers: corsHeaders });
        }

        // 3. Resolve Dishes to Ingredients
        // Fetch recipe requirements for all items in the cart
        const { data: recipes, error: recipeErr } = await supabase
            .from("recipe_ingredients")
            .select(`
                ingredient_id,
                quantity_needed,
                recipe:recipes!inner(menu_item_id)
            `)
            .in("recipe.menu_item_id", items.map((i: any) => i.menu_item_id));

        if (recipeErr) throw recipeErr;

        // 4. Calculate Total Ingredient Impact
        const impactMap: Record<string, number> = {};
        for (const item of items) {
            const itemRecipes = recipes.filter((r: any) => r.recipe.menu_item_id === item.menu_item_id);
            for (const rec of itemRecipes) {
                const totalNeeded = rec.quantity_needed * item.quantity;
                impactMap[rec.ingredient_id] = (impactMap[rec.ingredient_id] || 0) + totalNeeded;
            }
        }

        const ingredientsToLock = Object.keys(impactMap);

        // If no ingredients (e.g., pure service items), verify stock isn't needed but proceed
        if (ingredientsToLock.length > 0) {
            // 5. ATOMIC DECREMENT (The Guard)
            const pipeline = redis.pipeline();
            for (const ingId of ingredientsToLock) {
                const key = `stock:${branch_id}:${ingId}`;
                pipeline.decrby(key, impactMap[ingId]);
            }

            // Execute decrements
            const stockLevels = await pipeline.exec();

            // 6. Check for Negative Stock (Failure)
            const failedIndices: number[] = [];
            stockLevels.forEach((level, index) => {
                if (typeof level === 'number' && level < 0) {
                    failedIndices.push(index);
                }
            });

            if (failedIndices.length > 0) {
                // ROLLBACK: Re-increment logic
                const rollbackPipeline = redis.pipeline();
                // Rollback ALL decrements to ensure consistency (even valid ones, since the ORDER failed)
                for (let i = 0; i < ingredientsToLock.length; i++) {
                    const ingId = ingredientsToLock[i];
                    const key = `stock:${branch_id}:${ingId}`;
                    rollbackPipeline.incrby(key, impactMap[ingId]);
                }
                await rollbackPipeline.exec();

                return new Response(JSON.stringify({
                    error: "Out of Stock",
                    detail: `Insufficient stock for items`
                }), { status: 409, headers: corsHeaders });
            }
        }

        // 7. PERSIST TO SQL: Record Order
        // Since stock is successfully locked in Redis, insert into Supabase
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .insert({
                ...order_details,
                branch_id,
                waiter_id: user_id,
                status: 'pending'
            })
            .select()
            .single();

        if (orderErr) {
            // Critical SQL Failure after Redis Success -> MUST Rollback Redis
            if (ingredientsToLock.length > 0) {
                const rollbackPipeline = redis.pipeline();
                for (const ingId of ingredientsToLock) {
                    const key = `stock:${branch_id}:${ingId}`;
                    rollbackPipeline.incrby(key, impactMap[ingId]);
                }
                await rollbackPipeline.exec();
            }
            throw orderErr;
        }

        // 8. Insert Order Items
        const itemsPayload = items.map((i: any) => ({
            order_id: order.id,
            menu_item_id: i.menu_item_id,
            quantity: i.quantity,
            price: i.price,
            special_instructions: i.notes
        }));

        const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);

        if (itemsErr) {
            // Note: Partial failure here is complex (Zombie order). 
            // In strict systems we'd delete the order or have a background cleanup.
            // For now, we throw to alert the user.
            throw itemsErr;
        }

        return new Response(JSON.stringify({ success: true, order_id: order.id }), { headers: corsHeaders });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
