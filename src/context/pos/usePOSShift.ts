import { useState, useCallback, useEffect } from 'react';
import { Shift, User } from '../../types';
import { shiftService } from '../../services/shiftService';
import { userService } from '../../services/userService';
import { ToastType } from './usePOSToast';
import { sessionManager } from '../../mock/repositories/sessionManager';

export interface UsePOSShiftProps {
  currentUser: User | null;
  showToast: (message: string, type?: ToastType) => void;
  enabled?: boolean;
}

export const usePOSShift = ({ currentUser, showToast, enabled = true }: UsePOSShiftProps) => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState<boolean>(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState<boolean>(false);

  const openOpenShiftModal = useCallback(() => {
    if (activeShift && activeShift.status === 'open') {
      showToast('Shift kasir masih aktif. Selesaikan atau tutup shift yang berjalan terlebih dahulu.', 'info');
      return;
    }
    setIsOpenShiftModalOpen(true);
  }, [activeShift, showToast]);

  const closeOpenShiftModal = useCallback(() => {
    setIsOpenShiftModalOpen(false);
  }, []);

  const openCloseShiftModal = useCallback(() => {
    if (!activeShift || activeShift.status !== 'open') {
      showToast('Tidak ada shift aktif untuk ditutup.', 'info');
      return;
    }
    setIsCloseShiftModalOpen(true);
  }, [activeShift, showToast]);

  const closeCloseShiftModal = useCallback(() => {
    setIsCloseShiftModalOpen(false);
  }, []);

  const refreshShifts = useCallback(async () => {
    try {
      const [allShifts, currentActive] = await Promise.all([
        shiftService.getShifts(),
        shiftService.getActiveShift(),
      ]);
      setShifts(allShifts);
      setActiveShift(currentActive);
    } catch (err) {
      console.warn('[usePOSShift] Gagal memuat data shift:', err);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refreshShifts();
  }, [refreshShifts, enabled]);

  // Aksi Buka Shift
  const handleOpenShift = async (
    cashInitial: number,
    pin: string
  ): Promise<{ success: boolean; message: string; shift?: Shift }> => {
    if (activeShift && activeShift.status === 'open') {
      return { success: false, message: 'Shift aktif sudah ada pada perangkat kasir ini.' };
    }

    if (isNaN(cashInitial) || cashInitial < 0) {
      return { success: false, message: 'Modal awal kas tidak boleh bernilai negatif.' };
    }

    const pinAuth = await userService.verifyPin(pin);
    if (!pinAuth || !pinAuth.user) {
      return { success: false, message: 'PIN salah. Silakan coba lagi.' };
    }

    const verifiedUser = pinAuth.user;

    try {
      const newShift = await shiftService.openShift(cashInitial, verifiedUser);
      setActiveShift(newShift);
      setShifts(prev => [newShift, ...prev.filter(s => s.id !== newShift.id)]);
      setIsOpenShiftModalOpen(false);
      showToast(`Shift #${newShift.shift_number} berhasil dibuka oleh ${verifiedUser.name}!`, 'success');
      return { success: true, message: 'Shift berhasil dibuka', shift: newShift };
    } catch (err: any) {
      const msg = err.message || 'Gagal membuka shift';
      return { success: false, message: msg };
    }
  };

  // Aksi Tutup Shift
  const handleCloseShift = async (payload: {
    actual_cash_end: number;
    actual_qris_end: number | null;
    actual_refund_total: number | null;
    cash_difference_reason?: string;
    qris_difference_reason?: string;
    notes?: string;
    pin: string;
  }): Promise<{ success: boolean; message: string; shift?: Shift }> => {
    if (!activeShift || activeShift.status !== 'open') {
      return { success: false, message: 'Tidak ada shift aktif yang dapat ditutup.' };
    }

    if (isNaN(payload.actual_cash_end) || payload.actual_cash_end < 0) {
      return { success: false, message: 'Nominal cash di laci harus bernilai valid.' };
    }

    const pinAuth = await userService.verifyPin(payload.pin);
    if (!pinAuth || !pinAuth.user) {
      return { success: false, message: 'PIN salah. Silakan coba lagi.' };
    }

    // Identitas petugas penutup diambil strictly dari PIN yang berhasil diverifikasi
    const verifiedUser = pinAuth.user;

    try {
      const closedShift = await shiftService.closeShift({
        shift_id: activeShift.id,
        actual_cash_end: payload.actual_cash_end,
        actual_qris_end: payload.actual_qris_end,
        actual_refund_total: payload.actual_refund_total,
        cash_difference_reason: payload.cash_difference_reason,
        qris_difference_reason: payload.qris_difference_reason,
        notes: payload.notes,
        user: verifiedUser,
      });

      setActiveShift(null);
      setShifts(prev => prev.map(s => (s.id === closedShift.id ? closedShift : s)));
      // Catatan: Jangan menutup modal di sini jika modal menampilkan receipt akhir penutupan
      showToast(`Shift #${closedShift.shift_number} resmi ditutup oleh ${verifiedUser.name}!`, 'success');
      return { success: true, message: 'Shift berhasil ditutup', shift: closedShift };
    } catch (err: any) {
      const msg = err.message || 'Gagal menutup shift';
      return { success: false, message: msg };
    }
  };

  // Aksi Review Rekonsiliasi Shift oleh Owner
  const handleReviewShift = async (payload: {
    shift_id: string;
    action: 'approved_variance' | 'correction_requested';
    notes?: string;
    pin: string;
  }): Promise<{ success: boolean; message: string; shift?: Shift }> => {
    const pinAuth = await userService.verifyPin(payload.pin);
    if (!pinAuth || !pinAuth.user) {
      return { success: false, message: 'PIN salah. Silakan coba lagi.' };
    }

    if (pinAuth.user.role !== 'owner') {
      return { success: false, message: 'Hanya Owner yang berwenang meninjau atau menyetujui selisih rekonsiliasi shift.' };
    }

    const prevSession = sessionManager.getSession();
    sessionManager.setSession({
      userId: pinAuth.user.id,
      token: pinAuth.token || `owner_pin_auth_${pinAuth.user.id}`,
      loggedInAt: new Date().toISOString(),
    });

    try {
      const updatedShift = await shiftService.reviewShiftReconciliation({
        shift_id: payload.shift_id,
        action: payload.action,
        notes: payload.notes,
        user: pinAuth.user,
      });

      setShifts(prev => prev.map(s => (s.id === updatedShift.id ? updatedShift : s)));
      showToast(
        payload.action === 'approved_variance'
          ? `Selisih Shift #${updatedShift.shift_number} berhasil disetujui!`
          : `Shift #${updatedShift.shift_number} dikembalikan untuk koreksi.`,
        'success'
      );
      return { success: true, message: 'Review shift berhasil disimpan', shift: updatedShift };
    } catch (err: any) {
      const msg = err.message || 'Gagal mereview shift';
      return { success: false, message: msg };
    } finally {
      if (prevSession && prevSession.userId !== pinAuth.user.id) {
        sessionManager.setSession(prevSession);
      }
    }
  };

  // Aksi Koreksi Rekonsiliasi Shift
  const handleCorrectShift = async (payload: {
    shift_id: string;
    actual_cash_end: number;
    actual_qris_end: number | null;
    actual_refund_total?: number | null;
    cash_difference_reason?: string;
    qris_difference_reason?: string;
    correction_notes?: string;
    pin: string;
  }): Promise<{ success: boolean; message: string; shift?: Shift }> => {
    const pinAuth = await userService.verifyPin(payload.pin);
    if (!pinAuth || !pinAuth.user) {
      return { success: false, message: 'PIN salah. Silakan coba lagi.' };
    }

    try {
      const correctedShift = await shiftService.correctShiftReconciliation({
        shift_id: payload.shift_id,
        actual_cash_end: payload.actual_cash_end,
        actual_qris_end: payload.actual_qris_end,
        actual_refund_total: payload.actual_refund_total,
        cash_difference_reason: payload.cash_difference_reason,
        qris_difference_reason: payload.qris_difference_reason,
        correction_notes: payload.correction_notes,
        user: pinAuth.user,
      });

      setShifts(prev => prev.map(s => (s.id === correctedShift.id ? correctedShift : s)));
      showToast(`Koreksi rekonsiliasi Shift #${correctedShift.shift_number} berhasil disimpan!`, 'success');
      return { success: true, message: 'Koreksi shift berhasil disimpan', shift: correctedShift };
    } catch (err: any) {
      const msg = err.message || 'Gagal menyimpan koreksi shift';
      return { success: false, message: msg };
    }
  };

  const isShiftActive = Boolean(activeShift && activeShift.status === 'open');

  return {
    shifts,
    setShifts,
    activeShift,
    setActiveShift,
    isShiftActive,
    isOpenShiftModalOpen,
    openOpenShiftModal,
    closeOpenShiftModal,
    isCloseShiftModalOpen,
    openCloseShiftModal,
    closeCloseShiftModal,
    refreshShifts,
    openShift: handleOpenShift,
    closeShift: handleCloseShift,
    reviewShift: handleReviewShift,
    correctShift: handleCorrectShift,
  };
};
