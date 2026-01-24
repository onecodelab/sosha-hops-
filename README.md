# Sosha Restaurant OS 🌿

> **Elite Restaurant Management System with "Sosha Culture" Aesthetic**  
> *Powering efficiency, transparency, and organic growth for modern hospitality.*

---

## 📸 Aesthetic: "Sosha Culture"
This project implements a unique, premium design system characterized by:
- **High Contrast**: Bold `#FFCC00` (Sosha Yellow) against deep `#0A0A0A` backgrounds.
- **Dynamic Motion**: Extensive use of `framer-motion` for fluid, organic transitions.
- **Organic Elements**: Leafy SVG decorations and "Cucumber Green" accents for fresh, eco-friendly vibes.
- **Premium Typography**: Heavy black italics and monospaced data fields for a technical yet inviting feel.

---

## 🚀 Key Modules

### 📦 Inventory & Stock Control
- **Real-time Tracking**: Monitor stock levels with SKU-level precision.
- **Restock Requests**: Integrated workflow between Kitchen staff and Inventory managers.
- **Waste Logging**: Track and analyze ingredient waste to optimize procurement.

### 📝 Purchase Order System
- **Lifecycle Management**: From Draft -> Pending Approval -> Sent -> Received.
- **Multi-Shipment Reconciliation**: Support for partial deliveries with cumulative quantity tracking.
- **GRN Integration**: Automated Goods Received Note generation with invoice tracking.
- **Activity Logs**: Every state change and note is captured in a vertical timeline.

### 🍳 Kitchen Display System (KDS)
- **Status Workflow**: `Incoming` -> `Accepted` -> `Prepared` -> `Served`.
- **Urgency Visualization**: Cards animate and glow based on order age and priority.
- **Stock Integration**: Direct view of essential ingredients from the kitchen line.

### 🤵 Waiter Station & Table Management
- **Floor Mapping**: Visual grid of table statuses (Occupied, Reserved, Cleaning).
- **Service Alerts**: "Fresh & Ready" notifications when orders are prepared.
- **RBAC Guarded**: Waiter-specific views focused on orders and table turnover.

---

## 🛠 Tech Stack

- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **State Management**: [TanStack Query v5](https://tanstack.com/query/latest) (Auto-sync & Caching)
- **Styling**: Vanilla CSS with custom property design tokens (High-Performance)
- **Backend**: [Supabase](https://supabase.com/) (Real-time DB, Auth, Storage)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 📂 Project Structure

```bash
├── components/         # Reusable UI components (Sosha styled)
├── contexts/           # Authentication and Localization contexts
├── hooks/              # Custom business logic (usePendingPO, useRoleAccess)
├── lib/                # Shared utilities and translations
├── pages/              # Main route components (Admin, Kitchen, Manager, etc.)
├── services/           # External API integrations
├── supabase/           # Migrations and schema definitions
├── verifier-service/   # Standalone payment verification microservice
└── types.ts            # Centralized TypeScript interfaces
```

---

## 📥 Getting Started

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd sosha-os
   npm install
   ```

2. **Supabase Setup**
   - Create a `.env.local` file.
   - Add your credentials:
     ```env
     VITE_SUPABASE_URL=your_url
     VITE_SUPABASE_ANON_KEY=your_key
     ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

---

## 🤝 Contribution
Every line of code in this project must adhere to the **Sosha Culture** guidelines:
1. Use **Vanilla CSS** for performance.
2. Every action must have **Feedback** (Toasts/Animations).
3. **RBAC** (Role-Based Access Control) is mandatory for all new pages.

---

*Developed with ❤️ by the Sosha Ops Team.*
