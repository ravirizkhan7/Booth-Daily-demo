import { useState, useCallback } from 'react';
import { Stock, StockHistory, User } from '../../types';
import { stockService } from '../../services/stockService';
import { ToastType } from './usePOSToast';

export interface UsePOSStockProps {
  currentUser: User | null;
  showToast: (message: string, type?: ToastType) => void;
}

export const usePOSStock = ({ currentUser, showToast }: UsePOSStockProps) => {
  const [stocks, setStocks] = useState<Stock[]>(() => {
    try {
      const cached = localStorage.getItem('boothdaily_cached_stocks');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [stockHistories, setStockHistories] = useState<StockHistory[]>([]);

  const refreshStocksAndHistories = useCallback(async () => {
    try {
      const [updatedStocks, updatedHistories] = await Promise.all([
        stockService.getStocks(),
        stockService.getStockHistories(),
      ]);
      setStocks(updatedStocks);
      setStockHistories(updatedHistories);
      try {
        localStorage.setItem('boothdaily_cached_stocks', JSON.stringify(updatedStocks));
      } catch {}
    } catch (err) {
      console.warn('Failed to refresh stocks and histories:', err);
    }
  }, []);

  const addStockItem = async (stockData: Omit<Stock, 'id'>) => {
    const newStock = await stockService.createStock(stockData);
    setStocks(prev => [newStock, ...prev]);
    const histories = await stockService.getStockHistories();
    setStockHistories(histories);
    showToast(`Bahan "${newStock.name}" berhasil ditambahkan`, 'success');
    return newStock;
  };

  const editStockItem = async (id: string, stockData: Partial<Stock>) => {
    const updated = await stockService.updateStock(id, stockData);
    const normalized: Stock = {
      id: String(updated.id),
      name: updated.name,
      current_amount: Number(updated.current_amount),
      min_amount: Number(updated.min_amount || 0),
      unit: updated.unit,
      cost_per_unit: Number(updated.cost_per_unit || 0),
    };
    setStocks(prev => {
      const next = prev.map(s => String(s.id) === String(id) ? normalized : s);
      try {
        localStorage.setItem('boothdaily_cached_stocks', JSON.stringify(next));
      } catch {}
      return next;
    });
    try {
      const histories = await stockService.getStockHistories();
      setStockHistories(histories);
    } catch (hErr) {
      console.warn('Failed to refresh stock histories:', hErr);
    }
    showToast(`Bahan "${normalized.name}" berhasil diperbarui`, 'success');
    return normalized;
  };

  const removeStockItem = async (id: string) => {
    const stk = stocks.find(s => s.id === id);
    const success = await stockService.deleteStock(id);
    if (success) {
      setStocks(prev => {
        const next = prev.filter(s => String(s.id) !== String(id));
        try {
          localStorage.setItem('boothdaily_cached_stocks', JSON.stringify(next));
        } catch {}
        return next;
      });
      showToast(`Bahan "${stk?.name || ''}" berhasil dihapus`, 'success');
    }
    return success;
  };

  const adjustStockQuantity = async (stockId: string, changeAmount: number, reason: string) => {
    const userName = currentUser ? currentUser.name : 'Owner';
    const updated = await stockService.adjustStock(stockId, changeAmount, reason, userName);
    const normalized: Stock = {
      id: String(updated.id),
      name: updated.name,
      current_amount: Number(updated.current_amount),
      min_amount: Number(updated.min_amount || 0),
      unit: updated.unit,
      cost_per_unit: Number(updated.cost_per_unit || 0),
    };
    setStocks(prev => {
      const next = prev.map(s => String(s.id) === String(stockId) ? normalized : s);
      try {
        localStorage.setItem('boothdaily_cached_stocks', JSON.stringify(next));
      } catch {}
      return next;
    });
    try {
      const histories = await stockService.getStockHistories();
      setStockHistories(histories);
    } catch (hErr) {
      console.warn('Failed to refresh stock histories:', hErr);
    }
    showToast(`Penyesuaian stok ${normalized.name} berhasil`, 'success');
    return normalized;
  };

  // Realtime Stock Updated handler
  const handleStockRealtimeChange = useCallback(async (payload: { action: string; stock: any; history?: any }) => {
    if (!payload?.stock?.id) return;
    const stockId = String(payload.stock.id);
    const normalizedStock: Stock = {
      id: stockId,
      name: payload.stock.name,
      current_amount: Number(payload.stock.current_amount),
      min_amount: Number(payload.stock.min_amount || 0),
      unit: payload.stock.unit,
      cost_per_unit: Number(payload.stock.cost_per_unit || 0),
    };

    if (payload.action === 'created') {
      setStocks(prev => {
        const exists = prev.some(s => String(s.id) === stockId);
        const next = exists
          ? prev.map(s => String(s.id) === stockId ? normalizedStock : s)
          : [normalizedStock, ...prev];
        try { localStorage.setItem('boothdaily_cached_stocks', JSON.stringify(next)); } catch {}
        return next;
      });
    } else if (payload.action === 'deleted') {
      setStocks(prev => {
        const next = prev.filter(s => String(s.id) !== stockId);
        try { localStorage.setItem('boothdaily_cached_stocks', JSON.stringify(next)); } catch {}
        return next;
      });
    } else {
      // 'updated' | 'adjusted'
      setStocks(prev => {
        const exists = prev.some(s => String(s.id) === stockId);
        const next = exists
          ? prev.map(s => String(s.id) === stockId ? { ...s, ...normalizedStock, cost_per_unit: s.cost_per_unit ?? 0 } : s)
          : [...prev, normalizedStock];
        try { localStorage.setItem('boothdaily_cached_stocks', JSON.stringify(next)); } catch {}
        return next;
      });
    }

    // Direct Realtime History append if payload carries history
    if (payload.history?.id) {
      const normalizedHistory: StockHistory = {
        id: String(payload.history.id),
        stock_id: String(payload.history.stock_id),
        stock_name: payload.history.stock_name,
        change_amount: Number(payload.history.change_amount),
        unit: payload.history.unit,
        type: payload.history.type,
        reference: payload.history.reference || '',
        user_name: payload.history.user_name || undefined,
        final_amount: payload.history.final_amount != null ? Number(payload.history.final_amount) : undefined,
        created_at: payload.history.created_at || new Date().toISOString(),
      };

      setStockHistories(prev => {
        const exists = prev.some(h => String(h.id) === normalizedHistory.id);
        if (exists) {
          return prev.map(h => String(h.id) === normalizedHistory.id ? normalizedHistory : h);
        }
        return [normalizedHistory, ...prev];
      });
    } else {
      // Fallback: If payload did not carry history directly, refetch in background
      try {
        const updatedHistories = await stockService.getStockHistories();
        setStockHistories(updatedHistories);
      } catch {}
    }
  }, []);

  return {
    stocks,
    setStocks,
    stockHistories,
    setStockHistories,
    refreshStocksAndHistories,
    addStockItem,
    editStockItem,
    removeStockItem,
    adjustStockQuantity,
    handleStockRealtimeChange,
  };
};
