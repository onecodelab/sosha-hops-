
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pgglpdnxrvndwxwbmajf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2xwZG54cnZuZHd4d2JtYWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTc4NzUsImV4cCI6MjA3OTk3Mzg3NX0.Sn2eJY8mvN-IeEJnOxnI7GPFNbIGqKqAp8F9vZrMEZM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking recipe_ingredients schema...");
    const { data: ri, error: riErr } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .limit(1);

    if (riErr) {
        console.error("Query Failed:", JSON.stringify(riErr, null, 2));
    } else {
        console.log("recipe_ingredients Sample:", JSON.stringify(ri[0], null, 2));
    }

    console.log("Checking ingredients schema...");
    const { data: ing, error: ingErr } = await supabase
        .from('ingredients')
        .select('*')
        .limit(1);

    if (ingErr) {
        console.error("Query Failed:", JSON.stringify(ingErr, null, 2));
    } else {
        console.log("ingredients Sample:", JSON.stringify(ing[0], null, 2));
    }
}

checkSchema();
