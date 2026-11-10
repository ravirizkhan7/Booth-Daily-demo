import { DiscountRule } from '../types';
import { discountRepository } from '../mock/repositories/discountRepository';

export const discountService = {
  async getDiscountRules(activeOnly: boolean = false): Promise<DiscountRule[]> {
    return discountRepository.getDiscountRules(activeOnly);
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
    return discountRepository.createDiscountRule(payload);
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
    return discountRepository.updateDiscountRule(id, payload);
  },

  async toggleActiveDiscountRule(id: number | string): Promise<DiscountRule> {
    return discountRepository.toggleActiveDiscountRule(id);
  },

  async deleteDiscountRule(id: number | string): Promise<boolean> {
    return discountRepository.deleteDiscountRule(id);
  },
};
