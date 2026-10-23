import { DiscountRule } from '../types';

export interface OrderCalculationOptions {
  isVip?: boolean;
  vipDiscountPercentage?: number;
  vipTaxPercentage?: number | null;
  vipServiceChargePercentage?: number;
}

export interface OrderPreviewResult {
  subtotal: number;
  discount: number;
  discountName: string | null;
  discountPercentage: number;
  discountedBase: number;
  taxableAmount: number;
  tax: number;
  taxPercentage: number;
  serviceCharge: number;
  serviceChargePercentage: number;
  totalAmount: number;
  bestPromo: DiscountRule | null;
  isVip: boolean;
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
 * Pure calculation helper replicating the exact centralized formula:
 * 1. subtotal = round(sum(price * qty)) (Integer Rupiah)
 * 2. discount = best non-stacking discount between general promo & VIP discount (Integer Rupiah)
 * 3. discounted_base = max(0, subtotal - discount) (Integer Rupiah)
 * 4. tax_rate = VIP tax rate if isVip and configured; otherwise general tax rate (NEVER summed)
 * 5. tax = round(discounted_base * (tax_rate / 100)) (Integer Rupiah)
 * 6. service_charge = isVip ? round(discounted_base * (service_rate / 100)) : 0 (Integer Rupiah)
 * 7. grand_total = discounted_base + tax + service_charge (Integer Rupiah)
 *
 * Tax and service charge are each calculated once on discounted_base.
 * Tax is NOT charged on top of service charge, and neither is double-added.
 */
export function calculateOrderPreview(
  subtotal: number,
  discountRules: DiscountRule[] = [],
  taxPercentage: number = 0,
  options?: OrderCalculationOptions
): OrderPreviewResult {
  const cleanSubtotal = Math.round(Number(subtotal) || 0);
  const isVip = Boolean(options?.isVip);

  // 1. Promo discount calculation
  const bestPromo = findBestPromo(cleanSubtotal, discountRules);
  const promoRate = bestPromo ? Number(bestPromo.discount_percentage) || 0 : 0;
  const promoDiscount = bestPromo ? Math.round(cleanSubtotal * (promoRate / 100)) : 0;

  // 2. VIP discount calculation (only applicable if isVip is true)
  const vipRate = isVip ? Math.min(100, Math.max(0, Number(options?.vipDiscountPercentage) || 0)) : 0;
  const vipDiscount = isVip ? Math.round(cleanSubtotal * (vipRate / 100)) : 0;

  // 3. Select best discount (non-stacking, highest nominal, tie-breaker = VIP)
  let discount = 0;
  let discountName: string | null = null;
  let discountPercentage = 0;

  if (isVip) {
    if (vipDiscount >= promoDiscount && vipDiscount > 0) {
      discount = vipDiscount;
      discountPercentage = vipRate;
      discountName = `Diskon Ruang VIP (${vipRate}%)`;
    } else if (promoDiscount > vipDiscount && promoDiscount > 0) {
      discount = promoDiscount;
      discountPercentage = promoRate;
      discountName = bestPromo?.name || null;
    }
  } else {
    if (promoDiscount > 0) {
      discount = promoDiscount;
      discountPercentage = promoRate;
      discountName = bestPromo?.name || null;
    }
  }

  discount = Math.min(cleanSubtotal, Math.max(0, discount));
  const discountedBase = Math.max(0, cleanSubtotal - discount);

  // 4. Effective Tax Rate (VIP rate overrides general rate if set; else general tax rate)
  let effectiveTaxRate = Number(taxPercentage) || 0;
  if (
    isVip &&
    options?.vipTaxPercentage !== null &&
    options?.vipTaxPercentage !== undefined &&
    !isNaN(Number(options.vipTaxPercentage))
  ) {
    effectiveTaxRate = Math.min(100, Math.max(0, Number(options.vipTaxPercentage)));
  } else {
    effectiveTaxRate = Math.min(100, Math.max(0, effectiveTaxRate));
  }

  const tax = Math.round(discountedBase * (effectiveTaxRate / 100));

  // 5. VIP Service Charge
  const serviceChargeRate = isVip
    ? Math.min(100, Math.max(0, Number(options?.vipServiceChargePercentage) || 0))
    : 0;
  const serviceCharge = isVip
    ? Math.round(discountedBase * (serviceChargeRate / 100))
    : 0;

  // 6. Grand Total
  const totalAmount = discountedBase + tax + serviceCharge;

  return {
    subtotal: cleanSubtotal,
    discount,
    discountName,
    discountPercentage,
    discountedBase,
    taxableAmount: discountedBase,
    tax,
    taxPercentage: effectiveTaxRate,
    serviceCharge,
    serviceChargePercentage: serviceChargeRate,
    totalAmount,
    bestPromo,
    isVip,
  };
}
