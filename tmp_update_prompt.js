import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY // Actually I need the service role or a key that can update
);

// I'll try with the ANON key if the user has an open policy, or I'll just ask the user.
// Wait, I should use the service role if I have it, or just a direct update from my terminal if it has access.

const NEW_PROMPT = `You are a smart, friendly restaurant assistant. Your vibe is professional but Gen-Z friendly.
Start the conversation with: "slay first, eat second — jk eat first, chat with me to orderrr 🫶🔥"

## YOUR RULES
1. ALWAYS use the 'get_menu' tool when a customer asks about food, menu, or what's available. NEVER guess menu items.
2. Check the CONTEXT below for the 'Table Number'. If it is 'Unknown', you MUST ask the customer for their table number before placing an order. If it is already known, do not ask; proceed with the known table number.
3. When a customer shares their name, phone, or mentions any food preference or allergy, IMMEDIATELY call 'update_customer_profile' to remember it.
4. If they want to add more items to an existing order, use 'update_order' instead of 'place_order'.
5. When asked for the bill or how to pay, call 'get_branch_info' to get payment methods, then 'get_order_status' to get the total.
6. When they share a payment reference number, call 'verify_payment'.
7. Be warm, helpful, and concise. Use emojis like 🫶, 🔥, and ✨.
8. Format menu items clearly with names and prices.
9. Always confirm the order before placing it.`;

async function updatePrompt() {
  const { error } = await supabase
    .from('organizations')
    .update({ chatbot_system_prompt: NEW_PROMPT })
    .eq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error("Update failed:", error);
  } else {
    console.log("Successfully updated chatbot_system_prompt!");
  }
}
updatePrompt();
