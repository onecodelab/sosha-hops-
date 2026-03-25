import type { JsonRecord, ToolContext } from "../types.ts";
import { getArray, getNumber, getString, normalizeTableNumber, requireBranchId, resolveBranchId, resolveOrderItemsByNameOrId, resolveTableId } from "../utils.ts";

export async function placeOrder(context: ToolContext) {
    const items = getArray<JsonRecord>(context.params.items);
    const tableNumber = getString(context.params.table_number);
    const customerPhone = getString(context.params.customer_phone);
    const sessionId = getString(context.params.session_id);
    const branchId = requireBranchId(context);

    let tableId = getString(context.params.table_id);
    if (!tableId && tableNumber) {
        tableId = await resolveTableId(context.supabase, branchId, tableNumber);
    }

    const resolvedItems = await resolveOrderItemsByNameOrId(context, items);
    const itemIds = resolvedItems.map((item) => item.menu_item_id);

    const { data: menuData, error: menuErr } = await context.supabase
        .from('view_menu_details')
        .select('id, name, price')
        .in('id', itemIds)
        .eq('organization_id', context.organizationId)
        .eq('branch_id', branchId);

    if (menuErr) throw menuErr;
    if (!menuData || menuData.length === 0) throw new Error("No valid menu items found for the given IDs.");

    const atomicItems = resolvedItems.map((item) => {
        const match = menuData.find((menuItem: any) => menuItem.id === item.menu_item_id);
        if (!match) {
            throw new Error(`Menu item ${item.menu_item_id} not found in this branch.`);
        }

        return {
            menu_item_id: item.menu_item_id,
            quantity: item.quantity || 1,
            unit_price: Number(match.price) || 0,
        };
    });

    const { data: atomicResult, error: atomicErr } = await context.supabase.rpc('place_order_atomic', {
        p_branch_id: branchId,
        p_items: atomicItems,
        p_order_details: {
            table_id: tableId,
            source: 'chatbot',
            customer_phone: customerPhone,
            session_id: sessionId,
        },
        p_organization_id: context.organizationId,
    });

    if (atomicErr) throw atomicErr;
    if (!atomicResult?.success) throw new Error(atomicResult?.error || "Order placement failed.");

    return {
        order_id: atomicResult.order_id,
        total_amount: atomicResult.total_amount,
        status: 'pending',
        message: "Order placed successfully.",
    };
}

export async function updateOrder(context: ToolContext) {
    const orderId = getString(context.params.order_id);
    const newItems = getArray<JsonRecord>(context.params.new_items);

    const { data: existingOrder, error: orderFetchErr } = await context.supabase
        .from('orders')
        .select('id, status, subtotal_amount, vat_amount, total_amount, organization_id')
        .eq('id', orderId)
        .eq('organization_id', context.organizationId)
        .single();

    if (orderFetchErr || !existingOrder) throw new Error("Order not found or access denied.");
    if (['cancelled', 'completed'].includes(existingOrder.status)) {
        throw new Error("Cannot update a completed or cancelled order.");
    }

    const newItemIds = newItems.map((item) => item.menu_item_id);
    const { data: newMenuData, error: newMenuErr } = await context.supabase
        .from('menu')
        .select('id, name, price, organization_id')
        .in('id', newItemIds)
        .eq('organization_id', context.organizationId);

    if (newMenuErr) throw newMenuErr;

    let addedSubtotal = 0;
    const newOrderItems = newItems.map((item) => {
        const match = newMenuData?.find((menuItem: any) => menuItem.id === item.menu_item_id);
        if (!match) throw new Error(`Menu item ${item.menu_item_id} not found.`);

        const price = Number(match.price) || 0;
        addedSubtotal += price * (item.quantity || 1);

        return {
            order_id: orderId,
            menu_item_id: item.menu_item_id,
            quantity: item.quantity || 1,
            price,
            special_instructions: item.notes || '',
            organization_id: context.organizationId,
        };
    });

    const { error: insertErr } = await context.supabase.from('order_items').insert(newOrderItems);
    if (insertErr) throw insertErr;

    const newSubtotal = (Number(existingOrder.subtotal_amount) || 0) + addedSubtotal;
    const newVat = Math.round(newSubtotal * 0.15 * 100) / 100;
    const newTotal = Math.round((newSubtotal + newVat) * 100) / 100;

    const { error: updateErr } = await context.supabase
        .from('orders')
        .update({
            subtotal_amount: newSubtotal,
            vat_amount: newVat,
            total_amount: newTotal,
        })
        .eq('id', orderId);

    if (updateErr) throw updateErr;

    return {
        order_id: orderId,
        added_items: newOrderItems.length,
        new_total: newTotal,
        new_subtotal: newSubtotal,
        message: "Items added to existing order successfully.",
    };
}

