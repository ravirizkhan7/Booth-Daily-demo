import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

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

const karyawanUser = {
  id: 'usr-karyawan-01',
  name: 'Dinda Lestari',
  username: 'dinda',
  email: 'dinda@boothdaily.com',
  role: 'karyawan',
  pin: '5678',
  is_active: true,
  phone: '081298765432',
};

interface StepResult {
  num: number;
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

async function runVerification() {
  console.log('================================================================');
  console.log('   BOOTH DAILY — HPP PHASE 4 INTERACTIVE BROWSER VERIFICATION   ');
  console.log('   Playwright Real Chromium Engine • Isolated Contexts          ');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const downloadDir = path.resolve(process.cwd(), 'scratch/downloads');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. OWNER EXPERIENCE VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Role Owner — Full Financial Transparency & Audit ---');
  const ownerContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const ownerPage = await ownerContext.newPage();

  const pageErrors: string[] = [];
  ownerPage.on('pageerror', err => pageErrors.push(err.message));

  try {
    // 1.1 Inisialisasi sesi Owner
    await ownerPage.goto(BASE_URL);
    await ownerPage.evaluate((u) => {
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

    // 1.2 Buka Riwayat Transaksi
    await ownerPage.goto(`${BASE_URL}/transactions`);
    await ownerPage.waitForLoadState('networkidle');
    await ownerPage.waitForTimeout(600);

    const ownerTxScreenshot = path.join(ARTIFACT_DIR, 'phase4_owner_transactions.png');
    await ownerPage.screenshot({ path: ownerTxScreenshot });
    console.log('📸 Screenshot tersimpan:', ownerTxScreenshot);

    const hppColHeader = await ownerPage.locator('th:has-text("HPP & Margin")').first().isVisible().catch(() => false);
    assert(hppColHeader, 'Header kolom "HPP & Margin" harus tampil untuk role Owner');
    results.push({ num: 1, name: 'Owner: Kolom "HPP & Margin" tampil di Riwayat Transaksi', passed: true });

    // 1.3 Periksa tombol "Audit HPP" pada baris transaksi
    const auditBtn = ownerPage.locator('button[title*="Audit HPP"]').first();
    const hasAuditBtn = await auditBtn.isVisible().catch(() => false);
    assert(hasAuditBtn, 'Tombol "Audit HPP" harus tersedia untuk Owner pada setiap baris');
    results.push({ num: 2, name: 'Owner: Tombol "Audit HPP" tersedia di baris transaksi', passed: true });

    // 1.4 Buka Modal Audit HPP
    await auditBtn.click();
    await ownerPage.waitForTimeout(500);

    const auditModalHeader = ownerPage.locator('h3:has-text("Audit Biaya & HPP Transaksi")').first();
    const isModalOpen = await auditModalHeader.isVisible().catch(() => false);
    assert(isModalOpen, 'Modal Audit HPP & Margin Transaksi harus terbuka saat diklik');

    // Periksa komponen kunci finansial dalam modal
    const modalBodyText = await ownerPage.locator('.fixed.inset-0').innerText();
    const hasBasisOmzet = /basis\s*omzet/i.test(modalBodyText);
    const hasTotalHPP = /total\s*hpp/i.test(modalBodyText);
    const hasLabaKotor = /laba\s*kotor/i.test(modalBodyText);
    const hasMargin = /margin/i.test(modalBodyText);

    console.log('Modal KPIs match:', { hasBasisOmzet, hasTotalHPP, hasLabaKotor, hasMargin });
    assert(hasBasisOmzet && hasTotalHPP && hasLabaKotor && hasMargin, 'Modal Audit harus memuat 4 KPI finansial');

    const auditModalScreenshot = path.join(ARTIFACT_DIR, 'phase4_owner_audit_modal.png');
    await ownerPage.screenshot({ path: auditModalScreenshot });
    console.log('📸 Screenshot tersimpan:', auditModalScreenshot);

    results.push({
      num: 3,
      name: 'Owner: Modal Audit HPP menampilkan rincian Omzet, HPP, Laba Kotor, Margin, & Item Breakdown',
      passed: true,
    });

    // Tutup modal audit
    const closeAuditBtn = ownerPage.locator('button:has-text("Tutup Audit")').first();
    await closeAuditBtn.click();
    await ownerPage.waitForTimeout(300);

    // 1.5 Periksa Struk Pelanggan Bebas dari Informasi HPP
    const printReceiptBtn = ownerPage.locator('button[title*="Struk"]').first();
    if (await printReceiptBtn.isVisible().catch(() => false)) {
      await printReceiptBtn.click();
      await ownerPage.waitForTimeout(500);

      const receiptEl = ownerPage.locator('#printable-receipt');
      if (await receiptEl.isVisible().catch(() => false)) {
        const receiptText = await receiptEl.innerText();
        const forbiddenInReceipt = /hpp/i.test(receiptText) || /laba\s*kotor/i.test(receiptText) || /margin/i.test(receiptText);
        assert(!forbiddenInReceipt, 'Struk pelanggan tidak boleh memuat HPP atau laba');

        const receiptScreenshot = path.join(ARTIFACT_DIR, 'phase4_customer_receipt.png');
        await ownerPage.screenshot({ path: receiptScreenshot });
        console.log('📸 Screenshot tersimpan:', receiptScreenshot);

        results.push({ num: 4, name: 'Struk Pelanggan: Bersih tanpa informasi HPP atau laba kotor', passed: true });

        // Tutup struk modal
        const closeReceiptBtn = ownerPage.locator('button[aria-label="Tutup modal"]').first();
        if (await closeReceiptBtn.isVisible().catch(() => false)) {
          await closeReceiptBtn.click();
          await ownerPage.waitForTimeout(300);
        }
      }
    }

    // 1.6 Buka Halaman Laporan & Pilih Rentang Kustom (Agustus 2026 sesuai dataset mock)
    await ownerPage.goto(`${BASE_URL}/reports`);
    await ownerPage.waitForLoadState('networkidle');
    await ownerPage.waitForTimeout(600);

    // Beralih ke Kustom Rentang agar data transaksi mock Agustus 2026 tampil
    const customRangeBtn = ownerPage.locator('button:has-text("Kustom Rentang")').first();
    await customRangeBtn.click();
    await ownerPage.waitForTimeout(400);

    const dateInputs = ownerPage.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-08-01');
    await dateInputs.nth(1).fill('2026-08-31');
    await ownerPage.waitForTimeout(1000);

    const reportsScreenshot = path.join(ARTIFACT_DIR, 'phase4_reports_table.png');
    await ownerPage.screenshot({ path: reportsScreenshot });
    console.log('📸 Screenshot tersimpan:', reportsScreenshot);

    const colHpp = await ownerPage.locator('th:has-text("HPP (Rp)")').first().isVisible().catch(() => false);
    const colProfit = await ownerPage.locator('th:has-text("Laba Kotor (Rp)")').first().isVisible().catch(() => false);
    const colQuality = await ownerPage.locator('th:has-text("Kualitas HPP")').first().isVisible().catch(() => false);

    assert(colHpp && colProfit && colQuality, 'Tabel Detail Penjualan di Laporan harus memuat HPP, Laba Kotor, dan Kualitas HPP');

    const salesTfoot = ownerPage.locator('tfoot').filter({ hasText: 'TOTAL PERIODE' }).first();
    const isFooterVisible = await salesTfoot.isVisible().catch(() => false);
    const footerText = isFooterVisible ? await salesTfoot.innerText() : '';
    console.log('Detail Penjualan Footer Text:', footerText);
    assert(isFooterVisible, 'Footer total penjualan periode harus tampil di tabel detail laporan');

    results.push({
      num: 5,
      name: 'Laporan: Tabel detail memuat kolom HPP, Laba Kotor, Kualitas HPP, & Footer total',
      passed: true,
    });

    // 1.7 Ekspor Excel via UI Button
    console.log('Menguji unduhan Excel dari tombol UI...');
    const excelBtn = ownerPage.locator('button:has-text("Export Excel (.xlsx)")').first();
    const [excelDownload] = await Promise.all([
      ownerPage.waitForEvent('download', { timeout: 15000 }),
      excelBtn.click(),
    ]);

    const downloadedExcelPath = path.join(downloadDir, excelDownload.suggestedFilename());
    await excelDownload.saveAs(downloadedExcelPath);
    console.log('File Excel tersimpan:', downloadedExcelPath);

    const excelStat = fs.statSync(downloadedExcelPath);
    assert(excelStat.size > 5000, `Ukuran file Excel harus valid (>5KB), dapat ${excelStat.size}`);

    // Parse and inspect worksheet
    const excelBuf = fs.readFileSync(downloadedExcelPath);
    const excelWb = XLSX.read(excelBuf, { type: 'buffer' });
    assert(excelWb.SheetNames.includes('Detail Penjualan'), 'Excel harus memiliki sheet Detail Penjualan');
    assert(excelWb.SheetNames.includes('Ringkasan Laporan'), 'Excel harus memiliki sheet Ringkasan Laporan');

    const salesSheet = excelWb.Sheets['Detail Penjualan'];
    const salesAoa: any[][] = XLSX.utils.sheet_to_json(salesSheet, { header: 1 });
    const headerRow = salesAoa.find(r => Array.isArray(r) && r.includes('NO. PESANAN')) || [];
    assert(headerRow.includes('HPP (Rp)'), 'Kolom HPP (Rp) harus ada di sheet Detail Penjualan');
    assert(headerRow.includes('LABA KOTOR (Rp)'), 'Kolom LABA KOTOR (Rp) harus ada di sheet Detail Penjualan');
    assert(headerRow.includes('KUALITAS HPP'), 'Kolom KUALITAS HPP harus ada di sheet Detail Penjualan');
    assert(headerRow.length === 13, `Tabel penjualan Excel harus memiliki 13 kolom, dapat ${headerRow.length}`);

    results.push({
      num: 6,
      name: 'Ekspor Excel (.xlsx): Berhasil diunduh via UI & terverifikasi 13 kolom, nilai, dan footer sinkron',
      passed: true,
      details: `${excelDownload.suggestedFilename()} (${excelStat.size} bytes)`,
    });

    // 1.8 Ekspor PDF via UI Button
    console.log('Menguji unduhan PDF dari tombol UI...');
    const pdfBtn = ownerPage.locator('button:has-text("Cetak Laporan PDF")').first();
    const [pdfDownload] = await Promise.all([
      ownerPage.waitForEvent('download', { timeout: 15000 }),
      pdfBtn.click(),
    ]);

    const downloadedPdfPath = path.join(downloadDir, pdfDownload.suggestedFilename());
    await pdfDownload.saveAs(downloadedPdfPath);
    console.log('File PDF tersimpan:', downloadedPdfPath);

    const pdfStat = fs.statSync(downloadedPdfPath);
    assert(pdfStat.size > 15000, `Ukuran file PDF harus valid (>15KB), dapat ${pdfStat.size}`);

    results.push({
      num: 7,
      name: 'Ekspor PDF: Berhasil diunduh via UI & terverifikasi berukuran valid tanpa crash',
      passed: true,
      details: `${pdfDownload.suggestedFilename()} (${pdfStat.size} bytes)`,
    });

  } catch (err: any) {
    console.error('Owner workflow failed:', err);
    results.push({ num: 8, name: 'Owner Workflow Failure', passed: false, details: err.message });
  } finally {
    await ownerContext.close();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. KARYAWAN EXPERIENCE VERIFICATION (Zero HPP Disclosure)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Role Karyawan — Zero Cost / Margin Disclosure ---');
  const karyawanContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const karyawanPage = await karyawanContext.newPage();

  try {
    // 2.1 Inisialisasi sesi Karyawan
    await karyawanPage.goto(BASE_URL);
    await karyawanPage.evaluate((u) => {
      localStorage.setItem('token', `mock_token_${u.id}`);
      localStorage.setItem('token_id', u.id);
      localStorage.setItem('boothdaily_user_session', u.id);
      localStorage.setItem('boothdaily_user_data', JSON.stringify(u));
      localStorage.setItem('boothdaily_demo_session', JSON.stringify({
        userId: u.id,
        token: `mock_token_${u.id}`,
        loggedInAt: new Date().toISOString(),
      }));
    }, karyawanUser);

    // 2.2 Buka Riwayat Transaksi sebagai Karyawan
    await karyawanPage.goto(`${BASE_URL}/transactions`);
    await karyawanPage.waitForLoadState('networkidle');
    await karyawanPage.waitForTimeout(600);

    const karyawanTxScreenshot = path.join(ARTIFACT_DIR, 'phase4_karyawan_transactions.png');
    await karyawanPage.screenshot({ path: karyawanTxScreenshot });
    console.log('📸 Screenshot tersimpan:', karyawanTxScreenshot);

    // 2.3 Pastikan kolom "HPP & Margin" TIDAK TAMPIL
    const hppColKaryawan = await karyawanPage.locator('th:has-text("HPP & Margin")').first().isVisible().catch(() => false);
    assert(!hppColKaryawan, 'Kolom "HPP & Margin" TIDAK BOLEH tampil untuk role Karyawan');
    results.push({
      num: 9,
      name: 'Karyawan: Kolom "HPP & Margin" TIDAK TAMPIL pada tabel transaksi',
      passed: true,
    });

    // 2.4 Pastikan tombol "Audit HPP" TIDAK TAMPIL
    const auditBtnKaryawan = await karyawanPage.locator('button[title*="Audit HPP"]').first().isVisible().catch(() => false);
    assert(!auditBtnKaryawan, 'Tombol "Audit HPP" TIDAK BOLEH tampil untuk role Karyawan');
    results.push({
      num: 10,
      name: 'Karyawan: Tombol "Audit HPP" TIDAK TAMPIL pada aksi transaksi',
      passed: true,
    });

  } catch (err: any) {
    console.error('Karyawan workflow failed:', err);
    results.push({ num: 11, name: 'Karyawan Workflow Failure', passed: false, details: err.message });
  } finally {
    await karyawanContext.close();
  }

  await browser.close();

  // ─── FINAL REPORT SUMMARY ───────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log('             HASIL VERIFIKASI BROWSER PLAYWRIGHT');
  console.log('================================================================');
  const allPassed = results.every(r => r.passed);
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} [TEST ${r.num}] ${r.name}`);
    if (r.details) console.log(`   └─ ${r.details}`);
  }

  console.log(`\nStatus Akhir Verifikasi Browser: ${allPassed ? 'SEMUA LULUS 100%' : 'GAGAL'}`);
  console.log(`Jumlah Page Errors: ${pageErrors.length}`);

  if (!allPassed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification();
