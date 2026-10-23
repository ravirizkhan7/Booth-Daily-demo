import { useState, useCallback, useEffect, useMemo } from 'react';
import { Shift, User, ShiftExpense, ShiftExpenseCategory } from '../../types';
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
  const [shiftExpenses, setShiftExpenses] = useState<ShiftExpense[]>([]);

  const activeExpenses = useMemo(() => {
    if (!activeShift) return [];
    return shiftExpenses.filter(e => e.shift_id === activeShift.id);
  }, [shiftExpenses, activeShift]);

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
      const [allShifts, currentActive, allExpenses] = await Promise.all([
        shiftService.getShifts(),
        shiftService.getActiveShift(),
        shiftService.getAllExpenses(),
      ]);
      setShifts(allShifts);
      setActiveShift(currentActive);
      setShiftExpenses(allExpenses);
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

  // Aksi Catat Pengeluaran Kas (Petty Cash) Selama Shift
  const handleRecordShiftExpense = async (payload: {
    amount: number;
    category: ShiftExpenseCategory;
    description: string;
    receipt_number?: string;
    pin: string;
  }): Promise<{ success: boolean; message: string; expense?: ShiftExpense }> => {
    if (!activeShift || activeShift.status !== 'open') {
      return { success: false, message: 'Tidak ada shift aktif yang terbuka untuk mencatat pengeluaran.' };
    }

    const pinAuth = await userService.verifyPin(payload.pin);
    if (!pinAuth || !pinAuth.user) {
      return { success: false, message: 'PIN salah. Silakan coba lagi.' };
    }

    try {
      const newExpense = await shiftService.recordShiftExpense({
        shift_id: activeShift.id,
        amount: payload.amount,
        category: payload.category,
        description: payload.description,
        receipt_number: payload.receipt_number,
        user: pinAuth.user,
      });

      setShiftExpenses(prev => [...prev, newExpense]);
      showToast(`Pengeluaran kas Rp ${payload.amount.toLocaleString('id-ID')} berhasil dicatat!`, 'success');
      return { success: true, message: 'Pengeluaran kas berhasil dicatat', expense: newExpense };
    } catch (err: any) {
      const msg = err.message || 'Gagal mencatat pengeluaran kas';
      return { success: false, message: msg };
    }
  };

  // Aksi Batalkan Pengeluaran Kas (Owner Only)
  const handleCancelShiftExpense = async (payload: {
    expense_id: string;
    cancellation_reason: string;
    pin: string;
  }): Promise<{ success: boolean; message: string; expense?: ShiftExpense }> => {
    const pinAuth = await userService.verifyPin(payload.pin);
    if (!pinAuth || !pinAuth.user) {
      return { success: false, message: 'PIN salah. Silakan coba lagi.' };
    }

    if (pinAuth.user.role !== 'owner') {
      return { success: false, message: 'Hanya Owner yang berwenang membatalkan pengeluaran kas.' };
    }

    try {
      const cancelledExpense = await shiftService.cancelShiftExpense({
        expense_id: payload.expense_id,
        cancellation_reason: payload.cancellation_reason,
        owner_user: pinAuth.user,
      });

      setShiftExpenses(prev => prev.map(e => (e.id === cancelledExpense.id ? cancelledExpense : e)));
      showToast('Pengeluaran kas berhasil dibatalkan.', 'success');
      return { success: true, message: 'Pengeluaran kas berhasil dibatalkan', expense: cancelledExpense };
    } catch (err: any) {
      const msg = err.message || 'Gagal membatalkan pengeluaran kas';
      return { success: false, message: msg };
    }
  };

  // Aksi Revisi/Ganti Pengeluaran Kas (Owner Only)
  const handleReplaceShiftExpense = async (payload: {
    old_expense_id: string;
    new_expense: {
      amount: number;
      category: ShiftExpenseCategory;
      description: string;
      receipt_number?: string;
    };
    cancellation_reason: string;
    pin: string;
  }): Promise<{ success: boolean; message: string; expense?: ShiftExpense }> => {
    const pinAuth = await userService.verifyPin(payload.pin);
    if (!pinAuth || !pinAuth.user) {
      return { success: false, message: 'PIN salah. Silakan coba lagi.' };
    }

    if (pinAuth.user.role !== 'owner') {
      return { success: false, message: 'Hanya Owner yang berwenang merevisi pengeluaran kas.' };
    }

    try {
      const result = await shiftService.replaceShiftExpense({
        old_expense_id: payload.old_expense_id,
        new_expense: payload.new_expense,
        cancellation_reason: payload.cancellation_reason,
        owner_user: pinAuth.user,
      });

      setShiftExpenses(prev => {
        const updated = prev.map(e => (e.id === result.cancelled_expense.id ? result.cancelled_expense : e));
        return [...updated, result.new_expense];
      });
      showToast(`Pengeluaran kas berhasil direvisi menjadi Rp ${payload.new_expense.amount.toLocaleString('id-ID')}!`, 'success');
      return { success: true, message: 'Pengeluaran kas berhasil direvisi', expense: result.new_expense };
    } catch (err: any) {
      const msg = err.message || 'Gagal merevisi pengeluaran kas';
      return { success: false, message: msg };
    }
  };

  const isShiftActive = Boolean(activeShift && activeShift.status === 'open');

  return {
    shifts,
    setShifts,
    activeShift,
    setActiveShift,
    shiftExpenses,
    setShiftExpenses,
    activeExpenses,
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
    recordShiftExpense: handleRecordShiftExpense,
    cancelShiftExpense: handleCancelShiftExpense,
    replaceShiftExpense: handleReplaceShiftExpense,
  };
};
