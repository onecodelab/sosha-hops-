import { supabase } from '../supabase';
import { Order, OrderStatus, PaymentMethod } from '../types';
import { enrichOrdersWithProfiles } from '../utils/orderProfileEnrichment';

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
        order_items (
          id, quantity, price, created_at, special_instructions,
          menu_item:menu!menu_item_id (name, image_url)
        )
      `)
            .eq('branch_id', branchId)
            .is('closed_at', null)
            .in('status', ['pending', 'accepted', 'preparing', 'ready', 'served', 'paid'])
            .order('created_at', { ascending: true });

        // If waiterId is provided, include all chatbot orders so we can normalize
        // stale owner/admin attribution back into the unassigned waiter queue.
        if (waiterId) {
            query = query.or(`waiter_id.eq.${waiterId},source.eq.chatbot`);
        } else {
            // Show all branch active orders if no waiter ID (useful for admins/HQ)
            // But we already filter by branch_id above.
        }

        const { data, error } = await query;
        if (error) throw error;

        const { data: branchTables, error: tablesError } = await supabase
            .from('tables')
            .select('id, table_number, current_order_id')
            .eq('branch_id', branchId);

        if (tablesError) throw tablesError;

        const normalizeTableNumber = (value?: string | null) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const tableById = new Map((branchTables || []).map((table: any) => [table.id, table]));
        const tableByNumber = new Map((branchTables || []).map((table: any) => [normalizeTableNumber(table.table_number), table]));
        const enrichedOrders = await enrichOrdersWithProfiles((data || []) as Order[]);

        const filteredOrders = enrichedOrders.filter((order: any) => {
            const linkedTable = order.table_id
                ? tableById.get(order.table_id)
                : tableByNumber.get(normalizeTableNumber(order.table_number));

            if (order.table_id && !linkedTable) {
                return false;
            }

            if (order.source === 'chatbot') {
                if (!linkedTable) {
                    return false;
                }

                if (linkedTable.current_order_id && linkedTable.current_order_id !== order.id) {
                    return false;
                }
            }

            if (!waiterId) {
                return true;
            }

            return order.waiter_id === waiterId || (order.source === 'chatbot' && !order.waiter_id);
        });

        return filteredOrders as Order[];
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

        // 3. Update the order with waiter and table
        const { error: orderErr } = await supabase
            .from('orders')
            .update({
                waiter_id: waiterId,
                table_id: tableId,
                table_number: tableData.table_number,
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

        // 0. Duplicate Check
        if (payment.reference && payment.method !== 'cash') {
            const { data: existingPay } = await supabase
                .from('order_payments')
                .select('order_id')
                .eq('reference', payment.reference)
                .maybeSingle();

            if (existingPay && existingPay.order_id !== order.id) {
                throw new Error("Fraud Alert: This transaction reference has already been used!");
            }

            const { data: existingOrder } = await supabase
                .from('orders')
                .select('id')
                .eq('transaction_reference', payment.reference)
                .maybeSingle();

            if (existingOrder && existingOrder.id !== order.id) {
                throw new Error("Fraud Alert: This transaction reference has already been used!");
            }
        }

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
        const todayStr = now.split('T')[0];

        // 0. Fraud Prevention & Audit
        if (paymentData.reference && paymentData.method !== 'cash') {
            // Check order_payments for actual usage
            const { data: existingPay } = await supabase
                .from('order_payments')
                .select('order_id')
                .eq('reference', paymentData.reference)
                .maybeSingle();

            if (existingPay && existingPay.order_id !== order.id) {
                await this.logPaymentAudit({
                    orderId: order.id,
                    reference: paymentData.reference,
                    method: paymentData.method,
                    status: 'fraud',
                    details: { attempted_order_id: order.id, existing_order_id: existingPay.order_id, found_in: 'order_payments' }
                });
                throw new Error("Fraud Alert: This transaction reference has already been used!");
            }

            // Also check orders table since full payments don't go to order_payments
            const { data: existingOrder } = await supabase
                .from('orders')
                .select('id')
                .eq('transaction_reference', paymentData.reference)
                .maybeSingle();

            if (existingOrder && existingOrder.id !== order.id) {
                await this.logPaymentAudit({
                    orderId: order.id,
                    reference: paymentData.reference,
                    method: paymentData.method,
                    status: 'fraud',
                    details: { attempted_order_id: order.id, existing_order_id: existingOrder.id, found_in: 'orders' }
                });
                throw new Error("Fraud Alert: This transaction reference has already been used!");
            }
        }

        const subtotal = order.total_amount / 1.15;
        const vat = order.total_amount - subtotal;
        const tin = "0043819230"; // Static TIN as per requirements

        // Calculate actual shortage if payment is under
        const trueShortage = Math.max(0, order.total_amount - paymentData.amountPaid);
        // Calculate actual tip (only if payment is over)
        const trueTip = Math.max(0, paymentData.amountPaid - order.total_amount);

        const qrData = {
            v: "1.0",
            oid: order.id,
            onum: order.order_number,
            tin: tin,
            tot: order.total_amount,
            vat: parseFloat(vat.toFixed(2)),
            ts: now
        };

        // 1. Update order status to closed and paid
        const { error: orderError } = await supabase
            .from('orders')
            .update({
                status: 'closed',
                payment_status: 'paid',
                payment_method: paymentData.method,
                amount_paid: paymentData.amountPaid,
                tip_amount: trueTip,
                transaction_reference: paymentData.reference || null,
                paid_at: now,
                closed_at: now,
                last_updated: now,
                subtotal_amount: parseFloat(subtotal.toFixed(2)),
                vat_amount: parseFloat(vat.toFixed(2)),
                vat_rate: 15.0,
                qr_verification_code: btoa(JSON.stringify(qrData)) // Base64 encoded payload
            })
            .eq('id', order.id);

        if (orderError) throw orderError;

        // 2. Handle Tip Extraction (Extract to Ledger)
        if (trueTip > 0 && order.waiter_id) {
            await supabase.from('tips_ledger').insert({
                staff_id: order.waiter_id,
                order_id: order.id,
                amount: trueTip,
                tip_type: paymentData.method === 'cash' ? 'cash' : 'digital',
                organization_id: (order as any).organization_id || '00000000-0000-0000-0000-000000000000',
                created_at: now
            });
        }

        // 3. Handle Performance & Shortage Logging
        if (order.waiter_id) {
            const { data: existingPerf } = await supabase
                .from('staff_performance_daily')
                .select('id, revenue_attributed, total_shortage, shortages_count, orders_completed')
                .eq('staff_id', order.waiter_id)
                .eq('date', todayStr)
                .maybeSingle();

            if (existingPerf) {
                await supabase.from('staff_performance_daily').update({
                    revenue_attributed: (existingPerf.revenue_attributed || 0) + (order.total_amount - trueShortage),
                    total_shortage: (existingPerf.total_shortage || 0) + trueShortage,
                    shortages_count: (existingPerf.shortages_count || 0) + (trueShortage > 0 ? 1 : 0),
                    orders_completed: (existingPerf.orders_completed || 0) + 1
                }).eq('id', existingPerf.id);
            } else {
                await supabase.from('staff_performance_daily').insert({
                    staff_id: order.waiter_id,
                    staff_name: order.waiter?.full_name || 'Staff',
                    date: todayStr,
                    revenue_attributed: order.total_amount - trueShortage,
                    total_shortage: trueShortage,
                    shortages_count: trueShortage > 0 ? 1 : 0,
                    orders_completed: 1
                });
            }
        }

        // 4. Handle table session if applicable
        if (order.table_id) {
            await this.forceClearTable(order.table_id);
        }
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
                    id, quantity, price, created_at, special_instructions,
                    menu_item:menu!menu_item_id (name, image_url)
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
