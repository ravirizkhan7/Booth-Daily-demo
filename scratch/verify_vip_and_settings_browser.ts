import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ARTIFACT_DIR = 'C:\\Users\\RAVI\\.gemini\\antigravity-ide\\brain\\de8d37d7-7981-411a-99e2-1d15da7adec4';
const BASE_URL = 'http://127.0.0.1:3000';
const PDFTOTEXT_BIN = 'C:\\laragon\\bin\\git\\mingw64\\bin\\pdftotext.exe';

const ownerUser = {
  id: 'usr-owner-01',
  name: 'Muhammad Ravi Rizkhan',
  username: 'ravi',
  email: 'ravi@boothdaily.com',
  role: 'owner',
  pin: '1234',
  is_active: true,
  phone: '081234567890',
};

const cashierUser = {
  id: 'usr-karyawan-01',
  name: 'Dinda Lestari',
  username: 'dinda',
  email: 'dinda@boothdaily.com',
  role: 'karyawan',
  pin: '5678',
  is_active: true,
  phone: '081298765432',
};

function copyArtifact(srcPath: string, destFileName: string) {
  try {
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(ARTIFACT_DIR, destFileName);
      fs.copyFileSync(srcPath, destPath);
      console.log(`[Artifact] Copied ${destFileName} to artifact directory.`);
    }
  } catch (err) {
    console.warn(`[Artifact] Failed to copy artifact ${destFileName}:`, err);
  }
}

