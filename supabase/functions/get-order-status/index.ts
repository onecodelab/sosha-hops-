import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        const authClient = createClient(sbUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userErr } = await authClient.auth.getUser();

        if (userErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        const { order_id, table_number, branch_id } = await req.json();

        // 1. Authorization: Fetch User Profile for Organization Context
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (profileErr || !profile) {
            return new Response(JSON.stringify({ error: 'User profile not found' }), { status: 403, headers: corsHeaders });
        }

        let query = supabase
            .from('orders')
            .select(`
                id, 
                status, 
                table_number, 
                total_amount, 
                payment_status,
                created_at,
                organization_id,
                items:order_items(
                    quantity,
                    menu_item:menu!menu_item_id(name)
                )
            `);

        // Search by Order ID (Preferred)
        if (order_id) {
            query = query.eq('id', order_id);
        }
        // Or Search by Table Number + Branch (For "How is table 5 doing?")
        else if (table_number && branch_id) {
            query = query
                .eq('table_number', table_number)
                .eq('branch_id', branch_id)
                .neq('status', 'closed') // Only active orders
                .neq('status', 'cancelled')
                .order('created_at', { ascending: false })
                .limit(1);
        } else {
            throw new Error("Please provide an order_id OR (table_number and branch_id).");
        }

        const { data, error } = await query.maybeSingle();

        if (error) throw error;

        if (!data) {
            return new Response(JSON.stringify({
                found: false,
                message: "I couldn't find an active order for that."
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        // SACRED RULE: Tenant Isolation
        if (data.organization_id !== profile.organization_id) {
            return new Response(JSON.stringify({ error: 'Tenant isolation violation' }), { status: 403, headers: corsHeaders });
        }

        // Translate Status for Humans/Agent
        const humanStatus = {
            'pending': "Waiting for waiter approval",
            'accepted': "Order accepted! Preparing now.",
            'preparing': "In the kitchen, cooking.",
            'ready': "Ready to serve!",
            'served': "Served. Enjoy!",
            'paid': "Paid. Thank you!",
            'closed': "Closed."
        }[data.status] || data.status;

        return new Response(JSON.stringify({
            found: true,
            order_id: data.id,
            status_code: data.status,
            status_message: humanStatus,
            total: data.total_amount,
            payment_status: data.payment_status,
            items: data.items.map((i: any) => `${i.quantity}x ${i.menu_item?.name}`).join(', ')
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
