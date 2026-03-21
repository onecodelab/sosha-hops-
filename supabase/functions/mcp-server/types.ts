export type JsonRecord = Record<string, any>;

export interface ToolContext {
    supabase: any;
    organizationId: string;
    branchId?: string;
    params: JsonRecord;
    tool: string;
}

export type ToolHandler = (context: ToolContext) => Promise<any>;

export interface ToolDefinition {
    name: string;
    handler: ToolHandler;
    validate?: (params: JsonRecord) => void;
    requiresBranch?: boolean;
}
