import { orderService } from './orderService';
import { settingsService } from './settingsService';
import { discountService } from './discountService';
import { Order, PaymentMethod, OrderType, OrderItem, User } from '../types';
import { calculateOrderPreview } from '../utils/orderCalculation';

export interface CreateTransactionPayload {
  order_type: OrderType;
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
   * 1. Validates cart content.
   * 2. Retrieves store settings and active promo discount rules.
   * 3. Calculates pure financial figures (subtotal, discount, tax, total).
   * 4. Validates payment requirements (sufficient cash or QRIS).
   * 5. Assembles complete snapshot Order entity.
   * 6. Dispatches order creation and atomic stock deduction via orderService.
   */
  async processTransaction(payload: CreateTransactionPayload): Promise<Order> {
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Keranjang belanja masih kosong');
    }

    // 1. Fetch current settings and discount rules
    const settings = await settingsService.getSettings();
    const discountRules = await discountService.getDiscountRules();

    // 2. Compute financials using single-source pure calculation helper
    const rawSubtotal = payload.items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0),
      0
    );

    const preview = calculateOrderPreview(
      rawSubtotal,
      discountRules,
      settings?.tax_percentage ?? 0
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
    }));

    // 5. Construct order entity payload
    const orderPayload = {
      order_type: payload.order_type,
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
      created_at: new Date().toISOString(),
    };

    // 6. Execute atomic creation & deduction via orderService / repository / store
    const newOrder = await orderService.createOrder(orderPayload, payload.pinToken);
    return newOrder;
  },
};
