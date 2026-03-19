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
            description: "Place a new order for the customer. ALWAYS confirm items and get a TABLE NUMBER first. Use either 'menu_item_id' (UUID from get_menu) or 'name' (exact item name) for each item.",
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
            description: "Add more items to an existing order. Use when customer says 'add one more...' or 'I also want...'",
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

// ─── DEFAULT SYSTEM PROMPT ───
const DEFAULT_SYSTEM_PROMPT = `You are a smart, professional restaurant assistant for the restaurant mentioned in the CONTEXT.

## STRICT ONBOARDING FLOW (MANDATORY)
1. **GREETING**: Start by warmly greeting the customer.
2. **TABLE VERIFICATION**: Immediately after greeting, you MUST ask: "Could you please tell me your table number? 😊"
    - DO NOT show the menu or take orders until the table is verified.
3. **VALIDATION**: Once the user provides a table number, call 'list_tables' to see if it exists in the floor map.
    - MATCHING LOGIC: Be flexible. Ignore prefixes like '#' and be case-insensitive (e.g., 'c15' matches '#C15').
    - If it's a MATCH: Confirm it explicitly as follows: "Recognized Table #X! I'm ready to help you order. 🦄"
    - If it's NOT a match: Reply with the exact table numbers returned from the tool (e.g., "I couldn't find table c15. I only see: [insert actual, real table numbers from tool output]. Which one are you at?")
    - ACTION: Immediately after matching, you MUST call 'get_menu' (with no query) to show the visual carousel.
    - If it's NOT in the list: Politely explain that you couldn't find that table and ask them to double-check the number on their table card.
    - DO NOT hallucinate. Only valid numbers from 'list_tables' are allowed.
4. **UNLOCK**: Only after verification can you use 'get_menu', 'place_order', or 'update_order'.

## OPERATIONAL RULES
1. **NO TEXT MENUS**: NEVER list food items, descriptions, or prices in plain text. ALWAYS use 'get_menu' to show the visual carousel. Your text response should only ever be an invitation to look at the carousel (e.g. "Check out our delicious options below!").
2. **ORDER FLOW**: Once an order is placed, tell the customer: "Order sent for approval! 📡 A waiter will confirm it shortly so the kitchen can start cooking."
3. **UPSELL**: If they order a main course, ask if they'd like a drink and show the drinks menu.
4. **CONTEXT**: Use the Restaurant name and Branch ID from the auto-injected CONTEXT below.

## RESPONSE STYLE
- Keep messages short and clean.
- Do not use markdown styling like **bold** or *italics*.
- Use emojis naturally but sparingly.`;

