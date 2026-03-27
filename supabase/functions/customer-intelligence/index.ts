import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, resolveIdentity } from "../_shared/identity.ts";

// ─── TOOL DEFINITIONS ───
const TOOL_DEFINITIONS = [
    {
        type: "function",
        function: {
            name: "get_menu",
            description: "Get the restaurant's menu items. Returns full item metadata including tags, spice levels, and ingredients. Use 'category' for specific sub-categories. If the user asks for 'something cheap' to EAT, do NOT return drinks! Filter the results to only include real meals.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search for a specific menu item by name" },
                    category: { type: "string", description: "Filter by a SPECIFIC category like 'Drinks', 'burgers', 'fish', 'Breakfast'. Leave empty to show all items." },
                    must_have_tag: { type: "string", description: "Filter by a specific dietary or semantic tag (e.g. 'halal', 'vegan', 'spicy'). Optional." },
                    must_exclude_tag: { type: "string", description: "Exclude a specific tag (e.g. 'halal', 'nuts'). Optional." }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "place_order",
            description: "Place a NEW order. Use for initial selections or when the customer says 'I want...', 'I would like...', or simply picks an item. ALWAYS confirm items and ensure the TABLE NUMBER is known before calling this.",
            parameters: {
                type: "object",
                properties: {
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                menu_item_id: { type: "string", description: "The UUID of the menu item (from get_menu results)" },
                                name: { type: "string", description: "The exact name of the menu item (used if menu_item_id is not available)" },
                                quantity: { type: "number" },
                                notes: { type: "string" },
                            },
                        },
                    },
                    table_number: { type: "string" },
                    customer_phone: { type: "string" },
                },
                required: ["items", "table_number"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_order_status",
            description: "Check the status of an existing order by order_id or table_number.",
            parameters: {
                type: "object",
                properties: {
                    order_id: { type: "string" },
                    table_number: { type: "string" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_order",
            description: "ADD items to an EXISTING order that has already been placed and is currently in the system. Use ONLY when the customer says 'add more', 'I also want...', or 'one more thing'.",
            parameters: {
                type: "object",
                properties: {
                    order_id: { type: "string", description: "The ID of the existing order" },
                    new_items: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                menu_item_id: { type: "string", description: "The UUID of the menu item" },
                                name: { type: "string", description: "The exact name of the item (use if UUID unknown)" },
                                quantity: { type: "number" },
                                notes: { type: "string" },
                            },
                        },
                    },
                },
                required: ["order_id", "new_items"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "verify_payment",
            description: "Verify a payment reference number provided by the customer.",
            parameters: {
                type: "object",
                properties: {
                    reference: { type: "string", description: "The transaction reference/ID" },
                    bank_key: { type: "string", description: "The bank name/key (e.g. 'CBE', 'Telebirr')" },
                    order_id: { type: "string" },
                },
                required: ["reference", "bank_key"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_branch_info",
            description: "Get information about this restaurant branch including payment methods and bank accounts. Use when customer asks 'how to pay' or 'what banks do you accept'.",
            parameters: {
                type: "object",
                properties: {},
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_customer_profile",
            description: "Save or update customer information and preferences. Use when the customer shares their name, phone, email, or mentions a food preference/allergy. ALWAYS call this when you learn something new about the customer.",
            parameters: {
                type: "object",
                properties: {
                    phone: { type: "string", description: "Customer phone number" },
                    full_name: { type: "string", description: "Customer full name" },
                    email: { type: "string", description: "Customer email" },
                    preferences: {
                        type: "object",
                        description: "Key-value pairs of preferences. Example: { 'allergies': ['nuts'], 'spice_level': 'mild', 'favorite_dish': 'Tibs' }",
                    },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_knowledge",
            description: "Search the restaurant's knowledge base for policies, FAQ, local area info, or general restaurant details. Use this when the customer asks general questions not related to the menu or their specific order.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "The search query" },
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_categories",
            description: "Get all menu categories available in the restaurant.",
            parameters: {
                type: "object",
                properties: {},
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_top_performing_items",
            description: "Get the most popular and top-performing menu items. Use to show recommendations or featured dishes.",
            parameters: {
                type: "object",
                properties: {},
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_tables",
            description: "Get all tables for the restaurant branch to verify availability and location.",
            parameters: {
                type: "object",
                properties: {
                    branch_id: { type: "string" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_tables",
            description: "Get a list of all valid table numbers/names in the restaurant floor map. Use this to verify if a customer's table exists.",
            parameters: {
                type: "object",
                properties: {},
            },
        },
    },
];

// ─── DEFAULT SYSTEM PROMPT (CADE BESTIE ENERGY) ───
const DEFAULT_SYSTEM_PROMPT = `You are Baro, a professional and efficient restaurant assistant. 🍽️

## YOUR CORE RULES
1. **VISUAL MENU ONLY**: ALWAYS use the 'get_menu' tool to show items. NEVER list items, descriptions, or prices in plain text.
2. **SMART TABLE RECOGNITION**: Check the "Table (Claimed)" in the current context. If it says "Unknown", you must ask the customer for their table number. If it is already known, simply confirm and proceed.
3. **ACCURATE ORDERING**: 
   - Use 'place_order' for new orders.
   - Use 'update_order' to add items to an existing order (Check "Active Order ID" in context).
   - ALWAYS confirm the full list of items and special instructions (notes) before finalizing any order.
4. **PAYMENT & ASSISTANCE**: Help customers with their bill using 'get_branch_info' and 'get_order_status'. Verify payments immediately using 'verify_payment'.
5. **CUSTOMER CARE**: Use 'update_customer_profile' whenever you learn a customer's name, contact info, or food preferences/allergies.

## TONE & VOICE
- Every response should be concise (max 3 sentences).
- Use clear formatting and occasional friendly emojis. ✨

## ERROR & NO-RESULT HANDLING
1. **STRICT NO HALLUCINATION**: If the 'get_menu' tool returns 0 items or doesn't find what the user asked for (e.g., searching for 'spicy' returns nothing), NEVER make up IDs like 'xyz' or prices.
2. **GRACEFUL FALLBACK**: If no items are found for a specific query:
   - Apologize in your Bestie persona (e.g., "Omg 😭 I searched the whole kitchen but couldn't find exactly that for you!").
   - Offer the 'suggested_items' provided in the tool result instead.
   - Ask for their "vibe" or if they'd like to see a different category.
3. **TOOL USE**: If you get 'suggested_items' instead of 'items', tell the customer: "I couldn't find [Query], but these are our absolute favorites right now!" followed by the carousel.`;

const RICH_UI_INSTRUCTIONS = `
## RICHER UI CAPABILITIES
You have access to a specialized Rich UI system. Whenever you send a message, the frontend can render interactive elements if you include them.
Supported elements:
- "buttons": Array of { label, prompt }.
- "tracking": { "status": "placed" | "preparing" | "ready" | "delivered" }
- "pills": Array of strings for quick category filters.
- "splitter": { "total": number }
- "rating": { "type": "stars" }

## STRICT UI RULES - READ CAREFULLY
1. **NO TEXT MENUS**: You are FORBIDDEN from typing menu items, prices, or categories in markdown text. NEVER use bullet points or bold text to list food.
2. **CAROUSEL ONLY**: Every time you want to show a menu or items, you MUST ONLY use the 'get_menu' or 'get_top_performing_items' tool.
3. **SHORT RESPONSES**: Your text response should only be a short greeting.
4. **COMPACT SUMMARY**: When an item is added, ONLY send a short confirmation: "Added Item Name! ✅ Your total is now ETB Total."
5. **CONTEXTUAL QUICK REPLIES**: To render interactive buttons, you MUST strictly wrap the JSON inside a UI_CONTEXT block at the end of your message. NEVER print raw JSON arrays or the text "Here are your links" in your conversational text.
   - *Selection Phase*: [UI_CONTEXT: {"buttons": [{"label": "🚀 Confirm Order", "prompt": "Confirm my order"}, {"label": "🛒 View Cart", "prompt": "Show my cart"}]}]
   - *Post-Placement*: [UI_CONTEXT: {"buttons": [{"label": "📡 Track My Order", "prompt": "Where is my food?"}, {"label": "🧾 Request Bill", "prompt": "Show my bill"}]}]

## CADE PERSONA RULES
- **VOICE**: Gen Z, high-energy, "bestie" energy.
- **SLANG**: Use "fr", "slaps", "fire", "bet", "no cap" naturally.
- **CONCISE**: Max 2-3 sentences.
`;

const PROFESSIONALISM_PROTOCOL = `
## TONE & VOICE
- Hype, energetic, and helpful.
- Gen Z slang strictly allowed.
- Every response should be concise.
`;

function normalizeTableCandidate(value: string): string {
    return value
        .trim()
        .toUpperCase()
        .replace(/^TABLE\s*/i, '')
        .replace(/^#/, '')
        .replace(/\s+/g, '');
}

function hasUsableTableContext(value?: string | null): boolean {
    const normalized = normalizeTableCandidate(value || '');
    return !!normalized && normalized !== 'UNKNOWN' && normalized !== 'GUEST';
}

function looksLikeTableCandidate(message: string): boolean {
    const normalized = normalizeTableCandidate(message);
    return /^[A-Z]?\d{1,3}$/.test(normalized);
}

function matchTableCandidate(input: string, availableTables: string[]): string | null {
    const normalizedInput = normalizeTableCandidate(input);
    if (!normalizedInput) return null;

    for (const table of availableTables) {
        if (normalizeTableCandidate(table) === normalizedInput) {
            return table;
        }
    }

    return null;
}


// ─── MCP TOOL EXECUTOR ───
async function executeMcpTool(
    supabase: any,
    toolName: string,
    toolParams: any,
    organizationId: string,
    branchId: string,
    table_number: string
): Promise<any> {
    console.log(`[MCP-CALL] Executing ${toolName} locally/externally...`);

    // ─── LOCAL TOOL 1: GET MENU (Bypass Network Fallback) ───
    if (toolName === "get_menu") {
        const queryStr = toolParams?.query || "";
        let catStr = toolParams?.category || "";
        const targetBranch = branchId || toolParams?.branch_id;

        // Ignore overly generic category filters that would return 0 results
        const genericTerms = ["food", "menu", "all", "everything", "items", "dishes"];
        if (genericTerms.includes(catStr.toLowerCase().trim())) {
            console.log(`[MCP-LOCAL-MENU] Ignoring generic category filter: "${catStr}"`);
            catStr = "";
        }

        console.log(`[MCP-LOCAL-MENU] Org: ${organizationId}, Branch: ${targetBranch}, Category: "${catStr}", Query: "${queryStr}"`);

        let dbQuery = supabase
            .from("view_menu_details")
            .select("id, name, price, category, image_url, is_available, description, dietary_tags, ingredients_list, spice_level, portion_size")
            .eq("organization_id", organizationId);

        if (targetBranch) {
            dbQuery = dbQuery.eq("branch_id", targetBranch);
        }

        if (catStr) dbQuery = dbQuery.ilike("category", `%${catStr}%`);
        if (queryStr) dbQuery = dbQuery.ilike("name", `%${queryStr}%`);

        const { data: menuData, error: menuErr } = await dbQuery.limit(100);
        if (menuErr) {
            console.error("[MCP-LOCAL-MENU] Error:", menuErr);
            return { error: menuErr.message };
        }

        let items = menuData || [];

        // Apply Semantic JS-based Case-Insensitive Filtering
        if (toolParams?.must_have_tag) {
            const reqTag = toolParams.must_have_tag.toLowerCase().trim();
            items = items.filter((item: any) => {
                const tags = [
                    ...(item.dietary_tags || []),
                    ...(item.ingredients_list || []),
                    item.spice_level,
                    item.portion_size
                ].filter(Boolean).map((t: string) => t.toLowerCase());
                
                return tags.some((t: string) => t.includes(reqTag));
            });
        }

        if (toolParams?.must_exclude_tag) {
            const exTag = toolParams.must_exclude_tag.toLowerCase().trim();
            items = items.filter((item: any) => {
                const tags = [
                    ...(item.dietary_tags || []),
                    ...(item.ingredients_list || []),
                    item.spice_level,
                    item.portion_size
                ].filter(Boolean).map((t: string) => t.toLowerCase());
                
                return !tags.some((t: string) => t.includes(exTag));
            });
        }

        items = items.slice(0, 20); // Re-enforce UI pagination limit after semantic mapping
        console.log(`[MCP-LOCAL-MENU] Found ${items.length} items.`);

        // If category filter returned 0 results, retry without category
        if (items.length === 0 && catStr) {
            console.log(`[MCP-LOCAL-MENU] Category "${catStr}" returned 0 items. Retrying without category filter...`);
            let retryQuery = supabase
                .from("view_menu_details")
                .select("id, name, price, category, image_url, is_available, description, dietary_tags, ingredients_list, spice_level, portion_size")
                .eq("organization_id", organizationId);
            if (targetBranch) retryQuery = retryQuery.eq("branch_id", targetBranch);
            if (queryStr) retryQuery = retryQuery.ilike("name", `%${queryStr}%`);
            const { data: retryData } = await retryQuery.limit(20);
            items = retryData || [];
            console.log(`[MCP-LOCAL-MENU] Retry found ${items.length} items.`);
        }

        // ── FINAL FALLBACK: Suggested Items if still 0 ──
        if (items.length === 0) {
            console.log(`[MCP-LOCAL-MENU] Absolute 0 results. Fetching top 5 suggestions...`);
            const { data: suggestions } = await supabase
                .from("view_menu_details")
                .select("id, name, price, category, image_url, is_available, description, dietary_tags, spice_level, portion_size")
                .eq("organization_id", organizationId)
                .eq("is_available", true)
                .order("price", { ascending: false }) // Fallback to premium items as suggestions
                .limit(5);
            
            return { 
                items: [], 
                suggested_items: suggestions || [],
                message: "No exact matches found for your query. Here are some house favorites instead." 
            };
        }

        return { items };

    }

    // ─── EXTERNAL TOOLS (Everything Else) ───
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const requestBody = {
        tool: toolName,
        params: {
            ...toolParams,
            organization_id: organizationId,
            branch_id: branchId,
            table_number: toolParams.table_number || table_number
        },
    };

    console.log(`[MCP-DEBUG] Preparing Tool: ${toolName}`);
    console.log(`[MCP-DEBUG] Resolved Org: ${organizationId}, Branch: ${branchId}`);
    console.log(`[MCP-DEBUG] Tool Params:`, JSON.stringify(toolParams));

    // Call the mcp-server function internally with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        const response = await fetch(`${sbUrl}/functions/v1/mcp-server`, {
            method: "POST",
            headers: {
                "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                "Content-Type": "application/json",
                "X-Internal-Token": "baro-os-branch-secure-2026",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[MCP-CALL] HTTP ${response.status} Error:`, errText);
            throw new Error(`Tool ${toolName} HTTP error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        console.log(`[MCP-CALL] Result:`, JSON.stringify(data).substring(0, 500));

        if (!data.success) {
            throw new Error(data.error || `Tool ${toolName} failed`);
        }
        return data.result;
    } catch (err: any) {
        clearTimeout(timeoutId);
        console.error(`[MCP-CALL] Tool execution failed:`, err.message);
        throw err;
    }
}

// ─── MAIN HANDLER ───
serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    let globalTimeout: any;
    try {
        const sbUrl = Deno.env.get("SUPABASE_URL")!;
        const sbServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(sbUrl, sbServiceKey);

        // ── IDENTITY RESOLUTION ──
        const identity = await resolveIdentity(req, supabase);

        let organizationId = identity?.organizationId;
        let branchId = identity?.branchId;

        const body = await req.json();
        const { message, session_id, table_number, table_id, organization_id, organization_name, branch_id: clientBranchId, branch_name, is_verified, active_order_id } = body;

        // ── DIRECT ACTION: Skip AI entirely for cart-based orders ──
            // --- DIRECT ACTION: Fetch Categories (Waiter-Consistent) ---
            if (body.action === 'get_categories') {
                const finalOrgId = organization_id || organizationId;
                const finalBranchId = clientBranchId || branchId;

                const { data: categories, error } = await supabase
                    .from('view_menu_details')
                    .select('category')
                    .eq('organization_id', finalOrgId)
                    .eq('branch_id', finalBranchId)
                    .eq('is_available', true)
                    .not('category', 'is', null);

                if (error) throw error;
                
                const uniqueCategories = Array.from(new Set(categories.map(c => c.category)))
                    .filter(c => c && c.toLowerCase() !== 'test' && c.toLowerCase() !== 'none')
                    .sort();

                return new Response(JSON.stringify({
                    success: true,
                    categories: uniqueCategories
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                });
            }

            // --- DIRECT ACTION: Fetch Category Menu ---
            if (body.action === 'get_menu' && body.category) {
                const finalOrgId = organization_id || organizationId;
                const finalBranchId = clientBranchId || branchId;
                
                const menuResult = await executeMcpTool(supabase, "get_menu", { category: body.category }, finalOrgId, finalBranchId, null);
                return new Response(JSON.stringify({
                    success: true,
                    items: menuResult.items || [],
                    category: body.category
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                });
            }

            if (body.action === 'place_order') {
            console.log('[DirectAction] place_order triggered');
            const directItems = body.items || [];
            const directTableId = body.table_id || table_id || '';
            let directOrgId = body.organization_id || organizationId || '';
            let directBranchId = body.branch_id || branchId || '';
            let resolvedTable = body.table_number || '';

            // Resolve org, branch, and table_number from table_id
            if (directTableId) {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(directTableId);
                if (isUuid) {
                    const { data: tData } = await supabase
                        .from('tables')
                        .select('table_number, branch_id, organization_id')
                        .eq('id', directTableId)
                        .maybeSingle();
                    if (tData) {
                        resolvedTable = resolvedTable || tData.table_number;
                        directBranchId = directBranchId || tData.branch_id;
                        directOrgId = directOrgId || tData.organization_id;
                        console.log(`[DirectAction] Resolved from table: org=${directOrgId}, branch=${directBranchId}, table=${resolvedTable}`);
                    }
                }
            }

            if (!directOrgId || !directBranchId) {
                return new Response(JSON.stringify({ success: false, error: 'Missing organization or branch context.' }), { headers: corsHeaders });
            }

            try {
                const result = await executeMcpTool(supabase, 'place_order', {
                    items: directItems,
                    table_number: resolvedTable,
                    table_id: directTableId,
                    session_id: body.session_id || '',
                }, directOrgId, directBranchId, resolvedTable);

                // --- CREDIT DEDUCTION ---
                try {
                    await Promise.all([
                        supabase.rpc('increment_org_credits', { org_id: directOrgId, amount: 20 }),
                        supabase.from("credit_usage_logs").insert({
                            organization_id: directOrgId,
                            action_type: "direct_order",
                            amount: 20,
                            metadata: { session_id: body.session_id, table: resolvedTable, is_direct: true }
                        })
                    ]);
                } catch (ce) {
                    console.warn('[DirectAction] Credit update failed:', ce);
                }

                return new Response(JSON.stringify({ success: true, result }), { headers: corsHeaders });
            } catch (err: any) {
                console.error('[DirectAction] place_order failed:', err.message);
                return new Response(JSON.stringify({ success: false, error: err.message }), { headers: corsHeaders });
            }
        }

        // ── DIRECT ACTION: Verify Payment (Legacy - now handled by central verify-payment function) ──
        if (body.action === 'verify_payment') {
            return new Response(JSON.stringify({ success: false, error: 'This action is deprecated. The frontend should call the central verify-payment function directly.' }), { headers: corsHeaders });
        }

        // ── DIRECT ACTION: Complete Order (legacy fallback) ──
        if (body.action === 'complete_order') {
            console.log('[DirectAction] complete_order triggered');
            const orderId = body.order_id || '';

            if (!orderId) {
                return new Response(JSON.stringify({ success: false, error: 'Missing order_id.' }), { headers: corsHeaders });
            }

            const { data: orderData } = await supabase
                .from('orders')
                .select('organization_id, branch_id')
                .eq('id', orderId)
                .maybeSingle();

            const compOrgId = orderData?.organization_id || organizationId;
            const compBranchId = orderData?.branch_id || branchId;

            try {
                const result = await executeMcpTool(supabase, 'complete_order', {
                    order_id: orderId,
                }, compOrgId, compBranchId, '');

                // --- CREDIT DEDUCTION (Optional, maybe not for completion? but user said "Each successfull order") ---
                // If it's the final step of a sale, we might want to charge. 
                // But place_order already charged. Let's stick to place/update.

                return new Response(JSON.stringify({ success: true, result }), { headers: corsHeaders });
            } catch (err: any) {
                console.error('[DirectAction] complete_order failed:', err.message);
                return new Response(JSON.stringify({ success: false, error: err.message }), { headers: corsHeaders });
            }
        }

        // ── DIRECT ACTION: Get Banks ──
        if (body.action === 'get_banks') {
            console.log('[DirectAction] get_banks triggered');
            const directTableId = body.table_id || '';
            let resolveOrgId = organizationId || '';

            if (directTableId) {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(directTableId);
                if (isUuid) {
                    const { data: tData } = await supabase.from('tables').select('organization_id').eq('id', directTableId).maybeSingle();
                    if (tData) resolveOrgId = tData.organization_id;
                }
            }

            const { data: banks } = await supabase
                .from('bank_settings')
                .select('bank_key, account_number')
                .eq('organization_id', resolveOrgId)
                .eq('is_active', true);

            return new Response(JSON.stringify({
                success: true,
                banks: (banks || []).filter((b: any) => b.account_number),
            }), { headers: corsHeaders });
        }

        let resolvedTableNumber = table_number;

        let prefetchedMetadata: any = {};
        let shouldShortcutVerifiedTable = false;

        // ── NEW: Resolve Table Number from ID (for QR/NFC sessions) ──
        if (table_id && !resolvedTableNumber) {
            try {
                // Try UUID first
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(table_id);
                let tableQuery = supabase.from('tables').select('table_number, branch_id, organization_id');

                if (isUuid) {
                    tableQuery = tableQuery.eq('id', table_id);
                } else {
                    // Fallback for manual testing: look by table_number
                    tableQuery = tableQuery.eq('table_number', table_id);
                    if (branchId) tableQuery = tableQuery.eq('branch_id', branchId);
                }

                const { data: tableData, error: tableErr } = await tableQuery.maybeSingle();

                if (tableData) {
                    resolvedTableNumber = tableData.table_number;
                    prefetchedMetadata.confirmed_table_number = tableData.table_number;
                    if (!branchId) branchId = tableData.branch_id;
                    if (!organizationId) organizationId = tableData.organization_id;
                    console.log(`[CustomerAgent] Resolved table_id ${table_id} -> Table ${resolvedTableNumber}`);
                } else if (tableErr) {
                    console.warn(`[CustomerAgent] Table resolution error for ${table_id}:`, tableErr.message);
                }
            } catch (e) {
                console.warn("[CustomerAgent] table_id resolution failed:", e);
            }
        }

        // External timeout for the entire reasoning process (25s to stay under Edge limit)
        const globalController = new AbortController();

        try {
            globalTimeout = setTimeout(() => globalController.abort(), 25000);
            // Fallback for Guests or Service Role
            if (organizationId === 'SERVICE_ROLE' || !organizationId) {
                organizationId = organization_id || organizationId;
            }
            if (!branchId) {
                branchId = clientBranchId;
            }

            // Resolve Organization from Branch if missing (critical for Guest users)
            if (!organizationId && branchId) {
                const { data: bData } = await supabase
                    .from("branches")
                    .select("organization_id")
                    .eq("id", branchId)
                    .maybeSingle();
                if (bData) {
                    organizationId = bData.organization_id;
                }
            }

            if (!organizationId) {
                clearTimeout(globalTimeout);
                return new Response(
                    JSON.stringify({ error: "Unauthorized", detail: "Could not resolve organization context" }),
                    { status: 401, headers: corsHeaders }
                );
            }
        } catch (e) {
            console.warn("[CustomerAgent] Identity resolution error:", e);
        }

        // ── STEP 0: Resolve Customer Identity ──
        let customerProfile: any = null;
        let customerId: string | null = body.customer_id || null; // Prioritize passed ID
        let customerOrderHistory: any[] = [];

        try {
            if (!customerId) {
                // Find most recent chat with a customer_id for this session
                const { data: recentChat } = await supabase
                    .from("customer_chats")
                    .select("customer_id")
                    .eq("session_id", session_id)
                    .not("customer_id", "is", null)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (recentChat?.customer_id) {
                    customerId = recentChat.customer_id;
                }
            }

            if (customerId) {
                const { data: profile } = await supabase
                    .from("customer_profiles")
                    .select("*")
                    .eq("id", customerId)
                    .maybeSingle();
                customerProfile = profile;

                // Fetch recent orders
                const { data: history } = await supabase
                    .from("orders")
                    .select("id, total_amount, created_at, order_items(quantity, menu_item:menu(name))")
                    .eq("customer_id", customerId)
                    .order("created_at", { ascending: false })
                    .limit(3);
                customerOrderHistory = history || [];
            }
        } catch (e) {
            console.warn("[CustomerAgent] Identity lookup failed:", e);
        }

        if (!hasUsableTableContext(resolvedTableNumber) && session_id) {
            try {
                const { data: recentMetadata } = await supabase
                    .from("customer_chats")
                    .select("metadata")
                    .eq("session_id", session_id)
                    .order("created_at", { ascending: false })
                    .limit(10);

                const savedTable = recentMetadata?.find((row: any) => hasUsableTableContext(row?.metadata?.confirmed_table_number))
                    ?.metadata?.confirmed_table_number;

                if (savedTable) {
                    resolvedTableNumber = savedTable;
                    prefetchedMetadata.confirmed_table_number = savedTable;
                }
            } catch (e) {
                console.warn("[CustomerAgent] Saved table lookup failed:", e);
            }
        }

        if (branchId && looksLikeTableCandidate(message)) {
            try {
                const tableResult = await executeMcpTool(supabase, "list_tables", {}, organizationId, branchId || "", "");
                const matchedTable = matchTableCandidate(message, tableResult?.tables || []);

                if (matchedTable) {
                    resolvedTableNumber = matchedTable;
                    prefetchedMetadata.confirmed_table_number = matchedTable;
                    shouldShortcutVerifiedTable = true;
                } else if (normalizeTableCandidate(message) !== normalizeTableCandidate(resolvedTableNumber || '')) {
                    prefetchedMetadata.requested_table_number = normalizeTableCandidate(message);
                }
            } catch (e) {
                console.warn("[CustomerAgent] Deterministic table verification failed:", e);
            }
        }

        if (!message || !session_id) {
            clearTimeout(globalTimeout);
            return new Response(
                JSON.stringify({ error: "message and session_id are required" }),
                { status: 400, headers: corsHeaders }
            );
        }

        // ── STEP 1: Load Organization Context & Credits ──
        let orgPrompt = "";
        let orgName = organization_name || "Unknown";
        let creditsInfo: { used: number; max: number; reset_date: string } | null = null;
        
        let orgData: any = null;
        try {
            const { data } = await supabase
                .from("organizations")
                .select("chatbot_system_prompt, name, used_monthly_credits, max_monthly_credits, credit_reset_date, max_branches, plan_tier")
                .eq("id", organizationId)
                .single();
            orgData = data;

            if (orgData) {
                if (orgData.chatbot_system_prompt?.trim()) orgPrompt = orgData.chatbot_system_prompt;
                if (orgData.name) orgName = orgData.name;
                
                // Credit Reset Logic
                const now = new Date();
                const resetDate = new Date(orgData.credit_reset_date || now);
                
                if (now > resetDate) {
                    console.log(`[CustomerAgent] Credits reset for org ${organizationId}`);
                    const newResetDate = new Date();
                    newResetDate.setDate(newResetDate.getDate() + 30);
                    
                    await supabase
                        .from("organizations")
                        .update({ 
                            used_monthly_credits: 0, 
                            credit_reset_date: newResetDate.toISOString() 
                        })
                        .eq("id", organizationId);
                    
                    creditsInfo = { used: 0, max: orgData.max_monthly_credits || 100, reset_date: newResetDate.toISOString() };
                } else {
                    creditsInfo = { 
                        used: orgData.used_monthly_credits || 0, 
                        max: orgData.max_monthly_credits || 100,
                        reset_date: orgData.credit_reset_date
                    };
                }
            }
        } catch (e) {
            console.warn("[CustomerAgent] Org config load failed:", e);
        }

        // ── STEP 1.1: Credit Enforcement ──
        if (creditsInfo && creditsInfo.used >= creditsInfo.max) {
            console.warn(`[CustomerAgent] Credit limit reached for org ${organizationId} (${creditsInfo.used}/${creditsInfo.max})`);
            return new Response(
                JSON.stringify({
                    text: "Hey bestie! 🌟 CADE is currently taking a small beauty sleep because our monthly message budget is full! 💅 Check back soon or browse the menu manually. (Admin: Upgrade your plan for unlimited vibes!)",
                    metadata: {
                        is_error: true,
                        error_type: "insufficient_credits",
                        credits: creditsInfo
                    }
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ── STEP 1.2: Branch Enforcement ──
        if (orgData && branchId) {
            const { count: branchCount } = await supabase
                .from("branches")
                .select("*", { count: 'exact', head: true })
                .eq("organization_id", organizationId);
            
            const maxBranchesAllowed = orgData.max_branches || 1;
            if (branchCount > maxBranchesAllowed && orgData.plan_tier === 'basic') {
                 console.warn(`[CustomerAgent] Branch limit exceeded for org ${organizationId} (${branchCount}/${maxBranchesAllowed})`);
                 return new Response(
                    JSON.stringify({
                        text: "Bestie, your restaurant is growing too fast! 🚀 You've reached the branch limit for your current plan. Please upgrade to the Standard plan to manage multiple branches with CADE!",
                        metadata: {
                            is_error: true,
                            error_type: "branch_limit_exceeded",
                            limit: maxBranchesAllowed
                        }
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        const activeBranchName = branch_name || "Unknown";
        const activeTable = resolvedTableNumber || "Unknown";
        const tableInstruction = hasUsableTableContext(resolvedTableNumber)
            ? `- TABLE VERIFIED: The confirmed table for this session is ${resolvedTableNumber}. Do NOT ask for table confirmation again. You may place orders and updates for this table immediately.`
            : `- ONBOARDING: Ask the customer to confirm their table number before placing or updating any order.`;

        let timeOfDay = "Evening";
        let timeBasedMenuContext = "Display a 'Dinner & Drinks' carousel highlighting signature entrees and cocktails.";
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 11) {
            timeOfDay = "Morning";
            timeBasedMenuContext = "Display a 'Breakfast Specials' carousel featuring coffee, pastries, and light meals.";
        } else if (hour >= 11 && hour < 16) {
            timeOfDay = "Afternoon";
            timeBasedMenuContext = "Display a 'Lunch Deals' carousel with quick-serve items and combos.";
        }

        // ── STEP 1.5: Personalization Injection ──
        let personalContext = "";
        if (customerProfile) {
            personalContext = `
## CUSTOMER RECOGNITION
- **Name**: ${customerProfile.full_name || 'Guest'}
- **Visits**: ${customerProfile.visit_count}
- **Preferences**: ${JSON.stringify(customerProfile.preferences || {})}
`;
        }

        // ── STEP 2: Construct Final System Prompt ──
        let customerContext = "";
        try {
            const { data: recentChat } = await supabase
                .from("customer_chats")
                .select("customer_id")
                .eq("session_id", session_id)
                .not("customer_id", "is", null)
                .limit(1)
                .maybeSingle();

            if (recentChat?.customer_id) {
                const { data: profile } = await supabase
                    .from("customer_profiles")
                    .select("*")
                    .eq("id", recentChat.customer_id)
                    .single();

                if (profile) {
                    customerId = profile.id; // Corrected: Use the top-level variable
                    customerProfile = profile;
                    customerContext = `\n## RETURNING CUSTOMER
- Name: ${profile.full_name || "Guest"}
- Phone: ${profile.phone || "Unknown"}
- Visits: ${profile.visit_count || 1}
- BIO: ${JSON.stringify(profile.preferences || {})}`;

                    // Fetch the very last order items for "Your Usual" logic
                    const { data: lastOrder } = await supabase
                        .from("orders")
                        .select("id, items")
                        .eq("customer_id", customerId)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (lastOrder && lastOrder.items) {
                        customerContext += `\n- Last Order Items: ${JSON.stringify(lastOrder.items)}\n- REORDER ACTION: If the user says "I want my usual", call 'place_order' with these exact items.`;
                    }
                }
            }
        } catch (e) {
            console.warn("[CustomerAgent] Customer profiling failed:", e);
        }

        // ── STEP 1.7: Fetch Active Order Context ──
        let activeOrderId = active_order_id || "";
        if (!activeOrderId && hasUsableTableContext(resolvedTableNumber) && branchId) {
            try {
                const { data: dbOrder } = await supabase
                    .from("orders")
                    .select("id")
                    .eq("organization_id", organizationId)
                    .eq("branch_id", branchId)
                    .eq("table_number", resolvedTableNumber)
                    .in("status", ["pending", "accepted", "preparing", "ready", "served"])
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (dbOrder) {
                    activeOrderId = dbOrder.id;
                    console.log(`[CustomerAgent] Fallback found active order ${activeOrderId} for table ${resolvedTableNumber}`);
                }
            } catch (e) {
                console.warn("[CustomerAgent] Active order fallback lookup failed:", e);
            }
        }

        const systemPrompt = `You are CADE, the digital assistant for ${orgName}.

## CURRENT SESSION CONTEXT
- Restaurant: ${orgName}
- Table (Claimed): ${activeTable}
- Active Order ID: ${activeOrderId || 'None (No active order found)'}

${orgPrompt || DEFAULT_SYSTEM_PROMPT}

${RICH_UI_INSTRUCTIONS}
${PROFESSIONALISM_PROTOCOL}

${personalContext}
${customerContext}

## CRITICAL SAFETY RULES
1. **NO GHOST ORDERS**: NEVER call 'place_order' or 'update_order' unless the user explicitly names a food/drink item or says "I want my usual".
2. **ITEM REQUIREMENT**: If no specific item is identified, NEVER call ordering tools.
3. **NO EMPTY LISTS**: Never call a tool with an empty 'items' array. If you need IDs, call 'get_menu' first.
4. **REPLY STYLE**: Tone is Gen Z, hype, concise. Max 3 sentences.
`;

        // ── STEP 3: Load Chat History ──
        let history: any[] = [];
        try {
            const { data: historyData } = await supabase
                .from("customer_chats")
                .select("role, content")
                .eq("session_id", session_id)
                .order("created_at", { ascending: false })
                .limit(20);

            if (historyData) {
                // Strip UI markers from history to prevent LLM mimicking
                history = historyData.reverse().map(h => ({
                    role: h.role,
                    content: (h.content || '').replace(/\[UI_CONTEXT:[\s\S]*?\]/g, '').trim()
                }));
            }
        } catch (e) {
            console.warn("[CustomerAgent] History load failed:", e);
        }

        const messages: any[] = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: message },
        ];

        // ── PROACTIVE GREETING TRIGGER ──
        const isGreeting = (msg: string) => {
            const lower = msg.toLowerCase().trim();
            const greetings = ['hey', 'hello', 'hi', 'start', 'menu', 'hola', 'yo', 'show me the menu', 'get started'];
            return greetings.includes(lower) || lower.length < 3;
        };

        if (((history.length <= 1 && isGreeting(message)) || message.toLowerCase() === 'init_chat') && !hasUsableTableContext(resolvedTableNumber)) {
            messages.push({
                role: "system",
                content: `CRITICAL: First message must be 'Welcome to ${orgName}! 🌟' and ask for their table number. NEVER show the menu until you have the table number.`
            });
        }

        const availableTools = TOOL_DEFINITIONS;

        // ── STEP 4: Agentic Reasoning Loop ──
        const nvidiaKey = Deno.env.get("NVIDIA_API_KEY");
        const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        const openAIKey = Deno.env.get("OPENAI_API_KEY");

        let finalResponse = "";
        let attachments: any = null;
        let richMetadata: any = { 
            ...prefetchedMetadata,
            customer_id: customerId // Send back to frontend for persistence
        };
        let loopCount = 0;
        const MAX_LOOPS = 5;

        if ((shouldShortcutVerifiedTable || message.toLowerCase() === 'init_chat') && hasUsableTableContext(resolvedTableNumber)) {
            const menuResult = await executeMcpTool(supabase, "get_menu", {}, organizationId, branchId || "", resolvedTableNumber);
            attachments = {
                type: 'menu',
                data: menuResult.items || [],
            };
            richMetadata.confirmed_table_number = resolvedTableNumber;
            richMetadata.buttons = [
                { label: "✨ Best Offers", prompt: "Show me the best offers" },
                { label: "🍹 Drinks", prompt: "Show me the drinks menu" },
                { label: "🍕 Food Menu", prompt: "Show me the food menu" }
            ];
            finalResponse = `Ayy! Table ${resolvedTableNumber}? Slaps. fr. Welcome to ${orgName}! 🌟 Let's get it! Here's the fire menu:`;
        }

        let wasOrderAction = false;
        while (!finalResponse && loopCount < MAX_LOOPS) {
            loopCount++;
            let llmResult: any;

            try {
                let llmResponseOk = false;
                let lastError = "";

                // 1. Try NVIDIA NIM (Primary)
                if (nvidiaKey && !llmResponseOk) {
                    try {
                        const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${nvidiaKey}`,
                            },
                            body: JSON.stringify({
                                model: "meta/llama-3.1-70b-instruct",
                                messages: messages.map(m => ({
                                    role: m.role,
                                    content: m.content,
                                    tool_calls: m.tool_calls,
                                    tool_call_id: m.tool_call_id,
                                    name: m.name
                                })),
                                tools: availableTools,
                                tool_choice: "auto",
                            }),
                            signal: globalController.signal,
                        });
                        if (!response.ok) {
                            const errText = await response.text();
                            throw new Error(`NVIDIA Error: ${errText.substring(0, 100)}`);
                        }
                        llmResult = await response.json();
                        llmResponseOk = true;
                    } catch (e: any) {
                        console.warn("[CustomerAgent] NVIDIA NIM failed:", e.message);
                        lastError += `NVIDIA: ${e.message}; `;
                    }
                }

                // 2. Try OpenRouter (Secondary)
                if (openRouterKey && !llmResponseOk) {
                    try {
                        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${openRouterKey}`,
                            },
                            body: JSON.stringify({
                                model: "meta-llama/llama-3.1-70b-instruct",
                                messages,
                                tools: availableTools,
                            }),
                            signal: globalController.signal,
                        });
                        if (!response.ok) {
                            const errText = await response.text();
                            throw new Error(`OpenRouter Error: ${errText.substring(0, 100)}`);
                        }
                        llmResult = await response.json();
                        llmResponseOk = true;
                    } catch (e: any) {
                        console.warn("[CustomerAgent] OpenRouter failed:", e.message);
                        lastError += `OpenRouter: ${e.message}; `;
                    }
                }

                // 3. Try OpenAI (Tertiary)
                if (openAIKey && !llmResponseOk) {
                    try {
                        const response = await fetch("https://api.openai.com/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${openAIKey}`,
                            },
                            body: JSON.stringify({
                                model: "gpt-4o-mini",
                                messages,
                                tools: availableTools,
                            }),
                            signal: globalController.signal,
                        });
                        if (!response.ok) {
                            const errText = await response.text();
                            throw new Error(`OpenAI Error: ${errText.substring(0, 100)}`);
                        }
                        llmResult = await response.json();
                        llmResponseOk = true;
                    } catch (e: any) {
                        console.warn("[CustomerAgent] OpenAI failed:", e.message);
                        lastError += `OpenAI: ${e.message}; `;
                    }
                }

                // 4. Try Gemini (Final Fallback)
                if (geminiKey && !llmResponseOk) {
                    try {
                        const contents = messages
                            .filter(m => m.role !== "system")
                            .map((m: any) => {
                                if (m.role === "tool") {
                                    let res: any;
                                    try {
                                        res = JSON.parse(m.content);
                                    } catch {
                                        res = { result: m.content };
                                    }
                                    return {
                                        role: "function",
                                        parts: [{ functionResponse: { name: m.name, response: res } }]
                                    };
                                }

                                const parts: any[] = [];
                                if (m.content) parts.push({ text: m.content });
                                if (m.tool_calls) {
                                    m.tool_calls.forEach((tc: any) => {
                                        parts.push({
                                            functionCall: {
                                                name: tc.function.name,
                                                args: JSON.parse(tc.function.arguments),
                                            },
                                        });
                                    });
                                }

                                return {
                                    role: m.role === "assistant" ? "model" : "user",
                                    parts: parts.length > 0 ? parts : [{ text: "" }]
                                };
                            });

                        const response = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    system_instruction: { parts: [{ text: systemPrompt }] },
                                    contents,
                                    tools: [{ function_declarations: availableTools.map(td => td.function) }],
                                    tool_config: { function_calling_config: { mode: "AUTO" } }
                                }),
                                signal: globalController.signal,
                            }
                        );

                        if (!response.ok) {
                            const errText = await response.text();
                            throw new Error(`Gemini Error: ${errText.substring(0, 100)}`);
                        }
                        const gemResult = await response.json();
                        const modelParts = gemResult.candidates?.[0]?.content?.parts || [];

                        const toolCalls = modelParts
                            .filter((p: any) => p.functionCall)
                            .map((p: any) => ({
                                id: `gem-${Math.random().toString(36).substr(2, 9)}`,
                                type: "function",
                                function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args) },
                            }));

                        const textPart = modelParts.find((p: any) => p.text);
                        llmResult = {
                            choices: [{
                                message: {
                                    role: "assistant",
                                    content: textPart?.text || null,
                                    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
                                }
                            }]
                        };
                        llmResponseOk = true;
                    } catch (e: any) {
                        console.warn("[CustomerAgent] Gemini failed:", e.message);
                        lastError = e.message;
                    }
                }

                if (!llmResponseOk) {
                    throw new Error(`All configured LLM providers failed. Last error: ${lastError}`);
                }
            } catch (err: any) {
                console.error("[CustomerAgent] LLM Call Error:", err.message);
                if (attachments?.type === 'menu') {
                    finalResponse = "Here's what we have for you!";
                    break;
                }

                if (richMetadata.top_performing_items || richMetadata.categories) {
                    finalResponse = "Here are a few great options to explore.";
                    break;
                }

                // Return a slightly more detailed error in dev/testing if possible, or just the fallback
                finalResponse = `I'm having a bit of trouble reaching my knowledge right now (Error: ${err.message}). Could you please try again in a moment? 🍽️`;
                break;
            }

            const choice = llmResult?.choices?.[0];
            if (!choice) break;

            const assistantMessage = choice.message;
            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                messages.push(assistantMessage);
                for (const toolCall of assistantMessage.tool_calls) {
                    const toolName = toolCall.id ? toolCall.function.name : '';
                    let toolParams = {};
                    try { toolParams = JSON.parse(toolCall.function.arguments); } catch { }

                    let toolResult: any;

                    // --- INTERNAL VALIDATION: Prevent Ghost Orders ---
                    if ((toolName === 'place_order' || toolName === 'update_order') && (!(toolParams as any).items || (toolParams as any).items.length === 0)) {
                        console.error(`[CustomerAgent] LLM tried calling ${toolName} with empty items! Blocked.`);
                        toolResult = {
                            success: false,
                            error: "CRITICAL: 'items' array is required and cannot be empty. Please identify exactly which items the user wants before ordering."
                        };
                    } else {
                        try {
                            toolResult = await executeMcpTool(supabase, toolName, toolParams, organizationId, branchId || "", resolvedTableNumber || "");
                        } catch (err: any) {
                            console.error(`[CustomerAgent] Tool ${toolName} failed:`, err.message);
                            toolResult = { error: err.message, success: false };
                        }
                    }

                    messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        name: toolName,
                        content: JSON.stringify(toolResult),
                    });

                    // Capture results for UI
                    if (toolName === 'get_menu') {
                        const itemsToShow = (toolResult.items && toolResult.items.length > 0) 
                            ? toolResult.items 
                            : (toolResult.suggested_items || []);
                            
                        attachments = {
                            type: 'menu',
                            data: itemsToShow,
                            debug: toolResult.debug,
                            is_fallback: !toolResult.items || toolResult.items.length === 0
                        };
                    } else if (toolName === 'list_tables') {
                        const matchedTable = matchTableCandidate(message, toolResult.tables || []);
                        if (matchedTable) {
                            resolvedTableNumber = matchedTable;
                            richMetadata.confirmed_table_number = matchedTable;
                            // Update the toolResult to be more helpful for the AI
                            toolResult = {
                                success: true,
                                verified: true,
                                matched_table: matchedTable,
                                available_tables: toolResult.tables
                            };
                        } else {
                            toolResult = {
                                success: true,
                                verified: false,
                                message: "No match found for the table provided by the user.",
                                available_tables: toolResult.tables
                            };
                        }
                    } else if (toolName === 'get_top_performing_items') {
                        richMetadata.top_performing_items = toolResult.items || toolResult || [];
                    } else if (toolName === 'get_categories') {
                        richMetadata.categories = toolResult.categories || toolResult || [];
                    } else if (toolName === 'update_customer_profile') {
                        if (toolResult?.profile?.id) {
                            customerId = toolResult.profile.id;
                            customerProfile = toolResult.profile;
                            // Update existing messages in this session to link to this customer
                            await supabase
                                .from("customer_chats")
                                .update({ customer_id: customerId })
                                .eq("session_id", session_id);
                        }
                    }

                    if (toolName === 'place_order' || toolName === 'update_order') {
                        wasOrderAction = true;
                    }
                }
                continue;
            }

            finalResponse = assistantMessage.content || "I'm not sure how to help with that.";

            // If a tool failed, append the error to finalResponse for visibility (Internal Debug)
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && lastMessage.role === 'tool') {
                const tr = JSON.parse(lastMessage.content);
                if (tr.success === false) {
                    const toolErr = tr.error;
                    const failedToolName = lastMessage.name;
                    
                    // Find the tool call that matches this result to see the params
                    const toolCall = messages.find(m => m.role === 'assistant' && 
                        m.tool_calls?.find(tc => tc.id === lastMessage.tool_call_id));
                    const tcItem = toolCall?.tool_calls?.find(tc => tc.id === lastMessage.tool_call_id);
                    const sentParams = tcItem?.function?.arguments || "{}";

                    finalResponse += `\n\n[System Note: ${failedToolName} failed with error: ${toolErr}. Params sent: ${sentParams}]`;
                }
            }
            break;
        }

        // ── STEP 5: Extract Metadata & Cleanup Response ──

        // Enhanced extraction: Find all potential JSON blocks
        // 1. [UI_CONTEXT: ...] pattern
        // 2. ```json ... ``` pattern
        // 3. Trailing { ... } pattern
        const uiContextRegex = /\[UI_CONTEXT:\s*([\s\S]*)\s*\]/g;
        const codeBlockRegex = /```json\n([\s\S]*?)\n```/g;
        const trailingJsonRegex = /(\{[\s\S]*?\})(?=\s*$)/;

        let match;

        // Extract from [UI_CONTEXT: ...]
        while ((match = uiContextRegex.exec(finalResponse)) !== null) {
            try {
                const content = match[1].trim();
                const extracted = JSON.parse(content);
                richMetadata = { ...richMetadata, ...extracted };
            } catch (e) {
                console.warn("[CustomerAgent] [UI_CONTEXT] parse failed:", e.message);
            }
        }

        // Extract from code blocks
        while ((match = codeBlockRegex.exec(finalResponse)) !== null) {
            try {
                const extracted = JSON.parse(match[1]);
                richMetadata = { ...richMetadata, ...extracted };
            } catch (e) {
                console.warn("[CustomerAgent] [CodeBlock] parse failed:", e);
            }
        }

        // Extract trailing if nothing else matched yet
        if (Object.keys(richMetadata).length === 0) {
            match = finalResponse.match(trailingJsonRegex);
            if (match) {
                try {
                    const extracted = JSON.parse(match[1]);
                    richMetadata = { ...richMetadata, ...extracted };
                } catch (e) {
                    // Fail silently for trailing as it might just be text ending with }
                }
            }
        }

        // Cleanup: Remove all UI markers from the finalResponse
        finalResponse = finalResponse
            .replace(uiContextRegex, "")
            .replace(codeBlockRegex, "")
            .trim();

        // If we extracted trailing JSON and it was at the very end, remove it too
        if (Object.keys(richMetadata).length > 0) {
            const lastTrailingMatch = finalResponse.match(trailingJsonRegex);
            if (lastTrailingMatch && finalResponse.endsWith(lastTrailingMatch[0])) {
                // Only remove if it looks like the JSON we extracted
                try {
                    JSON.parse(lastTrailingMatch[0]);
                    finalResponse = finalResponse.replace(trailingJsonRegex, "").trim();
                } catch { }
            }
        }

        // Auto-Injection Fallbacks
        // Auto-Injection Fallbacks
        if (!richMetadata.buttons && !richMetadata.tracking) {
            const lowerResp = finalResponse.toLowerCase();
            const lowerMsg = message.toLowerCase();

            // Only provide contextual buttons, NOT generic menu categories
            if (lowerResp.includes("order") || lowerResp.includes("status")) {
                richMetadata.buttons = [
                    { label: "📍 Track Order", prompt: "Check my order status" },
                    { label: "➕ Add More", prompt: "I want to add more food" }
                ];
            } else if (lowerResp.includes("bill") || lowerResp.includes("pay")) {
                richMetadata.buttons = [
                    { label: "➗ Split Bill", prompt: "How can I split the bill?" },
                    { label: "💳 Pay Total", prompt: "I want to pay the bill" }
                ];
            }
        }

        // Ensure finalResponse is never empty
        if (!finalResponse.trim()) {
            finalResponse = attachments ? "Here's what we have for you!" : "How may I assist you today?";
        }

        // Merge with tool attachments (like menu items)
        if (attachments) {
            richMetadata.attachments = attachments;
        }

        // ── STEP 6: Save History ──
        try {
            await supabase.from("customer_chats").insert([
                {
                    session_id,
                    customer_id: customerId,
                    organization_id: organizationId,
                    branch_id: branchId,
                    role: "user",
                    content: message
                },
                {
                    session_id,
                    customer_id: customerId,
                    organization_id: organizationId,
                    branch_id: branchId,
                    role: "assistant",
                    content: finalResponse,
                    metadata: richMetadata
                },
            ]);
        } catch (e) {
            console.error("[CustomerAgent] History save failed:", e);
        }

        clearTimeout(globalTimeout);

        // ── STEP 8: Credit Deduction ──
        try {
            const creditAmount = wasOrderAction ? 20 : 1;
            await Promise.all([
                // Increment used count
                supabase.rpc('increment_org_credits', { 
                    org_id: organizationId, 
                    amount: creditAmount 
                }),
                // Log usage
                supabase.from("credit_usage_logs").insert({
                    organization_id: organizationId,
                    action_type: wasOrderAction ? "successful_order" : "chat_message",
                    amount: creditAmount,
                    metadata: { session_id, table: resolvedTableNumber, is_order: wasOrderAction }
                })
            ]);
        } catch (e) {
            console.warn("[CustomerAgent] Post-processing credit update failed:", e);
        }

        return new Response(JSON.stringify({
            text: finalResponse,
            response: finalResponse,
            metadata: richMetadata
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        if (typeof globalTimeout !== 'undefined') clearTimeout(globalTimeout);
        console.error("[CustomerAgent] Global Error:", error.message);
        return new Response(JSON.stringify({
            text: "I'm having a bit of trouble reaching my knowledge right now. Could you please try again in a moment? 🍽️",
            error: error.message
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }
});
