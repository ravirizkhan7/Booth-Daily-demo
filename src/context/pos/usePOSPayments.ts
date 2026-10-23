import { useState, useCallback } from 'react';
import { Order, PaymentMethod, OrderType, User } from '../../types';
import { userService } from '../../services/userService';
import { transactionService } from '../../services/transactionService';
import { CartItem } from './usePOSCart';
import { ToastType } from './usePOSToast';

export interface UsePOSPaymentsProps {
  cart: CartItem[];
  orderType: OrderType;
  orderArea?: 'regular' | 'vip';
  customerName: string;
  currentUser: User | null;
  clearCart: () => void;
  onOrderCreated: (order: Order) => void;
  onStockChange: () => Promise<void> | void;
  showToast: (message: string, type?: ToastType) => void;
}

export const usePOSPayments = ({
  cart,
  orderType,
  orderArea = 'regular',
  customerName,
  currentUser,
  clearCart,
  onOrderCreated,
  onStockChange,
  showToast,
}: UsePOSPaymentsProps) => {
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [currentReceiptOrder, setCurrentReceiptOrder] = useState<Order | null>(null);

  const openPinModal = useCallback(() => {
    if (cart.length === 0) {
      showToast('Keranjang masih kosong!', 'error');
      return;
    }
    setIsPinModalOpen(true);
  }, [cart.length, showToast]);

  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false);
  }, []);

  const openReceiptModal = useCallback((order: Order) => {
    setCurrentReceiptOrder(order);
    setIsReceiptModalOpen(true);
  }, []);

  const closeReceiptModal = useCallback(() => {
    setIsReceiptModalOpen(false);
    setCurrentReceiptOrder(null);
  }, []);

  const processPaymentWithPin = async (
    pin: string,
    paymentMethod: PaymentMethod,
    amountPaid: number
  ): Promise<{ success: boolean; message: string; order?: Order }> => {
    const pinAuth = await userService.verifyPin(pin);
    if (!pinAuth || !pinAuth.user) {
      return { success: false, message: 'PIN salah. Silakan coba lagi.' };
    }
    const verifiedUser = pinAuth.user;
    const pinToken = pinAuth.token;

    // Logged-in users can only authorize with their own PIN.
    if (currentUser) {
      if (verifiedUser.id !== currentUser.id) {
        return { success: false, message: 'PIN salah. Silakan coba lagi.' };
      }
    }

    try {
      const itemsPayload = cart.map(c => ({
        product_id: c.product.id,
        product_name: c.product.name,
        price: c.product.price,
        qty: c.qty,
        notes: c.notes
      }));

      // For Guest without auth_token, explicitly use pin_token for the order creation request
      const isGuest = !localStorage.getItem('token');
      const orderToken = isGuest ? pinToken : undefined;
      const isVip = orderArea === 'vip';
      const newOrder = await transactionService.processTransaction({
        order_type: orderType,
        order_area: orderArea,
        is_vip: isVip,
        items: itemsPayload,
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        customer_name: customerName,
        user: verifiedUser,
        pinToken: orderToken,
      });

      onOrderCreated(newOrder);

      try {
        await onStockChange();
      } catch (stockErr) {
        console.warn('Failed to sync stock after payment:', stockErr);
      }

      clearCart();
      setIsPinModalOpen(false);

      setCurrentReceiptOrder(newOrder);
      setIsReceiptModalOpen(true);

      showToast(`Transaksi ${newOrder.order_number} berhasil!`, 'success');
      return { success: true, message: 'Transaksi Berhasil', order: newOrder };
    } catch (err: any) {
      return { success: false, message: err.message || 'Gagal memproses transaksi' };
    }
  };

  return {
    isPinModalOpen,
    openPinModal,
    closePinModal,
    isReceiptModalOpen,
    openReceiptModal,
    closeReceiptModal,
    currentReceiptOrder,
    processPaymentWithPin,
  };
};
