import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis";

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let currentStep = 'initialization';
    try {
        const startTime = Date.now();
        const sbUrl = Deno.env.get('SUPABASE_URL') || '';
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

        if (!sbUrl || !sbKey) {
            return new Response(JSON.stringify({ error: "Configuration Error", detail: "Missing Supabase credentials" }), { status: 500, headers: corsHeaders });
        }

        const supabase = createClient(sbUrl, sbKey);

        const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL') || Deno.env.get('VITE_UPSTASH_REDIS_REST_URL');
        const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || Deno.env.get('VITE_UPSTASH_REDIS_REST_TOKEN');
        const redis = (redisUrl && redisToken) ? new Redis({ url: redisUrl, token: redisToken }) : null;

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
        }

        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        const authClient = createClient(sbUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userErr } = await authClient.auth.getUser();
        if (userErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        currentStep = 'parsing_payload';
        const payload = await req.json();
        let { branch_id, items, order_details, source, table_number, table_id, user_id, organization_id: input_org_id } = payload;

        if (order_details) {
            table_number = table_number || order_details.table_number;
            table_id = table_id || order_details.table_id;
            user_id = user_id || order_details.user_id;
            branch_id = branch_id || order_details.branch_id;
        }

        if (!branch_id || !items) {
            return new Response(JSON.stringify({ error: "Missing required fields", detail: "branch_id and items are mandatory" }), { status: 400, headers: corsHeaders });
        }

        currentStep = 'resolving_organization';
        const { data: branchData, error: branchErr } = await supabase
            .from('branches')
            .select('organization_id, name')
            .eq('id', branch_id)
            .single();

        if (branchErr || !branchData) {
            return new Response(JSON.stringify({ error: "Isolation Error", detail: "Could not find branch organization" }), { status: 403, headers: corsHeaders });
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

        if (!['waiter', 'manager', 'owner', 'admin'].includes(profile.role)) {
            return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403, headers: corsHeaders });
        }

        // SACRED RULE: Isolation must be structural. 
        if (input_org_id && input_org_id !== organizationId) {
            console.error(`[SECURITY ALERT] Tenant Mismatch! Input Org: ${input_org_id}, Expected Org: ${organizationId}`);
            return new Response(JSON.stringify({ error: "Tenant isolation violation" }), { status: 403, headers: corsHeaders });
        }

        // OBSERVABILITY: Log Tool Call Execution
        console.log(`[TOOL_CALL] place-order | Branch: ${branchData.name} (${branch_id}) | Org: ${organizationId} | User: ${user.id}`);

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

        currentStep = 'resolving_table_session';
        let finalTableId = table_id || null;
        let finalTableNumber = table_number || null;
        let sessionId = null;

        if (finalTableNumber || finalTableId) {
            let query = supabase.from('tables').select('id, table_number');
            if (finalTableId) query = query.eq('id', finalTableId);
            else query = query.eq('branch_id', branch_id).eq('table_number', finalTableNumber);

            const { data: tableData } = await query.maybeSingle();
            if (tableData) {
                finalTableId = tableData.id;
                finalTableNumber = tableData.table_number;

                const { data: session } = await supabase
                    .from('table_sessions')
                    .select('id')
                    .eq('table_id', finalTableId)
                    .eq('is_active', true)
                    .maybeSingle();

                if (session) sessionId = session.id;
                else {
                    const { data: newSession, error: sessionErr } = await supabase
                        .from('table_sessions')
                        .insert({
                            table_id: finalTableId,
                            is_active: true,
                            seated_at: new Date().toISOString(),
                            organization_id: organizationId // Added for consistency
                        })
                        .select().single();
                    if (sessionErr) console.warn("Session creation failed (non-critical):", sessionErr.message);
                    if (newSession) sessionId = newSession.id;
                }
            }
        }

        currentStep = 'resolving_menu_items';
        const normalizedItems = items.map((i: any) => ({ ...i, menu_item_id: i.menu_item_id || i.id }));
        const itemIds = normalizedItems.map((i: any) => i.menu_item_id);

        const { data: menuData, error: menuErr } = await supabase
            .from('menu')
            .select('id, name, price, branch_id')
            .eq('organization_id', organizationId)
            .in('id', itemIds);

        if (menuErr) throw new Error(`Menu retrieval failed: ${menuErr.message}`);

        currentStep = 'calculating_totals';
        let orderTotal = 0;
        const mappedItems = normalizedItems.map(item => {
            const menuMatch = menuData?.find(m => m.id === item.menu_item_id);
            if (!menuMatch) throw new Error(`Menu item not found: ${item.menu_item_id}`);
            const price = Number(menuMatch.price) || 0;
            orderTotal += price * Number(item.quantity || 0);
            return { ...item, price };
        });

        const subtotal = Math.round((orderTotal / 1.15) * 100) / 100;
        const vatAmount = Math.round((orderTotal - subtotal) * 100) / 100;

        currentStep = 'persisting_order';
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .insert({
                customer_notes: order_details?.customer_notes,
                order_number: order_details?.order_number,
                branch_id,
                organization_id: organizationId,
                table_id: finalTableId,
                table_number: finalTableNumber,
                waiter_id: user.id || user_id || null,
                source: source || 'chatbot',
                status: 'pending',
                total_amount: orderTotal,
                subtotal_amount: subtotal,
                vat_amount: vatAmount,
                vat_rate: 15
            })
            .select().single();

        if (orderErr) throw new Error(`Order insertion failed: ${orderErr.message}`);

        currentStep = 'updating_table_status';
        if (finalTableId) {
            await supabase.from('tables').update({
                status: 'occupied',
                current_order_id: order.id,
                current_session_id: sessionId,
                last_updated: new Date().toISOString()
            }).eq('id', finalTableId);
        }

        currentStep = 'persisting_items';
        const itemsPayload = mappedItems.map(i => ({
            order_id: order.id,
            organization_id: organizationId,
            menu_item_id: i.menu_item_id,
            quantity: i.quantity,
            price: i.price,
            special_instructions: i.notes || ''
        }));

        const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);
        if (itemsErr) throw new Error(`Order items insertion failed: ${itemsErr.message}`);

        return new Response(JSON.stringify({ success: true, order_id: order.id }), { headers: corsHeaders });

    } catch (err: any) {
        return new Response(JSON.stringify({
            error: err.message,
            step: currentStep,
            type: 'TOOL_ERROR'
        }), { status: 500, headers: corsHeaders });
    }
});
