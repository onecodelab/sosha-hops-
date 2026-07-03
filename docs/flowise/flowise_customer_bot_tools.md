# Customer Chatbot: Flowise Tool Javascript Snippets (v3 - Safe Names)

> [!IMPORTANT]
> **FIXING THE 400 ERROR:**
> The "Invalid function name" error happens because your Tool Names have spaces or parentheses. 
> 1. In Flowise, edit each tool.
> 2. Change the **Tool Name** to the exact simple name below (no spaces!).
> 3. Make sure **Streaming** is still **OFF** in your Gemini/OpenAI node.

---

## Tool 1 Name: `verify_table`
**Description**: Verify if a table exists and is ready in this branch.
**Javascript**:
```javascript
const { table_number, branch_id } = $vars;

try {
    const response = await fetch("https://pgglpdnxrvndwxwbmajf.supabase.co/functions/v1/verify-table", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
        },
        body: JSON.stringify({ table_number, branch_id })
    });
    const data = await response.json();
    return JSON.stringify(data);
} catch (error) {
    return "Error: Could not verify table. " + error.message;
}
```

---

## Tool 2 Name: `search_menu`
**Description**: Search for menu items by name or category.
**Javascript**:
```javascript
const { query, category, branch_id } = $vars;

try {
    const response = await fetch("https://pgglpdnxrvndwxwbmajf.supabase.co/functions/v1/search-menu", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
        },
        body: JSON.stringify({ query, category, branch_id })
    });
    const data = await response.json();
    return JSON.stringify(data);
} catch (error) {
    return "Error: Could not search menu. " + error.message;
}
```

---

## Tool 3 Name: `place_order`
**Description**: Place a new order for the customer.
**Javascript**:
```javascript
const { items, table_number, branch_id } = $vars;

try {
    const response = await fetch("https://pgglpdnxrvndwxwbmajf.supabase.co/functions/v1/place-order", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
        },
        body: JSON.stringify({
            items,
            table_number,
            branch_id,
            source: 'chatbot'
        })
    });
    const data = await response.json();
    return JSON.stringify(data);
} catch (error) {
    return "Error: Order placement failed. " + error.message;
}
```

---

## Tool 4 Name: `get_order_status`
**Description**: Check the current status of an order or table.
**Javascript**:
```javascript
const { order_id, table_number, branch_id } = $vars;

try {
    const response = await fetch("https://pgglpdnxrvndwxwbmajf.supabase.co/functions/v1/get-order-status", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
        },
        body: JSON.stringify({ order_id, table_number, branch_id })
    });
    const data = await response.json();
    return JSON.stringify(data);
} catch (error) {
    return "Error: Status check failed. " + error.message;
}
```

---

## Tool 5 Name: `get_branch_info`
**Description**: Get the available payment methods (bank accounts) for this branch.
**Javascript**:
```javascript
const { branch_id } = $vars;

try {
    const response = await fetch("https://pgglpdnxrvndwxwbmajf.supabase.co/functions/v1/get-branch-info", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
        },
        body: JSON.stringify({ branch_id })
    });
    const data = await response.json();
    return JSON.stringify(data);
} catch (error) {
    return "Error: Payment methods fetch failed. " + error.message;
}
```

---

## Tool 6 Name: `verify_payment`
**Description**: Verify a bank transaction reference and close the order.
**Javascript**:
```javascript
const { transaction_id, bank, order_id } = $vars;

try {
    const response = await fetch("https://pgglpdnxrvndwxwbmajf.supabase.co/functions/v1/verify-payment", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
        },
        body: JSON.stringify({ transaction_id, bank, order_id })
    });
    const data = await response.json();
    return JSON.stringify(data);
} catch (error) {
    return "Error: Payment verification failed. " + error.message;
}
```
