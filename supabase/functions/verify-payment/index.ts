// Follow Supabase Edge Function standards (Deno)
// HARDENED: Unique reference check, order status check, audit logging
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_LEUL_KEY = Deno.env.get('VERIFY_LEUL_KEY');
const API_URL = "https://verifyapi.leulzenebe.pro/verify";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Helper: Log every verification attempt
async function logVerificationAttempt(
  supabase: any,
  data: {
    organization_id?: string;
    order_id?: string;
    transaction_id: string;
    bank: string;
    status: string;
    response_data?: any;
  }
) {
  try {
    await supabase.from('payment_verification_log').insert({
      organization_id: data.organization_id || null,
      order_id: data.order_id || null,
      transaction_id: data.transaction_id,
      bank: data.bank,
      status: data.status,
      response_data: data.response_data || {},
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("[AUDIT] Failed to log verification attempt:", e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!;
    const supabase = createClient(sbUrl, sbKey);

    // 1. JWT Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(sbUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await authClient.auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // 2. AUTHENTICATION & ISOLATION HARDENING
    const organizationId = user.app_metadata?.organization_id;
    if (!organizationId) {
      console.error(`[AUTH_ERROR] User ${user.id} has no organization_id in app_metadata`);
      return new Response(JSON.stringify({ error: 'Identity Error', detail: 'User is not bound to an organization' }), { status: 403, headers: corsHeaders });
    }

    const userRole = (user.app_metadata?.role || 'authenticated').toLowerCase();

    const {
      transaction_id, // From Agent/Chatbot
      bank,           // From Agent/Chatbot
      order_id,       // Optional: If provided, we update the order
      amount,         // Optional: Expected amount for validation
      receiver_account // Optional
    } = await req.json();

    if (!transaction_id || !bank) {
      return new Response(JSON.stringify({ error: "Please provide both transaction_id and bank name." }), { status: 400, headers: corsHeaders });
    }

    // ================================================================
    // STEP 1: DUPLICATE & IDEMPOTENCY CHECK
    // The same reference must NEVER be used on DIFFERENT orders.
    // However, if it's the SAME order, we should allow it (idempotency).
    // ================================================================
    const { data: existingPayment } = await supabase
      .from('order_payments')
      .select('id, order_id, amount')
      .eq('reference', transaction_id)
      .maybeSingle();

    if (existingPayment) {
      // IDEMPOTENCY: If this reference was already successfully linked to THIS order, return success.
      if (order_id && existingPayment.order_id === order_id) {
        console.log(`[IDEMPOTENCY] Reference ${transaction_id} already linked to order ${order_id}. Returning success.`);
        return new Response(JSON.stringify({
          success: true,
          validated: true,
          amount_found: existingPayment.amount,
          message: "Transaction already verified for this order.",
          action_taken: "Idempotent Success (Cached)",
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // ACTUAL DUPLICATE: Used on a different order.
      await logVerificationAttempt(supabase, {
        order_id: order_id || existingPayment.order_id,
        transaction_id,
        bank,
        status: 'duplicate',
        response_data: { blocked_reason: 'Reference already used on another order', existing_payment_id: existingPayment.id, other_order_id: existingPayment.order_id }
      });

      return new Response(JSON.stringify({
        success: false,
        message: "This transaction reference has already been used on another order!",
        action_taken: "Blocked Duplicate"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Also check orders.transaction_reference (legacy fallback)
    const { data: existingOrderRef } = await supabase
      .from('orders')
      .select('id, total_amount')
      .eq('transaction_reference', transaction_id)
      .maybeSingle();

    if (existingOrderRef) {
      if (order_id && existingOrderRef.id === order_id) {
        console.log(`[IDEMPOTENCY] Reference ${transaction_id} already in order ref ${order_id}. Returning success.`);
        return new Response(JSON.stringify({
          success: true,
          validated: true,
          amount_found: existingOrderRef.total_amount,
          message: "Transaction already linked to this order.",
          action_taken: "Idempotent Success (Legacy Ref)",
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      await logVerificationAttempt(supabase, {
        order_id: order_id || existingOrderRef.id,
        transaction_id,
        bank,
        status: 'duplicate',
        response_data: { blocked_reason: 'Reference already on another order (Legacy Ref)' }
      });

      return new Response(JSON.stringify({
        success: false,
        message: `This transaction reference is already linked to Order ${existingOrderRef.order_number || 'Unknown'}!`,
        action_taken: "Blocked Duplicate",
        linked_order_id: existingOrderRef.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // ================================================================
    // STEP 2: ORDER STATUS CHECK (if order_id provided)
    // Cannot pay a closed/paid/cancelled order
    // ================================================================
    let order: any = null;
    let expectedAmount = amount;

    if (order_id) {
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('id, status, payment_status, total_amount, amount_paid, organization_id, table_id, qr_verification_code')
        .eq('id', order_id)
        .single();

      if (orderErr || !orderData) {
        if (orderErr || !orderData) {
          await logVerificationAttempt(supabase, {
            order_id,
            transaction_id,
            bank,
            status: 'failed',
            response_data: { error: 'Order not found' }
          });
          return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: corsHeaders });
        }

        // SACRED RULE: Tenant Isolation
        if (orderData.organization_id !== organizationId) {
          return new Response(JSON.stringify({ error: "Tenant isolation violation" }), { status: 403, headers: corsHeaders });
        }

        order = orderData;
        if (!expectedAmount) {
          expectedAmount = order.total_amount - (order.amount_paid || 0);
        }

        return new Response(JSON.stringify({
          success: false,
          message: "Order not found.",
          action_taken: "Failed - Order Missing"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      order = orderData;

      // Block payment on already-settled orders
      if (['closed', 'cancelled'].includes(order.status) || order.payment_status === 'paid') {
        await logVerificationAttempt(supabase, {
          organization_id: organizationId || undefined,
          order_id,
          transaction_id,
          bank,
          status: 'already_paid',
          response_data: { order_status: order.status, payment_status: order.payment_status }
        });

        return new Response(JSON.stringify({
          success: false,
          message: "This order is already settled. No further payments accepted.",
          action_taken: "Blocked - Order Already Paid/Closed"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      if (!expectedAmount) {
        expectedAmount = order.total_amount - (order.amount_paid || 0);
      }
    }

    // ================================================================
    // STEP 3: LOG THE ATTEMPT (before calling external API)
    // ================================================================
    await logVerificationAttempt(supabase, {
      organization_id: organizationId || undefined,
      order_id,
      transaction_id,
      bank,
      status: 'attempted'
    });

    // ================================================================
    // STEP 4: CALL VERIFICATION API
    // ================================================================
    if (!VERIFY_LEUL_KEY) {
      throw new Error("Verification service not configured (Missing VERIFY_LEUL_KEY)");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Normalize bank key for upsteam API mapping
    let bankKeyForApi = bank.toLowerCase().trim().replace(/_/g, '');
    if (bankKeyForApi === 'cbebirr') bankKeyForApi = 'cbe_birr'; // Ensure consistency if API expects underscore

    const finalReceiverAccount = receiver_account; // Use the destructured receiver_account

    const apiPayload = {
      bank: bankKeyForApi,
      transaction_id,
      receiver_account: finalReceiverAccount
    };

    console.log("[verify-payment] Calling API:", apiPayload);

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

    // ================================================================
    // STEP 5: PROCESS RESULT
    // ================================================================
    let actionTaken = "Verified only (no order linked).";
    let receiptData: any = null;

    if (data.success && data.validated && order_id && order) {
      const verifiedAmount = data.amount;
      const now = new Date().toISOString();

      if (expectedAmount && verifiedAmount < expectedAmount) {
        // --- PARTIAL PAYMENT ---
        actionTaken = `Verified ${verifiedAmount} ETB, but expected ${expectedAmount} ETB. Order partially paid.`;

        await supabase.from('order_payments').insert({
          order_id: order_id,
          amount: verifiedAmount,
          payment_method: bank,
          reference: transaction_id,
          organization_id: organizationId,
          created_at: now
        });

        await supabase.from('orders').update({
          payment_status: 'split',
          amount_paid: (order.amount_paid || 0) + verifiedAmount,
          last_updated: now
        }).eq('id', order_id);

        await logVerificationAttempt(supabase, {
          organization_id: organizationId || undefined,
          order_id,
          transaction_id,
          bank,
          status: 'success',
          response_data: { type: 'partial', verified_amount: verifiedAmount, expected: expectedAmount }
        });

      } else {
        // --- FULL PAYMENT ---
        actionTaken = "Payment verified. Order marked as PAID and CLOSED.";

        // Calculate receipt data
        const subtotal = order.total_amount / 1.15;
        const vat = order.total_amount - subtotal;
        const tin = "0043819230";

        const qrData = {
          v: "1.0",
          oid: order.id,
          tot: order.total_amount,
          vat: parseFloat(vat.toFixed(2)),
          ref: transaction_id,
          bank: bank,
          ts: now
        };

        const qrCode = btoa(JSON.stringify(qrData));

        // Record payment
        await supabase.from('order_payments').insert({
          order_id: order_id,
          amount: verifiedAmount || order.total_amount,
          payment_method: bank,
          reference: transaction_id,
          organization_id: organizationId,
          created_at: now
        });

        // Close the order
        await supabase.from('orders').update({
          status: 'closed',
          payment_status: 'paid',
          payment_method: bank,
          amount_paid: verifiedAmount || order.total_amount,
          transaction_reference: transaction_id,
          paid_at: now,
          closed_at: now,
          completed_at: now,
          last_updated: now,
          subtotal_amount: parseFloat(subtotal.toFixed(2)),
          vat_amount: parseFloat(vat.toFixed(2)),
          vat_rate: 15.0,
          qr_verification_code: qrCode
        }).eq('id', order_id);

        // Clear the table if linked
        if (order.table_id) {
          // Deactivate sessions
          await supabase
            .from('table_sessions')
            .update({ is_active: false, closed_at: now })
            .eq('table_id', order.table_id)
            .eq('is_active', true);

          // Reset table
          await supabase.from('tables').update({
            status: 'available',
            current_order_id: null,
            current_session_id: null,
            last_updated: now
          }).eq('id', order.table_id);
        }

        receiptData = {
          order_id: order.id,
          total: order.total_amount,
          subtotal: parseFloat(subtotal.toFixed(2)),
          vat: parseFloat(vat.toFixed(2)),
          payment_method: bank,
          reference: transaction_id,
          qr_code: qrCode,
          paid_at: now
        };

        await logVerificationAttempt(supabase, {
          organization_id: organizationId || undefined,
          order_id,
          transaction_id,
          bank,
          status: 'success',
          response_data: { type: 'full', verified_amount: verifiedAmount, receipt_generated: true }
        });
      }
    } else if (!data.success || !data.validated) {
      // Verification failed at bank level
      await logVerificationAttempt(supabase, {
        organization_id: organizationId || undefined,
        order_id,
        transaction_id,
        bank,
        status: 'failed',
        response_data: data
      });
    }

    return new Response(JSON.stringify({
      success: data.validated || false,
      validated: data.validated || false,
      amount_found: data.amount,
      message: data.message || (data.validated ? "Transaction Found and Valid." : "Transaction not found or invalid."),
      receiver_account: finalReceiverAccount,
      bank_key: bank,
      api_response: data, // Return full response for debugging
      action_taken: actionTaken,
      receipt: receiptData,
      raw: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("[verify-payment] Fatal error:", error.message);
    return new Response(JSON.stringify({
      success: false,
      validated: false,
      error: error.message || "Unknown server error",
      message: "An internal server error occurred while verifying the payment."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 to ensure the client receives JSON and not a raw 400 crash
    });
  }
})