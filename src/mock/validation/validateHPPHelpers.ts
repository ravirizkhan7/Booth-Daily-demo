/**
 * BOOTH DAILY — HPP Automation Pure Calculation Helpers Validation Suite (Phase 1)
 *
 * 59 Skenario Pengujian Komprehensif:
 * - Group A (1–12): calculateGrossAmount (waste, rentang, non-finite, overflow)
 * - Group B (13–26): convertUnitQuantity base units & anti-bypass (satuan tidak dikenal, amount=0, identik)
 * - Group C (27–38): convertUnitQuantity cross-dimension, faktor, konversi dua arah & overflow
 * - Group D (39–55): calculateWeightedAverageCost (WAC non-finite tiap parameter, stok awal negatif, pembelian baru, presisi desimal, overflow)
 * - Group E (56–59): roundToRupiah (pembulatan simetris finansial, non-finite) & In-memory Backup Payload dengan waste_percentage
 */

import {
  calculateGrossAmount,
  convertUnitQuantity,
  calculateWeightedAverageCost,
  roundToRupiah,
} from '../../utils/hppCalculation';
import {
  validateBackupPayload,
  BACKUP_FORMAT_VERSION,
  BackupPayload,
} from '../../services/backupService';
import { UserRole } from '../../types';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertApprox(actual: number, expected: number, epsilon = 1e-9) {
  const diff = Math.abs(actual - expected);
  if (diff > epsilon) {
    throw new Error(
      `Nilai numerik tidak cocok. Diharapkan: ${expected}, Aktual: ${actual}, Selisih: ${diff} (Toleransi: ${epsilon})`
    );
  }
}

function assertThrows(fn: () => any, expectedSnippet?: string) {
  let threw = false;
  let thrownError: any = null;
  try {
    fn();
  } catch (err: any) {
    threw = true;
    thrownError = err;
  }

  if (!threw) {
    throw new Error(`Diharapkan fungsi melempar error, namun berhasil dijalankan tanpa error.`);
  }

  if (expectedSnippet && thrownError) {
    const msg = String(thrownError?.message || thrownError);
    if (!msg.toLowerCase().includes(expectedSnippet.toLowerCase())) {
      throw new Error(
        `Pesan error tidak mengandung cuplikan yang diharapkan. Diharapkan mengandung: "${expectedSnippet}", Aktual: "${msg}"`
      );
    }
  }
}

function recordTest(id: string, name: string, fn: () => void) {
  try {
    fn();
    results.push({ id, name, passed: true });
    console.log(`  ✓ [PASS] ${id}: ${name}`);
  } catch (err: any) {
    results.push({ id, name, passed: false, error: err?.message || String(err) });
    console.error(`  ✗ [FAIL] ${id}: ${name} -> ${err?.message || String(err)}`);
  }
}

