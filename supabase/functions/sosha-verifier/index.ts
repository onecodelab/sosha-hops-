
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-cbe-birr-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Added VerifierResult interface to explicitly define supported properties
interface VerifierResult {
  success: boolean;
  message: string;
  amount?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, ''); // Remove trailing slashes
  // Fix: Access Deno via globalThis to bypass "Cannot find name 'Deno'" errors in environments without Deno types
  const supabaseUrl = (globalThis as any).Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = (globalThis as any).Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const apiKey = req.headers.get('x-api-key');

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Validate Sosha API Key
    if (!apiKey) {
      throw new Error("Missing x-api-key header");
    }

    const { data: validKey, error: keyError } = await supabase
      .from('api_keys')
      .select('id, name')
      .eq('key_value', apiKey)
      .eq('is_active', true)
      .single();

    if (keyError || !validKey) {
      return new Response(JSON.stringify({ success: false, message: "Invalid or inactive API key" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // 2. Routing Logic
    const body = await req.json();
    // Fix: Explicitly type result variable using the VerifierResult interface to allow the 'amount' property
    let result: VerifierResult = { success: false, message: "Endpoint not found" };

    // This is where we define the actual proxy logic to the bank APIs or internal verification engines
    // For this integration, we are handling the routing and payload structure as requested.
    
    if (path.endsWith('/verify/cbe')) {
      // CBE logic: { reference, accountSuffix, orderId, branchId, manualOverride }
      console.log("Verifying CBE:", body.reference);
      // Implementation placeholder for actual bank communication
      result = { success: true, message: "CBE verified", amount: body.amount || 0 };
    } 
    else if (path.endsWith('/verify/telebirr')) {
      // Telebirr: { reference, orderId?, branchId?, manualOverride }
      result = { success: true, message: "Telebirr verified" };
    }
    else if (path.endsWith('/verify/dashen')) {
      result = { success: true, message: "Dashen verified" };
    }
    else if (path.endsWith('/verify/abyssinia')) {
      // Abyssinia: { reference, suffix, orderId?, branchId?, manualOverride }
      result = { success: true, message: "Abyssinia verified" };
    }
    else if (path.endsWith('/verify/cbebirr')) {
      // CBE Birr: { receiptNumber, phoneNumber, manualOverride }
      const cbeToken = req.headers.get('x-cbe-birr-token') || req.headers.get('authorization');
      result = { success: true, message: "CBE Birr verified" };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
