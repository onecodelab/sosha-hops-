import { toolRegistry } from "./registry.ts";
import { validateToolParams } from "./validation.ts";
import type { ToolContext } from "./types.ts";

export async function dispatchTool(context: ToolContext) {
    const definition = toolRegistry[context.tool];
    if (!definition) {
        throw new Error(`Unknown tool: ${context.tool}`);
    }

    validateToolParams(context.tool, context.params);
    return definition.handler(context);
}
