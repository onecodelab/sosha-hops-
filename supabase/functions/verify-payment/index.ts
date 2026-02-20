// Follow Supabase Edge Function standards (Deno)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_LEUL_KEY = "Y21pdnQwMWVnMDAzYW5vMGtmbmNva2w4Ni0xNzY3NDE0OTU3MTMwLXdvaGQ3a2I1bnBy";
const API_URL = "https://verifyapi.leulzenebe.pro/verify";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      transaction_id, // From Agent
      bank,           // From Agent
      order_id,       // Optional: If provided, we update the order!
      amount,         // Optional: Expected amount for validation
      receiver_account // Optional
    } = await req.json();

    if (!transaction_id || !bank) {
      throw new Error("Please provide both transaction_id and bank name.");
    }

    // Initialize Supabase (Use SERVICE KEY to update orders securely)
    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SERVICE_ROLE_KEY')!; // Using Service Key to update 'orders'
    const supabase = createClient(sbUrl, sbKey);

    // 1. If order_id is provided, get the expected amount if not passed
    let expectedAmount = amount;
    if (order_id && !expectedAmount) {
      const { data: order } = await supabase
        .from('orders')
        .select('total_amount, amount_paid')
        .eq('id', order_id)
        .single();

      if (order) {
        expectedAmount = order.total_amount - (order.amount_paid || 0);
      }

      // 1.1 Check for Duplicate Transaction ID
      const { data: existingPayment } = await supabase
        .from('order_payments')
        .select('id')
        .eq('reference', transaction_id)
        .maybeSingle();

      if (existingPayment) {
        return new Response(JSON.stringify({
          success: false,
          message: "This transaction reference has already been used!",
          action_taken: "Blocked Duplicate"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }
    }

    // 2. Call Verification API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const apiPayload = {
      bank: bank.toLowerCase(),
      transaction_id,
      receiver_account
    };

    console.log("Verifying:", apiPayload);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VERIFY_LEUL_KEY}`
      },
      body: JSON.stringify(apiPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    // 3. Logic: If Valid -> Update Order
    let actionTaken = "Verified only.";

    if (data.success && data.validated && order_id) {
      // Double check amount if we know it
      const verifiedAmount = data.amount;
      if (expectedAmount && verifiedAmount < expectedAmount) {
        // Partial Payment or Underpayment
        actionTaken = `Verified ${verifiedAmount}, but expected ${expectedAmount}. Order partially paid.`;

        // Manually update order_payments and orders as no RPC exists
        await supabase.from('order_payments').insert({
          order_id: order_id,
          amount: verifiedAmount,
          payment_method: bank,
          reference: transaction_id,
          created_at: new Date().toISOString()
        });

        await supabase.from('orders').update({
          payment_status: 'split',
          amount_paid: (order?.amount_paid || 0) + verifiedAmount, // Use 'order' variable
          last_updated: new Date().toISOString()
        }).eq('id', order_id);
      } else {
        // Full Payment
        actionTaken = "Payment verified and Order updated to PAID/CLOSED.";

        // Update Order
        await supabase.from('orders').update({
          status: 'closed',
          payment_status: 'paid',
          amount_paid: verifiedAmount, // or total_amount
          paid_at: new Date().toISOString(),
          closed_at: new Date().toISOString()
        }).eq('id', order_id);

        // Also close table (optional, logical)
        // We can trigger a cleanup function here if needed
      }
    }

    return new Response(JSON.stringify({
      success: data.success,
      validated: data.validated,
      amount_found: data.amount,
      message: data.message || (data.validated ? "Transaction Found and Valid." : "Transaction not found or invalid."),
      action_taken: actionTaken,
      raw: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 so Flowise can parse the error message
    });
  }
})