console.log('================================================================');
console.log('   BOOTH DAILY — HPP PHASE 1: PURE HELPERS VALIDATION SUITE    ');
console.log('   Target: 59 Skenario Pengujian Terverifikasi                 ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// GROUP A: calculateGrossAmount (Skenario 01 - 12)
// -----------------------------------------------------------------------------
console.log('--- GROUP A: calculateGrossAmount (12 Skenario) ---');

recordTest('S01', 'calculateGrossAmount dengan waste 0% menghasilkan nilai bersih sama persis', () => {
  const gross = calculateGrossAmount(100, 0);
  assert(gross === 100, `Diharapkan 100, didapat ${gross}`);
});

recordTest('S02', 'calculateGrossAmount dengan waste undefined secara efektif default ke 0%', () => {
  const gross = calculateGrossAmount(100, undefined);
  assert(gross === 100, `Diharapkan 100, didapat ${gross}`);
});

recordTest('S03', 'calculateGrossAmount dengan waste null secara efektif default ke 0%', () => {
  const gross = calculateGrossAmount(100, null as any);
  assert(gross === 100, `Diharapkan 100, didapat ${gross}`);
});

recordTest('S04', 'calculateGrossAmount dengan nilai waste positif normal (net 90, waste 10% -> 100)', () => {
  const gross = calculateGrossAmount(90, 10);
  assertApprox(gross, 100);
});

recordTest('S05', 'calculateGrossAmount dengan waste desimal mempertahankan presisi penuh (net 100, waste 2.5%)', () => {
  const gross = calculateGrossAmount(100, 2.5);
  // 100 / 0.975 = 102.56410256410257
  assertApprox(gross, 102.56410256410257);
});

recordTest('S06', 'calculateGrossAmount dengan netAmount 0 menghasilkan 0 tanpa error', () => {
  const gross = calculateGrossAmount(0, 15);
  assert(gross === 0, `Diharapkan 0, didapat ${gross}`);
});

recordTest('S07', 'calculateGrossAmount menolak netAmount negatif', () => {
  assertThrows(() => calculateGrossAmount(-10, 5), 'Kuantitas bersih tidak valid');
});

recordTest('S08', 'calculateGrossAmount menolak netAmount non-finite (NaN & Infinity)', () => {
  assertThrows(() => calculateGrossAmount(NaN, 5), 'Kuantitas bersih tidak valid');
  assertThrows(() => calculateGrossAmount(Infinity, 5), 'Kuantitas bersih tidak valid');
  assertThrows(() => calculateGrossAmount(-Infinity, 5), 'Kuantitas bersih tidak valid');
});

recordTest('S09', 'calculateGrossAmount menolak persentase waste negatif', () => {
  assertThrows(() => calculateGrossAmount(100, -5), 'Persentase susut (waste) harus berada pada rentang');
});

recordTest('S10', 'calculateGrossAmount menolak persentase waste >= 100% (mencegah pembagian dengan nol/negatif)', () => {
  assertThrows(() => calculateGrossAmount(100, 100), 'Persentase susut (waste) harus berada pada rentang');
  assertThrows(() => calculateGrossAmount(100, 105), 'Persentase susut (waste) harus berada pada rentang');
});

recordTest('S11', 'calculateGrossAmount menolak persentase waste non-finite (NaN & Infinity)', () => {
  assertThrows(() => calculateGrossAmount(100, NaN), 'Persentase susut (waste) tidak valid');
  assertThrows(() => calculateGrossAmount(100, Infinity), 'Persentase susut (waste) tidak valid');
  assertThrows(() => calculateGrossAmount(100, -Infinity), 'Persentase susut (waste) tidak valid');
});

recordTest('S12', 'calculateGrossAmount mendeteksi dan menolak overflow batas numerik Number.MAX_VALUE', () => {
  assertThrows(() => calculateGrossAmount(Number.MAX_VALUE, 50), 'overflow');
});

// -----------------------------------------------------------------------------
// GROUP B: convertUnitQuantity Base Units & Anti-Bypass (Skenario 13 - 26)
// -----------------------------------------------------------------------------
console.log('\n--- GROUP B: convertUnitQuantity Base Units & Anti-Bypass (14 Skenario) ---');

recordTest('S13', 'convertUnitQuantity konversi massa baku: kg ke gram (1.5 kg -> 1500 g)', () => {
  const result = convertUnitQuantity(1.5, 'kg', 'gram');
  assert(result === 1500, `Diharapkan 1500, didapat ${result}`);
});

recordTest('S14', 'convertUnitQuantity konversi massa baku: ons ke gram (2.5 ons -> 250 g)', () => {
  const result = convertUnitQuantity(2.5, 'ons', 'gram');
  assert(result === 250, `Diharapkan 250, didapat ${result}`);
});

recordTest('S15', 'convertUnitQuantity konversi massa baku: mg ke gram (500 mg -> 0.5 g)', () => {
  const result = convertUnitQuantity(500, 'mg', 'gram');
  assertApprox(result, 0.5);
});

recordTest('S16', 'convertUnitQuantity konversi volume baku: liter ke ml (1.2 liter -> 1200 ml)', () => {
  const result = convertUnitQuantity(1.2, 'liter', 'ml');
  assert(result === 1200, `Diharapkan 1200, didapat ${result}`);
});

recordTest('S17', 'convertUnitQuantity konversi volume baku: dl ke ml (3 dl -> 300 ml)', () => {
  const result = convertUnitQuantity(3, 'dl', 'ml');
  assert(result === 300, `Diharapkan 300, didapat ${result}`);
});

recordTest('S18', 'convertUnitQuantity konversi volume baku: cl ke ml (5 cl -> 50 ml)', () => {
  const result = convertUnitQuantity(5, 'cl', 'ml');
  assert(result === 50, `Diharapkan 50, didapat ${result}`);
});

recordTest('S19', 'convertUnitQuantity konversi alias hitungan: pcs ke buah (10 pcs -> 10 buah)', () => {
  const result = convertUnitQuantity(10, 'pcs', 'buah');
  assert(result === 10, `Diharapkan 10, didapat ${result}`);
});

recordTest('S20', 'convertUnitQuantity anti-bypass: menolak fromUnit atau toUnit berupa string kosong/whitespace', () => {
  assertThrows(() => convertUnitQuantity(10, '', 'gram'), 'Satuan asal (fromUnit) tidak boleh kosong');
  assertThrows(() => convertUnitQuantity(10, '   ', 'gram'), 'Satuan asal (fromUnit) tidak boleh kosong');
  assertThrows(() => convertUnitQuantity(10, 'gram', ''), 'Satuan tujuan (toUnit) tidak boleh kosong');
  assertThrows(() => convertUnitQuantity(10, 'gram', '   '), 'Satuan tujuan (toUnit) tidak boleh kosong');
});

recordTest('S21', 'convertUnitQuantity anti-bypass: menolak satuan tidak dikenal dalam kamus dimensi', () => {
  assertThrows(() => convertUnitQuantity(10, 'meter', 'gram'), 'tidak dikenal');
  assertThrows(() => convertUnitQuantity(10, 'gram', 'invalid_unit'), 'tidak dikenal');
  assertThrows(() => convertUnitQuantity(10, 'xyz', 'abc'), 'tidak dikenal');
});

recordTest('S22', 'convertUnitQuantity anti-bypass: amount 0 tidak boleh meloloskan satuan kosong atau tidak dikenal', () => {
  assertThrows(() => convertUnitQuantity(0, '', 'gram'), 'Satuan asal (fromUnit) tidak boleh kosong');
  assertThrows(() => convertUnitQuantity(0, 'unknown', 'gram'), 'tidak dikenal');
  assertThrows(() => convertUnitQuantity(0, 'gram', 'unknown'), 'tidak dikenal');
  assertThrows(() => convertUnitQuantity(0, 'fake1', 'fake2'), 'tidak dikenal');
});

recordTest('S23', 'convertUnitQuantity anti-bypass: satuan identik yang tidak valid ditolak sebelum early return', () => {
  assertThrows(() => convertUnitQuantity(10, 'invalid_unit', 'invalid_unit'), 'tidak dikenal');
  assertThrows(() => convertUnitQuantity(0, 'invalid_unit', 'invalid_unit'), 'tidak dikenal');
});

recordTest('S24', 'convertUnitQuantity menolak konversi lintas dimensi (massa <-> volume) tanpa densityGramPerMl', () => {
  assertThrows(() => convertUnitQuantity(100, 'gram', 'ml'), 'densityGramPerMl');
  assertThrows(() => convertUnitQuantity(100, 'liter', 'kg'), 'densityGramPerMl');
});

recordTest('S25', 'convertUnitQuantity menolak konversi lintas dimensi (massa <-> hitungan) tanpa weightGramPerPiece', () => {
  assertThrows(() => convertUnitQuantity(100, 'gram', 'pcs'), 'weightGramPerPiece');
  assertThrows(() => convertUnitQuantity(10, 'pcs', 'kg'), 'weightGramPerPiece');
});

recordTest('S26', 'convertUnitQuantity menolak konversi satuan hitungan beda komoditas tanpa faktor spesifik', () => {
  assertThrows(() => convertUnitQuantity(10, 'butir', 'lembar'), 'tanpa faktor konversi spesifik');
  assertThrows(() => convertUnitQuantity(5, 'cup', 'botol'), 'tanpa faktor konversi spesifik');
});

// -----------------------------------------------------------------------------
// GROUP C: convertUnitQuantity Cross-Dimension, Factors, Two-Way & Overflow (Skenario 27 - 38)
// -----------------------------------------------------------------------------
console.log('\n--- GROUP C: convertUnitQuantity Cross-Dimension & Two-Way (12 Skenario) ---');

recordTest('S27', 'convertUnitQuantity massa ke hitungan dengan weightGramPerPiece (600g telur @50g/butir -> 12 pcs)', () => {
  const pcs = convertUnitQuantity(600, 'gram', 'pcs', { weightGramPerPiece: 50, stockName: 'Telur Ayam' });
  assert(pcs === 12, `Diharapkan 12 pcs, didapat ${pcs}`);
});

recordTest('S28', 'convertUnitQuantity hitungan ke massa dengan weightGramPerPiece (12 pcs telur @50g/butir -> 600g)', () => {
  const gram = convertUnitQuantity(12, 'pcs', 'gram', { weightGramPerPiece: 50, stockName: 'Telur Ayam' });
  assert(gram === 600, `Diharapkan 600g, didapat ${gram}`);
});

recordTest('S29', 'convertUnitQuantity volume ke massa dengan densityGramPerMl (500 ml susu @1.03g/ml -> 515g)', () => {
  const gram = convertUnitQuantity(500, 'ml', 'gram', { densityGramPerMl: 1.03, stockName: 'Fresh Milk' });
  assertApprox(gram, 515);
});

recordTest('S30', 'convertUnitQuantity massa ke volume dengan densityGramPerMl (515g susu @1.03g/ml -> 500 ml)', () => {
  const ml = convertUnitQuantity(515, 'gram', 'ml', { densityGramPerMl: 1.03, stockName: 'Fresh Milk' });
  assertApprox(ml, 500);
});

recordTest('S31', 'convertUnitQuantity kemasan (package) ke hitungan (count) dengan piecesPerPackage (2 box @12 -> 24 pcs)', () => {
  const pcs = convertUnitQuantity(2, 'box', 'pcs', { piecesPerPackage: 12, stockName: 'Syrup Botol' });
  assert(pcs === 24, `Diharapkan 24 pcs, didapat ${pcs}`);
});

recordTest('S32', 'convertUnitQuantity hitungan (count) ke kemasan (package) dengan piecesPerPackage (24 pcs @12 -> 2 box)', () => {
  const box = convertUnitQuantity(24, 'pcs', 'box', { piecesPerPackage: 12, stockName: 'Syrup Botol' });
  assert(box === 2, `Diharapkan 2 box, didapat ${box}`);
});

recordTest('S33', 'convertUnitQuantity menolak densityGramPerMl non-finite, nol, atau negatif', () => {
  assertThrows(() => convertUnitQuantity(500, 'ml', 'gram', { densityGramPerMl: 0 }), 'densityGramPerMl');
  assertThrows(() => convertUnitQuantity(500, 'ml', 'gram', { densityGramPerMl: -1.03 }), 'densityGramPerMl');
  assertThrows(() => convertUnitQuantity(500, 'ml', 'gram', { densityGramPerMl: NaN }), 'densityGramPerMl');
  assertThrows(() => convertUnitQuantity(500, 'ml', 'gram', { densityGramPerMl: Infinity }), 'densityGramPerMl');
});

recordTest('S34', 'convertUnitQuantity menolak weightGramPerPiece non-finite, nol, atau negatif', () => {
  assertThrows(() => convertUnitQuantity(10, 'pcs', 'gram', { weightGramPerPiece: 0 }), 'weightGramPerPiece');
  assertThrows(() => convertUnitQuantity(10, 'pcs', 'gram', { weightGramPerPiece: -50 }), 'weightGramPerPiece');
  assertThrows(() => convertUnitQuantity(10, 'pcs', 'gram', { weightGramPerPiece: NaN }), 'weightGramPerPiece');
  assertThrows(() => convertUnitQuantity(10, 'pcs', 'gram', { weightGramPerPiece: Infinity }), 'weightGramPerPiece');
});

recordTest('S35', 'convertUnitQuantity menolak piecesPerPackage non-finite, nol, atau negatif', () => {
  assertThrows(() => convertUnitQuantity(2, 'box', 'pcs', { piecesPerPackage: 0 }), 'piecesPerPackage');
  assertThrows(() => convertUnitQuantity(2, 'box', 'pcs', { piecesPerPackage: -12 }), 'piecesPerPackage');
  assertThrows(() => convertUnitQuantity(2, 'box', 'pcs', { piecesPerPackage: NaN }), 'piecesPerPackage');
  assertThrows(() => convertUnitQuantity(2, 'box', 'pcs', { piecesPerPackage: Infinity }), 'piecesPerPackage');
});

recordTest('S36', 'convertUnitQuantity mengabaikan faktor konversi yang tidak relevan secara aman', () => {
  // Konversi massa-massa (kg -> gram) tidak terpengaruh oleh faktor densitas/kemasan yang disediakan
  const gram = convertUnitQuantity(2, 'kg', 'gram', {
    densityGramPerMl: 99.9,
    weightGramPerPiece: 88.8,
    piecesPerPackage: 77,
  });
  assert(gram === 2000, `Diharapkan 2000, didapat ${gram}`);
});

recordTest('S37', 'convertUnitQuantity konversi bolak-balik mempertahankan identitas numerik (roundtrip)', () => {
  // A. Massa <-> Hitungan: 100g @40g/pcs -> 2.5 pcs -> 100g
  const forwardPcs = convertUnitQuantity(100, 'gram', 'pcs', { weightGramPerPiece: 40 });
  assert(forwardPcs === 2.5, `Diharapkan 2.5 pcs, didapat ${forwardPcs}`);
  const backGram = convertUnitQuantity(forwardPcs, 'pcs', 'gram', { weightGramPerPiece: 40 });
  assert(backGram === 100, `Diharapkan 100g, didapat ${backGram}`);

  // B. Massa <-> Volume: 250g @1.03g/ml -> 242.7184466... ml -> 250g
  const forwardMl = convertUnitQuantity(250, 'gram', 'ml', { densityGramPerMl: 1.03 });
  assertApprox(forwardMl, 242.71844660194176);
  const backFromMl = convertUnitQuantity(forwardMl, 'ml', 'gram', { densityGramPerMl: 1.03 });
  assertApprox(backFromMl, 250);
});

recordTest('S38', 'convertUnitQuantity mendeteksi dan menolak overflow perkalian/pembagian di luar rentang angka berhingga', () => {
  assertThrows(() => convertUnitQuantity(Number.MAX_VALUE, 'kg', 'mg'), 'overflow');
});

// -----------------------------------------------------------------------------
// GROUP D: calculateWeightedAverageCost (WAC) (Skenario 39 - 55)
// -----------------------------------------------------------------------------
console.log('\n--- GROUP D: calculateWeightedAverageCost (17 Skenario) ---');

recordTest('S39', 'calculateWeightedAverageCost menolak oldQty bernilai NaN', () => {
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: NaN, oldUnitCost: 1000, addedQty: 10, addedUnitCost: 1200 }),
    'angka berhingga'
  );
});

