import { useState, useCallback } from 'react';
import { Purchase, User } from '../../types';
import { stockService } from '../../services/stockService';
import { ToastType } from './usePOSToast';

export interface UsePOSPurchasesProps {
  currentUser: User | null;
  onStockChange: () => Promise<void> | void;
  showToast: (message: string, type?: ToastType) => void;
}

export const usePOSPurchases = ({
  currentUser,
  onStockChange,
  showToast,
}: UsePOSPurchasesProps) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const addPurchase = async (purchaseData: Omit<Purchase, 'id'>) => {
    const newPur = await stockService.createPurchase(purchaseData);
    setPurchases(prev => [newPur, ...prev]);
    await onStockChange();
    showToast(`Pembelian ${newPur.purchase_number} berhasil ditambahkan`, 'success');
    return newPur;
  };

  const editPurchase = async (id: string, purchaseData: Partial<Purchase>) => {
    const updated = await stockService.updatePurchase(id, purchaseData);
    setPurchases(prev => prev.map(p => p.id === id ? updated : p));
    await onStockChange();
    showToast(`Pembelian ${updated.purchase_number} berhasil diperbarui`, 'success');
    return updated;
  };

  const removePurchase = async (id: string) => {
    const pur = purchases.find(p => p.id === id);
    const success = await stockService.deletePurchase(id);
    if (success) {
      setPurchases(prev => prev.filter(p => p.id !== id));
      await onStockChange();
      showToast(`Pembelian ${pur?.purchase_number || ''} berhasil dihapus & stok dikembalikan`, 'success');
    }
    return success;
  };

  const handlePurchaseRealtimeChange = useCallback(async () => {
    try {
      const isOwner = (currentUser?.role || '').toLowerCase() === 'owner';
      await onStockChange();
      if (isOwner) {
        const updatedPurchases = await stockService.getPurchases();
        setPurchases(updatedPurchases);
      }
    } catch (err) {
      console.error('[Realtime] Failed to sync data after purchase.recorded:', err);
    }
  }, [currentUser?.role, onStockChange]);

  return {
    purchases,
    setPurchases,
    addPurchase,
    editPurchase,
    removePurchase,
    handlePurchaseRealtimeChange,
  };
};
