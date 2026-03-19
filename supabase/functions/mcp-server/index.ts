import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, resolveIdentity } from "../_shared/identity.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        // 1. Resolve Identity
        const identity = await resolveIdentity(req, supabase);
        const { organizationId: identityOrg, branchId: identityBranch } = identity || {};
        
        const body = await req.json();
        const { tool, params } = body;

        // 2. Tenant & Auth Resolution
        // For 'get_menu', we allow requests without a JWT if organization_id is in params
        // This is safe because it's public menu data.
        let organizationId = identityOrg === 'SERVICE_ROLE' ? params?.organization_id : identityOrg;
        let branchId = identityBranch === 'SERVICE_ROLE' ? params?.branch_id : identityBranch;

        if (!organizationId && tool === 'get_menu') {
            organizationId = params?.organization_id;
        }

        if (!organizationId) {
            return new Response(JSON.stringify({ error: "Unauthorized", detail: "Invalid token or missing organization context" }), { status: 401, headers: corsHeaders });
        }

        console.log(`[MCP] Tool: ${tool}, Org: ${organizationId}, Branch: ${branchId}`);

        let result: any;

        switch (tool) {
            // ─── TOOL: GET CATEGORIES ───
            case 'get_categories': {
                const targetBranch = branchId || params?.branch_id;
                let dbQuery = supabase
                    .from('view_menu_details')
                    .select('category')
                    .eq('organization_id', organizationId);
                
                if (targetBranch) {
                    dbQuery = dbQuery.eq('branch_id', targetBranch);
                }

                const { data, error } = await dbQuery;
                if (error) throw error;

                const categories = [...new Set(data?.map(i => i.category).filter(Boolean))];
                result = { categories };
                break;
            }

            // ─── TOOL: GET TOP PERFORMING ITEMS ───
            case 'get_top_performing_items': {
                const targetBranch = branchId || params?.branch_id;
                let dbQuery = supabase
                    .from('view_menu_details')
                    .select('id, name, price, category, image_url, description, is_available')
                    .eq('organization_id', organizationId)
                    .eq('is_available', true);

                if (targetBranch) {
                    dbQuery = dbQuery.eq('branch_id', targetBranch);
                }

                // For now, we'll pick items with high demand or just the top 6 if popularity data isn't explicit
                // In a real scenario, we might join with order_items to count sales
                const { data, error } = await dbQuery.limit(10);
                if (error) throw error;

                // Simple shuffle or just take first 6
                result = { items: data?.slice(0, 6) || [] };
                break;
            }

            // ─── TOOL 1: GET MENU ───
            case 'get_menu': {
                const queryStr = params?.query || '';
                const catStr = params?.category || '';
                const targetBranch = branchId || params?.branch_id;

                console.log(`[MCP-MENU] Searching for: query="${queryStr}", cat="${catStr}", branch="${targetBranch}"`);

                // DEBUG: Querying base menu table directly
                console.log(`[MCP-MENU] Searching for: query="${queryStr}", cat="${catStr}", branch="${targetBranch}"`);

                // DEBUG: Querying ALL items in DB
                const { data: allItems } = await supabase.from('menu').select('id, organization_id').limit(5);

                let dbQuery = supabase
                    .from('view_menu_details')
                    .select('id, name, price, category, image_url, is_available, description')
                    .eq('organization_id', organizationId);

                if (targetBranch) {
                    dbQuery = dbQuery.eq('branch_id', targetBranch);
                }

                if (catStr) dbQuery = dbQuery.ilike('category', `%${catStr}%`);
                if (queryStr) dbQuery = dbQuery.ilike('name', `%${queryStr}%`);

                let { data: menuData, error: menuErr } = await dbQuery.limit(20);
                if (menuErr) throw menuErr;

                const items = menuData || [];

                console.log(`[MCP-MENU] Found ${items.length} items.`);
                result = { 
                    items,
                    debug: {
                        org_passed: organizationId,
                        branch_passed: targetBranch,
                        count: items.length,
                        total_items_in_db_head: allItems?.map(i => `${i.id.substring(0,8)} (org: ${i.organization_id.substring(0,8)})`),
                        params: params
                    }
                };
                break;
            }

            // ─── TOOL 2: PLACE ORDER ───
            case 'place_order': {
                const { items, table_number, customer_phone, session_id } = params;
                const targetBranch = branchId || params.branch_id;

                if (!items || !Array.isArray(items) || items.length === 0) {
                    throw new Error("Items array is required and cannot be empty.");
                }

                if (!targetBranch) {
                    throw new Error("Branch ID is required for placing an order.");
                }

                // 1. Resolve Table Number to Table ID
                let tableId = null;
                if (table_number) {
                    const { data: tableData, error: tableErr } = await supabase
                        .from('tables')
                        .select('id')
                        .eq('table_number', table_number)
                        .eq('branch_id', targetBranch)
                        .maybeSingle();

                    if (tableErr) console.error("[MCP-ORDER] Table lookup error:", tableErr);
                    if (tableData) {
                        tableId = tableData.id;
                    } else {
                        throw new Error(`Could not find table number "${table_number}" in this branch.`);
                    }
                }

                // 2. Fetch prices from view_menu_details to build atomic payload
                const itemIds = items.map((i: any) => i.menu_item_id);
                const { data: menuData, error: menuErr } = await supabase
                    .from('view_menu_details')
                    .select('id, name, price')
                    .in('id', itemIds)
                    .eq('organization_id', organizationId)
                    .eq('branch_id', targetBranch);

                if (menuErr) throw menuErr;
                if (!menuData || menuData.length === 0) throw new Error("No valid menu items found.");

                // 3. Map items to the format expected by place_order_atomic
                const atomicItems = items.map((item: any) => {
                    const match = menuData.find(m => m.id === item.menu_item_id);
                    if (!match) throw new Error(`Menu item ${item.menu_item_id} not found.`);
                    return {
                        menu_item_id: item.menu_item_id,
                        quantity: item.quantity || 1,
                        unit_price: Number(match.price) || 0,
                    };
                });

                // 4. Call place_order_atomic RPC
                // We must ensure the organization context is passed as the RLS claim 'request.jwt.claim.organization_id'
                // However, since we're using a Service Role key, we should ideally wrap the set_config
                // and RPC call into a single transaction if possible, or ensure the RPC itself
                // can handle the organization_id explicitly if it's not present in the JWT.

                // For now, we will rely on the RPC which has 'SECURITY DEFINER' and explicitly uses the p_branch_id
                // to verify ownership, but we'll attempt to set the session variable in the same client instance.
                // NOTE: PostgREST doesn't guarantee session persistence between calls.

                const { data: atomicResult, error: atomicErr } = await supabase.rpc('place_order_atomic', {
                    p_branch_id: targetBranch,
                    p_items: atomicItems,
                    p_order_details: {
                        table_id: tableId,
                        source: 'chatbot',
                        customer_phone: customer_phone,
                        session_id: session_id
                    }
                });

                if (atomicErr) throw atomicErr;
                if (!atomicResult?.success) throw new Error(atomicResult?.error || "Order placement failed.");

                result = {
                    order_id: atomicResult.order_id,
                    total_amount: atomicResult.total_amount,
                    status: 'pending',
                    message: "Order placed successfully."
                };
                break;
            }

            // ─── TOOL 3: UPDATE ORDER (Add items to existing) ───
            case 'update_order': {
                const { order_id, new_items } = params;

                if (!order_id || !new_items || !Array.isArray(new_items) || new_items.length === 0) {
                    throw new Error("order_id and new_items array are required.");
                }

                // Verify order belongs to this org and is still active
                const { data: existingOrder, error: orderFetchErr } = await supabase
                    .from('orders')
                    .select('id, status, subtotal_amount, vat_amount, total_amount, organization_id')
                    .eq('id', order_id)
                    .eq('organization_id', organizationId)
                    .single();

                if (orderFetchErr || !existingOrder) throw new Error("Order not found or access denied.");
                if (['cancelled', 'completed'].includes(existingOrder.status)) {
                    throw new Error("Cannot update a completed or cancelled order.");
                }

                // Fetch prices for new items
                const newItemIds = new_items.map((i: any) => i.menu_item_id);
                const { data: newMenuData, error: newMenuErr } = await supabase
                    .from('menu')
                    .select('id, name, price, organization_id')
                    .in('id', newItemIds)
                    .eq('organization_id', organizationId);

                if (newMenuErr) throw newMenuErr;

                let addedSubtotal = 0;
                const newOrderItems = new_items.map((item: any) => {
                    const match = newMenuData?.find(m => m.id === item.menu_item_id);
                    if (!match) throw new Error(`Menu item ${item.menu_item_id} not found.`);
                    const price = Number(match.price) || 0;
                    addedSubtotal += price * (item.quantity || 1);
                    return {
                        order_id,
                        menu_item_id: item.menu_item_id,
                        quantity: item.quantity || 1,
                        price,
                        special_instructions: item.notes || '',
                        organization_id: organizationId,
                    };
                });

                const { error: insertErr } = await supabase.from('order_items').insert(newOrderItems);
                if (insertErr) throw insertErr;

                // Recalculate totals
                const newSubtotal = (Number(existingOrder.subtotal_amount) || 0) + addedSubtotal;
                const newVat = Math.round(newSubtotal * 0.15 * 100) / 100;
                const newTotal = Math.round((newSubtotal + newVat) * 100) / 100;

                const { error: updateErr } = await supabase
                    .from('orders')
                    .update({
                        subtotal_amount: newSubtotal,
                        vat_amount: newVat,
                        total_amount: newTotal,
                    })
                    .eq('id', order_id);

                if (updateErr) throw updateErr;

                result = {
                    order_id,
                    added_items: newOrderItems.length,
                    new_total: newTotal,
                    new_subtotal: newSubtotal,
                    message: "Items added to existing order successfully.",
                };
                break;
            }

            // ─── TOOL 4: GET ORDER STATUS ───
            case 'get_order_status': {
                const { order_id, table_number } = params;
                let query = supabase
                    .from('orders')
                    .select('id, order_number, status, payment_status, total_amount, created_at, table_number')
                    .eq('organization_id', organizationId);

                if (order_id) {
                    query = query.eq('id', order_id);
                } else if (table_number) {
                    const targetBranch = branchId || params.branch_id;
                    query = query.eq('table_number', table_number)
                        .eq('branch_id', targetBranch)
                        .in('status', ['pending', 'preparing', 'accepted', 'ready'])
                        .order('created_at', { ascending: false })
                        .limit(1);
                } else {
                    throw new Error("order_id or table_number is required.");
                }

                const { data: orderData, error: orderErr } = await query;
                if (orderErr) throw orderErr;

                result = { orders: orderData || [] };
                break;
            }

            // ─── TOOL 5: VERIFY PAYMENT ───
            case 'verify_payment': {
                const { reference, bank_key, order_id } = params;

                if (!reference || !bank_key) {
                    throw new Error("reference and bank_key are required.");
                }

                // Check for duplicate reference
                const { data: existing } = await supabase
                    .from('payments')
                    .select('id')
                    .eq('reference', reference)
                    .eq('organization_id', organizationId)
                    .maybeSingle();

                if (existing) {
                    result = { verified: false, reason: "This reference has already been used." };
                    break;
                }

                // For now, mark as pending_verification (real verification goes through sosha-verifier)
                result = {
                    verified: 'pending',
                    reference,
                    bank_key,
                    message: "Payment reference recorded. A staff member will verify it shortly.",
                };

                // Record the payment attempt
                if (order_id) {
                    await supabase.from('payments').insert({
                        organization_id: organizationId,
                        branch_id: branchId || params.branch_id,
                        order_id,
                        bank_key,
                        reference,
                        amount: 0, // Will be filled by verifier
                        status: 'pending',
                        source: 'chatbot',
                    }).select().maybeSingle();
                }
                break;
            }

            // ─── TOOL 6: GET BRANCH INFO ───
            case 'get_branch_info': {
                const targetBranch = branchId || params?.branch_id;
                const { data: branch, error: bErr } = await supabase
                    .from('branches')
                    .select('id, name, location')
                    .eq('id', targetBranch)
                    .eq('organization_id', organizationId)
                    .single();

                if (bErr) throw bErr;

                const { data: banks } = await supabase
                    .from('bank_settings')
                    .select('bank_key, account_number')
                    .eq('organization_id', organizationId)
                    .eq('is_active', true);

                result = {
                    branch,
                    payment_methods: banks?.filter(b => b.account_number) || [],
                };
                break;
            }

            // ─── TOOL 7: UPDATE CUSTOMER PROFILE ───
            case 'update_customer_profile': {
                const { phone, full_name, email, preferences, session_id } = params;

                if (!phone && !session_id) {
                    throw new Error("phone or session_id is required to identify the customer.");
                }

                // Try to find existing profile
                let existingProfile = null;
                if (phone) {
                    const { data } = await supabase
                        .from('customer_profiles')
                        .select('*')
                        .eq('phone', phone)
                        .eq('organization_id', organizationId)
                        .maybeSingle();
                    existingProfile = data;
                }

                if (existingProfile) {
                    // Merge preferences (new ones overwrite old keys)
                    const mergedPreferences = {
                        ...(existingProfile.preferences || {}),
                        ...(preferences || {}),
                    };

                    const { data: updated, error: updateErr } = await supabase
                        .from('customer_profiles')
                        .update({
                            full_name: full_name || existingProfile.full_name,
                            email: email || existingProfile.email,
                            preferences: mergedPreferences,
                            visit_count: (existingProfile.visit_count || 0) + 1,
                            last_visit: new Date().toISOString(),
                        })
                        .eq('id', existingProfile.id)
                        .select()
                        .single();

                    if (updateErr) throw updateErr;
                    result = { profile: updated, action: 'updated' };
                } else {
                    // Create new profile
                    const { data: created, error: createErr } = await supabase
                        .from('customer_profiles')
                        .insert({
                            organization_id: organizationId,
                            branch_id: branchId || null,
                            phone: phone || '',
                            full_name: full_name || '',
                            email: email || '',
                            preferences: preferences || {},
                            visit_count: 1,
                            last_visit: new Date().toISOString(),
                        })
                        .select()
                        .single();

                    if (createErr) throw createErr;
                    result = { profile: created, action: 'created' };
                }
                break;
            }

            // ─── TOOL 8: GET FINANCIAL SUMMARY ───
            case 'get_financial_summary': {
                const today = new Date().toISOString().split('T')[0];
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

                const { data: todayOrders } = await supabase.from('orders')
                    .select('total_amount, status')
                    .eq('organization_id', organizationId)
                    .gte('created_at', today)
                    .not('status', 'eq', 'cancelled');

                const { data: yesterdayOrders } = await supabase.from('orders')
                    .select('total_amount, status')
                    .eq('organization_id', organizationId)
                    .gte('created_at', yesterday)
                    .lt('created_at', today)
                    .not('status', 'eq', 'cancelled');

                const summary = {
                    today: {
                        revenue: todayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
                        orders: todayOrders?.length || 0
                    },
                    yesterday: {
                        revenue: yesterdayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
                        orders: yesterdayOrders?.length || 0
                    },
                    growth_revenue: 0,
                    currency: 'ETB'
                };

                if (summary.yesterday.revenue > 0) {
                    summary.growth_revenue = ((summary.today.revenue - summary.yesterday.revenue) / summary.yesterday.revenue) * 100;
                }

                result = summary;
                break;
            }

            // ─── TOOL 9: GET STAFF PERFORMANCE ───
            case 'get_staff_performance': {
                const { limit = 5 } = params;
                const { data, error } = await supabase.from('staff_performance_daily')
                    .select('staff_name, revenue_attributed, orders_completed, avg_rating')
                    .eq('organization_id', organizationId)
                    .order('revenue_attributed', { ascending: false })
                    .limit(limit);

                if (error) throw error;
                result = { staff: data };
                break;
            }

            // ─── TOOL 10: GET INVENTORY RISKS ───
            case 'get_inventory_risks': {
                const { data, error } = await supabase.from('view_inventory_risks')
                    .select('*')
                    .eq('organization_id', organizationId)
                    .limit(10);

                if (error) throw error;
                result = { risks: data };
                break;
            }

            // ─── TOOL 11: GET INTELLIGENCE EVENTS ───
            case 'get_intelligence_events': {
                const { limit = 5 } = params;
                const { data, error } = await supabase.from('intelligence_events')
                    .select('*')
                    .eq('organization_id', organizationId)
                    .order('created_at', { ascending: false })
                    .limit(limit);

                if (error) throw error;
                result = { events: data };
                break;
            }

            // ─── TOOL 12: GET TABLES ───
            case 'get_tables': {
                const targetBranch = branchId || params?.branch_id;
                const { data, error } = await supabase
                    .from('tables')
                    .select('id, table_number, pos_x, pos_y')
                    .eq('organization_id', organizationId)
                    .eq('branch_id', targetBranch);

                if (error) throw error;
                result = { tables: data || [] };
                break;
            }

            // ─── TOOL 13: VERIFY NFC TAP ───
            case 'verify_nfc_tap': {
                const { token, table_number, session_id } = params;
                const targetBranch = branchId || params.branch_id;

                if (!token || !table_number) {
                    throw new Error("token and table_number are required for NFC verification.");
                }

                // 1. Check if token matches the table
                const { data: tableData, error: tableErr } = await supabase
                    .from('tables')
                    .select('id, status, active_session')
                    .eq('table_number', table_number)
                    .eq('verification_token', token)
                    .eq('organization_id', organizationId)
                    .eq('branch_id', targetBranch)
                    .single();

                if (tableErr || !tableData) {
                    console.error("[NFC] Invalid token or table not found:", tableErr);
                    result = { success: false, reason: "Invalid verification token." };
                    break;
                }

                // 2. Set table to Occupied if it isn't already, and update active_session
                let currentSession = tableData.active_session || { seated_at: new Date().toISOString(), sessions: [] };
                
                // Add this new session_id if it's not already in the array (Multi-player mode)
                if (!currentSession.sessions) currentSession.sessions = [];
                if (!currentSession.sessions.includes(session_id)) {
                    currentSession.sessions.push(session_id);
                }

                const { error: updateErr } = await supabase
                    .from('tables')
                    .update({ 
                        status: 'occupied',
                        active_session: currentSession
                    })
                    .eq('id', tableData.id);

                if (updateErr) {
                    console.error("[NFC] Failed to update table occupancy:", updateErr);
                }

                result = { success: true, table_id: tableData.id };
                break;
            }

            // ─── TOOL 12: LIST TABLES (for verification) ───
            case 'list_tables': {
                const { data: tables, error: tablesErr } = await supabase
                    .from('tables')
                    .select('table_number')
                    .eq('branch_id', branchId)
                    .eq('organization_id', organizationId);

                if (tablesErr) throw tablesErr;
                result = {
                    tables: tables.map((t: any) => t.table_number),
                    count: tables.length
                };
                break;
            }
                return new Response(JSON.stringify({ error: "Unknown tool", tool }), { status: 400, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ success: true, result }), {
            headers: corsHeaders,
            status: 200,
        });

    } catch (error: any) {
        console.error("[MCP-SERVER] Error:", error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: corsHeaders,
            status: 500,
        });
    }
});
