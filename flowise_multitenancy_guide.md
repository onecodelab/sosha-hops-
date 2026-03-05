# Dynamic Multi-Branch Chatbot Guide

You do **not** need to create a new Flowise canvas for every branch. You create **ONE** Flowise flow and make it dynamic.

## 1. How it works
Flowise allows you to pass "Variables" when you start a chat. 
In your System Prompt, we use `{{BRANCH_ID}}` and `{{BRANCH_NAME}}`. Flowise will replace these with the real values for each customer.

## 2. In Flowise
1. Open your **Chatflow Configuration** (Settings icon).
2. Go to **Variables**.
3. Add two variables:
   - Name: `BRANCH_ID`, Type: `String`
   - Name: `BRANCH_NAME`, Type: `String`
4. In your **System Prompt**, make sure you are using these:
   - `branch_id="{{BRANCH_ID}}"`
   - `Welcome to {{BRANCH_NAME}}`

## 3. On your Website (Frontend)
When you embed the Flowise chat, you pass the `branch_id` and `branch_name` from your React app.

### Example React Integration:
```javascript
// In your Branch Portal / Ordering Page
const branchInfo = {
  id: "df8a...", // The real ID of the "Mexico" branch
  name: "Mexico Branch"
};

// When initializing Flowise Embed
window.Chatbot.init({
    chatflowid: "<your-chatflow-id>",
    apiHost: "https://cloud.flowiseai.com",
    overrideConfig: {
        vars: {
            BRANCH_ID: branchInfo.id,
            BRANCH_NAME: branchInfo.name
        }
    }
});
```

## 4. Why is it not fetching real data?
If the AI is just "talking" instead of calling the tool:
1. **Tool Description**: Make sure the `search_menu` description says: *"Use this tool to find food items, prices, and availability. ALWAYS use this before answering questions about the menu."*
2. **Model Temperature**: Set your Gemini node temperature to **0** or **0.1**. If it's too high, the AI gets "creative" and forgets to use tools.
3. **Tool Connection**: Ensure the `Custom Tool` nodes are physically connected to the `Tools Agent` node.
