// Follow Supabase Edge Function standards (Deno)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const VERIFY_LEUL_KEY = "Y21pdnQwMWVnMDAzYW5vMGtmbmNva2w4Ni0xNzY3NDE0OTU3MTMwLXdvaGQ3a2I1bnBy";
const API_URL = "https://verifyapi.leulzenebe.pro/verify";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // 1. Mandatory CORS Preflight Handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json();
    const { bank, transaction_id, receiver_account } = payload;

    if (!transaction_id) {
        throw new Error("Transaction ID is required");
    }

    // 2. Fetch with 15s timeout to prevent hanging connections
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VERIFY_LEUL_KEY}`
      },
      body: JSON.stringify({
        bank,
        transaction_id,
        receiver_account
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const data = await response.json();

    // 3. Success Response with mandatory CORS
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Proxy Error";
    console.error("Edge Function Error:", message);
    
    // 4. Error Response with mandatory CORS (status 200 to allow parsing by client)
    return new Response(JSON.stringify({ 
      success: false, 
      message: message,
      error_details: "Verification engine handshake failed"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    });
  }
})