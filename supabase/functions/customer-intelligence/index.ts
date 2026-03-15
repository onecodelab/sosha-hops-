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
];

// ─── DEFAULT SYSTEM PROMPT ───
const DEFAULT_SYSTEM_PROMPT = `You are a POLITE, PROFESSIONAL, AND HELPFUL restaurant assistant. Your goal is to make ordering fast, visual, and pleasant.

## PROFESSIONALISM PROTOCOL
1. **No Slang**: DO NOT use words like "YOOO", "bestie", "naurrr", or "slap". Maintain a respectful, warm, and professional tone at all times.
2. **Never Hallucinate Menu Items**: If 'get_menu' returns empty or fails, politely inform the customer and suggest speaking to a waiter. DO NOT offer specific categories (like drinks or desserts) unless you have confirmed they exist.
3. **Be Proactive**: Don't just wait; offer to show the menu or current specials immediately upon greeting.
4. **Lead with Visuals**: For every greeting or menu query, you MUST return a 'metadata' block with 'buttons' and ideally trigger 'get_menu'.
5. **Fast Checkout**: Once they add items, show a "🧾 View Bill" or "💳 Pay Now" button.

## RICH UI SPECIFICATION (Include in your JSON block)
Include a JSON block at the end of your response for metadata.
- "buttons": Array of { label, prompt } (Pulsing 1-tap fast actions)
- "tracking": { "status": "placed" | "preparing" | "ready" | "delivered" }
- "pills": Array of strings (Category filters based ONLY on the actual menu)
- "splitter": { "total": number }
- "rating": { "type": "stars" }

Example:
\`\`\`json
{
  "buttons": [{"label": "📖 Show Full Menu", "prompt": "Show me the menu"}],
  "pills": ["Show All"]
}
\`\`\`

## YOUR RULES
1. ALWAYS use the 'get_menu' tool for food/menu queries.
2. If Table Number is 'Unknown', ask for it before placing an order.
3. Be visual-first. Format menu items clearly with prices.
4. Support Amharic and Arabic if you detect the script.`;

