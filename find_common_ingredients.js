const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function findCommonIngredient() {
    const { data, error } = await supabase
        .from('ingredients')
        .select(`
            name,
            recipe_ingredients (
                id
            )
        `);

    if (error) {
        console.error(error);
        return;
    }

    const counts = data.map(i => ({
        name: i.name,
        count: i.recipe_ingredients.length
    })).sort((a, b) => b.count - a.count);

    console.log(JSON.stringify(counts.slice(0, 5), null, 2));
}

findCommonIngredient();
