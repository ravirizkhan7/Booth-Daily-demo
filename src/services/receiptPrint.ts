import { formatRupiah, formatDate } from '../utils/formatters';
import { Order, Settings } from '../types';
import brandIcon from '../assets/icon.png';

const getReceiptCSS = () => `
@page {
  margin: 0;
  size: auto;
}

*, *:before, *:after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  margin: 0 auto;
  padding: 12px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 11px;
  line-height: 1.35;
  color: #1c1917;
  background: #fff;
  width: 100%;
  max-width: 78mm;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.receipt-copy {
  width: 100%;
  max-width: 78mm;
  margin: 0 auto;
  padding: 0;
  box-sizing: border-box;
}

.staff-copy {
  page-break-before: always;
  break-before: page;
  padding-top: 12px;
}

.text-center { text-align: center; }
.text-right { text-align: right; }
.text-left { text-align: left; }
.font-bold { font-weight: 700; }
.font-black { font-weight: 900; }
.uppercase { text-transform: uppercase; }
.italic { font-style: italic; }

/* Section dividers — mirroring border-b border-dashed border-stone-300 pb-3 of modal */
.border-dashed-b {
  border-bottom: 1px dashed #d6d3d1;
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.border-dashed-t {
  border-top: 1px dashed #d6d3d1;
  padding-top: 8px;
  margin-top: 8px;
}

/* Store Header */
.store-header {
  text-align: center;
  border-bottom: 1px dashed #d6d3d1;
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.store-logo {
  display: flex;
  justify-content: center;
  margin-bottom: 4px;
}

.store-logo img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  display: inline-block;
}

.store-name {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #3b2a1f;
  margin-bottom: 2px;
}

.staff-badge {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: #3b2a1f;
  margin: 3px 0 2px 0;
  text-transform: uppercase;
}

.tagline {
  font-size: 9.5px;
  color: #78716c;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1.25;
  white-space: pre-line;
}

.address-line {
  font-size: 9.5px;
  color: #57534e;
  line-height: 1.25;
  white-space: pre-line;
}

/* Rows */
.flex-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 10.5px;
  line-height: 1.35;
  margin-bottom: 3px;
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
  margin-bottom: 6px;
}

.item-block:last-child {
  margin-bottom: 0;
}

.item-main {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: 10.5px;
  line-height: 1.35;
}

.item-notes {
  font-size: 9.5px;
  font-style: italic;
  color: #78716c;
  padding-left: 10px;
  line-height: 1.25;
  margin-top: 1px;
}

.promo-note {
  font-size: 9.5px;
  font-style: italic;
  color: #059669;
  padding-left: 8px;
  line-height: 1.25;
  margin-top: -1px;
  margin-bottom: 3px;
}

/* Total Row */
.total-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 900;
  color: #1c1917;
  padding-top: 3px;
  margin-bottom: 4px;
}

/* Footer */
.receipt-footer {
  text-align: center;
  border-top: 1px dashed #d6d3d1;
  padding-top: 8px;
  margin-top: 8px;
  font-size: 9.5px;
  color: #78716c;
  line-height: 1.35;
  white-space: pre-line;
}

.receipt-footer-bold {
  font-weight: 600;
  color: #44403c;
  margin-top: 2px;
  white-space: pre-line;
}
`;

