import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
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
        let payload;
        try {
            payload = await req.json();
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid JSON payload" }), { status: 400, headers: corsHeaders });
        }

        let { branch_id, items, order_details, source, table_number, table_id, user_id, organization_id: input_org_id, order_id, telegram_id } = payload;

        // Ensure order_id is a valid UUID or null (don't allow empty strings)
        if (order_id === "" || order_id === "null" || order_id === undefined) {
            order_id = null;
        }

        if (order_details) {
            table_number = table_number || order_details.table_number;
            table_id = table_id || order_details.table_id;
            user_id = user_id || order_details.user_id;
            branch_id = branch_id || order_details.branch_id;
            telegram_id = telegram_id || order_details.telegram_id;
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
            .maybeSingle();

        if (profileErr) {
            console.error("Profile Fetch Error:", profileErr);
            return new Response(JSON.stringify({ error: "Profile fetch failed", detail: profileErr.message }), { status: 500, headers: corsHeaders });
        }

        if (!profile) {
            return new Response(JSON.stringify({ error: "User profile not found" }), { status: 403, headers: corsHeaders });
        }

        const userRole = (profile.role || '').toLowerCase();
        const isSuperAdmin = userRole === 'super_admin';

        if (!isSuperAdmin && profile.organization_id !== organizationId) {
            console.error(`[AUTH_ERROR] User: ${user.id} (${userRole}) | User Org: ${profile.organization_id} | Branch Org: ${organizationId}`);
            return new Response(JSON.stringify({
                error: 'Unauthorized for this branch',
                detail: `User org: ${profile.organization_id}, Branch org: ${organizationId}`,
                user_role: userRole
            }), { status: 403, headers: corsHeaders });
        }

        if (!['waiter', 'manager', 'owner', 'admin', 'super_admin'].includes(userRole)) {
            return new Response(JSON.stringify({
                error: `Insufficient permissions. Role: ${profile?.role}`,
                role: userRole
            }), { status: 403, headers: corsHeaders });
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
            let query = supabase.from('tables').select('id, table_number, branch_id');
            if (finalTableId) query = query.eq('id', finalTableId);
            else query = query.eq('branch_id', branch_id).eq('table_number', finalTableNumber);

            const { data: tableData } = await query.maybeSingle();

            // SACRED RULE: Table MUST belong to the branch
            if (tableData && tableData.branch_id !== branch_id) {
                return new Response(JSON.stringify({
                    error: "Isolation Error",
                    detail: "Table does not belong to the selected branch"
                }), { status: 403, headers: corsHeaders });
            }

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

        console.log(`[DEBUG] Resolving items: ${JSON.stringify(itemIds)}`);

        // Robust Menu Lookup: Include branch-specific, global, and tenant-shared items
        const { data: menuData, error: menuErr } = await supabase
            .from('menu')
            .select('id, name, price, branch_id, organization_id')
            .or(`branch_id.eq.${branch_id},branch_id.is.null,organization_id.eq.${organizationId},organization_id.eq.00000000-0000-0000-0000-000000000000`)
            .in('id', itemIds);

        if (menuErr) {
            console.error('[CRITICAL] Menu Resolution Failed:', menuErr);
            throw new Error(`Menu retrieval failed: ${menuErr.message}`);
        }

        // HARDENING: Verify that all requested item IDs exist in the resolved menu data
        const foundIds = new Set(menuData?.map(m => m.id) || []);
        const missingIds = itemIds.filter(id => !foundIds.has(id));

        if (missingIds.length > 0) {
            console.error(`[ERROR] Catalog Mismatch: Requested items ${missingIds.join(', ')} not found in branch/global catalog.`);
            throw new Error(`Catalog Mismatch: ${missingIds.length} item(s) (including ${missingIds[0]}) are missing from the active menu or belong to another organization.`);
        }

        currentStep = 'calculating_totals';
        let orderTotal = 0;
        const mappedItems = normalizedItems.map(item => {
            const menuMatch = menuData?.find(m => m.id === item.menu_item_id);
            if (!menuMatch) {
                console.error(`[ERROR] Specific item not found in branch/global scope: ${item.menu_item_id}`);
                throw new Error(`Menu item not found or inaccessible: ${item.menu_item_id}`);
            }
            const price = Number(menuMatch.price) || 0;
            orderTotal += price * Number(item.quantity || 0);
            return { ...item, price };
        });

        const subtotal = Math.round(orderTotal * 100) / 100;
        const vatAmount = Math.round((subtotal * 0.15) * 100) / 100;
        orderTotal = Math.round((subtotal + vatAmount) * 100) / 100;

        currentStep = 'finding_target_order';
        let finalOrderId = order_id;
        console.log(`[DEBUG] Step: ${currentStep} | Order ID: ${finalOrderId}`);

        if (finalOrderId) {
            // Update existing order
            const { data: existingOrder, error: fetchErr } = await supabase
                .from('orders')
                .select('total_amount, subtotal_amount, vat_amount')
                .eq('id', finalOrderId)
                .maybeSingle();

            if (fetchErr) {
                console.error(`[CRITICAL] Order Fetch Error for ${finalOrderId}:`, fetchErr);
                throw new Error(`Target order not found or inaccessible: ${fetchErr.message}`);
            }
            if (!existingOrder) {
                throw new Error(`Order ${finalOrderId} has vanished or belongs to a different node.`);
            }

            const newTotal = Number(existingOrder.total_amount || 0) + orderTotal;
            const newSubtotal = Number(existingOrder.subtotal_amount || 0) + subtotal;
            const newVat = Number(existingOrder.vat_amount || 0) + vatAmount;

            const { error: updateErr } = await supabase
                .from('orders')
                .update({
                    total_amount: newTotal,
                    subtotal_amount: newSubtotal,
                    vat_amount: newVat,
                    status: 'pending'
                })
                .eq('id', finalOrderId);

            if (updateErr) throw new Error(`Failed to update existing order: ${updateErr.message}`);

            // Touch table last updated
            if (finalTableId) {
                await supabase.from('tables').update({
                    last_updated: new Date().toISOString()
                }).eq('id', finalTableId);
            }
        } else {
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
                    vat_rate: 15,
                    telegram_id: telegram_id || null
                })
                .select('id')
                .maybeSingle();

            if (orderErr) throw new Error(`Order insertion failed: ${orderErr.message}`);
            if (!order) {
                // FALLBACK: If RLS prevents selection after insert, we can't get the ID.
                // But normally service role bypasses RLS. If it fails, something is wrong.
                throw new Error("Order was inserted but could not be retrieved. Check database constraints.");
            }
            finalOrderId = order.id;

            currentStep = 'updating_table_status';
            if (finalTableId) {
                await supabase.from('tables').update({
                    status: 'occupied',
                    current_order_id: finalOrderId,
                    current_session_id: sessionId,
                    last_updated: new Date().toISOString()
                }).eq('id', finalTableId);
            }
        }

        currentStep = 'persisting_items';
        const isAppendOperation = !!order_id;
        const itemsPayload = mappedItems.map(i => {
            let notes = i.notes || '';
            if (isAppendOperation) {
                notes = notes ? `[NEW] ${notes}` : '[NEW]';
            }

            return {
                order_id: finalOrderId,
                organization_id: organizationId,
                menu_item_id: i.menu_item_id,
                quantity: i.quantity,
                price: i.price,
                special_instructions: notes
            };
        });

        const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);
        if (itemsErr) throw new Error(`Order items insertion failed: ${itemsErr.message}`);

        return new Response(JSON.stringify({ success: true, order_id: finalOrderId }), { headers: corsHeaders });

    } catch (err: any) {
        console.error(`[ERROR] place-order failure at step: ${currentStep}`);
        console.error(err);
        return new Response(JSON.stringify({
            error: err.message,
            step: currentStep,
            type: 'TOOL_ERROR',
            detail: err.stack,
            timestamp: new Date().toISOString()
        }), { status: 500, headers: corsHeaders });
    }
});
