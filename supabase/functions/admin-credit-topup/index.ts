import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceClient = createClient(sbUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
    }

    const authClient = createClient(sbUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { data: profile, error: profileErr } = await serviceClient
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) throw profileErr;
    if (!profile || profile.role !== 'super_admin') {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const organizationId = body?.organization_id;
    const amount = Number(body?.amount);

    if (!organizationId) {
      return new Response(JSON.stringify({ success: false, error: 'organization_id is required' }), { status: 400, headers: corsHeaders });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ success: false, error: 'amount must be a positive number' }), { status: 400, headers: corsHeaders });
    }

    const { data: org, error: orgErr } = await serviceClient
      .from('organizations')
      .select('id, name, used_monthly_credits, max_monthly_credits, plan_tier')
      .eq('id', organizationId)
      .maybeSingle();

    if (orgErr) throw orgErr;
    if (!org) {
      return new Response(JSON.stringify({ success: false, error: 'Organization not found' }), { status: 404, headers: corsHeaders });
    }

    const newMax = Number(org.max_monthly_credits || 0) + amount;
    const { error: updateErr } = await serviceClient
      .from('organizations')
      .update({
        max_monthly_credits: newMax
      })
      .eq('id', organizationId);

    if (updateErr) throw updateErr;

    const { error: logErr } = await serviceClient.from('credit_usage_logs').insert({
      organization_id: organizationId,
      amount,
      action_type: 'admin_credit_topup',
      metadata: {
        admin_user_id: user.id,
        organization_name: org.name,
        old_max_monthly_credits: org.max_monthly_credits || 0,
        new_max_monthly_credits: newMax,
        note: 'Platform admin credit top-up'
      }
    });

    if (logErr) throw logErr;

    return new Response(JSON.stringify({
      success: true,
      organization_id: organizationId,
      organization_name: org.name,
      added_credits: amount,
      new_max_monthly_credits: newMax
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error('[admin-credit-topup] Error:', error?.message || error);
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Failed to top up credits' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