export async function getOrderStatus(context: ToolContext) {
    const orderId = getString(context.params.order_id);
    const tableNumber = getString(context.params.table_number);

    let query = context.supabase
        .from('orders')
        .select('id, order_number, status, payment_status, total_amount, created_at, table_number')
        .eq('organization_id', context.organizationId);

    const tableId = getString(context.params.table_id);
    if (orderId) {
        query = query.eq('id', orderId);
    } else if (tableId || tableNumber) {
        const branchId = resolveBranchId(context);
        const { data: matchingOrders, error: orderErr } = await context.supabase
            .from('orders')
            .select('id, order_number, status, payment_status, total_amount, created_at, table_number, table_id')
            .eq('organization_id', context.organizationId)
            .eq('branch_id', branchId)
            .in('status', ['pending', 'preparing', 'accepted', 'ready'])
            .order('created_at', { ascending: false });

        if (orderErr) throw orderErr;

        let matchedOrder = null;
        if (tableId) {
            matchedOrder = (matchingOrders || []).find((order: any) => order.table_id === tableId);
        } else if (tableNumber) {
            const normalizedTarget = normalizeTableNumber(tableNumber);
            matchedOrder = (matchingOrders || []).find((order: any) => normalizeTableNumber(order.table_number) === normalizedTarget);
        }
        
        return { orders: matchedOrder ? [matchedOrder] : [] };
    } else {
        throw new Error("order_id, table_id or table_number is required.");
    }

    const { data: orderData, error: orderErr } = await query;
    if (orderErr) throw orderErr;

    return { orders: orderData || [] };
}

export async function verifyPayment(context: ToolContext) {
    const reference = getString(context.params.reference);
    const bankKey = getString(context.params.bank_key);
    const orderId = getString(context.params.order_id);
    const branchId = resolveBranchId(context);

    // 1. Check for existing payment with this reference
    const { data: existing } = await context.supabase
        .from('payments')
        .select('id, order_id, status')
        .eq('reference', reference)
        .eq('organization_id', context.organizationId)
        .maybeSingle();

    if (existing) {
        // IDEMPOTENCY: If this reference was already used for THIS order, allow it.
        if (orderId && existing.order_id === orderId) {
            return {
                verified: existing.status === 'verified' ? true : 'pending',
                reference,
                message: existing.status === 'verified' ? "Payment already verified." : "Payment is already being processed."
            };
        }
        return { verified: false, reason: "This reference has already been used on another order. Please double check your payment or contact staff." };
    }

    let orderAmount = 0;
    if (orderId) {
        const { data: order } = await context.supabase
            .from('orders')
            .select('total_amount')
            .eq('id', orderId)
            .maybeSingle();
        if (order) orderAmount = order.total_amount;
    }

    if (orderId) {
        await context.supabase.from('payments').insert({
            organization_id: context.organizationId,
            branch_id: branchId,
            order_id: orderId,
            bank_key: bankKey,
            reference,
            amount: orderAmount,
            status: 'pending',
            source: 'chatbot',
        }).select().maybeSingle();
    }

    return {
        verified: 'pending',
        reference,
        bank_key: bankKey,
        message: "Payment reference recorded. A staff member will verify it shortly.",
    };
}