recordTest('S40', 'calculateWeightedAverageCost menolak oldQty bernilai Infinity', () => {
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: Infinity, oldUnitCost: 1000, addedQty: 10, addedUnitCost: 1200 }),
    'angka berhingga'
  );
});

recordTest('S41', 'calculateWeightedAverageCost menolak oldUnitCost bernilai NaN', () => {
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: 10, oldUnitCost: NaN, addedQty: 10, addedUnitCost: 1200 }),
    'angka berhingga'
  );
});

recordTest('S42', 'calculateWeightedAverageCost menolak oldUnitCost bernilai Infinity', () => {
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: 10, oldUnitCost: Infinity, addedQty: 10, addedUnitCost: 1200 }),
    'angka berhingga'
  );
});

recordTest('S43', 'calculateWeightedAverageCost menolak addedQty bernilai NaN', () => {
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: 10, oldUnitCost: 1000, addedQty: NaN, addedUnitCost: 1200 }),
    'angka berhingga'
  );
});

recordTest('S44', 'calculateWeightedAverageCost menolak addedQty bernilai Infinity', () => {
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: 10, oldUnitCost: 1000, addedQty: Infinity, addedUnitCost: 1200 }),
    'angka berhingga'
  );
});

recordTest('S45', 'calculateWeightedAverageCost menolak addedUnitCost bernilai NaN', () => {
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: 10, oldUnitCost: 1000, addedQty: 10, addedUnitCost: NaN }),
    'angka berhingga'
  );
});

