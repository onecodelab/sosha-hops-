import { supabase } from '../supabase';
import { Order, OrderStatus, PaymentMethod } from '../types';

export const orderService = {
    /**
     * Fetch active orders for a specific branch and optionally a specific waiter
     */
    async fetchActiveOrders(branchId: string, waiterId?: string): Promise<Order[]> {
        if (!branchId) return [];

        let query = supabase
            .from('orders')
            .select(`
        *,
        waiter:profiles!orders_waiter_id_fkey (full_name),
        order_items (
          id, quantity, price, created_at,
          menu_item:menu (name)
        )
      `)
            .eq('branch_id', branchId)
            .is('closed_at', null)
            .in('status', ['pending', 'accepted', 'preparing', 'ready', 'served', 'paid'])
            .order('created_at', { ascending: true });

        // If waiterId is provided, show their assigned orders OR any unassigned chatbot orders
        if (waiterId) {
            query = query.or(`waiter_id.eq.${waiterId},and(source.eq.chatbot,waiter_id.is.null)`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as Order[];
    },

    async claimChatbotOrder(orderId: string, waiterId: string, tableId: string): Promise<void> {
        const now = new Date().toISOString();

        // 1. Get the table number first
        const { data: tableData, error: tableErr } = await supabase
            .from('tables')
            .select('table_number')
            .eq('id', tableId)
            .single();

        if (tableErr) throw tableErr;

        // 2. Resolve Session: Check if an active session already exists
        let sessionId: string;
        const { data: existingSessions } = await supabase
            .from('table_sessions')
            .select('id')
            .eq('table_id', tableId)
            .eq('is_active', true);

        if (existingSessions && existingSessions.length > 0) {
            sessionId = existingSessions[0].id;
            // Optionally update the session to mark this waiter as the primary one
            await supabase.from('table_sessions').update({ waiter_id: waiterId }).eq('id', sessionId);
        } else {
            const { data: newSession, error: sessionErr } = await supabase
                .from('table_sessions')
                .insert({
                    table_id: tableId,
                    waiter_id: waiterId,
                    is_active: true,
                    seated_at: now
                })
                .select()
                .single();

            if (sessionErr) throw sessionErr;
            sessionId = newSession.id;
        }

        // 3. Update the order with waiter, table, and status 'accepted'
        const { error: orderErr } = await supabase
            .from('orders')
            .update({
                waiter_id: waiterId,
                table_id: tableId,
                table_number: tableData.table_number,
                status: 'accepted',
                accepted_at: now,
                // Removed non-existent waiter_assigned_at column
                last_updated: now
            })
            .eq('id', orderId);

        if (orderErr) throw orderErr;

        // 4. Link the table to the session/order
        await supabase.from('tables').update({
            current_session_id: sessionId,
            status: 'occupied',
            last_updated: now
        }).eq('id', tableId);
    },

    /**
     * Update order status
     */
    async updateStatus(orderId: string, status: OrderStatus, additionalData: any = {}): Promise<void> {
        const now = new Date().toISOString();

        // Prepare specific timestamp fields based on status
        const timestampFields: any = {};
        if (status === 'served') timestampFields.served_at = now;
        else if (status === 'accepted') timestampFields.accepted_at = now;
        else if (status === 'ready') timestampFields.ready_at = now;
        else if (status === 'paid') timestampFields.paid_at = now;

        const updatePayload = {
            status,
            last_updated: now,
            ...timestampFields,
            ...additionalData
        };

        const { data, error, status: httpStatus } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', orderId)
            .select();

        if (error) {
            console.error("[orderService] Update failed:", error);
            throw new Error(`Update error: ${error.message} (HTTP ${httpStatus})`);
        }

        if (!data || data.length === 0) {
            throw new Error("Update blocked by database security (RLS). Please ensure you have permission to update orders.");
        }
    },

    /**
     * Add a partial or full payment to an order
     */
    async addPayment(order: Order, payment: {
        amount: number;
        method: string;
        reference?: string;
        is_tip?: boolean;
    }): Promise<void> {
        const now = new Date().toISOString();

        // 1. Record the Payment in order_payments
        const { error: payErr } = await supabase
            .from('order_payments')
            .insert({
                order_id: order.id,
                amount: payment.amount,
                payment_method: payment.method,
                reference: payment.reference,
                organization_id: (order as any).organization_id || '00000000-0000-0000-0000-000000000000',
                created_at: now
            });

        if (payErr) throw payErr;

        // 2. Calculate new totals
        // We fetch fresh to ensure we have all concurrent payments
        const { data: payments, error: fetchErr } = await supabase
            .from('order_payments')
            .select('amount')
            .eq('order_id', order.id);

        if (fetchErr) throw fetchErr;

        const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const remaining = order.total_amount - totalPaid;
        const isFullyPaid = remaining <= 0;

        // 3. Update Order Status
        const updatePayload: any = {
            amount_paid: totalPaid,
            last_updated: now,
            payment_status: isFullyPaid ? 'paid' : 'split', // 'split' indicates partial payment active
            // transaction_reference: isFullyPaid ? payment.reference : null // Keep ref only on close or store separately? 
            // Better to keep the last ref or just rely on order_payments table for refs.
            // usage of transaction_reference on order table is somewhat deprecated by order_payments but kept for backward compat if needed.
        };

        if (isFullyPaid) {
            // Apply standard closing logic if fully paid
            // We use the existing closeOrder logic but adapted. 
            // Actually, we should just call closeOrder if it's the final payment? 
            // Or replicate the logic here to avoid double-payment recording.

            // Let's implement the closing logic here to be safe and atomic-ish
            updatePayload.status = 'closed';
            updatePayload.paid_at = now;
            updatePayload.closed_at = now;
            updatePayload.completed_at = now;

            // Calculate VAT/Subtotal for final record
            const subtotal = order.total_amount / 1.15;
            const vat = order.total_amount - subtotal;
            const tin = "0043819230";

            const qrData = {
                v: "1.0",
                oid: order.id,
                onum: order.order_number,
                tin: tin,
                tot: order.total_amount,
                vat: parseFloat(vat.toFixed(2)),
                ts: now
            };

            updatePayload.subtotal_amount = parseFloat(subtotal.toFixed(2));
            updatePayload.vat_amount = parseFloat(vat.toFixed(2));
            updatePayload.vat_rate = 15.0;
            updatePayload.qr_verification_code = btoa(JSON.stringify(qrData));

            // Handle Tips (Overpayment)
            const trueTip = Math.max(0, -remaining); // remaining is negative if overpaid
            if (trueTip > 0) {
                updatePayload.tip_amount = trueTip;
                // Log tip
                if (order.waiter_id) {
                    await supabase.from('tips_ledger').insert({
                        staff_id: order.waiter_id,
                        order_id: order.id,
                        amount: trueTip,
                        tip_type: payment.method === 'cash' ? 'cash' : 'digital',
                        organization_id: (order as any).organization_id || '00000000-0000-0000-0000-000000000000',
                        created_at: now
                    });
                }
            }

            // Close the table session
            if (order.table_id) {
                await this.forceClearTable(order.table_id);
            }
        }

        const { error: updateErr } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', order.id);

        if (updateErr) throw updateErr;
    },

    async logPaymentAudit(data: {
        orderId: string;
        reference: string;
        method: string;
        amount?: number;
        status: 'success' | 'failed' | 'fraud';
        details?: any;
    }): Promise<void> {
        await supabase.from('payment_audit').insert({
            order_id: data.orderId,
            reference: data.reference,
            payment_method: data.method,
            amount: data.amount,
            status: data.status,
            details: data.details
        });
    },

    async closeOrder(order: Order, paymentData: {
        method: string;
        amountPaid: number;
        tipAmount: number;
        reference?: string;
    }): Promise<void> {
        const now = new Date().toISOString();

        // 0. Fraud Prevention & Audit (Async/Non-blocking but essential)
        if (paymentData.reference && paymentData.method !== 'cash') {
            const { data: existingPay } = await supabase
                .from('order_payments')
                .select('order_id')
                .eq('reference', paymentData.reference)
                .maybeSingle();

            if (existingPay) {
                this.logPaymentAudit({
                    orderId: order.id,
                    reference: paymentData.reference,
                    method: paymentData.method,
                    status: 'fraud',
                    details: { attempted_order_id: order.id, existing_order_id: existingPay.order_id }
                });
                throw new Error("Fraud Alert: This transaction reference has already been used!");
            }
        }

        // 1. Prepare QR Data for Record
        const subtotal = order.total_amount / 1.15;
        const vat = order.total_amount - subtotal;
        const tin = "0043819230";
        const qrData = {
            v: "1.0",
            oid: order.id,
            onum: order.order_number,
            tin: tin,
            tot: order.total_amount,
            vat: parseFloat(vat.toFixed(2)),
            ts: now
        };
        const qrPayload = btoa(JSON.stringify(qrData));

        // 2. ATOMIC EXECUTION: Call stored procedure to handle all DB updates in 1 roundtrip
        // This handles: Orders, Tip Ledger, Staff Performance, Tables, and Table Sessions.
        const { error: rpcError } = await supabase.rpc('finalize_order_payment', {
            p_order_id: order.id,
            p_waiter_id: order.waiter_id || null,
            p_method: paymentData.method,
            p_amount_paid: paymentData.amountPaid,
            p_tip_amount: paymentData.tipAmount || 0,
            p_reference: paymentData.reference || null,
            p_qr_payload: qrPayload,
            p_org_id: (order as any).organization_id || null
        });

        if (rpcError) {
            console.error("[orderService] Atomic close failed, falling back to legacy...", rpcError);
            // If RPC doesn't exist yet, we could fallback, but for performance we want the RPC to exist.
            throw new Error(`Order Finalization Failed: ${rpcError.message}`);
        }

        // 3. Record the final payment link in order_payments (Belt and Suspenders)
        // Note: The RPC could do this too, but we keep it here to ensure order_payments is the source of truth for all refs.
        await supabase.from('order_payments').insert({
            order_id: order.id,
            amount: paymentData.amountPaid,
            payment_method: paymentData.method,
            reference: paymentData.reference,
            organization_id: (order as any).organization_id || '00000000-0000-0000-0000-000000000000',
            created_at: now
        });
    },

    /**
     * Mark order as served
     */
    async markServed(orderId: string): Promise<void> {
        return this.updateStatus(orderId, 'served', { served_at: new Date().toISOString() });
    },

    /**
     * Dispatch order for delivery (puts it in the driver queue)
     */
    async dispatchForDelivery(orderId: string): Promise<void> {
        return this.updateStatus(orderId, 'ready', {
            delivery_status: 'searching',
            ready_at: new Date().toISOString()
        });
    },

    /**
     * Generate bill (marks payment as pending)
     */
    async generateBill(orderId: string): Promise<void> {
        const { error } = await supabase
            .from('orders')
            .update({
                payment_status: 'pending',
                last_updated: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) throw error;
    },

    /**
     * Clear table and complete order (used if table wasn't cleared during payment)
     */
    async completeAndClearTable(order: Order): Promise<void> {
        const now = new Date().toISOString();

        if (order.table_id) {
            await this.forceClearTable(order.table_id);
        }

        const { error } = await supabase
            .from('orders')
            .update({
                completed_at: now,
                closed_at: now,
                status: 'closed',
                last_updated: now,
            })
            .eq('id', order.id);

        if (error) throw error;
    },

    /**
     * Proactively cleans up any active sessions for a table.
     * Use this before creating a new session or during order closure.
     */
    async forceClearTable(tableId: string): Promise<void> {
        const now = new Date().toISOString();

        // 1. Deactivate all active sessions for this table
        await supabase
            .from('table_sessions')
            .update({ is_active: false, closed_at: now })
            .eq('table_id', tableId)
            .eq('is_active', true);

        // 2. Reset the table status
        await supabase
            .from('tables')
            .update({
                status: 'available',
                current_order_id: null,
                current_session_id: null,
                last_updated: now
            })
            .eq('id', tableId);

        console.log(`Force cleared table ${tableId}`);
    },
    /**
     * Fetch active order summary for a table
     */
    async fetchTableOrderSummary(tableId: string): Promise<Order | null> {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    id, quantity, price, created_at,
                    menu_item:menu (name)
                )
            `)
            .eq('table_id', tableId)
            .is('closed_at', null)
            .neq('status', 'cancelled')
            .maybeSingle();

        if (error) throw error;
        return data as Order | null;
    },
};
