import * as XLSX from 'xlsx';
import { ReportData } from '../utils/reportUtils';

export interface ExcelReportOptions {
  reportData: ReportData;
  storeName?: string;
  filename?: string;
}

// ─── COLOUR PALETTE ─────────────────────────────────────────────────────────
const COL = {
  coffeeDark: '3B2A1F',
  coffeeMid: '5C3D2E',
  stone: 'F7F5F2',
  stoneMid: 'E8E3DE',
  white: 'FFFFFF',
  pos: '15803D',
  neg: 'DC2626',
  posBg: 'DCFCE7',
  negBg: 'FEE2E2',
  muted: '78716C',
  border: 'D6CEBE',
};

// ─── STYLE FACTORY ──────────────────────────────────────────────────────────
type Align = 'left' | 'center' | 'right';

interface Opts {
  bold?: boolean;
  sz?: number;
  fgColor?: string;
  bgColor?: string;
  hAlign?: Align;
  italic?: boolean;
  border?: boolean;
  wrap?: boolean;
}

function sty(o: Opts): any {
  const s: any = {};
  s.font = { name: 'Calibri', sz: o.sz ?? 10, bold: !!o.bold, italic: !!o.italic };
  if (o.fgColor) s.font.color = { rgb: o.fgColor };
  if (o.bgColor) s.fill = { patternType: 'solid', fgColor: { rgb: o.bgColor } };
  s.alignment = { horizontal: o.hAlign ?? 'left', vertical: 'middle', wrapText: !!o.wrap };
  if (o.border) {
    const b = { style: 'thin' as const, color: { rgb: COL.border } };
    s.border = { top: b, bottom: b, left: b, right: b };
  }
  return s;
}

// Pre-built style presets
const S = {
  h1: sty({ bold: true, sz: 16, fgColor: COL.white, bgColor: COL.coffeeDark, hAlign: 'center' }),
  h2: sty({ bold: true, sz: 11, fgColor: COL.white, bgColor: COL.coffeeMid, hAlign: 'center' }),
  mKey: sty({ bold: true, sz: 10, fgColor: COL.coffeeDark, bgColor: COL.stone }),
  mVal: sty({ sz: 10, fgColor: COL.coffeeDark, bgColor: COL.stone }),
  sec: sty({ bold: true, sz: 10, fgColor: COL.white, bgColor: COL.coffeeMid, border: true }),
  thL: sty({ bold: true, sz: 10, fgColor: COL.white, bgColor: COL.coffeeDark, hAlign: 'left', border: true }),
  thC: sty({ bold: true, sz: 10, fgColor: COL.white, bgColor: COL.coffeeDark, hAlign: 'center', border: true }),
  thR: sty({ bold: true, sz: 10, fgColor: COL.white, bgColor: COL.coffeeDark, hAlign: 'right', border: true }),
  tdL: sty({ sz: 10, fgColor: COL.coffeeDark, bgColor: COL.white, hAlign: 'left', border: true }),
  tdC: sty({ sz: 10, fgColor: COL.coffeeDark, bgColor: COL.white, hAlign: 'center', border: true }),
  tdR: sty({ sz: 10, fgColor: COL.coffeeDark, bgColor: COL.white, hAlign: 'right', border: true }),
  tdAL: sty({ sz: 10, fgColor: COL.coffeeDark, bgColor: COL.stone, hAlign: 'left', border: true }),
  tdAC: sty({ sz: 10, fgColor: COL.coffeeDark, bgColor: COL.stone, hAlign: 'center', border: true }),
  tdAR: sty({ sz: 10, fgColor: COL.coffeeDark, bgColor: COL.stone, hAlign: 'right', border: true }),
  totL: sty({ bold: true, sz: 10, fgColor: COL.coffeeDark, bgColor: COL.stoneMid, hAlign: 'left', border: true }),
  totC: sty({ bold: true, sz: 10, fgColor: COL.coffeeDark, bgColor: COL.stoneMid, hAlign: 'center', border: true }),
  totR: sty({ bold: true, sz: 10, fgColor: COL.coffeeDark, bgColor: COL.stoneMid, hAlign: 'right', border: true }),
  posL: sty({ bold: true, sz: 10, fgColor: COL.pos, bgColor: COL.posBg, hAlign: 'left', border: true }),
  posR: sty({ bold: true, sz: 10, fgColor: COL.pos, bgColor: COL.posBg, hAlign: 'right', border: true }),
  negL: sty({ bold: true, sz: 10, fgColor: COL.neg, bgColor: COL.negBg, hAlign: 'left', border: true }),
  negR: sty({ bold: true, sz: 10, fgColor: COL.neg, bgColor: COL.negBg, hAlign: 'right', border: true }),
  disc: sty({ sz: 9, fgColor: COL.muted, bgColor: COL.white, hAlign: 'left', italic: true }),
  blank: sty({ bgColor: COL.white }),
};

