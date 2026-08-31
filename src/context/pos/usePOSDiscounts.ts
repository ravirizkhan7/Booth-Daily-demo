import { useState, useCallback } from 'react';
import { DiscountRule } from '../../types';
import { discountService } from '../../services/discountService';

export const usePOSDiscounts = () => {
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);

  const refreshDiscounts = useCallback(async (): Promise<DiscountRule[]> => {
    try {
      const rules = await discountService.getDiscountRules();
      setDiscountRules(rules);
      return rules;
    } catch (err) {
      console.warn('[usePOSDiscounts] Failed to fetch discount rules:', err);
      return [];
    }
  }, []);

  const addDiscountRule = useCallback(async (payload: {
    name: string;
    minimum_purchase: number;
    discount_percentage: number;
    is_active?: boolean;
  }): Promise<DiscountRule> => {
    const created = await discountService.createDiscountRule(payload);
    setDiscountRules(prev => {
      const exists = prev.some(r => String(r.id) === String(created.id));
      if (exists) {
        return prev.map(r => String(r.id) === String(created.id) ? created : r);
      }
      return [...prev, created];
    });
    return created;
  }, []);

  const editDiscountRule = useCallback(async (
    id: number | string,
    payload: {
      name?: string;
      minimum_purchase?: number;
      discount_percentage?: number;
      is_active?: boolean;
    }
  ): Promise<DiscountRule> => {
    const updated = await discountService.updateDiscountRule(id, payload);
    setDiscountRules(prev => prev.map(r => String(r.id) === String(id) ? updated : r));
    return updated;
  }, []);

  const toggleDiscountRuleStatus = useCallback(async (id: number | string): Promise<DiscountRule> => {
    const updated = await discountService.toggleActiveDiscountRule(id);
    setDiscountRules(prev => prev.map(r => String(r.id) === String(id) ? updated : r));
    return updated;
  }, []);

  const removeDiscountRule = useCallback(async (id: number | string): Promise<boolean> => {
    await discountService.deleteDiscountRule(id);
    setDiscountRules(prev => prev.filter(r => String(r.id) !== String(id)));
    return true;
  }, []);

  const handleDiscountRuleRealtimeChange = useCallback((payload: {
    action: string;
    discount_rule_id: number | string;
    discount_rule?: any | null;
  }) => {
    if (!payload?.action || !payload?.discount_rule_id) return;
    const ruleId = String(payload.discount_rule_id);

    if (payload.action === 'deleted') {
      setDiscountRules(prev => prev.filter(r => String(r.id) !== ruleId));
      return;
    }

    if (payload.discount_rule) {
      const normalizedRule: DiscountRule = {
        id: ruleId,
        name: String(payload.discount_rule.name || ''),
        minimum_purchase: Number(payload.discount_rule.minimum_purchase || 0),
        discount_percentage: Number(payload.discount_rule.discount_percentage || 0),
        is_active: Boolean(payload.discount_rule.is_active),
      };

      setDiscountRules(prev => {
        const exists = prev.some(r => String(r.id) === ruleId);
        if (exists) {
          return prev.map(r => String(r.id) === ruleId ? normalizedRule : r);
        }
        return [...prev, normalizedRule];
      });
    }
  }, []);

  return {
    discountRules,
    setDiscountRules,
    refreshDiscounts,
    addDiscountRule,
    editDiscountRule,
    toggleDiscountRuleStatus,
    removeDiscountRule,
    handleDiscountRuleRealtimeChange,
  };
};