export const printTestReceipt = (settings: Partial<Settings>) => {
  const date = new Date();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Test Print</title>
      <style>
        ${getReceiptCSS()}
      </style>
    </head>

    <body>

      <div class="receipt-copy">

        <div class="store-header">
          <div class="store-logo">
            <img src="${brandIcon}" alt="Booth Daily" />
          </div>
          <div class="store-name">${settings.store_name || 'BOOTH DAILY'}</div>
          <div class="staff-badge">PRINTER TEST</div>
        </div>

        <div class="border-dashed-b">
          <div class="flex-row">
            <span class="label-dim">Tanggal:</span>
            <span>${date.toLocaleDateString('id-ID')}</span>
          </div>
          <div class="flex-row">
            <span class="label-dim">Waktu:</span>
            <span>${date.toLocaleTimeString('id-ID')}</span>
          </div>
        </div>

        <div class="border-dashed-b text-center font-bold" style="padding: 6px 0;">
          Test print berhasil.
        </div>

        <div class="receipt-footer">
          <div>${settings.store_name || 'Booth Daily'}</div>
          <div class="receipt-footer-bold">Printer Test OK</div>
        </div>

      </div>

    </body>
    </html>
  `;

  executePrint(html);
};

export const printReceipt = (order: Order, settings: Settings) => {
  const storeName = settings.store_name || 'BOOTH DAILY';

  const orderType =
    order.order_type === 'dine_in'
      ? 'DINE IN'
      : 'TAKE AWAY';

  const custName = order.customer_name
    ? ` (${order.customer_name})`
    : '';

  const isRefunded = order.payment?.status === 'refunded';

  // Snapshot fields — read directly from backend order, NEVER recalculate
  const subtotal     = order.subtotal     ?? 0;
  const discount     = order.discount     ?? 0;
  const discountName = order.discount_name ?? null;
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
            <span>${item.qty}x ${item.product_name}</span>
            <span>${formatRupiah(item.subtotal)}</span>
          </div>
          ${
            item.notes
              ? `<div class="item-notes">Catatan: ${item.notes}</div>`
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
            <span>${item.qty}x ${item.product_name}</span>
          </div>
          ${
            item.notes
              ? `<div class="item-notes font-bold" style="color: #1c1917;">Catatan: ${item.notes}</div>`
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
        <div class="store-logo">
          <img src="${brandIcon}" alt="Booth Daily" />
        </div>
        <div class="store-name">${storeName}</div>
        ${settings.tagline ? `<div class="tagline">${settings.tagline}</div>` : ''}
        ${settings.address ? `<div class="address-line">${settings.address}</div>` : ''}
        ${settings.phone ? `<div class="address-line">Telp: ${settings.phone}</div>` : ''}
      </div>

      <!-- Order Info -->
      <div class="border-dashed-b">
        <div class="flex-row">
          <span class="label-dim">No:</span>
          <span class="font-bold">${order.order_number}</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Waktu:</span>
          <span>${formatDate(order.created_at)}</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Kasir:</span>
          <span>${order.created_by_name}</span>
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
          <span class="font-bold uppercase">${order.payment?.method?.toUpperCase() || '-'}</span>
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
              ${settings.receipt_header ? `<div>${settings.receipt_header}</div>` : ''}
              ${settings.receipt_footer ? `<div class="receipt-footer-bold">${settings.receipt_footer}</div>` : ''}
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
        <div class="store-logo">
          <img src="${brandIcon}" alt="Booth Daily" />
        </div>
        <div class="store-name">${storeName}</div>
        <div class="staff-badge">SALINAN STAFF</div>
        ${settings.tagline ? `<div class="tagline">${settings.tagline}</div>` : ''}
        ${settings.address ? `<div class="address-line">${settings.address}</div>` : ''}
        ${settings.phone ? `<div class="address-line">Telp: ${settings.phone}</div>` : ''}
      </div>

      <!-- Order Info -->
      <div class="border-dashed-b">
        <div class="flex-row">
          <span class="label-dim">No:</span>
          <span class="font-bold">${order.order_number}</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Waktu:</span>
          <span>${formatDate(order.created_at)}</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Kasir:</span>
          <span>${order.created_by_name}</span>
        </div>
        <div class="flex-row">
          <span class="label-dim">Tipe Pesanan:</span>
          <span class="font-bold uppercase" style="color: #c68b59;">${orderType}${custName}</span>
        </div>
      </div>

      <!-- Staff Detail Items -->
      <div class="border-dashed-b">
        <div class="font-bold" style="font-size: 10px; text-decoration: underline; margin-bottom: 4px;">
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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt_${order.order_number}</title>
      <style>
        ${getReceiptCSS()}
      </style>
    </head>
    <body>
      ${customerReceipt}
      ${staffReceipt}
    </body>
    </html>
  `;

  executePrint(html);
};

const executePrint = (html: string) => {
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
    document.body.removeChild(iframe);
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