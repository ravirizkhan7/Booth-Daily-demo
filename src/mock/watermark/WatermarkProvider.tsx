/**
 * SMART DEMO CONVERSION — REACT PROVIDER & ORCHESTRATOR
 * Workspace: D:\project\Booth-Daily-demo
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { usePOS } from '../../hooks/usePOS';
import {
  COOLDOWN_DURATIONS,
  UI_INTERACTION_LIMITS,
  WATERMARK_STORAGE_KEY,
} from './watermark.config';
import {
  ActivityType,
  ConversionTier,
  calculateActivityScore,
  deriveTier,
  evaluateCrossDay,
  isEventSuppressed,
  watermarkActivityBus,
  toLocalDateKey,
} from './watermark.activity';
import {
  SmartDemoStateV1,
  loadWatermarkState,
  saveWatermarkState,
  mergeWatermarkStates,
  createDefaultWatermarkState,
} from './watermark.storage';
import { PackageId, isPackageId } from './watermark.packages';

export interface WatermarkContextType {
  state: SmartDemoStateV1;
  score: number;
  tier: ConversionTier;
  isNotificationVisible: boolean;
  isConversionModalOpen: boolean;
  isPackageModalOpen: boolean;
  selectedPackageId: PackageId | null;
  // UI Actions
  dismissNotification: (source?: 'close_x' | 'auto_hide') => void;
  openConversionModalFromNotification: () => void;
  dismissConversionModal: (source: 'close_x' | 'backdrop' | 'escape' | 'later_button') => void;
  openPackageModal: () => void;
  closePackageModal: () => void;
  selectPackage: (id: PackageId) => void;
  recordWhatsAppClick: () => void;
}

const WatermarkContext = createContext<WatermarkContextType | undefined>(undefined);

function after(timestamp: number | null, cooldownMs: number, now: number): boolean {
  if (timestamp === null) return true;
  return now - timestamp >= cooldownMs;
}

/**
 * Pengecekan visibilitas DOM aktual untuk overlay non-watermark.
 */
function isActuallyVisible(el: Element): boolean {
  if (typeof window === 'undefined') return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rects = el.getClientRects();
  return rects.length > 0;
}

