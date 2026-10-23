/**
 * BOOTH DAILY — HPP Automation Pure Calculation Helpers (Phase 1)
 *
 * Seluruh fungsi dalam modul ini adalah fungsi murni (pure functions):
 * - Tanpa efek samping (no side-effects).
 * - Tidak memutasi parameter input.
 * - Mempertahankan presisi desimal internal (IEEE 754 float).
 * - Validasi ketat terhadap input non-finite, unit tidak dikenal, faktor tidak valid, dan overflow.
 *
 * CATATAN PENTING:
 * roundToRupiah HANYA digunakan untuk formatting/display akhir ke UI.
 * DILARANG menggunakan roundToRupiah pada kalkulasi internal HPP, WAC, atau biaya bahan.
 */

export interface UnitConversionOptions {
  stockName?: string;
  densityGramPerMl?: number;
  weightGramPerPiece?: number;
  piecesPerPackage?: number;
}

export interface WACParams {
  oldQty: number;
  oldUnitCost: number;
  addedQty: number;
  addedUnitCost: number;
}

/**
 * 1. Menghitung kuantitas bruto bahan berdasarkan kuantitas bersih dan persentase susut (waste).
 * Rumus: grossAmount = netAmount / (1 - (wastePercentage / 100))
 */
export function calculateGrossAmount(netAmount: number, wastePercentage?: number): number {
  if (typeof netAmount !== 'number' || !Number.isFinite(netAmount) || netAmount < 0) {
    throw new Error(
      `Kuantitas bersih tidak valid: ${netAmount}. Kuantitas harus berupa angka berhingga dan >= 0.`
    );
  }

  const effectiveWaste = wastePercentage === undefined || wastePercentage === null ? 0 : wastePercentage;

  if (typeof effectiveWaste !== 'number' || !Number.isFinite(effectiveWaste)) {
    throw new Error(
      `Persentase susut (waste) tidak valid: ${effectiveWaste}. Nilai harus berupa angka berhingga.`
    );
  }

  if (effectiveWaste < 0 || effectiveWaste >= 100) {
    throw new Error(
      `Persentase susut (waste) harus berada pada rentang 0% <= waste < 100% (diterima: ${effectiveWaste}%).`
    );
  }

  if (netAmount === 0) {
    return 0;
  }

  const factor = 1 - effectiveWaste / 100;
  const gross = netAmount / factor;

  if (!Number.isFinite(gross)) {
    throw new Error('Kalkulasi kuantitas bruto menghasilkan nilai overflow di luar batas numerik.');
  }

  return gross;
}

// Kamus faktor konversi dimensi baku
const MASS_UNITS: Record<string, number> = {
  kg: 1000,
  kilogram: 1000,
  ons: 100,
  g: 1,
  gram: 1,
  mg: 0.001,
};

const VOLUME_UNITS: Record<string, number> = {
  l: 1000,
  liter: 1000,
  dl: 100,
  cl: 10,
  ml: 1,
};

const COUNT_ALIASES = new Set(['pcs', 'buah', 'biji']);
const PACKAGE_ALIASES = new Set(['box', 'pack', 'paket', 'karton']);
const DISALLOWED_STANDALONE_COUNT_NOUNS = new Set(['butir', 'lembar', 'cup', 'botol']);

type DimensionType = 'mass' | 'volume' | 'count' | 'package' | 'standalone_count';

function resolveUnitDimension(cleanUnit: string): DimensionType | null {
  if (cleanUnit in MASS_UNITS) return 'mass';
  if (cleanUnit in VOLUME_UNITS) return 'volume';
  if (COUNT_ALIASES.has(cleanUnit)) return 'count';
  if (PACKAGE_ALIASES.has(cleanUnit)) return 'package';
  if (DISALLOWED_STANDALONE_COUNT_NOUNS.has(cleanUnit)) return 'standalone_count';
  return null;
}

/**
 * 2. Mengonversi kuantitas antar-satuan dua arah yang kompatibel.
 * Validasi ketat dijalankan SEBELUM early return agar kuantitas nol atau satuan identik tidak meloloskan satuan tidak dikenal.
 */
