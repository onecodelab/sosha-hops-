import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

type UnitRow = {
  id: string;
  abbreviation?: string | null;
  name?: string | null;
  type?: string | null;
  base_factor?: number | null;
};

type RecipeIngredientRow = {
  ingredient_id: string;
  quantity_needed: number;
  unit_id?: string | null;
  out_of_stock_impact?: 'kills_dish' | 'disable_variant' | 'optional' | null;
  ingredient?: {
    id: string;
    name?: string | null;
    unit_id?: string | null;
    weight_per_unit?: number | null;
  } | null;
};

type OrderItemRow = {
  id: string;
  menu_item_id: string;
  quantity: number;
};

function normalizeBase64(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  return padding === 0 ? normalized : normalized + '='.repeat(4 - padding);
}

function resolveUnit(input: string | UnitRow | undefined, unitRegistry: UnitRow[]): Partial<UnitRow> | undefined {
  if (!input) return undefined;
  if (typeof input === 'object') return input;
  const found = unitRegistry.find((u) => u.id === input);
  if (found) return found;
  return {
    abbreviation: input.toLowerCase(),
    base_factor: 1,
    type: 'count',
  };
}

function getConversionFactor(
  fromUnit: string | UnitRow | undefined,
  toUnit: string | UnitRow | undefined,
  weightPerUnit: number = 1,
  unitRegistry: UnitRow[] = []
): number {
  const from = resolveUnit(fromUnit, unitRegistry);
  const to = resolveUnit(toUnit, unitRegistry);

  if (!from || !to) return 1;
  if (from.id && to.id && from.id === to.id) return 1;
  if (from.abbreviation && to.abbreviation && from.abbreviation === to.abbreviation) return 1;

  if (from.base_factor !== undefined && to.base_factor !== undefined && from.type === to.type) {
    return Number(to.base_factor) / Number(from.base_factor);
  }

  if (from.type === 'count' && (to.type === 'mass' || to.type === 'volume')) {
    return Number(to.base_factor || 1) / Number(weightPerUnit || 1);
  }

  if ((from.type === 'mass' || from.type === 'volume') && to.type === 'count') {
    return Number(weightPerUnit || 1) / Number(from.base_factor || 1);
  }

  return 1;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await authClient.auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: 'Missing order_id' }), { status: 400, headers: corsHeaders });
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile?.organization_id) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), { status: 403, headers: corsHeaders });
    }

    if (!['owner', 'admin', 'manager', 'kitchen'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403, headers: corsHeaders });
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        branch_id,
        accepted_at,
        order_items (
          id,
          menu_item_id,
          quantity
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: corsHeaders });
    }

    const { data: branch, error: branchErr } = await supabase
      .from('branches')
      .select('organization_id')
      .eq('id', order.branch_id)
      .single();

    if (branchErr || !branch || branch.organization_id !== profile.organization_id) {
      return new Response(JSON.stringify({ error: 'Unauthorized for this branch' }), { status: 403, headers: corsHeaders });
    }

    if (!Array.isArray(order.order_items) || order.order_items.length === 0) {
      return new Response(JSON.stringify({ error: 'Order has no items to consume' }), { status: 400, headers: corsHeaders });
    }

    const { data: existingConsumption } = await supabase
      .from('inventory_transactions')
      .select('id')
      .eq('reference_type', 'order_consumption')
      .eq('reference_id', order.id)
      .limit(1);
    const hasExistingConsumption = !!existingConsumption && existingConsumption.length > 0;

    const { data: unitRows } = await supabase
      .from('units')
      .select('id, abbreviation, name, type, base_factor');

    const unitRegistry = (unitRows || []) as UnitRow[];
    const menuItemIds = [...new Set((order.order_items as OrderItemRow[]).map((item) => item.menu_item_id).filter(Boolean))];

    const { data: recipes, error: recipeErr } = await supabase
      .from('recipes')
      .select(`
        id,
        menu_item_id,
        recipe_ingredients (
          ingredient_id,
          quantity_needed,
          unit_id,
          out_of_stock_impact,
          ingredient:ingredients (
            id,
            name,
            unit_id,
            weight_per_unit
          )
        )
      `)
      .in('menu_item_id', menuItemIds);

    if (recipeErr) {
      return new Response(JSON.stringify({ error: `Recipe lookup failed: ${recipeErr.message}` }), { status: 400, headers: corsHeaders });
    }

    const recipeByMenuId = new Map<string, any>();
    (recipes || []).forEach((recipe: any) => {
      recipeByMenuId.set(recipe.menu_item_id, recipe);
    });

    const consumptionMap = new Map<string, {
      ingredient_id: string;
      ingredient_name: string;
      quantity: number;
      out_of_stock_impact: 'kills_dish' | 'disable_variant' | 'optional';
      ingredient_unit_id?: string | null;
      weight_per_unit?: number | null;
    }>();

    for (const orderItem of order.order_items as OrderItemRow[]) {
      const recipe = recipeByMenuId.get(orderItem.menu_item_id);
      if (!recipe?.recipe_ingredients?.length) continue;

      for (const ri of recipe.recipe_ingredients as RecipeIngredientRow[]) {
        const ingredient = ri.ingredient;
        if (!ingredient?.id) continue;

        const inventoryUnit = ingredient.unit_id || 'g';
        const recipeUnit = ri.unit_id || inventoryUnit;
        const factor = getConversionFactor(
          inventoryUnit,
          recipeUnit,
          Number(ingredient.weight_per_unit || 1),
          unitRegistry
        );

        const deduction = Number(orderItem.quantity || 0) * Number(ri.quantity_needed || 0) * factor;
        if (!Number.isFinite(deduction) || deduction <= 0) continue;

        const existing = consumptionMap.get(ingredient.id);
        consumptionMap.set(ingredient.id, {
          ingredient_id: ingredient.id,
          ingredient_name: ingredient.name || 'Ingredient',
          quantity: (existing?.quantity || 0) + deduction,
          out_of_stock_impact: ri.out_of_stock_impact || 'kills_dish',
          ingredient_unit_id: ingredient.unit_id || null,
          weight_per_unit: ingredient.weight_per_unit || null,
        });
      }
    }

    if (consumptionMap.size === 0) {
      return new Response(JSON.stringify({
        success: true,
        consumed: 0,
        message: 'No recipe-linked ingredients found for this order'
      }), {
        headers: corsHeaders,
        status: 200
      });
    }

    const now = new Date().toISOString();
    let consumedCount = 0;

    if (!hasExistingConsumption) {
      const ingredientIds = [...consumptionMap.keys()];
      const { data: stockRows, error: stockErr } = await supabase
        .from('branch_inventory')
        .select('id, ingredient_id, current_stock')
        .eq('branch_id', order.branch_id)
        .in('ingredient_id', ingredientIds);

      if (stockErr) {
        return new Response(JSON.stringify({ error: `Stock lookup failed: ${stockErr.message}` }), { status: 400, headers: corsHeaders });
      }

      const stockByIngredient = new Map<string, any>();
      (stockRows || []).forEach((row: any) => stockByIngredient.set(row.ingredient_id, row));

      const shortages: string[] = [];
      const deductions: Array<{ ingredient_id: string; amount: number }> = [];

      for (const [ingredientId, requirement] of consumptionMap.entries()) {
        const stock = stockByIngredient.get(ingredientId);
        const required = Number(requirement.quantity || 0);
        const available = Number(stock?.current_stock ?? 0);

        if (!stock) {
          if (requirement.out_of_stock_impact === 'kills_dish') {
            shortages.push(`${requirement.ingredient_name}: no stock row in this branch`);
          }
          continue;
        }

        if (available < required) {
          if (requirement.out_of_stock_impact === 'kills_dish') {
            shortages.push(`${requirement.ingredient_name}: needs ${required.toFixed(2)}, has ${available.toFixed(2)}`);
            continue;
          }
          deductions.push({ ingredient_id: ingredientId, amount: Math.min(required, available) });
          continue;
        }

        deductions.push({ ingredient_id: ingredientId, amount: required });
      }

      if (shortages.length > 0) {
        return new Response(JSON.stringify({
          error: 'Insufficient stock for recipe-mapped ingredients',
          shortages
        }), { status: 400, headers: corsHeaders });
      }

          const consumptionLogs = deductions
        .filter((d) => d.amount > 0)
        .map((d) => ({
          ingredient_id: d.ingredient_id,
          branch_id: order.branch_id,
          organization_id: profile.organization_id,
          transaction_type: 'sale',
          quantity: -Math.abs(d.amount),
          reference_type: 'order_consumption',
          reference_id: order.id,
          performed_by: user.id,
          reason: `Prep Station deduction for order ${order.order_number || order.id}`,
          created_at: now,
        }));

      consumedCount = consumptionLogs.length;

      if (consumptionLogs.length > 0) {
        const { error: logErr } = await supabase.from('inventory_transactions').insert(consumptionLogs);
        if (logErr) {
          return new Response(JSON.stringify({ error: `Failed to log consumption: ${logErr.message}` }), { status: 400, headers: corsHeaders });
        }

        for (const deduction of deductions) {
          const { data: currentRow, error: currentErr } = await supabase
            .from('branch_inventory')
            .select('id, current_stock')
            .eq('branch_id', order.branch_id)
            .eq('ingredient_id', deduction.ingredient_id)
            .maybeSingle();

          if (currentErr) {
            return new Response(JSON.stringify({ error: `Failed to read branch stock: ${currentErr.message}` }), { status: 400, headers: corsHeaders });
          }

          if (!currentRow) continue;

          const newStock = Math.max(0, Number(currentRow.current_stock || 0) - Number(deduction.amount || 0));
          const { error: updateErr } = await supabase
            .from('branch_inventory')
            .update({
              current_stock: newStock,
              last_updated: now
            })
            .eq('id', currentRow.id);

          if (updateErr) {
            return new Response(JSON.stringify({ error: `Failed to update branch stock: ${updateErr.message}` }), { status: 400, headers: corsHeaders });
          }
        }
      }
    }

    const { error: orderUpdateErr } = await supabase
      .from('orders')
      .update({
        status: 'accepted',
        accepted_at: order.accepted_at || now,
        last_updated: now,
      })
      .eq('id', order.id);

    if (orderUpdateErr) {
      return new Response(JSON.stringify({ error: `Order update failed: ${orderUpdateErr.message}` }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      success: true,
      order_id: order.id,
      consumed: consumedCount,
      shortages: null
    }), {
      headers: corsHeaders,
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
