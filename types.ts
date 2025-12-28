

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

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id?: string;
  category_name?: string;
  category?: Category;
  description?: string;
  image_url?: string;
  is_available: boolean;
  created_at: string;
  recipe?: ERPRecipe;
}

export interface ERPRecipe {
  id: string;
  menu_item_id: string;
  name: string;
  description?: string;
  yield_servings: number;
  prep_time_minutes: number;
  ingredients?: ERPRecipeIngredient[];
}

export interface ERPRecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  ingredient?: Ingredient;
}

export interface Ingredient {
  id: string;
  sku: string;
  name: string;
  unit_type: string;
  current_stock: number;
  par_min: number;
  par_max?: number;
  cost_per_unit?: number;
  location?: string;
  category?: string;
  supplier_id?: string;
  is_active: boolean;
}

// Hardened Procurement Pipeline
export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'converted';
export type POStatus = 'draft' | 'approved' | 'sent' | 'received' | 'cancelled' | 'partial_received';
export type InventoryEventType = 'purchase' | 'consumption' | 'waste' | 'adjustment' | 'shortage';

export interface RestockRequest {
  id: string;
  ingredient_id: string;
  requested_quantity: number;
  reason: string;
  urgency: Urgency;
  status: RequestStatus;
  requested_by: string;
  reviewed_by?: string;
  created_at: string;
  ingredient?: Ingredient;
  requester?: UserProfile;
  reviewer?: UserProfile;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  is_active: boolean;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  ingredient_id: string;
  ordered_quantity: number;
  unit_price: number;
  received_quantity?: number;
  ingredient?: Ingredient;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  total_amount: number;
  status: POStatus;
  expected_delivery: string;
  received_date?: string;
  created_by: string;
  created_at: string;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
}

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'served' | 'paid' | 'closed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'split' | 'failed';
export type PaymentMethod = 'cash' | 'cbe' | 'abyssinia' | 'chapa' | 'telebirr' | 'bank';
export type OrderSource = 'dine_in' | 'takeaway' | 'delivery' | 'chatbot';

export interface Order {
  id: string;
  order_number: string;
  table_number: string;
  table_id?: string;
  waiter_id: string;
  status: OrderStatus;
  source: OrderSource;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  total_amount: number;
  tip_amount: number;
  customer_notes?: string;
  created_at: string;
  served_at?: string;
  paid_at?: string;
  order_items?: OrderItem[];
  waiter?: UserProfile;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  price: number;
  special_instructions?: string;
  menu_item?: MenuItem;
}

export interface CartItem extends MenuItem {
  quantity: number;
  instructions?: string;
}

export interface StaffShift {
  id: string;
  staff_id: string;
  staff_name?: string;
  role: Role;
  clock_in_time: string;
  clock_out_time?: string;
  status: 'active' | 'completed';
}

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
  ingredient?: Ingredient;
}

export interface StaffAction {
  id: string;
  staff_id: string;
  staff_name?: string;
  role: string;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  shift_id?: string;
  details?: any;
  created_at: string;
}

export interface StaffPerformanceDaily {
  id: string;
  staff_id: string;
  staff_name?: string;
  date: string;
  revenue_attributed: number;
  orders_completed: number;
  avg_service_time_mins: number;
  created_at: string;
}

export interface TipsLedger {
  id: string;
  order_id?: string;
  staff_id: string;
  amount: number;
  tip_type: 'cash' | 'digital';
  created_at: string;
}

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'needs_cleaning';
export type TableZone = 'indoor' | 'outdoor' | 'vip' | 'bar';

export interface Table {
  id: string;
  table_number: string;
  capacity: number;
  status: TableStatus;
  zone: TableZone;
  x_position: number;
  y_position: number;
  shape: 'square' | 'round' | 'rectangle';
  current_order_id?: string;
  last_updated?: string;
  created_at: string;
}

export interface PurchaseRequest {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  reason: string;
  urgency: Urgency;
  status: RequestStatus;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  ingredient?: Ingredient;
}
