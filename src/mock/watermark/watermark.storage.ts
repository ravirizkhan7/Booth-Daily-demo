/**
 * SMART DEMO CONVERSION — PERSISTENCE & STORAGE MANAGER
 * Workspace: D:\project\Booth-Daily-demo
 */

import { WATERMARK_STORAGE_KEY, WATERMARK_STORAGE_VERSION, UI_INTERACTION_LIMITS } from './watermark.config';
import { ActivityType, ActivityLedger } from './watermark.activity';
import { PackageId, isPackageId } from './watermark.packages';

export interface SmartDemoStateV1 {
  version: 1;

  // A. Ledger Aktivitas (Satu-satunya sumber skor)
  ledger: ActivityLedger;

  // B. Tracking Kalender Lintas Hari
  firstActivityDate: string | null;
  lastActiveDate: string | null;
  rewardedDays: string[];

  // C. Interaksi Notifikasi
  notificationShownCount: number;
  lastNotificationShownAt: number | null;

  // D. Interaksi Modal Konversi
  autoModalShownForTiers: ('ACTIVE' | 'INTENSIVE')[];
  modalOpenCount: number;
  lastModalShownAt: number | null;

  // E. Interaksi Penolakan (Dismissal)
  dismissCount: number;
  lastDismissedAt: number | null;
  lastDismissSource: 'close_x' | 'backdrop' | 'escape' | 'later_button' | null;

  // F. Pemilihan Paket
  packageModalOpenCount: number;
  lastPackageSelectedId: PackageId | null;
  lastPackageSelectedAt: number | null;

  // G. Aksi Outbound WhatsApp
  whatsappOpenRequestedCount: number;
  lastWhatsappOpenRequestedAt: number | null;
}

export function createDefaultWatermarkState(): SmartDemoStateV1 {
  return {
    version: 1,
    ledger: {},
    firstActivityDate: null,
    lastActiveDate: null,
    rewardedDays: [],
    notificationShownCount: 0,
    lastNotificationShownAt: null,
    autoModalShownForTiers: [],
    modalOpenCount: 0,
    lastModalShownAt: null,
    dismissCount: 0,
    lastDismissedAt: null,
    lastDismissSource: null,
    packageModalOpenCount: 0,
    lastPackageSelectedId: null,
    lastPackageSelectedAt: null,
    whatsappOpenRequestedCount: 0,
    lastWhatsappOpenRequestedAt: null,
  };
}

// In-Memory Fallback runtime (untuk mode Incognito atau kuota penuh)
let inMemoryFallbackState: SmartDemoStateV1 | null = null;

function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const testKey = '__bd_wm_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validasi ketat skema runtime state yang dibaca dari JSON.
 */
function isValidStateSchema(raw: any): raw is SmartDemoStateV1 {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.version !== WATERMARK_STORAGE_VERSION) return false;
  if (!raw.ledger || typeof raw.ledger !== 'object') return false;
  if (!Array.isArray(raw.rewardedDays)) return false;
  if (!Array.isArray(raw.autoModalShownForTiers)) return false;
  return true;
}

/**
 * Membaca state watermark secara aman.
 * Jika storage gagal atau korup, melakukan self-healing ke default state tanpa crash.
 */
export function loadWatermarkState(): SmartDemoStateV1 {
  if (!isLocalStorageAvailable()) {
    if (!inMemoryFallbackState) {
      inMemoryFallbackState = createDefaultWatermarkState();
    }
    return inMemoryFallbackState;
  }

  try {
    const raw = window.localStorage.getItem(WATERMARK_STORAGE_KEY);
    if (!raw) {
      return inMemoryFallbackState ?? createDefaultWatermarkState();
    }

    const parsed = JSON.parse(raw);
    if (isValidStateSchema(parsed)) {
      // Normalisasi field opsional
      return {
        ...createDefaultWatermarkState(),
        ...parsed,
        ledger: { ...parsed.ledger },
        rewardedDays: [...parsed.rewardedDays],
        autoModalShownForTiers: [...parsed.autoModalShownForTiers],
      };
    }

    console.warn('[WatermarkStorage] Corrupted or invalid state schema detected, resetting to default.');
    const fresh = createDefaultWatermarkState();
    saveWatermarkState(fresh);
    return fresh;
  } catch (err) {
    console.warn('[WatermarkStorage] Failed to read from localStorage:', err);
    return inMemoryFallbackState ?? createDefaultWatermarkState();
  }
}

