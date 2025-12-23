<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Sosha OS – Restaurant System

This repository contains the Sosha OS restaurant management UI, wired to a Supabase backend and built with React, Vite and Tailwind CSS.

You can also view and edit the original app in AI Studio:  
https://ai.studio/apps/drive/1r2eZdZT7Z173MeZ4Q-CMLRgIYty2QBus

---

## Run Locally

**Prerequisites:** Node.js (LTS recommended)

```bash
# Install dependencies
npm install

# Run the app in dev mode
npm run dev
```

The dev server address will be printed to the terminal (for example `http://localhost:3000` or `http://localhost:3001`).

If you use Gemini features, set `GEMINI_API_KEY` in `.env.local` as documented in AI Studio.

---

## Sync another laptop with Sosha OS (Ultimate Sync)

Assumption: the `main` branch on the remote is the **source of truth** and already deployed.

On any machine that has a Git clone of this repo:

```bash
# Make sure you are on the main branch
git checkout main

# Fetch latest changes from the remote
git fetch origin

# Reset local main to exactly match the remote main
git reset --hard origin/main
```

This will:

- Discard any local changes on that machine.
- Ensure the working copy exactly matches the deployed `main` branch.
- Make it safe to follow the same steps on multiple laptops or servers.

If you downloaded the code as a ZIP (no `.git` folder), clone the repository from GitHub first, then run the commands above.

---

## Ultimate Sync & Quality Guardian – Smoke Tests

After syncing to the latest `main`, you can run an automated smoke check of the critical restaurant flows.

### 1. Install dependencies

On a fresh machine:

```bash
npm install
```

### 2. Run the automated Sosha check

```bash
npm run sosha-check
```

This command is defined in `package.json` as:

```jsonc
"lint": "tsc --noEmit",
"test:sosha": "node ./scripts/sosha-smoke.mjs",
"sosha-check": "npm run lint && npm run test:sosha"
```

What it does:

1. **TypeScript check** – `tsc --noEmit`  
   Ensures the TypeScript code compiles without type errors.

2. **Integration / smoke tests** – `scripts/sosha-smoke.mjs`  
   Uses the Supabase client to perform a minimal set of end-to-end checks against the live database:

   - Ensures a **test waiter user** exists (or creates one).
   - Ensures a **test menu item** exists.
   - Creates:
     - A **waiter order** (simulating a waiter‑created ticket).
     - A **chatbot-style order** with `waiter_id = NULL` (unclaimed/bot ticket).
   - For the waiter order, exercises the status flow:
     - `pending → preparing → ready → served → paid → completed`
   - Creates additional paid orders to verify all configured payment methods:
     - `cash`, `chapa`, `cbe`, `abyssinia`
   - Queries recent orders and checks that:
     - The **waiter smoke-test order** appears with a `waiter_id`.
     - The **chatbot smoke-test order** appears with `waiter_id = NULL`.

The script prints human‑readable messages such as:

- `Chatbot order did not appear in Recent Activity (recent orders)`
- `Order status transition to 'paid' failed due to constraint`
- `Payment method 'chapa' failed to save`
- Or, if everything passes:  
  `Sosha OS smoke check PASSED. Core restaurant flows look healthy.`

### 3. Interpreting failures

If `npm run sosha-check` exits with a non‑zero code, check the console output:

- Messages mentioning **constraint** usually point to database schema issues (for example, missing foreign keys or enum values).
- Messages about **chatbot order** or **waiter order** not appearing in recent orders indicate that:
  - Inserts are failing, or
  - A trigger / policy is blocking test data from being written.

Use the failure text to locate the relevant table (`users`, `menu`, `orders`, `order_items`) and fix the schema or row‑level security as needed.

---

## Deploying

The project is configured for Netlify with `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[dev]
  command = "npm run dev"
  port = 3000
  targetPort = 3000
  framework = "vite"
```

Manual deploy from a synced machine:

```bash
npm run build
netlify deploy --prod
```

The Netlify CLI will print the production **Site URL** after deployment (for example `https://soshahops.netlify.app`).

Use this flow together with `npm run sosha-check` to keep all environments in sync and verified.
