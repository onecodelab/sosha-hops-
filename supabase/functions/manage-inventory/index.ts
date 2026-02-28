
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis";

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );


        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
        }

        const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userErr } = await authClient.auth.getUser();
        if (userErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
        const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

        const redis = (redisUrl && redisToken)
            ? new Redis({ url: redisUrl, token: redisToken })
            : null;

        const body = await req.json();
        const { action, branch_id, items, reason, organization_id: input_org_id } = body;
        // items: [{ ingredient_id, quantity, old_quantity }] 
        // quantity is the NEW TARGET VALUE for 'update' action

        if (!branch_id || !items) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
        }

        // Fetch Organization ID
        const { data: branchData, error: branchErr } = await supabase
            .from('branches')
            .select('organization_id')
            .eq('id', branch_id)
            .single();

        if (branchErr || !branchData) {
            return new Response(JSON.stringify({ error: "Invalid Branch ID" }), { status: 400, headers: corsHeaders });
        }
        const organizationId = branchData.organization_id;

        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (profileErr || !profile || profile.organization_id !== organizationId) {
            return new Response(JSON.stringify({ error: 'Unauthorized for this branch' }), { status: 403, headers: corsHeaders });
        }

        // SACRED RULE: Tenant Isolation
        if (input_org_id && input_org_id !== organizationId) {
            return new Response(JSON.stringify({ error: "Tenant isolation violation" }), { status: 403, headers: corsHeaders });
        }

        if (!['owner', 'admin', 'manager'].includes(profile.role)) {
            return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403, headers: corsHeaders });
        }

        // Auth Check (Optional if relying on RLS, but proactive is better)
        // Here we trust the caller (authenticated client), ensuring we use Service Role to bypass strict RLS if needed,
        // but we should verify the user belongs to the branch/org effectively.
        // For MVP BFF, we assume the client sends valid tokens which Supabase Auth validates.

        const transactionLog = [];
        const pipeline = redis.pipeline();

        for (const item of items) {
            const { ingredient_id, quantity, current_stock, par_min, par_max } = item;

            // 1. Update SQL
            const { error: sqlErr } = await supabase
                .from('branch_inventory')
                .upsert({
                    branch_id,
                    ingredient_id,
                    current_stock: Number(quantity),
                    par_min: par_min !== undefined ? Number(par_min) : undefined,
                    par_max: par_max !== undefined ? Number(par_max) : undefined,
                    last_updated: new Date().toISOString()
                }, { onConflict: 'branch_id,ingredient_id' });

            if (sqlErr) throw sqlErr;

            // 2. Update Redis (We only cache current_stock for high-speed checks)
            const key = `stock:${branch_id}:${ingredient_id}`;
            pipeline.set(key, Number(quantity));

            // 3. Prepare Audit Log
            transactionLog.push({
                branch_id,
                organization_id: organizationId,
                ingredient_id,
                transaction_type: 'audit',
                quantity: Number(quantity) - (current_stock || 0),
                performed_by: user.id,
                reason: reason || 'Manual Adjustment',
                created_at: new Date().toISOString()
            });
        }

        // Execute Redis Pipeline (Non-blocking)
        if (redis) {
            try {
                await redis.pipeline().exec();
            } catch (redisErr) {
                console.error("[REDIS ERROR] Pipeline failed:", redisErr.message);
                // We proceed since SQL is primary
            }
        }

        // Execute Audit Log Insert
        if (transactionLog.length > 0) {
            await supabase.from('inventory_transactions').insert(transactionLog);
        }

        return new Response(JSON.stringify({ success: true, message: "Inventory updated" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
