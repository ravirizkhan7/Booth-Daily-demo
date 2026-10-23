import { useState, useCallback } from 'react';
import { Product, Recipe, Stock, OrderType, OrderArea } from '../../types';
import { getProductStockInfo } from '../../utils/stockUtils';
import { ToastType } from './usePOSToast';

export interface CartItem {
  product: Product;
  qty: number;
  notes: string;
}

export interface UsePOSCartProps {
  recipes: Recipe[];
  stocks: Stock[];
  isShiftActive?: boolean;
  showToast: (message: string, type?: ToastType) => void;
}

export const usePOSCart = ({ recipes, stocks, isShiftActive = false, showToast }: UsePOSCartProps) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [orderArea, setOrderArea] = useState<OrderArea>('regular');
  const [customerName, setCustomerName] = useState<string>('');

  const addToCart = useCallback((product: Product, quantityToAdd: number = 1) => {
    if (!isShiftActive) {
      showToast('Shift kasir belum dibuka. Buka shift kasir terlebih dahulu.', 'info');
      return;
    }

    if (!product.is_active) {
      showToast('Produk ini sedang tidak aktif', 'error');
      return;
    }

    const stockInfo = getProductStockInfo(product, recipes, stocks);
    if (stockInfo.isOut) {
      if (stockInfo.isOngoing) {
        showToast('Produk ini masih dalam proses konfigurasi resep.', 'error');
      } else {
        showToast('Stok habis, silakan lakukan pembelian atau update stok.', 'error');
      }
      return;
    }

    const existingInCart = cart.find(item => item.product.id === product.id);
    const currentQty = existingInCart ? existingInCart.qty : 0;
    if (currentQty + quantityToAdd > stockInfo.maxPortions) {
      showToast(`Stok ${product.name} tidak mencukupi (tersisa ${stockInfo.maxPortions})`, 'error');
      return;
    }

    setCart(prevCart => {
      const existing = prevCart.find(item => item.product.id === product.id);
      if (existing) {
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, qty: item.qty + quantityToAdd }
            : item
        );
      }
      return [...prevCart, { product, qty: quantityToAdd, notes: '' }];
    });
    showToast(`${product.name} ditambahkan`, 'info');
  }, [cart, recipes, stocks, isShiftActive, showToast]);

  const updateCartQty = useCallback((productId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
      return;
    }

    const cartItem = cart.find(item => item.product.id === productId);
    if (cartItem && newQty > cartItem.qty) {
      const stockInfo = getProductStockInfo(cartItem.product, recipes, stocks);
      if (newQty > stockInfo.maxPortions) {
        showToast(`Stok ${cartItem.product.name} hanya tersisa ${stockInfo.maxPortions} item`, 'error');
        return;
      }
    }

    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, qty: newQty } : item));
  }, [cart, recipes, stocks, showToast]);

  const updateCartNotes = useCallback((productId: string, notes: string) => {
    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, notes } : item));
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCustomerName('');
    setOrderArea('regular');
  }, []);

  return {
    cart,
    setCart,
    orderType,
    setOrderType,
    orderArea,
    setOrderArea,
    customerName,
    setCustomerName,
    addToCart,
    updateCartQty,
    updateCartNotes,
    removeFromCart,
    clearCart,
  };
};
