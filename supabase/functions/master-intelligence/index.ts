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
            const context = {
                risks: [] as any[],
                low_margin_items: [] as any[],
                recent_events: [] as any[],
                staff_performance: [] as any[],
                financial_summary: {} as any
            };

            try {
                // 1. Inventory Risks
                const { data: riskData, error: riskErr } = await supabase.from('view_inventory_risks').select('*').limit(5);
                if (riskErr) console.warn('[MasterAgent] Risk view error:', riskErr.message);
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
                    if (menuErr) console.warn('[MasterAgent] Menu view error:', menuErr.message);
                    context.low_margin_items = menuData || [];
                }
            } catch (e) { console.warn('[MasterAgent] Menu fetch failed:', e); }

            try {
                // 3. Staff Performance (Top 3)
                const { data: staffData, error: staffErr } = await supabase.from('staff_performance_daily')
                    .select('staff_name, revenue_attributed, orders_completed')
                    .eq('organization_id', resolvedOrganizationId)
                    .order('revenue_attributed', { ascending: false })
                    .limit(3);
                if (staffErr) console.warn('[MasterAgent] Staff performance error:', staffErr.message);
                context.staff_performance = staffData || [];
            } catch (e) { console.warn('[MasterAgent] Staff fetch failed:', e); }

            try {
                // 4. Financial Summary (Today vs Yesterday)
                const today = new Date().toISOString().split('T')[0];
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

                const { data: todayOrders } = await supabase.from('orders')
                    .select('total_amount')
                    .eq('organization_id', resolvedOrganizationId)
                    .gte('created_at', today)
                    .not('status', 'eq', 'cancelled');

                const { data: yesterdayOrders } = await supabase.from('orders')
                    .select('total_amount')
                    .eq('organization_id', resolvedOrganizationId)
                    .gte('created_at', yesterday)
                    .lt('created_at', today)
                    .not('status', 'eq', 'cancelled');

                context.financial_summary = {
                    today_revenue: todayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
                    today_orders: todayOrders?.length || 0,
                    yesterday_revenue: yesterdayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
                    yesterday_orders: yesterdayOrders?.length || 0
                };
            } catch (e) { console.warn('[MasterAgent] Financial summary failed:', e); }

            try {
                // 5. Recent Intelligence Events
                const { data: eventsData, error: eventsErr } = await supabase.from('intelligence_events')
                    .select('*')
                    .eq('organization_id', resolvedOrganizationId)
                    .order('created_at', { ascending: false })
                    .limit(3);
                if (eventsErr) console.warn('[MasterAgent] Events error:', eventsErr.message);
                context.recent_events = eventsData || [];
            } catch (e) { console.warn('[MasterAgent] Events fetch failed:', e); }

            console.log('[MasterAgent] Context loaded:', JSON.stringify({
                risks: context.risks.length,
                menu: context.low_margin_items.length,
                staff: context.staff_performance.length,
                financials: !!context.financial_summary
            }));
            return context;
        };

        if (action === 'proactive_analyze' || action === 'chat') {
            const isChat = action === 'chat';
            const { question, owner_name, branch_context, all_branches, event_type, data: eventData, attachments } = payload || {};

            console.log(`[MasterAgent] ${isChat ? 'Chat' : 'Analyzing'}: ${isChat ? question : event_type}. Attachments: ${attachments?.length || 0}`);

            const context = await fetchContext();

            const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
            const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
            const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

            const systemPrompt = `You are Baro Intelligence, a top-tier Restaurant Operations AI Assistant answering directly to the owner, ${owner_name || 'Amir'}.
            
Your traits:
- Professional, analytical, proactive, and concise.
- Use markdown for communication. Use bold for metrics.
- DO NOT MAKE UP DATA. Use ONLY the LIVE BUSINESS TRUTH.

PROPOSAL GENERATION:
If you identify an optimization (e.g., restocking, waste reduction, staff shift change), include a structured JSON block at the end of your message.
Format:
{
  "proposal_type": "procurement" | "waste" | "schedule" | "policy_change" | "pricing",
  "reasoning": "Quick explanation for the owner",
  "confidence": 0.0-1.0,
  "impact_score": 0.0-1.0,
  "risk_financial": 0.0-1.0,
  "risk_fraud": 0.0-1.0,
  "risk_operational": 0.0-1.0,
  "risk_reputational": 0.0-1.0,
  "opt_profit": 0.0-1.0,
  "opt_staff_fatigue": 0.0-1.0,
  "opt_customer_satisfaction": 0.0-1.0,
  "opt_resilience": 0.0-1.0,
  "data": { ...type specific data... }
}

LIVE BUSINESS TRUTH DATA:
Financials: Today ETB ${context.financial_summary.today_revenue} (${context.financial_summary.today_orders} orders) vs Yesterday ETB ${context.financial_summary.yesterday_revenue}.
Inventory Risks: ${JSON.stringify(context.risks)}
Low Margins: ${JSON.stringify(context.low_margin_items)}
Top Staff Performance: ${JSON.stringify(context.staff_performance)}
Recent Events: ${JSON.stringify(context.recent_events)}`;

            const promptStr = isChat ? question : `Event: ${event_type}. Payload: ${JSON.stringify(eventData)}. Global Context: ${JSON.stringify(context)}. Suggest a proposal.`;

            let aiResponseText = "";

            if (openRouterApiKey) {
                console.log('[MasterAgent] Using OpenRouter...');
                const messages: any[] = [
                    { role: "system", content: systemPrompt }
                ];

                const userContent: any[] = [{ type: "text", text: promptStr }];

                if (attachments && attachments.length > 0) {
                    attachments.forEach((att: any) => {
                        if (att.type.startsWith('image/')) {
                            userContent.push({
                                type: "image_url",
                                image_url: { url: `data:${att.type};base64,${att.data}` }
                            });
                        }
                    });
                }

                messages.push({ role: "user", content: userContent });

                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${openRouterApiKey}`,
                        "X-Title": "Baro Intelligence Hub"
                    },
                    body: JSON.stringify({
                        model: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
                        messages: messages
                    })
                });
                if (!response.ok) throw new Error(`OpenRouter API Error: ${await response.text()}`);
                const result = await response.json();
                aiResponseText = result.choices[0].message.content;
            } else if (geminiApiKey) {
                console.log('[MasterAgent] Using Gemini...');
                const contents: any[] = [];
                const parts: any[] = [{ text: `System Context:\n${systemPrompt}\n\nTask:\n${promptStr}` }];

                if (attachments && attachments.length > 0) {
                    attachments.forEach((att: any) => {
                        if (att.type.startsWith('image/')) {
                            parts.push({
                                inline_data: {
                                    mime_type: att.type,
                                    data: att.data
                                }
                            });
                        }
                    });
                }

                contents.push({ parts });

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents })
                });
                if (!response.ok) throw new Error(`Gemini API Error: ${await response.text()}`);
                const result = await response.json();
                aiResponseText = result.candidates[0].content.parts[0].text;
            } else if (openAIApiKey) {
                console.log('[MasterAgent] Using OpenAI...');
                const messages: any[] = [
                    { role: "system", content: systemPrompt }
                ];

                const userContent: any[] = [{ type: "text", text: promptStr }];

                if (attachments && attachments.length > 0) {
                    attachments.forEach((att: any) => {
                        if (att.type.startsWith('image/')) {
                            userContent.push({
                                type: "image_url",
                                image_url: { url: `data:${att.type};base64,${att.data}` }
                            });
                        }
                    });
                }

                messages.push({ role: "user", content: userContent });

                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${openAIApiKey}`
                    },
                    body: JSON.stringify({
                        model: "gpt-4o-mini",
                        messages: messages
                    })
                });
                if (!response.ok) throw new Error(`OpenAI API Error: ${await response.text()}`);
                const result = await response.json();
                aiResponseText = result.choices[0].message.content;
            } else {
                throw new Error("No AI API key configured! Please add OPENROUTER_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY to your Supabase secrets.");
            }

            return new Response(JSON.stringify(isChat ? { text: aiResponseText } : { success: true, suggestion: aiResponseText }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        } else if (action === 'create_proposal') {
            const { proposal_data } = payload;
            console.log(`[MasterAgent] Creating proposal: ${proposal_data.proposal_type}`);

            const { data, error: insertErr } = await supabase
                .from('proposals')
                .insert([{
                    ...proposal_data,
                    organization_id: resolvedOrganizationId,
                    branch_id: validatedBranchId || proposal_data.branch_id,
                    actor_type: 'agent',
                    actor_id: 'master-intelligence',
                    status: 'pending'
                }])
                .select()
                .single();

            if (insertErr) throw insertErr;

            return new Response(JSON.stringify({ success: true, proposal: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        throw new Error("Invalid action provided");

    } catch (error: any) {
        console.error('[MasterAgent] CRITICAL ERROR:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
})


