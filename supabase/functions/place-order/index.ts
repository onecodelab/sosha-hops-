import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
        }

        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const authClient = createClient(sbUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userErr } = await authClient.auth.getUser();

        if (userErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const organizationId = user.app_metadata?.organization_id;
        if (!organizationId) {
            return new Response(JSON.stringify({ error: 'Identity Error', detail: 'User is not bound to an organization' }), { status: 403, headers: corsHeaders });
        }

        const payload = await req.json();
        let { branch_id, items, order_details, table_id, telegram_id, source } = payload;

        // If order_details is provided (Chatbot pattern), destruct from it
        if (order_details) {
            table_id = table_id || order_details.table_id;
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
                telegram_id,
                source: source || 'chatbot'
            }
        });

        if (rpcErr || !result?.success) {
            console.error(`[RPC_ERROR] place_order_atomic failed:`, rpcErr || result?.error);
            return new Response(JSON.stringify({
                error: "Order Placement Failed",
                detail: rpcErr?.message || result?.error
            }), { status: 400, headers: corsHeaders });
        }

        return new Response(JSON.stringify({
            success: true,
            order_id: result.order_id,
            total_amount: result.total_amount,
            message: "Order placed successfully with atomic stock deduction."
        }), {
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
