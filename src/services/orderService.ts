import { Order } from '../types';
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

  async refundOrder(id: string, metadata?: { refunded_by_name?: string; refund_reason?: string }): Promise<Order> {
    return orderRepository.refundOrder(id, metadata);
  },
};
