import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, resolveIdentity } from "../_shared/identity.ts";
import { dispatchTool } from "./dispatcher.ts";
import { toolRegistry } from "./registry.ts";
import { ensureObject } from "./utils.ts";

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        headers: corsHeaders,
        status,
    });
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        let body: Record<string, any>;
        try {
            body = ensureObject(await req.json());
        } catch {
            return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        const tool = typeof body.tool === 'string' ? body.tool.trim() : '';
        const params = ensureObject(body.params);
        if (!tool) {
            return jsonResponse({ error: "tool is required" }, 400);
        }

        const toolDefinition = toolRegistry[tool];
        if (!toolDefinition) {
            return jsonResponse({ error: "Unknown tool", tool }, 400);
        }

        const identity = await resolveIdentity(req, supabase);
        const { organizationId: identityOrg, branchId: identityBranch } = identity || {};

        const requestOrganizationId = params.organization_id || body.organization_id;
        const requestBranchId = params.branch_id || body.branch_id;
        const hasTrustedIdentity = !!identityOrg && identityOrg !== 'SERVICE_ROLE';
        const hasTrustedBranch = !!identityBranch && identityBranch !== 'SERVICE_ROLE';

        if (hasTrustedIdentity && requestOrganizationId && requestOrganizationId !== identityOrg) {
            return jsonResponse({ error: "Tenant isolation violation", detail: "organization_id mismatch" }, 403);
        }

        if (hasTrustedBranch && requestBranchId && requestBranchId !== identityBranch) {
            return jsonResponse({ error: "Tenant isolation violation", detail: "branch_id mismatch" }, 403);
        }

        let organizationId = hasTrustedIdentity ? identityOrg : requestOrganizationId;
        let branchId = hasTrustedBranch ? identityBranch : requestBranchId;

        if (branchId) {
            const { data: branchRecord, error: branchError } = await supabase
                .from('branches')
                .select('id, organization_id')
                .eq('id', branchId)
                .maybeSingle();

            if (branchError) {
                return jsonResponse({ error: "Failed to validate branch context", detail: branchError.message }, 500);
            }

            if (!branchRecord) {
                return jsonResponse({ error: "Invalid branch context", detail: "branch_id not found" }, 404);
            }

            if (!organizationId) {
                organizationId = branchRecord.organization_id;
            }

            if (branchRecord.organization_id !== organizationId) {
                return jsonResponse({ error: "Tenant isolation violation", detail: "branch does not belong to organization" }, 403);
            }
        }

        if (!organizationId) {
            console.error(`[MCP-ERROR] Unauthorized: Missing organizationId. Tool: ${tool}`);
            return jsonResponse({ error: "Unauthorized", detail: "Invalid token or missing organization context" }, 401);
        }

        if (toolDefinition.requiresBranch && !branchId) {
            return jsonResponse({ error: "branch_id is required for this tool" }, 400);
        }

        console.log(`[MCP-DEBUG] Executing Tool: ${tool}`);
        console.log(`[MCP-DEBUG] Resolved Org: ${organizationId}, Branch: ${branchId}`);

        const result = await dispatchTool({
            supabase,
            organizationId,
            branchId,
            params,
            tool,
        });

        return jsonResponse({ success: true, result }, 200);
    } catch (error: any) {
        console.error("[MCP-SERVER] Error:", error.message);
        return jsonResponse({ success: false, error: error.message }, 500);
    }
});
