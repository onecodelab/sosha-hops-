import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
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

        if (profileErr || !profile || !['owner', 'admin'].includes(profile?.role)) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
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
            // Create a new user profile (Note: Creating Auth User usually requires Admin API, 
            // here we might just be creating the Profile entry if Auth User exists, 
            // OR we use Supabase Admin Auth to create the user).

            // For simplicity in this Agent context, we'll assume we are creating a 'Staff Profile' 
            // that maps to a real user later, or we use the Admin API to invite.

            const { email, password, role, first_name, last_name } = staff_data;

            // 2.1 Create Auth User
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { first_name, last_name, role, organization_id: organizationId }
            });

            if (authError) throw authError;

            // 2.2 Profile is usually created by Trigger, but we can ensure/update it
            // Wait a moment or upsert
            const newUserId = authData.user.id;

            await supabase.from('profiles').upsert({
                id: newUserId,
                first_name,
                last_name,
                role,
                organization_id: organizationId,
                email
            });

            return new Response(JSON.stringify({ success: true, user: authData.user }), {
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