// ─── CELL HELPERS ────────────────────────────────────────────────────────────
const IDR = '"Rp "#,##0';

function cs(v: string | number | null | undefined, style: any): XLSX.CellObject {
  const val = v ?? '';
  return { v: val, t: typeof val === 'number' ? 'n' : 's', s: style };
}

function cn(v: number, style: any): XLSX.CellObject {
  return { v, t: 'n', z: IDR, s: style };
}

function bl(): XLSX.CellObject {
  return { v: '', t: 's', s: S.blank };
}

function emptyRow(n: number): XLSX.CellObject[] {
  return Array.from({ length: n }, () => bl());
}

// ─── WORKSHEET BUILDER ───────────────────────────────────────────────────────
function toWS(rows: XLSX.CellObject[][]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  let maxC = 0;
  rows.forEach((row, r) => {
    if (row.length > maxC) maxC = row.length;
    row.forEach((cell, c) => { ws[XLSX.utils.encode_cell({ r, c })] = cell; });
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: maxC - 1 } });
  return ws;
}

// ─── DATE FORMATTERS ─────────────────────────────────────────────────────────
function fd(s?: string | null): string {
  if (!s) return '-';
  const d = new Date(s);
  return isNaN(d.getTime())
    ? (s || '-')
    : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function fdt(s?: string | null): string {
  if (!s) return '-';
  const d = new Date(s);
  return isNaN(d.getTime())
    ? (s || '-')
    : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHEET 1 — RINGKASAN LAPORAN (Executive Summary)
// ═══════════════════════════════════════════════════════════════════════════════
function buildSummarySheet(rd: ReportData, storeName: string): XLSX.WorkSheet {
  const NC = 5;
  const rows: XLSX.CellObject[][] = [];
  const merges: XLSX.Range[] = [];
  let ri = -1;

  function push(row: XLSX.CellObject[]) { rows.push(row); return ++ri; }
  function span(r: number, c1: number, c2: number) { merges.push({ s: { r, c: c1 }, e: { r, c: c2 } }); }
  function fullSpan(r: number) { span(r, 0, NC - 1); }
  function fill(style: any) { return Array.from({ length: NC - 1 }, () => cs('', style)); }

  // ── HEADER ──────────────────────────────────────────────────────────────────
  fullSpan(push([cs(storeName.toUpperCase(), S.h1), ...fill(S.h1)]));
  fullSpan(push([cs('LAPORAN KEUANGAN & BISNIS OUTLET', S.h2), ...fill(S.h2)]));

  const printDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  {
    const r = push([cs('Periode Laporan', S.mKey), cs(rd.periodLabel, S.mVal), cs('', S.mVal), cs('', S.mVal), cs('', S.mVal)]);
    span(r, 1, NC - 1);
  }
  {
    const r = push([cs('Tanggal Cetak', S.mKey), cs(printDate, S.mVal), cs('', S.mVal), cs('', S.mVal), cs('', S.mVal)]);
    span(r, 1, NC - 1);
  }
  push(emptyRow(NC));

  // ── SECTION 1: RINGKASAN EKSEKUTIF ──────────────────────────────────────────
  fullSpan(push([cs('  RINGKASAN EKSEKUTIF — KINERJA KEUANGAN PERIODE INI', S.sec), ...fill(S.sec)]));
  push([cs('INDIKATOR KEUANGAN', S.thL), cs('NOMINAL (Rp)', S.thR), cs('JUMLAH / SATUAN', S.thC), cs('KETERANGAN', S.thL), cs('INFO TAMBAHAN', S.thL)]);

  const kpis: [string, number, string, string, string][] = [
    ['Total Penjualan (Omzet)', rd.totalSales, `${rd.totalOrdersCount} Transaksi`, 'Total penerimaan periode ini', `AOV Rp ${rd.avgOrderValue.toLocaleString('id-ID')}`],
    ['Total Pembelian (Restok)', rd.totalPurchases, `${rd.totalPurchasesCount} Nota`, 'Pengeluaran bahan baku periode ini', 'Hanya periode aktif'],
    ['Estimasi HPP Menu', rd.totalEstimatedHPP, 'Estimasi', 'Biaya bahan untuk menu terjual', 'Resep → cost_price → estimasi 40%'],
    ['Estimasi Laba Kotor', rd.estimatedGrossProfit, `Margin ${rd.grossProfitMarginPercent}%`, 'Penjualan dikurangi Estimasi HPP', 'Bukan laba bersih'],
    ['Rata-rata Nilai Struk (AOV)', rd.avgOrderValue, 'Per Transaksi', `Rata-rata dari ${rd.totalOrdersCount} transaksi`, ''],
  ];
  kpis.forEach(([label, val, unit, note, info], i) => {
    const a = i % 2 === 1;
    push([cs(label, a ? S.tdAL : S.tdL), cn(val, a ? S.tdAR : S.tdR), cs(unit, a ? S.tdAC : S.tdC), cs(note, a ? S.tdAL : S.tdL), cs(info, a ? S.tdAL : S.tdL)]);
  });
  push(emptyRow(NC));

  // ── SECTION 2: ARUS KAS OPERASIONAL ─────────────────────────────────────────
  fullSpan(push([cs('  ARUS KAS OPERASIONAL PERIODE INI', S.sec), ...fill(S.sec)]));
  push([cs('POS ARUS KAS', S.thL), cs('NOMINAL (Rp)', S.thR), cs('STATUS', S.thC), cs('KETERANGAN', S.thL), cs('SUMBER', S.thL)]);

  push([cs('Uang Masuk (Penjualan)', S.posL), cn(rd.cashIn, S.posR), cs('Masuk', S.posL), cs('Total penerimaan transaksi kasir', S.tdAL), cs(`${rd.totalOrdersCount} Transaksi`, S.tdAL)]);
  push([cs('Uang Keluar (Total Belanja & Refund)', S.negL), cn(rd.cashOut, S.negR), cs('Keluar', S.negL), cs('Total pengeluaran bahan & refund', S.tdL), cs(`${rd.totalPurchasesCount} Nota Belanja • ${rd.refundCount} Refund`, S.tdL)]);
  push([cs('  • Belanja Restok Bahan', S.tdL), cn(rd.totalPurchases, S.tdR), cs('Belanja', S.tdC), cs('Pengeluaran belanja bahan baku', S.tdL), cs(`${rd.totalPurchasesCount} Nota`, S.tdL)]);
  push([cs('  • Refund Tunai (Laci)', S.tdL), cn(rd.cashRefunds, S.tdR), cs('Refund', S.tdC), cs('Pengembalian dana tunai dari laci kasir', S.tdL), cs('Metode Tunai', S.tdL)]);
  push([cs('  • Refund QRIS / Non-Tunai', S.tdL), cn(rd.qrisRefunds, S.tdR), cs('Refund', S.tdC), cs('Pengembalian dana non-tunai / QRIS', S.tdL), cs('Metode Non-Tunai', S.tdL)]);
  if (rd.unknownRefunds > 0) {
    push([cs('  • Refund Tidak Diketahui (Data Lama)', S.tdL), cn(rd.unknownRefunds, S.tdR), cs('Refund', S.tdC), cs('Transaksi refund lama tanpa metode eksplisit', S.tdL), cs('Data Lama', S.tdL)]);
  }

  const cfPos = rd.netCashFlow >= 0;
  push([
    cs('SELISIH ARUS KAS PERIODE', cfPos ? S.posL : S.negL),
    cn(rd.netCashFlow, cfPos ? S.posR : S.negR),
    cs(cfPos ? 'Positif' : 'Negatif', cfPos ? S.posL : S.negL),
    cs('Uang Masuk dikurangi Uang Keluar', cfPos ? S.tdAL : S.tdL),
    cs('Bukan laba bersih', cfPos ? S.tdAL : S.tdL),
  ]);
  {
    const r = push([cs('* Arus kas operasional merupakan gabungan tunai dan non-tunai, bukan saldo fisik laci kasir. Belum mencakup biaya operasional lain (sewa, listrik, dll).', S.disc), ...fill(S.disc)]);
    fullSpan(r);
  }
  push(emptyRow(NC));

  // ── SECTION 3: METODE PEMBAYARAN ─────────────────────────────────────────────
  fullSpan(push([cs('  METODE PEMBAYARAN', S.sec), ...fill(S.sec)]));
  push([cs('METODE', S.thL), cs('TOTAL OMZET (Rp)', S.thR), cs('JML TRANSAKSI', S.thC), cs('KONTRIBUSI (%)', S.thC), cs('', S.thC)]);

  const pmts: [string, number, number, number][] = [
    ['Tunai (Cash)', rd.paymentBreakdown.cash.total, rd.paymentBreakdown.cash.count, rd.paymentBreakdown.cash.percentage],
    ['QRIS / E-Wallet', rd.paymentBreakdown.qris.total, rd.paymentBreakdown.qris.count, rd.paymentBreakdown.qris.percentage],
  ];
  if (rd.paymentBreakdown.other && rd.paymentBreakdown.other.count > 0) {
    pmts.push(['Metode Lain', rd.paymentBreakdown.other.total, rd.paymentBreakdown.other.count, rd.paymentBreakdown.other.percentage]);
  }
  pmts.forEach(([label, total, count, pct], i) => {
    const a = i % 2 === 1;
    push([cs(label, a ? S.tdAL : S.tdL), cn(total, a ? S.tdAR : S.tdR), cs(`${count} Trx`, a ? S.tdAC : S.tdC), cs(`${pct}%`, a ? S.tdAC : S.tdC), cs('', a ? S.tdAL : S.tdL)]);
  });
  push([cs(`TOTAL (${rd.totalOrdersCount} Transaksi)`, S.totL), cn(rd.totalSales, S.totR), cs('', S.totC), cs('100%', S.totC), cs('', S.totL)]);
  push(emptyRow(NC));

  // ── SECTION 4: TIPE PESANAN ───────────────────────────────────────────────────
  fullSpan(push([cs('  TIPE PESANAN', S.sec), ...fill(S.sec)]));
  push([cs('TIPE PESANAN', S.thL), cs('TOTAL OMZET (Rp)', S.thR), cs('JML PESANAN', S.thC), cs('KONTRIBUSI (%)', S.thC), cs('', S.thC)]);
  ([
    ['Dine In (Makan di Tempat)', rd.orderTypeBreakdown.dineIn.total, rd.orderTypeBreakdown.dineIn.count, rd.orderTypeBreakdown.dineIn.percentage],
    ['Takeaway (Bawa Pulang)', rd.orderTypeBreakdown.takeaway.total, rd.orderTypeBreakdown.takeaway.count, rd.orderTypeBreakdown.takeaway.percentage],
  ] as [string, number, number, number][]).forEach(([label, total, count, pct], i) => {
    const a = i % 2 === 1;
    push([cs(label, a ? S.tdAL : S.tdL), cn(total, a ? S.tdAR : S.tdR), cs(`${count} Pesanan`, a ? S.tdAC : S.tdC), cs(`${pct}%`, a ? S.tdAC : S.tdC), cs('', a ? S.tdAL : S.tdL)]);
  });
  push([cs(`TOTAL (${rd.totalOrdersCount} Pesanan)`, S.totL), cn(rd.totalSales, S.totR), cs('', S.totC), cs('100%', S.totC), cs('', S.totL)]);
  push(emptyRow(NC));

  // ── SECTION 5: MENU TERLARIS ──────────────────────────────────────────────────
  fullSpan(push([cs(`  TOP ${Math.min(10, rd.topProducts.length > 0 ? rd.topProducts.length : 10)} MENU TERLARIS PERIODE INI`, S.sec), ...fill(S.sec)]));
  push([cs('RANK', S.thC), cs('NAMA MENU', S.thL), cs('QTY TERJUAL', S.thC), cs('TOTAL OMZET (Rp)', S.thR), cs('KONTRIBUSI (%)', S.thC)]);
  if (rd.topProducts.length === 0) {
    const r = push([cs('Belum ada penjualan menu pada periode ini.', S.disc), ...Array(NC - 1).fill(bl())]);
    fullSpan(r);
  } else {
    rd.topProducts.slice(0, 10).forEach((item, i) => {
      const a = i % 2 === 1;
      push([cs(`#${i + 1}`, a ? S.tdAC : S.tdC), cs(item.name, a ? S.tdAL : S.tdL), cs(`${item.qty} Porsi`, a ? S.tdAC : S.tdC), cn(item.totalSales, a ? S.tdAR : S.tdR), cs(`${item.percentage}%`, a ? S.tdAC : S.tdC)]);
    });
  }
  push(emptyRow(NC));

  // ── SECTION 6: RINGKASAN PEMBELIAN ────────────────────────────────────────────
  fullSpan(push([cs('  RINGKASAN PEMBELIAN & RESTOK BAHAN BAKU', S.sec), ...fill(S.sec)]));
  push([cs('NO. NOTA / PO', S.thL), cs('TOTAL BIAYA (Rp)', S.thR), cs('TANGGAL', S.thC), cs('SUPPLIER / VENDOR', S.thL), cs('CATATAN', S.thL)]);
  if (rd.filteredPurchases.length === 0) {
    const r = push([cs('Tidak ada pembelian bahan pada periode ini.', S.disc), ...Array(NC - 1).fill(bl())]);
    fullSpan(r);
  } else {
    rd.filteredPurchases.forEach((p, i) => {
      const a = i % 2 === 1;
      push([cs(p.purchase_number, a ? S.tdAL : S.tdL), cn(Number(p.total_amount) || 0, a ? S.tdAR : S.tdR), cs(fd(p.date || p.created_at), a ? S.tdAC : S.tdC), cs(p.supplier, a ? S.tdAL : S.tdL), cs(p.notes || '-', a ? S.tdAL : S.tdL)]);
    });
    {
      const r = push([cs(`TOTAL PEMBELIAN PERIODE (${rd.totalPurchasesCount} Nota)`, S.totL), cn(rd.totalPurchases, S.totR), cs('', S.totC), cs('', S.totL), cs('', S.totL)]);
      span(r, 2, NC - 1);
    }
  }

  // ── WORKSHEET SETUP ───────────────────────────────────────────────────────────
  const ws = toWS(rows);
  ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 36 }, { wch: 22 }, { wch: 20 }, { wch: 32 }, { wch: 28 }];
  ws['!rows'] = rows.map((_, i) => ({ hpx: i === 0 ? 34 : i === 1 ? 24 : 20 }));
  return ws;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHEET 2 — DETAIL PENJUALAN
// ═══════════════════════════════════════════════════════════════════════════════
function buildSalesSheet(rd: ReportData, storeName: string): XLSX.WorkSheet {
  const NC = 10;
  const rows: XLSX.CellObject[][] = [];
  const merges: XLSX.Range[] = [];
  let ri = -1;

  function push(row: XLSX.CellObject[]) { rows.push(row); return ++ri; }
  function fullSpan(r: number) { merges.push({ s: { r, c: 0 }, e: { r, c: NC - 1 } }); }
  function fill(style: any) { return Array.from({ length: NC - 1 }, () => cs('', style)); }

  // ── HEADER ──────────────────────────────────────────────────────────────────
  fullSpan(push([cs(storeName.toUpperCase(), S.h1), ...fill(S.h1)]));
  fullSpan(push([cs('DETAIL TRANSAKSI PENJUALAN', S.h2), ...fill(S.h2)]));
  fullSpan(push([cs(`Periode: ${rd.periodLabel}`, S.mVal), ...fill(S.mVal)]));
  push(emptyRow(NC));

  // ── TABLE HEADER ─────────────────────────────────────────────────────────────
  const headerRow = push([
    cs('NO. PESANAN', S.thL), cs('TANGGAL & WAKTU', S.thL), cs('KASIR', S.thL),
    cs('TIPE', S.thC), cs('PEMBAYARAN', S.thC), cs('STATUS', S.thC),
    cs('SUBTOTAL (Rp)', S.thR), cs('DISKON (Rp)', S.thR), cs('PAJAK (Rp)', S.thR), cs('TOTAL OMZET (Rp)', S.thR),
  ]);

  // ── DATA ROWS ─────────────────────────────────────────────────────────────────
  if (rd.transactionDetailOrders.length === 0) {
    const r = push([cs('Belum ada transaksi penjualan pada periode ini.', S.disc), ...Array(NC - 1).fill(bl())]);
    fullSpan(r);
  } else {
    rd.transactionDetailOrders.forEach((o, i) => {
      const a = i % 2 === 1;
      const isRefunded = o.payment?.status === 'refunded';
      push([
        cs(o.order_number, a ? S.tdAL : S.tdL),
        cs(fdt(o.created_at), a ? S.tdAL : S.tdL),
        cs(o.created_by_name || 'Kasir', a ? S.tdAL : S.tdL),
        cs(o.order_type === 'take_away' ? 'Takeaway' : 'Dine In', a ? S.tdAC : S.tdC),
        cs(String(o.payment?.method || 'Cash').toUpperCase(), a ? S.tdAC : S.tdC),
        cs(isRefunded ? 'REFUNDED' : 'SELESAI', a ? S.tdAC : S.tdC),
        cn(Number(o.subtotal) || Number(o.total_amount) || 0, a ? S.tdAR : S.tdR),
        cn(Number(o.discount) || 0, a ? S.tdAR : S.tdR),
        cn(Number(o.tax) || 0, a ? S.tdAR : S.tdR),
        cn(isRefunded ? 0 : (Number(o.total_amount) || 0), a ? S.tdAR : S.tdR),
      ]);
    });
  }

  // ── TOTAL ROW ─────────────────────────────────────────────────────────────────
  {
    const r = push([
      cs(`TOTAL PENJUALAN PERIODE — ${rd.totalOrdersCount} Transaksi Selesai`, S.totL),
      cs('', S.totL), cs('', S.totL), cs('', S.totL), cs('', S.totL), cs('', S.totL), cs('', S.totL), cs('', S.totL), cs('', S.totL),
      cn(rd.totalSales, S.totR),
    ]);
    merges.push({ s: { r, c: 0 }, e: { r, c: 8 } });
  }

  // ── WORKSHEET SETUP ───────────────────────────────────────────────────────────
  const ws = toWS(rows);
  ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 21 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 18 }];
  ws['!rows'] = rows.map((_, i) => ({ hpx: i === 0 ? 32 : i === 1 ? 22 : 20 }));
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: headerRow + 1 }];
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: rows.length - 1, c: NC - 1 } }) };
  return ws;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHEET 3 — DETAIL PEMBELIAN RESTOK