const RICH_UI_INSTRUCTIONS = `
## RICH UI CAPABILITIES
Include a JSON block at the end of your response for interactive elements.
Example: \`\`\`json { "buttons": [{"label": "🍴 View Menu", "prompt": "Show me the menu"}] } \`\`\`

Supported elements:
- "buttons": Array of { label, prompt }.
- "tracking": { "status": "placed" | "preparing" | "ready" | "delivered" }
- "pills": Array of strings for quick category filters.
- "splitter": { "total": number }
- "rating": { "type": "stars" }

## STRICT UI RULES - READ CAREFULLY
1. **NO TEXT MENUS**: You are FORBIDDEN from typing menu items, prices, or categories in markdown text. NEVER use bullet points or bold text to list food.
2. **CAROUSEL ONLY**: Every time you want to show a menu or items, you MUST ONLY use the 'get_menu' or 'get_top_performing_items' tool.
3. **SHORT RESPONSES**: Your text response should only be a short greeting like: "Here is our menu! 🍽️" or "Check out our specials below."
4. **COMPACT SUMMARY**: When an item is added, ONLY send a short confirmation: "Added Item Name! ✅ Your total is now ETB Total." (Do NOT use brackets [] or parentheses () around names/prices). Followed by buttons: [{"label": "🛒 View Cart", "prompt": "Show my cart"}, {"label": "🥤 Add Drinks/Sides", "prompt": "Show me drinks and sides"}].
5. **CONTEXTUAL QUICK REPLIES**: Always provide interactive buttons based on the user's current flow:
   - *Discovery Phase*: [{"label": "🍔 Food Menu", "prompt": "Show me the menu"}, {"label": "🥤 Drinks & Sides", "prompt": "Show me drinks and sides"}, {"label": "🤩 What's Popular?", "prompt": "Show me popular items"}]
   - *Selection Phase*: [{"label": "🚀 Confirm Order", "prompt": "Confirm my order and send it to the kitchen"}, {"label": "🥗 Add Starters", "prompt": "Show me starters"}, {"label": "🛒 View Cart", "prompt": "Show my cart"}]
   - *Post-Placement*: [{"label": "📡 Track My Order", "prompt": "Where is my food?"}, {"label": "➕ Add Main Course", "prompt": "Show menu"}, {"label": "➕ Add Drinks", "prompt": "Show me drinks"}, {"label": "🧾 Request Bill", "prompt": "Show my bill"}]

## YOUR RULES
1. **TABLE VERIFICATION**: You MUST call 'get_tables' at initialization and whenever the table context is unclear. If the Table Number from CONTEXT does not match any 'table_number' in the list (e.g., if you see "#C1" but user is on "T1"), you MUST ask: "Welcome! I see you're starting an order, but I couldn't find your table on our map. Could you double-check the number on your table card? 😊"
2. **STRICT ORDERING**: You are FORBIDDEN from calling 'place_order' until you have a confirmed 'table_number' that matches an entry in 'get_tables'.
3. **NO FORMATTING**: You are FORBIDDEN from using markdown characters like asterisks (*), underscores (_), or parentheses () to style your text. Keep all text plain and clean.
3. ALWAYS use the 'get_menu' tool when a customer asks about food. NEVER guess menu items.
4. Call 'update_customer_profile' when you learn something new about the customer.
5. ORDER WORKFLOW: After calling 'place_order', explain that it is "Sent for Approval" and that a "Waiter will confirm it shortly". NEVER say it is already in the kitchen.
6. Drink Pairings: As soon as a user adds a 'Main Course' (Burger, Steak, Fish), your next message MUST be: "Great choice! 🥩 Would you like a drink to go with that?" followed IMMEDIATELY by calling 'get_menu' with category="Drinks".
7. Deal of the Day: Always mention the "Happy Hour" deal in your first greeting.
8. DECISION BUTTONS: Every time you suggest an action (like viewing a menu or confirming an order), you MUST include the corresponding interactive button from the RICH UI CAPABILITIES.
9. PROACTIVE CONFIRMATION: Once a user has added items to their cart, your VERY NEXT message MUST include the "🚀 Confirm Order" button.
`;

