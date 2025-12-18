
export type Role = 'owner' | 'manager' | 'waiter' | 'kitchen';

export interface UserProfile {
  id: string;
  full_name?: string;
  name?: string; // Kept for backward compatibility
  email?: string;
  role: Role;
  created_at: string;
  is_online?: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string;
  is_available: boolean; // Corrected to match database column
  stock_quantity?: number;
  created_at: string;
}

export type OrderStatus = 
  | 'pending' 
  | 'accepted' 
  | 'preparing' 
  | 'ready' 
  | 'served' 
  | 'completed' 
  | 'cancelled';

export type PaymentMethod = 'cash' | 'chapa' | 'cbe' | 'abyssinia';

export interface Order {
  id: string;
  order_number: string;
  table_number: string;
  waiter_id: string;
  status: OrderStatus;
  order_type: 'dine-in' | 'takeout';
  total_amount: number;
  customer_notes?: string;
  payment_method?: PaymentMethod;
  
  // Timestamps
  created_at: string;
  accepted_at?: string;
  preparing_at?: string;
  ready_at?: string;
  served_at?: string;
  completed_at?: string;
  paid_at?: string;
  cancelled_at?: string;
  cancelled_reason?: string;
  
  // Joins
  waiter?: UserProfile; 
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  price: number;
  special_instructions?: string;
  created_at: string;
  // Joins
  menu_item?: MenuItem;
}

export interface CartItem extends MenuItem {
  quantity: number;
  instructions?: string;
}

// Kitchen Inventory Types
export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
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
  // Joins
  supplier?: Supplier;
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
  // Joins
  ingredient?: Ingredient;
  logger?: UserProfile;
}

// Restock Request Types
export type RestockStatus = 'pending' | 'approved' | 'rejected' | 'ordered';
export type Urgency = 'low' | 'medium' | 'critical';

export interface RestockRequest {
  id: string;
  ingredient_id: string;
  requested_quantity: number;
  reason: string;
  urgency: Urgency;
  requested_by: string;
  status: RestockStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  // Joins
  ingredient?: Ingredient;
  requester?: UserProfile;
  reviewer?: UserProfile;
}

// Purchase Order Types
export type POStatus = 'draft' | 'sent' | 'received' | 'partial_received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  expected_delivery: string;
  total_amount: number;
  status: POStatus;
  created_by: string;
  created_at: string;
  received_date?: string;
  // Joins
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
  creator?: UserProfile;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  ingredient_id: string;
  ordered_quantity: number;
  unit_price: number;
  // Joins
  ingredient?: Ingredient;
}

// GRN Types
export interface GRN {
  id: string;
  grn_number: string;
  po_id: string;
  received_date: string;
  invoice_number: string;
  status: 'complete' | 'partial';
  received_by: string;
  created_at: string;
}

export interface GRNItem {
  id: string;
  grn_id: string;
  ingredient_id: string;
  ordered_quantity: number;
  received_quantity: number;
}