export function convertUnitQuantity(
  amount: number,
  fromUnit: string,
  toUnit: string,
  options?: UnitConversionOptions
): number {
  // STEP 1: Validasi amount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new Error(
      `Kuantitas konversi tidak valid: ${amount}. Kuantitas harus berupa angka berhingga dan >= 0.`
    );
  }

  // STEP 2: Validasi kelengkapan string nama satuan
  if (typeof fromUnit !== 'string' || !fromUnit.trim()) {
    throw new Error('Satuan asal (fromUnit) tidak boleh kosong.');
  }
  if (typeof toUnit !== 'string' || !toUnit.trim()) {
    throw new Error('Satuan tujuan (toUnit) tidak boleh kosong.');
  }

  const cleanFrom = fromUnit.trim().toLowerCase();
  const cleanTo = toUnit.trim().toLowerCase();

  // STEP 3: Validasi satuan terdaftar pada kamus dimensi yang didukung
  const fromDim = resolveUnitDimension(cleanFrom);
  if (!fromDim) {
    throw new Error(`Satuan asal '${fromUnit}' tidak dikenal dalam sistem konversi inventaris.`);
  }

  const toDim = resolveUnitDimension(cleanTo);
  if (!toDim) {
    throw new Error(`Satuan tujuan '${toUnit}' tidak dikenal dalam sistem konversi inventaris.`);
  }

  const itemName = options?.stockName ? ` untuk barang '${options.stockName}'` : '';

  // STEP 4: Validasi kompatibilitas dimensi & faktor konversi yang dipersyaratkan
  const isMassMass = fromDim === 'mass' && toDim === 'mass';
  const isVolVol = fromDim === 'volume' && toDim === 'volume';
  const isCountCount = fromDim === 'count' && toDim === 'count';

  const isCrossMassVolume = (fromDim === 'mass' && toDim === 'volume') || (fromDim === 'volume' && toDim === 'mass');
  const isCrossMassCount = (fromDim === 'mass' && toDim === 'count') || (fromDim === 'count' && toDim === 'mass');
  const isPackageCount = (fromDim === 'package' && toDim === 'count') || (fromDim === 'count' && toDim === 'package');

  // Tolak satuan hitungan beda komoditas (misal butir <-> lembar) jika tidak identik
  if (fromDim === 'standalone_count' || toDim === 'standalone_count') {
    if (cleanFrom !== cleanTo) {
      throw new Error(
        `Satuan hitungan '${fromUnit}' tidak dapat dikonversi ke '${toUnit}'${itemName} tanpa faktor konversi spesifik barang.`
      );
    }
  }

  // Validasi faktor konversi jika lintas dimensi
  if (isCrossMassVolume) {
    const density = options?.densityGramPerMl;
    if (typeof density !== 'number' || !Number.isFinite(density) || density <= 0) {
      throw new Error(
        `Konversi lintas dimensi massa <-> volume antara '${fromUnit}' dan '${toUnit}' membutuhkan faktor densitas (densityGramPerMl) yang valid dan > 0.`
      );
    }
  } else if (isCrossMassCount) {
    const weightPerPiece = options?.weightGramPerPiece;
    if (typeof weightPerPiece !== 'number' || !Number.isFinite(weightPerPiece) || weightPerPiece <= 0) {
      throw new Error(
        `Konversi lintas dimensi massa <-> hitungan antara '${fromUnit}' dan '${toUnit}' membutuhkan faktor berat per butir (weightGramPerPiece) yang valid dan > 0.`
      );
    }
  } else if (isPackageCount) {
    const pieces = options?.piecesPerPackage;
    if (typeof pieces !== 'number' || !Number.isFinite(pieces) || pieces <= 0) {
      throw new Error(
        `Konversi kemasan hitungan '${fromUnit}' <-> '${toUnit}'${itemName} membutuhkan faktor isi kemasan (piecesPerPackage) yang valid dan > 0.`
      );
    }
  } else if (!isMassMass && !isVolVol && !isCountCount && cleanFrom !== cleanTo) {
    throw new Error(
      `Satuan '${fromUnit}' (${fromDim}) tidak kompatibel dengan satuan '${toUnit}' (${toDim})${itemName}.`
    );
  }

  // STEP 5: Early return satuan identik setelah verifikasi kelayakan satuan lolos
  if (cleanFrom === cleanTo) {
    return amount;
  }

  // STEP 6: Early return amount === 0 setelah seluruh kontrak satuan & faktor tervalidasi sah
  if (amount === 0) {
    return 0;
  }

  // STEP 7: Eksekusi konversi matematis dua arah
  let result: number;

  if (isMassMass) {
    const inGram = amount * MASS_UNITS[cleanFrom];
    result = inGram / MASS_UNITS[cleanTo];
  } else if (isVolVol) {
    const inMl = amount * VOLUME_UNITS[cleanFrom];
    result = inMl / VOLUME_UNITS[cleanTo];
  } else if (isCountCount) {
    result = amount;
  } else if (fromDim === 'mass' && toDim === 'volume') {
    const inGram = amount * MASS_UNITS[cleanFrom];
    const inMl = inGram / options!.densityGramPerMl!;
    result = inMl / VOLUME_UNITS[cleanTo];
  } else if (fromDim === 'volume' && toDim === 'mass') {
    const inMl = amount * VOLUME_UNITS[cleanFrom];
    const inGram = inMl * options!.densityGramPerMl!;
    result = inGram / MASS_UNITS[cleanTo];
  } else if (fromDim === 'count' && toDim === 'mass') {
    const inGram = amount * options!.weightGramPerPiece!;
    result = inGram / MASS_UNITS[cleanTo];
  } else if (fromDim === 'mass' && toDim === 'count') {
    const inGram = amount * MASS_UNITS[cleanFrom];
    result = inGram / options!.weightGramPerPiece!;
  } else if (fromDim === 'package' && toDim === 'count') {
    result = amount * options!.piecesPerPackage!;
  } else if (fromDim === 'count' && toDim === 'package') {
    result = amount / options!.piecesPerPackage!;
  } else {
    throw new Error(`Kombinasi konversi dari '${fromUnit}' ke '${toUnit}' belum didukung.`);
  }

  // STEP 8: Overflow guard
  if (!Number.isFinite(result)) {
    throw new Error('Hasil konversi satuan menghasilkan nilai overflow di luar batas numerik.');
  }

  return result;
}

