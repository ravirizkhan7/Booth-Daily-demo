import { mockStore } from '../store';
import { shiftService } from '../../services/shiftService';
import { userService } from '../../services/userService';
import { transactionService } from '../../services/transactionService';
import { calculateShiftFinancials } from '../../utils/shiftCalculation';

export async function runReconciliationScenarios() {
  console.log('===============================================================');
  console.log('   BOOTH DAILY — REKONSILIASI SHIFT PROFESIONAL SCENARIOS TEST');
  console.log('===============================================================');

  mockStore.resetMockStore();

  const dindaKasir = (await userService.verifyPin('5678'))!.user;
  const hendroOwner = (await userService.verifyPin('1234'))!.user;

  // -----------------------------------------------------------------
  // SKENARIO 1: Kas dan QRIS sama-sama cocok -> Status 'matched'
  // -----------------------------------------------------------------
  console.log('\n--- SKENARIO 1: Kas & QRIS Cocok ---');
  const s1 = await shiftService.openShift(100000, dindaKasir);
  await transactionService.processTransaction({
    order_type: 'take_away',
    items: [{ product_id: 'prd-americano', product_name: 'Americano Classic', price: 18000, qty: 1 }],
    payment_method: 'cash',
    amount_paid: 20000,
    user: dindaKasir,
  });
  await transactionService.processTransaction({
    order_type: 'take_away',
    items: [{ product_id: 'prd-kopi-susu-aren', product_name: 'Kopi Susu Gula Aren', price: 20000, qty: 1 }],
    payment_method: 'qris',
    amount_paid: 21000,
    user: dindaKasir,
  });

  // Harapan: Kas = 100.000 + 18.900 = 118.900; QRIS = 21.000
  const closedS1 = await shiftService.closeShift({
    shift_id: s1.id,
    actual_cash_end: 118900,
    actual_qris_end: 21000,
    user: dindaKasir,
  });

  if (closedS1.snapshot?.reconciliation_status !== 'matched') {
    throw new Error(`Skenario 1 Gagal: Status bukan matched, didapat ${closedS1.snapshot?.reconciliation_status}`);
  }
  if (closedS1.snapshot.cash_difference !== 0 || closedS1.snapshot.qris_difference !== 0) {
    throw new Error('Skenario 1 Gagal: Selisih bukan 0.');
  }
  console.log('✓ Skenario 1 PASS: Status matched, selisih Rp 0.');

  // -----------------------------------------------------------------
  // SKENARIO 2: Selisih kas saja -> Status 'pending_review'
  // -----------------------------------------------------------------
  console.log('\n--- SKENARIO 2: Selisih Kas Saja ---');
  const s2 = await shiftService.openShift(100000, dindaKasir);
  await transactionService.processTransaction({
    order_type: 'take_away',
    items: [{ product_id: 'prd-americano', product_name: 'Americano Classic', price: 18000, qty: 1 }],
    payment_method: 'cash',
    amount_paid: 20000,
    user: dindaKasir,
  });

  // Coba tutup tanpa alasan kas saat ada selisih
  try {
    await shiftService.closeShift({
      shift_id: s2.id,
      actual_cash_end: 115000, // Selisih kas -3.900
      actual_qris_end: 0,
      user: dindaKasir,
    });
    throw new Error('Skenario 2 Gagal: Penutupan tanpa alasan kas tidak ditolak!');
  } catch (err: any) {
    if (!err.message?.toLowerCase().includes('alasan selisih')) {
      throw err;
    }
    console.log('✓ Skenario 2a PASS: Penutupan tanpa alasan kas berhasil ditolak.');
  }

  // Tutup dengan alasan kas
  const closedS2 = await shiftService.closeShift({
    shift_id: s2.id,
    actual_cash_end: 115000,
    actual_qris_end: 0,
    cash_difference_reason: 'Selisih uang kembalian pecahan kecil koin',
    user: dindaKasir,
  });

  if (closedS2.snapshot?.reconciliation_status !== 'pending_review') {
    throw new Error(`Skenario 2b Gagal: Status bukan pending_review, didapat ${closedS2.snapshot?.reconciliation_status}`);
  }
  if (closedS2.snapshot.cash_difference !== -3900) {
    throw new Error(`Skenario 2b Gagal: Selisih kas salah, didapat ${closedS2.snapshot.cash_difference}`);
  }
  console.log('✓ Skenario 2b PASS: Status pending_review dengan alasan kas tersimpan.');

  // -----------------------------------------------------------------
  // SKENARIO 3: Selisih QRIS saja -> Status 'pending_review'
  // -----------------------------------------------------------------
  console.log('\n--- SKENARIO 3: Selisih QRIS Saja ---');
  const s3 = await shiftService.openShift(100000, dindaKasir);
  await transactionService.processTransaction({
    order_type: 'take_away',
    items: [{ product_id: 'prd-kopi-susu-aren', product_name: 'Kopi Susu Gula Aren', price: 20000, qty: 1 }],
    payment_method: 'qris',
    amount_paid: 21000,
    user: dindaKasir,
  });

  // Tutup dengan selisih QRIS
  const closedS3 = await shiftService.closeShift({
    shift_id: s3.id,
    actual_cash_end: 100000, // Kas pas
    actual_qris_end: 20000,  // QRIS selisih -1.000
    qris_difference_reason: 'Potongan MDR QRIS',
    user: dindaKasir,
  });

  if (closedS3.snapshot?.reconciliation_status !== 'pending_review') {
    throw new Error(`Skenario 3 Gagal: Status bukan pending_review, didapat ${closedS3.snapshot?.reconciliation_status}`);
  }
  if (closedS3.snapshot.cash_difference !== 0 || closedS3.snapshot.qris_difference !== -1000) {
    throw new Error('Skenario 3 Gagal: Perhitungan selisih salah.');
  }
  console.log('✓ Skenario 3 PASS: Status pending_review dengan alasan QRIS tersimpan.');

  // -----------------------------------------------------------------
  // SKENARIO 4: Kedua selisih -> Status 'pending_review'
  // -----------------------------------------------------------------
  console.log('\n--- SKENARIO 4: Kas dan QRIS Keduanya Berselisih ---');
  const s4 = await shiftService.openShift(100000, dindaKasir);
  await transactionService.processTransaction({
    order_type: 'take_away',
    items: [{ product_id: 'prd-americano', product_name: 'Americano Classic', price: 18000, qty: 1 }],
    payment_method: 'cash',
    amount_paid: 20000,
    user: dindaKasir,
  });
  await transactionService.processTransaction({
    order_type: 'take_away',
    items: [{ product_id: 'prd-kopi-susu-aren', product_name: 'Kopi Susu Gula Aren', price: 20000, qty: 1 }],
    payment_method: 'qris',
    amount_paid: 21000,
    user: dindaKasir,
  });

  const closedS4 = await shiftService.closeShift({
    shift_id: s4.id,
    actual_cash_end: 120000, // Selisih +1.100
    actual_qris_end: 20000,  // Selisih -1.000
    cash_difference_reason: 'Tip pelanggan ditinggal di kasir',
    qris_difference_reason: 'Biaya admin transfer',
    user: dindaKasir,
  });

  if (closedS4.snapshot?.reconciliation_status !== 'pending_review') {
    throw new Error('Skenario 4 Gagal: Status bukan pending_review.');
  }
  console.log('✓ Skenario 4 PASS: Kedua selisih tercatat dengan alasan terpisah.');

  // -----------------------------------------------------------------
  // SKENARIO 5: Review Owner - Otorisasi & Kembalikan untuk Koreksi
  // -----------------------------------------------------------------
  console.log('\n--- SKENARIO 5: Review Owner & Alur Koreksi ---');
  // Kasir mencoba review sendiri -> harus ditolak
  try {
    await shiftService.reviewShiftReconciliation({
      shift_id: closedS4.id,
      action: 'approved_variance',
      user: dindaKasir,
    });
    throw new Error('Skenario 5a Gagal: Kasir berhasil mereview shift!');
  } catch (err: any) {
    if (!err.message?.includes('Hanya Owner')) {
      throw err;
    }
    console.log('✓ Skenario 5a PASS: Kasir ditolak mereview selisih.');
  }

  // Owner mengembalikan untuk koreksi
  const rejectedS4 = await shiftService.reviewShiftReconciliation({
    shift_id: closedS4.id,
    action: 'correction_requested',
    notes: 'Periksa kembali mutasi QRIS dan hitung uang tip.',
    user: hendroOwner,
  });

  if (rejectedS4.reconciliation_status !== 'correction_requested') {
    throw new Error('Skenario 5b Gagal: Status bukan correction_requested.');
  }
  console.log('✓ Skenario 5b PASS: Shift berhasil dikembalikan Owner untuk koreksi.');

  // Kasir mengoreksi rekonsiliasi
  const correctedS4 = await shiftService.correctShiftReconciliation({
    shift_id: rejectedS4.id,
    actual_cash_end: 118900, // Cocok
    actual_qris_end: 21000,  // Cocok
    correction_notes: 'Ditemukan selisih telah diklarifikasi ulang dengan nota.',
    user: dindaKasir,
  });

  if (correctedS4.reconciliation_status !== 'matched_corrected') {
    throw new Error(`Skenario 5c Gagal: Status setelah koreksi selisih nol harus matched_corrected (Cocok Terkoreksi), didapat ${correctedS4.reconciliation_status}`);
  }
  if (correctedS4.snapshot?.cash_difference !== 0 || correctedS4.snapshot?.qris_difference !== 0) {
    throw new Error('Skenario 5c Gagal: Nilai selisih setelah koreksi tidak nol.');
  }
  console.log('✓ Skenario 5c PASS: Koreksi rekonsiliasi berhasil dan status menjadi matched_corrected (Cocok Terkoreksi).');

  // Test: Review berulang pada status final matched_corrected ditolak
  try {
    await shiftService.reviewShiftReconciliation({
      shift_id: correctedS4.id,
      action: 'approved_variance',
      notes: 'Review ulang tidak sah',
      user: hendroOwner,
    });
    throw new Error('Skenario 5d Gagal: Review berulang pada shift matched_corrected berhasil, seharusnya ditolak!');
  } catch (err: any) {
    if (!err.message?.includes('status final')) {
      throw err;
    }
  }
  console.log('✓ Skenario 5d PASS: Review berulang pada status final matched_corrected berhasil ditolak.');

  // -----------------------------------------------------------------
  // SKENARIO 6: Review Owner - Setujui Selisih (approved_variance)
  // -----------------------------------------------------------------
  console.log('\n--- SKENARIO 6: Owner Menyetujui Selisih Tanpa Menolkan Nilai Riil ---');
  const approvedS2 = await shiftService.reviewShiftReconciliation({
    shift_id: closedS2.id,
    action: 'approved_variance',
    notes: 'Selisih Rp 3.900 disetujui sebagai beban pembulatan.',
    user: hendroOwner,
  });

  if (approvedS2.reconciliation_status !== 'approved_variance') {
    throw new Error(`Skenario 6 Gagal: Status bukan approved_variance, didapat ${approvedS2.reconciliation_status}`);
  }
  if (approvedS2.snapshot?.cash_difference !== -3900) {
    throw new Error(`Skenario 6 Gagal: Persetujuan Owner mengenolkan selisih kas! Didapat ${approvedS2.snapshot?.cash_difference}`);
  }
  if (approvedS2.snapshot?.actual_cash_end !== 115000) {
    throw new Error(`Skenario 6 Gagal: Nilai aktual diubah! Didapat ${approvedS2.snapshot?.actual_cash_end}`);
  }
  console.log('✓ Skenario 6 PASS: Selisih disetujui Owner dengan nilai riil tetap utuh (-3.900).');

  // Test: Review berulang pada status final approved_variance ditolak
  try {
    await shiftService.reviewShiftReconciliation({
      shift_id: approvedS2.id,
      action: 'correction_requested',
      notes: 'Ubah keputusan',
      user: hendroOwner,
    });
    throw new Error('Skenario 6b Gagal: Review berulang pada status approved_variance berhasil, seharusnya ditolak!');
  } catch (err: any) {
    if (!err.message?.includes('status final')) {
      throw err;
    }
  }
  console.log('✓ Skenario 6b PASS: Review berulang pada status final approved_variance berhasil ditolak.');

  // -----------------------------------------------------------------
  // SKENARIO 7: Immutabilitas Snapshot Shift Tertutup
  // -----------------------------------------------------------------
  console.log('\n--- SKENARIO 7: Immutabilitas Snapshot Shift Tertutup ---');
  // Buka shift baru dan buat transaksi besar
  const s5 = await shiftService.openShift(200000, dindaKasir);
  await transactionService.processTransaction({
    order_type: 'take_away',
    items: [{ product_id: 'prd-kopi-susu-aren', product_name: 'Kopi Susu Gula Aren', price: 20000, qty: 5 }],
    payment_method: 'cash',
    amount_paid: 150000,
    user: dindaKasir,
  });

  const shiftsAfterNewOrder = await shiftService.getShifts();
  const checkedS1After = shiftsAfterNewOrder.find(s => s.id === closedS1.id);
  const checkedS2After = shiftsAfterNewOrder.find(s => s.id === approvedS2.id);

  if (checkedS1After?.snapshot?.actual_cash_end !== 118900 || checkedS1After.snapshot?.cash_difference !== 0) {
    throw new Error('Skenario 7 Gagal: Shift 1 berubah setelah transaksi di shift 5!');
  }
  if (checkedS2After?.snapshot?.actual_cash_end !== 115000 || checkedS2After.snapshot?.cash_difference !== -3900) {
    throw new Error('Skenario 7 Gagal: Shift 2 berubah setelah transaksi di shift 5!');
  }
  console.log('✓ Skenario 7 PASS: Snapshot shift tertutup terbukti permanen dan immutable.');

  console.log('\n===============================================================');
  console.log('   SELURUH SKENARIO REKONSILIASI LULUS DENGAN SEMPURNA (PASS)');
  console.log('===============================================================');
}

runReconciliationScenarios().catch(err => {
  console.error('\nFAIL:', err);
  process.exit(1);
});
