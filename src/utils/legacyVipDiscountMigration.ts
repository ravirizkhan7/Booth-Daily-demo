import { DiscountRule, Settings } from '../types';

/**
 * ID deterministik promo VIP hasil migrasi konfigurasi legacy `vip_discount_percentage`.
 * Dipakai agar migrasi tidak pernah menghasilkan promo duplikat.
 */
export const LEGACY_VIP_DISCOUNT_MIGRATION_RULE_ID = 'disc-vip-legacy-migration';
export const LEGACY_VIP_DISCOUNT_MIGRATION_RULE_NAME = 'Diskon VIP (Migrasi Legacy)';

/**
 * Migrasi satu kali: konfigurasi lama `settings.vip_discount_percentage` menjadi
 * promo VIP di `discountRules`, sehingga `discountRules` menjadi satu-satunya sumber diskon.
 *
 * Penanda `settings.vip_discount_legacy_migrated` bersifat persisten (ikut backup/restore) dan
 * menjadi satu-satunya penentu apakah migrasi sudah ditangani. Keberadaan promo hasil migrasi
 * TIDAK dipakai sebagai penanda, karena Owner boleh menghapusnya secara sengaja.
 *
 * Aturan:
 * - Penanda sudah true            : tidak melakukan apa pun.
 * - A) legacy > 0 & belum ada aturan scope 'vip' (aktif/nonaktif): buat 1 promo VIP aktif, min. belanja 0.
 * - B) sudah ada aturan VIP        : tidak membuat/mengubah promo; hanya menandai selesai.
 * - C) legacy 0/null/tidak valid   : tidak membuat promo; hanya menandai selesai.
 *
 * Mutasi dilakukan in-place pada `target`. Mengembalikan true jika ada perubahan yang perlu dipersist.
 */
export function migrateLegacyVipDiscount(target: {
  settings?: Settings;
  discountRules?: DiscountRule[];
}): boolean {
  const settings = target?.settings;
  if (!settings || typeof settings !== 'object') return false;
  if (settings.vip_discount_legacy_migrated === true) return false;

  if (!Array.isArray(target.discountRules)) {
    target.discountRules = [];
  }
  const rules = target.discountRules;

  const rawLegacy = settings.vip_discount_percentage;
  const legacy = rawLegacy === null || rawLegacy === undefined ? 0 : Number(rawLegacy);
  const hasUsableLegacy = Number.isFinite(legacy) && legacy > 0;
  const hasAnyVipRule = rules.some(r => r && r.scope === 'vip');

  if (hasUsableLegacy && !hasAnyVipRule) {
    const nowIso = new Date().toISOString();
    rules.push({
      id: LEGACY_VIP_DISCOUNT_MIGRATION_RULE_ID,
      name: LEGACY_VIP_DISCOUNT_MIGRATION_RULE_NAME,
      minimum_purchase: 0,
      discount_percentage: Math.min(100, legacy),
      is_active: true,
      scope: 'vip',
      created_at: nowIso,
      updated_at: nowIso,
    });
  }

  settings.vip_discount_legacy_migrated = true;
  return true;
}

