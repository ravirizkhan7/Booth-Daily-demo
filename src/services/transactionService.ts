import { orderService } from './orderService';
import { settingsService } from './settingsService';
import { discountService } from './discountService';
import { shiftService } from './shiftService';
import { Order, PaymentMethod, OrderType, OrderItem, User } from '../types';
import { calculateOrderPreview } from '../utils/orderCalculation';

export interface CreateTransactionPayload {
  order_type: OrderType;
  order_area?: 'regular' | 'vip';
  is_vip?: boolean;
  items: Omit<OrderItem, 'id' | 'subtotal'>[];
  payment_method: PaymentMethod;
  amount_paid: number;
  customer_name?: string;
  user: User; // Authenticated by PIN
  pinToken?: string;
}

export const transactionService = {
  /**
   * Orchestrates the complete checkout transaction:
   * 1. Validates cart content and active cashier shift.
   * 2. Retrieves store settings and active promo discount rules.
   * 3. Calculates pure financial figures (subtotal, discount, tax, service charge, total).
   * 4. Validates payment requirements (sufficient cash or QRIS).
   * 5. Assembles complete snapshot Order entity bound to active shift.
   * 6. Dispatches order creation and atomic stock deduction via orderService.
   */
  async processTransaction(payload: CreateTransactionPayload): Promise<Order> {
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Keranjang belanja masih kosong');
    }

    // 0. Ensure active cashier shift exists
    const activeShift = await shiftService.getActiveShift();
    if (!activeShift || activeShift.status !== 'open') {
      throw new Error('Shift kasir belum dibuka. Buka shift kasir terlebih dahulu untuk memproses transaksi.');
    }

    // 1. Fetch current settings and discount rules
    const settings = await settingsService.getSettings();
    const discountRules = await discountService.getDiscountRules();

    // 2. Compute financials using single-source pure calculation helper
    const rawSubtotal = payload.items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0),
      0
    );

    const isVip = Boolean(payload.is_vip || payload.order_area === 'vip');
    const preview = calculateOrderPreview(
      rawSubtotal,
      discountRules,
      settings?.tax_percentage ?? 0,
      {
        isVip,
        vipDiscountPercentage: settings?.vip_discount_percentage,
        vipTaxPercentage: settings?.vip_tax_percentage,
        vipServiceChargePercentage: settings?.vip_room_service_charge_percentage,
      }
    );

    // 3. Validate payment
    let finalAmountPaid = preview.totalAmount;
    let finalChange = 0;

    if (payload.payment_method === 'cash') {
      const paid = Number(payload.amount_paid) || 0;
      if (paid < preview.totalAmount) {
        throw new Error(
          `Uang pembayaran tunai kurang! Diterima Rp ${paid.toLocaleString('id-ID')}, total tagihan Rp ${preview.totalAmount.toLocaleString('id-ID')}.`
        );
      }
      finalAmountPaid = paid;
      finalChange = Math.max(0, paid - preview.totalAmount);
    } else if (payload.payment_method === 'qris') {
      finalAmountPaid = preview.totalAmount;
      finalChange = 0;
    }

    // 4. Assemble snapshot items
    const snapshotItems: OrderItem[] = payload.items.map((item, idx) => ({
      id: `item-${Date.now()}-${idx + 1}`,
      product_id: String(item.product_id),
      product_name: String(item.product_name),
      price: Number(item.price) || 0,
      qty: Number(item.qty) || 1,
      notes: item.notes || '',
      subtotal: (Number(item.price) || 0) * (Number(item.qty) || 1),
      unit_cost_price: item.unit_cost_price,
      subtotal_cost: item.subtotal_cost,
      is_estimated_cost: item.is_estimated_cost,
    }));

    // 5. Construct order entity payload
    const orderPayload = {
      order_type: payload.order_type,
      order_area: isVip ? ('vip' as const) : ('regular' as const),
      is_vip: isVip,
      customer_name:
        payload.customer_name?.trim() ||
        (payload.order_type === 'dine_in' ? 'Dine In' : 'Take Away'),
      created_by_user_id: payload.user.id,
      created_by_name: payload.user.name,
      created_by_role: payload.user.role,
      subtotal: preview.subtotal,
      discount: preview.discount,
      discount_name: preview.discountName,
      tax: preview.tax,
      tax_percentage: preview.taxPercentage,
      service_charge: preview.serviceCharge,
      service_charge_percentage: preview.serviceChargePercentage,
      total_amount: preview.totalAmount,
      payment: {
        id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        order_id: '',
        method: payload.payment_method,
        amount_paid: finalAmountPaid,
        change: finalChange,
        status: 'completed' as const,
      },
      items: snapshotItems,
      shift_id: activeShift.id,
      operational_date: activeShift.operational_date,
      created_at: new Date().toISOString(),
    };

    // 6. Execute atomic creation & deduction via orderService / repository / store
    const newOrder = await orderService.createOrder(orderPayload, payload.pinToken);
    return newOrder;
  },
};
