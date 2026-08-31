import { DiscountRule } from '../types';

export interface OrderPreviewResult {
  subtotal: number;
  discount: number;
  discountName: string | null;
  discountPercentage: number;
  taxableAmount: number;
  tax: number;
  taxPercentage: number;
  totalAmount: number;
  bestPromo: DiscountRule | null;
}

/**
 * Replicate backend Promo selection algorithm:
 * Non-stacking, active rules only, minimum_purchase <= subtotal,
 * ordered by minimum_purchase DESC, then discount_percentage DESC.
 */
export function findBestPromo(subtotal: number, rules: DiscountRule[] = []): DiscountRule | null {
  if (!rules || rules.length === 0 || subtotal <= 0) {
    return null;
  }

  const eligibleRules = rules
    .filter(r => Boolean(r.is_active) && Number(r.minimum_purchase) <= subtotal)
    .sort((a, b) => {
      const minDiff = Number(b.minimum_purchase) - Number(a.minimum_purchase);
      if (minDiff !== 0) return minDiff;
      return Number(b.discount_percentage) - Number(a.discount_percentage);
    });

  return eligibleRules[0] || null;
}

/**
 * Pure calculation helper replicating the exact backend formula:
 * 1. Subtotal = sum(price * qty)
 * 2. Discount = round(subtotal * (discount_percentage / 100), 2)
 * 3. Taxable Amount = max(0, subtotal - discount)
 * 4. Tax = round(taxableAmount * (tax_percentage / 100), 2)
 * 5. Total Amount = round(taxableAmount + tax, 2)
 */
export function calculateOrderPreview(
  subtotal: number,
  discountRules: DiscountRule[] = [],
  taxPercentage: number = 0
): OrderPreviewResult {
  const cleanSubtotal = Math.round((Number(subtotal) || 0) * 100) / 100;
  const bestPromo = findBestPromo(cleanSubtotal, discountRules);

  let discount = 0;
  let discountName: string | null = null;
  let discountPercentage = 0;

  if (bestPromo) {
    discountPercentage = Number(bestPromo.discount_percentage) || 0;
    discount = Math.round(cleanSubtotal * (discountPercentage / 100) * 100) / 100;
    discountName = bestPromo.name;
  }

  const taxableAmount = Math.max(0, cleanSubtotal - discount);
  const cleanTaxPercentage = Number(taxPercentage) || 0;
  const tax = Math.round(taxableAmount * (cleanTaxPercentage / 100) * 100) / 100;
  const totalAmount = Math.round((taxableAmount + tax) * 100) / 100;

  return {
    subtotal: cleanSubtotal,
    discount,
    discountName,
    discountPercentage,
    taxableAmount,
    tax,
    taxPercentage: cleanTaxPercentage,
    totalAmount,
    bestPromo,
  };
}
