import { mockStore } from '../store';
import { refundService } from '../../services/refundService';
import { sessionManager } from '../repositories/sessionManager';
import {
  setStorageDriver,
  resetStorageDriver,
  NodeMemoryStorageDriver,
} from '../persistence/storage';
import { calculateShiftFinancials, calculateShiftAvailableCash } from '../../utils/shiftCalculation';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✓ PASS: ${msg}`);
}

export async function runCashierDisbursementValidation() {
  console.log('===============================================================');
  console.log('   BOOTH DAILY — CASHIER REFUND DISBURSEMENT VALIDATION SUITE  ');
  console.log('===============================================================');

  const memoryDriver = new NodeMemoryStorageDriver();
  setStorageDriver(memoryDriver);

  const store = mockStore;
  const snapshot = store.getSnapshot();

  const ownerUser = snapshot.users.find(u => u.role === 'owner')!;
  const cashierUser = snapshot.users.find(u => u.id === 'usr-karyawan-01')!;
  const cashier2User = snapshot.users.find(u => u.id === 'usr-karyawan-02')!;

  const setSession = (user: { id: string; name: string; role: any }) => {
    sessionManager.setSession({
      userId: user.id,
      token: `token-${user.id}`,
      loggedInAt: new Date().toISOString(),
    });
  };

  const clearSession = () => {
    sessionManager.clearSession();
  };

  // Helper untuk membuat seed pesanan
  let orderSeq = 1;
  const createOrder = (method: 'cash' | 'qris', amount = 30000) => {
    const num = `ORD-DISB-${String(orderSeq++).padStart(3, '0')}`;
    return store.addOrder({
      order_number: num,
      order_type: 'dine_in',
      subtotal: amount,
      tax: 0,
      discount: 0,
      total_amount: amount,
      payment: {
        id: `pay-${num}`,
        order_id: '',
        method,
        amount_paid: amount,
        change: 0,
        status: 'completed',
      },
      items: [
        {
          id: `item-${num}`,
          product_id: 'prd-americano',
          product_name: 'Americano Classic',
          price: amount,
          qty: 1,
          subtotal: amount,
          unit_cost_price: 8000,
          subtotal_cost: 8000,
          is_estimated_cost: false,
        },
      ],
      created_at: new Date().toISOString(),
    });
  };

  // 1. Buka Shift 1
  setSession(ownerUser);
  const shift1 = store.openShift({
    cash_initial: 200000,
    user: ownerUser,
  });
  console.log(`\n--- SETUP: Shift 1 dibuka dengan Modal Awal Rp ${shift1.cash_initial.toLocaleString('id-ID')} ---`);

  // Buat 4 pesanan tunai (Rp 30.000 x 4 = Rp 120.000 penjualan tunai)
  const ord1 = createOrder('cash', 30000);
  const ord2 = createOrder('cash', 40000);
  const ord3 = createOrder('cash', 25000);
  const ordQRIS = createOrder('qris', 50000);

  // =========================================================================
  // SKENARIO 13: Kasir TIDAK DAPAT melakukan approval Owner
  // =========================================================================
  console.log('\n--- UJI 13: Larangan Approval oleh Kasir ---');
  setSession(cashierUser);
  const req1 = await refundService.submitRefundRequest(
    ord1.id,
    {
      refund_type: 'normal',
      reason: 'Kopi tumpah',
      evidence_image_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
    cashierUser.pin!
  );

  let cashierApprovalBlocked = false;
  try {
    await refundService.approveRefundRequest(req1.id, cashierUser.pin!, 'Mencoba approve sendiri');
  } catch (err: any) {
    cashierApprovalBlocked = true;
    assert(err.message.includes('Hanya Owner'), 'S13: Kasir ditolak saat mencoba menyetujui refund');
  }
  assert(cashierApprovalBlocked, 'S13: Kasir terbukti tidak memiliki wewenang approval Owner');

  // =========================================================================
  // SKENARIO 5: Refund Pending Tidak Dapat Dicairkan
  // =========================================================================
  console.log('\n--- UJI 5: Refund Pending Dilarang Dicairkan ---');
  let disbursePendingBlocked = false;
  try {
    await refundService.disburseRefund(req1.id, cashierUser.pin!);
  } catch (err: any) {
    disbursePendingBlocked = true;
    assert(err.message.includes('telah disetujui Owner'), 'S05: Pencairan ditolak untuk request yang masih pending');
  }
  assert(disbursePendingBlocked, 'S05: Terbukti refund pending tidak dapat dicairkan');

  // =========================================================================
  // SKENARIO 8: Approval Owner TIDAK Langsung Mengurangi Kas
  // =========================================================================
  console.log('\n--- UJI 8: Approval Owner Tidak Mengurangi Kas ---');
  const cashBeforeApproval = store.getShiftAvailableCash(shift1.id);
  setSession(ownerUser);
  const approvedReq1 = await refundService.approveRefundRequest(req1.id, ownerUser.pin!, 'Disetujui silakan serahkan uang');

  const cashAfterApproval = store.getShiftAvailableCash(shift1.id);
  assert(cashBeforeApproval === cashAfterApproval, 'S08: Saldo kas TIDAK berkurang saat Owner menyetujui refund');

  const checkOrd1AfterApprove = store.getOrderById(ord1.id)!;
  assert(checkOrd1AfterApprove.payment?.status === 'completed', 'S08: Status order tetap completed (belum difinalisasi)');
  assert(checkOrd1AfterApprove.refund_pending === true, 'S08: Flag refund_pending tetap aktif menunggu pencairan kasir');
  assert(approvedReq1.approval_status === 'approved', 'S08: Request berstatus approved');
  assert(approvedReq1.disbursement_status === 'not_disbursed', 'S08: Disbursement status tetap not_disbursed');

  // =========================================================================
  // SKENARIO 2: Kasir dengan PIN Salah Ditolak
  // =========================================================================
  console.log('\n--- UJI 2: Kasir dengan PIN Salah Ditolak ---');
  setSession(cashierUser);
  let wrongPinBlocked = false;
  try {
    await refundService.disburseRefund(approvedReq1.id, '9999');
  } catch (err: any) {
    wrongPinBlocked = true;
    assert(err.message.includes('PIN kasir tidak valid'), 'S02: Error autentikasi PIN kasir');
  }
  assert(wrongPinBlocked, 'S02: Berhasil memblokir pencairan dengan PIN salah');

  // =========================================================================
  // SKENARIO 14: PIN Kasir Lain Ditolak
  // =========================================================================
  console.log('\n--- UJI 14: PIN Kasir Lain Ditolak ---');
  let anotherUserPinBlocked = false;
  try {
    // Sesi aktif adalah cashierUser (PIN '1234'), tetapi memasukkan PIN milik cashier2User ('5678')
    await refundService.disburseRefund(approvedReq1.id, cashier2User.pin);
  } catch (err: any) {
    anotherUserPinBlocked = true;
    assert(err.message.includes('PIN kasir tidak valid'), 'S14: PIN pengguna lain ditolak');
  }
  assert(anotherUserPinBlocked, 'S14: Berhasil memvalidasi PIN terhadap identitas sesi kasir aktif');

  // =========================================================================
  // SKENARIO 3: Kasir Tanpa Sesi Aktif Ditolak
  // =========================================================================
  console.log('\n--- UJI 3: Tanpa Sesi Aktif Ditolak ---');
  clearSession();
  let noSessionBlocked = false;
  try {
    await refundService.disburseRefund(approvedReq1.id, '1234');
  } catch (err: any) {
    noSessionBlocked = true;
    assert(err.message.includes('Sesi login diperlukan'), 'S03: Error sesi login diperlukan');
  }
  assert(noSessionBlocked, 'S03: Berhasil memblokir pencairan tanpa sesi login');

  // Kembalikan sesi kasir aktif
  setSession(cashierUser);

  // =========================================================================
  // SKENARIO 4: Kasir Tanpa Shift Aktif Ditolak
  // =========================================================================
  console.log('\n--- UJI 4: Tanpa Shift Aktif Ditolak ---');
  // Simulasikan tidak ada activeShiftId sementara
  const originalActiveShiftId = (store as any).state.activeShiftId;
  (store as any).state.activeShiftId = null;

  let noShiftBlocked = false;
  try {
    await refundService.disburseRefund(approvedReq1.id, cashierUser.pin!);
  } catch (err: any) {
    noShiftBlocked = true;
    assert(err.message.includes('Shift kasir aktif diperlukan'), 'S04: Error shift kasir aktif diperlukan');
  }
  assert(noShiftBlocked, 'S04: Berhasil memblokir pencairan tanpa shift aktif');

  // Kembalikan activeShiftId
  (store as any).state.activeShiftId = originalActiveShiftId;

  // =========================================================================
  // SKENARIO 1, 9, 10, 11: Pencairan Berhasil oleh Kasir Bertugas
  // =========================================================================
  console.log('\n--- UJI 1, 9, 10, 11: Pencairan Berhasil & Integritas Finansial ---');
  const cashBeforeDisburse = store.getShiftAvailableCash(shift1.id);
  const disbursedReq1 = await refundService.disburseRefund(approvedReq1.id, cashierUser.pin!);

  assert(disbursedReq1.disbursement_status === 'disbursed', 'S01: Status disbursement berhasil menjadi disbursed');
  assert(disbursedReq1.disbursed_by_user_id === cashierUser.id, 'S01: Identitas kasir pencair tersimpan dengan benar');
  assert(disbursedReq1.disbursed_by_name === cashierUser.name, 'S01: Nama kasir pencair tercatat');
  assert(disbursedReq1.disbursed_shift_id === shift1.id, 'S10: Shift pencairan tercatat pada Shift 1 yang sedang aktif');
  assert(!!disbursedReq1.disbursed_at, 'S10: Timestamp penyerahan uang tersimpan');

  // Cek order terfinalisasi refunded
  const checkOrd1AfterDisbursed = store.getOrderById(ord1.id)!;
  assert(checkOrd1AfterDisbursed.payment?.status === 'refunded', 'S11: Order payment.status resmi difinalisasi menjadi refunded');
  assert(checkOrd1AfterDisbursed.refund_pending === false, 'S11: Flag refund_pending direset ke false');
  assert(checkOrd1AfterDisbursed.refund_shift_id === shift1.id, 'S11: refund_shift_id pada order terhubung ke Shift 1');

  // Cek integritas kas (Skenario 9: Mengurangi kas tepat satu kali)
  const cashAfterDisburse = store.getShiftAvailableCash(shift1.id);
  assert(
    cashBeforeDisburse - cashAfterDisburse === ord1.total_amount,
    `S09: Saldo kas fisik berkurang tepat Rp ${ord1.total_amount.toLocaleString('id-ID')} (Satu kali pengurangan)`
  );

  // =========================================================================
  // SKENARIO 7: Refund yang Sudah Dicairkan Tidak Dapat Dicairkan Ulang
  // =========================================================================
  console.log('\n--- UJI 7: Anti-Pencairan Ulang (Idempoten / Cegah Double Disburse) ---');
  let doubleDisburseBlocked = false;
  try {
    await refundService.disburseRefund(disbursedReq1.id, cashierUser.pin!);
  } catch (err: any) {
    doubleDisburseBlocked = true;
    assert(err.message.includes('sudah diserahkan sebelumnya'), 'S07: Error dana refund sudah diserahkan');
  }
  assert(doubleDisburseBlocked, 'S07: Berhasil memblokir pencairan ganda untuk request yang sama');

  // =========================================================================
  // SKENARIO 6: Refund Rejected Tidak Dapat Dicairkan
  // =========================================================================
  console.log('\n--- UJI 6: Refund Rejected Dilarang Dicairkan ---');
  // Kasir ajukan ord2
  const req2 = await refundService.submitRefundRequest(
    ord2.id,
    {
      refund_type: 'normal',
      reason: 'Rasa kurang manis',
      evidence_image_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
    cashierUser.pin!
  );

  // Owner menolak pengajuan req2
  setSession(ownerUser);
  const rejectedReq2 = await refundService.rejectRefundRequest(
    req2.id,
    ownerUser.pin!,
    'Produk sudah diminum habis'
  );
  assert(rejectedReq2.approval_status === 'rejected', 'S06: Request ord2 berhasil ditolak');

  // Kasir mencoba mencairkan req2 yang sudah ditolak
  setSession(cashierUser);
  let disburseRejectedBlocked = false;
  try {
    await refundService.disburseRefund(rejectedReq2.id, cashierUser.pin!);
  } catch (err: any) {
    disburseRejectedBlocked = true;
    assert(err.message.includes('telah disetujui Owner'), 'S06: Error penyerahan uang ditolak untuk request rejected');
  }
  assert(disburseRejectedBlocked, 'S06: Berhasil memblokir pencairan refund yang berstatus rejected');

  // =========================================================================
  // SKENARIO 12: Emergency Refund QRIS -> Tunai Tidak Double Deduction
  // =========================================================================
  console.log('\n--- UJI 12: Integritas Kas Emergency Refund (No Double Deduction) ---');
  const cashBeforeEmergency = store.getShiftAvailableCash(shift1.id);
  // Kasir ajukan emergency QRIS -> tunai
  const emergencyReq = await refundService.submitRefundRequest(
    ordQRIS.id,
    {
      refund_type: 'emergency',
      reason: 'Sistem QRIS offline di kasir',
      evidence_image_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
    cashierUser.pin!
  );

  assert(emergencyReq.refund_type === 'emergency', 'S12: Tipe pengajuan adalah emergency');
  assert(emergencyReq.disbursement_status === 'disbursed', 'S12: Dana emergency langsung disbursed saat diajukan');

  // Uang keluar seketika saat request dibuat
  const cashAfterEmergencySubmit = store.getShiftAvailableCash(shift1.id);
  assert(
    cashBeforeEmergency - cashAfterEmergencySubmit === ordQRIS.total_amount,
    'S12: Kas fisik laci langsung berkurang saat emergency diajukan'
  );

  // Owner menyetujui pengajuan emergency
  setSession(ownerUser);
  const approvedEmergency = await refundService.approveRefundRequest(
    emergencyReq.id,
    ownerUser.pin!,
    'Emergency terkonfirmasi disetujui'
  );

  assert(approvedEmergency.approval_status === 'approved', 'S12: Emergency approved oleh Owner');
  assert(approvedEmergency.disbursement_status === 'disbursed', 'S12: Disbursement status tetap disbursed');

  // Kas TIDAK berkurang kedua kalinya saat disetujui Owner
  const cashAfterEmergencyApprove = store.getShiftAvailableCash(shift1.id);
  assert(
    cashAfterEmergencySubmit === cashAfterEmergencyApprove,
    'S12: Zero Double Deduction: Persetujuan Owner atas emergency tidak mengurangi kas untuk kedua kalinya'
  );

  // Order emergency difinalisasi
  const checkOrdQRISEnd = store.getOrderById(ordQRIS.id)!;
  assert(checkOrdQRISEnd.payment?.status === 'refunded', 'S12: Transaksi QRIS emergency difinalisasi refunded');

  // =========================================================================
  // SKENARIO 15: Owner DILARANG Mencairkan Kas Refund Normal
  // =========================================================================
  console.log('\n--- UJI 15: Larangan Pencairan Kas Normal oleh Owner ---');
  // Kasir 1 ajukan ord3 (25.000)
  setSession(cashierUser);
  const req3 = await refundService.submitRefundRequest(
    ord3.id,
    {
      refund_type: 'normal',
      reason: 'Pesanan salah meja',
      evidence_image_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
    cashierUser.pin!
  );

  // Owner setujui req3
  setSession(ownerUser);
  const approvedReq3 = await refundService.approveRefundRequest(
    req3.id,
    ownerUser.pin!,
    'Disetujui untuk dicairkan oleh kasir'
  );
  assert(approvedReq3.approval_status === 'approved', 'S15: Request ord3 berhasil disetujui');

  // Owner mencoba mencairkan kas refund normal secara langsung (Harus Ditolak!)
  let ownerDisburseBlocked = false;
  try {
    await refundService.disburseRefund(approvedReq3.id, ownerUser.pin!);
  } catch (err: any) {
    ownerDisburseBlocked = true;
    assert(
      err.message.includes('Pemilik (Owner) tidak memiliki wewenang untuk mencairkan kas fisik refund normal'),
      'S15: Error otorisasi Owner mencairkan refund normal'
    );
  }
  assert(ownerDisburseBlocked, 'S15: Owner terbukti diblokir dari pencairan kas refund normal');

  // =========================================================================
  // SKENARIO 16: Pencairan Lintas Kasir & Lintas Shift (Shift 1 ke Shift 2)
  // =========================================================================
  console.log('\n--- UJI 16: Pencairan Lintas Kasir & Lintas Shift ---');
  // Tutup Shift 1
  setSession(cashierUser);
  store.closeShift({
    shift_id: shift1.id,
    actual_cash_end: 215000,
    user: cashierUser,
  });

  // Buka Shift 2 oleh Kasir 2 (Budi)
  setSession(cashier2User);
  const shift2 = store.openShift({
    cash_initial: 150000,
    user: cashier2User,
  });

  // Kasir 2 mencairkan req3 (yang diajukan Kasir 1 di Shift 1)
  const disbursedReq3ByCashier2 = await refundService.disburseRefund(approvedReq3.id, cashier2User.pin);

  assert(disbursedReq3ByCashier2.disbursement_status === 'disbursed', 'S16: Status pencairan berhasil menjadi disbursed');
  assert(disbursedReq3ByCashier2.requested_by_user_id === cashierUser.id, 'S16: Identitas pengaju awal tetap Kasir 1 (Dinda)');
  assert(disbursedReq3ByCashier2.requested_shift_id === shift1.id, 'S16: Shift pengajuan tetap tercatat di Shift 1');
  assert(disbursedReq3ByCashier2.disbursed_by_user_id === cashier2User.id, 'S16: Identitas pencair tercatat sebagai Kasir 2 (Budi)');
  assert(disbursedReq3ByCashier2.disbursed_by_name === cashier2User.name, 'S16: Nama pencair tercatat sebagai Kasir 2 (Budi)');
  assert(disbursedReq3ByCashier2.disbursed_shift_id === shift2.id, 'S16: Shift pencairan tercatat pada Shift 2 yang sedang aktif');

  // Kas Shift 2 berkurang tepat Rp 25.000 (150.000 -> 125.000)
  const cashShift2 = store.getShiftAvailableCash(shift2.id);
  assert(cashShift2 === 125000, 'S16: Kas fisik Shift 2 berkurang tepat Rp 25.000');

  // =========================================================================
  // REKONSILIASI KEUANGAN AKHIR SHIFT
  // =========================================================================
  console.log('\n--- AUDIT REKONSILIASI KAS SHIFT AKHIR ---');
  const fin = calculateShiftFinancials(
    shift1,
    store.getSnapshot().orders,
    store.getSnapshot().products,
    store.getSnapshot().recipes,
    store.getSnapshot().stocks,
    undefined,
    store.getShiftExpenses(shift1.id),
    store.getSnapshot().refundRequests
  );

  console.log(`  Modal Awal               : Rp ${fin.cash_initial.toLocaleString('id-ID')}`);
  console.log(`  Penjualan Tunai          : Rp ${fin.cash_sales.toLocaleString('id-ID')}`);
  console.log(`  Pengeluaran Refund Tunai : Rp ${fin.cash_refunds.toLocaleString('id-ID')}`);
  console.log(`  Total Kas yang Diharapkan: Rp ${fin.expected_cash_end.toLocaleString('id-ID')}`);

  // ord1 (30k normal cash refund) + ordQRIS (50k emergency cash refund) = 80k cash refunds pada Shift 1
  assert(fin.cash_refunds === 80000, 'AUDIT: Total cash refunds Shift 1 tetap tepat Rp 80.000 (Isolasi terjaga)');
  assert(fin.cash_sales === 95000, 'AUDIT: Total penjualan tunai Shift 1 tercatat tepat Rp 95.000');
  // Kas expected = modal (200k) + penjualan (95k) - refund (80k) = 215k
  assert(fin.expected_cash_end === 215000, 'AUDIT: Saldo akhir kas Shift 1 akurat (Rp 215.000)');

  // Rekonsiliasi Shift 2
  const fin2 = calculateShiftFinancials(
    shift2,
    store.getSnapshot().orders,
    store.getSnapshot().products,
    store.getSnapshot().recipes,
    store.getSnapshot().stocks,
    undefined,
    store.getShiftExpenses(shift2.id),
    store.getSnapshot().refundRequests
  );
  assert(fin2.cash_refunds === 25000, 'AUDIT: Total cash refunds Shift 2 tepat Rp 25.000');
  assert(fin2.expected_cash_end === 125000, 'AUDIT: Saldo akhir kas Shift 2 tepat Rp 125.000 (150.000 - 25.000)');

  resetStorageDriver();

  console.log('\n===============================================================');
  console.log('   ALL 16 CASHIER DISBURSEMENT SCENARIOS PASSED (100%)');
  console.log('===============================================================');
}

runCashierDisbursementValidation().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