recordTest('S46', 'calculateWeightedAverageCost menolak addedUnitCost bernilai Infinity', () => {
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: 10, oldUnitCost: 1000, addedQty: 10, addedUnitCost: Infinity }),
    'angka berhingga'
  );
});

recordTest('S47', 'calculateWeightedAverageCost menolak addedQty <= 0 (pembelian baru wajib positif)', () => {
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: 10, oldUnitCost: 1000, addedQty: 0, addedUnitCost: 1200 }),
    'lebih besar dari 0'
  );
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: 10, oldUnitCost: 1000, addedQty: -5, addedUnitCost: 1200 }),
    'lebih besar dari 0'
  );
});

recordTest('S48', 'calculateWeightedAverageCost menolak addedUnitCost < 0', () => {
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: 10, oldUnitCost: 1000, addedQty: 5, addedUnitCost: -100 }),
    'tidak boleh negatif'
  );
});

recordTest('S49', 'calculateWeightedAverageCost menolak oldQty < 0 secara ketat (tidak menormalkan diam-diam ke 0)', () => {
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: -10, oldUnitCost: 1000, addedQty: 20, addedUnitCost: 1500 }),
    'Kuantitas stok lama tidak boleh bernilai negatif'
  );
});

recordTest('S50', 'calculateWeightedAverageCost menolak oldUnitCost < 0', () => {
  assertThrows(
    () => calculateWeightedAverageCost({ oldQty: 10, oldUnitCost: -500, addedQty: 10, addedUnitCost: 1200 }),
    'Harga modal stok lama tidak boleh bernilai negatif'
  );
});

