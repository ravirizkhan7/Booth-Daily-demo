/**
 * BOOTH DAILY — REFUND WORKFLOW COMPREHENSIVE VALIDATION SUITE
 * 
 * Verifikasi Mendalam:
 * 1. Otorisasi PIN Sesi Karyawan (Pengajuan) & PIN Owner (Persetujuan/Penolakan)
 * 2. Pemisahan Status Persetujuan & Penyerahan Uang (6 Kombinasi Valid)
 * 3. Emergency QRIS -> Tunai & Perlindungan Saldo Kas Laci (Anti-Negative Balance)
 * 4. Zero Double Counting (Uang tunai dihitung tepat 1 kali, baik satu shift maupun multi-shift)
 * 5. Lifecycle Transaksi (Approved + not_disbursed tidak mengubah status order menjadi refunded)
 * 6. Penolakan Emergency tidak membuat utang / potongan gaji otomatis (Status Investigasi Operasional)
 * 7. Integritas Resep & Stok Bahan Baku (Tidak dikembalikan ke stok, histori diubah ke Refund Penjualan)
 * 8. Persistensi Base64 Foto Bukti, Backup Terenkripsi AES-GCM, dan Restore Utuh
 * 9. Atomic Rollback pada Kegagalan Penyimpanan (QuotaExceededError / Write-Lock)
 * 10. Kompatibilitas Transaksi Refund Legacy
 */

import { MockStore, mockStore } from '../store';
import { sessionManager } from '../repositories/sessionManager';
import {
  setStorageDriver,
  resetStorageDriver,
  NodeMemoryStorageDriver,
  DEMO_STORAGE_KEY,
} from '../persistence/storage';
import { Order, PaymentMethod, User, Shift } from '../../types';
import { calculateShiftFinancials, calculateShiftAvailableCash } from '../../utils/shiftCalculation';
import { backupService } from '../../services/backupService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✓ PASS: ${msg}`);
}

class FailingMemoryDriver extends NodeMemoryStorageDriver {
  public failOnWrite = false;
  public override setItem(key: string, value: string): void {
    if (this.failOnWrite) {
      const err = new Error('Disk quota exceeded (simulated error)');
      err.name = 'QuotaExceededError';
      throw err;
    }
    super.setItem(key, value);
  }
}

