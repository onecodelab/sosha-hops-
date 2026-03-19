import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, resolveIdentity } from "../_shared/identity.ts";

// ─── TOOL DEFINITIONS ───
const TOOL_DEFINITIONS = [
    {
        type: "function",
        function: {
            name: "get_menu",
            description: "Get the restaurant's menu items. Use when the customer asks 'what's for food', 'show menu', or 'what do you have'.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search for specific menu items" },
                    category: { type: "string", description: "Filter by category (e.g. 'burger', 'drinks')" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "place_order",
            description: "Place a new order for the customer. ALWAYS confirm items and get a TABLE NUMBER first.",
            parameters: {
                type: "object",
                properties: {
                    items: {
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
];

// ─── DEFAULT SYSTEM PROMPT ───
const DEFAULT_SYSTEM_PROMPT = `You are a polite, professional, and helpful restaurant assistant. You help customers browse the menu, place orders, track their food, and handle payments.`;

const RICH_UI_INSTRUCTIONS = `
## RICH UI CAPABILITIES
You can trigger interactive UI elements by including a JSON block at the end of your response. Use either \`\`\`json { ... } \`\`\` or [UI_CONTEXT: { ... }].

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
   - *Discovery Phase*: [{"label": "🍔 View Menu", "prompt": "Show me the menu"}, {"label": "🤩 What's Popular?", "prompt": "Show me popular items"}]
   - *Selection Phase*: [{"label": "🥗 Categories", "prompt": "Show me categories"}, {"label": "🛒 View Cart", "prompt": "Show my cart"}]
   - *Post-Placement*: [{"label": "📡 Track My Order", "prompt": "Where is my food?"}, {"label": "➕ Add More", "prompt": "Show menu"}, {"label": "🧾 Request Bill", "prompt": "Show my bill"}]

## YOUR RULES
1. **TABLE VERIFICATION**: You MUST call 'get_tables' at initialization. If the Table Number from CONTEXT does not match any 'table_number' in the list (e.g., if you see "#C1" but user is on "T1"), you MUST ask: "Welcome! I see you're starting an order, but I couldn't find your table on our map. Could you double-check the number on your table card? 😊"
2. **NO FORMATTING**: You are FORBIDDEN from using markdown characters like asterisks (*), underscores (_), or parentheses () to style your text. Keep all text plain and clean.
3. ALWAYS use the 'get_menu' tool when a customer asks about food. NEVER guess menu items.
4. Call 'update_customer_profile' when you learn something new about the customer.
5. ORDER WORKFLOW: After calling 'place_order', explain that it is "Sent for Approval" and that a "Waiter will confirm it shortly". NEVER say it is already in the kitchen.
6. Drink Pairings: As soon as a user adds a 'Main Course' (Burger, Steak, Fish), your next message MUST be: "Great choice! 🥩 Would you like a drink to go with that?" followed IMMEDIATELY by calling 'get_menu' with category="Drinks".
7. Deal of the Day: Always mention the "Happy Hour" deal in your first greeting.`;

const PROFESSIONALISM_PROTOCOL = `
## CRITICAL: PROFESSIONALISM & TONE
1. **NO SLANG**: Absolutely NO "bestie", "YOOO", "fr", etc.
2. **NO TEXT LISTS**: NEVER list menu items in text format. Do not use Markdown tables or bullet point lists for items. Let the Menu Carousel handle all the visuals.
3. **NO MARKDOWN**: Never use asterisks (*), underscores (_), brackets ([]), or parentheses (()) for formatting or emphasis. Style should be 100% plain text.
4. **CONCISENESS**: Keep messages extremely short.

## CONVERSATION FLOW PROTOCOL (MANDATORY)
1. **STEP 1: WELCOME & PROACTIVE MENU**
   - First interaction: Greet the customer warmly (e.g., "Welcome to [Restaurant Name]! 🌟") and ask for their table number. Use the Restaurant name provided in the CONTEXT section.
   - CALL 'get_tables' to verify the table context immediately.
   - IMMEDIATELY call 'get_menu' for the time-based category (Breakfast/Lunch/Dinner) as per CONTEXT. Do not wait for them to ask.
   - Mention the "Happy Hour" Deal of the Day.
2. **STEP 2: ADDING ITEMS & PAIRINGS**
   - When an item is added, send the COMPACT SUMMARY and total.
   - If it's a main course, IMMEDIATELY ask about drinks and call 'get_menu(category="Drinks")'.
3. **STEP 3: ORDER CONFIRMATION & APPROVAL**
   - After 'place_order', say: "Order sent for approval! 📡 A waiter will confirm it shortly so the kitchen can start cooking."
   - Provide the "Track My Order" quick reply button.
   - Provide a COMPACT text summary of active items only when confirming the final order (NO PRICES/LISTS in text).
   - Use UI_CONTEXT buttons for "Confirm Order".
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
        const catStr = toolParams?.category || "";
        const targetBranch = branchId || toolParams?.branch_id;

        console.log(`[MCP-LOCAL-MENU] Org: ${organizationId}, Branch: ${targetBranch}`);

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

        // Inject Promo/Deal card
        const promoItem = {
            id: "promo-deal",
            name: "🔥 Happy Hour: 20% OFF",
            price: 0,
            category: "Deal",
            image_url: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80",
            is_available: true,
            description: "20% off all appetizers until 6 PM! Click to see appetizers.",
            demand_status: "HOT DEAL"
        };

        console.log(`[MCP-LOCAL-MENU] Found ${items.length} items. Injecting promo.`);
        return { items: [promoItem, ...items] };
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

    console.log(`[MCP-CALL] Tool: ${toolName}, Org: ${organizationId}, Branch: ${branchId}, Params:`, JSON.stringify(requestBody.params));

    // Call the mcp-server function internally with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        const response = await fetch(`${sbUrl}/functions/v1/mcp-server`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")!}`,
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
        const globalTimeout = setTimeout(() => globalController.abort(), 25000);

        try {
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

        if (!message || !session_id) {
            clearTimeout(globalTimeout);
            return new Response(
                JSON.stringify({ error: "message and session_id are required" }),
                { status: 400, headers: corsHeaders }
            );
        }

        // ── STEP 1: Load System Prompt ──
        let basePrompt = DEFAULT_SYSTEM_PROMPT;
        let orgName = organization_name || "Unknown";
        try {
            const { data: orgData } = await supabase
                .from("organizations")
                .select("chatbot_system_prompt, name")
                .eq("id", organizationId)
                .single();

            if (orgData?.chatbot_system_prompt?.trim()) {
                basePrompt = orgData.chatbot_system_prompt;
            }
            if (orgData?.name) orgName = orgData.name;
        } catch (e) {
            console.warn("[CustomerAgent] Org config load failed:", e);
        }

        const activeBranchName = branch_name || "Unknown";
        const activeTable = table_number || "Unknown";
        
        // Setup proactive variables
        const now = new Date();
        const hour = now.getHours();
        let timeOfDay = "Evening";
        let timeBasedMenuContext = "Display a 'Dinner & Drinks' carousel highlighting signature entrees and cocktails.";
        if (hour >= 6 && hour < 11) {
            timeOfDay = "Morning";
            timeBasedMenuContext = "Display a 'Breakfast Specials' carousel featuring coffee, pastries, and light meals.";
        } else if (hour >= 11 && hour < 16) {
            timeOfDay = "Afternoon";
            timeBasedMenuContext = "Display a 'Lunch Deals' carousel with quick-serve items and combos.";
        }
        const promoDeal = "Happy Hour: 20% off all appetizers! Call 'get_menu' for appetizers to show the Deal of the Day carousel.";

        let systemPrompt = `${basePrompt}
${RICH_UI_INSTRUCTIONS}
${PROFESSIONALISM_PROTOCOL}

## CONTEXT
- Restaurant: ${orgName}
- Branch: ${activeBranchName}
- Table Number: ${activeTable}
- Session ID: ${session_id}
- Date: ${now.toLocaleDateString()}
- Current Time: ${now.toLocaleTimeString()} (${timeOfDay})

## PROACTIVE FEATURES REQUIRED
- **Time of Day (${timeOfDay})**: ${timeBasedMenuContext}
- **Deal of the Day**: ${promoDeal}`;

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
                content: `CRITICAL: First message must be 'Welcome to BOLE MICHEAL! 🌟' and ask for their table number. Immediately call 'get_menu' for ${timeOfDay} items. feature the Happy Hour deal.`
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
                            model: "openrouter/hunter-alpha",
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
                finalResponse = "I'm having a bit of trouble reaching my knowledge right now. Could you please try again in a moment? 🍽️";
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
                    { label: "❓ Where is my table?", prompt: "Where can I find my table number?" }
                ];
            } else if (attachments?.type === 'menu' || lowerResp.includes("menu") || lowerResp.includes("set")) {
                richMetadata.buttons = [
                    { label: "📖 View Full Menu", prompt: "Show me the entire menu" },
                    { label: "🥘 Chef's Specials", prompt: "What do you recommend?" }
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
                    { label: "📖 View Menu", prompt: "Show me the menu" },
                    { label: "🥘 Chef's Specials", prompt: "What do you recommend?" }
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
