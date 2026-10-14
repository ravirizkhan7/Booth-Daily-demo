import { Order, Product, Recipe, Stock, Shift, ShiftFinancialSnapshot } from '../types';
import { calculateItemUnitHPP, getOrderTotalHPP } from './reportUtils';

/**
 * Menghitung tanggal operasional berdasarkan batas waktu (cutoff time).
 * Contoh: Jika cutoffTime = "04:00" dan transaksi terjadi pukul 01:30,
 * maka tanggal operasionalnya adalah tanggal kalender kemarin (H-1).
 */
export function getOperationalDate(
  date: Date = new Date(),
  cutoffTime: string = '04:00'
): string {
  const [cutoffHours, cutoffMinutes] = (cutoffTime || '04:00').split(':').map(Number);
  const targetDate = new Date(date);

  const currentHours = targetDate.getHours();
  const currentMinutes = targetDate.getMinutes();

  const isBeforeCutoff =
    currentHours < cutoffHours ||
    (currentHours === cutoffHours && currentMinutes < cutoffMinutes);

  if (isBeforeCutoff) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format durasi antara dua waktu (misal "3 jam 45 menit")
 */
export function formatShiftDuration(startIso: string, endIso?: string): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0 && minutes === 0) {
    return '< 1 menit';
  }
  if (hours === 0) {
    return `${minutes} menit`;
  }
  return `${hours} jam ${minutes} menit`;
}

export interface CalculateShiftInputActuals {
  actual_cash_end?: number;
  actual_qris_end?: number | null;
  actual_refund_total?: number | null;
  cash_difference_reason?: string;
  qris_difference_reason?: string;
  notes?: string;
}

/**
 * Single Source of Truth perhitungan keuangan rekonsiliasi shift
 */
