import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, resolveIdentity } from "../_shared/identity.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Use service role for consistent lookup
        const supabase = createClient(sbUrl, sbKey);

        // 1. Resolve Identity (Standard JWT or Signed Branch Token)
        const identity = await resolveIdentity(req, supabase);
        if (!identity) {
            return new Response(JSON.stringify({ error: "Unauthorized", detail: "Invalid or missing token" }), { status: 401, headers: corsHeaders });
        }

        const { organizationId, branchId: tokenBranchId } = identity;

        const payload = await req.json();
        const branch_id = tokenBranchId || payload.branch_id;

        if (!branch_id) {
            return new Response(JSON.stringify({ error: "Missing branch_id" }), { status: 400, headers: corsHeaders });
        }

        // 2. Fetch Branch (with isolation check)
        const { data: branch, error: branchErr } = await supabase
            .from('branches')
            .select('*')
            .eq('id', branch_id)
            .eq('organization_id', organizationId)
            .single();

        if (branchErr || !branch) {
            return new Response(JSON.stringify({ error: "Branch not found" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404,
            });
        }

        // SACRED RULE: Tenant Isolation
        if (branch.organization_id !== organizationId) {
            console.error(`[SECURITY ALERT] Tenant Mismatch! User Org: ${organizationId}, Branch Org: ${branch.organization_id}`);
            return new Response(JSON.stringify({ error: "Tenant isolation violation" }), { status: 403, headers: corsHeaders });
        }

        const { data: organization } = await supabase
            .from('organizations')
            .select('id, name, chatbot_logo_url')
            .eq('id', branch.organization_id)
            .maybeSingle();

        // 2. Get active bank accounts for this organization
        const { data: bankAccounts, error: bankErr } = await supabase
            .from('bank_settings')
            .select('bank_key, account_number')
            .eq('organization_id', branch.organization_id)
            .eq('is_active', true);

        if (bankErr) {
            console.error("[get-branch-info] Bank fetch error:", bankErr);
        }

        // 3. Filter out banks with empty account numbers
        const activeBanks = (bankAccounts || []).filter(b => b.account_number && b.account_number.trim() !== '');

        // 4. Format for the chatbot
        const bankInfo = activeBanks.map(b => ({
            bank: b.bank_key,
            account: b.account_number,
            display_name: {
                'cbe': 'Commercial Bank of Ethiopia (CBE)',
                'telebirr': 'Telebirr',
                'abyssinia': 'Bank of Abyssinia',
                'dashen': 'Dashen Bank',
                'cbebirr': 'CBE Birr',
            }[b.bank_key] || b.bank_key
        }));

        return new Response(JSON.stringify({
            success: true,
            organization: organization ? {
                id: organization.id,
                name: organization.name,
                chatbot_logo_url: organization.chatbot_logo_url || null,
            } : null,
            branch: {
                id: branch.id,
                name: branch.name,
                location: branch.location,
            },
            payment_methods: bankInfo,
            message: bankInfo.length > 0
                ? `We accept payments via: ${bankInfo.map(b => b.display_name).join(', ')}.`
                : "No payment methods configured for this branch. Please ask the waiter."
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("[get-branch-info] Error:", error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
});
