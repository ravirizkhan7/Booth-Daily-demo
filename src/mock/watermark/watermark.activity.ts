/**
 * SMART DEMO CONVERSION — ACTIVITY EVENT BUS, LEDGER, & SCORING ENGINE
 * Workspace: D:\project\Booth-Daily-demo
 */

import {
  ACTIVITY_WEIGHTS,
  ACTIVITY_CAPS,
  MAX_LIFETIME_SCORE,
  TIER_THRESHOLDS,
  COOLDOWN_DURATIONS,
  UI_INTERACTION_LIMITS,
} from './watermark.config';

export type ActivityType =
  | 'TRANSACTION_SUCCESS'
  | 'SHIFT_MUTATION'
  | 'PRODUCT_UPSERT'
  | 'INVENTORY_MUTATION'
  | 'PURCHASE_NEW'
  | 'CATEGORY_UPSERT'
  | 'REPORT_EXPORT'
  | 'CROSS_DAY';

export type ConversionTier = 'EXPLORER' | 'ENGAGED' | 'ACTIVE' | 'INTENSIVE';

export type ActivityLedger = Record<string, ActivityType>;

/**
 * Format tanggal kalender lokal perangkat (YYYY-MM-DD).
 * Tidak menggunakan toISOString() agar selaras dengan waktu lokal pengunjung (WIB).
 */
export function toLocalDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Menghitung skor total dan jumlah aksi per kategori secara murni dari ledger.
 * Menerapkan capping per kategori dan batas total 68 poin.
 */
export function calculateActivityScore(ledger: ActivityLedger): {
  score: number;
  counts: Record<ActivityType, number>;
  cappedCounts: Record<ActivityType, number>;
} {
  const counts: Record<ActivityType, number> = {
    TRANSACTION_SUCCESS: 0,
    SHIFT_MUTATION: 0,
    PRODUCT_UPSERT: 0,
    INVENTORY_MUTATION: 0,
    PURCHASE_NEW: 0,
    CATEGORY_UPSERT: 0,
    REPORT_EXPORT: 0,
    CROSS_DAY: 0,
  };

  for (const type of Object.values(ledger)) {
    if (type in counts) {
      counts[type]++;
    }
  }

  const cappedCounts: Record<ActivityType, number> = {
    TRANSACTION_SUCCESS: Math.min(counts.TRANSACTION_SUCCESS, ACTIVITY_CAPS.TRANSACTION_SUCCESS),
    SHIFT_MUTATION: Math.min(counts.SHIFT_MUTATION, ACTIVITY_CAPS.SHIFT_MUTATION),
    PRODUCT_UPSERT: Math.min(counts.PRODUCT_UPSERT, ACTIVITY_CAPS.PRODUCT_UPSERT),
    INVENTORY_MUTATION: Math.min(counts.INVENTORY_MUTATION, ACTIVITY_CAPS.INVENTORY_MUTATION),
    PURCHASE_NEW: Math.min(counts.PURCHASE_NEW, ACTIVITY_CAPS.PURCHASE_NEW),
    CATEGORY_UPSERT: Math.min(counts.CATEGORY_UPSERT, ACTIVITY_CAPS.CATEGORY_UPSERT),
    REPORT_EXPORT: Math.min(counts.REPORT_EXPORT, ACTIVITY_CAPS.REPORT_EXPORT),
    CROSS_DAY: Math.min(counts.CROSS_DAY, ACTIVITY_CAPS.CROSS_DAY),
  };

  const rawScore =
    cappedCounts.TRANSACTION_SUCCESS * ACTIVITY_WEIGHTS.TRANSACTION_SUCCESS +
    cappedCounts.SHIFT_MUTATION * ACTIVITY_WEIGHTS.SHIFT_MUTATION +
    cappedCounts.PRODUCT_UPSERT * ACTIVITY_WEIGHTS.PRODUCT_UPSERT +
    cappedCounts.INVENTORY_MUTATION * ACTIVITY_WEIGHTS.INVENTORY_MUTATION +
    cappedCounts.PURCHASE_NEW * ACTIVITY_WEIGHTS.PURCHASE_NEW +
    cappedCounts.CATEGORY_UPSERT * ACTIVITY_WEIGHTS.CATEGORY_UPSERT +
    cappedCounts.REPORT_EXPORT * ACTIVITY_WEIGHTS.REPORT_EXPORT +
    cappedCounts.CROSS_DAY * ACTIVITY_WEIGHTS.CROSS_DAY;

  const score = Math.min(rawScore, MAX_LIFETIME_SCORE);

  return { score, counts, cappedCounts };
}

