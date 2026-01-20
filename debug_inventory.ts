
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBeefFillet() {
    console.log("Checking Beef Fillet status...");

    // 1. Find Ingredient ID
    const { data: ingredients } = await supabase
        .from('ingredients')
        .select('id, name, current_stock')
        .ilike('name', '%Beef Fillet%');

    if (!ingredients || ingredients.length === 0) {
        console.log("Beef Fillet not found in ingredients.");
        return;
    }

    const beef = ingredients[0];
    console.log(`Found Ingredient: ${beef.name} (ID: ${beef.id}) | Stock: ${beef.current_stock}`);

    // 2. Find Recipes using this ingredient
    const { data: recipeIngs } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id, out_of_stock_impact, quantity_needed, recipes(name, menu_item_id)')
        .eq('ingredient_id', beef.id);

    if (!recipeIngs || recipeIngs.length === 0) {
        console.log("No recipes use this ingredient.");
        return;
    }

    console.log(`Found ${recipeIngs.length} recipes using ${beef.name}:`);

    recipeIngs.forEach((ri: any) => {
        console.log(`- Recipe: ${ri.recipes?.name}`);
        console.log(`  Impact Setting: ${ri.out_of_stock_impact}`);
        console.log(`  Quantity Needed: ${ri.quantity_needed}`);

        if (ri.out_of_stock_impact !== 'kills_dish') {
            console.warn("  [WARNING] Impact is NOT 'kills_dish'. Determining availability will return TRUE.");
        } else {
            console.log("  [OK] Impact is 'kills_dish'. Should be unavailability.");
        }
    });

    // 3. Check View Result
    if (recipeIngs.length > 0) {
        const menuId = recipeIngs[0].recipes?.menu_item_id;
        if (menuId) {
            const { data: viewResult } = await supabase.from('view_menu_details').select('name, is_available').eq('id', menuId);
            console.log("View Result:", viewResult);
        }
    }
}

checkBeefFillet();
