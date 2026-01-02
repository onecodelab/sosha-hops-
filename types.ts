
export type Role = 'owner' | 'manager' | 'waiter' | 'kitchen';

export interface UserProfile {
  id: string;
  full_name?: string;
  name?: string;
  email?: string;
  role: Role;
  created_at: string;
  is_online?: boolean;
  avatar_url?: string;
  base_salary?: number;
  pay_period?: 'monthly' | 'weekly' | 'hourly';
  is_salary_approved?: boolean;
}

export interface MenuDish {
  id: string;
  name: string;
  price: number;
  /**
   * Category display name used across dashboards.
   * For legacy menu_items rows this may be a denormalized string,
   * while newer flows use category_id + categories.name.
   */
  category: string;
  /**
   * Optional foreign key to categories table (used by the new menu editor).
   */
  category_id?: string;
  /**
   * Optional friendly category name when joined from categories.
   */
  category_name?: string;
  image_url?: string;
  /**
   * Inventory-facing props are optional because simple menu views
   * (e.g. useMenu hook backed by the bare `menu` table) do not provide them.
   */
  stock_quantity?: number;
  is_available?: boolean;
  recipe_id?: string | null;
  /**
   * Some menu sources (like the bare `menu` table) do not include created_at,
   * so we keep this optional to satisfy both shapes.
   */
  created_at?: string;
}

// Added MenuItem as an alias for MenuDish as used in MenuEditorModal
export type MenuItem = MenuDish;

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'served' | 'paid' | 'closed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'split' | 'failed';
export type OrderSource = 'dine_in' | 'takeaway' | 'delivery' | 'chatbot';

export interface Order {
  id: string;
  order_number: string;
  table_id: string;
  table_number: string;
  waiter_id: string;
  status: OrderStatus;
  source: OrderSource;
  payment_status: PaymentStatus;
  total_amount: number;
  amount_paid?: number;
  tip_amount?: number;
  transaction_reference?: string;
  created_at: string;
  order_items?: OrderItem[];
  customer_notes?: string;
  accepted_at?: string;
  ready_at?: string;
  served_at?: string;
  paid_at?: string;
  completed_at?: string;
  closed_at?: string;
  closed_by_id?: string;
  payment_method?: string;
  waiter?: { full_name: string };
  last_updated?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_id: string;
  menu_item_id?: string;
  quantity: number;
  price: number;
  special_instructions?: string;
  menu_dish?: MenuDish;
  menu_item?: { name: string; category?: string };
}

export interface TipsLog {
  id: string;
  order_id: string;
  waiter_id: string;
  amount: number;
  tip_type: 'cash' | 'digital';
  created_at: string;
}

export interface Table {
  id: string;
  table_number: string;
  status: 'available' | 'occupied' | 'needs_cleaning' | 'reserved';
  capacity_min: number;
  capacity_max: number;
  zone?: string;
  current_order_id?: string | null;
  current_session_id?: string | null;
  last_updated?: string;
  created_at: string;
}

export type PaymentMethod = 'cash' | 'cbe' | 'telebirr' | 'chapa' | 'abyssinia';

// Added missing Ingredient type
export interface Ingredient {
  id: string;
  sku: string;
  name: string;
  category: string;
  current_stock: number;
  unit_type: string;
  unittype?: string; // Support for variations in field naming across components
  par_min: number;
  par_max: number;
  cost_per_unit: number;
  expiry_days: number;
  is_active: boolean;
  supplier_id?: string;
  supplier?: { name: string };
  created_at: string;
  updated_at: string;
}

// Added missing StaffShift type
export interface StaffShift {
  id: string;
  staff_id: string;
  staff_name: string;
  role: string;
  clock_in_time: string;
  clock_out_time?: string | null;
  shift_duration_minutes?: number | null;
  status: 'active' | 'completed';
}

// Added missing StaffAction type
export interface StaffAction {
  id: string;
  staff_id: string;
  staff_name: string;
  role: string;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  shift_id?: string;
  details?: any;
  created_at: string;
  staff?: { full_name: string; role: string };
}

// Added missing StaffPerformanceDaily type
export interface StaffPerformanceDaily {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string;
  revenue_attributed: number;
  orders_completed: number;
  avg_service_time?: number;
  tips_collected?: number;
  staff?: { full_name: string; role: string };
}

// Added missing TipsLedger type
export interface TipsLedger {
  id: string;
  staff_id: string;
  order_id: string;
  amount: number;
  tip_type: 'cash' | 'digital';
  created_at: string;
}

// Added missing Waste related types
export type WasteCategory = 'spoiled' | 'burnt' | 'dropped' | 'expired' | 'overproduction' | 'other';

export interface WasteLog {
  id: string;
  ingredient_id: string;
  quantity: number;
  waste_category: WasteCategory;
  reason: string;
  cost: number;
  logged_by: string;
  created_at: string;
  ingredient?: { name: string; unit_type: string };
}

// Added missing Restock related types
export type Urgency = 'low' | 'medium' | 'high' | 'critical';

export interface RestockRequest {
  id: string;
  ingredient_id: string;
  requested_quantity: number;
  reason: string;
  urgency: Urgency;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'ordered';
  created_at: string;
  reviewed_by?: string;
  ingredient?: { name: string; unit_type: string };
  reviewer?: { full_name: string; email: string };
}

// Added missing PurchaseRequest type
export interface PurchaseRequest {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  reason: string;
  urgency: Urgency;
  status: 'pending' | 'approved' | 'rejected';
  created_by: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  ingredient?: { name: string; unit_type: string };
}

// Added missing Supplier type
export interface Supplier {
  id: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  is_active: boolean;
}

// Added missing PurchaseOrder types
export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  total_amount: number;
  status: 'draft' | 'sent' | 'partial_received' | 'received';
  expected_delivery: string;
  received_date?: string;
  created_by: string;
  created_at: string;
  supplier?: { name: string };
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  ingredient_id: string;
  ordered_quantity: number;
  unit_price: number;
  ingredient?: { name: string; unit_type: string };
}

// Added missing Category type
export interface Category {
  id: string;
  name: string;
  description?: string;
}

// Added missing TableZone type
export type TableZone = 'indoor' | 'outdoor' | 'vip' | 'bar';
