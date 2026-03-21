import { updateCustomerProfile } from "./handlers/customer.ts";
import { getFinancialSummary, getIntelligenceEvents, getInventoryRisks, getStaffPerformance } from "./handlers/intelligence.ts";
import { getCategories, getMenu, getTopPerformingItems } from "./handlers/menu.ts";
import { getOrderStatus, placeOrder, updateOrder, verifyPayment } from "./handlers/orders.ts";
import { getBranchInfo, getTables, listTables, verifyNFCTap } from "./handlers/tables.ts";
import { toolValidators } from "./validation.ts";
import type { ToolDefinition } from "./types.ts";

export const toolRegistry: Record<string, ToolDefinition> = {
    get_categories: {
        name: 'get_categories',
        handler: getCategories,
        validate: toolValidators.get_categories,
    },
    get_top_performing_items: {
        name: 'get_top_performing_items',
        handler: getTopPerformingItems,
        validate: toolValidators.get_top_performing_items,
    },
    get_menu: {
        name: 'get_menu',
        handler: getMenu,
        validate: toolValidators.get_menu,
    },
    place_order: {
        name: 'place_order',
        handler: placeOrder,
        validate: toolValidators.place_order,
        requiresBranch: true,
    },
    update_order: {
        name: 'update_order',
        handler: updateOrder,
        validate: toolValidators.update_order,
    },
    get_order_status: {
        name: 'get_order_status',
        handler: getOrderStatus,
        validate: toolValidators.get_order_status,
    },
    verify_payment: {
        name: 'verify_payment',
        handler: verifyPayment,
        validate: toolValidators.verify_payment,
    },
    get_branch_info: {
        name: 'get_branch_info',
        handler: getBranchInfo,
        validate: toolValidators.get_branch_info,
        requiresBranch: true,
    },
    update_customer_profile: {
        name: 'update_customer_profile',
        handler: updateCustomerProfile,
        validate: toolValidators.update_customer_profile,
    },
    get_financial_summary: {
        name: 'get_financial_summary',
        handler: getFinancialSummary,
        validate: toolValidators.get_financial_summary,
    },
    get_staff_performance: {
        name: 'get_staff_performance',
        handler: getStaffPerformance,
        validate: toolValidators.get_staff_performance,
    },
    get_inventory_risks: {
        name: 'get_inventory_risks',
        handler: getInventoryRisks,
        validate: toolValidators.get_inventory_risks,
    },
    get_intelligence_events: {
        name: 'get_intelligence_events',
        handler: getIntelligenceEvents,
        validate: toolValidators.get_intelligence_events,
    },
    get_tables: {
        name: 'get_tables',
        handler: getTables,
        validate: toolValidators.get_tables,
        requiresBranch: true,
    },
    verify_nfc_tap: {
        name: 'verify_nfc_tap',
        handler: verifyNFCTap,
        validate: toolValidators.verify_nfc_tap,
        requiresBranch: true,
    },
    list_tables: {
        name: 'list_tables',
        handler: listTables,
        validate: toolValidators.list_tables,
        requiresBranch: true,
    },
};
