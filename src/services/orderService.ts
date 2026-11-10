import { Order, PaymentMethod } from '../types';
import { orderRepository, GetOrdersParams } from '../mock/repositories/orderRepository';

export type { GetOrdersParams };

export const orderService = {
  async getOrders(params?: GetOrdersParams): Promise<Order[]> {
    return orderRepository.getOrders(params);
  },

  async getOrderById(id: string): Promise<Order | undefined> {
    return orderRepository.getOrderById(id);
  },

  async createOrder(orderData: any, token?: string): Promise<Order> {
    return orderRepository.createOrder(orderData, token);
  },

  /**
   * @deprecated JALUR OPERASIONAL DITUTUP.
   * Metode direct refund ini dinonaktifkan pada runtime aplikasi browser untuk mencegah bypass otorisasi Owner.
   * Hanya diizinkan untuk internal test runner / unit test backward compatibility.
   * Untuk operasional aplikasi, gunakan refundService (submitRefundRequest, approveRefundRequest, disburseRefund).
   */
  async refundOrder(
    id: string,
    metadata?: { refunded_by_name?: string; refund_reason?: string; refund_method?: PaymentMethod; isInternalTest?: boolean }
  ): Promise<Order> {
    // HARDENING: Blokir direct refund pada runtime aplikasi browser
    if (typeof window !== 'undefined' && !metadata?.isInternalTest) {
      throw new Error(
        'Aksi ditolak: Direct refund legacy dinonaktifkan pada runtime aplikasi browser. Gunakan workflow refund resmi melalui refundService.'
      );
    }
    return orderRepository.refundOrder(id, metadata);
  },
};
