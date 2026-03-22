import type { JsonRecord, ToolContext } from "./types.ts";

export function ensureObject(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

export function getString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

export function getNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function getArray<T = any>(value: unknown): T[] {
    return Array.isArray(value) ? value as T[] : [];
}

export function normalizeTableNumber(value: unknown): string {
    return getString(value)
        .trim()
        .toUpperCase()
        .replace(/^TABLE\s*/i, '')
        .replace(/^#/, '')
        .replace(/\s+/g, '');
}

export function resolveBranchId(context: ToolContext): string | undefined {
    return getString(context.branchId) || getString(context.params.branch_id) || undefined;
}

export function requireBranchId(context: ToolContext): string {
    const branchId = resolveBranchId(context);
    if (!branchId) {
        throw new Error("branch_id is required for this tool");
    }
    return branchId;
}

export async function resolveTableId(supabase: any, branchId: string, tableNumber: string) {
    const normalizedTarget = normalizeTableNumber(tableNumber);
    const { data: tables, error: tableErr } = await supabase
        .from('tables')
        .select('id, table_number')
        .eq('branch_id', branchId)
        .limit(200);

    if (tableErr) {
        console.error("[MCP-ORDER] Table lookup error:", tableErr);
    }

    const tableData = (tables || []).find((table: any) => normalizeTableNumber(table.table_number) === normalizedTarget);
    if (!tableData) {
        throw new Error(`Could not find table number "${tableNumber}" in this branch.`);
    }

    return tableData.id;
}

export async function resolveTableRecord(supabase: any, branchId: string, tableNumber: string) {
    const normalizedTarget = normalizeTableNumber(tableNumber);
    const { data: tables, error } = await supabase
        .from('tables')
        .select('*')
        .eq('branch_id', branchId)
        .limit(200);

    if (error) {
        throw error;
    }

    return (tables || []).find((table: any) => normalizeTableNumber(table.table_number) === normalizedTarget) || null;
}

export async function resolveOrderItemsByNameOrId(context: ToolContext, items: JsonRecord[]) {
    const branchId = requireBranchId(context);
    const resolvedItems: JsonRecord[] = [];

    for (const item of items) {
        if (getString(item.menu_item_id).length > 10) {
            resolvedItems.push(item);
            continue;
        }

        if (getString(item.name)) {
            const { data: found } = await context.supabase
                .from('view_menu_details')
                .select('id, name, price')
                .eq('organization_id', context.organizationId)
                .eq('branch_id', branchId)
                .ilike('name', `%${item.name}%`)
                .limit(1)
                .maybeSingle();

            if (!found) {
                console.error(`[MCP-ORDER] Could not resolve item by name: "${item.name}"`);
                throw new Error(`Could not find menu item "${item.name}". Please check the menu and try again.`);
            }

            console.log(`[MCP-ORDER] Resolved "${item.name}" -> ${found.id} (${found.name})`);
            resolvedItems.push({ ...item, menu_item_id: found.id });
            continue;
        }

        if (getString(item.menu_item_id)) {
            resolvedItems.push(item);
            continue;
        }

        throw new Error("Item is missing both menu_item_id and name.");
    }

    return resolvedItems;
}
