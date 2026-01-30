
export type Role = 'owner' | 'admin' | 'manager' | 'waiter' | 'kitchen';

export interface UserProfile {
  id: string;
  full_name?: string;
  name?: string;
  email?: string;
  role: Role;
  phone?: string;
  home_branch_id?: string;
  created_at: string;
  is_online?: boolean;
  avatar_url?: string;
  base_salary?: number;
  pay_period?: 'monthly' | 'weekly' | 'hourly';
  is_salary_approved?: boolean;
  created_by?: string;
  invitation_pending?: boolean;
}

export interface MenuDish {
  id: string;
  name: string;
  price: number;
  category: string;
  category_name?: string;
  // Fix: Added missing category_id property to match database schema usage in MenuEditorModal
  category_id?: string;
  image_url?: string;
  stock_quantity: number;
  is_available: boolean;
  cost_per_plate?: number;
  availability_reason?: string;
  recipe_id?: string | null;
  created_at: string;
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
  branch_id: string;
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
  subtotal_amount?: number;
  vat_amount?: number;
  vat_rate?: number;
  qr_verification_code?: string;
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
  out_of_stock_impact?: 'kills_dish' | 'disable_variant' | 'optional';
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
  branch_id: string;
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
  cost_per_unit?: number;
  weight_per_unit?: number;
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
  total_shortage?: number;
  shortages_count?: number;
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
  waste_reason: WasteCategory;
  notes: string;
  cost_snapshot: number;
  reported_by: string;
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
  ingredient?: { name: string; unittype: string };
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

// PO Status Flow: draft -> pending_approval -> needs_revision -> approved -> sent -> partial_received -> received
export type POStatus = 'draft' | 'pending_approval' | 'pending' | 'needs_revision' | 'approved' | 'sent' | 'partial_received' | 'received' | 'verified';

export type POActionType = 'created' | 'submitted' | 'approved' | 'rejected' | 'revision_requested' | 'sent' | 'withdrawn' | 'edited' | 'received';

export interface POActivityLog {
  id: string;
  po_id: string;
  action_type: POActionType;
  performed_by: string;
  notes?: string;
  created_at: string;
  performer?: { full_name: string; role: string };
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  branch_id: string;
  total_amount: number;
  status: POStatus;
  expected_delivery: string;
  received_date?: string;
  created_by: string;
  created_at: string;
  approval_notes?: string;
  approved_by?: string;
  approved_at?: string;
  risk_flags?: string[];
  supplier?: { name: string };
  creator?: { full_name: string };
  items?: PurchaseOrderItem[];
  activity_log?: POActivityLog[];
  grns?: any[];
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

export interface Branch {
  id: string;
  name: string;
  location?: string;
  is_active: boolean;
  created_at: string;
}

export interface BranchInventory {
  id: string;
  branch_id: string;
  ingredient_id: string;
  current_stock: number;
  par_min: number;
  par_max: number;
  last_updated: string;
  ingredient?: Ingredient;
}
