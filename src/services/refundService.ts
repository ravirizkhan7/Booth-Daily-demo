import { mockStore, SubmitRefundRequestInput } from '../mock/store';
import { RefundRequest, RefundApprovalStatus } from '../types';

export const refundService = {
  async getRefundRequests(params?: {
    order_id?: string;
    shift_id?: string;
    approval_status?: RefundApprovalStatus;
  }): Promise<RefundRequest[]> {
    return mockStore.getRefundRequests(params);
  },

  async getRefundRequestById(id: string): Promise<RefundRequest | undefined> {
    return mockStore.getRefundRequestById(id);
  },

  async getRefundRequestByOrderId(orderId: string): Promise<RefundRequest | undefined> {
    return mockStore.getRefundRequestByOrderId(orderId);
  },

  async getShiftAvailableCash(shiftId?: string): Promise<number> {
    return mockStore.getShiftAvailableCash(shiftId);
  },

  async submitRefundRequest(
    orderId: string,
    payload: SubmitRefundRequestInput,
    pin: string
  ): Promise<RefundRequest> {
    return mockStore.submitRefundRequest(orderId, payload, pin);
  },

  async approveRefundRequest(
    requestId: string,
    pin: string,
    notes?: string
  ): Promise<RefundRequest> {
    return mockStore.approveRefundRequest(requestId, pin, notes);
  },

  async disburseRefund(requestId: string, pin: string): Promise<RefundRequest> {
    return mockStore.disburseRefund(requestId, pin);
  },

  async rejectRefundRequest(
    requestId: string,
    pin: string,
    rejectionReason: string
  ): Promise<RefundRequest> {
    return mockStore.rejectRefundRequest(requestId, pin, rejectionReason);
  },
};

