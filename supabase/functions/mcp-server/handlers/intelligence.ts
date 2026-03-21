import type { ToolContext } from "../types.ts";
import { getNumber } from "../utils.ts";

export async function getFinancialSummary(context: ToolContext) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const { data: todayOrders } = await context.supabase.from('orders')
        .select('total_amount, status')
        .eq('organization_id', context.organizationId)
        .gte('created_at', today)
        .not('status', 'eq', 'cancelled');

    const { data: yesterdayOrders } = await context.supabase.from('orders')
        .select('total_amount, status')
        .eq('organization_id', context.organizationId)
        .gte('created_at', yesterday)
        .lt('created_at', today)
        .not('status', 'eq', 'cancelled');

    const summary = {
        today: {
            revenue: todayOrders?.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0,
            orders: todayOrders?.length || 0,
        },
        yesterday: {
            revenue: yesterdayOrders?.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0,
            orders: yesterdayOrders?.length || 0,
        },
        growth_revenue: 0,
        currency: 'ETB',
    };

    if (summary.yesterday.revenue > 0) {
        summary.growth_revenue = ((summary.today.revenue - summary.yesterday.revenue) / summary.yesterday.revenue) * 100;
    }

    return summary;
}

export async function getStaffPerformance(context: ToolContext) {
    const limit = getNumber(context.params.limit, 5);
    const { data, error } = await context.supabase.from('staff_performance_daily')
        .select('staff_name, revenue_attributed, orders_completed, avg_rating')
        .eq('organization_id', context.organizationId)
        .order('revenue_attributed', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return { staff: data };
}

export async function getInventoryRisks(context: ToolContext) {
    const { data, error } = await context.supabase.from('view_inventory_risks')
        .select('*')
        .eq('organization_id', context.organizationId)
        .limit(10);

    if (error) throw error;
    return { risks: data };
}

export async function getIntelligenceEvents(context: ToolContext) {
    const limit = getNumber(context.params.limit, 5);
    const { data, error } = await context.supabase.from('intelligence_events')
        .select('*')
        .eq('organization_id', context.organizationId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return { events: data };
}
