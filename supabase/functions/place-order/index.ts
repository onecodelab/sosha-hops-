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
        const sbUrl = Deno.env.get('SUPABASE_URL');
        // Use SERVICE_ROLE_KEY to bypass RLS for chatbot orders
        const sbKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
        const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL') ?? Deno.env.get('VITE_UPSTASH_REDIS_REST_URL');
        const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') ?? Deno.env.get('VITE_UPSTASH_REDIS_REST_TOKEN');

        if (!sbUrl || !sbKey) {
            throw new Error('Missing Supabase configuration');
        }

        const supabase = createClient(sbUrl, sbKey);
        // Redis is optional - if not set, skip stock checking
        const redis = (redisUrl && redisToken) ? new Redis({ url: redisUrl, token: redisToken }) : null;

        // 2. Parse Payload
        let { branch_id, items, order_details, user_id, source, table_number } = await req.json();

        if (!branch_id || !items) {
            return new Response(JSON.stringify({ error: "Missing required data" }), { status: 400, headers: corsHeaders });
        }

        // Robustness: If items comes as a JSON string from Flowise, parse it
        if (typeof items === 'string') {
            try {
                items = JSON.parse(items);
            } catch (e) {
                console.error("Failed to parse items string:", e);
                return new Response(JSON.stringify({ error: "Invalid items format" }), { status: 400, headers: corsHeaders });
            }
        }

        if (!Array.isArray(items) || items.length === 0) {
            return new Response(JSON.stringify({ error: "Items must be a non-empty array" }), { status: 400, headers: corsHeaders });
        }

        // 2.1 Resolve Table and Session if table_number is provided
        let tableId = null;
        let sessionId = null;
        if (table_number) {
            const { data: tableData } = await supabase
                .from('tables')
                .select('id, table_number, organization_id')
                .eq('branch_id', branch_id)
                .eq('table_number', table_number)
                .maybeSingle();

            if (tableData) {
                tableId = tableData.id;
                // If table is found, we can trust its org ID (optimization)
                if (tableData.organization_id) {
                    // We will use this below
                }

                // Find or create active session
                const { data: existingSessions } = await supabase
                    .from('table_sessions')
                    .select('id')
                    .eq('table_id', tableId)
                    .eq('is_active', true);

                if (existingSessions && existingSessions.length > 0) {
                    sessionId = existingSessions[0].id;
                } else {
                    const { data: newSession } = await supabase
                        .from('table_sessions')
                        .insert({
                            table_id: tableId,
                            is_active: true,
                            seated_at: new Date().toISOString()
                        })
                        .select()
                        .single();
                    if (newSession) sessionId = newSession.id;
                }
            }
        }

        // Normalize items: ensure menu_item_id is present (Flowise might just send 'id')
        const normalizedItems = items.map((i: any) => ({
            ...i,
            menu_item_id: i.menu_item_id || i.id
        }));

        // 3. Resolve Menu Prices and Ingredients
        const itemIdentifiers = normalizedItems.map((i: any) => i.menu_item_id);
        console.log(`Resolving items: ${JSON.stringify(itemIdentifiers)}`);

        // Fetch all possible menu items for this branch once (Small list, safe and robust)
        let menuQuery = supabase.from('menu').select('id, name, price');
        if (branch_id && branch_id !== '00000000-0000-0000-0000-000000000000') {
            menuQuery = menuQuery.eq('branch_id', branch_id);
        }

        const { data: menuItems, error: menuErr } = await menuQuery;

        if (menuErr) {
            console.error("Menu fetch error:", menuErr);
        }

        // 2.2 Resolve Organization ID (CRITICAL for Multi-Tenancy)
        // We need the organization_id to insert into orders/order_items.
        // We can get it from the branch.
        const { data: branchData, error: branchErr } = await supabase
            .from('branches')
            .select('organization_id')
            .eq('id', branch_id)
            .single();

        if (branchErr || !branchData) {
            return new Response(JSON.stringify({ error: "Invalid Branch ID or Branch not found" }), { status: 400, headers: corsHeaders });
        }
        const organizationId = branchData.organization_id;

        // Helper to slugify names for flexible matching
        const slugify = (text: string) => text?.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Calculate Totals & Map to UUIDs
        let orderTotal = 0;
        const unresolvable: string[] = [];

        for (const item of normalizedItems) {
            const inputId = item.menu_item_id?.toString();
            const inputSlug = slugify(inputId);

            // Flexible match levels: 1. UUID, 2. Name, 3. Slug Name
            const menuItem = menuItems?.find(m =>
                m.id === inputId ||
                m.name?.toLowerCase() === inputId?.toLowerCase() ||
                slugify(m.name) === inputSlug ||
                (inputSlug?.length > 3 && slugify(m.name)?.includes(inputSlug)) ||
                (slugify(m.name)?.length > 3 && inputSlug?.includes(slugify(m.name)))
            );

            if (menuItem) {
                item.price = menuItem.price || 0;
                item.menu_item_id = menuItem.id; // Map back to real UUID
                console.log(`Resolved: ${inputId} -> ${menuItem.name} (${menuItem.id}) at ${item.price}`);
            } else {
                console.warn(`Could not resolve item: ${inputId}`);
                unresolvable.push(inputId);
            }
            orderTotal += (item.price || 0) * (item.quantity || 1);
        }

        if (unresolvable.length > 0) {
            return new Response(JSON.stringify({
                error: "Items not found",
                detail: `I couldn't find ${unresolvable.join(', ')} in the menu. fr. Please use the exact names or IDs from search_menu_items.`
            }), { status: 400, headers: corsHeaders });
        }

        const vatRate = 0.15; // 15% VAT
        const subtotal = orderTotal / (1 + vatRate);
        const vatAmount = orderTotal - subtotal;

        // 3.1 Resolve Dishes to Ingredients
        let recipes: any[] = [];
        try {
            const resolvedItemIds = normalizedItems.map((i: any) => i.menu_item_id).filter((id: string) => id && id.includes('-'));
            if (resolvedItemIds.length > 0) {
                const { data: recipesData, error: recipeErr } = await supabase
                    .from("recipe_ingredients")
                    .select(`
                        ingredient_id,
                        quantity_needed,
                        recipe:recipes!inner(menu_item_id)
                    `)
                    .in("recipe.menu_item_id", resolvedItemIds);

                if (!recipeErr && recipesData) {
                    recipes = recipesData;
                }
            }
        } catch (e: any) {
            console.log("Recipe lookup skipped:", e.message);
        }

        // 4. Calculate Total Ingredient Impact
        const impactMap: Record<string, number> = {};
        for (const item of normalizedItems) {
            const itemRecipes = recipes.filter((r: any) => r.recipe.menu_item_id === item.menu_item_id);
            for (const rec of itemRecipes) {
                const totalNeeded = rec.quantity_needed * item.quantity;
                impactMap[rec.ingredient_id] = (impactMap[rec.ingredient_id] || 0) + totalNeeded;
            }
        }

        const ingredientsToLock = Object.keys(impactMap);

        // If no ingredients (e.g., pure service items), verify stock isn't needed but proceed
        // Redis is optional - skip stock checking if redis is not configured
        if (ingredientsToLock.length > 0 && redis) {
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
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .insert({
                ...(order_details || {}),
                branch_id,
                organization_id: organizationId, // Added Organization Context
                table_id: tableId,
                table_number: table_number || null,
                waiter_id: user_id || null, // null for unassigned chatbot orders
                source: source || 'chatbot',
                status: 'pending',
                total_amount: orderTotal,
                subtotal_amount: subtotal,
                vat_amount: vatAmount,
                vat_rate: 15 // Standard 15%
            })
            .select()
            .single();

        if (orderErr) {
            // Critical SQL Failure after Redis Success -> MUST Rollback Redis
            if (ingredientsToLock.length > 0 && redis) {
                const rollbackPipeline = redis.pipeline();
                for (const ingId of ingredientsToLock) {
                    const key = `stock:${branch_id}:${ingId}`;
                    rollbackPipeline.incrby(key, impactMap[ingId]);
                }
                await rollbackPipeline.exec();
            }
            throw orderErr;
        }

        // 7.1 Update Table to Occupied if tableId is present
        if (tableId) {
            await supabase.from('tables').update({
                status: 'occupied',
                current_order_id: order.id,
                current_session_id: sessionId,
                last_updated: new Date().toISOString()
            }).eq('id', tableId);
        }

        // 8. Insert Order Items
        const itemsPayload = normalizedItems.map((i: any) => ({
            order_id: order.id,
            organization_id: organizationId, // Added Organization Context
            menu_item_id: i.menu_item_id,
            quantity: i.quantity,
            price: i.price || 0, // Fallback if missing
            special_instructions: i.notes || ''
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