/**
 * 3. Menghitung Weighted Average Cost (WAC) persediaan setelah pembelian baru.
 * Rumus: WAC = ((oldQty * oldUnitCost) + (addedQty * addedUnitCost)) / (oldQty + addedQty)
 *
 * Aturan Ketat:
 * - Seluruh input divalidasi finite dan sah SEBELUM percabangan oldQty === 0.
 * - oldQty < 0 ditolak tegas; tidak dinormalkan diam-diam ke 0.
 * - addedQty wajib > 0.
 * - addedUnitCost >= 0 dan oldUnitCost >= 0.
 * - Presisi desimal penuh dipertahankan (tidak dibulatkan).
 */
export function calculateWeightedAverageCost(params: WACParams): number {
  if (!params || typeof params !== 'object') {
    throw new Error('Parameter WAC harus berupa objek yang valid.');
  }

  const { oldQty, oldUnitCost, addedQty, addedUnitCost } = params;

  // 1. Validasi Tipe & Non-Finite pada seluruh parameter
  if (
    typeof oldQty !== 'number' || !Number.isFinite(oldQty) ||
    typeof oldUnitCost !== 'number' || !Number.isFinite(oldUnitCost) ||
    typeof addedQty !== 'number' || !Number.isFinite(addedQty) ||
    typeof addedUnitCost !== 'number' || !Number.isFinite(addedUnitCost)
  ) {
    throw new Error(
      'Seluruh parameter WAC (oldQty, oldUnitCost, addedQty, addedUnitCost) wajib berupa angka berhingga (finite).'
    );
  }

  // 2. Validasi Pembelian Baru
  if (addedQty <= 0) {
    throw new Error(
      `Kuantitas pembelian baru harus lebih besar dari 0 (diterima: ${addedQty}).`
    );
  }
  if (addedUnitCost < 0) {
    throw new Error(
      `Harga beli satuan baru tidak boleh negatif (diterima: ${addedUnitCost}).`
    );
  }

  // 3. Validasi Stok Awal
  if (oldQty < 0) {
    throw new Error(
      `Kuantitas stok lama tidak boleh bernilai negatif (${oldQty}). Lakukan penyesuaian stok fisik inventaris terlebih dahulu sebelum menghitung weighted average.`
    );
  }
  if (oldUnitCost < 0) {
    throw new Error(
      `Harga modal stok lama tidak boleh bernilai negatif (diterima: ${oldUnitCost}).`
    );
  }

  // 4. Kalkulasi Deterministik
  if (oldQty === 0) {
    return addedUnitCost;
  }

  const oldValue = oldQty * oldUnitCost;
  const addedValue = addedQty * addedUnitCost;
  const totalValue = oldValue + addedValue;
  const totalQty = oldQty + addedQty;

  if (
    !Number.isFinite(oldValue) ||
    !Number.isFinite(addedValue) ||
    !Number.isFinite(totalValue) ||
    !Number.isFinite(totalQty)
  ) {
    throw new Error('Kalkulasi WAC menghasilkan nilai overflow pada perkalian atau penjumlahan.');
  }

  const wac = totalValue / totalQty;

  if (!Number.isFinite(wac)) {
    throw new Error('Kalkulasi WAC menghasilkan nilai overflow pada pembagian.');
  }

  return wac;
}

/**
 * 4. Pembulatan simetris nominal display Rupiah utuh (round half away from zero).
 * HANYA digunakan untuk formatting/display visual UI atau teks laporan ringkas.
 * DILARANG digunakan untuk kalkulasi internal HPP, WAC, atau biaya bahan.
 *
 * Contoh:
 *  +8050.49 -> +8050
 *  +8050.50 -> +8051
 *  -8050.49 -> -8050
 *  -8050.50 -> -8051
 */
export function roundToRupiah(amount: number): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new Error(`Nilai rupiah tidak valid: ${amount}. Nilai harus berupa angka berhingga.`);
  }

  return Math.sign(amount) * Math.round(Math.abs(amount));
}
