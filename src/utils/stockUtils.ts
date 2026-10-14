import { Product, Recipe, Stock } from '../types';

export interface ProductStockInfo {
  maxPortions: number;
  status: 'AMAN' | 'MENIPIS' | 'SISA_SEDIKIT' | 'HABIS' | 'ONGOING';
  label: string;
  badgeColorClass: string;
  isOut: boolean;
  isOngoing?: boolean;
}

export function getProductStockInfo(
  product: Product,
  recipes: Recipe[],
  stocks: Stock[]
): ProductStockInfo {
  // Find recipe for product
  const recipe = recipes.find(
    r => r.product_id != null && product.id != null && String(r.product_id) === String(product.id)
  );

  // If no recipe defined or recipe ingredients list is empty -> ONGOING (Not ready for sale)
  if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
    return {
      maxPortions: 0,
      status: 'ONGOING',
      label: 'Belum Siap',
      badgeColorClass: 'bg-stone-100/90 text-stone-600 border-stone-200/80 dark:bg-stone-900/50 dark:text-stone-400 dark:border-stone-800/60',
      isOut: true,
      isOngoing: true
    };
  }

  let minPortions = Infinity;
  let hasLowStockIngredient = false;

  for (const ing of recipe.ingredients) {
    if (!ing.stock_id) {
      return {
        maxPortions: 0,
        status: 'ONGOING',
        label: 'Belum Siap',
        badgeColorClass: 'bg-stone-100/90 text-stone-600 border-stone-200/80 dark:bg-stone-900/50 dark:text-stone-400 dark:border-stone-800/60',
        isOut: true,
        isOngoing: true
      };
    }

    const stockItem = stocks.find(
      s => s.id != null && String(s.id) === String(ing.stock_id)
    );
    if (!stockItem || stockItem.current_amount <= 0) {
      minPortions = 0;
      break;
    }

    if (ing.amount > 0) {
      const possible = Math.floor(stockItem.current_amount / ing.amount);
      if (possible < minPortions) {
        minPortions = possible;
      }
    }

    if (stockItem.current_amount <= stockItem.min_amount) {
      hasLowStockIngredient = true;
    }
  }

  if (minPortions === Infinity) {
    minPortions = 999;
  }

  if (minPortions <= 0) {
    return {
      maxPortions: 0,
      status: 'HABIS',
      label: 'Habis',
      badgeColorClass: 'bg-rose-50/95 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
      isOut: true,
      isOngoing: false
    };
  }

  if (minPortions <= 5) {
    return {
      maxPortions: minPortions,
      status: 'SISA_SEDIKIT',
      label: `Sisa ${minPortions}`,
      badgeColorClass: 'bg-amber-50/90 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
      isOut: false,
      isOngoing: false
    };
  }

  if (hasLowStockIngredient) {
    return {
      maxPortions: minPortions,
      status: 'MENIPIS',
      label: 'Stok Menipis',
      badgeColorClass: 'bg-amber-50/90 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
      isOut: false,
      isOngoing: false
    };
  }

  return {
    maxPortions: minPortions,
    status: 'AMAN',
    label: 'Tersedia',
    badgeColorClass: 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    isOut: false,
    isOngoing: false
  };
}

export interface PackagingConversionResult {
  isValid: boolean;
  error?: string;
  totalBaseQuantity?: number;
  costPerBaseUnit?: number;
  totalCost?: number;
}

/**
 * Validasi dan kalkulasi konversi kemasan pembelian ke satuan dasar stok internal.
 * Rumus Bisnis:
 * - total_base_quantity = package_quantity × base_quantity_per_package
 * - purchase_total = package_quantity × price_per_package
 * - cost_per_base_unit = purchase_total ÷ total_base_quantity
 */
export function validatePackagingConversion(params: {
  stockName: string;
  baseUnit: string;
  packageQty: number;
  conversionRatio: number;
  packagePrice: number;
  packageUnit?: string;
}): PackagingConversionResult {
  const { stockName, baseUnit, packageQty, conversionRatio, packagePrice, packageUnit } = params;

  // 1. Validasi numerik ketat: tolak NaN, Infinity, <= 0
  if (typeof packageQty !== 'number' || !Number.isFinite(packageQty) || packageQty <= 0) {
    return {
      isValid: false,
      error: `Jumlah kemasan untuk "${stockName}" harus berupa angka valid lebih besar dari 0 (didapat: ${packageQty}).`,
    };
  }

  if (typeof conversionRatio !== 'number' || !Number.isFinite(conversionRatio) || conversionRatio <= 0) {
    return {
      isValid: false,
      error: `Isi per kemasan untuk "${stockName}" harus berupa angka valid lebih besar dari 0 (didapat: ${conversionRatio}).`,
    };
  }

  if (typeof packagePrice !== 'number' || !Number.isFinite(packagePrice) || packagePrice < 0) {
    return {
      isValid: false,
      error: `Harga per kemasan untuk "${stockName}" harus berupa angka valid lebih besar atau sama dengan 0 (didapat: ${packagePrice}).`,
    };
  }

  // 2. Validasi dimensi unit antar kemasan dan satuan dasar stok
  const cleanBase = (baseUnit || '').trim().toLowerCase();
  const cleanPkg = (packageUnit || '').trim().toLowerCase();

  const isWeightBase = cleanBase === 'gram' || cleanBase === 'g';
  const isVolumeBase = cleanBase === 'ml';
  const isCountBase = cleanBase === 'pcs';

  const isWeightPkg = ['kg', 'kilogram', 'gram', 'g', 'ons'].includes(cleanPkg);
  const isVolumePkg = ['ml', 'liter', 'l'].includes(cleanPkg);
  const isCountPkg = ['pcs', 'buah', 'biji', 'butir', 'lembar'].includes(cleanPkg);

  if (isWeightBase && isVolumePkg) {
    return {
      isValid: false,
      error: `Konversi lintas dimensi ditolak: Bahan "${stockName}" menggunakan satuan massa (${baseUnit}), tidak dapat menggunakan kemasan volume (${packageUnit}).`,
    };
  }

  if (isVolumeBase && isWeightPkg) {
    return {
      isValid: false,
      error: `Konversi lintas dimensi ditolak: Bahan "${stockName}" menggunakan satuan volume (${baseUnit}), tidak dapat menggunakan kemasan massa (${packageUnit}).`,
    };
  }

  if (isCountBase && (isWeightPkg || isVolumePkg)) {
    return {
      isValid: false,
      error: `Konversi lintas dimensi ditolak: Bahan "${stockName}" menggunakan satuan hitungan (${baseUnit}), tidak dapat menggunakan kemasan massa/volume (${packageUnit}).`,
    };
  }

  // 3. Validasi kuantitas bahan berkarakter Pcs harus bilangan bulat
  const rawTotalBaseQty = packageQty * conversionRatio;
  if (isCountBase && !Number.isInteger(rawTotalBaseQty)) {
    return {
      isValid: false,
      error: `Kuantitas hasil konversi untuk bahan berkarakter Pcs ("${stockName}") harus berupa bilangan bulat, didapat ${rawTotalBaseQty}.`,
    };
  }

  const totalBaseQuantity = isCountBase ? rawTotalBaseQty : Math.round(rawTotalBaseQty * 1000) / 1000;
  const totalCost = Math.round(packageQty * packagePrice);
  const costPerBaseUnit = totalBaseQuantity > 0 ? totalCost / totalBaseQuantity : 0;

  return {
    isValid: true,
    totalBaseQuantity,
    costPerBaseUnit,
    totalCost,
  };
}
