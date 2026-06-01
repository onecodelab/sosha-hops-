import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis";
import { corsHeaders, logAudit, resolveIdentity } from "../_shared/identity.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        const identity = await resolveIdentity(req, supabase);
        if (!identity) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const organizationId = identity.organizationId;
        if (!organizationId || organizationId === 'SERVICE_ROLE') {
            return new Response(JSON.stringify({ error: 'Identity Error', detail: 'Valid organization context required' }), { status: 403, headers: corsHeaders });
        }
        const actorId = identity.userId || null;

        const payload = await req.json();
        let { branch_id, items, order_details, table_id, telegram_id, source, idempotency_key } = payload;

        // --- IDEMPOTENCY CHECK ---
        const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
        const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
        const redis = (redisUrl && redisToken) ? new Redis({ url: redisUrl, token: redisToken }) : null;

        if (idempotency_key && redis) {
            const cachedResult = await redis.get(`idempotency:order:${idempotency_key}`);
            if (cachedResult) {
                console.log(`[IDEMPOTENCY] Returning cached result for key: ${idempotency_key}`);
                return new Response(JSON.stringify(cachedResult), { headers: corsHeaders, status: 200 });
            }
        }

        // If order_details is provided (Chatbot pattern), destruct from it
        if (order_details) {
            table_id = table_id || order_details.table_id;
            if (!order_details.table_number && table_id) {
                const { data: tableData } = await supabase
                    .from('tables')
                    .select('table_number')
                    .eq('id', table_id)
                    .maybeSingle();

                order_details.table_number = tableData?.table_number || order_details.table_number;
            }
            branch_id = branch_id || order_details.branch_id;
            telegram_id = telegram_id || order_details.telegram_id;
            source = source || order_details.source;
        }

        if (!branch_id || !items || !Array.isArray(items)) {
            return new Response(JSON.stringify({ error: "Invalid payload", detail: "branch_id and items array are required" }), { status: 400, headers: corsHeaders });
        }

        // --- ATOMIC EXECUTION ---
        const { data: result, error: rpcErr } = await supabase.rpc('place_order_atomic', {
            p_branch_id: branch_id,
            p_items: items,
            p_order_details: {
                table_id,
                table_number: order_details?.table_number,
                telegram_id,
                source: source || 'chatbot'
            },
            p_organization_id: organizationId
        });

        if (rpcErr || !result?.success) {
            console.error(`[RPC_ERROR] place_order_atomic failed:`, rpcErr || result?.error);
            return new Response(JSON.stringify({
                error: "Order Placement Failed",
                detail: rpcErr?.message || result?.error
            }), { status: 400, headers: corsHeaders });
        }

        const responseData = {
            success: true,
            order_id: result.order_id,
            total_amount: result.total_amount,
            message: "Order placed successfully with atomic stock deduction."
        };

        // --- CACHE RESULT (IDEMPOTENCY) ---
        if (idempotency_key && redis) {
            await redis.set(`idempotency:order:${idempotency_key}`, responseData, { ex: 86400 }); // Cache for 24h
        }

        // --- AUDIT LOG ---
        if (actorId) {
            await logAudit(supabase, organizationId, actorId, 'PLACE_ORDER', 'order', result.order_id, { items_count: items.length, total: result.total_amount });
        }

        return new Response(JSON.stringify(responseData), {
            headers: corsHeaders,
            status: 200,
        });

    } catch (error: any) {
        console.error("[place-order] Fatal Error:", error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: corsHeaders,
            status: 500,
        });
    }
});
