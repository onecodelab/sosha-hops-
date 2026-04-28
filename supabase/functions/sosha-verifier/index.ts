import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const VERIFIER_SERVICE_URL = Deno.env.get('VERIFIER_SERVICE_URL') || "http://localhost:3000";
const VERIFIER_API_KEY = Deno.env.get('VERIFIER_API_KEY') || "test-key-123";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-cbe-birr-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');

  const supabaseUrl = (globalThis as any).Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = (globalThis as any).Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const apiKey = req.headers.get('x-api-key');

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. AUTH CHECK
    if (!apiKey) throw new Error("Missing x-api-key");
    const { data: keyRecord } = await supabase.from('api_keys').select('id').eq('key', apiKey).eq('is_active', true).maybeSingle();
    if (!keyRecord) throw new Error("Invalid/Inactive API Key");

    // --- RATE LIMITING (By IP) ---
    const redisUrl = (globalThis as any).Deno.env.get('UPSTASH_REDIS_REST_URL');
    const redisToken = (globalThis as any).Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
    if (redisUrl && redisToken) {
        const { Redis } = await import("https://esm.sh/@upstash/redis");
        const redis = new Redis({ url: redisUrl, token: redisToken });
        const { rateLimit } = await import("../_shared/identity.ts");
        
        // Limit by IP to prevent brute-forcing
        const clientIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'anonymous';
        const limit = await rateLimit(redis, `verify:${clientIp}`, 20, 60); // 20 requests per minute
        if (!limit.success) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: corsHeaders });
        }
    }

    // 2. PARSE DATA
    const body = await req.json();
    // Don't convert to uppercase - keep original case
    const reference = (body.reference || "").trim();
    console.log(`[BARO] Processing ${path} for Ref: ${reference}`);

    if (!reference) throw new Error("Missing transaction reference");

    // 3. MASTER TEST BYPASS (REMOVED FOR PRODUCTION SECURITY)
    // 4. MANUAL OVERRIDE (REMOVED FOR PRODUCTION SECURITY)

    // 5. FRAUD CHECK
    const { data: existing } = await supabase.from('orders').select('id').eq('transaction_reference', reference).neq('status', 'cancelled').maybeSingle();
    if (existing) throw new Error("This receipt was already used for another order.");

    // 6. BANK ROUTING - Use transaction_id for ALL banks (Leul handles conversion)
    let bankCode = "";
    let payload: any = { transaction_id: reference };

    if (path.endsWith('/cbe')) {
      bankCode = "cbe";
      payload.receiver_account = body.accountSuffix;
    }
    else if (path.endsWith('/telebirr')) {
      bankCode = "telebirr";
      // Leul API uses transaction_id for all banks
    }
    else if (path.endsWith('/dashen')) {
      bankCode = "dashen";
    }
    else if (path.endsWith('/abyssinia')) {
      bankCode = "abyssinia";
      payload.receiver_account = body.suffix;
    }
    else if (path.endsWith('/cbebirr')) {
      bankCode = "cbebirr";
    }
    else throw new Error("Invalid bank endpoint");

    console.log(`[BARO] Calling Leul API:`, JSON.stringify({ bank: bankCode, ...payload }));

    // 7. CALL SELF-HOSTED SERVICE with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Map endpoint to our new service routes
    const serviceEndpoint = path.endsWith('/telebirr') ? '/verify-telebirr' :
      path.endsWith('/cbe') ? '/verify-cbe' : '/verify-other';

    console.log(`[BARO] Calling External Service: ${VERIFIER_SERVICE_URL}${serviceEndpoint}`);

    const verifyResponse = await fetch(`${VERIFIER_SERVICE_URL}${serviceEndpoint}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': VERIFIER_API_KEY
      },
      body: JSON.stringify({ ...payload, bank: bankCode }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const resultData = await verifyResponse.json();
    console.log(`[BARO] Leul Response:`, JSON.stringify(resultData));

    // Check various success indicators
    const isVerified = resultData.success === true || resultData.verified === true || resultData.status === 'success';

    return new Response(JSON.stringify({
      success: isVerified,
      message: isVerified ? "Verified" : (resultData.message || resultData.error || "Record not found on bank servers"),
      amount: resultData.data?.totalPaidAmount || resultData.data?.settledAmount || resultData.amount,
      receiptNo: resultData.data?.receiptNo || reference,
      customerName: resultData.data?.payerName || resultData.data?.customerName || resultData.payer_name
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error("[BARO] Function Error:", error.message);
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
})
