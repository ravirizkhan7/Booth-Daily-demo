import { Stock, StockHistory, Purchase } from '../types';
import { stockRepository } from '../mock/repositories/stockRepository';

export const stockService = {
  async getStocks(): Promise<Stock[]> {
    return stockRepository.getStocks();
  },

  async getStockHistories(): Promise<StockHistory[]> {
    return stockRepository.getStockHistories();
  },

  async getStockHistoriesForStock(stockId: string): Promise<StockHistory[]> {
    return stockRepository.getStockHistoriesForStock(stockId);
  },

  async getPurchases(): Promise<Purchase[]> {
    return stockRepository.getPurchases();
  },

  async createStock(stockData: Omit<Stock, 'id'>): Promise<Stock> {
    return stockRepository.createStock(stockData);
  },

  async updateStock(
    id: string,
    stockData: Partial<Stock>,
    metadata?: { notes?: string; user_name?: string }
  ): Promise<Stock> {
    return stockRepository.updateStock(id, stockData, metadata);
  },

  async deleteStock(id: string): Promise<boolean> {
    return stockRepository.deleteStock(id);
  },

  async adjustStock(
    stockId: string,
    changeAmount: number,
    reason: string,
    userName: string = 'Owner',
    notes?: string
  ): Promise<Stock> {
    return stockRepository.adjustStock(stockId, changeAmount, reason, userName, notes);
  },

  async createPurchase(purchaseData: Omit<Purchase, 'id'>): Promise<Purchase> {
    return stockRepository.createPurchase(purchaseData);
  },

  async updatePurchase(id: string, purchaseData: Partial<Purchase>): Promise<Purchase> {
    return stockRepository.updatePurchase(id, purchaseData);
  },

  async deletePurchase(id: string): Promise<boolean> {
    return stockRepository.deletePurchase(id);
  },
};
