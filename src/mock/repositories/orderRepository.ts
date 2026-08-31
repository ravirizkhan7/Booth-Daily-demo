import { Order } from '../../types';
import { mockStore } from '../store';

export interface GetOrdersParams {
  date?: string;
  start_date?: string;
  end_date?: string;
  payment_method?: string;
  order_type?: string;
  limit?: number;
}

export const orderRepository = {
  async getOrders(params?: GetOrdersParams): Promise<Order[]> {
    return mockStore.getOrders(params);
  },

  async getOrderById(id: string): Promise<Order | undefined> {
    return mockStore.getOrderById(id);
  },

  async createOrder(orderData: any, _token?: string): Promise<Order> {
    return mockStore.addOrder(orderData);
  },

  async refundOrder(id: string): Promise<Order> {
    return mockStore.refundOrder(id);
  },
};
