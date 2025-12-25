
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
  category_name?: string; // Derived field
  category?: Category;    // Joined object
  description?: string;
  image_url?: string;
  is_available: boolean;
  stock_quantity?: number;
  created_at: string;
  recipe?: Recipe;
}

export interface Recipe {
  id: string;
  menu_item_id: string;
  prep_time: number;
  cook_time: number;
  servings: number;
  instructions?: string;
  ingredients?: RecipeIngredient[];
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  ingredient?: Ingredient;
}

export type OrderStatus = 
  | 'pending' 
  | 'accepted' 
  | 'preparing' 
  | 'ready' 
  | 'served' 
  | 'paid'
  | 'closed'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid' | 'split' | 'failed';
export type OrderSource = 'dine_in' | 'takeaway' | 'delivery' | 'chatbot';
export type PaymentMethod = 'cash' | 'cbe' | 'abyssinia' | 'telebirr' | 'pos' | 'chapa' | 'none';

export interface Order {
  id: string;
  order_number: string;
  table_number: string;
  table_id?: string;
  waiter_id: string;
  status: OrderStatus;
  order_type: 'dine-in' | 'takeout';
  source: OrderSource;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  order_handler_name?: string;
  payment_handler_name?: string;
  created_by_role?: 'waiter' | 'manager' | 'system';
  total_amount: number;
  customer_notes?: string;
  created_by_id?: string;
  created_by_name?: string;
  handled_by_id?: string;
  approved_by_id?: string;
  closed_by_id?: string;
  payment_processed_by_id?: string;
  created_at: string;
  accepted_at?: string;
  preparing_at?: string;
  ready_at?: string;
  served_at?: string;
  completed_at?: string;
  paid_at?: string;
  cancelled_at?: string;
  cancelled_reason?: string;
  waiter?: UserProfile; 
  order_items?: OrderItem[];
}

export type TableZone = 'indoor' | 'outdoor' | 'vip' | 'bar';

export interface Table {
  id: string;
  table_number: string;
  capacity: number;
  zone: TableZone;
  status: 'available' | 'occupied' | 'needs_cleaning' | 'reserved';
  current_order_id?: string;
  x_position?: number;
  y_position?: number;
  shape?: 'square' | 'round' | 'rectangle';
  last_updated: string;
  created_at: string;
  orders?: Order;
}

export interface Ingredient {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit_type: string;
  current_stock: number;
  par_min: number;
  par_max?: number;
  cost_per_unit?: number;
  supplier_id?: string;
  is_active: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  price: number;
  special_instructions?: string;
  created_at: string;
  menu_item?: MenuItem;
}

export interface CartItem extends MenuItem {
  quantity: number;
  instructions?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
}

export type Urgency = 'low' | 'medium' | 'critical';
export type RestockRequestStatus = 'pending' | 'approved' | 'rejected' | 'ordered';

export interface RestockRequest {
  id: string;
  ingredient_id: string;
  requested_quantity: number;
  reason?: string;
  urgency: Urgency;
  status: RestockRequestStatus;
  requested_by: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  ingredient?: Ingredient;
  requester?: UserProfile;
  reviewer?: {
    full_name: string;
    email: string;
  };
}

export type WasteCategory = 'spoiled' | 'burnt' | 'dropped' | 'expired' | 'overproduction' | 'other';

export interface WasteLog {
  id: string;
  ingredient_id: string;
  quantity: number;
  waste_category: WasteCategory;
  reason?: string;
  cost?: number;
  logged_by: string;
  created_at: string;
  ingredient?: Ingredient;
  staff?: UserProfile;
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'received' | 'partial_received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  expected_delivery: string;
  received_date?: string;
  total_amount: number;
  status: PurchaseOrderStatus;
  created_by: string;
  created_at: string;
  supplier?: Supplier;
  creator?: UserProfile;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  ingredient_id: string;
  ordered_quantity: number;
  unit_price: number;
  created_at: string;
  ingredient?: Ingredient;
}

/** Added StaffShift, StaffAction and StaffPerformanceDaily to resolve import errors **/
export interface StaffShift {
  id: string;
  staff_id: string;
  staff_name?: string;
  role: Role;
  clock_in_time: string;
  clock_out_time?: string;
  shift_duration_minutes?: number;
  status: 'active' | 'completed';
}

export interface StaffAction {
  id: string;
  staff_id: string;
  staff_name?: string;
  role: Role;
  action_type: string;
  entity_type: string;
  shift_id?: string;
  details?: any;
  created_at: string;
}

export interface StaffPerformanceDaily {
  id: string;
  staff_id: string;
  staff_name?: string;
  date: string;
  orders_taken: number;
  revenue_attributed: number;
  cash_handled: number;
}