export function calculateShiftFinancials(
  shift: Shift,
  allOrders: Order[],
  products: Product[] = [],
  recipes: Recipe[] = [],
  stocks: Stock[] = [],
  actuals?: CalculateShiftInputActuals
): ShiftFinancialSnapshot {
  // 1. Transaksi yang dibuat pada shift ini
  const shiftOrders = allOrders.filter(o => o.shift_id === shift.id);

  // 2. Transaksi yang direfund pada shift ini
  // (Bisa transaksi yang dibuat pada shift ini ATAU transaksi lama yang direfund saat shift ini berjalan)
  const shiftRefundOrders = allOrders.filter(o => {
    if (o.refund_shift_id) {
      return o.refund_shift_id === shift.id;
    }
    return o.shift_id === shift.id && o.payment?.status === 'refunded';
  });

  // 3. Transaksi selesai (non-refunded)
  const completedOrders = shiftOrders.filter(o => o.payment?.status !== 'refunded');

  // Penjualan Kotor (Gross) & Komponennya
  const gross_sales = completedOrders.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0);
  const discount_total = completedOrders.reduce((sum, o) => sum + (Number(o.discount) || 0), 0);
  const tax_total = completedOrders.reduce((sum, o) => sum + (Number(o.tax) || 0), 0);
  const net_sales = completedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // Pemecahan penerimaan kasir per Metode Pembayaran (Gross Collection)
  let cash_sales = 0;
  let qris_sales = 0;

  shiftOrders.forEach(o => {
    const method = String(o.payment?.method || '').toLowerCase();
    const amount = Number(o.total_amount) || 0;
    if (method === 'cash') {
      cash_sales += amount;
    } else if (method === 'qris') {
      qris_sales += amount;
    }
  });

  // Pemecahan Refund
  let cash_refunds = 0;
  let qris_refunds = 0;

  shiftRefundOrders.forEach(o => {
    const refundMethod = String(o.refund_method || o.payment?.method || '').toLowerCase();
    const amount = Number(o.total_amount) || 0;
    if (refundMethod === 'cash') {
      cash_refunds += amount;
    } else if (refundMethod === 'qris') {
      qris_refunds += amount;
    } else {
      // Default ke cash jika tidak ada metode eksplisit karena kasir laci F&B
      cash_refunds += amount;
    }
  });

  // Perhitungan HPP (mencakup seluruh item pada pesanan yang dibuat shift ini, termasuk yang direfund karena bahan fisik terpakai)
  let estimated_hpp = 0;
  shiftOrders.forEach(order => {
    estimated_hpp += getOrderTotalHPP(order, products, recipes, stocks);
  });
  estimated_hpp = Math.round(estimated_hpp);

  const estimated_gross_profit = net_sales - estimated_hpp;

  // Rumus Keuangan Utama (Bebas dari hitung ganda refund)
  // Kas Harapan = Kas Awal Shift + Penjualan Tunai - Refund Tunai - Pengeluaran Kas Tercatat
  const cash_initial = Number(shift.cash_initial) || 0;
  const cash_expenses = 0; // Keterbatasan: Pengeluaran kas per-shift belum didukung dalam sistem
  const expected_cash_end = cash_initial + cash_sales - cash_refunds - cash_expenses;
  const expected_qris_end = qris_sales - qris_refunds;

  // Nilai Aktual (Gunakan input aktual yang dilewatkan, atau snapshot tersimpan, atau fallback)
  const actual_cash_end = actuals?.actual_cash_end !== undefined
    ? Number(actuals.actual_cash_end)
    : (shift.snapshot?.actual_cash_end ?? expected_cash_end);

  const actual_qris_end = actuals?.actual_qris_end !== undefined
    ? actuals.actual_qris_end
    : (shift.snapshot?.actual_qris_end ?? null);

  const actual_refund_total = actuals?.actual_refund_total !== undefined
    ? actuals.actual_refund_total
    : (shift.snapshot?.actual_refund_total ?? null);

  // Selisih Kas
  const cash_difference = actual_cash_end - expected_cash_end;
  let cash_status: 'balanced' | 'surplus' | 'shortage' = 'balanced';
  if (cash_difference > 0) {
    cash_status = 'surplus';
  } else if (cash_difference < 0) {
    cash_status = 'shortage';
  }

  // Selisih QRIS
  let qris_difference: number | null = null;
  let qris_status: 'balanced' | 'discrepancy' | 'unreconciled' = 'unreconciled';

  if (actual_qris_end !== null && actual_qris_end !== undefined) {
    qris_difference = actual_qris_end - expected_qris_end;
    qris_status = Math.abs(qris_difference) < 0.01 ? 'balanced' : 'discrepancy';
  }

  // Verifikasi Refund
  const systemRecordedRefundTotal = cash_refunds + qris_refunds;
  let refund_status: 'verified' | 'discrepancy' | 'unverified' = 'unverified';

  if (actual_refund_total !== null && actual_refund_total !== undefined) {
    const diff = Math.abs(actual_refund_total - systemRecordedRefundTotal);
    refund_status = diff < 0.01 ? 'verified' : 'discrepancy';
  }

  // Penentuan Status Rekonsiliasi Keseluruhan (Audit-First)
  const isCashMatched = Math.abs(cash_difference) < 0.01;
  const isQrisMatched =
    actual_qris_end !== null && actual_qris_end !== undefined
      ? Math.abs(qris_difference!) < 0.01
      : expected_qris_end === 0; // Jika tidak ada transaksi QRIS sama sekali, dianggap cocok

  let reconciliation_status: 'matched' | 'pending_review' | 'approved_variance' | 'correction_requested' = 'matched';

  if (isCashMatched && isQrisMatched) {
    reconciliation_status = 'matched';
  } else {
    // Jika ada selisih, periksa apakah sudah ada keputusan review Owner sebelumnya
    const existingStatus = shift.snapshot?.reconciliation_status || shift.reconciliation_status;
    if (existingStatus === 'approved_variance' || existingStatus === 'correction_requested') {
      reconciliation_status = existingStatus;
    } else {
      reconciliation_status = 'pending_review';
    }
  }

  const cash_difference_reason = actuals?.cash_difference_reason !== undefined
    ? actuals.cash_difference_reason
    : (shift.snapshot?.cash_difference_reason || shift.cash_difference_reason);

  const qris_difference_reason = actuals?.qris_difference_reason !== undefined
    ? actuals.qris_difference_reason
    : (shift.snapshot?.qris_difference_reason || shift.qris_difference_reason);

  return {
    cash_initial,
    expected_cash_end,
    expected_qris_end,
    cash_sales,
    qris_sales,
    cash_refunds,
    qris_refunds,
    cash_expenses,
    gross_sales,
    discount_total,
    tax_total,
    net_sales,
    estimated_hpp,
    estimated_gross_profit,
    total_orders_count: completedOrders.length,
    total_refund_orders_count: shiftRefundOrders.length,
    actual_cash_end,
    actual_qris_end,
    actual_refund_total,
    cash_difference,
    qris_difference,
    cash_status,
    qris_status,
    refund_status,
    reconciliation_status,
    cash_difference_reason,
    qris_difference_reason,
    notes: actuals?.notes || shift.notes,
  };
}
