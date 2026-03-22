import type { ToolContext } from "../types.ts";
import { getString, normalizeTableNumber, requireBranchId, resolveBranchId, resolveTableRecord } from "../utils.ts";

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

    let tableData = null;
    try {
        tableData = await resolveTableRecord(context.supabase, branchId, tableNumber);
    } catch (tableErr) {
        console.error("[NFC] Table lookup failed:", tableErr);
    }

    if (!tableData) {
        console.error("[NFC] Invalid token or table not found");
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

    let tableNumbers = (tables || []).map((table: any) => table.table_number);
    console.log(`[MCP-LIST-TABLES] Found ${tableNumbers.length} tables for branch ${branchId}`);

    // AUTO-SEED: If no tables exist for this branch, seed some default ones
    if (tableNumbers.length === 0 && branchId) {
        console.log(`[MCP-LIST-TABLES] SEEDING default tables for branch ${branchId}...`);
        const defaultTables = [
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
            'C1', 'C2', 'C3', 'C4', 'C5', 'C8', 'T1', 'T2'
        ];
        
        const seedData = defaultTables.map(num => ({
            branch_id: branchId,
            table_number: num,
            status: 'available',
            organization_id: context.organizationId
        }));

        const { error: seedErr } = await context.supabase.from('tables').insert(seedData);
        if (seedErr) {
            console.error("[MCP-LIST-TABLES] Seed Error:", seedErr);
        } else {
            console.log(`[MCP-LIST-TABLES] Successfully seeded ${defaultTables.length} tables.`);
            tableNumbers = defaultTables;
        }
    }

    return {
        tables: tableNumbers,
        normalized_tables: tableNumbers.map((table: string) => normalizeTableNumber(table)),
        count: tableNumbers.length,
        message: tableNumbers.length === 0 ? "No tables found and seeding failed." : "Success",
    };
}