/**
 * Menyimpan state watermark secara fail-safe.
 */
export function saveWatermarkState(state: SmartDemoStateV1): void {
  inMemoryFallbackState = state;

  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.setItem(WATERMARK_STORAGE_KEY, JSON.stringify(state));
  } catch (err: any) {
    console.warn('[WatermarkStorage] Failed to persist state to localStorage (quota or security):', err);
  }
}

/**
 * Menggabungkan dua state watermark antar-tab (Multi-Tab Reconciliation).
 * Menerapkan prinsip ledger union dan prioritas nilai terbaru secara monotonic.
 */
export function mergeWatermarkStates(
  local: SmartDemoStateV1,
  remote: SmartDemoStateV1
): SmartDemoStateV1 {
  // 1. Union ledger aktivitas
  const mergedLedger: ActivityLedger = { ...local.ledger, ...remote.ledger };

  // 2. Evaluasi tanggal (First date: minimum, Last date: maksimum leksikografis)
  let firstDate = local.firstActivityDate;
  if (!firstDate || (remote.firstActivityDate && remote.firstActivityDate < firstDate)) {
    firstDate = remote.firstActivityDate;
  }

  let lastDate = local.lastActiveDate;
  if (!lastDate || (remote.lastActiveDate && remote.lastActiveDate > lastDate)) {
    lastDate = remote.lastActiveDate;
  }

  // 3. Union rewarded days
  const rewardedSet = new Set([...local.rewardedDays, ...remote.rewardedDays]);
  const mergedRewardedDays = Array.from(rewardedSet).slice(0, UI_INTERACTION_LIMITS.MAX_CROSS_DAY_REWARDS);

  // 4. Union auto-modal tier history
  const tierSet = new Set([...local.autoModalShownForTiers, ...remote.autoModalShownForTiers]);
  const mergedTierHistory = Array.from(tierSet) as ('ACTIVE' | 'INTENSIVE')[];

  // 5. Package selection (timestamp terbaru menang)
  let packageId = local.lastPackageSelectedId;
  let packageAt = local.lastPackageSelectedAt;
  if (
    (remote.lastPackageSelectedAt || 0) > (local.lastPackageSelectedAt || 0) &&
    isPackageId(remote.lastPackageSelectedId)
  ) {
    packageId = remote.lastPackageSelectedId;
    packageAt = remote.lastPackageSelectedAt;
  }

  // 6. WhatsApp action (timestamp terbaru menang)
  const lastWaAt = Math.max(local.lastWhatsappOpenRequestedAt || 0, remote.lastWhatsappOpenRequestedAt || 0) || null;

  return {
    version: 1,
    ledger: mergedLedger,
    firstActivityDate: firstDate,
    lastActiveDate: lastDate,
    rewardedDays: mergedRewardedDays,
    notificationShownCount: Math.max(local.notificationShownCount, remote.notificationShownCount),
    lastNotificationShownAt: Math.max(local.lastNotificationShownAt || 0, remote.lastNotificationShownAt || 0) || null,
    autoModalShownForTiers: mergedTierHistory,
    modalOpenCount: Math.max(local.modalOpenCount, remote.modalOpenCount),
    lastModalShownAt: Math.max(local.lastModalShownAt || 0, remote.lastModalShownAt || 0) || null,
    dismissCount: Math.max(local.dismissCount, remote.dismissCount),
    lastDismissedAt: Math.max(local.lastDismissedAt || 0, remote.lastDismissedAt || 0) || null,
    lastDismissSource: (remote.lastDismissedAt || 0) > (local.lastDismissedAt || 0) ? remote.lastDismissSource : local.lastDismissSource,
    packageModalOpenCount: Math.max(local.packageModalOpenCount, remote.packageModalOpenCount),
    lastPackageSelectedId: packageId,
    lastPackageSelectedAt: packageAt,
    whatsappOpenRequestedCount: Math.max(local.whatsappOpenRequestedCount, remote.whatsappOpenRequestedCount),
    lastWhatsappOpenRequestedAt: lastWaAt,
  };
}

/**
 * Menghapus state watermark dari storage & memory (misal saat Factory Reset).
 */
export function clearWatermarkState(): void {
  inMemoryFallbackState = createDefaultWatermarkState();
  try {
    if (isLocalStorageAvailable()) {
      window.localStorage.removeItem(WATERMARK_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[WatermarkStorage] Failed to clear watermark storage:', err);
  }
}

