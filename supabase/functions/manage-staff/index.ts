import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );


        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
        }

        const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userErr } = await authClient.auth.getUser();
        if (userErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }
        const { action, staff_data, target_id, branch_id, organization_id: input_org_id } = await req.json();
        // action: 'list', 'create', 'update', 'delete'

        if (!action) {
            return new Response(JSON.stringify({ error: "Missing required field: action" }), { status: 400, headers: corsHeaders });
        }

        // 1. Authorization Check (Must be Owner/Manager)
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        const userRole = profile?.role?.toLowerCase();
        if (profileErr || !['owner', 'admin'].includes(userRole)) {
            return new Response(JSON.stringify({ error: `Unauthorized. Role: ${profile?.role}` }), { status: 403, headers: corsHeaders });
        }

        // SACRED RULE: Tenant Isolation
        const organizationId = profile.organization_id;
        if (input_org_id && input_org_id !== organizationId) {
            return new Response(JSON.stringify({ error: "Tenant isolation violation" }), { status: 403, headers: corsHeaders });
        }

        // 2. Handle Actions
        if (action === 'list') {
            let query = supabase
                .from('profiles')
                .select('*')
                .eq('organization_id', organizationId);

            if (branch_id) {
                // If profiles have branch_id (assuming they might via a generic join or column)
                // For now, list all org staff
            }

            const { data, error } = await query;
            if (error) throw error;

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        if (action === 'create') {
            const {
                email,
                password,
                role,
                full_name,
                base_salary,
                pay_period,
                home_branch_id
            } = staff_data;

            if (!email || !password || !full_name) {
                return new Response(JSON.stringify({ error: "Missing required fields (email, password, full_name)" }), { status: 400, headers: corsHeaders });
            }

            // 2.1 Create Auth User
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name, role, organization_id: organizationId }
            });

            if (authError) {
                console.error('Auth Error:', authError);
                return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: corsHeaders });
            }

            // 2.2 Profile is usually created by Trigger, but we can ensure/update it
            const newUserId = authData.user.id;

            const { error: upsertError } = await supabase.from('profiles').upsert({
                id: newUserId,
                full_name,
                role,
                organization_id: organizationId,
                email,
                home_branch_id: home_branch_id || null,
                base_salary: base_salary || null,
                pay_period: pay_period || 'monthly',
                status: 'active'
            });

            if (upsertError) {
                console.error('Profile Upsert Error:', upsertError);
                // We don't necessarily want to fail the whole thing if Auth user was created, 
                // but for debugging let's report it.
                return new Response(JSON.stringify({ error: `User created, but profile update failed: ${upsertError.message}` }), { status: 500, headers: corsHeaders });
            }

            return new Response(JSON.stringify({ success: true, user: authData.user }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        if (action === 'update') {
            if (!target_id) throw new Error("Target ID required");
            const { status, role: newRole, home_branch_id, base_salary, pay_period } = staff_data || {};

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    status,
                    role: newRole,
                    home_branch_id,
                    base_salary,
                    pay_period,
                    updated_at: new Date().toISOString()
                })
                .eq('id', target_id)
                .eq('organization_id', organizationId);

            if (updateError) throw updateError;

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        if (action === 'delete') {
            if (!target_id) throw new Error("Target ID required");
            // Delete Auth User
            const { error } = await supabase.auth.admin.deleteUser(target_id);
            if (error) throw error;

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        if (action === 'performance') {
            // Fetch performance stats
            // We can look at staff_shifts or tips_ledger or orders
            // For now, let's just return a summary if we have a table for it
            // Or aggregate orders served.

            // Re-using the logic from orderService is hard without direct access to internal helpers,
            // so we will query the raw tables.

            let query = supabase
                .from('staff_performance_daily') // Assuming this table exists from OrderService logic
                .select('*')
                .order('date', { ascending: false })
                .limit(7);

            if (target_id) {
                query = query.eq('staff_id', target_id);
            }

            const { data, error } = await query;

            if (error) {
                // If table doesn't exist, fallback to tips
                const { data: tips } = await supabase.from('tips_ledger').select('amount, created_at').limit(10);
                return new Response(JSON.stringify({ message: "Performance table not ready, showing tips", tips }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            return new Response(JSON.stringify({ success: true, data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        return new Response(JSON.stringify({ error: "Invalid Action" }), { status: 400, headers: corsHeaders });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
