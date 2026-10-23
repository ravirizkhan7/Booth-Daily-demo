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
  Shift,
  ShiftExpense,
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
  shifts: Shift[];
  expenses: ShiftExpense[];
  activeShiftId: string | null;
}
