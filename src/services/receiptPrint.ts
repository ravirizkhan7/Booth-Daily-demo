import { formatRupiah, formatDate } from '../utils/formatters';
import { Order, Settings, ReceiptPaperSize } from '../types';

export const getReceiptCSS = (paperSize: ReceiptPaperSize = '80mm'): string => {
  const is58mm = paperSize === '58mm';

  return `
@page {
  margin: 0;
  size: ${is58mm ? '58mm auto' : '80mm auto'};
}

*, *:before, *:after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  margin: 0 auto;
  padding: ${is58mm ? '6px 3px' : '12px 8px'};
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: ${is58mm ? '9.5px' : '11px'};
  line-height: ${is58mm ? '1.25' : '1.35'};
  color: #1c1917;
  background: #fff;
  width: 100%;
  max-width: ${is58mm ? '48mm' : '78mm'};
  overflow-wrap: break-word;
  word-break: break-word;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.receipt-copy {
  width: 100%;
  max-width: ${is58mm ? '48mm' : '78mm'};
  margin: 0 auto;
  padding: 0;
  box-sizing: border-box;
  overflow-wrap: break-word;
  word-break: break-word;
}

.staff-copy {
  page-break-before: always;
  break-before: page;
  padding-top: ${is58mm ? '8px' : '12px'};
}

.text-center { text-align: center; }
.text-right { text-align: right; }
.text-left { text-align: left; }
.font-bold { font-weight: 700; }
.font-black { font-weight: 900; }
.uppercase { text-transform: uppercase; }
.italic { font-style: italic; }

/* Section dividers */
.border-dashed-b {
  border-bottom: 1px dashed #d6d3d1;
  padding-bottom: ${is58mm ? '5px' : '8px'};
  margin-bottom: ${is58mm ? '5px' : '8px'};
}

.border-dashed-t {
  border-top: 1px dashed #d6d3d1;
  padding-top: ${is58mm ? '5px' : '8px'};
  margin-top: ${is58mm ? '5px' : '8px'};
}

/* Store Header */
.store-header {
  text-align: center;
  border-bottom: 1px dashed #d6d3d1;
  padding-bottom: ${is58mm ? '5px' : '8px'};
  margin-bottom: ${is58mm ? '5px' : '8px'};
}

.store-logo {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: ${is58mm ? '3px' : '5px'};
}

.store-logo img {
  max-width: ${is58mm ? '38mm' : '55mm'};
  max-height: ${is58mm ? '24mm' : '30mm'};
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}

.store-name {
  font-size: ${is58mm ? '11.5px' : '13px'};
  font-weight: 700;
  letter-spacing: ${is58mm ? '0.3px' : '0.5px'};
  color: #3b2a1f;
  margin-bottom: 2px;
  line-height: 1.2;
}

.staff-badge {
  font-size: ${is58mm ? '9px' : '10.5px'};
  font-weight: 700;
  letter-spacing: ${is58mm ? '0.5px' : '0.8px'};
  color: #3b2a1f;
  margin: 2px 0;
  text-transform: uppercase;
}

.tagline {
  font-size: ${is58mm ? '8px' : '9.5px'};
  color: #78716c;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  line-height: 1.2;
  white-space: pre-line;
}

.address-line {
  font-size: ${is58mm ? '8px' : '9.5px'};
  color: #57534e;
  line-height: 1.2;
  white-space: pre-line;
}

/* Rows */
.flex-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: ${is58mm ? '9px' : '10.5px'};
  line-height: ${is58mm ? '1.25' : '1.35'};
  margin-bottom: ${is58mm ? '2px' : '3px'};
}

.flex-row:last-child {
  margin-bottom: 0;
}

.label-dim {
  color: #78716c;
}

.value-dim {
  color: #57534e;
}

/* Items */
.item-block {
  margin-bottom: ${is58mm ? '4px' : '6px'};
}

.item-block:last-child {
  margin-bottom: 0;
}

.item-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-weight: 700;
  font-size: ${is58mm ? '9px' : '10.5px'};
  line-height: ${is58mm ? '1.25' : '1.35'};
  gap: 4px;
}

.item-name-col {
  flex: 1;
  text-align: left;
  min-width: 0;
}

.item-price-col {
  flex-shrink: 0;
  text-align: right;
  white-space: nowrap;
}

.item-notes {
  font-size: ${is58mm ? '8px' : '9.5px'};
  font-style: italic;
  color: #78716c;
  padding-left: ${is58mm ? '6px' : '10px'};
  line-height: 1.2;
  margin-top: 1px;
}

.promo-note {
  font-size: ${is58mm ? '8px' : '9.5px'};
  font-style: italic;
  color: #059669;
  padding-left: ${is58mm ? '6px' : '8px'};
  line-height: 1.2;
  margin-top: -1px;
  margin-bottom: 2px;
}

/* Total Row */
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${is58mm ? '11.5px' : '13px'};
  font-weight: 900;
  color: #1c1917;
  padding-top: 2px;
  margin-bottom: ${is58mm ? '2px' : '4px'};
}

/* Footer */
.receipt-footer {
  text-align: center;
  border-top: 1px dashed #d6d3d1;
  padding-top: ${is58mm ? '5px' : '8px'};
  margin-top: ${is58mm ? '5px' : '8px'};
  font-size: ${is58mm ? '8px' : '9.5px'};
  color: #78716c;
  line-height: 1.25;
  white-space: pre-line;
}

.receipt-footer-bold {
  font-weight: 600;
  color: #44403c;
  margin-top: 2px;
  white-space: pre-line;
}

.receipt-watermark-test {
  font-size: ${is58mm ? '7.5px' : '8.5px'};
  color: #a8a29e;
  text-align: center;
  margin-top: 4px;
  letter-spacing: 0.3px;
  line-height: 1.2;
}
`;
};

