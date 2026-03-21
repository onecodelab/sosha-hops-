import type { ToolContext } from "../types.ts";
import { getString, requireBranchId, resolveBranchId } from "../utils.ts";

export async function getBranchInfo(context: ToolContext) {
    const branchId = requireBranchId(context);
    const { data: branch, error: branchError } = await context.supabase
        .from('branches')
        .select('id, name, location')
        .eq('id', branchId)
        .eq('organization_id', context.organizationId)
        .single();

    if (branchError) throw branchError;

    const { data: banks } = await context.supabase
        .from('bank_settings')
        .select('bank_key, account_number')
        .eq('organization_id', context.organizationId)
        .eq('is_active', true);

    return {
        branch,
        payment_methods: (banks || []).filter((bank: any) => bank.account_number),
    };
}

export async function getTables(context: ToolContext) {
    const branchId = requireBranchId(context);
    const { data, error } = await context.supabase
        .from('tables')
        .select('id, table_number, pos_x, pos_y')
        .eq('branch_id', branchId);

    if (error) throw error;
    return { tables: data || [] };
}

export async function verifyNFCTap(context: ToolContext) {
    const token = getString(context.params.token);
    const tableNumber = getString(context.params.table_number);
    const sessionId = getString(context.params.session_id);
    const branchId = requireBranchId(context);

    const { data: tableData, error: tableErr } = await context.supabase
        .from('tables')
        .select('*')
        .eq('table_number', tableNumber)
        .eq('branch_id', branchId)
        .single();

    if (tableErr || !tableData) {
        console.error("[NFC] Invalid token or table not found:", tableErr);
        return { success: false, reason: "Invalid verification token." };
    }

    let currentSession = tableData.active_session || { seated_at: new Date().toISOString(), sessions: [] };
    if (!currentSession.sessions) currentSession.sessions = [];
    if (!currentSession.sessions.includes(sessionId)) {
        currentSession.sessions.push(sessionId);
    }

    const { error: updateErr } = await context.supabase
        .from('tables')
        .update({
            status: 'occupied',
            active_session: currentSession,
        })
        .eq('id', tableData.id);

    if (updateErr) {
        console.error("[NFC] Failed to update table occupancy:", updateErr);
    }

    return { success: true, table_id: tableData.id };
}

export async function listTables(context: ToolContext) {
    const branchId = requireBranchId(context);
    const { data: tables, error } = await context.supabase
        .from('tables')
        .select('table_number')
        .eq('branch_id', branchId);

    if (error) {
        throw new Error(`Database Error listing tables: ${error.message}`);
    }

    const tableNumbers = (tables || []).map((table: any) => table.table_number);
    console.log(`[MCP-LIST-TABLES] Found ${tableNumbers.length} tables for branch ${branchId}`);

    return {
        tables: tableNumbers,
        count: tableNumbers.length,
        message: tableNumbers.length === 0 ? "No tables found in this branch." : "Success",
    };
}