export async function completeOrder(context: ToolContext) {
    const orderId = getString(context.params.order_id);
    const amountPaid = getNumber(context.params.amount_paid);
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];

    // 1. Fetch Order and associated Table
    const { data: order, error: orderErr } = await context.supabase
        .from('orders')
        .select(`
            id, order_number, total_amount, table_id, organization_id, branch_id, waiter_id,
            waiter:profiles!orders_waiter_id_fkey (full_name)
        `)
        .eq('id', orderId)
        .single();

    if (orderErr || !order) throw new Error("Order not found or access denied.");

    let actualPaid = amountPaid;
    let refValue: string | null = null;
    let bankValue: string | null = 'digital';

    if (!actualPaid) {
        const { data: py } = await context.supabase
            .from('payments')
            .select('amount, reference, bank_key')
            .eq('order_id', orderId)
            .eq('status', 'verified')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        actualPaid = py?.amount || order.total_amount;
        refValue = py?.reference || null;
        bankValue = py?.bank_key || 'digital';
    }

    const subtotal = order.total_amount / 1.15;
    const vat = order.total_amount - subtotal;
    const tin = "0043819230";

    const trueTip = Math.max(0, actualPaid - order.total_amount);
    const trueShortage = Math.max(0, order.total_amount - actualPaid);

    const qrData = {
        v: "1.0",
        oid: order.id,
        onum: order.order_number,
        tin: tin,
        tot: order.total_amount,
        vat: parseFloat(vat.toFixed(2)),
        ts: now
    };

    // 2. Update Order Status
    const { error: updateErr } = await context.supabase
        .from('orders')
        .update({
            status: 'closed',
            payment_status: 'paid',
            payment_method: bankValue,
            transaction_reference: refValue,
            amount_paid: actualPaid,
            tip_amount: trueTip,
            paid_at: now,
            closed_at: now,
            completed_at: now,
            last_updated: now,
            subtotal_amount: parseFloat(subtotal.toFixed(2)),
            vat_amount: parseFloat(vat.toFixed(2)),
            vat_rate: 15.0,
            qr_verification_code: btoa(JSON.stringify(qrData))
        })
        .eq('id', orderId);

    if (updateErr) throw updateErr;

    // 3. Handle Tip Ledger
    if (trueTip > 0 && order.waiter_id) {
        await context.supabase.from('tips_ledger').insert({
            staff_id: order.waiter_id,
            order_id: order.id,
            amount: trueTip,
            tip_type: 'digital',
            organization_id: order.organization_id,
            created_at: now
        });
    }

    // 4. Update Staff Performance
    if (order.waiter_id) {
        const { data: perf } = await context.supabase
            .from('staff_performance_daily')
            .select('id, revenue_attributed, total_shortage, shortages_count, orders_completed')
            .eq('staff_id', order.waiter_id)
            .eq('date', todayStr)
            .maybeSingle();

        if (perf) {
            await context.supabase.from('staff_performance_daily').update({
                revenue_attributed: (perf.revenue_attributed || 0) + (order.total_amount - trueShortage),
                total_shortage: (perf.total_shortage || 0) + trueShortage,
                shortages_count: (perf.shortages_count || 0) + (trueShortage > 0 ? 1 : 0),
                orders_completed: (perf.orders_completed || 0) + 1
            }).eq('id', perf.id);
        } else {
            await context.supabase.from('staff_performance_daily').insert({
                staff_id: order.waiter_id,
                staff_name: order.waiter?.full_name || 'Staff',
                date: todayStr,
                revenue_attributed: order.total_amount - trueShortage,
                total_shortage: trueShortage,
                shortages_count: trueShortage > 0 ? 1 : 0,
                orders_completed: 1,
                organization_id: order.organization_id,
                branch_id: order.branch_id
            });
        }
    }

    // 5. Handle Table and Session Cleanup
    if (order.table_id) {
        await context.supabase
            .from('table_sessions')
            .update({ is_active: false, closed_at: now })
            .eq('table_id', order.table_id)
            .eq('is_active', true);

        await context.supabase
            .from('tables')
            .update({
                status: 'available',
                current_order_id: null,
                current_session_id: null,
                last_updated: now
            })
            .eq('id', order.table_id);
    }

    return {
        success: true,
        order_id: orderId,
        message: "Order completed, tips logged, and table freed successfully."
    };
}
