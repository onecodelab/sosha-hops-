import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, resolveIdentity } from "../_shared/identity.ts";

// ─── TOOL DEFINITIONS ───
const TOOL_DEFINITIONS = [
    {
        type: "function",
        function: {
            name: "get_menu",
            description: "Get the restaurant's menu items. Call with NO parameters to show the full menu. Only use 'category' for specific sub-categories like 'Drinks', 'burgers', 'fish'. Do NOT pass generic terms like 'food' or 'menu' as category.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search for a specific menu item by name" },
                    category: { type: "string", description: "Filter by a SPECIFIC category like 'Drinks', 'burgers', 'fish', 'Breakfast'. Leave empty to show all items." },
                },
            },
        },
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
                                menu_item_id: { type: "string" },
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
const DEFAULT_SYSTEM_PROMPT = `You are CADE, a smart, high-energy, and friendly restaurant assistant for the restaurant in the CONTEXT. You help customers browse the menu, place orders, track their food, and handle payments with "bestie" energy.

# STRICT OPERATIONAL RULES:
1. MENU FIRST: ALWAYS use the 'get_menu' tool when a customer asks about food, the menu, or what's available. NEVER guess or hallucinate menu items.
2. TABLE NUMBER: Check the TABLE (CLAIMED) in the CONTEXT. If it is "Unknown", you MUST ask for the table number before placing any order. If it's already known, DO NOT ASK—just confirm it and move on. No table, no food. fr.
3. CUSTOMER MEMORY: When a customer shares their name, phone, or any food preference/allergy, IMMEDIATELY call 'update_customer_profile'.
4. ORDER UPDATES: Use 'update_order' to add items to an existing order.
5. PAYMENT & BILLING: For bills, call 'get_branch_info' then 'get_order_status' for the total.
6. VERIFICATION: For payment references, call 'verify_payment' immediately.
7. VOICE & TONE: Be warm, helpful, and concise. Use Gen Z slang (slaps, bet, fr, main character) naturally but keep it brief. Emojis strictly allowed. ✨
8. NO TEXT MENUS: NEVER list food items or prices in plain text. ALWAYS use 'get_menu' to show the visual carousel.
9. CONFIRMATION: Always confirm the full order details before calling 'place_order'.

# VOICE:
- Use Gen Z slang (slaps, bet, fr, main character, no cap) but keep it brief.
- Responses MUST be under 3 sentences. No long intros. Just hype + data.
- Example: "Ayy! Table 5? Slaps. fr. Here's the fire menu for you: [Calling get_menu]. What we locking in? bet."
`;

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
5. **CONTEXTUAL QUICK REPLIES**: Always provide interactive buttons based on the user's current flow:
   - *Discovery Phase*: [{"label": "🍔 Food Menu", "prompt": "Show me the menu"}, {"label": "🤩 What's Popular?", "prompt": "Show me popular items"}]
   - *Selection Phase*: [{"label": "🚀 Confirm Order", "prompt": "Confirm my order"}, {"label": "🛒 View Cart", "prompt": "Show my cart"}]
   - *Post-Placement*: [{"label": "📡 Track My Order", "prompt": "Where is my food?"}, {"label": "🧾 Request Bill", "prompt": "Show my bill"}]

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
            .select("id, name, price, category, image_url, is_available, description")
            .eq("organization_id", organizationId);

        if (targetBranch) {
            dbQuery = dbQuery.eq("branch_id", targetBranch);
        }

        if (catStr) dbQuery = dbQuery.ilike("category", `%${catStr}%`);
        if (queryStr) dbQuery = dbQuery.ilike("name", `%${queryStr}%`);

        const { data: menuData, error: menuErr } = await dbQuery.limit(20);
        if (menuErr) {
            console.error("[MCP-LOCAL-MENU] Error:", menuErr);
            return { error: menuErr.message };
        }

        const items = menuData || [];
        console.log(`[MCP-LOCAL-MENU] Found ${items.length} items.`);

        // If category filter returned 0 results, retry without category
        if (items.length === 0 && catStr) {
            console.log(`[MCP-LOCAL-MENU] Category "${catStr}" returned 0 items. Retrying without category filter...`);
            let retryQuery = supabase
                .from("view_menu_details")
                .select("id, name, price, category, image_url, is_available, description")
                .eq("organization_id", organizationId);
            if (targetBranch) retryQuery = retryQuery.eq("branch_id", targetBranch);
            if (queryStr) retryQuery = retryQuery.ilike("name", `%${queryStr}%`);
            const { data: retryData } = await retryQuery.limit(20);
            const retryItems = retryData || [];
            console.log(`[MCP-LOCAL-MENU] Retry found ${retryItems.length} items.`);
            return { items: retryItems };
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
        const { message, session_id, table_number, table_id, organization_id, organization_name, branch_id: clientBranchId, branch_name, is_verified } = body;
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

        // ── STEP 1: Load Organization Context ──
        let orgPrompt = "";
        let orgName = organization_name || "Unknown";
        try {
            const { data: orgData } = await supabase
                .from("organizations")
                .select("chatbot_system_prompt, name")
                .eq("id", organizationId)
                .single();

            if (orgData?.chatbot_system_prompt?.trim()) {
                orgPrompt = orgData.chatbot_system_prompt;
            }
            if (orgData?.name) orgName = orgData.name;
        } catch (e) {
            console.warn("[CustomerAgent] Org config load failed:", e);
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

        const systemPrompt = `You are CADE, the digital assistant for ${orgName}.

## CURRENT SESSION CONTEXT
- Restaurant: ${orgName}
- Table (Claimed): ${activeTable}

${orgPrompt || DEFAULT_SYSTEM_PROMPT}

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
                    const toolName = toolCall.function.name;
                    let toolParams = {};
                    try { toolParams = JSON.parse(toolCall.function.arguments); } catch { }

                    let toolResult: any;
                    try {
                        toolResult = await executeMcpTool(supabase, toolName, toolParams, organizationId, branchId || "", resolvedTableNumber || "");
                    } catch (err: any) {
                        toolResult = { error: err.message };
                    }

                    messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        name: toolName,
                        content: JSON.stringify(toolResult),
                    });

                    // Capture results for UI
                    if (toolName === 'get_menu') {
                        attachments = {
                            type: 'menu',
                            data: toolResult.items || [],
                            debug: toolResult.debug
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
                }
                continue;
            }

            finalResponse = assistantMessage.content || "I'm not sure how to help with that.";
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
        if (!richMetadata.buttons && !richMetadata.tracking) {
            const lowerResp = finalResponse.toLowerCase();
            const lowerMsg = message.toLowerCase();

            // If it's a greeting or table request, provide minimal buttons
            if (lowerResp.includes("welcome") || lowerResp.includes("table number")) {
                richMetadata.buttons = [
                    { label: "✨ Best Offers", prompt: "Show me the best offers" },
                    { label: "🍹 Drinks", prompt: "Show me the drinks menu" },
                    { label: "🍕 Food Menu", prompt: "Show me the food menu" }
                ];
            } else if (attachments?.type === 'menu' || lowerResp.includes("menu") || lowerResp.includes("set")) {
                richMetadata.buttons = [
                    { label: "🤩 What's Popular?", prompt: "Show me popular items" },
                    { label: "🍹 Cold Drinks", prompt: "Show me drinks" },
                    { label: "☕ Coffee", prompt: "I'd like coffee" },
                    { label: "🛒 View Cart", prompt: "Show my cart" }
                ];
            } else if (lowerResp.includes("order") || lowerResp.includes("status")) {
                richMetadata.buttons = [
                    { label: "📍 Track Order", prompt: "Check my order status" },
                    { label: "➕ Add More", prompt: "I want to add more food" }
                ];
            } else if (lowerResp.includes("bill") || lowerResp.includes("pay")) {
                richMetadata.buttons = [
                    { label: "➗ Split Bill", prompt: "How can I split the bill?" },
                    { label: "💳 Pay Total", prompt: "I want to pay the bill" }
                ];
            } else {
                richMetadata.buttons = [
                    { label: "✨ Best Offers", prompt: "Show me the best offers" },
                    { label: "🍕 Food Menu", prompt: "Show me the menu" },
                    { label: "🍹 Drinks", prompt: "Show me the drinks menu" }
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