// ═══════════════════════════════════════════════════════════════════════════════
function buildPurchasesSheet(rd: ReportData, storeName: string): XLSX.WorkSheet {
  const NC = 6;
  const rows: XLSX.CellObject[][] = [];
  const merges: XLSX.Range[] = [];
  let ri = -1;

  function push(row: XLSX.CellObject[]) { rows.push(row); return ++ri; }
  function fullSpan(r: number) { merges.push({ s: { r, c: 0 }, e: { r, c: NC - 1 } }); }
  function fill(style: any) { return Array.from({ length: NC - 1 }, () => cs('', style)); }

  // ── HEADER ──────────────────────────────────────────────────────────────────
  fullSpan(push([cs(storeName.toUpperCase(), S.h1), ...fill(S.h1)]));
  fullSpan(push([cs('DETAIL PEMBELIAN & RESTOK BAHAN BAKU', S.h2), ...fill(S.h2)]));
  fullSpan(push([cs(`Periode: ${rd.periodLabel}`, S.mVal), ...fill(S.mVal)]));
  push(emptyRow(NC));

  // ── TABLE HEADER ─────────────────────────────────────────────────────────────
  const headerRow = push([
    cs('NO. NOTA / PO', S.thL), cs('TANGGAL', S.thC), cs('SUPPLIER / VENDOR', S.thL),
    cs('JML ITEM', S.thC), cs('CATATAN PEMBELIAN', S.thL), cs('TOTAL BIAYA (Rp)', S.thR),
  ]);

  // ── DATA ROWS ─────────────────────────────────────────────────────────────────
  if (rd.filteredPurchases.length === 0) {
    const r = push([cs('Tidak ada pembelian bahan pada periode ini.', S.disc), ...Array(NC - 1).fill(bl())]);
    fullSpan(r);
  } else {
    rd.filteredPurchases.forEach((p, i) => {
      const a = i % 2 === 1;
      push([
        cs(p.purchase_number, a ? S.tdAL : S.tdL),
        cs(fd(p.date || p.created_at), a ? S.tdAC : S.tdC),
        cs(p.supplier, a ? S.tdAL : S.tdL),
        cs(p.items ? `${p.items.length} Barang` : '-', a ? S.tdAC : S.tdC),
        cs(p.notes || '-', a ? S.tdAL : S.tdL),
        cn(Number(p.total_amount) || 0, a ? S.tdAR : S.tdR),
      ]);
    });
  }

  // ── TOTAL ROW ─────────────────────────────────────────────────────────────────
  {
    const r = push([
      cs(`TOTAL PEMBELIAN PERIODE — ${rd.totalPurchasesCount} Nota Belanja`, S.totL),
      cs('', S.totL), cs('', S.totL), cs('', S.totL), cs('', S.totL),
      cn(rd.totalPurchases, S.totR),
    ]);
    merges.push({ s: { r, c: 0 }, e: { r, c: 4 } });
  }

  // ── WORKSHEET SETUP ───────────────────────────────────────────────────────────
  const ws = toWS(rows);
  ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 22 }, { wch: 17 }, { wch: 30 }, { wch: 13 }, { wch: 35 }, { wch: 19 }];
  ws['!rows'] = rows.map((_, i) => ({ hpx: i === 0 ? 32 : i === 1 ? 22 : 20 }));
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: headerRow + 1 }];
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: rows.length - 1, c: NC - 1 } }) };
  return ws;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHEET 4 — DAFTAR REFUND PERIODE INI
