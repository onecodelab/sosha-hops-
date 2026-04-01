import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

        let body: any = {};
        try {
            body = (await req.json()) || {};
        } catch (e: any) {
            console.error("[ManageFloor] Bad JSON body:", e.message);
        }

        const { action, branch_id, table_id } = body;
        console.log(`[ManageFloor] Action: ${action}, Table: ${table_id}`);

        if (!action) {
            return new Response(JSON.stringify({ error: "Missing required field: action" }), { status: 400, headers: corsHeaders });
        }

        // 1. Authorization
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (!['owner', 'admin'].includes(profile?.role)) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
        }
        const organizationId = profile.organization_id;

        // 2. Handle Actions
        if (action === 'list_branches') {
            const { data, error } = await supabase
                .from('branches')
                .select('id, name, location, organization_id')
                .eq('organization_id', organizationId);

            if (error) throw error;

            return new Response(JSON.stringify({
                success: true,
                branches: data
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        if (action === 'view_map') {
            let query = supabase
                .from('tables')
                .select('id, table_number, status, branch_id, current_session_id')
                .eq('organization_id', organizationId);

            if (branch_id) {
                query = query.eq('branch_id', branch_id);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Summary stats
            const occupied = data.filter(t => t.status === 'occupied').length;
            const available = data.length - occupied;

            return new Response(JSON.stringify({
                success: true,
                stats: { total: data.length, occupied, available },
                tables: data.map(t => `Table ${t.table_number}: ${t.status}`)
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        if (action === 'clear_table') {
            if (!table_id) throw new Error("Table ID required");

            // Check ownership
            const { data: table } = await supabase.from('tables').select('organization_id').eq('id', table_id).single();
            if (table?.organization_id !== organizationId) throw new Error("Unauthorized table access");

            // Logic from orderService to clear
            await supabase.from('table_sessions').update({ is_active: false, closed_at: new Date().toISOString() }).eq('table_id', table_id).eq('is_active', true);
            await supabase.from('tables').update({ status: 'available', current_order_id: null, current_session_id: null }).eq('id', table_id);

            return new Response(JSON.stringify({ success: true, message: `Table cleared.` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        if (action === 'cancel_and_release_table') {
            if (!table_id) throw new Error("Table ID required");

            const { data: table, error: tableErr } = await supabase
                .from('tables')
                .select('id, table_number, organization_id, current_order_id, current_session_id, status')
                .eq('id', table_id)
                .single();

            if (tableErr) throw tableErr;
            if (table?.organization_id !== organizationId) throw new Error("Unauthorized table access");

            let activeOrder: any = null;
            if (table.current_order_id) {
                const { data: currentOrder, error: orderErr } = await supabase
                    .from('orders')
                    .select('id, status, source, waiter_id, closed_at, table_id, order_number')
                    .eq('id', table.current_order_id)
                    .maybeSingle();
                if (orderErr) throw orderErr;
                activeOrder = currentOrder;
            }

            if (!activeOrder) {
                const { data: latestOrder, error: latestErr } = await supabase
                    .from('orders')
                    .select('id, status, source, waiter_id, closed_at, table_id, order_number')
                    .eq('table_id', table_id)
                    .is('closed_at', null)
                    .neq('status', 'cancelled')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (latestErr) throw latestErr;
                activeOrder = latestOrder;
            }

            if (!activeOrder) {
                await supabase
                    .from('table_sessions')
                    .update({ is_active: false, closed_at: new Date().toISOString() })
                    .eq('table_id', table_id)
                    .eq('is_active', true);

                await supabase
                    .from('tables')
                    .update({ status: 'available', current_order_id: null, current_session_id: null })
                    .eq('id', table_id);

                return new Response(JSON.stringify({
                    success: true,
                    message: `Table ${table.table_number} released.`
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            const isChatbotOwned = activeOrder.source === 'chatbot' || !activeOrder.waiter_id;
            if (!isChatbotOwned) {
                return new Response(JSON.stringify({
                    error: "Only chatbot-owned or unassigned orders can be cancelled from this action."
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 409
                });
            }

            const now = new Date().toISOString();

            await supabase
                .from('orders')
                .update({
                    status: 'cancelled',
                    payment_status: 'failed',
                    closed_at: now,
                    completed_at: now,
                    last_updated: now,
                    closed_by_id: user.id
                })
                .eq('id', activeOrder.id);

            await supabase
                .from('table_sessions')
                .update({ is_active: false, closed_at: now })
                .eq('table_id', table_id)
                .eq('is_active', true);

            await supabase
                .from('tables')
                .update({
                    status: 'available',
                    current_order_id: null,
                    current_session_id: null,
                    last_updated: now
                })
                .eq('id', table_id);

            return new Response(JSON.stringify({
                success: true,
                message: `Order cancelled and table ${table.table_number} released.`,
                order_id: activeOrder.id,
                table_number: table.table_number
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        if (action === 'cleanup_orphaned_orders') {
            const now = new Date().toISOString();

            let ordersQuery = supabase
                .from('orders')
                .select('id, table_id, table_number, branch_id, source, waiter_id, status, closed_at')
                .eq('organization_id', organizationId)
                .is('closed_at', null)
                .neq('status', 'cancelled')
                .neq('status', 'closed');

            if (branch_id) {
                ordersQuery = ordersQuery.eq('branch_id', branch_id);
            }

            const { data: activeOrders, error: activeOrdersErr } = await ordersQuery;
            if (activeOrdersErr) throw activeOrdersErr;

            const orphanedIds: string[] = [];

            for (const order of activeOrders || []) {
                if (!order.table_id) continue;

                const { data: linkedTable, error: linkedTableErr } = await supabase
                    .from('tables')
                    .select('id')
                    .eq('id', order.table_id)
                    .maybeSingle();

                if (linkedTableErr) throw linkedTableErr;

                if (!linkedTable && (order.source === 'chatbot' || !order.waiter_id)) {
                    orphanedIds.push(order.id);
                }
            }

            if (orphanedIds.length > 0) {
                const { error: cancelErr } = await supabase
                    .from('orders')
                    .update({
                        status: 'cancelled',
                        payment_status: 'failed',
                        closed_at: now,
                        completed_at: now,
                        last_updated: now,
                        closed_by_id: user.id
                    })
                    .in('id', orphanedIds);

                if (cancelErr) throw cancelErr;
            }

            return new Response(JSON.stringify({
                success: true,
                cleaned: orphanedIds.length,
                message: orphanedIds.length > 0
                    ? `${orphanedIds.length} orphaned chatbot orders were cancelled.`
                    : 'No orphaned chatbot orders found.'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        console.warn(`[ManageFloor] Unsupported action received: '${action}'`);
        return new Response(JSON.stringify({ 
            error: "Invalid Action",
            received: action,
            details: `Action '${action}' is not recognized. Supported actions: list_branches, view_map, clear_table, cancel_and_release_table, cleanup_orphaned_orders`,
            suggestions: ["Check for typos in action name", "Ensure the Edge Function is deployed"]
        }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
