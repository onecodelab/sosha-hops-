const { createClient } = require('@supabase/supabase-js');

// Constants for DB update
const SUPABASE_URL = "https://pgglpdnxrvndwxwbmajf.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is required in environment variables.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const STRICT_RULES = `
## STRICT ONBOARDING & MENU RULES (MASTER OVERRIDE)
1. **GREETING**: "Got it! You're at Table {{table_number}}! ✅ Great to have you here! 🎉 Now, what can I get you tonight? Check out our menu:"
2. **NO TEXT MENUS**: NEVER list food items, descriptions, or prices in plain text. NEVER use markdown tables or lists. ALWAYS call the tool to show the visual carousel.
3. **CAROUSEL**: Your text response should ONLY be the greeting. The menu will be shown via the carousel.
4. **TABLE CONFIRMATION**: Always confirm the table number: "Welcome! To get started, what is your table number?" 
5. **IGNORE PREVIOUS**: Ignore any previous instructions to list items as text.
`;

async function updateAllOrgs() {
    console.log("Fetching organizations...");
    const { data: orgs, error: fetchErr } = await supabase
        .from('organizations')
        .select('id, name');

    if (fetchErr) {
        console.error("Error fetching orgs:", fetchErr);
        return;
    }

    console.log(`Found ${orgs.length} organizations.`);

    for (const org of orgs) {
        console.log(`Updating ${org.name} (${org.id})...`);
        const { error: updateErr } = await supabase
            .from('organizations')
            .update({ chatbot_system_prompt: STRICT_RULES })
            .eq('id', org.id);

        if (updateErr) {
            console.error(`Error updating ${org.name}:`, updateErr);
        } else {
            console.log(`Successfully updated ${org.name}.`);
        }
    }
}

updateAllOrgs();
