import {
  User,
  Category,
  Product,
  Stock,
  StockHistory,
  Recipe,
  Order,
  Purchase,
  DiscountRule,
  Settings,
} from '../types';

export interface MockStoreState {
  users: User[];
  categories: Category[];
  products: Product[];
  stocks: Stock[];
  stockHistories: StockHistory[];
  recipes: Recipe[];
  orders: Order[];
  purchases: Purchase[];
  discountRules: DiscountRule[];
  settings: Settings;
}