export const WatermarkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Ambil State POS untuk Modal Safety Gate
  const pos = usePOS();
  const {
    isPinModalOpen,
    isReceiptModalOpen,
    isLoginModalOpen,
    isLogoutModalOpen,
    isEditAccountModalOpen,
    isOpenShiftModalOpen,
    isCloseShiftModalOpen,
    selectedRecipe,
    selectedRecipeProduct,
  } = pos;

  // 2. State Internal Watermark
  const [wmState, setWmState] = useState<SmartDemoStateV1>(() => loadWatermarkState());
  const [isNotificationVisible, setIsNotificationVisible] = useState<boolean>(false);
  const [isConversionModalOpen, setIsConversionModalOpen] = useState<boolean>(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState<boolean>(false);

  // 3. Pending Prompt (Maksimal 1 slot runtime dengan TTL 10 menit)
  const pendingPromptRef = useRef<{
    type: 'notification' | 'modal';
    targetTier: ConversionTier;
    createdAt: number;
  } | null>(null);

  // Grace timer ref
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State ref untuk sinkronisasi async event
  const stateRef = useRef<SmartDemoStateV1>(wmState);
  stateRef.current = wmState;

  // Skor dan Tier terderivasi secara murni dari ledger
  const { score } = calculateActivityScore(wmState.ledger);
  const tier = deriveTier(score);

  // Helper untuk mendeteksi apakah POS sedang dalam kondisi kritis
  const checkIsCriticalPOSActive = useCallback((): boolean => {
    // A. Context flags
    const isContextCritical =
      Boolean(isPinModalOpen) ||
      Boolean(isReceiptModalOpen) ||
      Boolean(isLoginModalOpen) ||
      Boolean(isLogoutModalOpen) ||
      Boolean(isEditAccountModalOpen) ||
      Boolean(isOpenShiftModalOpen) ||
      Boolean(isCloseShiftModalOpen) ||
      selectedRecipe !== null ||
      selectedRecipeProduct !== null;

    if (isContextCritical) {
      return true;
    }

    // B. DOM Overlay Gate (Heuristik pelengkap modal lokal halaman)
    if (typeof document !== 'undefined') {
      try {
        const potentialOverlays = document.querySelectorAll(
          '[aria-modal="true"], .fixed.inset-0'
        );
        for (let i = 0; i < potentialOverlays.length; i++) {
          const el = potentialOverlays[i];
          // Abaikan semua overlay milik Smart Demo Conversion sendiri
          if (el.closest('[data-smart-demo]')) {
            continue;
          }
          if (isActuallyVisible(el)) {
            return true;
          }
        }
      } catch (domErr) {
        console.warn('[Watermark] DOM gate check error:', domErr);
      }
    }

    return false;
  }, [
    isPinModalOpen,
    isReceiptModalOpen,
    isLoginModalOpen,
    isLogoutModalOpen,
    isEditAccountModalOpen,
    isOpenShiftModalOpen,
    isCloseShiftModalOpen,
    selectedRecipe,
    selectedRecipeProduct,
  ]);

  // Evaluasi kelayakan notification
  const canShowNotification = useCallback((s: SmartDemoStateV1, now: number): boolean => {
    if (s.notificationShownCount >= UI_INTERACTION_LIMITS.MAX_LIFETIME_NOTIFICATIONS) {
      return false;
    }
    return (
      after(s.lastNotificationShownAt, COOLDOWN_DURATIONS.NOTIFICATION_MS, now) &&
      after(s.lastDismissedAt, COOLDOWN_DURATIONS.DISMISSAL_MS, now) &&
      after(s.lastWhatsappOpenRequestedAt, COOLDOWN_DURATIONS.WHATSAPP_MS, now)
    );
  }, []);

  // Evaluasi kelayakan auto-modal
  const canShowAutoModal = useCallback((s: SmartDemoStateV1, currentTier: ConversionTier, now: number): boolean => {
    if (currentTier !== 'ACTIVE' && currentTier !== 'INTENSIVE') {
      return false;
    }
    // Maksimal 1 auto-modal per tier
    if (s.autoModalShownForTiers.includes(currentTier)) {
      return false;
    }
    // Cek cooldown modal, dismissal 30m, dan WA 60m
    return (
      after(s.lastModalShownAt, COOLDOWN_DURATIONS.MODAL_MS, now) &&
      after(s.lastDismissedAt, COOLDOWN_DURATIONS.DISMISSAL_MS, now) &&
      after(s.lastWhatsappOpenRequestedAt, COOLDOWN_DURATIONS.WHATSAPP_MS, now)
    );
  }, []);

  // Eksekusi prompt yang aman
  const executePromptSafely = useCallback((type: 'notification' | 'modal', currentTier: ConversionTier) => {
    const now = Date.now();
    const currentState = stateRef.current;

    if (type === 'modal') {
      if (!canShowAutoModal(currentState, currentTier, now)) return;

      const nextAutoTiers = [...currentState.autoModalShownForTiers];
      if (!nextAutoTiers.includes(currentTier as 'ACTIVE' | 'INTENSIVE')) {
        nextAutoTiers.push(currentTier as 'ACTIVE' | 'INTENSIVE');
      }

      const updated: SmartDemoStateV1 = {
        ...currentState,
        autoModalShownForTiers: nextAutoTiers,
        modalOpenCount: currentState.modalOpenCount + 1,
        lastModalShownAt: now,
      };

      setWmState(updated);
      saveWatermarkState(updated);
      setIsConversionModalOpen(true);
    } else if (type === 'notification') {
      if (!canShowNotification(currentState, now)) return;

      const updated: SmartDemoStateV1 = {
        ...currentState,
        notificationShownCount: currentState.notificationShownCount + 1,
        lastNotificationShownAt: now,
      };

      setWmState(updated);
      saveWatermarkState(updated);
      setIsNotificationVisible(true);
    }
  }, [canShowAutoModal, canShowNotification]);

  // Evaluasi prompt yang tertunda saat kondisi POS aman kembali
  const tryFlushPendingPrompt = useCallback(() => {
    const pending = pendingPromptRef.current;
    if (!pending) return;

    const now = Date.now();
    // Kedaluwarsa jika sudah lewat TTL 10 menit
    if (now - pending.createdAt > COOLDOWN_DURATIONS.PENDING_PROMPT_TTL_MS) {
      pendingPromptRef.current = null;
      return;
    }

    // Pastikan POS benar-benar aman
    if (checkIsCriticalPOSActive()) {
      return;
    }

    pendingPromptRef.current = null;
    executePromptSafely(pending.type, pending.targetTier);
  }, [checkIsCriticalPOSActive, executePromptSafely]);

  // Monitor transisi kondisi kritis POS untuk memulai Grace Period
  useEffect(() => {
    const isCritical = checkIsCriticalPOSActive();

    if (isCritical) {
      // Jika modal kritis muncul, batalkan grace timer yang sedang berjalan
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    } else {
      // Jika POS aman dan ada pending prompt, jalankan grace period 3 detik
      if (pendingPromptRef.current && !graceTimerRef.current) {
        graceTimerRef.current = setTimeout(() => {
          graceTimerRef.current = null;
          tryFlushPendingPrompt();
        }, COOLDOWN_DURATIONS.POS_GRACE_PERIOD_MS);
      }
    }

    return () => {
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    };
  }, [checkIsCriticalPOSActive, tryFlushPendingPrompt]);

  // MutationObserver untuk mendeteksi penutupan modal lokal halaman di DOM
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      // Debounce pemanggilan agar tidak membebani render
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!checkIsCriticalPOSActive() && pendingPromptRef.current && !graceTimerRef.current) {
          graceTimerRef.current = setTimeout(() => {
            graceTimerRef.current = null;
            tryFlushPendingPrompt();
          }, COOLDOWN_DURATIONS.POS_GRACE_PERIOD_MS);
        }
      }, 100);
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [checkIsCriticalPOSActive, tryFlushPendingPrompt]);

  // 4. Subscription Event Bus Aktivitas
  useEffect(() => {
    const unsubscribe = watermarkActivityBus.subscribe((type: ActivityType, dedupeKey: string) => {
      const now = Date.now();
      const current = stateRef.current;

      // Cek in-memory suppression untuk edit/ekspor
      if (isEventSuppressed(dedupeKey, now)) {
        return;
      }

      // Cek jika event sudah pernah tercatat di ledger
      if (current.ledger[dedupeKey]) {
        return;
      }

      // Catat event baru ke ledger
      const nextLedger = { ...current.ledger, [dedupeKey]: type };

      // Evaluasi cross-day
      const todayKey = toLocalDateKey();
      const crossDayResult = evaluateCrossDay(
        current.firstActivityDate,
        current.lastActiveDate,
        current.rewardedDays,
        todayKey
      );

      if (crossDayResult.awardedCrossDayKey) {
        nextLedger[crossDayResult.awardedCrossDayKey] = 'CROSS_DAY';
      }

      const { score: newScore } = calculateActivityScore(nextLedger);
      const newTier = deriveTier(newScore);

      const updatedState: SmartDemoStateV1 = {
        ...current,
        ledger: nextLedger,
        firstActivityDate: crossDayResult.newFirstDate,
        lastActiveDate: crossDayResult.newLastDate,
        rewardedDays: crossDayResult.newRewardedDays,
      };

      setWmState(updatedState);
      saveWatermarkState(updatedState);

      // Evaluasi kemunculan UI berdasarkan tier baru
      const isCritical = checkIsCriticalPOSActive();

      if (newTier === 'ACTIVE' || newTier === 'INTENSIVE') {
        if (isCritical) {
          pendingPromptRef.current = { type: 'modal', targetTier: newTier, createdAt: now };
        } else {
          executePromptSafely('modal', newTier);
        }
      } else if (newTier === 'ENGAGED') {
        if (isCritical) {
          pendingPromptRef.current = { type: 'notification', targetTier: newTier, createdAt: now };
        } else {
          executePromptSafely('notification', newTier);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [checkIsCriticalPOSActive, executePromptSafely]);

  // 5. Multi-Tab Storage Listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== WATERMARK_STORAGE_KEY) return;

      if (e.newValue === null) {
        // Factory Reset dipicu di tab lain
        const clean = createDefaultWatermarkState();
        setWmState(clean);
        setIsNotificationVisible(false);
        setIsConversionModalOpen(false);
        setIsPackageModalOpen(false);
        pendingPromptRef.current = null;
        return;
      }

      try {
        const remote = JSON.parse(e.newValue);
        if (remote && remote.version === 1) {
          const merged = mergeWatermarkStates(stateRef.current, remote);
          setWmState(merged);
        }
      } catch (err) {
        console.warn('[Watermark] Failed to parse remote storage update:', err);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 6. UI Handlers
  const dismissNotification = useCallback((source: 'close_x' | 'auto_hide' = 'close_x') => {
    setIsNotificationVisible(false);
    if (source === 'close_x') {
      const now = Date.now();
      const updated: SmartDemoStateV1 = {
        ...stateRef.current,
        dismissCount: stateRef.current.dismissCount + 1,
        lastDismissedAt: now,
        lastDismissSource: 'close_x',
      };
      setWmState(updated);
      saveWatermarkState(updated);
    }
  }, []);

  const openConversionModalFromNotification = useCallback(() => {
    setIsNotificationVisible(false);
    if (checkIsCriticalPOSActive()) return;

    const now = Date.now();
    const updated: SmartDemoStateV1 = {
      ...stateRef.current,
      modalOpenCount: stateRef.current.modalOpenCount + 1,
      lastModalShownAt: now,
    };
    setWmState(updated);
    saveWatermarkState(updated);
    setIsConversionModalOpen(true);
  }, [checkIsCriticalPOSActive]);

  const dismissConversionModal = useCallback((source: 'close_x' | 'backdrop' | 'escape' | 'later_button') => {
    setIsConversionModalOpen(false);
    const now = Date.now();
    const updated: SmartDemoStateV1 = {
      ...stateRef.current,
      dismissCount: stateRef.current.dismissCount + 1,
      lastDismissedAt: now,
      lastDismissSource: source,
    };
    setWmState(updated);
    saveWatermarkState(updated);
  }, []);

  const openPackageModal = useCallback(() => {
    setIsConversionModalOpen(false);
    const updated: SmartDemoStateV1 = {
      ...stateRef.current,
      packageModalOpenCount: stateRef.current.packageModalOpenCount + 1,
    };
    setWmState(updated);
    saveWatermarkState(updated);
    setIsPackageModalOpen(true);
  }, []);

  const closePackageModal = useCallback(() => {
    setIsPackageModalOpen(false);
    // Menutup package modal BUKAN dismissal 30m; hanya mencatat lastModalShownAt untuk modal cooldown 15m
    const now = Date.now();
    const updated: SmartDemoStateV1 = {
      ...stateRef.current,
      lastModalShownAt: now,
    };
    setWmState(updated);
    saveWatermarkState(updated);
  }, []);

  const selectPackage = useCallback((id: PackageId) => {
    if (!isPackageId(id)) return;
    const now = Date.now();
    const updated: SmartDemoStateV1 = {
      ...stateRef.current,
      lastPackageSelectedId: id,
      lastPackageSelectedAt: now,
    };
    setWmState(updated);
    saveWatermarkState(updated);
  }, []);

  const recordWhatsAppClick = useCallback(() => {
    const now = Date.now();
    const updated: SmartDemoStateV1 = {
      ...stateRef.current,
      whatsappOpenRequestedCount: stateRef.current.whatsappOpenRequestedCount + 1,
      lastWhatsappOpenRequestedAt: now,
    };
    setWmState(updated);
    saveWatermarkState(updated);
  }, []);

  return (
    <WatermarkContext.Provider
      value={{
        state: wmState,
        score,
        tier,
        isNotificationVisible,
        isConversionModalOpen,
        isPackageModalOpen,
        selectedPackageId: wmState.lastPackageSelectedId,
        dismissNotification,
        openConversionModalFromNotification,
        dismissConversionModal,
        openPackageModal,
        closePackageModal,
        selectPackage,
        recordWhatsAppClick,
      }}
    >
      {children}
    </WatermarkContext.Provider>
  );
};

export const useWatermark = (): WatermarkContextType => {
  const context = useContext(WatermarkContext);
  if (!context) {
    throw new Error('useWatermark must be used within a WatermarkProvider');
  }
  return context;
};

