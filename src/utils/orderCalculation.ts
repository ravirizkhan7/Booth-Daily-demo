import { DiscountRule, PromotionValidityType } from '../types';

export type PromoComputedStatus = 'active' | 'scheduled' | 'expired' | 'disabled';

export interface OrderCalculationOptions {
  orderType?: 'dine_in' | 'take_away';
  isVip?: boolean;
  vipTaxPercentage?: number | null;
  vipServiceChargePercentage?: number;
  referenceDate?: Date;
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
 * Format Date to local 'YYYY-MM-DD' calendar string.
 */
export function formatLocalCalendarDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Pure deterministic helper to calculate the effective promotion status.
 *
 * Boundary semantics:
 * Local calendar date comparison for YYYY-MM-DD values.
 * A promotion remains valid throughout its configured end date (inclusive)
 * and expires on the subsequent local calendar date.
 */
export function getPromoComputedStatus(
  rule: DiscountRule,
  currentDate: Date = new Date()
): PromoComputedStatus {
  if (!rule || !rule.is_active) {
    return 'disabled';
  }

  if (rule.validity_type === 'time_limited') {
    const todayStr = formatLocalCalendarDate(currentDate);
    const startStr = rule.start_date ? rule.start_date.slice(0, 10) : '';
    const endStr = rule.end_date ? rule.end_date.slice(0, 10) : '';

    // Invalid date range handling
    if (!startStr || !endStr || startStr > endStr) {
      return 'expired';
    }

    if (todayStr < startStr) {
      return 'scheduled';
    }
    if (todayStr > endStr) {
      return 'expired';
    }

    return 'active';
  }

  // Default: unlimited (including legacy records without validity_type)
  return 'active';
}

/**
 * Check if a promotion rule is currently eligible based on status and calendar date.
 */
export function isPromoEligibleNow(
  rule: DiscountRule,
  currentDate: Date = new Date()
): boolean {
  return getPromoComputedStatus(rule, currentDate) === 'active';
}

/**
 * Replicate backend Promo selection algorithm:
 * Non-stacking, active rules only, minimum_purchase <= subtotal,
 * ordered by minimum_purchase DESC, then discount_percentage DESC.
 */
export function findBestPromo(
  subtotal: number,
  rules: DiscountRule[] = [],
  referenceDate: Date = new Date()
): DiscountRule | null {
  if (!rules || rules.length === 0 || subtotal <= 0) {
    return null;
  }

  const eligibleRules = rules
    .filter(r => isPromoEligibleNow(r, referenceDate) && Number(r.minimum_purchase) <= subtotal)
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
 * 2. discount = best non-stacking discount between general promo & VIP promo, both sourced ONLY
 *    from discountRules (scope 'vip' applies to VIP orders only; no legacy settings fallback) (Integer Rupiah)
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
  const isTakeAway = options?.orderType === 'take_away';
  const isVip = !isTakeAway && Boolean(options?.isVip);
  const refDate = options?.referenceDate || new Date();

  // 1. Promo discount calculation (general promos: scope !== 'vip')
  const generalRules = discountRules.filter(r => r.scope !== 'vip');
  const bestPromo = findBestPromo(cleanSubtotal, generalRules, refDate);
  const promoRate = bestPromo ? Number(bestPromo.discount_percentage) || 0 : 0;
  const promoDiscount = bestPromo ? Math.round(cleanSubtotal * (promoRate / 100)) : 0;

  // 2. VIP discount calculation (only applicable if isVip is true)
  let vipRate = 0;
  let vipDiscount = 0;
  let vipDiscountName: string | null = null;
  let bestVipRule: DiscountRule | null = null;

  // discountRules adalah SATU-SATUNYA sumber aturan diskon. Tidak ada fallback ke
  // konfigurasi legacy: jika tidak ada promo VIP aktif yang memenuhi syarat, diskon VIP = Rp0.
  if (isVip) {
    const vipRules = discountRules.filter(r => r.scope === 'vip');
    bestVipRule = findBestPromo(cleanSubtotal, vipRules, refDate);
    if (bestVipRule) {
      vipRate = Math.min(100, Math.max(0, Number(bestVipRule.discount_percentage) || 0));
      vipDiscount = Math.round(cleanSubtotal * (vipRate / 100));
      vipDiscountName = bestVipRule.name;
    }
  }

  // 3. Select best discount (non-stacking, highest nominal, tie-breaker = VIP)
  let discount = 0;
  let discountName: string | null = null;
  let discountPercentage = 0;

  if (isVip) {
    if (vipDiscount >= promoDiscount && vipDiscount > 0) {
      discount = vipDiscount;
      discountPercentage = vipRate;
      discountName = vipDiscountName;
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
    bestPromo: (discount > 0 && discount === promoDiscount && (!isVip || promoDiscount > vipDiscount)) ? bestPromo : (bestVipRule || bestPromo),
    isVip,
  };
}
