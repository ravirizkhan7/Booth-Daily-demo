import { Shift, User } from '../types';
import { shiftRepository } from '../mock/repositories/shiftRepository';

export const shiftService = {
  async getShifts(): Promise<Shift[]> {
    return shiftRepository.getShifts();
  },

  async getShiftById(id: string): Promise<Shift | undefined> {
    return shiftRepository.getShiftById(id);
  },

  async getActiveShift(): Promise<Shift | null> {
    return shiftRepository.getActiveShift();
  },

  async openShift(cashInitial: number, user: User): Promise<Shift> {
    return shiftRepository.openShift({ cash_initial: cashInitial, user });
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
    return shiftRepository.closeShift(payload);
  },

  async reviewShiftReconciliation(payload: {
    shift_id: string;
    action: 'approved_variance' | 'correction_requested';
    notes?: string;
    user: User;
  }): Promise<Shift> {
    return shiftRepository.reviewShiftReconciliation(payload);
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
    return shiftRepository.correctShiftReconciliation(payload);
  },
};
