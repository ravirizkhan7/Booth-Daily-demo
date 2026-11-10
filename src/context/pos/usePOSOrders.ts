import { useState, useCallback } from 'react';
import { Order, PaymentMethod } from '../../types';
import { ToastType } from './usePOSToast';

export interface UsePOSOrdersProps {
  currentUser?: { id: string | number; role: string } | null;
  onStockChange: () => Promise<void> | void;
  showToast: (message: string, type?: ToastType) => void;
}

export const usePOSOrders = ({ currentUser, onStockChange, showToast }: UsePOSOrdersProps) => {
  const [orders, setOrders] = useState<Order[]>([]);

  /**
   * @deprecated JALUR OPERASIONAL DITUTUP.
   * Direct refund melalui POSContext dinonaktifkan untuk mencegah bypass workflow.
   * Seluruh refund operasional wajib melalui alur pengajuan dan persetujuan Owner via refundService.
   */
  const refundOrder = async (
    _orderId: string,
    _metadata?: { refunded_by_name?: string; refund_reason?: string; refund_method?: PaymentMethod }
  ): Promise<{ success: boolean; message: string; order?: Order }> => {
    const errMsg = 'Aksi ditolak: Direct refund dinonaktifkan pada jalur operasional POS. Pengembalian dana wajib melalui pengajuan kasir dan persetujuan Owner.';
    showToast(errMsg, 'error');
    return { success: false, message: errMsg };
  };

  const handleOrderCreatedRealtime = useCallback(async (newOrder: Order) => {
    if (!newOrder?.id) return;

    // Defense-in-depth: If employee is logged in and the order was created by someone else,
    // only sync stock amounts but do NOT add order to private orders list
    const isEmployee = currentUser?.role === 'karyawan' || currentUser?.role === 'employee';
    if (isEmployee && String(newOrder.created_by_user_id) !== String(currentUser?.id)) {
      try {
        await onStockChange();
      } catch (err) {
        console.error('[Realtime] Failed to sync stocks after order.created:', err);
      }
      return;
    }

    setOrders(prev => {
      const exists = prev.some(o => String(o.id) === String(newOrder.id));
      if (exists) {
        return prev.map(o => String(o.id) === String(newOrder.id) ? newOrder : o);
      }
      return [newOrder, ...prev];
    });

    try {
      await onStockChange();
    } catch (err) {
      console.error('[Realtime] Failed to sync stocks after order.created:', err);
    }
  }, [currentUser, onStockChange]);

  const handleOrderRefundedRealtime = useCallback(async (refundedOrder: Order) => {
    if (!refundedOrder?.id) return;
    setOrders(prev =>
      prev.map(o => String(o.id) === String(refundedOrder.id) ? refundedOrder : o)
    );

    try {
      await onStockChange();
    } catch (err) {
      console.error('[Realtime] Failed to sync stocks after order.refunded:', err);
    }
  }, [onStockChange]);

  return {
    orders,
    setOrders,
    refundOrder,
    handleOrderCreatedRealtime,
    handleOrderRefundedRealtime,
  };
};