recordTest('S51', 'calculateWeightedAverageCost pembelian awal (oldQty === 0) mengembalikan addedUnitCost secara deterministik', () => {
  const wac = calculateWeightedAverageCost({
    oldQty: 0,
    oldUnitCost: 0,
    addedQty: 100,
    addedUnitCost: 5000,
  });
  assert(wac === 5000, `Diharapkan 5000, didapat ${wac}`);
});

recordTest('S52', 'calculateWeightedAverageCost kalkulasi normal berbobot seimbang (10 @1000 + 10 @2000 -> 1500)', () => {
  const wac = calculateWeightedAverageCost({
    oldQty: 10,
    oldUnitCost: 1000,
    addedQty: 10,
    addedUnitCost: 2000,
  });
  assert(wac === 1500, `Diharapkan 1500, didapat ${wac}`);
});

recordTest('S53', 'calculateWeightedAverageCost kalkulasi bobot tidak seimbang (20 @1000 + 10 @2500 -> 1500)', () => {
  // (20*1000 + 10*2500) / 30 = (20000 + 25000) / 30 = 45000 / 30 = 1500
  const wac = calculateWeightedAverageCost({
    oldQty: 20,
    oldUnitCost: 1000,
    addedQty: 10,
    addedUnitCost: 2500,
  });
  assert(wac === 1500, `Diharapkan 1500, didapat ${wac}`);
});

