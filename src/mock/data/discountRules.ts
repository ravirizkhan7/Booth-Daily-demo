import { DiscountRule } from '../../types';

export const initialDiscountRules: DiscountRule[] = [
  {
    id: 'disc-1',
    name: 'Promo Ngopi Hemat - 10%',
    discount_percentage: 10,
    minimum_purchase: 50000,
    is_active: true,
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: '2026-08-01T08:00:00.000Z',
  },
  {
    id: 'disc-2',
    name: 'Weekend Coffee Fest - 15%',
    discount_percentage: 15,
    minimum_purchase: 100000,
    is_active: false,
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: '2026-08-01T08:00:00.000Z',
  },
  {
    id: 'disc-3',
    name: 'Flash Sale Pagi - 20%',
    discount_percentage: 20,
    minimum_purchase: 75000,
    is_active: false,
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: '2026-08-01T08:00:00.000Z',
  },
];