/**
 * Sanitize untrusted text input against HTML injection (XSS).
 * Encodes special characters: &, <, >, ", and '.
 */
export const escapeHtml = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Validate that a printer logo image URL is a safe URI (data:image/ or relative/http).
 * Blocks javascript:, vbscript:, and malicious schemes.
 */
export const isSafeLogoUrl = (url?: string | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  );
};

/**
 * Generate simplified thermal test receipt HTML.
 * Purely tests printer layout and connection, NOT a transaction simulation.
 */
export const getTestReceiptHtml = (
  settings: Partial<Settings>,
  printerLogo?: string | null
): string => {
  const paperSize: ReceiptPaperSize = settings.receipt_paper_size === '58mm' ? '58mm' : '80mm';
  const rawStoreName = settings.store_name?.trim() ? settings.store_name.trim() : 'BOOTH DAILY';
  const storeName = escapeHtml(rawStoreName);
  const now = new Date();
  const dateFormatted = `${now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}, ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;

  const logoHtml = printerLogo && isSafeLogoUrl(printerLogo)
    ? `<div class="store-logo"><img src="${escapeHtml(printerLogo)}" alt="${storeName}" /></div>`
    : '';

  const testReceipt = `
    <div class="receipt-copy">

      <!-- Store Header -->
      <div class="store-header">
        ${logoHtml}
        <div class="store-name">${storeName}</div>
        <div class="staff-badge">TEST PRINT THERMAL</div>
        ${settings.tagline ? `<div class="tagline">${escapeHtml(settings.tagline)}</div>` : ''}
        ${settings.address ? `<div class="address-line">${escapeHtml(settings.address)}</div>` : ''}
        ${settings.phone ? `<div class="address-line">Telp: ${escapeHtml(settings.phone)}</div>` : ''}
      </div>

      <!-- Test Information -->
      <div class="border-dashed-b">
        <div class="flex-row">
          <span class="label-dim">ID Uji:</span>
          <span class="font-bold">TEST-${paperSize.toUpperCase()}-001</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Ukuran Kertas:</span>
          <span class="font-bold uppercase" style="color: #2563eb;">Thermal ${paperSize} (${paperSize === '58mm' ? 'max 48mm' : 'max 78mm'})</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Waktu Pengujian:</span>
          <span>${dateFormatted}</span>
        </div>
      </div>

      <!-- Saved Receipt Header (if configured) -->
      ${
        settings.receipt_header
          ? `
            <div class="border-dashed-b text-center">
              <div class="value-dim">${escapeHtml(settings.receipt_header)}</div>
            </div>
          `
          : ''
      }

      <!-- Test Message -->
      <div class="border-dashed-b text-center font-bold" style="padding: 8px 0; font-size: ${paperSize === '58mm' ? '10px' : '11.5px'}; color: #059669;">
        Test print berhasil.
      </div>

      <!-- Saved Receipt Footer (if configured) -->
      ${
        settings.receipt_footer
          ? `
            <div class="receipt-footer">
              <div class="receipt-footer-bold">${escapeHtml(settings.receipt_footer)}</div>
            </div>
          `
          : ''
      }

    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Test_Print_${paperSize}</title>
      <style>
        ${getReceiptCSS(paperSize)}
      </style>
    </head>
    <body>
      ${testReceipt}
    </body>
    </html>
  `;
};

/**
 * Print simplified test receipt using active/draft settings and printer logo.
 */
export const printTestReceipt = (
  settings: Partial<Settings>,
  printerLogo?: string | null
) => {
  const html = getTestReceiptHtml(settings, printerLogo);
  executePrint(html);
};

/**
 * Generate full Order Receipt HTML with customer and staff copies.
 */
export const getReceiptHtml = (
  order: Order,
  settings: Settings,
  printerLogo?: string | null
): string => {
  const paperSize: ReceiptPaperSize = settings.receipt_paper_size === '58mm' ? '58mm' : '80mm';
  const rawStoreName = settings.store_name?.trim() ? settings.store_name.trim() : 'BOOTH DAILY';
  const storeName = escapeHtml(rawStoreName);
  const logoHtml = printerLogo && isSafeLogoUrl(printerLogo)
    ? `<div class="store-logo"><img src="${escapeHtml(printerLogo)}" alt="${storeName}" /></div>`
    : '';

  const orderType =
    order.order_type === 'dine_in'
      ? 'DINE IN'
      : 'TAKE AWAY';

  const custName = order.customer_name
    ? ` (${escapeHtml(order.customer_name)})`
    : '';

  const isRefunded = order.payment?.status === 'refunded';

  // Snapshot fields — read directly from backend order, NEVER recalculate
  const subtotal     = order.subtotal     ?? 0;
  const discount     = order.discount     ?? 0;
  const discountName = order.discount_name ? escapeHtml(order.discount_name) : null;
  const tax          = order.tax          ?? 0;
  const totalAmount  = order.total_amount ?? 0;

  const discountDisplay = discount > 0
    ? `-${formatRupiah(discount)}`
    : formatRupiah(0);

  const promoNameHtml = discountName
    ? `<div class="promo-note">${discountName}</div>`
    : '';

  const customerItemsHtml = (order.items || [])
    .map(
      (item) => `
        <div class="item-block">
          <div class="item-main">
            <span class="item-name-col">${item.qty}x ${escapeHtml(item.product_name)}</span>
            <span class="item-price-col">${formatRupiah(item.subtotal)}</span>
          </div>
          ${
            item.notes
              ? `<div class="item-notes">Catatan: ${escapeHtml(item.notes)}</div>`
              : ''
          }
        </div>
      `
    )
    .join('');

  const staffItemsHtml = (order.items || [])
    .map(
      (item) => `
        <div class="item-block">
          <div class="item-main">
            <span class="item-name-col">${item.qty}x ${escapeHtml(item.product_name)}</span>
          </div>
          ${
            item.notes
              ? `<div class="item-notes font-bold" style="color: #1c1917;">Catatan: ${escapeHtml(item.notes)}</div>`
              : ''
          }
        </div>
      `
    )
    .join('');

  const customerReceipt = `
    <div class="receipt-copy">

      <!-- Store Header -->
      <div class="store-header">
        ${logoHtml}
        <div class="store-name">${storeName}</div>
        ${settings.tagline ? `<div class="tagline">${escapeHtml(settings.tagline)}</div>` : ''}
        ${settings.address ? `<div class="address-line">${escapeHtml(settings.address)}</div>` : ''}
        ${settings.phone ? `<div class="address-line">Telp: ${escapeHtml(settings.phone)}</div>` : ''}
      </div>

      <!-- Order Info -->
      <div class="border-dashed-b">
        <div class="flex-row">
          <span class="label-dim">No:</span>
          <span class="font-bold">${escapeHtml(order.order_number)}</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Waktu:</span>
          <span>${formatDate(order.created_at)}</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Kasir:</span>
          <span>${escapeHtml(order.created_by_name)}</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Tipe Pesanan:</span>
          <span class="font-bold uppercase" style="color: #c68b59;">${orderType}${custName}</span>
        </div>
        ${
          isRefunded
            ? `<div class="flex-row font-bold" style="color: #e11d48;"><span>Status:</span><span class="uppercase">DIREFUND</span></div>`
            : ''
        }
      </div>

      <!-- Items -->
      <div class="border-dashed-b">
        ${customerItemsHtml}
      </div>

      <!-- Financial Breakdown -->
      <div class="border-dashed-b">
        <div class="flex-row value-dim">
          <span>Subtotal:</span>
          <span>${formatRupiah(subtotal)}</span>
        </div>
        <div class="flex-row value-dim">
          <span>Diskon:</span>
          <span style="${discount > 0 ? 'color: #059669; font-weight: 600;' : ''}">${discountDisplay}</span>
        </div>
        ${promoNameHtml}
        <div class="flex-row value-dim">
          <span>Pajak:</span>
          <span>${formatRupiah(tax)}</span>
        </div>
      </div>

      <!-- Total & Payment -->
      <div>
        <div class="total-row">
          <span>TOTAL:</span>
          <span>${formatRupiah(totalAmount)}</span>
        </div>
        <div class="flex-row value-dim">
          <span>Metode Bayar:</span>
          <span class="font-bold uppercase">${escapeHtml(order.payment?.method?.toUpperCase() || '-')}</span>
        </div>
        <div class="flex-row value-dim">
          <span>Diterima:</span>
          <span>${formatRupiah(order.payment?.amount_paid || totalAmount)}</span>
        </div>
        <div class="flex-row value-dim font-bold">
          <span>Kembalian:</span>
          <span>${formatRupiah(order.payment?.change || 0)}</span>
        </div>
      </div>

      <!-- Footer -->
      ${
        settings.receipt_header || settings.receipt_footer
          ? `
            <div class="receipt-footer">
              ${settings.receipt_header ? `<div>${escapeHtml(settings.receipt_header)}</div>` : ''}
              ${settings.receipt_footer ? `<div class="receipt-footer-bold">${escapeHtml(settings.receipt_footer)}</div>` : ''}
            </div>
          `
          : ''
      }

    </div>
  `;

  const staffReceipt = `
    <div class="receipt-copy staff-copy">

      <!-- Store Header with SALINAN STAFF -->
      <div class="store-header">
        ${logoHtml}
        <div class="store-name">${storeName}</div>
        <div class="staff-badge">SALINAN STAFF</div>
        ${settings.tagline ? `<div class="tagline">${escapeHtml(settings.tagline)}</div>` : ''}
        ${settings.address ? `<div class="address-line">${escapeHtml(settings.address)}</div>` : ''}
        ${settings.phone ? `<div class="address-line">Telp: ${escapeHtml(settings.phone)}</div>` : ''}
      </div>

      <!-- Order Info -->
      <div class="border-dashed-b">
        <div class="flex-row">
          <span class="label-dim">No:</span>
          <span class="font-bold">${escapeHtml(order.order_number)}</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Waktu:</span>
          <span>${formatDate(order.created_at)}</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Kasir:</span>
          <span>${escapeHtml(order.created_by_name)}</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Tipe Pesanan:</span>
          <span class="font-bold uppercase" style="color: #c68b59;">${orderType}${custName}</span>
        </div>
      </div>

      <!-- Staff Detail Items -->
      <div class="border-dashed-b">
        <div class="font-bold" style="font-size: ${paperSize === '58mm' ? '8.5px' : '10px'}; text-decoration: underline; margin-bottom: 4px;">
          DETAIL PESANAN:
        </div>
        ${staffItemsHtml}
      </div>

      <!-- Staff Footer -->
      <div class="receipt-footer">
        <div class="receipt-footer-bold">Untuk Persiapan Barista / Dapur</div>
      </div>

    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt_${escapeHtml(order.order_number)}</title>
      <style>
        ${getReceiptCSS(paperSize)}
      </style>
    </head>
    <body>
      ${customerReceipt}
      ${staffReceipt}
    </body>
    </html>
  `;
};

/**
 * Print customer & staff order receipts.
 */
export const printReceipt = (
  order: Order,
  settings: Settings,
  printerLogo?: string | null
) => {
  const html = getReceiptHtml(order, settings, printerLogo);
  executePrint(html);
};

const executePrint = (html: string) => {
  if (typeof document === 'undefined') {
    return;
  }

  const iframe = document.createElement('iframe');

  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;

  if (!doc) {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  const printWhenReady = () => {
    const printWindow = iframe.contentWindow;

    if (!printWindow) {
      cleanup();
      return;
    }

    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        printWindow.focus();
        printWindow.addEventListener('afterprint', cleanup);
        printWindow.print();
        setTimeout(cleanup, 10000);
      } catch (e) {
        console.error('Print execution failed:', e);
        cleanup();
      }
    };

    const images = Array.from(doc.images || []);
    if (images.length === 0 || images.every((img) => img.complete && img.naturalWidth > 0)) {
      triggerPrint();
    } else {
      let loaded = 0;
      const onImageFinish = () => {
        loaded++;
        if (loaded >= images.length) {
          triggerPrint();
        }
      };

      images.forEach((img) => {
        if (img.complete && img.naturalWidth > 0) {
          onImageFinish();
        } else {
          img.onload = onImageFinish;
          img.onerror = onImageFinish;
        }
      });

      // Safety fallback: print after 400ms even if an image takes too long
      setTimeout(triggerPrint, 400);
    }
  };

  iframe.onload = printWhenReady;
};