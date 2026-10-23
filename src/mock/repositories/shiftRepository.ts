import { Shift, User, ShiftExpense, ShiftExpenseCategory } from '../../types';
import { mockStore } from '../store';

export const shiftRepository = {
  async getShifts(): Promise<Shift[]> {
    return mockStore.getShifts();
  },

  async getShiftById(id: string): Promise<Shift | undefined> {
    return mockStore.getShiftById(id);
  },

  async getActiveShift(): Promise<Shift | null> {
    return mockStore.getActiveShift();
  },

  async openShift(payload: { cash_initial: number; user: User }): Promise<Shift> {
    return mockStore.openShift(payload);
  },

  async closeShift(payload: {
    shift_id: string;
    actual_cash_end: number;
    actual_qris_end?: number | null;
    actual_refund_total?: number | null;
    cash_difference_reason?: string;
    qris_difference_reason?: string;
    notes?: string;
    user: User;
  }): Promise<Shift> {
    return mockStore.closeShift(payload);
  },

  async reviewShiftReconciliation(payload: {
    shift_id: string;
    action: 'approved_variance' | 'correction_requested';
    notes?: string;
    user?: User;
  }): Promise<Shift> {
    return mockStore.reviewShiftReconciliation(payload);
  },

  async correctShiftReconciliation(payload: {
    shift_id: string;
    actual_cash_end: number;
    actual_qris_end: number | null;
    actual_refund_total?: number | null;
    cash_difference_reason?: string;
    qris_difference_reason?: string;
    correction_notes?: string;
    user: User;
  }): Promise<Shift> {
    return mockStore.correctShiftReconciliation(payload);
  },

  async getShiftExpenses(shiftId: string): Promise<ShiftExpense[]> {
    return mockStore.getShiftExpenses(shiftId);
  },

  async getAllExpenses(): Promise<ShiftExpense[]> {
    return mockStore.getAllExpenses();
  },

  async calculateShiftTheoreticalAvailableCash(shiftId: string): Promise<number> {
    return mockStore.calculateShiftTheoreticalAvailableCash(shiftId);
  },

  async recordShiftExpense(payload: {
    shift_id: string;
    amount: number;
    category: ShiftExpenseCategory;
    description: string;
    receipt_number?: string;
    user: User;
  }): Promise<ShiftExpense> {
    return mockStore.recordShiftExpense(payload);
  },

  async cancelShiftExpense(payload: {
    expense_id: string;
    cancellation_reason: string;
    owner_user: User;
  }): Promise<ShiftExpense> {
    return mockStore.cancelShiftExpense(payload);
  },

  async replaceShiftExpense(payload: {
    old_expense_id: string;
    new_expense: {
      amount: number;
      category: ShiftExpenseCategory;
      description: string;
      receipt_number?: string;
    };
    cancellation_reason: string;
    owner_user: User;
  }): Promise<{ cancelled_expense: ShiftExpense; new_expense: ShiftExpense }> {
    return mockStore.replaceShiftExpense(payload);
  },
};
