
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.4";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const redis = new Redis({
            url: Deno.env.get("UPSTASH_REDIS_REST_URL") ?? "",
            token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN") ?? "",
        });

        const { branch_id, items, order_details, user_id } = await req.json();

        if (!branch_id || !items || items.length === 0) {
            return new Response(JSON.stringify({ error: "Missing required data" }), { status: 400, headers: corsHeaders });
        }

        // 1. Resolve Dishes to Ingredients
        // We fetch the recipe requirements for all items in the cart
        const { data: recipes, error: recipeErr } = await supabaseClient
            .from("recipe_ingredients")
            .select(`
        ingredient_id,
        quantity_needed,
        unit_type,
        out_of_stock_impact,
        recipe:recipes!inner(menu_item_id)
      `)
            .in("recipe.menu_item_id", items.map((i: any) => i.menu_item_id));

        if (recipeErr) throw recipeErr;

        // 2. Calculate Total Ingredient Impact
        const impactMap: Record<string, number> = {};
        for (const item of items) {
            const itemRecipes = recipes.filter((r: any) => r.recipe.menu_item_id === item.menu_item_id);
            for (const rec of itemRecipes) {
                // Simple unit conversion or assume standard units for now (Logic can be expanded)
                const totalNeeded = rec.quantity_needed * item.quantity;
                impactMap[rec.ingredient_id] = (impactMap[rec.ingredient_id] || 0) + totalNeeded;
            }
        }

        // 3. ATOMIC GUARD: Check and Decrement Redis
        // We use a Redis pipeline for atomicity and speed
        const ingredientsToLock = Object.keys(impactMap);
        const pipeline = redis.pipeline();

        for (const ingId of ingredientsToLock) {
            const key = `stock:${branch_id}:${ingId}`;
            pipeline.get(key);
        }

        const currentStocks = await pipeline.exec();

        // Check if any item would go below 0
        for (let i = 0; i < ingredientsToLock.length; i++) {
            const id = ingredientsToLock[i];
            const stock = Number(currentStocks[i] ?? 0);
            if (stock < impactMap[id]) {
                return new Response(JSON.stringify({
                    error: "Out of Stock",
                    detail: `Insufficient stock for ingredient ${id}`
                }), { status: 409, headers: corsHeaders });
            }
        }

        // Perform actual decrement
        const decrPipeline = redis.pipeline();
        for (const ingId of ingredientsToLock) {
            decrPipeline.decrby(`stock:${branch_id}:${ingId}`, Math.ceil(impactMap[ingId]));
        }
        await decrPipeline.exec();

        // 4. PERSIST TO SQL: Record Order
        // Since stock is locked in Redis, we can now insert into Supabase
        // (Note: Production version would use a DB Transaction here)
        const { data: order, error: orderErr } = await supabaseClient
            .from('orders')
            .insert({
                ...order_details,
                branch_id,
                waiter_id: user_id,
                status: 'pending'
            })
            .select()
            .single();

        if (orderErr) throw orderErr;

        const itemsPayload = items.map((i: any) => ({
            order_id: order.id,
            menu_item_id: i.menu_item_id,
            quantity: i.quantity,
            price: i.price,
            special_instructions: i.notes
        }));

        const { error: itemsErr } = await supabaseClient.from('order_items').insert(itemsPayload);
        if (itemsErr) throw itemsErr;

        return new Response(JSON.stringify({ success: true, order_id: order.id }), { headers: corsHeaders });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