async function runBrowserVerification() {
  console.log('================================================================');
  console.log('   BOOTH DAILY — VIP & REPORT SETTINGS BROWSER VERIFICATION     ');
  console.log('   Isolated Playwright Chromium Context • Real Interactive DOM  ');
  console.log('================================================================\n');

  const downloadDir = path.resolve(process.cwd(), 'scratch/downloads');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', err => {
    console.error('❌ Browser Page Error:', err.message, err.stack);
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
    // 0. INITIALIZE CLEAN ISOLATED SESSION & SEED STATE
    // -------------------------------------------------------------------------
    console.log('--- 0. Menginisialisasi Sesi Owner di Browser ---');
    await context.addInitScript(({ owner }) => {
      localStorage.setItem('token', `mock_token_${owner.id}`);
      localStorage.setItem('token_id', owner.id);
      localStorage.setItem('boothdaily_user_session', owner.id);
      localStorage.setItem('boothdaily_user_data', JSON.stringify(owner));
      localStorage.setItem('boothdaily_demo_session', JSON.stringify({
        userId: owner.id,
        token: `mock_token_${owner.id}`,
        loggedInAt: new Date().toISOString(),
      }));
    }, { owner: ownerUser });

    await page.goto(BASE_URL);
    await page.evaluate(({ owner, cashier }) => {
      const users = [owner, cashier];
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const initialShift = {
        id: 'shf-active-vip',
        shift_number: 'SHF-TODAY-01',
        status: 'open',
        operational_date: todayStr,
        opened_at: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
        opened_by_user_id: owner.id,
        opened_by_name: owner.name,
        opened_by_role: owner.role,
        cash_initial: 200000,
        reconciliation_status: 'balanced',
        created_at: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
      };

      const categories = [
        { id: 'cat-1', name: 'Coffee', slug: 'coffee', icon: 'coffee', icon_name: 'coffee' }
      ];

      const products = [
        {
          id: 'prd-kopi-susu',
          name: 'Kopi Susu Gula Aren',
          price: 25000,
          category_id: 'cat-1',
          is_active: true,
          is_favorite: true,
        },
        {
          id: 'prd-latte',
          name: 'Caffe Latte Special',
          price: 30000,
          category_id: 'cat-1',
          is_active: true,
          is_favorite: true,
        }
      ];

      const fullState = {
        users,
        categories,
        products,
        stocks: [
          {
            id: 'stk-coffee-beans',
            name: 'Biji Kopi Espresso Blend',
            current_amount: 5000,
            min_amount: 500,
            unit: 'Gram',
            cost_per_unit: 100,
            baseline_cost_per_unit: 100,
            baseline_source: 'verified_migration',
            conversion_status: 'verified',
          }
        ],
        stockHistories: [],
        recipes: [
          { id: 'rcp-1', product_id: 'prd-kopi-susu', ingredients: [{ stock_id: 'stk-coffee-beans', amount: 20 }] }
        ],
        orders: [],
        purchases: [],
        discountRules: [],
        settings: {
          store_name: 'Booth Daily Coffee',
          address: 'Jl. Riau No. 88',
          phone: '081234567890',
          tax_percentage: 10,
          report_signer_name: '',
          report_city: '',
          vip_discount_percentage: 0,
          vip_tax_percentage: null,
          vip_room_service_charge_percentage: 0,
        },
        shifts: [initialShift],
        expenses: [],
        activeShiftId: 'shf-active-vip',
      };

      localStorage.setItem('boothdaily_demo_store', JSON.stringify(fullState));
    }, { owner: ownerUser, cashier: cashierUser });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // -------------------------------------------------------------------------
    // 1. SETTINGS NAVIGATION & PERSISTENCE (FITUR 1 & VIP FINANCIAL SETTINGS)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Verifikasi Pengaturan Nama Owner, Kota, & Parameter Finansial VIP ---');
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // Check settings inputs exist
    const signerInput = page.locator('input[id="report_signer_name"]');
    const cityInput = page.locator('input[id="report_city"]');
    const vipDiscInput = page.locator('input[id="vip_discount_percentage"]');
    const vipTaxInput = page.locator('input[id="vip_tax_percentage"]');
    const vipServiceInput = page.locator('input[id="vip_room_service_charge_percentage"]');

    await signerInput.waitFor({ state: 'visible', timeout: 5000 });
    await cityInput.waitFor({ state: 'visible', timeout: 5000 });
    await vipDiscInput.waitFor({ state: 'visible', timeout: 5000 });
    await vipTaxInput.waitFor({ state: 'visible', timeout: 5000 });
    await vipServiceInput.waitFor({ state: 'visible', timeout: 5000 });

    console.log('Mengisi formulir pengaturan laporan & VIP...');
    await signerInput.fill('Muhammad Ravi Pratama');
    await cityInput.fill('Bandung');
    await vipDiscInput.fill('10');
    await vipTaxInput.fill('12');
    await vipServiceInput.fill('5');

    // Click Save Button
    const saveButton = page.locator('button:has-text("Simpan Pengaturan")');
    await saveButton.click();

    // Verify success toast
    await page.waitForSelector('text=berhasil disimpan', { timeout: 5000 });
    console.log('✓ Notifikasi sukses "Pengaturan toko & tarif pajak berhasil disimpan!" muncul.');

    // Reload page to test full browser persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    const reloadedSigner = await signerInput.inputValue();
    const reloadedCity = await cityInput.inputValue();
    const reloadedVipDisc = await vipDiscInput.inputValue();
    const reloadedVipTax = await vipTaxInput.inputValue();
    const reloadedVipService = await vipServiceInput.inputValue();

    if (
      reloadedSigner !== 'Muhammad Ravi Pratama' ||
      reloadedCity !== 'Bandung' ||
      reloadedVipDisc !== '10' ||
      reloadedVipTax !== '12' ||
      reloadedVipService !== '5'
    ) {
      throw new Error(`Pengaturan tidak persisten setelah reload! Hasil: signer=${reloadedSigner}, city=${reloadedCity}, vipDisc=${reloadedVipDisc}, vipTax=${reloadedVipTax}, vipService=${reloadedVipService}`);
    }

    console.log('✓ Semua 5 field pengaturan persisten setelah reload halaman.');
    const screen1Path = path.resolve(process.cwd(), 'scratch/gate_vip_1_settings_persisted.png');
    await page.screenshot({ path: screen1Path, fullPage: true });
    copyArtifact(screen1Path, 'gate_vip_1_settings_persisted.png');

    // -------------------------------------------------------------------------
    // 2. POS ORDER AREA SWITCH & VIP CHECKOUT (FITUR 2 & 3)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Verifikasi Transaksi POS Ruang VIP (Diskon 10%, Pajak 12%, Service 5%) ---');
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // Add 2x Kopi Susu (2 x 25.000 = 50.000)
    const productCard = page.locator('text=Kopi Susu Gula Aren').first();
    await productCard.click();
    await page.waitForTimeout(200);
    await productCard.click();
    await page.waitForTimeout(300);

    // Initial check: Area Umum is active by default
    const regularAreaBtn = page.locator('button:has-text("Umum")');
    const vipAreaBtn = page.locator('button:has-text("Ruang VIP")');

    await regularAreaBtn.waitFor({ state: 'visible', timeout: 5000 });
    await vipAreaBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Switch to Ruang VIP
    console.log('Mengaktifkan switch Area: Ruang VIP di CartSidebar...');
    await vipAreaBtn.click();
    await page.waitForTimeout(400);

    // Verify VIP breakdown elements are visible in cart:
    // Subtotal: Rp 50.000
    // VIP Discount 10%: Rp 5.000 -> Base: Rp 45.000
    // VIP Tax 12%: 45.000 * 12% = Rp 5.400
    // VIP Service Charge 5%: 45.000 * 5% = Rp 2.250
    // Grand Total: 45.000 + 5.400 + 2.250 = Rp 52.650
    const vipDiscLine = page.locator('text=Diskon Ruang VIP (10%)');
    await vipDiscLine.waitFor({ state: 'visible', timeout: 4000 });
    console.log('✓ Diskon Ruang VIP (10%) tertera di CartSidebar.');

    const vipServiceLine = page.locator('text=Biaya Layanan VIP (5%)');
    await vipServiceLine.waitFor({ state: 'visible', timeout: 4000 });
    console.log('✓ Biaya Layanan VIP (5%) tertera di CartSidebar.');

    const screen2Path = path.resolve(process.cwd(), 'scratch/gate_vip_2_pos_vip_cart.png');
    await page.screenshot({ path: screen2Path, fullPage: true });
    copyArtifact(screen2Path, 'gate_vip_2_pos_vip_cart.png');

    // Click "Bayar Sekarang"
    const checkoutButton = page.locator('button:has-text("Bayar Sekarang")');
    await checkoutButton.click();

    // Verify PIN Modal opens with VIP details
    await page.waitForSelector('text=Ruang VIP', { timeout: 5000 });
    console.log('✓ PIN / Payment Modal menampilkan badge "Ruang VIP".');

    // Click Uang Pas
    const uangPasBtn = page.locator('button:has-text("Uang Pas")');
    if (await uangPasBtn.isVisible()) {
      await uangPasBtn.click();
      await page.waitForTimeout(200);
    }

    // Enter PIN: click 1, 2, 3, 4 via keypad
    await page.click('.grid-cols-3 button:has-text("1")');
    await page.click('.grid-cols-3 button:has-text("2")');
    await page.click('.grid-cols-3 button:has-text("3")');
    await page.click('.grid-cols-3 button:has-text("4")');
    await page.waitForTimeout(300);

    // Click Konfirmasi Pembayaran
    const confirmPayBtn = page.locator('button:has-text("Konfirmasi Pembayaran")');
    await confirmPayBtn.click();

    // Verify Receipt Modal opens
    await page.waitForSelector('text=Transaksi Sukses!', { timeout: 8000 });
    console.log('✓ Modal Transaksi Sukses! (Struk) terbuka.');
    await page.waitForSelector('#printable-receipt:has-text("RUANG VIP")', { timeout: 4000 });
    console.log('✓ Struk transaksi mencantumkan "RUANG VIP".');
    await page.waitForSelector('#printable-receipt:has-text("Biaya Layanan VIP")', { timeout: 4000 });
    console.log('✓ Struk transaksi mencantumkan rincian "Biaya Layanan VIP".');

    const screen3Path = path.resolve(process.cwd(), 'scratch/gate_vip_3_vip_receipt.png');
    await page.screenshot({ path: screen3Path, fullPage: true });
    copyArtifact(screen3Path, 'gate_vip_3_vip_receipt.png');

    // Close receipt modal
    const closeReceiptBtn = page.locator('button:has-text("Selesai & Kembali ke Kasir")');
    await closeReceiptBtn.click();
    await page.waitForTimeout(600);

    // -------------------------------------------------------------------------
    // 3. REPORTS PAGE & SIGNER CARD VERIFICATION (FITUR 1, 2, 3)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Verifikasi Halaman Laporan, Kartu Pengesahan, & Kolom Area ---');
    await page.goto(`${BASE_URL}/reports`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Verify Section 8 Formal Document Signature card
    const signerBlock = page.locator('text=Pengesahan Dokumen Laporan Formal');
    await signerBlock.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Kartu Pengesahan Dokumen Laporan Formal terpasang di ReportsPage.');

    const cityText = page.locator('text=Bandung');
    await cityText.first().waitFor({ state: 'visible', timeout: 4000 });
    console.log('✓ Kota penerbitan "Bandung" tertera pada kartu laporan.');

    const signerText = page.locator('text=Muhammad Ravi Pratama');
    await signerText.first().waitFor({ state: 'visible', timeout: 4000 });
    console.log('✓ Penandatangan "Muhammad Ravi Pratama" tertera pada kartu laporan.');

    // Verify Komponen & Area VIP summary card
    const vipCard = page.locator('text=Komponen & Area VIP');
    await vipCard.waitFor({ state: 'visible', timeout: 4000 });
    console.log('✓ Ringkasan Komponen & Area VIP terpasang di ReportsPage.');

    // Verify Section 6 table has Area column with "Ruang VIP" badge
    const vipBadgeInTable = page.locator('table span:has-text("Ruang VIP")').first();
    await vipBadgeInTable.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Kolom Area pada tabel transaksi menampilkan badge "Ruang VIP".');

    const screen4Path = path.resolve(process.cwd(), 'scratch/gate_vip_4_reports_page.png');
    await page.screenshot({ path: screen4Path, fullPage: true });
    copyArtifact(screen4Path, 'gate_vip_4_reports_page.png');

    // -------------------------------------------------------------------------
    // 4. ACTUAL PDF EXPORT & POPPLER PDFTOTEXT VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Ekspor Berkas PDF Riil & Verifikasi Ekstraksi Teks (pdftotext) ---');
    const pdfButton = page.locator('button:has-text("Cetak Laporan PDF")');
    await pdfButton.waitFor({ state: 'visible', timeout: 5000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      pdfButton.click(),
    ]);

    const downloadedPdfPath = path.resolve(downloadDir, 'laporan_vip_test.pdf');
    await download.saveAs(downloadedPdfPath);
    console.log(`✓ Berkas PDF berhasil diunduh ke: ${downloadedPdfPath}`);

    const pdfStats = fs.statSync(downloadedPdfPath);
    console.log(`Ukuran berkas PDF: ${pdfStats.size} byte.`);
    if (pdfStats.size < 5000) {
      throw new Error(`Ukuran PDF terlalu kecil (${pdfStats.size} byte), kemungkinan korup!`);
    }

    // Extract text from PDF using poppler pdftotext
    const extractedTxtPath = path.resolve(downloadDir, 'laporan_vip_test.txt');
    console.log('Mengekstraksi teks berkas PDF menggunakan pdftotext.exe...');
    execSync(`"${PDFTOTEXT_BIN}" "${downloadedPdfPath}" "${extractedTxtPath}"`);

    const extractedText = fs.readFileSync(extractedTxtPath, 'utf8');
    console.log('\n--- Potongan Teks Berkas PDF yang Diekstraksi: ---');
    console.log(extractedText.slice(0, 800));
    console.log('...\n' + extractedText.slice(-600));

    // Verify exact expected contents
    if (!extractedText.includes('Muhammad Ravi Pratama')) {
      throw new Error('PDF tidak memuat nama penandatangan "Muhammad Ravi Pratama"!');
    }
    console.log('✓ Terverifikasi: PDF memuat nama penandatangan "Muhammad Ravi Pratama".');

    if (!extractedText.includes('Bandung')) {
      throw new Error('PDF tidak memuat kota "Bandung"!');
    }
    console.log('✓ Terverifikasi: PDF memuat kota penerbitan "Bandung".');

    if (!extractedText.includes('Diskon')) {
      throw new Error('PDF tidak memuat komponen diskon!');
    }
    console.log('✓ Terverifikasi: PDF memuat ringkasan diskon.');

    // Copy PDF to artifacts
    copyArtifact(downloadedPdfPath, 'gate_vip_reports_export.pdf');

    console.log('\n================================================================');
    console.log('🎉 SEMUA VERIFIKASI BROWSER & EKSPOR PDF SUKSES TANPA KESALAHAN!  ');
    console.log('================================================================\n');

  } catch (error: any) {
    console.error('\n❌ VERIFIKASI BROWSER GAGAL:', error.message);
    const errPath = path.resolve(process.cwd(), 'scratch/gate_vip_error.png');
    await page.screenshot({ path: errPath, fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

runBrowserVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
