import type { ToolContext } from "../types.ts";
import { getString, resolveBranchId } from "../utils.ts";

export async function getCategories(context: ToolContext) {
    const targetBranch = resolveBranchId(context);
    let dbQuery = context.supabase
        .from('view_menu_details')
        .select('category')
        .eq('organization_id', context.organizationId);

    if (targetBranch) {
        dbQuery = dbQuery.eq('branch_id', targetBranch);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;

    const categories = [...new Set((data || []).map((item: any) => item.category).filter(Boolean))];
    return { categories };
}

export async function getTopPerformingItems(context: ToolContext) {
    const targetBranch = resolveBranchId(context);
    let dbQuery = context.supabase
        .from('view_menu_details')
        .select('id, name, price, category, image_url, description, is_available')
        .eq('organization_id', context.organizationId)
        .eq('is_available', true);

    if (targetBranch) {
        dbQuery = dbQuery.eq('branch_id', targetBranch);
    }

    const { data, error } = await dbQuery.limit(10);
    if (error) throw error;

    return { items: (data || []).slice(0, 6) };
}

export async function getMenu(context: ToolContext) {
    const queryStr = getString(context.params.query);
    const catStr = getString(context.params.category);
    const targetBranch = resolveBranchId(context);

    console.log(`[MCP-MENU] Searching for: query="${queryStr}", cat="${catStr}", branch="${targetBranch}"`);

    let dbQuery = context.supabase
        .from('view_menu_details')
        .select('id, name, price, category, image_url, is_available, description')
        .eq('organization_id', context.organizationId);

    if (targetBranch) {
        dbQuery = dbQuery.eq('branch_id', targetBranch);
    }

    if (catStr) dbQuery = dbQuery.ilike('category', `%${catStr}%`);
    if (queryStr) dbQuery = dbQuery.ilike('name', `%${queryStr}%`);

    const { data, error } = await dbQuery.limit(20);
    if (error) throw error;

    const items = data || [];
    console.log(`[MCP-MENU] Found ${items.length} items.`);
    return { items };
}
