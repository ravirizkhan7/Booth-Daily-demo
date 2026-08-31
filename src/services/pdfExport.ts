import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportData } from '../utils/reportUtils';
import { formatRupiah, formatDate } from '../utils/formatters';

export interface PDFReportOptions {
  reportData: ReportData;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  printedBy?: string;
  filename?: string;
}

export const exportReportToPDF = ({
  reportData,
  storeName = 'Booth Daily',
  storeAddress = 'Booth Daily POS Outlet',
  storePhone = '-',
  printedBy = 'Owner',
  filename
}: PDFReportOptions) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageCenterX = pageWidth / 2;
  const primaryColor: [number, number, number] = [59, 42, 31]; // Coffee Dark #3B2A1F
  const secondaryColor: [number, number, number] = [198, 139, 89]; // Warm Accent #C68B59
  const tableHeaderColor: [number, number, number] = [59, 42, 31];
  const tableAltColor: [number, number, number] = [247, 245, 242]; // #F7F5F2

  let currentY = 18;

  // 1. BRANDING HEADER — Judul laporan jadi elemen utama, nama toko menyertainya
  // di baris & baseline yang sama, lalu alamat di bawahnya.
  const titleText = 'LAPORAN KEUANGAN & BISNIS';
  const storeNameText = ` ${storeName.toUpperCase()}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  const titleWidth = doc.getTextWidth(titleText);
  const storeNameWidth = doc.getTextWidth(storeNameText);

  const headerLineStartX = pageCenterX - (titleWidth + storeNameWidth) / 2;

  doc.setTextColor(...primaryColor);
  doc.text(titleText, headerLineStartX, currentY);

  doc.setTextColor(...primaryColor);
  doc.text(storeNameText, headerLineStartX + titleWidth, currentY);

  currentY += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`${storeAddress} | Telp: ${storePhone}`, pageCenterX, currentY, { align: 'center' });

  currentY += 4;
  doc.setDrawColor(...secondaryColor);
  doc.setLineWidth(0.8);
  doc.line(14, currentY, pageWidth - 14, currentY);

  // METADATA PERIODE & CETAK
  currentY += 5;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  const printDateStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());

  doc.text(`Periode Laporan : ${reportData.periodLabel}`, 14, currentY);
  doc.text(`Dicetak Oleh    : ${printedBy}`, pageWidth - 14, currentY, { align: 'right' });
  currentY += 4;
  doc.text(`Tanggal Cetak   : ${printDateStr}`, 14, currentY);
  doc.text(`Status Data     : Resmi Sistem POS`, pageWidth - 14, currentY, { align: 'right' });

  // 2. SECTION: RINGKASAN EKSEKUTIF (OVERVIEW KPIs)
  currentY += 4;
  autoTable(doc, {
    startY: currentY,
    head: [['TOTAL PENJUALAN', 'TOTAL PEMBELIAN', 'ESTIMASI HPP', 'ESTIMASI LABA KOTOR']],
    body: [
      [
        `${formatRupiah(reportData.totalSales)}\n(${reportData.totalOrdersCount} Transaksi)`,
        `${formatRupiah(reportData.totalPurchases)}\n(${reportData.totalPurchasesCount} Nota Belanja)`,
        `${formatRupiah(reportData.totalEstimatedHPP)}\n(Estimasi Biaya Bahan)`,
        `${formatRupiah(reportData.estimatedGrossProfit)}\n(Margin: ${reportData.grossProfitMarginPercent}%)`
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: tableHeaderColor,
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
      textColor: [40, 40, 40],
      cellPadding: 3
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // 3. SECTION: ARUS KAS OPERASIONAL & BREAKDOWN
  autoTable(doc, {
    startY: currentY,
    head: [['ARUS KAS OPERASIONAL', 'NOMINAL (RP)', 'METODE PEMBAYARAN', 'TOTAL OMZET']],
    body: [
      [
        'Uang Masuk (Penjualan)',
        formatRupiah(reportData.cashIn),
        `Tunai (Cash) - ${reportData.paymentBreakdown.cash.count} Trx`,
        `${formatRupiah(reportData.paymentBreakdown.cash.total)} (${reportData.paymentBreakdown.cash.percentage}%)`
      ],
      [
        'Uang Keluar (Pembelian Restok)',
        formatRupiah(reportData.cashOut),
        `QRIS / E-Wallet - ${reportData.paymentBreakdown.qris.count} Trx`,
        `${formatRupiah(reportData.paymentBreakdown.qris.total)} (${reportData.paymentBreakdown.qris.percentage}%)`
      ],
      [
        'SELISIH ARUS KAS PERIODE',
        formatRupiah(reportData.netCashFlow),
        `Tipe Dine In / Takeaway`,
        `Dine In: ${reportData.orderTypeBreakdown.dineIn.count} | Takeaway: ${reportData.orderTypeBreakdown.takeaway.count}`
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [90, 70, 55],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: 50,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { fontStyle: 'bold', halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 2;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text(
    '* Selisih Arus Kas menunjukkan perbedaan uang masuk dari penjualan dan uang keluar pembelian bahan, bukan laba bersih.',
    14,
    currentY + 2
  );

  currentY += 5;

  // 4. SECTION: MENU TERLARIS (TOP SELLING)
  const topProductsRows = reportData.topProducts.slice(0, 5).map((item, idx) => [
    `#${idx + 1}`,
    item.name,
    `${item.qty} Porsi`,
    formatRupiah(item.totalSales),
    `${item.percentage}%`
  ]);

  if (topProductsRows.length === 0) {
    topProductsRows.push(['-', 'Tidak ada penjualan produk pada periode ini', '-', '-', '-']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['RANK', 'MENU TERLARIS (TOP 5)', 'QTY TERJUAL', 'TOTAL PENDAPATAN', 'KONTRIBUSI']],
    body: topProductsRows,
    theme: 'striped',
    headStyles: {
      fillColor: tableHeaderColor,
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      2: { halign: 'center', fontStyle: 'bold' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: tableAltColor
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 5. SECTION: PEMBELIAN & RESTOK BAHAN (PURCHASES)
  const purchaseTableRows = reportData.filteredPurchases.map(p => [
    p.purchase_number,
    p.date || formatDate(p.created_at),
    p.supplier,
    `${p.items ? p.items.length : 0} Barang`,
    formatRupiah(p.total_amount)
  ]);

  if (purchaseTableRows.length === 0) {
    purchaseTableRows.push(['-', '-', 'Tidak ada transaksi belanja restok pada periode ini', '-', 'Rp 0']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['NO. NOTA / PO', 'TANGGAL', 'SUPPLIER / VENDOR', 'JUMLAH ITEM', 'TOTAL BIAYA']],
    body: purchaseTableRows,
    foot: [
      [
        'TOTAL PEMBELIAN PERIODE',
        '',
        '',
        `${reportData.totalPurchasesCount} Nota`,
        formatRupiah(reportData.totalPurchases)
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [140, 45, 45], // Maroon red for purchases
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: [245, 230, 230],
      textColor: [140, 45, 45],
      fontSize: 8,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: { halign: 'center' },
      4: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 6. SECTION: DETAIL TRANSAKSI PENJUALAN (SALES ORDERS)
  const ordersTableRows = reportData.filteredOrders.map(o => [
    o.order_number,
    formatDate(o.created_at),
    o.created_by_name || 'Kasir',
    o.order_type === 'take_away' ? 'Takeaway' : 'Dine In',
    String(o.payment?.method || 'Cash').toUpperCase(),
    formatRupiah(o.total_amount)
  ]);

  if (ordersTableRows.length === 0) {
    ordersTableRows.push(['-', '-', 'Tidak ada transaksi penjualan pada periode ini', '-', '-', 'Rp 0']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['NO. PESANAN', 'TANGGAL & WAKTU', 'KASIR', 'TIPE', 'PEMBAYARAN', 'TOTAL OMZET']],
    body: ordersTableRows,
    foot: [
      [
        'TOTAL PENJUALAN PERIODE',
        '',
        '',
        '',
        `${reportData.totalOrdersCount} Trx`,
        formatRupiah(reportData.totalSales)
      ]
    ],
    theme: 'striped',
    headStyles: {
      fillColor: tableHeaderColor,
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: [235, 230, 225],
      textColor: [59, 42, 31],
      fontSize: 8,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 1.8
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: tableAltColor
    },
    margin: { left: 14, right: 14 }
  });

  // 7. SIGNATURE BLOCK & FOOTER
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const pageHeight = doc.internal.pageSize.getHeight();

  // If signature exceeds page, add new page
  if (finalY + 30 > pageHeight - 15) {
    doc.addPage();
  }

  const signY = finalY + 30 > pageHeight - 15 ? 20 : finalY;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  doc.text('Dibuat & Diverifikasi oleh:', 25, signY);
  doc.text('Disetujui oleh Owner:', pageWidth - 65, signY);

  doc.line(20, signY + 16, 65, signY + 16);
  doc.line(pageWidth - 70, signY + 16, pageWidth - 25, signY + 16);

  doc.text(printedBy || 'Kasir / Barista', 42.5, signY + 20, { align: 'center' });
  doc.text('Muhammad Ravi Rizkhan', pageWidth - 47.5, signY + 20, { align: 'center' });

  // Page Numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Booth Daily POS • Laporan Keuangan & Bisnis • Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
  }

  const outFilename = filename || `Laporan_Keuangan_BoothDaily_${new Date().toISOString().slice(0, 10)}`;
  doc.save(`${outFilename}.pdf`);
};