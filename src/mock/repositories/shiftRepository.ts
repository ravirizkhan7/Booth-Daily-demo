import { Shift, User } from '../../types';
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
};
