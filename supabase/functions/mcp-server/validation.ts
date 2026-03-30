import type { JsonRecord } from "./types.ts";
import { getArray, getNumber } from "./utils.ts";

function assert(condition: boolean, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function hasNonEmptyString(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

function validateItems(items: unknown, fieldName: string) {
    const list = getArray<JsonRecord>(items);
    assert(list.length > 0, `${fieldName} array is required and cannot be empty.`);

    for (const item of list) {
        const hasMenuItemId = hasNonEmptyString(item?.menu_item_id);
        const hasName = hasNonEmptyString(item?.name);
        assert(hasMenuItemId || hasName, `Each ${fieldName} entry must include menu_item_id or name.`);

        if (item?.quantity !== undefined) {
            assert(getNumber(item.quantity, NaN) > 0, `Each ${fieldName} entry must have a positive quantity.`);
        }
    }
}

export const toolValidators: Record<string, (params: JsonRecord) => void> = {
    get_menu: () => {},
    get_categories: () => {},
    get_top_performing_items: () => {},
    place_order: (params) => {
        validateItems(params.items, 'items');
        assert(hasNonEmptyString(params.table_id) || hasNonEmptyString(params.table_number), "table_id or table_number is required to place an order.");
    },
    update_order: (params) => {
        assert(hasNonEmptyString(params.order_id), "order_id is required.");
        validateItems(params.new_items, 'new_items');
    },
    get_order_status: (params) => {
        assert(hasNonEmptyString(params.order_id) || hasNonEmptyString(params.table_id) || hasNonEmptyString(params.table_number), "order_id, table_id or table_number is required.");
    },
    verify_payment: (params) => {
        assert(hasNonEmptyString(params.reference), "reference is required.");
        assert(hasNonEmptyString(params.bank_key), "bank_key is required.");
    },
    complete_order: (params) => {
        assert(hasNonEmptyString(params.order_id), "order_id is required.");
    },
    get_branch_info: () => {},
    update_customer_profile: (params) => {
        assert(hasNonEmptyString(params.phone) || hasNonEmptyString(params.session_id), "phone or session_id is required to identify the customer.");
    },
    get_financial_summary: () => {},
    get_staff_performance: () => {},
    get_inventory_risks: () => {},
    get_intelligence_events: () => {},
    get_tables: () => {},
    verify_nfc_tap: (params) => {
        assert(hasNonEmptyString(params.token), "token is required for NFC verification.");
        assert(hasNonEmptyString(params.table_number), "table_number is required for NFC verification.");
    },
    list_tables: () => {},
};

export function validateToolParams(tool: string, params: JsonRecord) {
    const validator = toolValidators[tool];
    if (!validator) {
        throw new Error(`Unknown tool: ${tool}`);
    }

    validator(params);
}