recordTest('S54', 'calculateWeightedAverageCost mempertahankan presisi desimal internal tanpa pembulatan prematur', () => {
  // (3 * 1000 + 4 * 1200) / 7 = (3000 + 4800) / 7 = 7800 / 7 = 1114.2857142857142...
  const wac = calculateWeightedAverageCost({
    oldQty: 3,
    oldUnitCost: 1000,
    addedQty: 4,
    addedUnitCost: 1200,
  });
  const expected = 7800 / 7;
  assertApprox(wac, expected);
  assert(wac !== 1114, 'Presisi desimal tidak boleh dibulatkan dini menjadi bilangan bulat!');
});

recordTest('S55', 'calculateWeightedAverageCost mendeteksi dan menolak overflow perkalian/penjumlahan batas numerik', () => {
  assertThrows(
    () =>
      calculateWeightedAverageCost({
        oldQty: Number.MAX_VALUE,
        oldUnitCost: 2,
        addedQty: 10,
        addedUnitCost: 1000,
      }),
    'overflow'
  );
});

// -----------------------------------------------------------------------------
// GROUP E: roundToRupiah & In-Memory Backup Validation (Skenario 56 - 59)
// -----------------------------------------------------------------------------
console.log('\n--- GROUP E: roundToRupiah & In-Memory Backup (4 Skenario) ---');

