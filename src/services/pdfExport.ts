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
  storeAddress = 'Outlet POS',
  storePhone = '-',
  printedBy = 'Owner',
  filename
}: PDFReportOptions) => {
  const DocConstructor: any = (jsPDF as any).jsPDF || jsPDF;
  const doc = new DocConstructor({
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
  if (reportData.filterUserId && reportData.filterUserId !== 'all') {
    const roleSuffix = reportData.filterUserRole
      ? ` (${reportData.filterUserRole.toLowerCase() === 'owner' ? 'Owner' : reportData.filterUserRole.toLowerCase() === 'karyawan' ? 'Karyawan' : reportData.filterUserRole})`
      : '';
    const userLabel = `${reportData.filterUserName || reportData.filterUserId}${roleSuffix}`;
    doc.text(`Kasir / User    : ${userLabel}`, pageWidth - 14, currentY, { align: 'right' });
  } else {
    doc.text(`Status Data     : Resmi Sistem POS`, pageWidth - 14, currentY, { align: 'right' });
  }

  // 2. SECTION: RINGKASAN EKSEKUTIF (OVERVIEW KPIs)
  currentY += 4;
  let hppSubText = 'Snapshot Riil (WAC)';
  if (reportData.totalOrdersCount === 0 && reportData.periodRefundOrders.length === 0) {
    hppSubText = '-';
  } else if (reportData.hasLegacyEstimatedHPP && reportData.hppSnapshotOrdersCount === 0 && reportData.hppPartialSnapshotOrdersCount === 0) {
    hppSubText = 'Estimasi Legacy';
  } else if (reportData.hasLegacyEstimatedHPP || reportData.hasPartialSnapshotHPP) {
    hppSubText = `Data Campuran (${reportData.hppSnapshotOrdersCount} Riil, ${reportData.hppLegacyEstimateOrdersCount} Est)`;
  } else {
    hppSubText = `Snapshot Riil (${reportData.hppSnapshotOrdersCount} Trx)`;
  }

  autoTable(doc, {
    startY: currentY,
    head: [['TOTAL PENJUALAN', 'TOTAL PEMBELIAN', 'ESTIMASI HPP', 'ESTIMASI LABA KOTOR']],
    body: [
      [
        `${formatRupiah(reportData.totalSales)}\n(${reportData.totalOrdersCount} Transaksi)`,
        `${formatRupiah(reportData.totalPurchases)}\n(${reportData.totalPurchasesCount} Nota Belanja)`,
        `${formatRupiah(reportData.totalEstimatedHPP)}\n(${hppSubText})`,
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
    head: [['ARUS KAS OPERASIONAL', 'NOMINAL (RP)', 'RINCIAN / METODE', 'TOTAL / DETAIL']],
    body: [
      [
        'Uang Masuk (Penjualan)',
        formatRupiah(reportData.cashIn),
        `Tunai: ${formatRupiah(reportData.paymentBreakdown.cash.total)}`,
        `QRIS: ${formatRupiah(reportData.paymentBreakdown.qris.total)}`
      ],
      [
        'Uang Keluar (Belanja & Refund)',
        formatRupiah(reportData.cashOut),
        `Belanja: ${formatRupiah(reportData.totalPurchases)}`,
        `Total Refund: ${formatRupiah(reportData.totalRefunds)}`
      ],
      [
        '  • Rincian Pengembalian Dana',
        formatRupiah(reportData.totalRefunds),
        `Tunai: ${formatRupiah(reportData.cashRefunds)}`,
        `Non-Tunai: ${formatRupiah(reportData.qrisRefunds)}${reportData.unknownRefunds > 0 ? ` | Lama: ${formatRupiah(reportData.unknownRefunds)}` : ''}`
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
    '* Arus Kas Operasional merupakan gabungan operasional tunai dan non-tunai (bank/QRIS), bukan saldo fisik laci kasir.',
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
  const details = reportData.transactionDetails || reportData.transactionDetailOrders.map(o => {
    const isRefunded = o.payment?.status === 'refunded';
    const omzet = isRefunded ? 0 : (Number(o.total_amount) || 0);
    const hpp = typeof o.total_hpp === 'number' && o.total_hpp >= 0 ? o.total_hpp : 0;
    const grossProfit = omzet - hpp;
    const isLegacy = o.hpp_source === 'legacy_estimate' || typeof o.total_hpp !== 'number';
    const isPartial = o.hpp_source === 'partial_snapshot';
    const hppCategoryLabel = isLegacy ? 'Estimasi Legacy' : (isPartial ? 'Partial Snapshot' : 'Snapshot Riil');
    return {
      order: o,
      omzet,
      hpp,
      grossProfit,
      marginPercent: omzet > 0 ? Math.round((grossProfit / omzet) * 1000) / 10 : 0,
      hppCategory: (isLegacy ? 'legacy_estimate' : (isPartial ? 'partial_snapshot' : 'snapshot_riil')) as any,
      hppCategoryLabel,
    };
  });

  const ordersTableRows = details.map(d => {
    const o = d.order;
    const isRefunded = o.payment?.status === 'refunded';
    return [
      o.order_number,
      formatDate(o.created_at),
      o.created_by_name || 'Kasir',
      isRefunded ? 'REFUNDED' : 'SELESAI',
      isRefunded ? 'Rp 0' : formatRupiah(o.total_amount),
      formatRupiah(d.hpp),
      formatRupiah(d.grossProfit),
      d.hppCategoryLabel
    ];
  });

  if (ordersTableRows.length === 0) {
    ordersTableRows.push(['-', '-', 'Tidak ada transaksi penjualan pada periode ini', '-', 'Rp 0', 'Rp 0', 'Rp 0', '-']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['NO. PESANAN', 'TANGGAL & WAKTU', 'KASIR', 'STATUS', 'OMZET', 'HPP', 'LABA KOTOR', 'SUMBER HPP']],
    body: ordersTableRows,
    foot: [
      [
        'TOTAL PERIODE',
        '',
        '',
        `${reportData.totalOrdersCount} Trx Selesai`,
        formatRupiah(reportData.totalSales),
        formatRupiah(reportData.totalEstimatedHPP),
        formatRupiah(reportData.estimatedGrossProfit),
        ''
      ]
    ],
    theme: 'striped',
    headStyles: {
      fillColor: tableHeaderColor,
      textColor: 255,
      fontSize: 7.5,
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: [235, 230, 225],
      textColor: [59, 42, 31],
      fontSize: 7.5,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 6.8,
      cellPadding: 1.8
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 26 },
      1: { cellWidth: 24 },
      2: { cellWidth: 20 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 23 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
      7: { halign: 'center', cellWidth: 23 }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'REFUNDED') {
          data.cell.styles.textColor = [190, 30, 30];
        } else if (data.cell.raw === 'SELESAI') {
          data.cell.styles.textColor = [20, 130, 60];
        }
      }
      if (data.section === 'body' && data.column.index === 6) {
        const valStr = String(data.cell.raw || '');
        if (valStr.includes('-')) {
          data.cell.styles.textColor = [190, 30, 30];
        }
      }
      if (data.section === 'foot') {
        if (data.column.index === 4 || data.column.index === 5 || data.column.index === 6) {
          data.cell.styles.halign = 'right';
        }
      }
    },
    alternateRowStyles: {
      fillColor: tableAltColor
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 7. SECTION: DAFTAR PENGEMBALIAN DANA (REFUND) PERIODE INI
  const refundTableRows = reportData.periodRefundOrders.map(o => {
    const methodStr = o.refund_method === 'cash'
      ? 'Tunai'
      : o.refund_method === 'qris'
      ? 'QRIS'
      : 'Tidak Diketahui';
    return [
      o.order_number,
      formatDate(o.created_at),
      o.refunded_at ? formatDate(o.refunded_at) : '-',
      o.refunded_by_name || 'Owner',
      methodStr,
      o.refund_reason || '-',
      formatRupiah(o.total_amount)
    ];
  });

  if (refundTableRows.length === 0) {
    refundTableRows.push(['-', '-', '-', '-', '-', 'Tidak ada transaksi refund pada periode ini', 'Rp 0']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['NO. NOTA ASAL', 'WAKTU ASAL', 'WAKTU REFUND', 'PETUGAS', 'METODE', 'ALASAN', 'NOMINAL REFUND']],
    body: refundTableRows,
    foot: [
      [
        'TOTAL REFUND PERIODE',
        '',
        '',
        '',
        '',
        `${reportData.refundCount} Transaksi`,
        formatRupiah(reportData.totalRefunds)
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [160, 45, 65],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: [252, 235, 238],
      textColor: [160, 45, 65],
      fontSize: 8,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 1.8
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      4: { halign: 'center', fontStyle: 'bold' },
      6: { halign: 'right', fontStyle: 'bold' }
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
  const effectiveStoreName = storeName?.trim() || 'Booth Daily';
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `${effectiveStoreName} POS • Laporan Keuangan & Bisnis • Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
  }

  const safeStoreName = effectiveStoreName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const outFilename = filename || `Laporan_Keuangan_${safeStoreName}_${new Date().toISOString().slice(0, 10)}`;
  doc.save(`${outFilename}.pdf`);
};