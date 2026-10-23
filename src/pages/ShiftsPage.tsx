import React, { useState, useMemo } from 'react';
import { usePOS } from '../hooks/usePOS';
import { Shift, Order, ShiftExpense, ShiftExpenseCategory } from '../types';
import { formatRupiah, formatDateTime, formatDate } from '../utils/formatters';
import { calculateShiftFinancials, formatShiftDuration, getShiftQrisDisplayInfo, getOperationalDate } from '../utils/shiftCalculation';
import { getOrderHPPCategory } from '../utils/reportUtils';
import { PinKeypad } from '../components/common/PinKeypad';
import { NumberInput } from '../components/common/NumberInput';
import {
  Clock,
  DoorOpen,
  Lock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Banknote,
  QrCode,
  Eye,
  X,
  User,
  ShoppingBag,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Check,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  History,
  FileText,
  PlusCircle,
  Trash2,
  ArrowRightLeft,
  DollarSign
} from 'lucide-react';

export const ShiftsPage: React.FC = () => {
  const {
    shifts,
    activeShift,
    shiftExpenses,
    activeExpenses,
    orders,
    products,
    recipes,
    stocks,
    openOpenShiftModal,
    openCloseShiftModal,
    settings,
    currentUser,
    reviewShift,
    correctShift,
    recordShiftExpense,
    cancelShiftExpense,
    replaceShiftExpense,
  } = usePOS();

  const isOwner = currentUser?.role === 'owner';
  const currentUserId = currentUser?.id || '';

  // Filter state for Owner: 'all' | 'today' | 'week' | 'month' | 'custom'
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [filterType, setFilterType] = useState<'shift_time' | 'operational_date'>('shift_time');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Filter state for Cashier: 'all' | 'correction_needed' | 'balanced'
  const [cashierStatusFilter, setCashierStatusFilter] = useState<'all' | 'correction_needed' | 'balanced'>('all');

  // Selected shift for Detail Modal
  const [selectedShiftForDetail, setSelectedShiftForDetail] = useState<Shift | null>(null);

  // Modal Review Owner state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [reviewAction, setReviewAction] = useState<'approved_variance' | 'correction_requested' | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [reviewPin, setReviewPin] = useState<string>('');
  const [reviewError, setReviewError] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // Modal Koreksi Rekonsiliasi state
  const [isCorrectModalOpen, setIsCorrectModalOpen] = useState<boolean>(false);
  const [correctedCashValue, setCorrectedCashValue] = useState<number>(0);
  const [correctedQrisValue, setCorrectedQrisValue] = useState<number>(0);
  const [correctedCashReason, setCorrectedCashReason] = useState<string>('');
  const [correctedQrisReason, setCorrectedQrisReason] = useState<string>('');
  const [correctionNotes, setCorrectionNotes] = useState<string>('');
  const [correctPin, setCorrectPin] = useState<string>('');
  const [correctError, setCorrectError] = useState<string>('');
  const [isSubmittingCorrect, setIsSubmittingCorrect] = useState<boolean>(false);

  // Modal Catat Pengeluaran Kas (Petty Cash) state
  const [isRecordExpenseModalOpen, setIsRecordExpenseModalOpen] = useState<boolean>(false);
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseCategory, setExpenseCategory] = useState<ShiftExpenseCategory>('operasional_booth');
  const [expenseDescription, setExpenseDescription] = useState<string>('');
  const [expenseReceiptNumber, setExpenseReceiptNumber] = useState<string>('');
  const [expensePin, setExpensePin] = useState<string>('');
  const [expenseError, setExpenseError] = useState<string>('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState<boolean>(false);

  // Modal Batalkan Pengeluaran Kas state
  const [isCancelExpenseModalOpen, setIsCancelExpenseModalOpen] = useState<boolean>(false);
  const [selectedExpenseToCancel, setSelectedExpenseToCancel] = useState<ShiftExpense | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelPin, setCancelPin] = useState<string>('');
  const [cancelError, setCancelError] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);

  // Modal Revisi Pengeluaran Kas state
  const [isReplaceExpenseModalOpen, setIsReplaceExpenseModalOpen] = useState<boolean>(false);
  const [selectedExpenseToReplace, setSelectedExpenseToReplace] = useState<ShiftExpense | null>(null);
  const [replaceAmount, setReplaceAmount] = useState<number>(0);
  const [replaceCategory, setReplaceCategory] = useState<ShiftExpenseCategory>('operasional_booth');
  const [replaceDescription, setReplaceDescription] = useState<string>('');
  const [replaceReceiptNumber, setReplaceReceiptNumber] = useState<string>('');
  const [replaceCancelReason, setReplaceCancelReason] = useState<string>('');
  const [replacePin, setReplacePin] = useState<string>('');
  const [replaceError, setReplaceError] = useState<string>('');
  const [isSubmittingReplace, setIsSubmittingReplace] = useState<boolean>(false);

  // Helper: Get reconciliation status for any shift
  const getShiftReconciliationStatus = (shift: Shift): string => {
    if (shift.reconciliation_status === 'matched_corrected' || shift.snapshot?.reconciliation_status === 'matched_corrected') {
      return 'matched_corrected';
    }
    const hasCorrection = Array.isArray(shift.audit_trail) && shift.audit_trail.some(a => a.action === 'corrected');
    if (shift.reconciliation_status) {
      if (shift.reconciliation_status === 'matched' && hasCorrection) return 'matched_corrected';
      return shift.reconciliation_status;
    }
    if (shift.snapshot?.reconciliation_status) {
      if (shift.snapshot.reconciliation_status === 'matched' && hasCorrection) return 'matched_corrected';
      return shift.snapshot.reconciliation_status;
    }
    const cashDiff = shift.snapshot?.cash_difference ?? 0;
    const qrisDiff = shift.snapshot?.qris_difference ?? 0;
    if (cashDiff === 0 && qrisDiff === 0) {
      return hasCorrection ? 'matched_corrected' : 'matched';
    }
    return 'pending_review';
  };

  // Helper: Check whether a closed shift is the responsibility of the current cashier
  const isShiftAssignedToUser = (shift: Shift, userId: string): boolean => {
    // Explicit assignment for correction
    if ((shift as any).assigned_to_user_id) {
      return (shift as any).assigned_to_user_id === userId;
    }
    // Opened by user
    if (shift.opened_by_user_id === userId) return true;
    // Closed by user
    if (shift.closed_by_user_id === userId) return true;
    // Handled orders in shift
    const hasOrder = orders.some(o => o.shift_id === shift.id && o.created_by_user_id === userId);
    if (hasOrder) return true;
    // Logged in audit trail
    if (shift.audit_trail?.some(a => a.user_id === userId)) return true;

    return false;
  };

  // Active shift financial snapshot
  const activeFinancials = useMemo(() => {
    if (!activeShift) return null;
    return calculateShiftFinancials(activeShift, orders, products, recipes, stocks, undefined, activeExpenses);
  }, [activeShift, orders, products, recipes, stocks, activeExpenses]);

  // Closed shifts visible based on role and responsibility
  const closedShifts = useMemo(() => {
    return shifts.filter(s => s.status === 'closed');
  }, [shifts]);

  const userVisibleClosedShifts = useMemo(() => {
    if (isOwner) return closedShifts;
    return closedShifts.filter(s => isShiftAssignedToUser(s, currentUserId));
  }, [closedShifts, isOwner, currentUserId, orders]);

  // Helper to format local date string (YYYY-MM-DD) avoiding UTC timezone shift
  const toLocalDateString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const filteredClosedShifts = useMemo(() => {
    if (isOwner) {
      const now = new Date();
      const cutoffTime = settings?.operational_day_cutoff_time || '04:00';
      const currentOperationalDate = getOperationalDate(now, cutoffTime);
      const currentActualDate = toLocalDateString(now);

      return userVisibleClosedShifts.filter(shift => {
        if (filterPeriod === 'all') return true;

        // Resolve date string for the shift according to selected basis
        let shiftDateStr: string;
        if (filterType === 'operational_date') {
          shiftDateStr = shift.operational_date || getOperationalDate(new Date(shift.opened_at), cutoffTime);
        } else {
          shiftDateStr = toLocalDateString(new Date(shift.opened_at));
        }

        if (filterPeriod === 'today') {
          const targetToday = filterType === 'operational_date' ? currentOperationalDate : currentActualDate;
          return shiftDateStr === targetToday;
        }

        if (filterPeriod === 'week') {
          // Normalized 7 days inclusive: today down to 6 days ago
          let targetEndStr: string;
          let targetStartStr: string;

          if (filterType === 'operational_date') {
            targetEndStr = currentOperationalDate;
            const [y, m, d] = currentOperationalDate.split('-').map(Number);
            const startDate = new Date(y, m - 1, d - 6);
            targetStartStr = toLocalDateString(startDate);
          } else {
            targetEndStr = currentActualDate;
            const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
            targetStartStr = toLocalDateString(startDate);
          }

          return shiftDateStr >= targetStartStr && shiftDateStr <= targetEndStr;
        }

        if (filterPeriod === 'month') {
          const targetMonth = filterType === 'operational_date'
            ? currentOperationalDate.slice(0, 7)
            : currentActualDate.slice(0, 7);
          return shiftDateStr.startsWith(targetMonth);
        }

        if (filterPeriod === 'custom') {
          if (customStartDate && shiftDateStr < customStartDate) return false;
          if (customEndDate && shiftDateStr > customEndDate) return false;
          return true;
        }

        return true;
      });
    }

    // Cashier filter logic: by relevant workflow status
    return userVisibleClosedShifts.filter(shift => {
      const reconStatus = getShiftReconciliationStatus(shift);
      if (cashierStatusFilter === 'correction_needed') {
        return reconStatus === 'correction_requested';
      }
      if (cashierStatusFilter === 'balanced') {
        return reconStatus === 'matched' || reconStatus === 'matched_corrected';
      }
      return true;
    });
  }, [userVisibleClosedShifts, isOwner, filterPeriod, filterType, customStartDate, customEndDate, cashierStatusFilter, settings?.operational_day_cutoff_time]);

  // Synchronize selectedShift with POS state (and guard against unauthorized shift access for cashier)
  const currentSelectedShift = useMemo(() => {
    if (!selectedShiftForDetail) return null;
    const target = shifts.find(s => s.id === selectedShiftForDetail.id) || selectedShiftForDetail;
    if (!isOwner && target.status === 'closed' && !isShiftAssignedToUser(target, currentUserId)) {
      return null;
    }
    return target;
  }, [shifts, selectedShiftForDetail, isOwner, currentUserId, orders]);

  const getReconBadge = (status?: string) => {
    switch (status) {
      case 'matched_corrected':
        return {
          label: 'Cocok (Terkoreksi)',
          desc: 'Saldo cocok setelah dilakukan koreksi riil',
          badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20',
          icon: CheckCircle2,
        };
      case 'matched':
        return {
          label: 'Cocok',
          desc: 'Semua saldo sesuai tanpa selisih',
          badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
          icon: CheckCircle2,
        };
      case 'pending_review':
        return {
          label: 'Menunggu Review Owner',
          desc: 'Terdapat selisih kas/QRIS yang menunggu telaah Owner',
          badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
          icon: AlertTriangle,
        };
      case 'approved_variance':
        return {
          label: 'Selisih Disetujui Owner',
          desc: 'Penjelasan selisih telah disetujui tanpa mengubah nilai riil',
          badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
          icon: ShieldCheck,
        };
      case 'correction_requested':
        return {
          label: 'Perlu Koreksi',
          desc: 'Owner mengembalikan laporan shift untuk perbaikan',
          badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
          icon: ShieldAlert,
        };
      default:
        return {
          label: 'Selesai',
          desc: 'Shift tertutup',
          badgeClass: 'bg-stone-100 dark:bg-stone-800 text-stone-600 border border-stone-200 dark:border-stone-700',
          icon: Check,
        };
    }
  };

  // Review Owner handlers
  const handleOpenReview = (action: 'approved_variance' | 'correction_requested') => {
    setReviewAction(action);
    setReviewNotes('');
    setReviewPin('');
    setReviewError('');
    setIsReviewModalOpen(true);
  };

  const handleExecuteReview = async () => {
    if (!currentSelectedShift || !reviewAction) return;
    if (!reviewPin.trim()) {
      setReviewError('PIN Owner wajib diisi.');
      return;
    }
    if (reviewAction === 'correction_requested' && !reviewNotes.trim()) {
      setReviewError('Catatan / alasan pengembalian untuk koreksi wajib diisi.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError('');
    try {
      const res = await reviewShift({
        shift_id: currentSelectedShift.id,
        action: reviewAction,
        notes: reviewNotes.trim() || undefined,
        pin: reviewPin.trim(),
      });
      if (!res.success) {
        setReviewError(res.message || 'Gagal memproses review rekonsiliasi.');
        setIsSubmittingReview(false);
        return;
      }
      if (res.shift) {
        setSelectedShiftForDetail(res.shift);
      }
      setIsReviewModalOpen(false);
    } catch (err: any) {
      setReviewError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Koreksi Rekonsiliasi handlers
  const handleOpenCorrect = (shiftToCorrect?: Shift) => {
    const targetShift = shiftToCorrect || currentSelectedShift;
    if (!targetShift) return;
    if (targetShift !== currentSelectedShift) {
      setSelectedShiftForDetail(targetShift);
    }
    const snap = targetShift.snapshot;
    setCorrectedCashValue(snap?.actual_cash_end !== undefined ? snap.actual_cash_end : (snap?.expected_cash_end || 0));
    setCorrectedQrisValue(snap?.actual_qris_end !== undefined && snap?.actual_qris_end !== null ? snap.actual_qris_end : (snap?.expected_qris_end || 0));
    setCorrectedCashReason(snap?.cash_difference_reason || targetShift.cash_difference_reason || '');
    setCorrectedQrisReason(snap?.qris_difference_reason || targetShift.qris_difference_reason || '');
    setCorrectionNotes('');
    setCorrectPin('');
    setCorrectError('');
    setIsCorrectModalOpen(true);
  };

  const handleExecuteCorrect = async () => {
    if (!currentSelectedShift) return;
    if (!correctPin.trim()) {
      setCorrectError('PIN petugas wajib diisi.');
      return;
    }
    if (!correctionNotes.trim()) {
      setCorrectError('Catatan penjelasan koreksi wajib diisi.');
      return;
    }

    setIsSubmittingCorrect(true);
    setCorrectError('');
    try {
      const res = await correctShift({
        shift_id: currentSelectedShift.id,
        actual_cash_end: correctedCashValue,
        actual_qris_end: correctedQrisValue,
        cash_difference_reason: correctedCashReason.trim() || undefined,
        qris_difference_reason: correctedQrisReason.trim() || undefined,
        correction_notes: correctionNotes.trim(),
        pin: correctPin.trim(),
      });
      if (!res.success) {
        setCorrectError(res.message || 'Gagal menyimpan koreksi rekonsiliasi.');
        setIsSubmittingCorrect(false);
        return;
      }
      if (res.shift) {
        setSelectedShiftForDetail(res.shift);
      }
      setIsCorrectModalOpen(false);
    } catch (err: any) {
      setCorrectError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmittingCorrect(false);
    }
  };

  const handleOpenCancelExpense = (expense: ShiftExpense) => {
    setSelectedExpenseToCancel(expense);
    setCancelReason('');
    setCancelPin('');
    setCancelError('');
    setIsSubmittingCancel(false);
    setIsCancelExpenseModalOpen(true);
  };

  const handleOpenReplaceExpense = (expense: ShiftExpense) => {
    setSelectedExpenseToReplace(expense);
    setReplaceAmount(expense.amount);
    setReplaceCategory(expense.category);
    setReplaceDescription(expense.description);
    setReplaceReceiptNumber(expense.receipt_number || '');
    setReplaceCancelReason('');
    setReplacePin('');
    setReplaceError('');
    setIsSubmittingReplace(false);
    setIsReplaceExpenseModalOpen(true);
  };

  const handleExecuteRecordExpense = async () => {
    setExpenseError('');
    if (!expenseAmount || expenseAmount <= 0) {
      setExpenseError('Nominal pengeluaran harus berupa angka bulat positif.');
      return;
    }
    if (!expenseDescription || expenseDescription.trim().length < 3) {
      setExpenseError('Keterangan pengeluaran minimal 3 karakter non-spasi.');
      return;
    }
    if (!expensePin || expensePin.length < 4) {
      setExpenseError('Masukkan PIN petugas pengeluaran kas.');
      return;
    }

    setIsSubmittingExpense(true);
    try {
      const res = await recordShiftExpense({
        amount: Math.round(expenseAmount),
        category: expenseCategory,
        description: expenseDescription.trim(),
        receipt_number: expenseReceiptNumber.trim() || undefined,
        pin: expensePin,
      });

      if (!res.success) {
        setExpenseError(res.message || 'Gagal mencatat pengeluaran kas.');
        setIsSubmittingExpense(false);
        return;
      }

      setIsRecordExpenseModalOpen(false);
      setExpenseAmount(0);
      setExpenseDescription('');
      setExpenseReceiptNumber('');
      setExpensePin('');
    } catch (err: any) {
      setExpenseError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleExecuteCancelExpense = async () => {
    setCancelError('');
    if (!selectedExpenseToCancel) return;
    if (!cancelReason || cancelReason.trim().length < 3) {
      setCancelError('Alasan pembatalan minimal 3 karakter non-spasi.');
      return;
    }
    if (!cancelPin || cancelPin.length < 4) {
      setCancelError('Masukkan PIN Owner untuk membatalkan pengeluaran.');
      return;
    }

    setIsSubmittingCancel(true);
    try {
      const res = await cancelShiftExpense({
        expense_id: selectedExpenseToCancel.id,
        cancellation_reason: cancelReason.trim(),
        pin: cancelPin,
      });

      if (!res.success) {
        setCancelError(res.message || 'Gagal membatalkan pengeluaran.');
        setIsSubmittingCancel(false);
        return;
      }

      setIsCancelExpenseModalOpen(false);
      setSelectedExpenseToCancel(null);
    } catch (err: any) {
      setCancelError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleExecuteReplaceExpense = async () => {
    setReplaceError('');
    if (!selectedExpenseToReplace) return;
    if (!replaceAmount || replaceAmount <= 0) {
      setReplaceError('Nominal baru harus berupa angka bulat positif.');
      return;
    }
    if (!replaceDescription || replaceDescription.trim().length < 3) {
      setReplaceError('Keterangan baru minimal 3 karakter non-spasi.');
      return;
    }
    if (!replaceCancelReason || replaceCancelReason.trim().length < 3) {
      setReplaceError('Alasan revisi pengeluaran lama minimal 3 karakter non-spasi.');
      return;
    }
    if (!replacePin || replacePin.length < 4) {
      setReplaceError('Masukkan PIN Owner untuk merevisi pengeluaran.');
      return;
    }

    setIsSubmittingReplace(true);
    try {
      const res = await replaceShiftExpense({
        old_expense_id: selectedExpenseToReplace.id,
        new_expense: {
          amount: Math.round(replaceAmount),
          category: replaceCategory,
          description: replaceDescription.trim(),
          receipt_number: replaceReceiptNumber.trim() || undefined,
        },
        cancellation_reason: replaceCancelReason.trim(),
        pin: replacePin,
      });

      if (!res.success) {
        setReplaceError(res.message || 'Gagal merevisi pengeluaran.');
        setIsSubmittingReplace(false);
        return;
      }

      setIsReplaceExpenseModalOpen(false);
      setSelectedExpenseToReplace(null);
    } catch (err: any) {
      setReplaceError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmittingReplace(false);
    }
  };

  // Selected shift detail financials & transactions
  const selectedDetailData = useMemo(() => {
    if (!currentSelectedShift) return null;

    const isCurrentActive = currentSelectedShift.status === 'open';
    const shiftExpenseList = isCurrentActive
      ? activeExpenses
      : (shiftExpenses || []).filter(e => e.shift_id === currentSelectedShift.id);
    const financials = isCurrentActive
      ? calculateShiftFinancials(currentSelectedShift, orders, products, recipes, stocks, undefined, shiftExpenseList)
      : (currentSelectedShift.snapshot || calculateShiftFinancials(currentSelectedShift, orders, products, recipes, stocks, undefined, shiftExpenseList));

    const shiftOrders = orders.filter(o => o.shift_id === currentSelectedShift.id);
    const shiftRefundOrders = orders.filter(o => {
      if (o.refund_shift_id) return o.refund_shift_id === currentSelectedShift.id;
      return o.shift_id === currentSelectedShift.id && o.payment?.status === 'refunded';
    });

    return {
      financials,
      orders: shiftOrders,
      refundOrders: shiftRefundOrders,
      shiftExpenseList,
      isCurrentActive,
    };
  }, [currentSelectedShift, orders, products, recipes, stocks, activeExpenses, shiftExpenses]);

  const correctionRequestedShifts = useMemo(() => {
    return userVisibleClosedShifts.filter(s => getShiftReconciliationStatus(s) === 'correction_requested');
  }, [userVisibleClosedShifts]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#3B2A1F] text-[#D4A373]">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
                Shift & Rekonsiliasi Keuangan
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                Laporan sesi kasir, kepatuhan kas di laci, selisih QRIS, dan audit petugas
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {activeShift ? (
            <button
              type="button"
              onClick={openCloseShiftModal}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Tutup Shift Aktif</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openOpenShiftModal}
              className="px-4 py-2.5 bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-extrabold text-xs rounded-2xl shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <DoorOpen className="w-4 h-4 text-[#D4A373]" />
              <span>Buka Shift Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Alert Banner: Shift Perlu Koreksi (Mudah ditemukan oleh Kasir tanpa login Owner) */}
      {correctionRequestedShifts.length > 0 && (
        <div className="p-4 sm:p-5 bg-rose-500/10 dark:bg-rose-950/20 border border-rose-500/30 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 sm:mt-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-stone-100">
                  {correctionRequestedShifts.length} Shift Memerlukan Koreksi Rekonsiliasi
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                  Penting
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                Owner mengembalikan laporan shift untuk perbaikan nominal fisik atau QRIS. Kasir dapat langsung mengoreksi shift terkait di bawah ini.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {correctionRequestedShifts.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleOpenCorrect(s)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Koreksi Shift #{s.shift_number}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 1: RINGKASAN SHIFT AKTIF                          */}
      {/* ======================================================== */}
      {activeShift && activeFinancials ? (
        <div className="bg-white dark:bg-[#1A1816] rounded-3xl p-5 sm:p-6 shadow-sm border border-stone-200/80 dark:border-stone-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800/80 pb-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Shift #{activeShift.shift_number} Sedang Aktif
                </span>
                <p className="text-sm font-bold text-stone-800 dark:text-stone-200 mt-1">
                  Dibuka oleh: <strong className="text-stone-900 dark:text-stone-100">{activeShift.opened_by_name}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Clock className="w-4 h-4 text-[#C68B59]" />
              <span>Durasi Berjalan: <strong className="text-stone-800 dark:text-stone-200">{formatShiftDuration(activeShift.opened_at)}</strong></span>
              <span className="text-stone-300 dark:text-stone-700">|</span>
              <span>Waktu Buka: {formatDateTime(activeShift.opened_at)}</span>
            </div>
          </div>

          {/* Stat Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <div className="p-3.5 bg-stone-50 dark:bg-[#22201D] rounded-2xl border border-stone-100 dark:border-stone-800/80">
              <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Modal Awal</span>
              <p className="text-base font-extrabold text-stone-800 dark:text-stone-200 mt-1">
                {formatRupiah(activeFinancials.cash_initial)}
              </p>
            </div>

            <div className="p-3.5 bg-stone-50 dark:bg-[#22201D] rounded-2xl border border-stone-100 dark:border-stone-800/80">
              <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Penjualan Tunai</span>
              <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatRupiah(activeFinancials.cash_sales)}
              </p>
            </div>

            <div className="p-3.5 bg-stone-50 dark:bg-[#22201D] rounded-2xl border border-stone-100 dark:border-stone-800/80">
              <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Penjualan QRIS</span>
              <p className="text-base font-extrabold text-stone-800 dark:text-stone-200 mt-1">
                {formatRupiah(activeFinancials.qris_sales)}
              </p>
            </div>

            <div className="p-3.5 bg-stone-50 dark:bg-[#22201D] rounded-2xl border border-stone-100 dark:border-stone-800/80">
              <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Kas Keluar (-)</span>
              <p className="text-base font-extrabold text-rose-500 mt-1">
                -{formatRupiah(activeFinancials.cash_expenses || 0)}
              </p>
            </div>

            <div className="p-3.5 bg-stone-50 dark:bg-[#22201D] rounded-2xl border border-stone-100 dark:border-stone-800/80">
              <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Refund Tercatat</span>
              <p className="text-base font-extrabold text-rose-500 mt-1">
                {formatRupiah(activeFinancials.cash_refunds + activeFinancials.qris_refunds)}
              </p>
            </div>

            <div className="p-3.5 bg-stone-50 dark:bg-[#22201D] rounded-2xl border border-stone-100 dark:border-stone-800/80">
              <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Kas Harapan di Laci</span>
              <p className="text-base font-black text-[#C68B59] mt-1">
                {formatRupiah(activeFinancials.expected_cash_end)}
              </p>
            </div>

            <div className="p-3.5 bg-stone-50 dark:bg-[#22201D] rounded-2xl border border-stone-100 dark:border-stone-800/80">
              <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">Transaksi Shift</span>
              <p className="text-base font-extrabold text-stone-800 dark:text-stone-200 mt-1">
                {activeFinancials.total_orders_count} Pesanan
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800/80 text-xs">
            <span className="text-stone-500">
              Hari Operasional: <strong>{activeShift.operational_date || formatDate(activeShift.opened_at)}</strong> (Cutoff: {settings?.operational_day_cutoff_time || '04:00'})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRecordExpenseModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Catat Kas Keluar</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedShiftForDetail(activeShift)}
                className="px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Lihat Laporan Sementara</span>
              </button>
              <button
                type="button"
                onClick={openCloseShiftModal}
                className="px-3.5 py-1.5 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>Tutup Shift Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-amber-500/10 dark:bg-amber-950/20 border border-dashed border-amber-500/30 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-800 dark:text-amber-300">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-amber-950 dark:text-amber-200">
                Tidak Ada Shift Aktif Saat Ini
              </h2>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Perangkat kasir sedang terkunci. Buka shift untuk mencatat modal awal dan mengizinkan transaksi kasir.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openOpenShiftModal}
            className="px-5 py-2.5 bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-black text-xs rounded-2xl shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0"
          >
            <DoorOpen className="w-4 h-4 text-[#D4A373]" />
            <span>Buka Shift Baru</span>
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: TABEL OPEN SHIFT (Shift Aktif)                 */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-[#1A1816] rounded-3xl p-5 sm:p-6 shadow-sm border border-stone-200/80 dark:border-stone-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h2 className="text-base font-extrabold text-stone-900 dark:text-stone-100">
              Tabel Open Shift (Sedang Berjalan)
            </h2>
          </div>
          <span className="text-xs text-stone-500">
            {activeShift ? '1 shift aktif' : '0 shift aktif'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-50 dark:bg-[#22201D] text-stone-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3 rounded-l-xl">No. Shift</th>
                <th className="p-3">Waktu Buka</th>
                <th className="p-3">Petugas Pembuka</th>
                <th className="p-3">Modal Awal</th>
                <th className="p-3">Hari Operasional</th>
                <th className="p-3">Durasi</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right rounded-r-xl">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80 font-medium">
              {activeShift ? (
                <tr className="hover:bg-stone-50/50 dark:hover:bg-stone-900/30 transition-colors">
                  <td className="p-3 font-extrabold text-stone-900 dark:text-stone-100">
                    #{activeShift.shift_number}
                  </td>
                  <td className="p-3 text-stone-600 dark:text-stone-300">
                    {formatDateTime(activeShift.opened_at)}
                  </td>
                  <td className="p-3 font-bold text-stone-900 dark:text-stone-100">
                    {activeShift.opened_by_name}
                  </td>
                  <td className="p-3 font-semibold text-[#C68B59]">
                    {formatRupiah(activeShift.cash_initial)}
                  </td>
                  <td className="p-3 text-stone-500">
                    {activeShift.operational_date || formatDate(activeShift.opened_at)}
                  </td>
                  <td className="p-3 text-stone-600 dark:text-stone-300 font-bold">
                    {formatShiftDuration(activeShift.opened_at)}
                  </td>
                  <td className="p-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      Aktif
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedShiftForDetail(activeShift)}
                      className="px-3 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-[#3B2A1F] hover:text-[#F7F5F2] rounded-lg font-bold transition-colors cursor-pointer text-[11px]"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-stone-400 italic">
                    Tidak ada shift yang sedang terbuka.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 3: TABEL CLOSED SHIFT (Histori Shift Selesai)     */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-[#1A1816] rounded-3xl p-5 sm:p-6 shadow-sm border border-stone-200/80 dark:border-stone-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800/80 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-stone-900 dark:text-stone-100">
              Tabel Closed Shift (Histori Penutupan Shift)
            </h2>
            <p className="text-xs text-stone-500">
              Menampilkan {filteredClosedShifts.length} dari {userVisibleClosedShifts.length} riwayat shift tertutup{isOwner ? '' : ' yang ditugaskan'}
            </p>
          </div>

          {/* Filter Controls: Owner gets Period & Basis, Cashier gets relevant Workflow Status filter */}
          <div className="flex flex-wrap items-center gap-2">
            {isOwner ? (
              <>
                {/* Filter Date Basis for Owner */}
                <div className="flex items-center rounded-xl bg-stone-100 dark:bg-stone-800 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFilterType('shift_time')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      filterType === 'shift_time'
                        ? 'bg-white dark:bg-[#25221F] text-stone-900 dark:text-white shadow-sm'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Waktu Shift
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('operational_date')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      filterType === 'operational_date'
                        ? 'bg-white dark:bg-[#25221F] text-stone-900 dark:text-white shadow-sm'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Hari Operasional
                  </button>
                </div>

                {/* Quick Period Buttons for Owner */}
                <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-xl text-xs font-bold">
                  {[
                    { id: 'all', label: 'Semua' },
                    { id: 'today', label: 'Hari Ini' },
                    { id: 'week', label: '7 Hari' },
                    { id: 'month', label: 'Bulan Ini' },
                    { id: 'custom', label: 'Kustom' },
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilterPeriod(f.id as any)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        filterPeriod === f.id
                          ? 'bg-[#3B2A1F] text-[#F7F5F2]'
                          : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Range Controls for Owner */}
                {filterPeriod === 'custom' && (
                  <div className="flex items-center gap-1.5 text-xs bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-200/80 dark:border-stone-700/80">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-[#25221F] text-stone-900 dark:text-white border border-stone-300 dark:border-stone-700 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#C68B59]"
                      title="Tanggal Mulai"
                    />
                    <span className="text-stone-400 font-bold">-</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-[#25221F] text-stone-900 dark:text-white border border-stone-300 dark:border-stone-700 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#C68B59]"
                      title="Tanggal Akhir"
                    />
                    {(customStartDate || customEndDate) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomStartDate('');
                          setCustomEndDate('');
                        }}
                        className="px-2 py-1 text-[11px] font-bold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
                        title="Reset tanggal kustom"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Cashier-specific Status Filter (eliminates unneeded Waktu Shift/Hari Operasional filters) */
              <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-xl text-xs font-bold">
                {[
                  { id: 'all', label: 'Semua Shift Saya' },
                  { id: 'correction_needed', label: 'Perlu Koreksi' },
                  { id: 'balanced', label: 'Selesai' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCashierStatusFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      cashierStatusFilter === f.id
                        ? 'bg-[#3B2A1F] text-[#F7F5F2]'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table of Closed Shifts */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[950px]">
            <thead className="bg-stone-50 dark:bg-[#22201D] text-stone-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3 rounded-l-xl">Shift</th>
                <th className="p-3">Periode Buka / Tutup</th>
                <th className="p-3">Pembuka & Penutup</th>
                {isOwner && <th className="p-3">Penjualan Bersih</th>}
                {isOwner && <th className="p-3">HPP & Laba</th>}
                <th className="p-3">Rekonsiliasi Kas</th>
                <th className="p-3">Rekonsiliasi QRIS</th>
                <th className="p-3">Status Verifikasi</th>
                <th className="p-3 text-right rounded-r-xl">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80 font-medium">
              {filteredClosedShifts.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 9 : 7} className="p-6 text-center text-stone-400 italic">
                    Belum ada data shift tertutup pada filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredClosedShifts.map(s => {
                  const snap = s.snapshot;
                  const duration = formatShiftDuration(s.opened_at, s.closed_at);

                  return (
                    <tr key={s.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-900/30 transition-colors">
                      <td className="p-3">
                        <span className="font-extrabold text-stone-900 dark:text-stone-100">
                          #{s.shift_number}
                        </span>
                        <p className="text-[10px] text-stone-400 mt-0.5">{duration}</p>
                      </td>

                      <td className="p-3 text-stone-600 dark:text-stone-300">
                        <p className="font-semibold text-stone-900 dark:text-stone-100">{formatDateTime(s.opened_at)}</p>
                        <p className="text-[11px] text-stone-400">s/d {s.closed_at ? formatDateTime(s.closed_at) : '-'}</p>
                      </td>

                      {/* Identitas pembuka dan penutup ditampilkan terpisah */}
                      <td className="p-3 text-stone-700 dark:text-stone-300">
                        <p>
                          <span className="text-stone-400 text-[10px] uppercase font-bold">Buka:</span>{' '}
                          <strong>{s.opened_by_name}</strong>
                        </p>
                        <p className="mt-0.5">
                          <span className="text-stone-400 text-[10px] uppercase font-bold">Tutup:</span>{' '}
                          <strong>{s.closed_by_name || '-'}</strong>
                        </p>
                      </td>

                      {isOwner && (
                        <td className="p-3">
                          <p className="font-extrabold text-stone-900 dark:text-stone-100">
                            {formatRupiah(snap?.net_sales ?? 0)}
                          </p>
                          <p className="text-[10px] text-stone-400">
                            Bruto: {formatRupiah(snap?.gross_sales ?? 0)}
                          </p>
                        </td>
                      )}

                      {isOwner && (
                        <td className="p-3">
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatRupiah(snap?.estimated_gross_profit ?? 0)}
                          </p>
                          <p className="text-[10px] text-stone-400">
                            HPP: {formatRupiah(snap?.estimated_hpp ?? 0)}
                          </p>
                        </td>
                      )}

                      {/* Rekonsiliasi Kas */}
                      <td className="p-3">
                        <p className="font-bold text-stone-800 dark:text-stone-200">
                          Aktual: {formatRupiah(snap?.actual_cash_end ?? 0)}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] mt-0.5">
                          <span className="text-stone-400">Harapan: {formatRupiah(snap?.expected_cash_end ?? 0)}</span>
                          <span className="text-stone-300">•</span>
                          <span className={snap?.cash_difference === 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                            {snap?.cash_difference === 0 ? 'Sesuai' : formatRupiah(snap?.cash_difference ?? 0)}
                          </span>
                        </div>
                      </td>

                      {/* Rekonsiliasi QRIS */}
                      <td className="p-3">
                        {(() => {
                          const qrisInfo = getShiftQrisDisplayInfo(snap);
                          if (qrisInfo.status === 'no_transaction') {
                            return (
                              <div className="space-y-0.5">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800/60 inline-flex items-center gap-1">
                                  Tidak ada transaksi
                                </span>
                                <p className="text-[10px] text-stone-400">
                                  Tidak perlu rekonsiliasi
                                </p>
                              </div>
                            );
                          }
                          if (snap?.actual_qris_end !== null && snap?.actual_qris_end !== undefined) {
                            return (
                              <>
                                <p className="font-bold text-stone-800 dark:text-stone-200">
                                  Aktual: {formatRupiah(snap.actual_qris_end)}
                                </p>
                                <p className="text-[10px] text-stone-400 mt-0.5">
                                  Selisih: {formatRupiah(snap.qris_difference || 0)}
                                </p>
                              </>
                            );
                          }
                          return (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-800">
                              Belum direkonsiliasi
                            </span>
                          );
                        })()}
                      </td>

                      {/* Status Verifikasi */}
                      <td className="p-3">
                        {(() => {
                          const reconStatus = getShiftReconciliationStatus(s);
                          const reconMeta = getReconBadge(reconStatus);
                          const ReconIcon = reconMeta.icon;
                          const qrisInfo = getShiftQrisDisplayInfo(snap);

                          return (
                            <div className="space-y-1.5">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${reconMeta.badgeClass}`}>
                                <ReconIcon className="w-3 h-3 shrink-0" />
                                {reconMeta.label}
                              </span>
                              <div className="flex flex-wrap items-center gap-1 text-[10px]">
                                <span
                                  className={`font-bold ${
                                    snap?.cash_status === 'balanced'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400 font-black'
                                  }`}
                                >
                                  Kas: {snap?.cash_status === 'balanced' ? 'Sesuai' : 'Selisih'}
                                </span>
                                <span className="text-stone-300 dark:text-stone-700">•</span>
                                <span
                                  className={`font-bold ${
                                    qrisInfo.status === 'balanced'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : qrisInfo.status === 'no_transaction'
                                      ? 'text-stone-500 dark:text-stone-400'
                                      : qrisInfo.status === 'discrepancy'
                                      ? 'text-rose-600 dark:text-rose-400 font-black'
                                      : 'text-amber-600 dark:text-amber-500 font-black'
                                  }`}
                                >
                                  QRIS: {
                                    qrisInfo.status === 'balanced'
                                      ? 'Sesuai'
                                      : qrisInfo.status === 'no_transaction'
                                      ? 'Tidak ada QRIS'
                                      : qrisInfo.status === 'discrepancy'
                                      ? 'Selisih'
                                      : 'Belum dicek'
                                  }
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {getShiftReconciliationStatus(s) === 'correction_requested' && (
                            <button
                              type="button"
                              onClick={() => handleOpenCorrect(s)}
                              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all cursor-pointer text-[11px] shadow-sm flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Koreksi</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedShiftForDetail(s)}
                            className="px-3 py-1.5 bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] rounded-xl font-bold transition-all cursor-pointer text-[11px] shadow-sm"
                          >
                            Laporan Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL DETAIL LAPORAN SHIFT                               */}
      {/* ======================================================== */}
      {selectedShiftForDetail && selectedDetailData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className="relative w-full max-w-3xl bg-[#F7F5F2] dark:bg-[#1A1816] rounded-3xl shadow-2xl border border-stone-300 dark:border-stone-800 overflow-hidden flex flex-col max-h-[92vh] my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-[#3B2A1F] text-[#F7F5F2] flex justify-between items-center shrink-0 border-b border-stone-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D4A373]/20 flex items-center justify-center border border-[#D4A373]/30">
                  <Receipt className="w-5 h-5 text-[#D4A373]" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-wide">
                    Detail Laporan Shift #{selectedShiftForDetail.shift_number}
                  </h2>
                  <p className="text-xs text-[#D4A373]/90 font-medium">
                    {selectedDetailData.isCurrentActive ? 'Laporan Sementara (Shift Berjalan)' : 'Snapshot Rekonsiliasi Terkunci (Shift Selesai)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShiftForDetail(null)}
                className="p-2 rounded-xl hover:bg-white/10 text-stone-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Shift Timing & Staff Metadata */}
              <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-stone-400 uppercase text-[10px] font-bold block">Waktu Mulai</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 mt-0.5 block">
                    {formatDateTime(selectedShiftForDetail.opened_at)}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 uppercase text-[10px] font-bold block">Waktu Selesai</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 mt-0.5 block">
                    {selectedShiftForDetail.closed_at ? formatDateTime(selectedShiftForDetail.closed_at) : 'Masih berjalan'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 uppercase text-[10px] font-bold block">Petugas Pembuka</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 mt-0.5 block">
                    {selectedShiftForDetail.opened_by_name}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 uppercase text-[10px] font-bold block">Petugas Penutup</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 mt-0.5 block">
                    {selectedShiftForDetail.closed_by_name || '-'}
                  </span>
                </div>
              </div>

              {/* Financial Breakdown Summary (Hanya terlihat oleh Owner) */}
              {isOwner && (
                <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
                  <span className="text-[11px] font-black uppercase text-stone-400 tracking-wider block border-b border-stone-100 dark:border-stone-800 pb-2">
                    Ringkasan Finansial Shift
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-stone-500">Penjualan Bruto:</span>
                      <p className="font-extrabold text-stone-900 dark:text-stone-100 text-sm">
                        {formatRupiah(selectedDetailData.financials.gross_sales)}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">Diskon Diberikan:</span>
                      <p className="font-bold text-stone-700 dark:text-stone-300">
                        {formatRupiah(selectedDetailData.financials.discount_total)}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">Pajak (PB1):</span>
                      <p className="font-bold text-stone-700 dark:text-stone-300">
                        {formatRupiah(selectedDetailData.financials.tax_total)}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">Biaya Layanan VIP:</span>
                      <p className="font-bold text-purple-700 dark:text-purple-400">
                        {formatRupiah(selectedDetailData.financials.service_charge_total || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">Penjualan Bersih (Net):</span>
                      <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatRupiah(selectedDetailData.financials.net_sales)}
                      </p>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-stone-500">HPP Terpakai:</span>
                        {selectedDetailData.orders?.some(o => getOrderHPPCategory(o) === 'legacy_estimate') && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Estimasi Legacy
                          </span>
                        )}
                        {selectedDetailData.orders?.some(o => getOrderHPPCategory(o) === 'partial_snapshot') && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                            Snapshot Total · Rincian Item Estimasi
                          </span>
                        )}
                        {Boolean(selectedDetailData.orders && selectedDetailData.orders.length > 0 && selectedDetailData.orders.every(o => getOrderHPPCategory(o) === 'snapshot_riil')) && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Snapshot Riil
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-stone-700 dark:text-stone-300">
                        {formatRupiah(selectedDetailData.financials.estimated_hpp)}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">Laba Kotor:</span>
                      <p className="font-black text-[#C68B59] text-sm">
                        {formatRupiah(selectedDetailData.financials.estimated_gross_profit)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rincian Metode Pembayaran & Rekonsiliasi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kas Laci */}
                <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2 text-xs">
                  <span className="font-black text-[11px] uppercase text-[#3B2A1F] dark:text-[#D4A373] block border-b border-stone-100 dark:border-stone-800 pb-1.5">
                    Rekonsiliasi Kas Laci
                  </span>
                  <div className="flex justify-between">
                    <span>Modal Awal Kas:</span>
                    <span className="font-bold">{formatRupiah(selectedDetailData.financials.cash_initial)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Penjualan Tunai (+):</span>
                    <span className="font-bold text-emerald-600">+{formatRupiah(selectedDetailData.financials.cash_sales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Refund Tunai (-):</span>
                    <span className="font-bold text-rose-500">-{formatRupiah(selectedDetailData.financials.cash_refunds)}</span>
                  </div>
                  <div className="flex justify-between text-rose-500 font-medium">
                    <span>Pengeluaran Kas Operasional (-):</span>
                    <span className="font-bold">-{formatRupiah(selectedDetailData.financials.cash_expenses || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-stone-100 dark:border-stone-800 pt-1">
                    <span>Kas Diharapkan:</span>
                    <span>{formatRupiah(selectedDetailData.financials.expected_cash_end)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Cash Fisik Aktual:</span>
                    <span className="text-amber-600">{formatRupiah(selectedDetailData.financials.actual_cash_end)}</span>
                  </div>
                  <div className="flex justify-between font-black pt-1">
                    <span>Selisih Kas:</span>
                    <span className={selectedDetailData.financials.cash_difference === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {selectedDetailData.financials.cash_difference === 0 ? 'Sesuai (Rp 0)' : `${formatRupiah(selectedDetailData.financials.cash_difference)} (${selectedDetailData.financials.cash_status})`}
                    </span>
                  </div>

                  {(selectedDetailData.financials.cash_difference !== 0 || currentSelectedShift?.snapshot?.cash_difference_reason) && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 mt-1">
                      <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-400 block">
                        Alasan Selisih Kas:
                      </span>
                      <p className="text-xs text-stone-800 dark:text-stone-200 font-medium mt-0.5">
                        {currentSelectedShift?.snapshot?.cash_difference_reason || currentSelectedShift?.cash_difference_reason || 'Tidak ada alasan tercatat'}
                      </p>
                    </div>
                  )}
                </div>

                {/* QRIS & Refund */}
                <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2 text-xs">
                  <span className="font-black text-[11px] uppercase text-[#3B2A1F] dark:text-[#D4A373] block border-b border-stone-100 dark:border-stone-800 pb-1.5">
                    Rekonsiliasi QRIS & Refund
                  </span>
                  <div className="flex justify-between">
                    <span>Penjualan QRIS:</span>
                    <span className="font-bold">{formatRupiah(selectedDetailData.financials.qris_sales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Refund/Reversal QRIS (-):</span>
                    <span className="font-bold text-rose-500">-{formatRupiah(selectedDetailData.financials.qris_refunds)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-stone-100 dark:border-stone-800 pt-1">
                    <span>QRIS Diharapkan:</span>
                    <span>{formatRupiah(selectedDetailData.financials.expected_qris_end)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>QRIS Aktual:</span>
                    <span>
                      {(() => {
                        const qInfo = getShiftQrisDisplayInfo(selectedDetailData.financials);
                        if (qInfo.status === 'no_transaction') return 'Tidak ada transaksi';
                        return selectedDetailData.financials.actual_qris_end !== null
                          ? formatRupiah(selectedDetailData.financials.actual_qris_end)
                          : 'Belum direkonsiliasi';
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold pt-1">
                    <span>Status QRIS:</span>
                    <span className="font-bold">
                      {(() => {
                        const qInfo = getShiftQrisDisplayInfo(selectedDetailData.financials);
                        if (qInfo.status === 'no_transaction') return 'Tidak ada transaksi · Tidak perlu rekonsiliasi';
                        return selectedDetailData.financials.qris_status === 'unreconciled'
                          ? 'Belum direkonsiliasi'
                          : selectedDetailData.financials.qris_status === 'balanced'
                          ? 'Sesuai (Rp 0)'
                          : `Selisih: ${formatRupiah(selectedDetailData.financials.qris_difference || 0)}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-stone-100 dark:border-stone-800 pt-1">
                    <span>Status Verifikasi Refund:</span>
                    <span className="font-bold">
                      {selectedDetailData.financials.refund_status === 'unverified'
                        ? 'Belum diverifikasi'
                        : selectedDetailData.financials.refund_status === 'verified'
                        ? 'Terverifikasi Sesuai'
                        : 'Terdapat Selisih'}
                    </span>
                  </div>

                  {(selectedDetailData.financials.qris_difference !== 0 || currentSelectedShift?.snapshot?.qris_difference_reason) && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 mt-1">
                      <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-400 block">
                        Alasan Selisih QRIS:
                      </span>
                      <p className="text-xs text-stone-800 dark:text-stone-200 font-medium mt-0.5">
                        {currentSelectedShift?.snapshot?.qris_difference_reason || currentSelectedShift?.qris_difference_reason || 'Tidak ada alasan tercatat'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Rekonsiliasi & Audit Trail Owner */}
              {currentSelectedShift && (() => {
                const reconStatus = getShiftReconciliationStatus(currentSelectedShift);
                const reconMeta = getReconBadge(reconStatus);
                const ReconIcon = reconMeta.icon;
                const isOwner = currentUser?.role === 'owner';
                const canReview = isOwner && (reconStatus === 'pending_review' || reconStatus === 'correction_requested');
                const canCorrect = reconStatus === 'correction_requested';

                return (
                  <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
                      <div>
                        <span className="text-[11px] font-black uppercase text-stone-400 tracking-wider block">
                          Status Rekonsiliasi Shift
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${reconMeta.badgeClass}`}>
                            <ReconIcon className="w-4 h-4 shrink-0" />
                            {reconMeta.label}
                          </span>
                          <span className="text-xs text-stone-500">
                            {reconMeta.desc}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons for Owner / Corrections */}
                      <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                        {canReview && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenReview('approved_variance')}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Setujui Selisih
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReview('correction_requested')}
                              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Kembalikan Koreksi
                            </button>
                          </>
                        )}
                        {canCorrect && (
                          <button
                            type="button"
                            onClick={() => handleOpenCorrect()}
                            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Koreksi Nilai
                          </button>
                        )}
                        {!isOwner && reconStatus === 'pending_review' && (
                          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold italic bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                            Menunggu persetujuan Owner (Kasir tidak berwenang menyetujui selisih)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Catatan Review Owner jika ada */}
                    {currentSelectedShift.reviewed_at && (
                      <div className="p-3 bg-stone-50 dark:bg-[#1E1C1A] rounded-xl border border-stone-200 dark:border-stone-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-stone-500 font-medium">
                          <span>
                            Ditinjau oleh: <strong className="text-stone-800 dark:text-stone-200">{currentSelectedShift.reviewed_by_name || 'Owner'}</strong>
                          </span>
                          <span>{formatDateTime(currentSelectedShift.reviewed_at)}</span>
                        </div>
                        <div className="text-stone-700 dark:text-stone-300">
                          <span className="font-bold text-stone-500">Keputusan: </span>
                          <span className="font-extrabold text-stone-900 dark:text-stone-100">
                            {currentSelectedShift.review_action === 'approved_variance' ? 'Selisih Disetujui' : 'Dikembalikan untuk Koreksi'}
                          </span>
                        </div>
                        {currentSelectedShift.review_notes && (
                          <div className="text-stone-600 dark:text-stone-400 text-xs italic bg-white dark:bg-[#23201D] p-2 rounded-lg border border-stone-200/60 dark:border-stone-800/60">
                            "{currentSelectedShift.review_notes}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Timeline Audit Trail */}
                    {currentSelectedShift.audit_trail && currentSelectedShift.audit_trail.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider flex items-center gap-1.5">
                          <History className="w-3 h-3" />
                          Jejak Audit Aktivitas Shift ({currentSelectedShift.audit_trail.length} Catatan)
                        </span>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {currentSelectedShift.audit_trail.map(entry => (
                            <div
                              key={entry.id}
                              className="p-2.5 bg-stone-50 dark:bg-[#1A1816] rounded-xl border border-stone-200/70 dark:border-stone-800/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-stone-900 dark:text-stone-100">
                                    {entry.action === 'closed'
                                      ? 'Penutupan Shift'
                                      : entry.action === 'review_approved'
                                      ? 'Review Selisih Disetujui'
                                      : entry.action === 'review_rejected'
                                      ? 'Dikembalikan untuk Koreksi'
                                      : entry.action === 'corrected'
                                      ? 'Koreksi Nilai Rekonsiliasi'
                                      : entry.action}
                                  </span>
                                  <span className="text-[10px] text-stone-400">
                                    oleh {entry.user_name} ({entry.user_role})
                                  </span>
                                </div>
                                {entry.notes && (
                                  <p className="text-[11px] text-stone-600 dark:text-stone-400 italic">
                                    "{entry.notes}"
                                  </p>
                                )}
                                {entry.action === 'corrected' && entry.details && (
                                  <div className="mt-1.5 p-2 rounded-lg bg-stone-100 dark:bg-[#201D1B] border border-stone-200/80 dark:border-stone-800 text-[11px] space-y-1">
                                    <div className="flex justify-between items-center text-stone-600 dark:text-stone-400">
                                      <span>Kas Fisik di Laci:</span>
                                      <span className="font-bold">
                                        {formatRupiah(entry.details.previous_cash_end ?? 0)} &rarr; <span className="text-amber-600 dark:text-amber-400 font-extrabold">{formatRupiah(entry.details.corrected_cash_end ?? 0)}</span>
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-stone-600 dark:text-stone-400">
                                      <span>QRIS Aktual:</span>
                                      <span className="font-bold">
                                        {formatRupiah(entry.details.previous_qris_end ?? 0)} &rarr; <span className="text-amber-600 dark:text-amber-400 font-extrabold">{formatRupiah(entry.details.corrected_qris_end ?? 0)}</span>
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-stone-400 whitespace-nowrap">
                                {formatDateTime(entry.timestamp)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Rincian Pengeluaran Kas Operasional (Petty Cash) */}
              <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-black uppercase text-stone-900 dark:text-stone-100">
                      Rincian Pengeluaran Kas Operasional ({selectedDetailData.shiftExpenseList.length} Catatan)
                    </span>
                  </div>
                  {selectedDetailData.isCurrentActive && (
                    <button
                      type="button"
                      onClick={() => setIsRecordExpenseModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Catat Kas Keluar</span>
                    </button>
                  )}
                </div>

                {selectedDetailData.shiftExpenseList.length === 0 ? (
                  <p className="text-xs text-stone-400 italic py-2">
                    Tidak ada pengeluaran kas operasional yang dicatat selama shift ini.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[10px] uppercase font-bold text-stone-400 border-b border-stone-100 dark:border-stone-800">
                        <tr>
                          <th className="pb-2">Waktu</th>
                          <th className="pb-2">Kategori</th>
                          <th className="pb-2">Keterangan & Nota</th>
                          <th className="pb-2">Petugas</th>
                          <th className="pb-2">Status</th>
                          <th className="pb-2 text-right">Nominal</th>
                          {selectedDetailData.isCurrentActive && isOwner && <th className="pb-2 text-center">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                        {selectedDetailData.shiftExpenseList.map(exp => {
                          const isActive = exp.status === 'active';
                          return (
                            <tr key={exp.id} className={isActive ? '' : 'opacity-60 bg-stone-50/50 dark:bg-stone-900/30'}>
                              <td className="py-2 text-stone-500 whitespace-nowrap">
                                {formatDateTime(exp.created_at)}
                              </td>
                              <td className="py-2">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                                  {exp.category.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-2">
                                <p className="font-semibold text-stone-900 dark:text-stone-100">{exp.description}</p>
                                {exp.receipt_number && (
                                  <p className="text-[10px] text-stone-400">Nota: {exp.receipt_number}</p>
                                )}
                                {!isActive && exp.cancellation_reason && (
                                  <p className="text-[10px] text-rose-500 italic mt-0.5">
                                    Dibatalkan: {exp.cancellation_reason} ({exp.cancelled_by_name || 'Owner'})
                                  </p>
                                )}
                                {exp.replaces_expense_id && (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                    Revisi dari pengeluaran sebelumnya
                                  </p>
                                )}
                              </td>
                              <td className="py-2 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                {exp.created_by_name}
                              </td>
                              <td className="py-2 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isActive ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-stone-200 dark:bg-stone-800 text-stone-500'}`}>
                                  {isActive ? 'Aktif' : 'Dibatalkan'}
                                </span>
                              </td>
                              <td className={`py-2 text-right font-black whitespace-nowrap ${isActive ? 'text-rose-500' : 'line-through text-stone-400'}`}>
                                -{formatRupiah(exp.amount)}
                              </td>
                              {selectedDetailData.isCurrentActive && isOwner && (
                                <td className="py-2 text-center whitespace-nowrap">
                                  {isActive ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenReplaceExpense(exp)}
                                        className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 text-xs transition-colors cursor-pointer"
                                        title="Revisi nominal/alasan pengeluaran"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenCancelExpense(exp)}
                                        className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 text-xs transition-colors cursor-pointer"
                                        title="Batalkan pengeluaran kas"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-stone-400">-</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Rincian Refund dan Referensi Transaksi Asal */}
              {selectedDetailData.refundOrders.length > 0 && (
                <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-black uppercase text-rose-900 dark:text-rose-200">
                      Rincian Refund pada Shift Ini ({selectedDetailData.refundOrders.length} Transaksi)
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[10px] uppercase font-bold text-rose-600">
                        <tr>
                          <th className="pb-1.5">No. Order</th>
                          <th className="pb-1.5">Pelanggan</th>
                          <th className="pb-1.5">Metode Refund</th>
                          <th className="pb-1.5">Alasan</th>
                          <th className="pb-1.5 text-right">Nominal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100 dark:divide-rose-900/40">
                        {selectedDetailData.refundOrders.map(ro => (
                          <tr key={ro.id}>
                            <td className="py-1.5 font-bold">{ro.order_number}</td>
                            <td className="py-1.5">{ro.customer_name || 'Pelanggan'}</td>
                            <td className="py-1.5 font-semibold uppercase">{ro.refund_method || ro.payment?.method || 'Cash'}</td>
                            <td className="py-1.5 text-stone-500">{ro.refund_reason || 'Pembatalan kasir'}</td>
                            <td className="py-1.5 text-right font-extrabold text-rose-600">
                              {formatRupiah(ro.total_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tabel Seluruh Transaksi yang Terikat pada Shift */}
              <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black uppercase text-stone-400 tracking-wider">
                    Daftar Transaksi Terikat ({selectedDetailData.orders.length} Transaksi)
                  </span>
                </div>

                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-50 dark:bg-[#22201D] text-stone-400 uppercase text-[10px] font-bold sticky top-0">
                      <tr>
                        <th className="p-2">No. Order</th>
                        <th className="p-2">Waktu</th>
                        <th className="p-2">Pelanggan</th>
                        <th className="p-2">Metode</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80 font-medium">
                      {selectedDetailData.orders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-stone-400 italic">
                            Belum ada transaksi pada shift ini.
                          </td>
                        </tr>
                      ) : (
                        selectedDetailData.orders.map(o => (
                          <tr key={o.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-900/20">
                            <td className="p-2 font-bold">{o.order_number}</td>
                            <td className="p-2 text-stone-500">{formatDateTime(o.created_at)}</td>
                            <td className="p-2">{o.customer_name || 'Pelanggan'}</td>
                            <td className="p-2 uppercase font-semibold text-[10px]">{o.payment?.method || 'cash'}</td>
                            <td className="p-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  o.payment?.status === 'refunded'
                                    ? 'bg-rose-500/10 text-rose-600'
                                    : 'bg-emerald-500/10 text-emerald-600'
                                }`}
                              >
                                {o.payment?.status === 'refunded' ? 'Refund' : 'Sukses'}
                              </span>
                            </td>
                            <td className="p-2 text-right font-extrabold">{formatRupiah(o.total_amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white dark:bg-[#161413] border-t border-stone-200 dark:border-stone-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedShiftForDetail(null)}
                className="px-5 py-2.5 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-black text-xs cursor-pointer shadow"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DIALOG: REVIEW OWNER (Setujui / Kembalikan Koreksi) */}
      {/* ======================================================== */}
      {isReviewModalOpen && currentSelectedShift && reviewAction && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-5 ${reviewAction === 'approved_variance' ? 'bg-emerald-600' : 'bg-rose-600'} text-white flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-white/20">
                  {reviewAction === 'approved_variance' ? (
                    <ShieldCheck className="w-5 h-5 text-white" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide">
                    {reviewAction === 'approved_variance' ? 'Setujui Selisih Shift' : 'Kembalikan untuk Koreksi'}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Shift #{currentSelectedShift.shift_number} • Petugas: {currentSelectedShift.closed_by_name || '-'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className={`p-3 rounded-2xl text-xs ${reviewAction === 'approved_variance' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40'}`}>
                {reviewAction === 'approved_variance' ? (
                  <p>
                    <strong>Keputusan:</strong> Persetujuan Owner menyatakan bahwa alasan selisih kas/QRIS telah ditelaah dan diterima. <em>Nilai riil selisih tidak diubah menjadi nol dan tetap tercatat pada laporan.</em>
                  </p>
                ) : (
                  <p>
                    <strong>Keputusan:</strong> Status shift diubah menjadi <strong>Perlu Koreksi</strong>. Kasir atau petugas dapat merevisi input aktual dengan menyertakan alasan koreksi terverifikasi.
                  </p>
                )}
              </div>

              {/* Catatan / Alasan Owner */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 dark:text-stone-300 block">
                  {reviewAction === 'correction_requested' ? 'Alasan Pengembalian (Wajib)' : 'Catatan Owner (Opsional)'}
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder={reviewAction === 'correction_requested' ? 'Contoh: Hitung ulang pecahan uang fisik di laci dan nota manual...' : 'Contoh: Selisih Rp 5.000 sudah diklarifikasi karena kembalian permen...'}
                  className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] text-xs resize-none"
                />
              </div>

              {/* PIN Owner Keypad */}
              <div className="space-y-2">
                <label className="font-bold text-stone-700 dark:text-stone-300 block text-center">
                  PIN Otorisasi Owner (Wajib)
                </label>
                <PinKeypad
                  value={reviewPin}
                  onChange={setReviewPin}
                  onComplete={() => {}}
                  disabled={isSubmittingReview}
                  label=""
                />
                <p className="text-[10px] text-stone-400 text-center">
                  Hanya pengguna dengan wewenang Owner yang dapat mengesahkan tindakan ini.
                </p>
              </div>

              {reviewError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  {reviewError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-stone-50 dark:bg-[#181615] border-t border-stone-200 dark:border-stone-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                disabled={isSubmittingReview}
                className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteReview}
                disabled={isSubmittingReview}
                className={`px-5 py-2 rounded-xl text-white font-black text-xs cursor-pointer shadow flex items-center gap-1.5 ${reviewAction === 'approved_variance' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} disabled:opacity-50`}
              >
                {isSubmittingReview ? 'Memproses...' : reviewAction === 'approved_variance' ? 'Konfirmasi Setujui' : 'Konfirmasi Kembalikan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DIALOG: KOREKSI REKONSILIASI SHIFT                 */}
      {/* ======================================================== */}
      {isCorrectModalOpen && currentSelectedShift && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className="w-full max-w-lg bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-white/20">
                  <Edit3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide">
                    Koreksi Rekonsiliasi Shift #{currentSelectedShift.shift_number}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Pembaruan nilai aktual & alasan selisih dengan jejak audit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCorrectModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 text-[11px]">
                <strong>Prinsip Immutabilitas:</strong> Omzet, refund, dan kas harapan tidak berubah. Hanya nilai aktual di laci/settlement QRIS dan alasan yang dikoreksi, dan setiap perubahan dicatat di timeline audit shift.
              </div>

              {/* Kas Laci */}
              <div className="p-3.5 bg-stone-50 dark:bg-[#25221F] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-800 dark:text-stone-200">
                    Kas Fisik Aktual di Laci
                  </span>
                  <span className="text-[10px] text-stone-400">
                    Harapan: {formatRupiah(currentSelectedShift.snapshot?.expected_cash_end || 0)}
                  </span>
                </div>
                <NumberInput
                  isCurrency={true}
                  value={correctedCashValue}
                  onChange={setCorrectedCashValue}
                  placeholder="Rp 0"
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-[#1E1C1A] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs font-bold"
                />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500">
                    Alasan Selisih Kas (Wajib jika ada selisih)
                  </label>
                  <input
                    type="text"
                    value={correctedCashReason}
                    onChange={e => setCorrectedCashReason(e.target.value)}
                    placeholder="Contoh: Kesalahan hitung receh saat penutupan..."
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-[#1E1C1A] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs"
                  />
                </div>
              </div>

              {/* QRIS */}
              <div className="p-3.5 bg-stone-50 dark:bg-[#25221F] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-800 dark:text-stone-200">
                    QRIS Aktual (Settlement/Catatan)
                  </span>
                  <span className="text-[10px] text-stone-400">
                    Harapan: {formatRupiah(currentSelectedShift.snapshot?.expected_qris_end || 0)}
                  </span>
                </div>
                <NumberInput
                  isCurrency={true}
                  value={correctedQrisValue}
                  onChange={setCorrectedQrisValue}
                  placeholder="Rp 0"
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-[#1E1C1A] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs font-bold"
                />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-500">
                    Alasan Selisih QRIS (Wajib jika ada selisih)
                  </label>
                  <input
                    type="text"
                    value={correctedQrisReason}
                    onChange={e => setCorrectedQrisReason(e.target.value)}
                    placeholder="Contoh: 1 transaksi tertunda masuk mutasi..."
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-[#1E1C1A] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs"
                  />
                </div>
              </div>

              {/* Catatan Koreksi & PIN */}
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 dark:text-stone-300 block">
                    Catatan Penjelasan Koreksi (Wajib)
                  </label>
                  <textarea
                    rows={2}
                    value={correctionNotes}
                    onChange={e => setCorrectionNotes(e.target.value)}
                    placeholder="Jelaskan alasan koreksi data ini dilakukan..."
                    className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 text-xs resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-stone-700 dark:text-stone-300 block text-center">
                    PIN Petugas Pengoreksi (Wajib)
                  </label>
                  <PinKeypad
                    value={correctPin}
                    onChange={setCorrectPin}
                    onComplete={() => {}}
                    disabled={isSubmittingCorrect}
                    label=""
                  />
                </div>
              </div>

              {correctError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  {correctError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-stone-50 dark:bg-[#181615] border-t border-stone-200 dark:border-stone-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCorrectModalOpen(false)}
                disabled={isSubmittingCorrect}
                className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteCorrect}
                disabled={isSubmittingCorrect}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs cursor-pointer shadow disabled:opacity-50"
              >
                {isSubmittingCorrect ? 'Menyimpan...' : 'Simpan Koreksi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DIALOG: CATAT PENGELUARAN KAS (PETTY CASH)          */}
      {/* ======================================================== */}
      {isRecordExpenseModalOpen && activeShift && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-white/20">
                  <Banknote className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide">
                    Catat Pengeluaran Kas (Petty Cash)
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Shift #{activeShift.shift_number} · Uang keluar dari laci operasional
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordExpenseModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {/* Info Kas Tersedia */}
              <div className="p-3 bg-stone-50 dark:bg-[#25221F] rounded-2xl border border-stone-200 dark:border-stone-800 flex justify-between items-center text-xs">
                <span className="text-stone-500 font-bold">Saldo Kas Teoritis Tersedia:</span>
                <span className="font-black text-[#C68B59] text-sm">
                  {formatRupiah(activeFinancials ? (activeFinancials.cash_initial + activeFinancials.cash_sales - activeFinancials.cash_refunds - (activeFinancials.cash_expenses || 0)) : 0)}
                </span>
              </div>

              {/* Input Nominal */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 dark:text-stone-300 block">
                  Nominal Pengeluaran Kas (Rupiah) *
                </label>
                <NumberInput
                  isCurrency={true}
                  value={expenseAmount}
                  onChange={setExpenseAmount}
                  placeholder="Rp 0"
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-sm font-black"
                />
              </div>

              {/* Kategori */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 dark:text-stone-300 block">
                  Kategori Keperluan *
                </label>
                <select
                  value={expenseCategory}
                  onChange={e => setExpenseCategory(e.target.value as ShiftExpenseCategory)}
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs font-semibold cursor-pointer"
                >
                  <option value="bahan_baku_darurat">Bahan Baku Darurat (Es batu, cup, susu, dll)</option>
                  <option value="operasional_booth">Operasional Booth (Gas, galon, listrik, dll)</option>
                  <option value="kebersihan">Kebersihan (Sabun, plastik sampah, dll)</option>
                  <option value="lain_lain">Lain-lain</option>
                </select>
              </div>

              {/* Keterangan */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 dark:text-stone-300 block">
                  Keterangan / Alasan Pengeluaran *
                </label>
                <input
                  type="text"
                  value={expenseDescription}
                  onChange={e => setExpenseDescription(e.target.value)}
                  placeholder="Contoh: Beli es batu kristal 2 kantong darurat"
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs"
                />
              </div>

              {/* Nomor Nota (Opsional) */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 dark:text-stone-300 block">
                  Nomor Nota / Kwitansi (Opsional)
                </label>
                <input
                  type="text"
                  value={expenseReceiptNumber}
                  onChange={e => setExpenseReceiptNumber(e.target.value)}
                  placeholder="Contoh: NOTA-2026-001"
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs"
                />
              </div>

              {/* PIN Keypad */}
              <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <label className="font-bold text-stone-700 dark:text-stone-300 block text-center">
                  PIN Petugas Pengeluaran *
                </label>
                <PinKeypad
                  value={expensePin}
                  onChange={setExpensePin}
                  onComplete={() => {}}
                  disabled={isSubmittingExpense}
                  label=""
                />
              </div>

              {expenseError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  {expenseError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-stone-50 dark:bg-[#181615] border-t border-stone-200 dark:border-stone-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRecordExpenseModalOpen(false)}
                disabled={isSubmittingExpense}
                className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRecordExpense}
                disabled={isSubmittingExpense}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs cursor-pointer shadow disabled:opacity-50"
              >
                {isSubmittingExpense ? 'Menyimpan...' : 'Catat Kas Keluar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DIALOG: BATALKAN PENGELUARAN KAS (OWNER ONLY)       */}
      {/* ======================================================== */}
      {isCancelExpenseModalOpen && selectedExpenseToCancel && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-white/20">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide">
                    Batalkan Pengeluaran Kas
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Otoritas Owner · Uang dikembalikan ke saldo kas laci
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelExpenseModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="p-3 bg-stone-50 dark:bg-[#25221F] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Nominal:</span>
                  <span className="font-extrabold text-rose-600 text-sm">
                    {formatRupiah(selectedExpenseToCancel.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Kategori:</span>
                  <span className="font-bold uppercase text-stone-800 dark:text-stone-200">
                    {selectedExpenseToCancel.category.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Keterangan:</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200 truncate max-w-[200px]">
                    {selectedExpenseToCancel.description}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Dicatat oleh:</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {selectedExpenseToCancel.created_by_name}
                  </span>
                </div>
              </div>

              {/* Alasan Pembatalan */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 dark:text-stone-300 block">
                  Alasan Pembatalan (Wajib, min 3 karakter) *
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Contoh: Nota dibatalkan supplier, uang kas dikembalikan ke laci"
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs resize-none"
                />
              </div>

              {/* PIN Owner */}
              <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <label className="font-bold text-stone-700 dark:text-stone-300 block text-center">
                  PIN Owner (Otoritas Pembatalan) *
                </label>
                <PinKeypad
                  value={cancelPin}
                  onChange={setCancelPin}
                  onComplete={() => {}}
                  disabled={isSubmittingCancel}
                  label=""
                />
              </div>

              {cancelError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  {cancelError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-stone-50 dark:bg-[#181615] border-t border-stone-200 dark:border-stone-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCancelExpenseModalOpen(false)}
                disabled={isSubmittingCancel}
                className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleExecuteCancelExpense}
                disabled={isSubmittingCancel}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer shadow disabled:opacity-50"
              >
                {isSubmittingCancel ? 'Membatalkan...' : 'Konfirmasi Pembatalan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DIALOG: REVISI PENGELUARAN KAS (OWNER ONLY)         */}
      {/* ======================================================== */}
      {isReplaceExpenseModalOpen && selectedExpenseToReplace && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className="w-full max-w-md bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-white/20">
                  <ArrowRightLeft className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide">
                    Revisi Pengeluaran Kas (Petty Cash)
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Otoritas Owner · Menyesuaikan nilai dan jejak audit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReplaceExpenseModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="p-3 bg-stone-50 dark:bg-[#25221F] rounded-2xl border border-stone-200 dark:border-stone-800 text-stone-500 text-[11px]">
                Pengeluaran lama <strong>({formatRupiah(selectedExpenseToReplace.amount)})</strong> akan ditandai dibatalkan dan digantikan oleh entri baru di bawah ini.
              </div>

              {/* Nominal Baru */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 dark:text-stone-300 block">
                  Nominal Baru (Rupiah) *
                </label>
                <NumberInput
                  isCurrency={true}
                  value={replaceAmount}
                  onChange={setReplaceAmount}
                  placeholder="Rp 0"
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-sm font-black"
                />
              </div>

              {/* Kategori Baru */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 dark:text-stone-300 block">
                  Kategori Baru *
                </label>
                <select
                  value={replaceCategory}
                  onChange={e => setReplaceCategory(e.target.value as ShiftExpenseCategory)}
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs font-semibold cursor-pointer"
                >
                  <option value="bahan_baku_darurat">Bahan Baku Darurat (Es batu, cup, susu, dll)</option>
                  <option value="operasional_booth">Operasional Booth (Gas, galon, listrik, dll)</option>
                  <option value="kebersihan">Kebersihan (Sabun, plastik sampah, dll)</option>
                  <option value="lain_lain">Lain-lain</option>
                </select>
              </div>

              {/* Keterangan Baru */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 dark:text-stone-300 block">
                  Keterangan Baru *
                </label>
                <input
                  type="text"
                  value={replaceDescription}
                  onChange={e => setReplaceDescription(e.target.value)}
                  placeholder="Keterangan pengeluaran yang sudah direvisi"
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs"
                />
              </div>

              {/* Nomor Nota Baru */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 dark:text-stone-300 block">
                  Nomor Nota Baru (Opsional)
                </label>
                <input
                  type="text"
                  value={replaceReceiptNumber}
                  onChange={e => setReplaceReceiptNumber(e.target.value)}
                  placeholder="Nomor nota fisik terbaru"
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs"
                />
              </div>

              {/* Alasan Revisi */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 dark:text-stone-300 block">
                  Alasan Revisi Catatan Lama (Wajib) *
                </label>
                <textarea
                  rows={2}
                  value={replaceCancelReason}
                  onChange={e => setReplaceCancelReason(e.target.value)}
                  placeholder="Contoh: Koreksi nominal nota riil menurut kwitansi toko"
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 text-xs resize-none"
                />
              </div>

              {/* PIN Owner */}
              <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <label className="font-bold text-stone-700 dark:text-stone-300 block text-center">
                  PIN Owner (Otoritas Revisi) *
                </label>
                <PinKeypad
                  value={replacePin}
                  onChange={setReplacePin}
                  onComplete={() => {}}
                  disabled={isSubmittingReplace}
                  label=""
                />
              </div>

              {replaceError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  {replaceError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-stone-50 dark:bg-[#181615] border-t border-stone-200 dark:border-stone-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReplaceExpenseModalOpen(false)}
                disabled={isSubmittingReplace}
                className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteReplaceExpense}
                disabled={isSubmittingReplace}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs cursor-pointer shadow disabled:opacity-50"
              >
                {isSubmittingReplace ? 'Menyimpan...' : 'Simpan Revisi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
