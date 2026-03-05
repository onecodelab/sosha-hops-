import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
        console.log('[MasterAgent] URL present:', !!supabaseUrl, 'ServiceKey present:', !!supabaseServiceKey, 'ServiceKey length:', supabaseServiceKey.length);
        const supabase = createClient(supabaseUrl, supabaseServiceKey);


        const authHeader = req.headers.get('Authorization');
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userErr } = await authClient.auth.getUser();
        console.log('[MasterAgent] User auth result:', user?.id || 'NO_USER', 'Error:', userErr?.message || 'none');
        if (userErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized', detail: userErr?.message || 'No user found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        const { action, payload, organization_id, branch_id } = await req.json();

        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        console.log('[MasterAgent] Profile lookup:', profile?.role || 'NO_PROFILE', 'Error:', profileErr?.message || 'none');

        if (profileErr || !profile) {
            throw new Error(`Profile not found: ${profileErr?.message || 'No profile for user ' + user.id}`);
        }

        if (organization_id && organization_id !== profile.organization_id) {
            throw new Error('Tenant isolation violation');
        }

        if (!['owner', 'admin', 'manager'].includes(profile.role)) {
            throw new Error('Insufficient permissions');
        }

        const resolvedOrganizationId = profile.organization_id;

        // Validate branch_id if provided (soft check — don't crash for chat)
        let validatedBranchId = branch_id;
        if (branch_id) {
            const { data: branchData } = await supabase
                .from('branches')
                .select('id')
                .eq('id', branch_id)
                .eq('organization_id', resolvedOrganizationId)
                .maybeSingle();

            if (!branchData) {
                console.warn('[MasterAgent] Branch not found for this org, falling back to org-wide mode. branch_id:', branch_id);
                validatedBranchId = null; // Fall back to org-wide mode instead of crashing
            }
        }

        // ------------------------------------------------------------------
        // CONTEXT RETRIEVAL (The "Truth Backbone")
        // ------------------------------------------------------------------
        const fetchContext = async () => {
            const context = { risks: [] as any[], low_margin_items: [] as any[], recent_events: [] as any[] };
            try {
                // 1. Inventory Risks
                const { data: riskData, error: riskErr } = await supabase.from('view_inventory_risks').select('*').limit(5);
                if (riskErr) console.warn('[MasterAgent] Risk view error (may not exist):', riskErr.message);
                context.risks = riskData || [];
            } catch (e) { console.warn('[MasterAgent] Risk fetch failed:', e); }

            try {
                // 2. Menu Financials - only if branch_id is provided
                if (validatedBranchId) {
                    const { data: menuData, error: menuErr } = await supabase.from('view_menu_details')
                        .select('name, margin_percent, is_available')
                        .eq('branch_id', validatedBranchId)
                        .order('margin_percent', { ascending: true })
                        .limit(5);
                    if (menuErr) console.warn('[MasterAgent] Menu view error (may not exist):', menuErr.message);
                    context.low_margin_items = menuData || [];
                }
            } catch (e) { console.warn('[MasterAgent] Menu fetch failed:', e); }

            try {
                // 3. Recent Intelligence Events
                const { data: eventsData, error: eventsErr } = await supabase.from('intelligence_events')
                    .select('*')
                    .eq('organization_id', resolvedOrganizationId)
                    .order('created_at', { ascending: false })
                    .limit(3);
                if (eventsErr) console.warn('[MasterAgent] Events error (may not exist):', eventsErr.message);
                context.recent_events = eventsData || [];
            } catch (e) { console.warn('[MasterAgent] Events fetch failed:', e); }

            console.log('[MasterAgent] Context loaded:', JSON.stringify({ risks: context.risks.length, menu: context.low_margin_items.length, events: context.recent_events.length }));
            return context;
        };

        if (action === 'proactive_analyze') {
            const { event_type, data } = payload;
            console.log(`[MasterAgent] Proactively analyzing ${event_type}...`);

            const context = await fetchContext();

            const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
            const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

            const systemPrompt = "You are the Baro Master Agent. Analyze the event in the context of the business 'Truth' provided and suggest a proposal.";
            const promptStr = `Event: ${event_type}. Payload: ${JSON.stringify(data)}. Global Context: ${JSON.stringify(context)}. Suggest a proposal.`;

            let aiResponseText = "";

            if (geminiApiKey) {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `System Instructions:\n${systemPrompt}\n\nTask:\n${promptStr}` }] }]
                    })
                });
                if (!response.ok) throw new Error(`Gemini API Error: ${await response.text()}`);
                const result = await response.json();
                aiResponseText = result.candidates[0].content.parts[0].text;
            } else if (openAIApiKey) {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${openAIApiKey}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o-mini",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: promptStr }
                        ]
                    })
                });
                if (!response.ok) throw new Error(`OpenAI API Error: ${await response.text()}`);
                const result = await response.json();
                aiResponseText = result.choices[0].message.content;
            } else {
                throw new Error("No AI API key configured! Please add GEMINI_API_KEY or OPENAI_API_KEY to your Supabase secrets.");
            }

            return new Response(JSON.stringify({ success: true, suggestion: aiResponseText }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });

        } else if (action === 'chat') {
            const { question, owner_name, branch_context, all_branches } = payload;
            console.log(`[MasterAgent] Chat: ${question}`);

            // Always inject the "Truth" into the chat context
            const context = await fetchContext();

            const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
            const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

            const systemPrompt = `You are Baro Intelligence, a top-tier Restaurant Operations AI Assistant answering directly to the owner, ${owner_name || 'Amir'}.
            
Your traits:
- Professional, analytical, proactive, and concise. You sound like a direct business advisor helping an owner run their restaurants.
- Use markdown formatting. Use bold text for key metrics.
- Do not make up data! Answer ONLY based on the LIVE BUSINESS TRUTH provided.
- You have oversight of ${all_branches ? "all branches" : "this specific branch"}.

${branch_context ? `BRANCH SNAPSHOT OVERVIEW:\n${branch_context}\n` : ""}

LIVE BUSINESS TRUTH DATA:
Inventory Risks: ${JSON.stringify(context.risks)}
Low Margins: ${JSON.stringify(context.low_margin_items)}
Recent Events: ${JSON.stringify(context.recent_events)}`;

            let aiResponseText = "";

            if (geminiApiKey) {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `System Context:\n${systemPrompt}\n\nOwner's Prompt: ${question}` }] }]
                    })
                });
                if (!response.ok) throw new Error(`Gemini API Error: ${await response.text()}`);
                const result = await response.json();
                aiResponseText = result.candidates[0].content.parts[0].text;
            } else if (openAIApiKey) {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${openAIApiKey}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o-mini",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: question }
                        ]
                    })
                });
                if (!response.ok) throw new Error(`OpenAI API Error: ${await response.text()}`);
                const result = await response.json();
                aiResponseText = result.choices[0].message.content;
            } else {
                throw new Error("No AI API key configured! Please add GEMINI_API_KEY or OPENAI_API_KEY to your Supabase edge function secrets.");
            }

            return new Response(JSON.stringify({ text: aiResponseText }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        throw new Error("Invalid action provided");

    } catch (error: any) {
        console.error('[MasterAgent] CRITICAL ERROR:', error.message, error.stack);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
})