/**
 * Menurunkan tier murni dari skor aktivitas.
 * Tidak pernah diubah oleh klik UI, notifikasi, maupun WhatsApp.
 */
export function deriveTier(score: number): ConversionTier {
  if (score >= TIER_THRESHOLDS.INTENSIVE) return 'INTENSIVE';
  if (score >= TIER_THRESHOLDS.ACTIVE) return 'ACTIVE';
  if (score >= TIER_THRESHOLDS.ENGAGED) return 'ENGAGED';
  return 'EXPLORER';
}

/**
 * Logika evaluasi lintas hari (Cross-Day).
 * Dijalankan HANYA saat ada event aktivitas pengguna yang sah.
 * Menghasilkan kunci bonus jika memenuhi syarat kalender lokal yang berbeda.
 */
export function evaluateCrossDay(
  firstActivityDate: string | null,
  lastActiveDate: string | null,
  rewardedDays: string[],
  todayKey: string = toLocalDateKey()
): {
  newFirstDate: string;
  newLastDate: string;
  newRewardedDays: string[];
  awardedCrossDayKey: string | null;
} {
  // Aktivitas paling pertama sepanjang sejarah demo
  if (!firstActivityDate) {
    return {
      newFirstDate: todayKey,
      newLastDate: todayKey,
      newRewardedDays: rewardedDays,
      awardedCrossDayKey: null,
    };
  }

  // Jaminan tanggal monoton: lastActiveDate tidak boleh mundur
  const isChronologicallyNewer = !lastActiveDate || todayKey > lastActiveDate;
  const newLastDate = isChronologicallyNewer ? todayKey : lastActiveDate;

  // Syarat bonus:
  // 1. Hari lebih baru daripada firstActivityDate
  // 2. Hari lebih baru daripada lastActiveDate sebelumnya (mencegah rollback clock)
  // 3. Belum pernah diberi bonus pada hari ini
  // 4. Kuota bonus belum habis (< MAX_CROSS_DAY_REWARDS = 2)
  const isDifferentDay = todayKey > firstActivityDate && isChronologicallyNewer;
  const isNotYetRewarded = !rewardedDays.includes(todayKey);
  const withinQuota = rewardedDays.length < UI_INTERACTION_LIMITS.MAX_CROSS_DAY_REWARDS;

  if (isDifferentDay && isNotYetRewarded && withinQuota) {
    return {
      newFirstDate: firstActivityDate,
      newLastDate: newLastDate,
      newRewardedDays: [...rewardedDays, todayKey],
      awardedCrossDayKey: `crossday:${todayKey}`,
    };
  }

  return {
    newFirstDate: firstActivityDate,
    newLastDate: newLastDate,
    newRewardedDays: rewardedDays,
    awardedCrossDayKey: null,
  };
}

// In-Memory Suppress Map untuk aksi cepat (Edit & Ekspor)
const inMemorySuppressMap = new Map<string, number>();

/**
 * Memeriksa apakah event dengan kunci/entitas serupa sedang dalam masa suppress (3 detik).
 */
export function isEventSuppressed(suppressEntityKey: string, now: number = Date.now()): boolean {
  const lastTime = inMemorySuppressMap.get(suppressEntityKey);
  if (lastTime && now - lastTime < COOLDOWN_DURATIONS.IN_MEMORY_DEDUPE_SUPPRESS_MS) {
    return true;
  }
  inMemorySuppressMap.set(suppressEntityKey, now);
  return false;
}

// ============================================================================
// DECOUPLED ACTIVITY EVENT BUS
// ============================================================================

export type ActivityListener = (type: ActivityType, dedupeKey: string) => void;

class WatermarkActivityBus {
  private listeners: Set<ActivityListener> = new Set();

  public subscribe(listener: ActivityListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(type: ActivityType, dedupeKey: string): void {
    for (const listener of this.listeners) {
      try {
        listener(type, dedupeKey);
      } catch (err) {
        console.warn('[WatermarkActivityBus] Listener error ignored:', err);
      }
    }
  }
}

export const watermarkActivityBus = new WatermarkActivityBus();

/**
 * Helper global sinkron & aman untuk memancarkan event aktivitas dari luar React.
 * Tidak throw error, tidak memblokir alur POS.
 */
export function recordActivitySafe(type: ActivityType, dedupeKey: string): void {
  try {
    watermarkActivityBus.emit(type, dedupeKey);
  } catch (err) {
    console.warn('[Watermark] Failed to emit activity safely:', err);
  }
}

