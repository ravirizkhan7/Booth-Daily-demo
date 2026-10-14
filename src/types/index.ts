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

export type BaseUnit = 'Gram' | 'ml' | 'Pcs';

export type BaselineSource =
  | 'owner_confirmed'
  | 'initial_stock_cost'
  | 'canonical_seed'
  | 'unverified_legacy';

export interface Stock {
  id: string;
  name: string;
  current_amount: number;
  min_amount: number;
  unit: string;
  cost_per_unit: number;
  baseline_cost_per_unit?: number;
  baseline_source?: BaselineSource;
  baseline_updated_at?: string;
  baseline_updated_by?: string;
  conversion_status?: 'verified' | 'unverified_legacy';
  default_package_unit?: string;
  default_package_size?: number;
  default_package_price?: number;
}

export interface StockHistory {
  id: string;
  stock_id: string;
  stock_name: string;
  change_amount: number;
  unit: string;
  type: 'pembelian' | 'penjualan' | 'refund' | 'penyesuaian' | 'edit_manual' | 'in' | 'out' | 'sale_deduction';
  reference: string;
  user_name?: string;
  initial_amount?: number;
  final_amount?: number;
  reason?: string;
  notes?: string;
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
  package_qty?: number;
  package_unit?: string;
  package_price?: number;
  conversion_ratio?: number;
  conversion_status?: 'verified' | 'unverified_legacy';
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
  unit_cost_price?: number;
  subtotal_cost?: number;
  is_estimated_cost?: boolean;
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

export type ShiftStatus = 'open' | 'closed';

export type ShiftReconciliationStatus =
  | 'matched'
  | 'matched_corrected'
  | 'pending_review'
  | 'approved_variance'
  | 'correction_requested';

export interface ShiftAuditTrailEntry {
  id: string;
  action: 'closed' | 'review_approved' | 'review_rejected' | 'corrected';
  user_id: string;
  user_name: string;
  user_role: UserRole;
  timestamp: string;
  notes?: string;
  previous_status?: ShiftReconciliationStatus;
  new_status?: ShiftReconciliationStatus;
  details?: Record<string, any>;
}

export interface ShiftFinancialSnapshot {
  cash_initial: number;
  expected_cash_end: number;
  expected_qris_end: number;
  cash_sales: number;
  qris_sales: number;
  cash_refunds: number;
  qris_refunds: number;
  cash_expenses?: number;
  gross_sales: number;
  discount_total: number;
  tax_total: number;
  net_sales: number;
  estimated_hpp: number;
  estimated_gross_profit: number;
  total_orders_count: number;
  total_refund_orders_count: number;
  actual_cash_end: number;
  actual_qris_end: number | null;
  actual_refund_total: number | null;
  cash_difference: number;
  qris_difference: number | null;
  cash_status: 'balanced' | 'surplus' | 'shortage';
  qris_status: 'balanced' | 'discrepancy' | 'unreconciled';
  refund_status: 'verified' | 'discrepancy' | 'unverified';
  reconciliation_status: ShiftReconciliationStatus;
  cash_difference_reason?: string;
  qris_difference_reason?: string;
  notes?: string;
}

export interface Shift {
  id: string;
  shift_number: string;
  operational_date: string;
  status: ShiftStatus;
  opened_at: string;
  closed_at?: string;
  opened_by_user_id: string;
  opened_by_name: string;
  opened_by_role?: UserRole;
  closed_by_user_id?: string;
  closed_by_name?: string;
  closed_by_role?: UserRole;
  cash_initial: number;
  snapshot?: ShiftFinancialSnapshot;
  reconciliation_status?: ShiftReconciliationStatus;
  cash_difference_reason?: string;
  qris_difference_reason?: string;
  reviewed_by_user_id?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_action?: 'approved_variance' | 'correction_requested';
  review_notes?: string;
  audit_trail?: ShiftAuditTrailEntry[];
  notes?: string;
  created_at: string;
}

export type OrderHPPSource = 'transaction_snapshot' | 'legacy_estimate' | 'partial_snapshot';

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
  total_hpp?: number;
  hpp_source?: OrderHPPSource;
  hpp_migrated_at?: string;
  hpp_variance?: number;
  payment: Payment;
  items: OrderItem[];
  customer_name?: string;
  refunded_at?: string;
  refunded_by_name?: string;
  refund_reason?: string;
  created_at: string;
  shift_id?: string;
  operational_date?: string;
  refund_shift_id?: string;
  refund_method?: PaymentMethod;
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
  operational_day_cutoff_time?: string;
}
