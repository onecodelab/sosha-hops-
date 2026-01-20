
import { Ingredient, MenuDish } from '../types';

export type StockImpact = 'kills_dish' | 'disable_variant' | 'optional';

export interface RecipeIngredient {
    ingredient_id: string;
    quantity_needed: number;
    unit_type: string;
    out_of_stock_impact: StockImpact;
    ingredient?: Ingredient;
}

/**
 * Normalizes units and returns a factor to multiply the Inventory Cost per Unit
 * to get the cost for the Recipe Unit.
 * Example: If inventory is in 'kg' and recipe is in 'g', factor = 0.001
 */
export const getConversionFactor = (
    inventoryUnit: string,
    recipeUnit: string,
    weightPerUnit: number = 1
): number => {
    const from = inventoryUnit?.toLowerCase();
    const to = recipeUnit?.toLowerCase();

    if (from === to) return 1;

    // Mass <-> Mass
    if (from === 'kg' && to === 'g') return 0.001;
    if (from === 'g' && to === 'kg') return 1000;

    // Volume <-> Volume
    if (from === 'l' && to === 'ml') return 0.001;
    if (from === 'ml' && to === 'l') return 1000;

    // Discrete <-> Mass/Volume (Deep Logic)
    // If inventory is in kg/l but recipe is in pcs/slice/unit
    if ((from === 'kg' || from === 'l') && (to === 'pcs' || to === 'slice' || to === 'unit')) {
        return weightPerUnit / 1000; // 1 pc = X grams = X/1000 kg
    }
    // If inventory is in g/ml but recipe is in pcs/slice/unit
    if ((from === 'g' || from === 'ml') && (to === 'pcs' || to === 'slice' || to === 'unit')) {
        return weightPerUnit; // 1 pc = X grams
    }

    // Inverse: If inventory is in pcs but recipe is in mass (rare but possible)
    if ((from === 'pcs' || from === 'slice' || from === 'unit') && (to === 'g' || to === 'ml')) {
        return 1 / weightPerUnit;
    }

    if ((from === 'pcs' || from === 'slice' || from === 'unit') && (to === 'kg' || to === 'l')) {
        return 1000 / weightPerUnit;
    }

    return 1;
};

/**
 * Calculates the cost for a single recipe ingredient based on inventory cost.
 */
export const calculateIngredientCost = (ri: RecipeIngredient): number => {
    if (!ri.ingredient || ri.ingredient.cost_per_unit === undefined) return 0;

    const factor = getConversionFactor(
        ri.ingredient.unit_type || ri.ingredient.unittype || 'g',
        ri.unit_type,
        ri.ingredient.weight_per_unit || 1
    );

    const recipeQtyInInventoryUnits = ri.quantity_needed * factor;
    return recipeQtyInInventoryUnits * (ri.ingredient.cost_per_unit || 0);
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