recordTest('S56', 'roundToRupiah pembulatan positif standar (8050.49 -> 8050, 8050.50 -> 8051)', () => {
  assert(roundToRupiah(8050.49) === 8050, `8050.49 harus dibulatkan ke 8050`);
  assert(roundToRupiah(8050.50) === 8051, `8050.50 harus dibulatkan ke 8051`);
  assert(roundToRupiah(8050.00) === 8050, `8050.00 harus tetap 8050`);
});

recordTest('S57', 'roundToRupiah pembulatan simetris finansial untuk nilai negatif (-8050.49 -> -8050, -8050.50 -> -8051)', () => {
  assert(roundToRupiah(-8050.49) === -8050, `-8050.49 harus dibulatkan ke -8050`);
  assert(roundToRupiah(-8050.50) === -8051, `-8050.50 harus dibulatkan simetris ke -8051 (round half away from zero)`);
});

recordTest('S58', 'roundToRupiah menolak nilai non-finite (NaN & Infinity)', () => {
  assertThrows(() => roundToRupiah(NaN), 'Nilai rupiah tidak valid');
  assertThrows(() => roundToRupiah(Infinity), 'Nilai rupiah tidak valid');
  assertThrows(() => roundToRupiah(-Infinity), 'Nilai rupiah tidak valid');
});

