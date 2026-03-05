import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppOrderInput {
    organization_id: string;
    branch_id: string;
    table_number?: string;
    customer_phone: string;
    items: Array<{
        menu_item_id: string;
        quantity: number;
        name?: string;
        notes?: string;
    }>;
    payment_reference: string;
    bank_key: string;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const sbUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(sbUrl, sbKey);

    try {
        const body: WhatsAppOrderInput = await req.json();
        const {
            organization_id,
            branch_id,
            table_number,
            customer_phone,
            items,
            payment_reference,
            bank_key
        } = body;

        console.log(`[WHATSAPP_ORDER] Processing Order for Phone: ${customer_phone}, Ref: ${payment_reference}`);

        // 1. DUPLICATE CHECK
        const { data: existingPayment } = await supabase
            .from('payments')
            .select('id')
            .eq('reference', payment_reference)
            .eq('organization_id', organization_id)
            .maybeSingle();

        if (existingPayment) {
            return new Response(JSON.stringify({
                code: 'ALREADY_USED',
                message: 'This payment reference has already been used.'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 2. FETCH BANK CONFIG
        const { data: bankConfig, error: bankErr } = await supabase
            .from('bank_settings')
            .select('account_number')
            .eq('bank_key', bank_key)
            .eq('organization_id', organization_id)
            .maybeSingle();

        if (bankErr || !bankConfig) {
            return new Response(JSON.stringify({
                code: 'ERROR',
                message: `Bank configuration not found for ${bank_key}.`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 3. VERIFY PAYMENT (Call Local Verifier Service)
        // We use the same logic as sosha-verifier
        const UPSTREAM_API_URL = "http://localhost:3000";
        const serviceEndpoint = bank_key === 'telebirr' ? '/verify-telebirr' :
            bank_key === 'cbe' ? '/verify-cbe' : '/verify-other';

        const payload = {
            transaction_id: payment_reference,
            bank: bank_key,
            receiver_account: bankConfig.account_number
        };

        console.log(`[WHATSAPP_ORDER] Verifying via ${UPSTREAM_API_URL}${serviceEndpoint}`);

        const verifyResponse = await fetch(`${UPSTREAM_API_URL}${serviceEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!verifyResponse.ok) {
            throw new Error(`Verifier service returned ${verifyResponse.status}`);
        }

        const verificationResult = await verifyResponse.json();
        const isVerified = verificationResult.success === true || verificationResult.verified === true || verificationResult.status === 'success';

        if (!isVerified) {
            return new Response(JSON.stringify({
                code: 'VERIFICATION_FAILED',
                message: verificationResult.message || 'Payment could not be verified by the bank.'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const paidAmount = Number(verificationResult.data?.totalPaidAmount ||
            verificationResult.data?.settledAmount ||
            verificationResult.amount);

        // 4. CALCULATE ORDER TOTAL
        const itemIds = items.map(i => i.menu_item_id);
        const { data: menuData, error: menuErr } = await supabase
            .from('menu')
            .select('id, name, price, organization_id')
            .in('id', itemIds);

        if (menuErr || !menuData || menuData.length !== itemIds.length) {
            // Check for tenant isolation
            const invalidItems = menuData?.filter(m => m.organization_id !== organization_id) || [];
            if (invalidItems.length > 0) {
                return new Response(JSON.stringify({ code: 'ERROR', message: 'Unauthorized menu item access detected.' }), { status: 403, headers: corsHeaders });
            }
            return new Response(JSON.stringify({ code: 'ERROR', message: 'One or more menu items not found.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        let subtotal = 0;
        const mappedItems = items.map(item => {
            const menuMatch = menuData.find(m => m.id === item.menu_item_id);
            if (!menuMatch) throw new Error(`Item ${item.menu_item_id} lost during processing.`);

            const price = Number(menuMatch.price) || 0;
            subtotal += price * item.quantity;
            return {
                ...item,
                price,
                organization_id
            };
        });

        const vatRate = 0.15; // Fixed 15% as per project standard
        const vatAmount = Math.round((subtotal * vatRate) * 100) / 100;
        const totalRequired = Math.round((subtotal + vatAmount) * 100) / 100;

        // 5. UNDERPAID CHECK
        if (paidAmount < totalRequired) {
            return new Response(JSON.stringify({
                code: 'UNDERPAID',
                paid_amount: paidAmount,
                required_amount: totalRequired
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 6. ATOMIC ORDER CREATION
        // We'll use a transaction via RPC or just sequential calls 
        // Since this is service_role, we have full power.

        // Calculate next order number (simplified for now or use table session logic)
        const orderNumber = `WA-${Math.random().toString(36).substring(7).toUpperCase()}`;

        // Create Order
        const { data: order, error: orderCreateErr } = await supabase
            .from('orders')
            .insert({
                organization_id,
                branch_id,
                table_number,
                customer_phone,
                status: 'accepted', // Auto-accept paid WhatsApp orders
                payment_status: 'paid',
                source: 'whatsapp',
                total_amount: totalRequired,
                subtotal_amount: subtotal,
                vat_amount: vatAmount,
                vat_rate: 15,
                order_number: orderNumber,
                transaction_reference: payment_reference
            })
            .select().single();

        if (orderCreateErr) throw orderCreateErr;

        // Create Order Items
        const orderItemsPayload = mappedItems.map(i => ({
            order_id: order.id,
            organization_id,
            menu_item_id: i.menu_item_id,
            quantity: i.quantity,
            price: i.price,
            special_instructions: i.notes
        }));

        const { error: itemsErr } = await supabase.from('order_items').insert(orderItemsPayload);
        if (itemsErr) throw itemsErr;

        // Create Payment Record
        const { data: paymentRecord, error: payErr } = await supabase
            .from('payments')
            .insert({
                organization_id,
                branch_id,
                order_id: order.id,
                customer_phone,
                bank_key,
                reference: payment_reference,
                amount: paidAmount,
                status: 'verified',
                metadata: verificationResult,
                source: 'whatsapp'
            })
            .select().single();

        if (payErr) throw payErr;

        return new Response(JSON.stringify({
            code: 'OK',
            order_id: order.id,
            payment_id: paymentRecord.id
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error("[WHATSAPP_ORDER_ERROR]", error);
        return new Response(JSON.stringify({
            code: 'ERROR',
            message: error.message
        }), {
            status: 200, // Return 200 with error code to prevent n8n retries on business logic errors
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
})
