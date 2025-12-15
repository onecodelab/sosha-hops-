export type Role = 'owner' | 'manager' | 'waiter' | 'kitchen';

export interface UserProfile {
  id: string;
  name: string;
  role: Role;
  created_at: string;
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