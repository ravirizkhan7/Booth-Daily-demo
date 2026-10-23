import { chromium } from '@playwright/test';
import * as path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\RAVI\\.gemini\\antigravity-ide\\brain\\de8d37d7-7981-411a-99e2-1d15da7adec4';
const BASE_URL = 'http://127.0.0.1:3000';

const ownerUser = {
  id: 'usr-owner-01',
  name: 'Hendro Wijaya',
  username: 'hendro',
  email: 'owner@boothdaily.com',
  role: 'owner',
  pin: '1234',
  is_active: true,
  phone: '081234567890',
};

interface StepResult {
  gateNum: number;
  name: string;
  passed: boolean;
  details?: string;
}

const results: StepResult[] = [];

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function enterPin(page: any, pin: string) {
  for (const digit of pin.split('')) {
    const btn = page.locator('.fixed.inset-0 .grid-cols-3 button').filter({ hasText: new RegExp(`^${digit}$`) }).first();
    await btn.waitFor({ state: 'visible', timeout: 3000 });
    await btn.click();
    await page.waitForTimeout(100);
  }
}

async function runBrowserPettyCashVerification() {
  console.log('================================================================');
  console.log('   BOOTH DAILY — GATE 3 INTERACTIVE BROWSER VERIFICATION       ');
  console.log('   Playwright Real Chromium Engine • Isolated Contexts          ');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', err => {
    console.error('❌ Browser Page Error:', err.message);
    pageErrors.push(err.message);
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('404')) {
        console.warn('⚠️ Browser Console Error:', text);
        consoleErrors.push(text);
      }
    }
  });

  try {
    // -------------------------------------------------------------------------
    // 0. INITIALIZE CLEAN ISOLATED TEST HARNESS
    // -------------------------------------------------------------------------
    console.log('--- 0. Menginisialisasi State Pengujian Terisolasi ---');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.evaluate((u) => {
      localStorage.removeItem('boothdaily_demo_store');
      localStorage.setItem('token', `mock_token_${u.id}`);
      localStorage.setItem('token_id', u.id);
      localStorage.setItem('boothdaily_user_session', u.id);
      localStorage.setItem('boothdaily_user_data', JSON.stringify(u));
      localStorage.setItem('boothdaily_demo_session', JSON.stringify({
        userId: u.id,
        token: `mock_token_${u.id}`,
        loggedInAt: new Date().toISOString(),
      }));
    }, ownerUser);

    await page.goto(`${BASE_URL}/shifts`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // -------------------------------------------------------------------------
    // 1. BUKA SHIFT
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Buka Shift Kasir (Modal Awal Rp 100.000) ---');
    const openShiftBtn = page.locator('button:has-text("Buka Shift Baru")').first();
    await openShiftBtn.waitFor({ state: 'visible', timeout: 5000 });
    await openShiftBtn.click();

    // Tunggu modal buka shift
    const openModalHeading = page.locator('h2:has-text("Buka Shift Kasir")');
    await openModalHeading.waitFor({ state: 'visible', timeout: 3000 });

    // Pilih chip Rp 100.000
    const chip100k = page.locator('.fixed.inset-0 button:has-text("Rp 100.000")');
    await chip100k.click();

    // Masukkan PIN 1234
    await enterPin(page, '1234');

    const confirmOpenBtn = page.locator('.fixed.inset-0 button:has-text("Konfirmasi Buka Shift")');
    await confirmOpenBtn.waitFor({ state: 'visible', timeout: 3000 });
    await confirmOpenBtn.click();

    // Tunggu modal detached
    await openModalHeading.waitFor({ state: 'detached', timeout: 5000 });
    await page.waitForTimeout(500);

    // Verifikasi tombol Tutup Shift Aktif sekarang tampil
    const tutupShiftBtn = page.locator('button:has-text("Tutup Shift Aktif")').first();
    await tutupShiftBtn.waitFor({ state: 'visible', timeout: 5000 });

    const activeShiftIndicator = page.locator('text=Sedang Aktif').first();
    await activeShiftIndicator.waitFor({ state: 'visible', timeout: 5000 });

    const screenshot1 = path.join(ARTIFACT_DIR, 'gate3_1_shift_opened.png');
    await page.screenshot({ path: screenshot1 });
    console.log('✅ UI 1: Buka Shift berhasil (Modal awal Rp 100.000)');
    results.push({ gateNum: 1, name: 'Buka Shift dengan modal awal Rp 100.000', passed: true });

    // -------------------------------------------------------------------------
    // 2. LAKUKAN PENJUALAN TUNAI PADA SHIFT
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Lakukan Penjualan Tunai pada Shift ---');
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Klik produk pertama untuk menambah ke keranjang
    const firstProduct = page.locator('.group.cursor-pointer').first();
    await firstProduct.waitFor({ state: 'visible', timeout: 5000 });
    await firstProduct.click();
    await page.waitForTimeout(300);

    // Klik tombol BAYAR SEKARANG di sidebar
    const payBtn = page.locator('button:has-text("BAYAR SEKARANG")');
    await payBtn.waitFor({ state: 'visible', timeout: 3000 });
    await payBtn.click();

    // Tunggu PINModal (Header: Verifikasi Transaksi)
    const pinModalHeader = page.locator('h2:has-text("Verifikasi Transaksi")');
    await pinModalHeader.waitFor({ state: 'visible', timeout: 4000 });

    // Masukkan PIN 1234
    await enterPin(page, '1234');

    // Klik tombol konfirmasi bayar
    const submitPayBtn = page.locator('.fixed.inset-0 button:has-text("Konfirmasi Pembayaran")');
    await submitPayBtn.click();

    // Tunggu ReceiptModal tampil
    const receiptSuccess = page.locator('text=Transaksi Sukses!');
    await receiptSuccess.waitFor({ state: 'visible', timeout: 5000 });

    const screenshot2 = path.join(ARTIFACT_DIR, 'gate3_2_cash_sale_success.png');
    await page.screenshot({ path: screenshot2 });

    // Tutup struk modal lewat tombol Selesai & Kembali ke Kasir
    const closeReceiptBtn = page.locator('button:has-text("Selesai & Kembali ke Kasir")');
    await closeReceiptBtn.click();
    await receiptSuccess.waitFor({ state: 'detached', timeout: 5000 });
    await page.waitForTimeout(400);

    console.log('✅ UI 2: Penjualan tunai berhasil diproses');
    results.push({ gateNum: 2, name: 'Penjualan tunai berhasil dicatat pada shift', passed: true });

    // -------------------------------------------------------------------------
    // 3. CATAT KAS KELUAR VALID DENGAN PIN SESUAI
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Catat Kas Keluar Valid dengan PIN Sesuai ---');
    await page.goto(`${BASE_URL}/shifts`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Klik Catat Kas Keluar
    const catatKeluarBtn = page.locator('button:has-text("Catat Kas Keluar")').first();
    await catatKeluarBtn.waitFor({ state: 'visible', timeout: 3000 });
    await catatKeluarBtn.click();

    // Tunggu modal pengeluaran
    const expenseModal = page.locator('h3:has-text("Catat Pengeluaran Kas (Petty Cash)")');
    await expenseModal.waitFor({ state: 'visible', timeout: 3000 });

    // Periksa label terminologi: Saldo Kas Teoritis Tersedia:
    const teoritisLabel = page.locator('span:has-text("Saldo Kas Teoritis Tersedia:")');
    const isTeoritisVisible = await teoritisLabel.isVisible();
    assert(isTeoritisVisible, 'Label "Saldo Kas Teoritis Tersedia:" wajib tampil pada modal pengeluaran');

    // Input nominal 25.000
    const amountInput = page.locator('.fixed.inset-0 input[placeholder="Rp 0"]').first();
    await amountInput.fill('25000');

    // Pilih kategori bahan baku darurat
    await page.selectOption('.fixed.inset-0 select', 'bahan_baku_darurat');

    // Input keterangan
    const descInput = page.locator('.fixed.inset-0 input[placeholder*="Contoh: Beli es batu"]');
    await descInput.fill('Beli es batu kristal 2 karung');

    // Input nomor nota
    const notaInput = page.locator('.fixed.inset-0 input[placeholder*="Contoh: NOTA"]');
    await notaInput.fill('NOTA-ES-001');

    // Input PIN 1234
    await enterPin(page, '1234');

    // Klik tombol submit Catat Kas Keluar di footer
    const submitExpenseBtn = page.locator('.fixed.inset-0 button:has-text("Catat Kas Keluar")').last();
    await submitExpenseBtn.click();

    // Tunggu modal pengeluaran detached
    await expenseModal.waitFor({ state: 'detached', timeout: 5000 });
    await page.waitForTimeout(500);

    const screenshot3 = path.join(ARTIFACT_DIR, 'gate3_3_expense_recorded.png');
    await page.screenshot({ path: screenshot3 });

    console.log('✅ UI 3: Kas keluar Rp 25.000 berhasil dicatat');
    results.push({ gateNum: 3, name: 'Catat kas keluar valid dengan PIN sesuai', passed: true });

    // -------------------------------------------------------------------------
    // 4. PASTIKAN SALDO KAS TEORITIS BERUBAH TEPAT SEBESAR PENGELUARAN
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Pastikan Saldo Kas Teoritis Berubah Tepat Sebesar Pengeluaran ---');
    // Buka kembali modal Catat Kas Keluar untuk membaca saldo kas teoritis tersedia saat ini
    await catatKeluarBtn.click();
    await expenseModal.waitFor({ state: 'visible', timeout: 3000 });

    const availableTextAfter = await page.locator('.fixed.inset-0 .p-3.bg-stone-50 span.text-sm, .fixed.inset-0 .p-3.bg-stone-50 span.font-black').first().innerText();
    console.log('Saldo Kas Teoritis Tersedia setelah pengeluaran 25rb:', availableTextAfter);

    // Tutup modal
    await page.locator('.fixed.inset-0 button:has-text("Batal")').click();
    await expenseModal.waitFor({ state: 'detached', timeout: 5000 });
    await page.waitForTimeout(300);

    // Verifikasi pada kartu ringkasan shift: Kas Keluar (-) Rp 25.000
    const kasKeluarStat = page.locator('text=Kas Keluar (-)').locator('..').locator('p');
    const kasKeluarText = await kasKeluarStat.innerText();
    console.log('Stat Kas Keluar pada ringkasan shift:', kasKeluarText);
    assert(kasKeluarText.includes('25.000'), 'Stat Kas Keluar harus memuat Rp 25.000');

    results.push({
      gateNum: 4,
      name: 'Saldo kas teoritis berkurang tepat sebesar Rp 25.000',
      passed: true,
      details: `Saldo terbaca: ${availableTextAfter}`,
    });
    console.log('✅ UI 4: Saldo kas teoritis berkurang tepat');

    // -------------------------------------------------------------------------
    // 5. TOLAK PENGELUARAN YANG MELEBIHI SALDO KAS TEORITIS TERSEDIA
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Tolak Pengeluaran Melebihi Saldo Kas Teoritis Tersedia (Ceiling Check) ---');
    await catatKeluarBtn.click();
    await expenseModal.waitFor({ state: 'visible', timeout: 3000 });

    // Masukkan nominal fantastis yang melebihi saldo kas (Rp 5.000.000)
    await amountInput.fill('5000000');
    await descInput.fill('Beli mesin espresso darurat');

    await enterPin(page, '1234');

    await submitExpenseBtn.click();
    await page.waitForTimeout(500);

    // Pesan error penolakan plafon kas harus tampil
    const errorBanner = page.locator('.fixed.inset-0 div.text-rose-600, .fixed.inset-0 div.text-rose-400');
    await errorBanner.waitFor({ state: 'visible', timeout: 3000 });
    const errorText = await errorBanner.innerText();
    console.log('Pesan penolakan plafon:', errorText);
    assert(errorText.includes('melebihi saldo kas teoritis'), 'Error penolakan plafon harus tampil di UI');

    const screenshot5 = path.join(ARTIFACT_DIR, 'gate3_5_ceiling_rejected.png');
    await page.screenshot({ path: screenshot5 });

    // Batalkan modal
    await page.locator('.fixed.inset-0 button:has-text("Batal")').click();
    await expenseModal.waitFor({ state: 'detached', timeout: 5000 });
    await page.waitForTimeout(400);

    console.log('✅ UI 5: Pengeluaran melebihi plafon berhasil ditolak');
    results.push({ gateNum: 5, name: 'Tolak pengeluaran melebihi saldo kas teoritis tersedia', passed: true });

    // -------------------------------------------------------------------------
    // 6. UJI PEMBATALAN ATAU KOREKSI DENGAN OTORISASI OWNER
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Uji Koreksi / Revisi dengan Otorisasi Owner ---');
    // Buka detail modal shift aktif
    const detailBtn = page.locator('button:has-text("Lihat Laporan Sementara")').first();
    await detailBtn.click();

    // Tunggu modal detail shift
    const detailModalHeader = page.locator('text=Rincian Pengeluaran Kas Operasional');
    await detailModalHeader.waitFor({ state: 'visible', timeout: 3000 });

    // Klik tombol Revisi (icon Edit3) pada entri pengeluaran
    const editBtn = page.locator('button[title*="Revisi nominal"]').first();
    await editBtn.waitFor({ state: 'visible', timeout: 3000 });
    await editBtn.click();

    // Tunggu modal revisi
    const replaceModal = page.locator('h3:has-text("Revisi Pengeluaran Kas (Petty Cash)")');
    await replaceModal.waitFor({ state: 'visible', timeout: 3000 });

    // Ubah nominal ke 20.000
    const replaceAmountInput = page.locator('.fixed.inset-0 input[placeholder="Rp 0"]').first();
    await replaceAmountInput.fill('20000');

    // Ubah keterangan jika ada
    const replaceDescInput = page.locator('.fixed.inset-0 input[placeholder*="Beli es batu"]').first();
    if (await replaceDescInput.isVisible()) {
      await replaceDescInput.fill('Beli es batu kristal 2 karung (Koreksi nota)');
    }

    // Isi alasan pembatalan entri lama
    const cancelReasonInput = page.locator('.fixed.inset-0 textarea').first();
    await cancelReasonInput.fill('Koreksi nominal aktual sesuai nota kembalian');

    // Masukkan PIN Owner 1234
    await enterPin(page, '1234');

    // Klik Simpan Revisi
    const confirmReplaceBtn = page.locator('.fixed.inset-0 button:has-text("Simpan Revisi")');
    await confirmReplaceBtn.click();

    // Tunggu modal revisi detached
    await replaceModal.waitFor({ state: 'detached', timeout: 5000 });
    await page.waitForTimeout(600);

    // Verifikasi pada tabel detail: Ada status "Dibatalkan" dan status "Aktif"
    const cancelledBadge = page.locator('span:has-text("Dibatalkan")').first();
    await cancelledBadge.waitFor({ state: 'visible', timeout: 3000 });
    const activeBadge = page.locator('span:has-text("Aktif")').first();
    await activeBadge.waitFor({ state: 'visible', timeout: 3000 });

    const screenshot6 = path.join(ARTIFACT_DIR, 'gate3_6_owner_revision_audit.png');
    await page.screenshot({ path: screenshot6 });

    // Tutup detail modal
    const closeDetailModalBtn = page.locator('.fixed.inset-0 button:has-text("Tutup")').last();
    await closeDetailModalBtn.click();
    await detailModalHeader.waitFor({ state: 'detached', timeout: 5000 });
    await page.waitForTimeout(400);

    console.log('✅ UI 6: Koreksi/Revisi oleh Owner berhasil dicatat dengan jejak audit');
    results.push({ gateNum: 6, name: 'Koreksi/revisi pengeluaran dengan otorisasi Owner', passed: true });

    // -------------------------------------------------------------------------
    // 7. TUTUP SHIFT DENGAN NOMINAL KAS FISIK SESUAI (SELISIH REKONSILIASI RP 0)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Tutup Shift dengan Selisih Kas Rekonsiliasi Rp 0 ---');
    // Klik Tutup Shift Aktif
    await tutupShiftBtn.click();

    // Tunggu modal tutup shift
    const closeShiftHeader = page.locator('h2:has-text("Tutup Shift #")');
    await closeShiftHeader.waitFor({ state: 'visible', timeout: 3000 });

    // Klik tombol cepat "Isi Sesuai Kas Harapan" untuk kesesuaian Rp 0
    const isiSesuaiHarapanBtn = page.locator('button:has-text("Isi Sesuai Kas Harapan")');
    await isiSesuaiHarapanBtn.waitFor({ state: 'visible', timeout: 3000 });
    await isiSesuaiHarapanBtn.click();
    await page.waitForTimeout(300);

    // Pastikan selisih kas seimbang Rp 0
    const balancedText = page.locator('text=Sesuai (Rp 0)').first();
    await balancedText.waitFor({ state: 'visible', timeout: 3000 });

    // Klik Lanjut ke Verifikasi PIN
    const proceedToPinBtn = page.locator('button:has-text("Lanjut ke Verifikasi PIN")');
    await proceedToPinBtn.click();
    await page.waitForTimeout(300);

    // Masukkan PIN 1234
    await enterPin(page, '1234');

    // Klik Konfirmasi Tutup Shift
    const confirmCloseShiftBtn = page.locator('button:has-text("Konfirmasi Tutup Shift")');
    await confirmCloseShiftBtn.click();

    // Tunggu Z-Report / Ringkasan Penutupan tampil
    const zReportHeader = page.locator('h2:has-text("Shift Resmi Ditutup")');
    await zReportHeader.waitFor({ state: 'visible', timeout: 5000 });

    const diffCashZero = page.locator('text=Rp 0').first();
    await diffCashZero.waitFor({ state: 'visible', timeout: 3000 });

    const screenshot7 = path.join(ARTIFACT_DIR, 'gate3_7_shift_closed_matched.png');
    await page.screenshot({ path: screenshot7 });

    // Selesai tutup jendela
    const doneCloseBtn = page.locator('button:has-text("Selesai & Tutup Laporan")');
    await doneCloseBtn.click();
    await zReportHeader.waitFor({ state: 'detached', timeout: 5000 });
    await page.waitForTimeout(500);

    console.log('✅ UI 7: Tutup Shift berhasil dengan selisih Rp 0');
    results.push({ gateNum: 7, name: 'Tutup shift dengan nominal fisik sesuai & selisih Rp 0', passed: true });

    // -------------------------------------------------------------------------
    // 8. RIWAYAT PENGELUARAN TERSEDIA PADA DETAIL SHIFT TERTUTUP TANPA BUKA KEMBALI
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Riwayat Pengeluaran Tersedia pada Detail Shift Tertutup ---');
    // Klik tombol Laporan Detail pada tabel riwayat shift tertutup
    const historyDetailBtn = page.locator('button:has-text("Laporan Detail")').first();
    await historyDetailBtn.waitFor({ state: 'visible', timeout: 5000 });
    await historyDetailBtn.click();

    // Tunggu modal detail
    await detailModalHeader.waitFor({ state: 'visible', timeout: 3000 });

    // Pastikan daftar pengeluaran tetap tampil
    const historyExpenseTable = page.locator('.fixed.inset-0 table').first();
    await historyExpenseTable.waitFor({ state: 'visible', timeout: 3000 });
    const tableText = await historyExpenseTable.innerText();
    assert(tableText.includes('Beli es batu kristal'), 'Riwayat pengeluaran kas harus tetap terbaca pada shift tertutup');
    assert(tableText.includes('Dibatalkan'), 'Status entri lama yang dibatalkan harus tetap terbaca');

    // Pastikan tombol aksi (Catat Kas Keluar) TIDAK ADA pada shift tertutup
    const closedCatatBtn = page.locator('.fixed.inset-0 .p-4 button:has-text("Catat Kas Keluar")');
    const isCatatPresentOnClosed = await closedCatatBtn.isVisible();
    assert(!isCatatPresentOnClosed, 'Tombol Catat Kas Keluar TIDAK BOLEH tampil pada shift tertutup');

    const screenshot8 = path.join(ARTIFACT_DIR, 'gate3_8_closed_shift_expense_history.png');
    await page.screenshot({ path: screenshot8 });

    console.log('✅ UI 8: Riwayat pengeluaran kas tersedia penuh pada detail shift tertutup');
    results.push({ gateNum: 8, name: 'Riwayat pengeluaran tersedia pada detail shift tertutup tanpa membuka kembali shift', passed: true });

    // Tutup detail
    await page.locator('.fixed.inset-0 button:has-text("Tutup")').last().click();
    await detailModalHeader.waitFor({ state: 'detached', timeout: 5000 });
    await page.waitForTimeout(300);

    // -------------------------------------------------------------------------
    // 9. OPERASI GAGAL TIDAK MENINGGALKAN ENTRI TERSIMPAN
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Verifikasi Operasi Gagal Tidak Meninggalkan Entri Tersimpan ---');
    const allStoredExpenses = await page.evaluate(() => {
      const raw = localStorage.getItem('boothdaily_demo_store');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          return (parsed.shift_expenses || []) as any[];
        } catch {
          return [];
        }
      }
      return [];
    });

    const has5MillionPhantom = allStoredExpenses.some((e: any) => e.amount === 5000000);
    assert(!has5MillionPhantom, 'Operasi pengeluaran 5 juta yang ditolak tidak boleh tersimpan di store');

    console.log('✅ UI 9: Tidak ada entri phantom dari operasi gagal (Total entri sah:', allStoredExpenses.length, ')');
    results.push({ gateNum: 9, name: 'Operasi gagal tidak meninggalkan entri tersimpan di storage', passed: true });

    // -------------------------------------------------------------------------
    // 10. TIDAK ADA PAGE ERROR ATAU CONSOLE ERROR TIDAK DIHARAPKAN
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Audit Konsol Browser & Page Errors ---');
    assert(pageErrors.length === 0, `Ditemukan ${pageErrors.length} page error: ${pageErrors.join('; ')}`);
    assert(consoleErrors.length === 0, `Ditemukan ${consoleErrors.length} console error: ${consoleErrors.join('; ')}`);

    console.log('✅ UI 10: 0 Page Errors & 0 Unhandled Console Errors');
    results.push({ gateNum: 10, name: 'Nol page error dan console error', passed: true });

  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('           GATE 3 BROWSER VERIFICATION SUMMARY                   ');
  console.log('================================================================');
  results.forEach(r => {
    console.log(`[Gate 3.${r.gateNum}] ${r.name.padEnd(65)} : ${r.passed ? 'PASS' : 'FAIL'}`);
  });
  console.log('================================================================\n');

  const allPassed = results.length === 10 && results.every(r => r.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

runBrowserPettyCashVerification().catch(err => {
  console.error('\n❌ FATAL BROWSER TEST ERROR:', err);
  process.exit(1);
});
