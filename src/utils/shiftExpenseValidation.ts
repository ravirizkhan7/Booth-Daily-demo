import { ShiftExpense, ShiftExpenseCategory, ShiftExpenseStatus } from '../types';

export interface ExpenseValidationContext {
  validShiftIds?: Set<string>;
  validUserIds?: Set<string>;
}

export interface ExpenseValidationResult {
  isValid: boolean;
  error?: string;
}

export const VALID_EXPENSE_CATEGORIES: readonly ShiftExpenseCategory[] = [
  'bahan_baku_darurat',
  'operasional_booth',
  'kebersihan',
  'lain_lain',
] as const;

export const VALID_EXPENSE_STATUSES: readonly ShiftExpenseStatus[] = [
  'active',
  'cancelled',
] as const;

/**
 * Memvalidasi satu entri ShiftExpense secara mendalam:
 * - Keberadaan & keunikan ID primer
 * - Format relasi shift_id
 * - Nominal integer Rupiah positif & finite
 * - Kategori & status valid
 * - Panjang deskripsi minimal 3 karakter non-spasi
 * - Validitas timestamp created_at
 * - Relasi user pencatat
 * - Metadata pembatalan wajib jika status === 'cancelled'
 * - Anti self-reference pada replaces_expense_id
 */
export function validateShiftExpenseEntry(
  exp: any,
  seenExpenseIds: Set<string>,
  context?: ExpenseValidationContext
): ExpenseValidationResult {
  if (!exp || typeof exp !== 'object') {
    return { isValid: false, error: 'Entri pengeluaran bukan objek valid.' };
  }

  // 1. Validasi ID primer dan duplikasi
  if (!exp.id || typeof exp.id !== 'string' || !exp.id.trim()) {
    return { isValid: false, error: 'ID pengeluaran kosong atau tidak valid.' };
  }
  if (seenExpenseIds.has(exp.id)) {
    return { isValid: false, error: `Ditemukan duplikasi ID pengeluaran: "${exp.id}".` };
  }
  seenExpenseIds.add(exp.id);

  // 2. Validasi Relasi Shift (Foreign Key)
  if (!exp.shift_id || typeof exp.shift_id !== 'string' || !exp.shift_id.trim()) {
    return { isValid: false, error: `Shift ID tidak valid pada pengeluaran "${exp.id}".` };
  }
  if (context?.validShiftIds && !context.validShiftIds.has(exp.shift_id)) {
    return {
      isValid: false,
      error: `Pengeluaran "${exp.id}" merujuk pada Shift ID "${exp.shift_id}" yang tidak terdaftar.`,
    };
  }

  // 3. Validasi Nominal (Wajib integer Rupiah positif & finite)
  if (
    typeof exp.amount !== 'number' ||
    !Number.isFinite(exp.amount) ||
    exp.amount <= 0 ||
    !Number.isInteger(exp.amount)
  ) {
    return {
      isValid: false,
      error: `Nominal pada pengeluaran "${exp.id}" harus berupa integer Rupiah positif dan finite (diterima: ${exp.amount}).`,
    };
  }

  // 4. Validasi Kategori
  if (!VALID_EXPENSE_CATEGORIES.includes(exp.category)) {
    return {
      isValid: false,
      error: `Kategori "${exp.category}" pada pengeluaran "${exp.id}" tidak valid.`,
    };
  }

  // 5. Validasi Alasan / Deskripsi (Minimal 3 karakter non-spasi)
  if (typeof exp.description !== 'string' || exp.description.trim().length < 3) {
    return {
      isValid: false,
      error: `Alasan pada pengeluaran "${exp.id}" wajib diisi minimal 3 karakter non-spasi.`,
    };
  }

  // 6. Validasi Waktu & Pencatat
  if (!exp.created_at || isNaN(Date.parse(exp.created_at))) {
    return {
      isValid: false,
      error: `Timestamp created_at pada pengeluaran "${exp.id}" tidak valid.`,
    };
  }
  if (!exp.created_by_user_id || typeof exp.created_by_user_id !== 'string') {
    return {
      isValid: false,
      error: `User ID pencatat pada pengeluaran "${exp.id}" tidak valid.`,
    };
  }
  if (context?.validUserIds && !context.validUserIds.has(exp.created_by_user_id)) {
    return {
      isValid: false,
      error: `Pencatat "${exp.created_by_user_id}" pada pengeluaran "${exp.id}" tidak terdaftar dalam sistem pengguna.`,
    };
  }

  // 7. Validasi Status
  if (!VALID_EXPENSE_STATUSES.includes(exp.status)) {
    return {
      isValid: false,
      error: `Status "${exp.status}" pada pengeluaran "${exp.id}" tidak valid (harus active atau cancelled).`,
    };
  }

  // 8. Validasi Khusus Status Cancelled
  if (exp.status === 'cancelled') {
    if (!exp.cancelled_at || isNaN(Date.parse(exp.cancelled_at))) {
      return {
        isValid: false,
        error: `Pengeluaran dibatalkan "${exp.id}" wajib memiliki timestamp cancelled_at yang valid.`,
      };
    }
    if (!exp.cancelled_by_user_id || typeof exp.cancelled_by_user_id !== 'string') {
      return {
        isValid: false,
        error: `Pengeluaran dibatalkan "${exp.id}" wajib memiliki cancelled_by_user_id.`,
      };
    }
    if (context?.validUserIds && !context.validUserIds.has(exp.cancelled_by_user_id)) {
      return {
        isValid: false,
        error: `Pembatal "${exp.cancelled_by_user_id}" pada pengeluaran "${exp.id}" tidak terdaftar.`,
      };
    }
    if (
      typeof exp.cancellation_reason !== 'string' ||
      exp.cancellation_reason.trim().length < 3
    ) {
      return {
        isValid: false,
        error: `Pengeluaran dibatalkan "${exp.id}" wajib memiliki cancellation_reason minimal 3 karakter non-spasi.`,
      };
    }
  }

  // 9. Validasi Pointer replaces_expense_id (Anti Self-Reference)
  if (exp.replaces_expense_id) {
    if (exp.replaces_expense_id === exp.id) {
      return {
        isValid: false,
        error: `Pengeluaran "${exp.id}" tidak boleh merujuk pada dirinya sendiri (circular replacement).`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Memvalidasi daftar lengkap ShiftExpense[]:
 * - Memastikan input adalah array
 * - Memvalidasi setiap elemen via validateShiftExpenseEntry
 * - Memvalidasi referensi replaces_expense_id menunjuk pada ID yang ada
 */
export function validateShiftExpensesList(
  expenses: any,
  context?: ExpenseValidationContext
): ExpenseValidationResult {
  if (!Array.isArray(expenses)) {
    return { isValid: false, error: 'Data pengeluaran kas harus berupa array.' };
  }

  const seenExpenseIds = new Set<string>();
  const expenseMap = new Map<string, ShiftExpense>();
  const replacedTargets = new Map<string, string>(); // targetId -> replacementId

  for (const exp of expenses) {
    const entryRes = validateShiftExpenseEntry(exp, seenExpenseIds, context);
    if (!entryRes.isValid) {
      return entryRes;
    }
    expenseMap.set(exp.id, exp as ShiftExpense);
  }

  // Validasi relasi dan integritas penggantian (replacement relationships)
  for (const exp of expenses) {
    if (exp.replaces_expense_id) {
      const target = expenseMap.get(exp.replaces_expense_id);
      if (!target) {
        return {
          isValid: false,
          error: `Pengeluaran pengganti "${exp.id}" merujuk pada replaces_expense_id "${exp.replaces_expense_id}" yang tidak ditemukan dalam daftar pengeluaran.`,
        };
      }

      // 1. Entri asal dan pengganti wajib berasal dari shift yang sama
      if (target.shift_id !== exp.shift_id) {
        return {
          isValid: false,
          error: `Pengeluaran pengganti "${exp.id}" (shift "${exp.shift_id}") harus berasal dari shift yang sama dengan pengeluaran asal "${target.id}" (shift "${target.shift_id}").`,
        };
      }

      // 2. Entri asal wajib berstatus cancelled
      if (target.status !== 'cancelled') {
        return {
          isValid: false,
          error: `Pengeluaran pengganti "${exp.id}" merujuk pada pengeluaran "${target.id}" yang belum berstatus cancelled.`,
        };
      }

      // 3. Metadata otorisasi Owner lengkap pada entri pengganti
      if (!exp.authorized_by_user_id || typeof exp.authorized_by_user_id !== 'string' || !exp.authorized_by_user_id.trim()) {
        return {
          isValid: false,
          error: `Pengeluaran pengganti "${exp.id}" wajib menyertakan authorized_by_user_id Owner yang mengesahkan penggantian.`,
        };
      }
      if (!exp.authorized_by_name || typeof exp.authorized_by_name !== 'string' || !exp.authorized_by_name.trim()) {
        return {
          isValid: false,
          error: `Pengeluaran pengganti "${exp.id}" wajib menyertakan authorized_by_name Owner yang mengesahkan penggantian.`,
        };
      }
      if (context?.validUserIds && !context.validUserIds.has(exp.authorized_by_user_id)) {
        return {
          isValid: false,
          error: `Pengeluaran pengganti "${exp.id}" memiliki authorized_by_user_id "${exp.authorized_by_user_id}" yang tidak terdaftar.`,
        };
      }

      // 4. Mencegah konflik penggantian ganda (dua entri berbeda mengklaim menggantikan entri yang sama)
      if (replacedTargets.has(exp.replaces_expense_id)) {
        return {
          isValid: false,
          error: `Ditemukan konflik penggantian ganda: Pengeluaran "${exp.replaces_expense_id}" diklaim digantikan oleh lebih dari satu entri ("${replacedTargets.get(exp.replaces_expense_id)}" dan "${exp.id}").`,
        };
      }
      replacedTargets.set(exp.replaces_expense_id, exp.id);

      // 5. Mencegah siklus penggantian (circular replacement chain: A -> B -> C -> A)
      let currTarget: ShiftExpense | undefined = target;
      const chain = new Set<string>([exp.id]);
      while (currTarget && currTarget.replaces_expense_id) {
        if (chain.has(currTarget.replaces_expense_id)) {
          return {
            isValid: false,
            error: `Terdeteksi siklus penggantian pengeluaran (circular replacement chain) pada "${currTarget.replaces_expense_id}".`,
          };
        }
        chain.add(currTarget.replaces_expense_id);
        currTarget = expenseMap.get(currTarget.replaces_expense_id);
      }
    }
  }

  return { isValid: true };
}