// ═══════════════════════════════════════════════════════════════════════════════
function buildRefundsSheet(rd: ReportData, storeName: string): XLSX.WorkSheet {
  const NC = 7;
  const rows: XLSX.CellObject[][] = [];
  const merges: XLSX.Range[] = [];
  let ri = -1;

  function push(row: XLSX.CellObject[]) { rows.push(row); return ++ri; }
  function fullSpan(r: number) { merges.push({ s: { r, c: 0 }, e: { r, c: NC - 1 } }); }
  function fill(style: any) { return Array.from({ length: NC - 1 }, () => cs('', style)); }

  // ── HEADER ──────────────────────────────────────────────────────────────────
  fullSpan(push([cs(storeName.toUpperCase(), S.h1), ...fill(S.h1)]));
  fullSpan(push([cs('DAFTAR PENGEMBALIAN DANA (REFUND) PERIODE INI', S.h2), ...fill(S.h2)]));
  fullSpan(push([cs(`Periode: ${rd.periodLabel}`, S.mVal), ...fill(S.mVal)]));
  push(emptyRow(NC));

  // ── TABLE HEADER ─────────────────────────────────────────────────────────────
  const headerRow = push([
    cs('NO. NOTA ASAL', S.thL),
    cs('WAKTU TRANSAKSI ASAL', S.thL),
    cs('WAKTU REFUND', S.thL),
    cs('PETUGAS REFUND', S.thL),
    cs('METODE REFUND', S.thC),
    cs('ALASAN REFUND', S.thL),
    cs('NOMINAL REFUND (Rp)', S.thR),
  ]);

  // ── DATA ROWS ─────────────────────────────────────────────────────────────────
  if (rd.periodRefundOrders.length === 0) {
    const r = push([cs('Tidak ada transaksi refund yang diproses pada periode ini.', S.disc), ...Array(NC - 1).fill(bl())]);
    fullSpan(r);
  } else {
    rd.periodRefundOrders.forEach((o, i) => {
      const a = i % 2 === 1;
      const methodLabel = o.refund_method === 'cash'
        ? 'Tunai (Laci)'
        : o.refund_method === 'qris'
        ? 'QRIS / Non-Tunai'
        : 'Tidak diketahui (data lama)';
      push([
        cs(o.order_number, a ? S.tdAL : S.tdL),
        cs(fdt(o.created_at), a ? S.tdAL : S.tdL),
        cs(o.refunded_at ? fdt(o.refunded_at) : '-', a ? S.tdAL : S.tdL),
        cs(o.refunded_by_name || 'Owner', a ? S.tdAL : S.tdL),
        cs(methodLabel, a ? S.tdAC : S.tdC),
        cs(o.refund_reason || '-', a ? S.tdAL : S.tdL),
        cn(Number(o.total_amount) || 0, a ? S.tdAR : S.tdR),
      ]);
    });
  }

  // ── TOTAL ROW ─────────────────────────────────────────────────────────────────
  {
    const r = push([
      cs(`TOTAL REFUND PERIODE — ${rd.refundCount} Transaksi Refund`, S.totL),
      cs('', S.totL), cs('', S.totL), cs('', S.totL), cs('', S.totL), cs('', S.totL),
      cn(rd.totalRefunds, S.totR),
    ]);
    merges.push({ s: { r, c: 0 }, e: { r, c: 5 } });
  }

  // ── WORKSHEET SETUP ───────────────────────────────────────────────────────────
  const ws = toWS(rows);
  ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 24 }, { wch: 20 }];
  ws['!rows'] = rows.map((_, i) => ({ hpx: i === 0 ? 32 : i === 1 ? 22 : 20 }));
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: headerRow + 1 }];
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: rows.length - 1, c: NC - 1 } }) };
  return ws;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const exportReportToExcel = ({
  reportData,
  storeName = 'Booth Daily',
  filename,
}: ExcelReportOptions): void => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(reportData, storeName), 'Ringkasan Laporan');
  XLSX.utils.book_append_sheet(wb, buildSalesSheet(reportData, storeName), 'Detail Penjualan');
  XLSX.utils.book_append_sheet(wb, buildPurchasesSheet(reportData, storeName), 'Detail Pembelian Restok');
  XLSX.utils.book_append_sheet(wb, buildRefundsSheet(reportData, storeName), 'Daftar Refund');
  const safeStoreName = (storeName?.trim() || 'BoothDaily').replace(/[^a-zA-Z0-9_-]/g, '_');
  const out = filename || `Laporan_Keuangan_${safeStoreName}_${new Date().toISOString().slice(0, 10)}`;
  XLSX.writeFile(wb, `${out}.xlsx`);
};

// Backward-compatible alias (legacy callers)
export const exportToExcel = (data: any[], filename: string, sheetName = 'Sheet1'): void => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
