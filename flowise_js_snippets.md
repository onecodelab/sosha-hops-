# Master Agent: Flowise Tool Javascript Snippets

Copy these snippets into the **Javascript Function** box for each respective tool in Flowise. 

> [!IMPORTANT]
> Replace `YOUR_SUPABASE_ANON_KEY` with the long key from your `.env` file (`VITE_SUPABASE_ANON_KEY`).

## 1. search_menu (Eyes of the Agent)
**Endpoint**: `https://pgglpdnxrwndwxbmajf.supabase.co/functions/v1/search-menu`
**Paste JSON (Input Schema)**:
```json
{
    "type": "object",
    "properties": {
        "query": { "type": "string", "description": "Name of the dish" },
        "category": { "type": "string", "description": "Food category" }
    },
    "required": ["query"]
}
```
> [!IMPORTANT]
> Check your Supabase Dashboard! If the URL for your search function is different, use YOUR actual URL in the Javascript below.

**Javascript**:
```javascript
const fetch = require('node-fetch');
const { query, category } = $vars;

// The AI might try to send IDs, we will ignore them for the search query to prevent schema errors
const response = await fetch("https://pgglpdnxrwndwxbmajf.supabase.co/functions/v1/search-menu", {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
    },
    body: JSON.stringify({ query, category })
});

const data = await response.json();
return JSON.stringify(data);
```

## 2. manage_menu
**Endpoint**: `https://pgglpdnxrwndwxbmajf.supabase.co/functions/v1/manage-menu`
```javascript
const fetch = require('node-fetch');
const { action, item, target_id, user_id } = $vars;

const response = await fetch("https://pgglpdnxrwndwxbmajf.supabase.co/functions/v1/manage-menu", {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
    },
    body: JSON.stringify({ action: action === 'update' ? 'upsert' : action, item, target_id, user_id })
});

const data = await response.json();
return JSON.stringify(data);
```

## 2. manage_inventory
**Endpoint**: `https://pgglpdnxrwndwxbmajf.supabase.co/functions/v1/manage-inventory`
```javascript
const fetch = require('node-fetch');
const { items, branch_id, user_id } = $vars;

const response = await fetch("https://pgglpdnxrwndwxbmajf.supabase.co/functions/v1/manage-inventory", {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
    },
    body: JSON.stringify({ items, branch_id, user_id })
});

const data = await response.json();
return JSON.stringify(data);
```

## 3. manage_staff
**Endpoint**: `https://pgglpdnxrwndwxbmajf.supabase.co/functions/v1/manage-staff`
```javascript
const fetch = require('node-fetch');
const { action, staff_data, target_id, user_id, branch_id } = $vars;

const response = await fetch("https://pgglpdnxrwndwxbmajf.supabase.co/functions/v1/manage-staff", {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
    },
    body: JSON.stringify({ action, staff_data, target_id, user_id, branch_id })
});

const data = await response.json();
return JSON.stringify(data);
```

## 4. manage_po
**Endpoint**: `https://pgglpdnxrwndwxbmajf.supabase.co/functions/v1/manage-po`
```javascript
const fetch = require('node-fetch');
const { action, po_id, reason, user_id } = $vars;

const response = await fetch("https://pgglpdnxrwndwxbmajf.supabase.co/functions/v1/manage-po", {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
    },
    body: JSON.stringify({ action, po_id, reason, user_id })
});

const data = await response.json();
return JSON.stringify(data);
```

## 5. manage_floor
**Endpoint**: `https://pgglpdnxrwndwxbmajf.supabase.co/functions/v1/manage-floor`
```javascript
const fetch = require('node-fetch');
const { action, table_id, branch_id, user_id } = $vars;
// action: 'view_map', 'clear_table', 'list_branches'

const response = await fetch("https://pgglpdnxrwndwxbmajf.supabase.co/functions/v1/manage-floor", {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
    },
    body: JSON.stringify({ action, table_id, branch_id, user_id })
});

const data = await response.json();
return JSON.stringify(data);
```