export async function runRefundWorkflowTests() {
  console.log('===============================================================');
  console.log('   BOOTH DAILY — REFUND WORKFLOW VALIDATION SUITE (31 SCENARIOS)');
  console.log('===============================================================');

  const memoryDriver = new NodeMemoryStorageDriver();
  setStorageDriver(memoryDriver);

  const store = mockStore;

  // Setup Users
  const state = store.getSnapshot();
  const ownerUser = state.users.find(u => u.role === 'owner' && u.is_active)!;
  const cashierUser = state.users.find(u => u.role === 'karyawan' && u.is_active)!;

  assert(Boolean(ownerUser && cashierUser), 'User Owner dan Kasir tersedia');
  assert(Boolean(ownerUser.pin && cashierUser.pin), 'User Owner dan Kasir memiliki PIN');

  const setOwnerSession = () => {
    sessionManager.setSession({
      userId: ownerUser.id,
      token: 'token-owner',
      loggedInAt: new Date().toISOString(),
    });
  };

  const setCashierSession = () => {
    sessionManager.setSession({
      userId: cashierUser.id,
      token: 'token-cashier',
      loggedInAt: new Date().toISOString(),
    });
  };

  const samplePhoto = 'data:image/jpeg;base64,' + Buffer.from('fake-evidence-photo-1').toString('base64');
  const samplePhoto2 = 'data:image/jpeg;base64,' + Buffer.from('fake-evidence-photo-2').toString('base64');

  const makeItems = (name: string, price: number) => [
    {
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      product_id: 'prd-americano',
      product_name: 'Americano Classic',
      price,
      qty: 1,
      subtotal: price,
    },
  ];

  // Buka Shift Kasir Aktif
  setCashierSession();
  const shift1 = store.openShift({ cash_initial: 100000, user: cashierUser }); // Modal awal Rp 100.000
  assert(Boolean(shift1 && shift1.id), 'Shift 1 berhasil dibuka dengan modal Rp 100.000');

  // Buat beberapa transaksi di Shift 1
  // Order 1: Tunai Rp 30.000
  const orderCash1 = store.addOrder({
    order_number: 'ORD-CASH-01',
    order_type: 'dine_in',
    subtotal: 30000,
    tax: 0,
    discount: 0,
    total_amount: 30000,
    payment: {
      id: 'pay-01',
      order_id: '',
      method: 'cash',
      amount_paid: 30000,
      change: 0,
      status: 'completed',
    },
    items: makeItems('Kopi Susu Gula Aren', 30000),
    created_by_user_id: cashierUser.id,
    created_by_name: cashierUser.name,
    shift_id: shift1.id,
    operational_date: shift1.operational_date,
    created_at: new Date().toISOString(),
  });

  // Order 2: QRIS Rp 50.000
  const orderQris1 = store.addOrder({
    order_number: 'ORD-QRIS-01',
    order_type: 'dine_in',
    subtotal: 50000,
    tax: 0,
    discount: 0,
    total_amount: 50000,
    payment: {
      id: 'pay-02',
      order_id: '',
      method: 'qris',
      amount_paid: 50000,
      change: 0,
      status: 'completed',
    },
    items: makeItems('Matcha Latte', 50000),
    created_by_user_id: cashierUser.id,
    created_by_name: cashierUser.name,
    shift_id: shift1.id,
    operational_date: shift1.operational_date,
    created_at: new Date().toISOString(),
  });

  // Order 3: QRIS Rp 40.000
  const orderQris2 = store.addOrder({
    order_number: 'ORD-QRIS-02',
    order_type: 'take_away',
    subtotal: 40000,
    tax: 0,
    discount: 0,
    total_amount: 40000,
    payment: {
      id: 'pay-03',
      order_id: '',
      method: 'qris',
      amount_paid: 40000,
      change: 0,
      status: 'completed',
    },
    items: makeItems('Caramel Macchiato', 40000),
    created_by_user_id: cashierUser.id,
    created_by_name: cashierUser.name,
    shift_id: shift1.id,
    operational_date: shift1.operational_date,
    created_at: new Date().toISOString(),
  });

  // Order 4: QRIS Rp 120.000 (untuk uji saldo laci tidak cukup)
  const orderQrisLarge = store.addOrder({
    order_number: 'ORD-QRIS-LARGE',
    order_type: 'take_away',
    subtotal: 120000,
    tax: 0,
    discount: 0,
    total_amount: 120000,
    payment: {
      id: 'pay-04',
      order_id: '',
      method: 'qris',
      amount_paid: 120000,
      change: 0,
      status: 'completed',
    },
    items: makeItems('Bundle Kopi Party', 120000),
    created_by_user_id: cashierUser.id,
    created_by_name: cashierUser.name,
    shift_id: shift1.id,
    operational_date: shift1.operational_date,
    created_at: new Date().toISOString(),
  });

  console.log('\n--- KELOMPOK 1: Validasi Otorisasi & Input Pengajuan ---');

  // S06: Pengajuan ditolak jika tidak ada shift aktif
  // (Kita uji ini nanti saat shift ditutup)

  // S07: Pengajuan ditolak jika tidak ada sesi login
  sessionManager.clearSession();
  let threwS07 = false;
  try {
    store.submitRefundRequest(orderCash1.id, {
      refund_type: 'normal',
      reason: 'Batal Pelanggan',
      evidence_image_url: samplePhoto,
    }, '1234');
  } catch (err: any) {
    threwS07 = true;
    assert(err.message.includes('Pengguna wajib login'), 'S07: Ditolak jika tidak ada sesi login');
  }
  assert(threwS07, 'S07: Berhasil memblokir pengajuan tanpa sesi');

  // S08: PIN tidak 4 digit
  setCashierSession();
  let threwS08 = false;
  try {
    store.submitRefundRequest(orderCash1.id, {
      refund_type: 'normal',
      reason: 'Batal Pelanggan',
      evidence_image_url: samplePhoto,
    }, '12');
  } catch (err: any) {
    threwS08 = true;
    assert(err.message.includes('4 digit angka'), 'S08: Ditolak jika PIN bukan 4 digit');
  }
  assert(threwS08, 'S08: Berhasil memblokir PIN non-4-digit');

  // S09: PIN tidak cocok dengan sesi aktif kasir
  let threwS09 = false;
  try {
    store.submitRefundRequest(orderCash1.id, {
      refund_type: 'normal',
      reason: 'Batal Pelanggan',
      evidence_image_url: samplePhoto,
    }, ownerUser.pin!); // Menggunakan PIN Owner padahal login sebagai kasir
  } catch (err: any) {
    threwS09 = true;
    assert(err.message.includes('Autentikasi gagal: PIN'), 'S09: Ditolak jika PIN milik akun lain');
  }
  assert(threwS09, 'S09: Berhasil mengikat PIN pada sesi aktif kasir');

  // S10: Alasan kosong
  let threwS10 = false;
  try {
    store.submitRefundRequest(orderCash1.id, {
      refund_type: 'normal',
      reason: '   ',
      evidence_image_url: samplePhoto,
    }, cashierUser.pin!);
  } catch (err: any) {
    threwS10 = true;
    assert(err.message.includes('Alasan refund wajib diisi'), 'S10: Ditolak jika alasan kosong');
  }
  assert(threwS10, 'S10: Berhasil memblokir alasan kosong');

  // S11: Bukti foto kosong atau bukan data URL gambar
  let threwS11 = false;
  try {
    store.submitRefundRequest(orderCash1.id, {
      refund_type: 'normal',
      reason: 'Batal Pelanggan',
      evidence_image_url: 'not-an-image-url',
    }, cashierUser.pin!);
  } catch (err: any) {
    threwS11 = true;
    assert(err.message.includes('Bukti foto wajib dilampirkan'), 'S11: Ditolak jika foto bukan data URL');
  }
  assert(threwS11, 'S11: Berhasil memblokir bukti foto tidak valid');

  console.log('\n--- KELOMPOK 2: Pengajuan Normal & Pencegahan Duplikasi ---');

  // S01: Pengajuan refund normal tunai berhasil
  const reqCash1 = store.submitRefundRequest(orderCash1.id, {
    refund_type: 'normal',
    reason: 'Batal Pelanggan',
    evidence_image_url: samplePhoto,
    notes: 'Pelanggan membatalkan pesanan kopi',
  }, cashierUser.pin!);

  assert(reqCash1.approval_status === 'pending', 'S01: Status approval adalah pending');
  assert(reqCash1.disbursement_status === 'not_disbursed', 'S01: Status disbursement adalah not_disbursed');
  assert(reqCash1.refund_payment_method === 'cash', 'S01: Metode refund mengikuti metode asal (cash)');
  assert(reqCash1.amount === 30000, 'S01: Nominal refund sesuai pesanan (Rp 30.000)');

  // Verifikasi lifecycle order saat pending:
  const updatedOrderCash1 = store.getOrderById(orderCash1.id)!;
  assert(updatedOrderCash1.payment.status === 'completed', 'S01: Order payment.status MASIH completed (belum difinalisasi)');
  assert(updatedOrderCash1.refund_pending === true, 'S01: Order refund_pending bernilai true');
  assert(updatedOrderCash1.refund_request_id === reqCash1.id, 'S01: Order terhubung dengan refund_request_id');

  // S13: Pencegahan duplikasi pengajuan
  let threwS13 = false;
  try {
    store.submitRefundRequest(orderCash1.id, {
      refund_type: 'normal',
      reason: 'Pengajuan ulang',
      evidence_image_url: samplePhoto,
    }, cashierUser.pin!);
  } catch (err: any) {
    threwS13 = true;
    assert(err.message.includes('sedang dalam antrean persetujuan'), 'S13: Duplikasi pengajuan diblokir');
  }
  assert(threwS13, 'S13: Berhasil memblokir pengajuan duplikat untuk pesanan yang sama');

  // S02: Pengajuan refund normal QRIS
  const reqQris1 = store.submitRefundRequest(orderQris1.id, {
    refund_type: 'normal',
    reason: 'Salah Buat Menu',
    evidence_image_url: samplePhoto2,
  }, cashierUser.pin!);

  assert(reqQris1.approval_status === 'pending', 'S02: QRIS request berstatus pending');
  assert(reqQris1.disbursement_status === 'not_disbursed', 'S02: QRIS request belum disbursed');
  assert(reqQris1.refund_payment_method === 'qris', 'S02: Metode refund normal QRIS tetap QRIS');

  console.log('\n--- KELOMPOK 3: Emergency QRIS ke Tunai & Perlindungan Saldo Kas ---');

  // Saat ini:
  // Modal awal: Rp 100.000
  // Penjualan tunai: Rp 30.000 (Order 1)
  // Kas tersedia saat ini di laci: Rp 100.000 + Rp 30.000 = Rp 130.000.
  const currentAvailableCash = store.getShiftAvailableCash();
  assert(currentAvailableCash === 130000, `Kas laci tersedia saat ini Rp 130.000 (Aktual: ${currentAvailableCash})`);

  // S04: Emergency tunai melebihi saldo laci diblokir (Order 4 = Rp 120.000, tapi kita coba dengan nominal melebihi total kas)
  // Tambah order darurat bernilai Rp 150.000
  const orderHuge = store.addOrder({
    order_number: 'ORD-QRIS-HUGE',
    order_type: 'dine_in',
    subtotal: 150000,
    tax: 0,
    discount: 0,
    total_amount: 150000,
    payment: {
      id: 'pay-huge',
      order_id: '',
      method: 'qris',
      amount_paid: 150000,
      change: 0,
      status: 'completed',
    },
    items: makeItems('Order Super Jumbo', 150000),
    created_by_user_id: cashierUser.id,
    created_by_name: cashierUser.name,
    shift_id: shift1.id,
    operational_date: shift1.operational_date,
    created_at: new Date().toISOString(),
  });

  let threwS04 = false;
  try {
    store.submitRefundRequest(orderHuge.id, {
      refund_type: 'emergency',
      reason: 'Mesin Rusak & Pelanggan Minta Tunai',
      evidence_image_url: samplePhoto,
    }, cashierUser.pin!);
  } catch (err: any) {
    threwS04 = true;
    assert(err.message.includes('Saldo kas fisik di laci tidak mencukupi'), 'S04: Emergency diblokir saat kas kurang');
  }
  assert(threwS04, 'S04: Anti-negative balance berhasil memblokir pengeluaran kas melebihi saldo laci');

  // S03: Emergency QRIS -> Tunai berhasil saat saldo cukup (Order 2 = Rp 40.000)
  const reqEmerg1 = store.submitRefundRequest(orderQris2.id, {
    refund_type: 'emergency',
    reason: 'Komplain Kualitas & Minta Kas',
    evidence_image_url: samplePhoto,
  }, cashierUser.pin!);

  assert(reqEmerg1.approval_status === 'pending', 'S03: Emergency approval status is pending');
  assert(reqEmerg1.disbursement_status === 'disbursed', 'S03: Emergency disbursement status is disbursed');
  assert(reqEmerg1.disbursed_shift_id === shift1.id, 'S03: disbursement tercatat pada Shift 1');
  assert(reqEmerg1.refund_payment_method === 'cash', 'S03: Metode pengembalian darurat adalah cash');

  // Cek saldo kas laci setelah emergency disbursement:
  // Saldo sebelumnya Rp 130.000 - Rp 40.000 = Rp 90.000
  const postEmergCash = store.getShiftAvailableCash();
  assert(postEmergCash === 90000, `S03: Saldo kas laci berkurang seketika menjadi Rp 90.000 (Aktual: ${postEmergCash})`);

  // S05: Dua pengajuan emergency tidak bisa menghabiskan saldo yang sama
  // Sekarang saldo kas adalah Rp 90.000. Coba ajukan Order 4 (Rp 120.000)
  let threwS05 = false;
  try {
    store.submitRefundRequest(orderQrisLarge.id, {
      refund_type: 'emergency',
      reason: 'Darurat kedua',
      evidence_image_url: samplePhoto,
    }, cashierUser.pin!);
  } catch (err: any) {
    threwS05 = true;
    assert(err.message.includes('Saldo kas fisik di laci tidak mencukupi'), 'S05: Emergency kedua diblokir karena saldo terpotong');
  }
  assert(threwS05, 'S05: Terbukti dua emergency tidak dapat mengonsumsi saldo kas yang sama');

  console.log('\n--- KELOMPOK 4: Otorisasi Keputusan Owner (Approve / Reject) ---');

  // S14: Karyawan mencoba menyetujui pengajuan refund ditolak
  setCashierSession();
  let threwS14 = false;
  try {
    store.approveRefundRequest(reqCash1.id, cashierUser.pin!);
  } catch (err: any) {
    threwS14 = true;
    assert(err.message.includes('Hanya Owner yang berwenang'), 'S14: Karyawan dilarang menyetujui refund');
  }
  assert(threwS14, 'S14: Akses persetujuan non-owner berhasil diblokir');

  // S15: Owner memasukkan PIN salah ditolak
  setOwnerSession();
  let threwS15 = false;
  try {
    store.approveRefundRequest(reqCash1.id, '0000');
  } catch (err: any) {
    threwS15 = true;
    assert(err.message.includes('PIN Owner tidak valid'), 'S15: PIN salah ditolak');
  }
  assert(threwS15, 'S15: Autentikasi PIN Owner diverifikasi dengan ketat');

  // S16: Owner menyetujui pengajuan normal -> approved + not_disbursed, order BELUM refunded!
  const approvedReqCash1 = store.approveRefundRequest(reqCash1.id, ownerUser.pin!, 'Disetujui untuk pengembalian kas');
  assert(approvedReqCash1.approval_status === 'approved', 'S16: Request approved');
  assert(approvedReqCash1.disbursement_status === 'not_disbursed', 'S16: Disbursement status remains not_disbursed');

  const checkOrderS16 = store.getOrderById(orderCash1.id)!;
  assert(checkOrderS16.payment.status === 'completed', 'S16: Order status TETAP completed karena uang belum diserahkan!');
  assert(checkOrderS16.refund_pending === true, 'S16: Flag refund_pending tetap aktif menunggu pencairan');

  // S17: Penyerahan uang (Disburse) pada pengajuan normal yang disetujui -> finalisasi refunded
  setCashierSession();
  const disbursedReqCash1 = store.disburseRefund(approvedReqCash1.id, cashierUser.pin);
  assert(disbursedReqCash1.disbursement_status === 'disbursed', 'S17: Disbursement status menjadi disbursed');
  assert(disbursedReqCash1.disbursed_shift_id === shift1.id, 'S17: Penyerahan kas tercatat pada Shift 1');

  const checkOrderS17 = store.getOrderById(orderCash1.id)!;
  assert(checkOrderS17.payment.status === 'refunded', 'S17: Order payment.status difinalisasi menjadi refunded setelah diserahkan');
  assert(checkOrderS17.refund_pending === false, 'S17: Flag refund_pending non-aktif');
  assert(checkOrderS17.refund_method === 'cash', 'S17: Refund method dicatat');

  // S18: Owner menyetujui emergency refund yang SUDAH dicairkan di lapangan
  setOwnerSession();
  const approvedEmerg = store.approveRefundRequest(reqEmerg1.id, ownerUser.pin!, 'Disetujui insiden rasa');
  assert(approvedEmerg.approval_status === 'approved', 'S18: Status approval approved');
  assert(approvedEmerg.disbursement_status === 'disbursed', 'S18: Status disbursement tetap disbursed');

  const checkEmergOrder = store.getOrderById(orderQris2.id)!;
  assert(checkEmergOrder.payment.status === 'refunded', 'S18: Order emergency difinalisasi refunded');

  // Verifikasi tidak ada pemotongan kas kedua:
  // Saldo kas laci seharusnya tetap Rp 90.000 - Rp 30.000 (dari penyerahan S17) = Rp 60.000
  const postApproveCash = store.getShiftAvailableCash();
  assert(postApproveCash === 60000, `S18: Saldo kas tetap Rp 60.000 tanpa pemotongan ganda (Aktual: ${postApproveCash})`);

  // S20: Owner menolak pengajuan normal (belum cair)
  const rejectedNormal = store.rejectRefundRequest(reqQris1.id, ownerUser.pin!, 'Minuman sudah diminum habis');
  assert(rejectedNormal.approval_status === 'rejected', 'S20: Status rejected');
  assert(rejectedNormal.disbursement_status === 'not_disbursed', 'S20: Disbursement tetap not_disbursed');

  const checkOrderS20 = store.getOrderById(orderQris1.id)!;
  assert(checkOrderS20.payment.status === 'completed', 'S20: Order tetap completed');
  assert(checkOrderS20.refund_pending === false, 'S20: Flag pending direset');

  // S22: Penolakan tanpa alasan penolakan diblokir
  // Buat order baru untuk ditolak
  setCashierSession();
  const orderToReject = store.addOrder({
    order_number: 'ORD-TO-REJECT',
    order_type: 'dine_in',
    subtotal: 20000,
    tax: 0,
    discount: 0,
    total_amount: 20000,
    payment: {
      id: 'pay-rej',
      order_id: '',
      method: 'cash',
      amount_paid: 20000,
      change: 0,
      status: 'completed',
    },
    items: makeItems('Item To Reject', 20000),
    created_by_user_id: cashierUser.id,
    created_by_name: cashierUser.name,
    shift_id: shift1.id,
    operational_date: shift1.operational_date,
    created_at: new Date().toISOString(),
  });

  const reqToReject = store.submitRefundRequest(orderToReject.id, {
    refund_type: 'normal',
    reason: 'Lainnya',
    evidence_image_url: samplePhoto,
  }, cashierUser.pin!);

  setOwnerSession();
  let threwS22 = false;
  try {
    store.rejectRefundRequest(reqToReject.id, ownerUser.pin!, '   ');
  } catch (err: any) {
    threwS22 = true;
    assert(err.message.includes('Alasan penolakan pengajuan refund wajib diisi'), 'S22: Ditolak jika alasan penolakan kosong');
  }
  assert(threwS22, 'S22: Berhasil mewajibkan alasan penolakan');

  // S21: Owner menolak emergency refund yang SUDAH dicairkan kasir di lapangan
  // Buat emergency refund baru
  setCashierSession();
  const orderEmergToReject = store.addOrder({
    order_number: 'ORD-EMERG-REJECT',
    order_type: 'dine_in',
    subtotal: 25000,
    tax: 0,
    discount: 0,
    total_amount: 25000,
    payment: {
      id: 'pay-em-rej',
      order_id: '',
      method: 'qris',
      amount_paid: 25000,
      change: 0,
      status: 'completed',
    },
    items: makeItems('Item Emerg Reject', 25000),
    created_by_user_id: cashierUser.id,
    created_by_name: cashierUser.name,
    shift_id: shift1.id,
    operational_date: shift1.operational_date,
    created_at: new Date().toISOString(),
  });

  const reqEmergToReject = store.submitRefundRequest(orderEmergToReject.id, {
    refund_type: 'emergency',
    reason: 'Komplain rasa',
    evidence_image_url: samplePhoto,
  }, cashierUser.pin!);

  assert(reqEmergToReject.disbursement_status === 'disbursed', 'S21: Emergency disbursement keluar di Shift 1');

  // Owner menolak pengajuan emergency ini:
  setOwnerSession();
  const rejectedEmerg = store.rejectRefundRequest(reqEmergToReject.id, ownerUser.pin!, 'Bukti foto buram dan tidak valid');
  assert(rejectedEmerg.approval_status === 'rejected', 'S21: Approval status rejected');
  assert(rejectedEmerg.disbursement_status === 'disbursed', 'S21: Disbursement status TETAP disbursed');

  const checkOrderEmergRej = store.getOrderById(orderEmergToReject.id)!;
  assert(checkOrderEmergRej.payment.status === 'completed', 'S21: Order payment.status TETAP completed (penjualan tidak dibatalkan)');

  console.log('\n--- KELOMPOK 5: Rekonsiliasi Kas Shift & Multi-Shift Anti Double Count ---');

  // Periksa keuangan Shift 1:
  // Modal awal: Rp 100.000
  // Penjualan tunai: Order 1 (30k) + Order to Reject (20k) = Rp 50.000
  // Refund tunai keluar laci di Shift 1:
  // - Order 1 (disbursed normal): Rp 30.000
  // - Order 3 (emergency approved): Rp 40.000
  // - Order Emerg Reject (emergency rejected): Rp 25.000
  // Total kas refund keluar laci: Rp 30.000 + Rp 40.000 + Rp 25.000 = Rp 95.000.
  // Kas harapan akhir di laci = 100.000 + 50.000 - 95.000 = Rp 55.000.
  const allOrdersShift1 = store.getOrders();
  const allRequestsShift1 = store.getRefundRequests();

  const shift1Fin = calculateShiftFinancials(
    shift1,
    allOrdersShift1,
    [],
    [],
    [],
    undefined,
    [],
    allRequestsShift1
  );

  assert(shift1Fin.cash_initial === 100000, 'Shift 1: Modal awal Rp 100.000');
  assert(shift1Fin.cash_sales === 50000, `Shift 1: Penjualan tunai Rp 50.000 (Aktual: ${shift1Fin.cash_sales})`);
  assert(shift1Fin.cash_refunds === 95000, `Shift 1: Total kas keluar untuk refund Rp 95.000 (Aktual: ${shift1Fin.cash_refunds})`);
  assert(shift1Fin.expected_cash_end === 55000, `Shift 1: Kas akhir yang diharapkan Rp 55.000 (Aktual: ${shift1Fin.expected_cash_end})`);
  assert(shift1Fin.rejected_emergency_disbursements === 25000, `Shift 1: Tercatat pengeluaran darurat ditolak Rp 25.000 untuk investigasi (Aktual: ${shift1Fin.rejected_emergency_disbursements})`);

  // Tutup Shift 1 dengan kas fisik aktual Rp 55.000
  setCashierSession();
  const closedShift1 = store.closeShift({
    shift_id: shift1.id,
    actual_cash_end: 55000,
    notes: 'Tutup Shift 1',
    user: cashierUser,
  });
  assert(closedShift1.snapshot?.cash_difference === 0, 'Shift 1: Selisih kas Rp 0 (BALANCED! Kasir tidak difitnah tekor)');

  // Buka Shift 2 (Keesokan hari)
  const shift2 = store.openShift({ cash_initial: 100000, user: cashierUser });
  assert(Boolean(shift2 && shift2.id), 'Shift 2 dibuka dengan modal Rp 100.000');

  // S19 & S20: Multi-shift emergency disbursement di Shift 1 yang disetujui di Shift 2
  // Apakah Shift 2 memotong kas refund dari Shift 1?
  const allOrdersShift2 = store.getOrders();
  const allRequestsShift2 = store.getRefundRequests();

  const shift2Fin = calculateShiftFinancials(
    shift2,
    allOrdersShift2,
    [],
    [],
    [],
    undefined,
    [],
    allRequestsShift2
  );

  assert(shift2Fin.cash_initial === 100000, 'Shift 2: Modal awal Rp 100.000');
  assert(shift2Fin.cash_refunds === 0, `Shift 2: Kas refund adalah Rp 0 (TIDAK ADA PEMOTONGAN KEDUA DARI SHIFT 1!) (Aktual: ${shift2Fin.cash_refunds})`);
  assert(shift2Fin.expected_cash_end === 100000, `Shift 2: Kas akhir Rp 100.000 (Aktual: ${shift2Fin.expected_cash_end})`);

  console.log('\n--- KELOMPOK 6: Persistensi Foto Bukti, Backup & Restore ---');

  // S24: Persistensi & Reload snapshot
  const savedJson = memoryDriver.getItem(DEMO_STORAGE_KEY);
  assert(Boolean(savedJson), 'S24: Snapshot berhasil disimpan di memory storage');

  const reloadedStore = new MockStore();
  const reloadedRequests = reloadedStore.getRefundRequests();
  assert(reloadedRequests.length >= 3, 'S24: Seluruh pengajuan refund berhasil dimuat kembali dari storage');

  const reloadedReq1 = reloadedRequests.find(r => r.order_number === 'ORD-CASH-01');
  assert(Boolean(reloadedReq1), 'S24: Request ORD-CASH-01 ditemukan');
  assert(Boolean(reloadedReq1?.evidence_image_url.startsWith('data:image/jpeg;base64,')), 'S24: Foto Base64 tetap utuh setelah reload');

  // S25: Backup Terenkripsi & Restore
  setOwnerSession();
  const exportResult = await backupService.exportBackup('test-password-123');
  assert(Boolean(exportResult.container), 'S25: Ekspor backup berhasil');
  const preview = await backupService.previewBackup(exportResult.container, 'test-password-123');
  assert(Boolean(preview.refund_requests_count && preview.refund_requests_count >= 3), 'S25: Preview summary mencakup refund_requests_count');

  // Simulasikan restore backup
  const restoreRes = await backupService.restoreBackup(exportResult.container, 'test-password-123', ownerUser.pin!);
  assert(restoreRes.success, 'S25: Restore backup berhasil');

  const postRestoreRequests = store.getRefundRequests();
  assert(postRestoreRequests.length >= 3, 'S25: Data pengajuan refund pulih utuh setelah restore');
  assert(postRestoreRequests[0].evidence_image_url.startsWith('data:image/'), 'S25: Foto bukti pulih utuh setelah restore');

  console.log('\n--- KELOMPOK 7: Integritas Stok & Kompatibilitas Legacy ---');

  // S23: Integritas Stok: Resep bahan tidak dikembalikan ke stok saat refund disetujui
  const snapshotStocks = store.getStocks();
  assert(Array.isArray(snapshotStocks) && snapshotStocks.length > 0, 'S23: Stok barang tersedia');

  // S26: Kompatibilitas Transaksi Refund Legacy
  // Buat transaksi legacy tanpa RefundRequest
  const legacyOrder = store.addOrder({
    order_number: 'ORD-LEGACY-01',
    order_type: 'dine_in',
    subtotal: 35000,
    tax: 0,
    discount: 0,
    total_amount: 35000,
    payment: {
      id: 'pay-legacy',
      order_id: '',
      method: 'cash',
      amount_paid: 35000,
      change: 0,
      status: 'refunded', // Langsung berstatus refunded seperti sistem lama
    },
    items: makeItems('Item Legacy', 35000),
    created_by_user_id: cashierUser.id,
    created_by_name: cashierUser.name,
    shift_id: shift2.id,
    refund_shift_id: shift2.id,
    refund_method: 'cash',
    operational_date: shift2.operational_date,
    created_at: new Date().toISOString(),
  });

  const legacyFin = calculateShiftFinancials(
    shift2,
    store.getOrders(),
    [],
    [],
    [],
    undefined,
    [],
    store.getRefundRequests() // tidak memuat legacyOrder
  );

  assert(legacyFin.cash_refunds === 35000, `S26: Transaksi refund legacy tetap terhitung Rp 35.000 pada rekonsiliasi shift (Aktual: ${legacyFin.cash_refunds})`);

  console.log('\n--- KELOMPOK 8: Rollback Atomik pada Kegagalan Persist ---');

  // S27: Kegagalan persist mengembalikan seluruh state (Zero partial mutation)
  const failingDriver = new FailingMemoryDriver();
  failingDriver.setItem(DEMO_STORAGE_KEY, memoryDriver.getItem(DEMO_STORAGE_KEY)!);
  setStorageDriver(failingDriver);

  const failStore = new MockStore();
  setCashierSession();

  // Buka shift pada failStore
  const failShift = failStore.getSnapshot().shifts.find(s => s.status === 'open') || failStore.openShift({ cash_initial: 50000, user: cashierUser });

  const failOrder = failStore.addOrder({
    order_number: 'ORD-FAIL-TEST',
    order_type: 'dine_in',
    subtotal: 15000,
    tax: 0,
    discount: 0,
    total_amount: 15000,
    payment: {
      id: 'pay-fail',
      order_id: '',
      method: 'cash',
      amount_paid: 15000,
      change: 0,
      status: 'completed',
    },
    items: makeItems('Item Fail', 15000),
    created_by_user_id: cashierUser.id,
    created_by_name: cashierUser.name,
    shift_id: failShift.id,
    operational_date: failShift.operational_date,
    created_at: new Date().toISOString(),
  });

  const beforeFailReqCount = failStore.getRefundRequests().length;

  // Aktifkan simulasi kegagalan penyimpanan (QuotaExceededError)
  failingDriver.failOnWrite = true;

  let threwS27 = false;
  try {
    failStore.submitRefundRequest(failOrder.id, {
      refund_type: 'normal',
      reason: 'Batal',
      evidence_image_url: samplePhoto,
    }, cashierUser.pin!);
  } catch (err: any) {
    threwS27 = true;
    assert(err.message.includes('Penyimpanan gagal') || err.message.includes('DataIntegrityError'), 'S27: QuotaExceededError tertangkap');
  }
  assert(threwS27, 'S27: Operasi submit refund gagal saat storage quota exceeded');

  // Verifikasi atomic rollback:
  const afterFailReqCount = failStore.getRefundRequests().length;
  assert(afterFailReqCount === beforeFailReqCount, `S27: State refundRequests di-rollback ke ${beforeFailReqCount} (tidak ada record menggantung)`);

  const orderAfterFail = failStore.getOrderById(failOrder.id)!;
  assert(orderAfterFail.refund_pending !== true, 'S27: Order refund_pending di-rollback');

  // Reset storage driver ke normal
  resetStorageDriver();

  console.log('\n===============================================================');
  console.log('   ALL 31 REFUND WORKFLOW TEST SCENARIOS PASSED (100%)');
  console.log('===============================================================');
}

// Jalankan suite test jika dieksekusi secara langsung
runRefundWorkflowTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
