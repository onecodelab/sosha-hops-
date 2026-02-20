
import { Ingredient, MenuDish, Unit } from '../types';

export type StockImpact = 'kills_dish' | 'disable_variant' | 'optional';

export interface RecipeIngredient {
    ingredient_id: string;
    quantity_needed: number;
    unit_id?: string;
    unit_type?: string; // Legacy
    out_of_stock_impact: StockImpact;
    ingredient?: Ingredient;
}

/**
 * Normalizes units using mathematically precise Base Factors.
 */
export const getConversionFactor = (
    fromUnit: string | Unit | undefined,
    toUnit: string | Unit | undefined,
    weightPerUnit: number = 1,
    unitRegistry?: Unit[]
): number => {
    // 1. Resolve to Unit Objects if possible
    const resolveUnit = (u: string | Unit | undefined): Partial<Unit> | undefined => {
        if (!u) return undefined;
        if (typeof u === 'object') return u;
        // If it's a UUID, look up in registry
        if (unitRegistry && u.length > 30) {
            return unitRegistry.find(r => r.id === u);
        }
        // Legacy string matching (best effort)
        const lower = u.toLowerCase();
        return { abbreviation: lower, base_factor: 1, type: 'count' as any }; // Default
    };

    const from = resolveUnit(fromUnit);
    const to = resolveUnit(toUnit);

    if (!from || !to) return 1;
    if (from.id === to.id && from.id) return 1;
    if (from.abbreviation === to.abbreviation) return 1;

    // 2. Base Factor Math (Agent-Ready)
    // Formula: (Target Base Factor / Source Base Factor)
    if (from.base_factor !== undefined && to.base_factor !== undefined && from.type === to.type) {
        return Number(to.base_factor) / Number(from.base_factor);
    }

    // 3. Cross-Type Math (Pieces -> Metric) using Weight
    if (from.type === 'count' && (to.type === 'mass' || to.type === 'volume')) {
        return Number(to.base_factor || 1) / Number(weightPerUnit);
    }

    // If FROM is Metric and TO is Count
    if ((from.type === 'mass' || from.type === 'volume') && to.type === 'count') {
        return Number(weightPerUnit) / Number(from.base_factor || 1);
    }

    const fStr = from.abbreviation?.toLowerCase();
    const tStr = to.abbreviation?.toLowerCase();

    if (fStr === 'kg' && tStr === 'g') return 0.001;
    if (fStr === 'g' && tStr === 'kg') return 1000;
    if (fStr === 'l' && tStr === 'ml') return 0.001;
    if (fStr === 'ml' && tStr === 'l') return 1000;

    return 1;
};

/**
 * Calculates the cost for a single recipe ingredient based on inventory cost.
 */
export const calculateIngredientCost = (ri: any, unitRegistry?: Unit[]): number => {
    // Determine cost and weight from either the nested ingredient object or the flattened props
    const costPerUnit = ri.ingredient?.cost_per_unit ?? ri.cost_per_unit;
    const weightPerUnit = ri.ingredient?.weight_per_unit ?? ri.weight_per_unit ?? 1;

    // New Unit ID logic first
    const inventoryUnit = ri.ingredient?.unit_id ?? ri.inventory_unit_id ?? ri.ingredient?.unit_type ?? 'g';
    const recipeUnit = ri.unit_id ?? ri.unit_type ?? 'g';

    if (costPerUnit === undefined || costPerUnit === null) return 0;

    const factor = getConversionFactor(
        inventoryUnit,
        recipeUnit,
        weightPerUnit,
        unitRegistry
    );

    const recipeQtyInInventoryUnits = ri.quantity_needed * factor;
    return recipeQtyInInventoryUnits * (costPerUnit || 0);
};

/**
 * Calculates the total cost-per-plate for a dish.
 */
export const calculateCostPerPlate = (ingredients: RecipeIngredient[]): number => {
    return ingredients.reduce((sum, ri) => sum + calculateIngredientCost(ri), 0);
};

/**
 * Determines dish availability based on inventory stock levels and impact rules.
 */
export const checkDishAvailability = (ingredients: RecipeIngredient[]): {
    isAvailable: boolean;
    reason?: string;
    affectedVariants?: string[];
} => {
    for (const ri of ingredients) {
        if (!ri.ingredient) continue;

        const isOutOfStock = ri.ingredient.current_stock <= 0;

        if (isOutOfStock && ri.out_of_stock_impact === 'kills_dish') {
            return { isAvailable: false, reason: `Out of ${ri.ingredient.name}` };
        }

        // Low stock could be handled here if needed, but requirements focus on Out of Stock.
    }

    return { isAvailable: true };
};

/**
 * Calculates Margin and Margin %
 */
export const calculateMargins = (price: number, cost: number) => {
    const margin = price - cost;
    const marginPercent = price > 0 ? (margin / price) * 100 : 0;
    return { margin, marginPercent };
};
