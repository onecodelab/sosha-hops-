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
  is_available: boolean;
  created_at: string;
}

export type OrderStatus = 
  | 'pending' 
  | 'verified' 
  | 'accepted' 
  | 'preparing' 
  | 'ready' 
  | 'served' 
  | 'ready_to_pay' 
  | 'paid' 
  | 'cancelled';

export interface Order {
  id: string;
  table_no: string;
  status: OrderStatus;
  total_amount: number;
  verified_by?: string;
  created_at: string;
  // Joins
  verified_by_user?: UserProfile; 
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  price_at_time: number;
  // Joins
  menu_item?: MenuItem;
}

export interface CartItem extends MenuItem {
  quantity: number;
}