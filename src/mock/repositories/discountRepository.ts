import { DiscountRule } from '../../types';
import { mockStore } from '../store';

export const discountRepository = {
  async getDiscountRules(activeOnly: boolean = false): Promise<DiscountRule[]> {
    return mockStore.getDiscountRules(activeOnly);
  },

  async createDiscountRule(payload: {
    name: string;
    minimum_purchase: number;
    discount_percentage: number;
    is_active?: boolean;
    scope?: 'general' | 'vip';
    validity_type?: 'unlimited' | 'time_limited';
    start_date?: string | null;
    end_date?: string | null;
  }): Promise<DiscountRule> {
    return mockStore.addDiscountRule(payload);
  },

  async updateDiscountRule(
    id: number | string,
    payload: {
      name?: string;
      minimum_purchase?: number;
      discount_percentage?: number;
      is_active?: boolean;
      scope?: 'general' | 'vip';
      validity_type?: 'unlimited' | 'time_limited';
      start_date?: string | null;
      end_date?: string | null;
    }
  ): Promise<DiscountRule> {
    return mockStore.updateDiscountRule(id, payload);
  },

  async toggleActiveDiscountRule(id: number | string): Promise<DiscountRule> {
    return mockStore.toggleActiveDiscountRule(id);
  },

  async deleteDiscountRule(id: number | string): Promise<boolean> {
    return mockStore.deleteDiscountRule(id);
  },
};
