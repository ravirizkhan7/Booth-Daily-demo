export type UserRole = 'owner' | 'karyawan';

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  password?: string;
  role: UserRole;
  pin: string;
  avatar?: string;
  is_active: boolean;
  phone?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon_name: string;
}

export interface RecipeIngredient {
  id: string;
  stock_id: string;
  stock_name: string;
  amount: number;
  unit: string;
}

export interface RecipeStep {
  step_number: number;
  instruction: string;
}

export interface Recipe {
  id: string;
  product_id: string;
  prep_time_minutes: number;
  image_url: string;
  description: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  barista_tips?: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  price: number;
  cost_price: number;
  image_url: string;
  description: string;
  is_active: boolean;
  is_favorite: boolean;
}

export interface Stock {
  id: string;
  name: string;
  current_amount: number;
  min_amount: number;
  unit: string;
  cost_per_unit: number;
}

export interface StockHistory {
  id: string;
  stock_id: string;
  stock_name: string;
  change_amount: number;
  unit: string;
  type: 'pembelian' | 'penjualan' | 'penyesuaian' | 'edit_manual' | 'in' | 'out' | 'sale_deduction';
  reference: string;
  user_name?: string;
  final_amount?: number;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  stock_id: string;
  stock_name: string;
  qty: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
}

export interface Purchase {
  id: string;
  purchase_number: string;
  supplier: string;
  date: string;
  total_amount: number;
  items: PurchaseItem[];
  notes?: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  qty: number;
  notes?: string;
  subtotal: number;
}

export type PaymentMethod = 'cash' | 'qris';

export interface DiscountRule {
  id: number | string;
  name: string;
  discount_percentage: number;
  minimum_purchase: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Payment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount_paid: number;
  change: number;
  status: 'completed' | 'refunded';
}

export type OrderType = 'dine_in' | 'take_away';

export interface Order {
  id: string;
  order_number: string;
  order_type: OrderType;
  created_by_user_id: string;
  created_by_name: string;
  created_by_role: UserRole;
  subtotal: number;
  tax: number;
  discount: number;
  discount_name?: string | null;
  total_amount: number;
  payment: Payment;
  items: OrderItem[];
  customer_name?: string;
  created_at: string;
}

export interface Settings {
  store_name: string;
  tagline: string;
  address: string;
  phone: string;
  receipt_header: string;
  receipt_footer: string;
  tax_percentage: number;
  service_charge_percentage: number;
  currency_symbol: string;
}
