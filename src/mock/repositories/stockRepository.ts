import { Stock, StockHistory, Purchase } from '../../types';
import { mockStore } from '../store';

export const stockRepository = {
  async getStocks(): Promise<Stock[]> {
    return mockStore.getStocks();
  },

  async getStockHistories(): Promise<StockHistory[]> {
    return mockStore.getStockHistories();
  },

  async getStockHistoriesForStock(stockId: string): Promise<StockHistory[]> {
    const allHistories = mockStore.getStockHistories();
    return allHistories.filter(h => String(h.stock_id) === String(stockId));
  },

  async getPurchases(): Promise<Purchase[]> {
    return mockStore.getPurchases();
  },

  async createStock(stockData: Omit<Stock, 'id'>): Promise<Stock> {
    return mockStore.addStock(stockData);
  },

  async updateStock(id: string, stockData: Partial<Stock>): Promise<Stock> {
    return mockStore.updateStock(id, stockData);
  },

  async deleteStock(id: string): Promise<boolean> {
    return mockStore.deleteStock(id);
  },

  async adjustStock(
    stockId: string,
    changeAmount: number,
    reason: string,
    userName: string = 'Owner'
  ): Promise<Stock> {
    return mockStore.adjustStock(stockId, changeAmount, reason, userName);
  },

  async createPurchase(purchaseData: Omit<Purchase, 'id'>): Promise<Purchase> {
    return mockStore.addPurchase(purchaseData);
  },

  async updatePurchase(id: string, purchaseData: Partial<Purchase>): Promise<Purchase> {
    return mockStore.updatePurchase(id, purchaseData);
  },

  async deletePurchase(id: string): Promise<boolean> {
    return mockStore.deletePurchase(id);
  },
};
