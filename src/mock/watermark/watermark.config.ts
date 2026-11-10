/**
 * SMART DEMO CONVERSION — CONFIGURATION CONSTANTS
 * Workspace: D:\project\Booth-Daily-demo
 * 
 * Single source of truth untuk bobot skor, batasan capping,
 * ambang batas tier, interval cooldown, dan nomor WhatsApp placeholder.
 */

// 1. Bobot Skor per Aktivitas Positif
export const ACTIVITY_WEIGHTS = {
  TRANSACTION_SUCCESS: 3,
  SHIFT_MUTATION: 3,
  PRODUCT_UPSERT: 2,
  INVENTORY_MUTATION: 2,
  PURCHASE_NEW: 2,
  CATEGORY_UPSERT: 1,
  REPORT_EXPORT: 1,
  CROSS_DAY: 5,
} as const;

// 2. Batas Maksimal Aksi Seumur Demo (Lifetime Cap)
export const ACTIVITY_CAPS = {
  TRANSACTION_SUCCESS: 5, // 5 * 3 = 15 poin
  SHIFT_MUTATION: 3,      // 3 * 3 = 9 poin
  PRODUCT_UPSERT: 5,      // 5 * 2 = 10 poin
  INVENTORY_MUTATION: 5,  // 5 * 2 = 10 poin
  PURCHASE_NEW: 3,        // 3 * 2 = 6 poin
  CATEGORY_UPSERT: 5,     // 5 * 1 = 5 poin
  REPORT_EXPORT: 3,       // 3 * 1 = 3 poin
  CROSS_DAY: 2,           // 2 * 5 = 10 poin
} as const;

// Total Akumulasi Poin Maksimal: 15 + 9 + 10 + 10 + 6 + 5 + 3 + 10 = 68
export const MAX_LIFETIME_SCORE = 68;
export const MAX_LIFETIME_ACTIONS = 31;

// 3. Ambang Batas Tier (Murni dari Skor)
export const TIER_THRESHOLDS = {
  EXPLORER: 0,
  ENGAGED: 10,
  ACTIVE: 25,
  INTENSIVE: 50,
} as const;

// 4. Durasi Cooldown & Timer (dalam milidetik)
export const COOLDOWN_DURATIONS = {
  NOTIFICATION_MS: 5 * 60 * 1000,      // 5 menit
  MODAL_MS: 15 * 60 * 1000,            // 15 menit
  DISMISSAL_MS: 30 * 60 * 1000,        // 30 menit (mutlak untuk seluruh tier)
  WHATSAPP_MS: 60 * 60 * 1000,         // 60 menit
  POS_GRACE_PERIOD_MS: 3 * 1000,       // 3 detik jeda aman pasca-modal POS
  NOTIFICATION_AUTO_HIDE_MS: 8 * 1000, // 8 detik auto-fade notification
  PENDING_PROMPT_TTL_MS: 10 * 60 * 1000,// 10 menit batas kedaluwarsa prompt tertunda
  IN_MEMORY_DEDUPE_SUPPRESS_MS: 3000,  // 3 detik debounce per entitas/tipe
} as const;

// 5. Batas Frekuensi Interaksi UI
export const UI_INTERACTION_LIMITS = {
  MAX_LIFETIME_NOTIFICATIONS: 3,       // Notifikasi otomatis maksimal 3x seumur demo
  MAX_LIFETIME_AUTO_MODALS: 2,         // Auto-modal maksimal 1x per tier (ACTIVE & INTENSIVE)
  MAX_CROSS_DAY_REWARDS: 2,            // Maksimal reward lintas hari 2 tanggal berbeda
} as const;

// 6. Integrasi Eksternal & Penyimpanan
export const WHATSAPP_CONFIG = {
  PHONE_NUMBER: '6280000000000',       // Nomor WhatsApp placeholder internasional
} as const;

export const WATERMARK_STORAGE_KEY = 'boothdaily_watermark_state';
export const WATERMARK_STORAGE_VERSION = 1;

