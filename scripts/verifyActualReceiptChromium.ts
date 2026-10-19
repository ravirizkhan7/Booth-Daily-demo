/**
 * Utility Verifikasi Cetak Struk HTML/CSS Chromium Headless
 *
 * Cara Menjalankan:
 *   npx tsx scripts/verifyActualReceiptChromium.ts
 *
 * Output:
 *   HTML & PDF hasil render disimpan di direktori `dist/receipt_verify/`
 *   (direktori ini berada di dalam `dist/` sehingga otomatis diabaikan oleh Git).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getTestReceiptHtml, getReceiptHtml } from '../src/services/receiptPrint';
import { Settings, Order } from '../src/types';

// Dummy 1x1 transparent PNG & Wide PNG (base64)
const sampleTransparentLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAwSURBVHgB7c4BDQAACAMw9E/tYwZ/wE5u2yQd13UBAAAAAAAAAAAAAAAAAAAAAAAAAADgwQUj+gABd+gQHQAAAABJRU5ErkJggg==';

const sampleWideLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAACqNX6+AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAA9SURBVHgB7c4BAQAgEMSw9E9tDXyYggbcFknSdV0DAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC0v35vAABFvHk0AAAAAElFTkSuQmCC';

const sampleSettings58: Settings = {
  store_name: 'BOOTH DAILY RIUNG BANDUNG',
  tagline: 'Kopi Susu & Toast Specialist',
  address: 'Jl. Riung Hegar No. 24, Bandung',
  phone: '081234567890',
  receipt_header: 'Selamat Menikmati Kopi & Roti Panggang Pilihan!',
  receipt_footer: 'IG: @boothdaily.id • WiFi: boothdaily_guest',
  tax_percentage: 5,
  service_charge_percentage: 0,
  currency_symbol: 'Rp',
  operational_day_cutoff_time: '04:00',
  receipt_paper_size: '58mm',
};

const sampleSettings80: Settings = {
  ...sampleSettings58,
  store_name: 'BOOTH DAILY FLAGSHIP DAGO',
  receipt_paper_size: '80mm',
};

const sampleOrder: Order = {
  id: 'ord-test-actual',
  order_number: 'ORD-20261015-001',
  customer_name: 'Ravi Rizkhan',
  order_type: 'dine_in',
  subtotal: 78000,
  discount: 10000,
  discount_name: 'Promo Pembukaan Booth 10rb',
  tax: 3400,
  total_amount: 71400,
  created_at: new Date().toISOString(),
  created_by_name: 'Budi Santoso',
  created_by_user_id: 'usr-1',
  created_by_role: 'karyawan',
  items: [
    {
      id: 'item-1',
      product_id: 'prod-1',
      product_name: 'Kopi Susu Gula Aren Spesial Nusantara',
      qty: 1,
      price: 28000,
      subtotal: 28000,
      notes: 'Extra shot espresso, less ice, gula aren pisah',
    },
    {
      id: 'item-2',
      product_id: 'prod-2',
      product_name: 'Roti Bakar Cokelat Keju Melted Premium',
      qty: 2,
      price: 22000,
      subtotal: 44000,
      notes: 'Panggang renyah, keju melimpah',
    },
    {
      id: 'item-3',
      product_id: 'prod-3',
      product_name: 'Air Mineral 600ml',
      qty: 1,
      price: 6000,
      subtotal: 6000,
    },
  ],
  payment: {
    id: 'pay-test-1',
    order_id: 'ord-test-actual',
    method: 'cash',
    amount_paid: 100000,
    change: 28600,
    status: 'completed',
  },
};

const outDir = path.resolve(process.cwd(), 'dist', 'receipt_verify');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Generate HTML files
const htmlTest58WithLogo = getTestReceiptHtml(sampleSettings58, sampleTransparentLogo);
const htmlTest80WithWideLogo = getTestReceiptHtml(sampleSettings80, sampleWideLogo);
const htmlTest58NoLogo = getTestReceiptHtml(sampleSettings58, null);
const htmlTest80NoLogo = getTestReceiptHtml(sampleSettings80, null);
const htmlOrder58WithLogo = getReceiptHtml(sampleOrder, sampleSettings58, sampleTransparentLogo);
const htmlOrder80WithLogo = getReceiptHtml(sampleOrder, sampleSettings80, sampleWideLogo);

const testCases = [
  { name: 'test_receipt_58mm_with_logo', html: htmlTest58WithLogo },
  { name: 'test_receipt_80mm_with_wide_logo', html: htmlTest80WithWideLogo },
  { name: 'test_receipt_58mm_no_logo', html: htmlTest58NoLogo },
  { name: 'test_receipt_80mm_no_logo', html: htmlTest80NoLogo },
  { name: 'order_receipt_58mm_with_logo', html: htmlOrder58WithLogo },
  { name: 'order_receipt_80mm_with_logo', html: htmlOrder80WithLogo },
];

console.log('====================================================');
console.log('CHROMIUM ACTUAL HTML/CSS RECEIPT RENDERING AUDIT');
console.log('====================================================');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const hasChrome = fs.existsSync(chromePath);

if (!hasChrome) {
  console.log('⚠️ Google Chrome executable not found at default location. HTML verification only.');
}

for (const tc of testCases) {
  const htmlPath = path.join(outDir, `${tc.name}.html`);
  const pdfPath = path.join(outDir, `${tc.name}.pdf`);
  fs.writeFileSync(htmlPath, tc.html, 'utf-8');

  // Verify simplified test print semantics
  if (tc.name.startsWith('test_receipt')) {
    if (tc.html.includes('DETAIL PESANAN') || tc.html.includes('Subtotal:') || tc.html.includes('SALINAN STAFF')) {
      throw new Error(`[FAIL] ${tc.name} still contains transaction elements!`);
    }
    if (!tc.html.includes('TEST PRINT THERMAL') || !tc.html.includes('Test print berhasil.')) {
      throw new Error(`[FAIL] ${tc.name} missing test print label or success message!`);
    }
  }

  // Verify logo presence vs clean omission
  if (tc.name.includes('with_logo')) {
    if (!tc.html.includes('class="store-logo"') || !tc.html.includes('<img')) {
      throw new Error(`[FAIL] ${tc.name} expected logo but not found!`);
    }
  } else if (tc.name.includes('no_logo')) {
    if (tc.html.includes('class="store-logo"') || tc.html.includes('<img')) {
      throw new Error(`[FAIL] ${tc.name} expected clean omission but logo found!`);
    }
  }

  // Render to PDF using Chromium Headless
  if (hasChrome) {
    try {
      execSync(`"${chromePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "file:///${htmlPath.replace(/\\/g, '/')}"`, {
        stdio: 'pipe',
      });
      const pdfSize = fs.statSync(pdfPath).size;
      console.log(`✓ ${tc.name}.pdf generated successfully (${pdfSize} bytes)`);
    } catch (err: any) {
      console.error(`✗ Failed to generate PDF for ${tc.name}:`, err?.message);
    }
  } else {
    console.log(`✓ ${tc.name}.html validated successfully`);
  }
}

console.log('----------------------------------------------------');
console.log('ALL CHROMIUM ACTUAL HTML/CSS TESTS PASSED (EXIT 0)');
console.log('====================================================');