// ─── MCP TOOL EXECUTOR ───
async function executeMcpTool(
    supabase: any,
    toolName: string,
    toolParams: any,
    organizationId: string,
    branchId: string,
    tableNumber?: string
): Promise<any> {
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Call the mcp-server function internally
    const response = await fetch(`${sbUrl}/functions/v1/mcp-server`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sbKey}`,
        },
        body: JSON.stringify({
            tool: toolName,
            params: { 
                ...toolParams, 
                organization_id: organizationId,
                branch_id: branchId,
                table_number: toolParams.table_number || tableNumber
            },
        }),
    });

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error || `Tool ${toolName} failed`);
    }
    return data.result;
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
        const { message, session_id, table_number, organization_id, branch_id: clientBranchId } = body;

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
            return new Response(
                JSON.stringify({ error: "Unauthorized", detail: "Could not resolve organization context" }),
                { status: 401, headers: corsHeaders }
            );
        }

        if (!message || !session_id) {
            return new Response(
                JSON.stringify({ error: "message and session_id are required" }),
                { status: 400, headers: corsHeaders }
            );
        }

        // ── STEP 1: Load System Prompt ──
        let systemPrompt = DEFAULT_SYSTEM_PROMPT;
        try {
            const { data: orgData } = await supabase
                .from("organizations")
                .select("chatbot_system_prompt, name")
                .eq("id", organizationId)
                .single();

            if (orgData?.chatbot_system_prompt?.trim()) {
                systemPrompt += `\n\n## CUSTOM RESTAURANT INSTRUCTIONS\n${orgData.chatbot_system_prompt}`;
            }

            const activeTable = table_number || "Unknown";
            systemPrompt += `\n\n## CONTEXT
- Restaurant: ${orgData?.name || "Unknown"}
- Branch ID: ${branchId}
- Table Number: ${activeTable}
- Session ID: ${session_id}
- Date: ${new Date().toLocaleDateString()}`;
        } catch (e) {
            console.warn("[CustomerAgent] Org config load failed:", e);
        }

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
                .select("role, content, metadata")
                .eq("session_id", session_id)
                .order("created_at", { ascending: false })
                .limit(20);

            if (historyData) {
                // Map history and include metadata text for LLM context
                history = historyData.reverse().map(h => ({
                    role: h.role,
                    content: h.role === 'assistant' && h.metadata ? `${h.content}\n[UI_CONTEXT: ${JSON.stringify(h.metadata)}]` : h.content
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
            const greetings = ['hey', 'hello', 'hi', 'start', 'menu', 'hola', 'yo'];
            return greetings.includes(lower) || lower.length < 3;
        };

        if (history.length <= 1 && isGreeting(message)) {
            messages.push({ 
                role: "system", 
                content: "CRITICAL: First interaction. You MUST be proactive. CALL 'get_menu' NOW to show the menu. Also provide buttons for 'View Full Menu'." 
            });
        }

        // ── STEP 4: Agentic Reasoning Loop ──
        const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        const openAIKey = Deno.env.get("OPENAI_API_KEY");

        let finalResponse = "";
        let attachments: any = null;
        let loopCount = 0;
        const MAX_LOOPS = 5;

        while (loopCount < MAX_LOOPS) {
            loopCount++;
            let llmResult: any;

            if (openRouterKey) {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${openRouterKey}`,
                    },
                    body: JSON.stringify({
                        model: "openrouter/hunter-alpha",
                        messages,
                        tools: TOOL_DEFINITIONS,
                        tool_choice: "auto",
                    }),
                });
                if (!response.ok) throw new Error(`OpenRouter Error: ${await response.text()}`);
                llmResult = await response.json();
            } else if (openAIKey) {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${openAIKey}`,
                    },
                    body: JSON.stringify({
                        model: "gpt-4o-mini",
                        messages,
                        tools: TOOL_DEFINITIONS,
                    }),
                });
                if (!response.ok) throw new Error(`OpenAI Error: ${await response.text()}`);
                llmResult = await response.json();
            } else if (geminiKey) {
                const contents = messages
                    .filter((m) => m.role !== "system")
                    .map((m) => {
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
                        if (m.role === "tool") {
                            let res: any;
                            try { res = JSON.parse(m.content); } catch { res = { result: m.content }; }
                            return {
                                role: "user",
                                parts: [{ functionResponse: { name: m.name, response: res } }]
                            };
                        }
                        return { role: m.role === "assistant" ? "model" : "user", parts };
                    });

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            system_instruction: { parts: [{ text: systemPrompt }] },
                            contents,
                            tools: [{ function_declarations: TOOL_DEFINITIONS.map(td => td.function) }],
                            tool_config: { function_calling_config: { mode: "AUTO" } }
                        }),
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

                    // Capture menu results for carousel
                    if (toolName === 'get_menu' && toolResult?.items) {
                        attachments = { type: 'menu', data: toolResult.items };
                    }
                }
                continue;
            }

            finalResponse = assistantMessage.content || "I'm not sure how to help with that.";
            break;
        }

        // ── STEP 5: Extract Metadata & Cleanup Response ──
        let richMetadata: any = {};

        // Robust JSON Extraction
        const jsonRegex = /```json\s*(\{[\s\S]*?\})\s*```|(\{[\s\S]*?\"(buttons|tracking|pills|splitter|rating)\"[\s\S]*?\})/;
        const jsonMatch = finalResponse.match(jsonRegex);
        
        if (jsonMatch) {
            try {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                const extracted = JSON.parse(jsonStr);
                richMetadata = { ...extracted };
                // Remove JSON from text
                finalResponse = finalResponse.replace(jsonMatch[0], "").trim();
            } catch (e) {
                console.warn("[CustomerAgent] Metadata parse failed:", e);
            }
        }

        // ── PROACTIVE FALLBACKS ──
        if (!richMetadata.buttons && !richMetadata.tracking) {
            const lowerResp = finalResponse.toLowerCase();
            if (attachments?.type === 'menu' || lowerResp.includes("menu") || lowerResp.includes("welcome")) {
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
                 // Universal Proactive Buttons
                 richMetadata.buttons = [
                    { label: "📖 View Menu", prompt: "Show me the menu" },
                    { label: "🥘 Chef's Specials", prompt: "What do you recommend?" }
                ];
            }
        }

        // Ensure finalResponse is never empty
        if (!finalResponse.trim()) {
            finalResponse = attachments ? "I've pulled up the menu for you below!" : "How can I assist you with your order today?";
        }

        // Merge with tool attachments
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

        return new Response(JSON.stringify({ 
            text: finalResponse, 
            response: finalResponse, // Backward compatibility
            metadata: richMetadata 
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