recordTest('S59', 'In-memory backup payload validation mendukung RecipeIngredient dengan dan tanpa waste_percentage tanpa mutasi storage', () => {
  const inMemoryPayload: BackupPayload = {
    format: 'booth_daily_encrypted_payload',
    version: BACKUP_FORMAT_VERSION,
    timestamp: new Date().toISOString(),
    store: {
      users: [
        {
          id: 'user_owner_01',
          name: 'Owner Toko',
          email: 'owner@boothdaily.com',
          role: 'owner' as UserRole,
          pin: '9999',
          is_active: true,
        },
      ],
      categories: [
        { id: 'cat_01', name: 'Coffee', slug: 'coffee', icon_name: 'coffee' },
      ],
      products: [
        {
          id: 'prod_01',
          category_id: 'cat_01',
          name: 'Kopi Susu Gula Aren',
          price: 18000,
          cost_price: 8000,
          image_url: '',
          description: '',
          is_active: true,
          is_favorite: true,
        },
        {
          id: 'prod_02',
          category_id: 'cat_01',
          name: 'Americano Klasik',
          price: 15000,
          cost_price: 5000,
          image_url: '',
          description: '',
          is_active: true,
          is_favorite: false,
        },
      ],
      stocks: [
        {
          id: 'stock_01',
          name: 'Biji Kopi Espresso Blend',
          current_amount: 5000,
          min_amount: 500,
          unit: 'Gram',
          cost_per_unit: 150,
        },
        {
          id: 'stock_02',
          name: 'Fresh Milk Pasteurisasi',
          current_amount: 10000,
          min_amount: 1000,
          unit: 'ml',
          cost_per_unit: 20,
        },
      ],
      recipes: [
        // Resep 1: Resep legacy TANPA waste_percentage (kompatibel, default 0%)
        {
          id: 'recipe_01',
          product_id: 'prod_01',
          prep_time_minutes: 3,
          image_url: '',
          description: 'Resep lama tanpa waste field',
          ingredients: [
            {
              id: 'ing_01',
              stock_id: 'stock_01',
              stock_name: 'Biji Kopi Espresso Blend',
              amount: 18,
              unit: 'Gram',
              // waste_percentage sengaja dihilangkan untuk menguji kompatibilitas data lama
            },
            {
              id: 'ing_02',
              stock_id: 'stock_02',
              stock_name: 'Fresh Milk Pasteurisasi',
              amount: 120,
              unit: 'ml',
            },
          ],
          steps: [{ step_number: 1, instruction: 'Seduh espresso dan campur susu' }],
        },
        // Resep 2: Resep baru DENGAN waste_percentage eksplisit (misal 5% susut giling biji kopi)
        {
          id: 'recipe_02',
          product_id: 'prod_02',
          prep_time_minutes: 2,
          image_url: '',
          description: 'Resep baru dengan waste_percentage eksplisit',
          ingredients: [
            {
              id: 'ing_03',
              stock_id: 'stock_01',
              stock_name: 'Biji Kopi Espresso Blend',
              amount: 18,
              unit: 'Gram',
              waste_percentage: 5, // Field baru Fase 1
            },
          ],
          steps: [{ step_number: 1, instruction: 'Ekstraksi espresso dan tambahkan air' }],
        },
      ],
      discountRules: [],
      shifts: [],
      orders: [],
      stockHistories: [],
      purchases: [],
      expenses: [],
      activeShiftId: null,
      settings: {
        store_name: 'Booth Daily Test Lab',
        tagline: 'Authentic Specialty Coffee',
        address: 'Jl. Uji Kualitas No. 1',
        phone: '08123456789',
        receipt_header: 'Selamat Menikmati',
        receipt_footer: 'Terima Kasih',
        tax_percentage: 10,
        service_charge_percentage: 0,
        currency_symbol: 'Rp',
        operational_day_cutoff_time: '04:00',
      },
    },
    media: {
      app_logo: null,
      printer_logo: null,
    },
  };

  // Validasi payload in-memory melalui fungsi validator resmi
  const validated = validateBackupPayload(inMemoryPayload);
  assert(Boolean(validated), 'Payload cadangan harus berhasil divalidasi');
  assert(validated.store.recipes.length === 2, 'Harus memuat tepat 2 resep');

  // Pastikan bahan legacy tidak memiliki waste_percentage dan bahan baru memilikinya
  const legacyIng = validated.store.recipes[0].ingredients[0];
  const newIng = validated.store.recipes[1].ingredients[0];
  assert(legacyIng.waste_percentage === undefined, 'Bahan legacy harus memiliki waste_percentage undefined');
  assert(newIng.waste_percentage === 5, 'Bahan baru harus memiliki waste_percentage 5%');

  // Konfirmasi bahwa fungsi kalkulasi memperlakukan legacy sebagai 0% secara efektif
  const legacyGross = calculateGrossAmount(legacyIng.amount, legacyIng.waste_percentage);
  assert(legacyGross === 18, `Kuantitas bruto bahan legacy harus tepat 18, didapat ${legacyGross}`);

  const newGross = calculateGrossAmount(newIng.amount, newIng.waste_percentage);
  // 18 / 0.95 = 18.94736842105263
  assertApprox(newGross, 18.94736842105263);
});

// -----------------------------------------------------------------------------
// REKAPITULASI DAN EVALUASI AKHIR
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log('                 REKAPITULASI HASIL PENGUJIAN                   ');
console.log('================================================================');

const total = results.length;
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;

console.log(`Total Skenario Diuji : ${total} (Target: 59)`);
console.log(`Jumlah Lulus (PASS)  : ${passed}`);
console.log(`Jumlah Gagal (FAIL)  : ${failed}`);

if (failed > 0) {
  console.error('\nDAFTAR SKENARIO YANG GAGAL:');
  results
    .filter((r) => !r.passed)
    .forEach((r) => {
      console.error(`- [${r.id}] ${r.name}: ${r.error}`);
    });
  process.exit(1);
} else if (total !== 59) {
  console.error(`\nPERINGATAN: Jumlah skenario (${total}) tidak tepat 59!`);
  process.exit(1);
} else {
  console.log('\nSEMUA 59 SKENARIO HPP FASE 1 LULUS DENGAN SUKSES! (100% PASS)');
  process.exit(0);
}