const PROFESSIONALISM_PROTOCOL = `
## TONE & VOICE
- Professional, helpful, and welcoming.
- No slang or overly casual language.
- Every response should be concise.
`;


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
        const { message, session_id, table_number, organization_id, organization_name, branch_id: clientBranchId, branch_name, is_verified } = body;

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
                orgPrompt = `\n\n## HISTORICAL CONTEXT (MAY BE OUTDATED)\n${orgData.chatbot_system_prompt}\n\n`;
            }
            if (orgData?.name) orgName = orgData.name;
        } catch (e) {
            console.warn("[CustomerAgent] Org config load failed:", e);
        }

        const activeBranchName = branch_name || "Unknown";
        const activeTable = table_number || "Unknown";
        
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

        // ── STEP 2: Construct Final System Prompt (STRICTEST RULES LAST) ──
        let systemPrompt = `You are the digital assistant for ${orgName}.
${orgPrompt}

${PROFESSIONALISM_PROTOCOL}

## CURRENT SESSION CONTEXT
- Restaurant: ${orgName}
- Branch: ${activeBranchName}
- Table (Claimed): ${activeTable}
- Session ID: ${session_id}
- Local Time: ${new Date().toLocaleTimeString()} (${timeOfDay})

${DEFAULT_SYSTEM_PROMPT}

## HARD_RESET & FINAL INSTRUCTIONS (CRITICAL)
- **NO ITEM NAMES**: Your response MUST NOT contain any food names, category names, or prices (e.g., "Burger", "Drinks", "100 ETB").
- **NO TEXT LISTS**: NEVER use tables, lists, or bullets to describe the menu.
- **GREETING ONLY**: Your text response should ONLY ever be a warm greeting or a confirmation (e.g., "Got it! You're at Table 5! ✅ Great to have you here! 🎉 Check out our menu:").
- **CAROUSEL IS AUTOMATIC**: The pictures and menu details are handled by a separate UI component that displays automatically when you call 'get_menu'. DO NOT try to describe them.
- **ONBOARDING**: Even if context shows a Table Number, you MUST ask the user to confirm it: "Welcome! To make sure I have the right spot, could you please confirm your table number? 😊"
- **MATCH GREETING**: When confirmed, use ONLY: "Got it! You're at Table [Number]! ✅ Great to have you here! 🎉 Now, what can I get you tonight? Check out our menu:"
`;

        // ── STEP 2: Load Customer Profile ──
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
                    customerContext = `\n## RETURNING CUSTOMER
- Name: ${profile.full_name || "Unknown"}
- Phone: ${profile.phone || "Unknown"}
- Visit #${profile.visit_count || 1}
- Preferences: ${JSON.stringify(profile.preferences || {})}
- Last Visit: ${profile.last_visit || "First time"}`;
                    
                    const { data: lastOrder } = await supabase
                        .from("orders")
                        .select("id, items")
                        .eq("customer_id", recentChat.customer_id)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();
                        
                    if (lastOrder && lastOrder.items) {
                        customerContext += `\n- Last Order Items: ${JSON.stringify(lastOrder.items)}\n- ACTION REQUIRED: Offer a "1-Click Reorder" of their previous items as the first thing you suggest! Call it "Your Usual".`;
                    }
                }
            }
        } catch (e) {
            console.warn("[CustomerAgent] Profile lookup failed:", e);
        }

        systemPrompt += customerContext;

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

        if ((history.length <= 1 && isGreeting(message)) || message.toLowerCase() === 'init_chat') {
            messages.push({ 
                role: "system", 
                content: `CRITICAL: First message must be 'Welcome to ${orgName}! 🌟' and ask for their table number. NEVER show the menu until you have the table number.`
            });
        }

        const availableTools = TOOL_DEFINITIONS;

        // ── STEP 4: Agentic Reasoning Loop ──
        const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        const openAIKey = Deno.env.get("OPENAI_API_KEY");

        let finalResponse = "";
        let attachments: any = null;
        let richMetadata: any = {};
        let loopCount = 0;
        const MAX_LOOPS = 5;

        while (loopCount < MAX_LOOPS) {
            loopCount++;
            let llmResult: any;

            try {
                if (openRouterKey) {
                    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${openRouterKey}`,
                        },
                        body: JSON.stringify({
                            model: "arcee-ai/trinity-large-preview:free",
                            messages,
                            tools: availableTools,
                            tool_choice: "auto",
                        }),
                        signal: globalController.signal,
                    });
                    if (!response.ok) throw new Error(`OpenRouter Error: ${await response.text()}`);
                    llmResult = await response.json();
                } else if (openAIKey) {
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
                    if (!response.ok) throw new Error(`OpenAI Error: ${await response.text()}`);
                    llmResult = await response.json();
                } else if (geminiKey) {
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
                            if (m.content) {
                                parts.push({ text: m.content });
                            }

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

                    if (!response.ok) throw new Error(`Gemini Error: ${await response.text()}`);
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
                }
            } catch (err: any) {
                console.error("[CustomerAgent] LLM Call Error:", err.message);
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
                    try { toolParams = JSON.parse(toolCall.function.arguments); } catch {}

                    let toolResult: any;
                    try {
                        toolResult = await executeMcpTool(supabase, toolName, toolParams, organizationId, branchId || "", table_number);
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
                    } else if (toolName === 'get_top_performing_items') {
                        richMetadata.top_performing_items = toolResult.items || toolResult || [];
                    } else if (toolName === 'get_categories') {
                        richMetadata.categories = toolResult.categories || toolResult || [];
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
                } catch {}
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
                    organization_id: organizationId,
                    branch_id: branchId,
                    role: "user",
                    content: message
                },
                {
                    session_id,
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
