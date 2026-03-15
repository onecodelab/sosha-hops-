import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── AGENTIC REASONING LOOP ───
async function runReasoningLoop(
    supabase: any,
    organizationId: string,
    branchId: string | null,
    messages: any[],
    apiKey: string,
    apiType: 'openrouter' | 'gemini' | 'openai'
) {
    let currentMessages = [...messages];
    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
        iterations++;
        console.log(`[MasterAgent] Iteration ${iterations}...`);

        let response: any;
        if (apiType === 'openrouter') {
            response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "X-Title": "Baro Intelligence Hub"
                },
                body: JSON.stringify({
                    model: "openrouter/hunter-alpha",
                    messages: currentMessages,
                    tools: [
                        { type: "function", function: { name: "get_financial_summary", description: "Get revenue and order summary for today vs yesterday." } },
                        { type: "function", function: { name: "get_staff_performance", description: "Get top 5 staff members by revenue.", parameters: { type: "object", properties: { limit: { type: "integer" } } } } },
                        { type: "function", function: { name: "get_inventory_risks", description: "Get items that are below their minimum alert threshold." } },
                        { type: "function", function: { name: "get_intelligence_events", description: "Get latest system-generated intelligence events.", parameters: { type: "object", properties: { limit: { type: "integer" } } } } },
                        { type: "function", function: { name: "get_menu", description: "Search the menu for pricing or margin information.", parameters: { type: "object", properties: { query: { type: "string" } } } } }
                    ],
                    tool_choice: "auto"
                })
            });
        } else if (apiType === 'openai') {
            response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: currentMessages,
                    tools: [
                        { type: "function", function: { name: "get_financial_summary", description: "Get revenue and order summary for today vs yesterday." } },
                        { type: "function", function: { name: "get_staff_performance", description: "Get top 5 staff members by revenue." } },
                        { type: "function", function: { name: "get_inventory_risks", description: "Get items below alert levels." } },
                        { type: "function", function: { name: "get_intelligence_events", description: "List operation events." } }
                    ]
                })
            });
        }
        
        // Note: Gemini tool calling skipped for brevity in this refactor unless explicitly needed. 
        // We prioritize OpenRouter/OpenAI for function calling stability.

        if (!response.ok) throw new Error(`AI API Error: ${await response.text()}`);
        const result = await response.json();
        const assistantMessage = result.choices[0].message;
        currentMessages.push(assistantMessage);

        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
            return assistantMessage.content;
        }

        // Handle tool calls
        for (const toolCall of assistantMessage.tool_calls) {
            const { name, arguments: argsString } = toolCall.function;
            const args = JSON.parse(argsString || '{}');
            console.log(`[MasterAgent] Executing tool: ${name}`, args);

            const mcpResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-server`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    "x-org-id": organizationId,
                    "x-branch-id": branchId || ''
                },
                body: JSON.stringify({ tool: name, params: { ...args, branch_id: branchId } })
            });

            const toolResult = await mcpResponse.json();
            currentMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult.success ? toolResult.result : { error: toolResult.error })
            });
        }
    }
    return "I reached my reasoning limit. Please try asking a more specific question.";
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error("Missing authorization header");

        const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userErr } = await authClient.auth.getUser();
        if (userErr || !user) throw new Error("Unauthorized");

        const { action, payload, organization_id, branch_id } = await req.json();

        const { data: profile } = await supabase.from('profiles').select('organization_id, role, full_name').eq('id', user.id).single();
        if (!profile) throw new Error("Profile not found");

        if (organization_id && organization_id !== profile.organization_id) throw new Error("Tenant isolation violation");
        if (!['owner', 'admin', 'manager'].includes(profile.role)) throw new Error("Insufficient permissions");

        const resolvedOrgId = profile.organization_id;

        if (action === 'chat') {
            const { question } = payload;
            
            // 1. Fetch History
            const { data: historyData } = await supabase.from('chat_memory')
                .select('role, content')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(6);
            
            const history = historyData ? historyData.reverse() : [];

            // 2. Prepare System Prompt
            const systemPrompt = `You are Baro Intelligence, a top-tier Restaurant Operations AI Assistant answering to ${profile.full_name || 'the owner'}.
Traits: Analytical, proactive, efficient.
Goal: Provide business insights and manage operations (Inventory, Staff, Financials).
Guidelines:
- Use markdown. Bold for metrics.
- DO NOT hallucinate. Use help from tools to fetch live data.
- If you present metrics, ALWAYS output a JSON card carousel:
{"cards":[{"title":"Revenue","description":"ETB 4500","icon":"dollar-sign"}]}
- If you notice a risk (low stock, low margin), suggest a proposal.`;

            const messages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: question }];

            // 3. Run Loop
            const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
            const openAIKey = Deno.env.get('OPENAI_API_KEY');
            
            const responseText = await runReasoningLoop(
                supabase,
                resolvedOrgId,
                branch_id || null,
                messages,
                openRouterKey || openAIKey || '',
                openRouterKey ? 'openrouter' : 'openai'
            );

            // 4. Save History
            await supabase.from('chat_memory').insert([
                { user_id: user.id, organization_id: resolvedOrgId, branch_id: branch_id || null, role: 'user', content: question },
                { user_id: user.id, organization_id: resolvedOrgId, branch_id: branch_id || null, role: 'assistant', content: responseText }
            ]);

            return new Response(JSON.stringify({ text: responseText }), { headers: corsHeaders, status: 200 });
        }

        return new Response(JSON.stringify({ error: "Action not supported" }), { headers: corsHeaders, status: 400 });

    } catch (error: any) {
        console.error('[MasterAgent] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 });
    }
});


