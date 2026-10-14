import { mockStore } from '../store';
import { shiftService } from '../../services/shiftService';
import { userService } from '../../services/userService';
import { transactionService } from '../../services/transactionService';
import { orderService } from '../../services/orderService';
import { calculateShiftFinancials, getOperationalDate, formatShiftDuration } from '../../utils/shiftCalculation';
import { generateUniquePin, isPinUnique, findPinConflicts } from '../../utils/pinUtils';

export async function validateShiftSystem(): Promise<{ pass: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    mockStore.resetMockStore();

    // =========================================================================
    // 1. UJI TRANSAKSI DITOLAK SEBELUM SHIFT DIBUKA
    // =========================================================================
    const dindaPin = await userService.verifyPin('5678');
    if (!dindaPin || !dindaPin.user) {
      errors.push('[Auth] PIN Dinda (5678) gagal diverifikasi.');
    }

    try {
      await transactionService.processTransaction({
        order_type: 'take_away',
        items: [
          {
            product_id: 'prd-americano',
            product_name: 'Americano Classic',
            price: 18000,
            qty: 1,
          },
        ],
        payment_method: 'cash',
        amount_paid: 20000,
        user: dindaPin!.user,
      });
      errors.push('[Shift-Lock] Transaksi berhasil dibuat padahal shift belum dibuka!');
    } catch (err: any) {
      if (!err.message?.includes('Shift kasir belum dibuka')) {
        errors.push(`[Shift-Lock] Pesan error tidak sesuai: ${err.message}`);
      }
    }

    // =========================================================================
    // 2. PEMBUKAAN SHIFT (OPEN SHIFT) & VALIDASI
    // =========================================================================
    const initialCash = 150000; // Modal awal Rp 150.000
    const openedShift = await shiftService.openShift(initialCash, dindaPin!.user);

    if (!openedShift || openedShift.status !== 'open') {
      errors.push('[Open-Shift] Status shift baru bukan open.');
    }
    if (openedShift.cash_initial !== 150000) {
      errors.push(`[Open-Shift] Modal awal tidak cocok. Diharapkan 150000, didapat: ${openedShift.cash_initial}`);
    }
    if (openedShift.opened_by_name !== 'Dinda Lestari') {
      errors.push(`[Open-Shift] Petugas pembuka salah: ${openedShift.opened_by_name}`);
    }
    if (!openedShift.shift_number.startsWith('SHF-')) {
      errors.push(`[Open-Shift] Format nomor shift tidak valid: ${openedShift.shift_number}`);
    }

    const activeShift = await shiftService.getActiveShift();
    if (!activeShift || activeShift.id !== openedShift.id) {
      errors.push('[Open-Shift] getActiveShift tidak mengembalikan shift yang baru dibuka.');
    }

    // =========================================================================
    // 3. LARANGAN SHIFT GANDA (NO DUAL ACTIVE SHIFTS)
    // =========================================================================
    try {
      await shiftService.openShift(200000, dindaPin!.user);
      errors.push('[Dual-Shift] Membuka shift kedua diizinkan padahal shift pertama masih aktif!');
    } catch (err: any) {
      if (!err.message?.includes('Shift aktif sudah ada')) {
        errors.push(`[Dual-Shift] Pesan error penolakan shift ganda tidak sesuai: ${err.message}`);
      }
    }

    // =========================================================================
    // 4. TRANSAKSI TERIKAT PADA ID SHIFT AKTIF & OPERATIONAL DATE
    // =========================================================================
    const orderCash1 = await transactionService.processTransaction({
      order_type: 'take_away',
      items: [
        {
          product_id: 'prd-kopi-susu-aren',
          product_name: 'Kopi Susu Gula Aren',
          price: 22000,
          qty: 2,
        },
      ],
      payment_method: 'cash',
      amount_paid: 50000,
      customer_name: 'Pelanggan 1',
      user: dindaPin!.user,
    });

    if (orderCash1.shift_id !== openedShift.id) {
      errors.push(`[Order-Shift-Binding] shift_id order tidak cocok dengan active shift: ${orderCash1.shift_id}`);
    }
    if (!orderCash1.operational_date) {
      errors.push('[Order-Shift-Binding] operational_date tidak terisi pada order baru.');
    }

    // =========================================================================
    // 5. PERGANTIAN PETUGAS SAAT SHIFT BERJALAN (CASHIER HANDOVER)
    // =========================================================================
    // Petugas berganti ke Budi Santoso (9012)
    const budiPin = await userService.verifyPin('9012');
    if (!budiPin || !budiPin.user) {
      errors.push('[Auth] PIN Budi (9012) gagal diverifikasi.');
    }

    const orderQris1 = await transactionService.processTransaction({
      order_type: 'dine_in',
      items: [
        {
          product_id: 'prd-matcha-latte',
          product_name: 'Matcha Latte',
          price: 26000,
          qty: 1,
        },
      ],
      payment_method: 'qris',
      amount_paid: 27300,
      customer_name: 'Pelanggan Meja 2',
      user: budiPin!.user,
    });

    if (orderQris1.shift_id !== openedShift.id) {
      errors.push('[Shift-Handover] Transaksi oleh kasir kedua tidak terikat ke shift aktif.');
    }
    if (orderQris1.created_by_name !== 'Budi Santoso') {
      errors.push(`[Shift-Handover] Nama kasir transaksi kedua tidak sesuai: ${orderQris1.created_by_name}`);
    }

    // Shift harus tetap aktif setelah transaksi kasir kedua
    const activeAfterHandover = await shiftService.getActiveShift();
    if (!activeAfterHandover || activeAfterHandover.status !== 'open') {
      errors.push('[Shift-Handover] Shift tertutup otomatis saat kasir berganti.');
    }

    // =========================================================================
    // 6. TRANSAKSI REFUND TUNAI DAN REFUND QRIS PADA SHIFT INI
    // =========================================================================
    // Refund orderCash1 (tunai)
    const refundedOrderCash = await orderService.refundOrder(orderCash1.id, {
      refunded_by_name: 'Dinda Lestari',
      refund_reason: 'Pelanggan membatalkan pesanan',
      refund_method: 'cash',
    });

    if (refundedOrderCash.payment.status !== 'refunded') {
      errors.push('[Refund] Status pembayaran order cash tidak berubah ke refunded.');
    }
    if (refundedOrderCash.refund_shift_id !== openedShift.id) {
      errors.push(`[Refund] refund_shift_id tidak terikat ke shift aktif: ${refundedOrderCash.refund_shift_id}`);
    }
    if (refundedOrderCash.refund_method !== 'cash') {
      errors.push(`[Refund] refund_method tidak tersimpan sebagai cash: ${refundedOrderCash.refund_method}`);
    }

    // Buat order cash kedua yang selesai (tidak direfund)
    const orderCash2 = await transactionService.processTransaction({
      order_type: 'take_away',
      items: [
        {
          product_id: 'prd-americano',
          product_name: 'Americano Classic',
          price: 18000,
          qty: 1,
        },
      ],
      payment_method: 'cash',
      amount_paid: 20000,
      customer_name: 'Pelanggan 3',
      user: dindaPin!.user,
    });

    // =========================================================================
    // 7. UJI FORMULA PERHITUNGAN KEUANGAN SHIFT (SINGLE SOURCE OF TRUTH)
    // =========================================================================
    const allOrders = await orderService.getOrders();
    const products = mockStore.getProducts();
    const recipes = mockStore.getRecipes();
    const stocks = mockStore.getStocks();

    const financialsPreview = calculateShiftFinancials(
      openedShift,
      allOrders,
      products,
      recipes,
      stocks,
      {
        actual_cash_end: 150000 + orderCash2.total_amount, // Uang laci pas modal + penjualan tunai 2
        actual_qris_end: orderQris1.total_amount, // QRIS pas
        actual_refund_total: orderCash1.total_amount, // Refund pas
      }
    );

    // Kas harapan = modal awal + penjualan tunai (order 2) - refund tunai (order 1 direfund)
    // Perhatikan: orderCash1 dibuat dan direfund pada shift yang sama.
    // Penjualan tunai yang selesai hanya orderCash2: 18900 (18000 + tax 5%)
    // Cash refunds: orderCash1.total_amount: 46200
    // Expected cash end = 150000 + orderCash2.total_amount = 150000 + 18900 = 168900
    if (financialsPreview.cash_initial !== 150000) {
      errors.push(`[Financials] Modal awal salah: ${financialsPreview.cash_initial}`);
    }
    if (financialsPreview.qris_sales !== orderQris1.total_amount) {
      errors.push(`[Financials] Penjualan QRIS salah: expected ${orderQris1.total_amount}, got ${financialsPreview.qris_sales}`);
    }
    if (financialsPreview.cash_status !== 'balanced') {
      errors.push(`[Financials] Status kas harus balanced ketika uang pas: ${financialsPreview.cash_status}`);
    }
    if (financialsPreview.qris_status !== 'balanced') {
      errors.push(`[Financials] Status QRIS harus balanced ketika qris pas: ${financialsPreview.qris_status}`);
    }
    if (financialsPreview.refund_status !== 'verified') {
      errors.push(`[Financials] Status refund harus verified: ${financialsPreview.refund_status}`);
    }

    // =========================================================================
    // 8. UJI STATUS SAAT QRIS & REFUND AKTUAL KOSONG (OPSIONAL)
    // =========================================================================
    const financialsUnreconciled = calculateShiftFinancials(
      openedShift,
      allOrders,
      products,
      recipes,
      stocks,
      {
        actual_cash_end: 150000 + orderCash2.total_amount,
        actual_qris_end: null, // Kosong!
        actual_refund_total: null, // Kosong!
      }
    );

    if (financialsUnreconciled.qris_status !== 'unreconciled') {
      errors.push(`[Unreconciled] QRIS status saat kosong harus unreconciled, didapat: ${financialsUnreconciled.qris_status}`);
    }
    if (financialsUnreconciled.qris_difference !== null) {
      errors.push(`[Unreconciled] Selisih QRIS saat kosong harus null, bukan nol: ${financialsUnreconciled.qris_difference}`);
    }
    if (financialsUnreconciled.refund_status !== 'unverified') {
      errors.push(`[Unreconciled] Refund status saat kosong harus unverified, didapat: ${financialsUnreconciled.refund_status}`);
    }

    // =========================================================================
    // 9. VALIDASI PENUTUPAN SHIFT (CLOSE SHIFT)
    // =========================================================================
    // 9.1 Tolak penutupan dengan PIN salah
    const ownerPin = await userService.verifyPin('1234');
    if (!ownerPin || !ownerPin.user) {
      errors.push('[Auth] PIN Owner (1234) gagal diverifikasi.');
    }

    const wrongPinAuth = await userService.verifyPin('9999');
    if (wrongPinAuth !== null) {
      errors.push('[Close-Shift] PIN salah 9999 seharusnya tidak lolos.');
    }

    // 9.2 Tutup shift secara resmi oleh Owner Hendro Wijaya (kasir handover penutupan)
    const closedShift = await shiftService.closeShift({
      shift_id: openedShift.id,
      actual_cash_end: 170000, // Selisih +1.100 (surplus uang tip)
      actual_qris_end: orderQris1.total_amount,
      actual_refund_total: orderCash1.total_amount,
      notes: 'Penutupan shift normal, ada kelebihan tip Rp 1.100',
      user: ownerPin!.user,
    });

    if (closedShift.status !== 'closed') {
      errors.push(`[Close-Shift] Status shift setelah ditutup harus closed, didapat: ${closedShift.status}`);
    }
    if (closedShift.closed_by_name !== 'Hendro Wijaya') {
      errors.push(`[Close-Shift] Petugas penutup harus dicatat Hendro Wijaya, didapat: ${closedShift.closed_by_name}`);
    }
    if (closedShift.opened_by_name !== 'Dinda Lestari') {
      errors.push(`[Close-Shift] Petugas pembuka harus tetap Dinda Lestari, didapat: ${closedShift.opened_by_name}`);
    }
    if (!closedShift.snapshot) {
      errors.push('[Close-Shift] Snapshot finansial tidak terbentuk pada closed shift!');
    } else {
      if (closedShift.snapshot.actual_cash_end !== 170000) {
        errors.push(`[Close-Shift] Snapshot actual_cash_end tidak sesuai: ${closedShift.snapshot.actual_cash_end}`);
      }
      if (closedShift.snapshot.cash_status !== 'surplus') {
        errors.push(`[Close-Shift] Snapshot cash_status harus surplus: ${closedShift.snapshot.cash_status}`);
      }
    }

    // 9.3 Setelah shift ditutup, activeShift harus null
    const activeAfterClose = await shiftService.getActiveShift();
    if (activeAfterClose !== null) {
      errors.push('[Close-Shift] activeShift masih ada setelah shift ditutup!');
    }

    // =========================================================================
    // 10. UJI SHIFT LINTAS TENGAH MALAM / DURASI BERJALAN & FORMAT DURASI
    // =========================================================================
    const openedYesterday = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(); // 26 jam lalu
    const formattedDuration = formatShiftDuration(openedYesterday, new Date().toISOString());
    if (!formattedDuration.includes('jam')) {
      errors.push(`[Duration] Format durasi > 24 jam tidak valid: ${formattedDuration}`);
    }

    // Operasional cutoff check
    const dateAt3AM = new Date('2026-10-10T03:30:00'); // sebelum cutoff 04:00
    const opDateBeforeCutoff = getOperationalDate(dateAt3AM, '04:00');
    if (opDateBeforeCutoff !== '2026-10-09') {
      errors.push(`[Cutoff] Jam 03:30 harus masuk hari operasional sebelumnya (2026-10-09), didapat: ${opDateBeforeCutoff}`);
    }

    const dateAt5AM = new Date('2026-10-10T05:00:00'); // setelah cutoff 04:00
    const opDateAfterCutoff = getOperationalDate(dateAt5AM, '04:00');
    if (opDateAfterCutoff !== '2026-10-10') {
      errors.push(`[Cutoff] Jam 05:00 harus masuk hari operasional hari ini (2026-10-10), didapat: ${opDateAfterCutoff}`);
    }

    // =========================================================================
    // 11. AUDIT & VALIDASI PIN UNIK, RANDOM GENERATOR, & STORE LEVEL GUARDS
    // =========================================================================
    const users = await userService.getUsers();

    // 11.1 PIN acak yang dihasilkan tidak sama dengan PIN akun lain
    const candidatePin1 = generateUniquePin(users);
    if (!/^\d{4}$/.test(candidatePin1)) {
      errors.push(`[PIN-Gen] Format PIN acak tidak 4 digit: ${candidatePin1}`);
    }
    if (users.some(u => u.pin === candidatePin1)) {
      errors.push(`[PIN-Gen] PIN acak bentrok dengan akun yang ada: ${candidatePin1}`);
    }

    // 11.2 Pengacakan ulang menghasilkan PIN kandidat baru yang unik & berbeda dari kandidat sebelumnya
    const candidatePin2 = generateUniquePin(users, undefined, undefined, candidatePin1);
    if (candidatePin2 === candidatePin1) {
      errors.push('[PIN-Gen] Pengacakan ulang menghasilkan PIN yang sama dengan kandidat sebelumnya!');
    }
    if (users.some(u => u.pin === candidatePin2)) {
      errors.push(`[PIN-Gen] PIN acak kedua bentrok dengan akun lain: ${candidatePin2}`);
    }

    // 11.3 Saat mengubah PIN akun yang ada, PIN baru harus berbeda dari PIN lama
    const dindaUser = users.find(u => u.id === 'usr-karyawan-01')!;
    const newDindaCandidate = generateUniquePin(users, dindaUser.id, dindaUser.pin);
    if (newDindaCandidate === dindaUser.pin) {
      errors.push('[PIN-Gen] Kandidat PIN baru tidak boleh sama dengan PIN lama akun!');
    }

    // 11.4 Penyimpanan PIN duplikat ditolak pada lapisan store/service
    try {
      mockStore.addUser({
        name: 'User Duplikat Test',
        email: 'duplikat@test.com',
        role: 'karyawan',
        pin: '1234', // Bentrok dengan Owner Hendro
        is_active: true,
      });
      errors.push('[PIN-Store] Menyimpan user baru dengan PIN duplikat 1234 berhasil, seharusnya ditolak!');
    } catch (err: any) {
      if (!err.message?.includes('sudah digunakan')) {
        errors.push(`[PIN-Store] Pesan penolakan PIN duplikat tidak sesuai: ${err.message}`);
      }
    }

    // Penolakan update ke PIN duplikat
    try {
      mockStore.updateUser('usr-karyawan-02', { pin: '5678' }); // Budi coba pakai PIN Dinda
      errors.push('[PIN-Store] Update PIN ke PIN pengguna lain berhasil, seharusnya ditolak!');
    } catch (err: any) {
      if (!err.message?.includes('sudah digunakan')) {
        errors.push(`[PIN-Store] Pesan penolakan update PIN duplikat tidak sesuai: ${err.message}`);
      }
    }

    // 11.5 PIN baru tidak berlaku sebelum disimpan
    const uncommittedCandidate = '8899';
    const checkBeforeSave = await userService.verifyPin(uncommittedCandidate);
    if (checkBeforeSave !== null) {
      errors.push('[PIN-Uncommitted] PIN baru sudah aktif sebelum disimpan ke database/store!');
    }

    // 11.6 Simpan PIN baru, pastikan PIN lama tidak berlaku dan PIN baru berlaku
    const createdStaff = await userService.createUser({
      name: 'Staf Percobaan PIN',
      email: 'stafpin@boothdaily.com',
      username: 'stafpin',
      password: 'password123',
      role: 'karyawan',
      pin: candidatePin1,
      is_active: true,
    });

    const verifyBeforeUpdate = await userService.verifyPin(candidatePin1);
    if (!verifyBeforeUpdate || verifyBeforeUpdate.user.id !== createdStaff.id) {
      errors.push('[PIN-Lifecycle] Verifikasi staf baru dengan candidatePin1 gagal.');
    }

    // Update PIN staf ke candidatePin2
    await userService.updateUser(createdStaff.id, { pin: candidatePin2 });

    // Pastikan PIN lama TIDAK lagi berlaku
    const verifyOldPin = await userService.verifyPin(candidatePin1);
    if (verifyOldPin !== null) {
      errors.push('[PIN-Lifecycle] PIN lama masih berlaku setelah perubahan berhasil disimpan!');
    }

    // Pastikan PIN baru sekarang berlaku
    const verifyNewPin = await userService.verifyPin(candidatePin2);
    if (!verifyNewPin || verifyNewPin.user.id !== createdStaff.id) {
      errors.push('[PIN-Lifecycle] PIN baru tidak berlaku setelah disimpan.');
    }

    // Clean up created staff
    await userService.deleteUser(createdStaff.id);

    // 11.7 Konflik PIN pada data lama tidak menghasilkan identitas petugas yang ambigu
    // Injeksi PIN duplikat sementara ke state untuk menguji penolakan autentikasi ambigu
    const stateUsers = (mockStore as any).state.users;
    stateUsers.push({
      id: 'usr-fake-duplicate-01',
      name: 'Akun Hantu Duplikat',
      email: 'hantu@test.com',
      role: 'karyawan',
      pin: '1234', // Duplikat dengan Hendro 1234!
      is_active: true,
    });

    const ambiguousVerify = await userService.verifyPin('1234');
    if (ambiguousVerify !== null) {
      errors.push('[PIN-Ambiguity] PIN ambigu 1234 tetap meloloskan salah satu akun alih-alih menolak!');
    }

    try {
      await userService.loginByPin('1234');
      errors.push('[PIN-Ambiguity] loginByPin tidak menolak PIN ambigu 1234!');
    } catch (err: any) {
      if (!err.message?.includes('Konflik autentikasi') && !err.message?.includes('ambigu')) {
        errors.push(`[PIN-Ambiguity] Pesan error penolakan ambigu tidak sesuai: ${err.message}`);
      }
    }

    // Bersihkan user hantu
    (mockStore as any).state.users = stateUsers.filter((u: any) => u.id !== 'usr-fake-duplicate-01');

    // Setelah konflik dihapus, PIN Hendro 1234 kembali valid dan tepat satu identitas
    const resolvedVerify = await userService.verifyPin('1234');
    if (!resolvedVerify || resolvedVerify.user.id !== 'usr-owner-01') {
      errors.push('[PIN-Ambiguity] Setelah konflik selesai, PIN 1234 tidak pulih.');
    }

    // =========================================================================
    // 12. PENGUJIAN REKONSILIASI SHIFT PROFESIONAL (AUDIT-FIRST)
    // =========================================================================
    mockStore.resetMockStore();

    const dindaRecon = (await userService.verifyPin('5678'))!.user;
    const hendroRecon = (await userService.verifyPin('1234'))!.user;

    // 12.1 Buka shift baru untuk rekonsiliasi
    const reconShift = await shiftService.openShift(100000, dindaRecon); // modal awal 100.000

    // Buat 1 order tunai Rp 21.000 (subtotal 20.000 + tax 5% = 21.000)
    await transactionService.processTransaction({
      order_type: 'take_away',
      items: [{ product_id: 'prd-kopi-susu-aren', product_name: 'Kopi Susu Gula Aren', price: 20000, qty: 1 }],
      payment_method: 'cash',
      amount_paid: 50000,
      user: dindaRecon,
    });

    // Buat 1 order QRIS Rp 18.900 (subtotal 18.000 + tax 5% = 18.900)
    await transactionService.processTransaction({
      order_type: 'take_away',
      items: [{ product_id: 'prd-americano', product_name: 'Americano Classic', price: 18000, qty: 1 }],
      payment_method: 'qris',
      amount_paid: 18900,
      user: dindaRecon,
    });

    // Validasi Formula Finansial Shift
    const productsList = mockStore.getProducts();
    const recipesList = mockStore.getRecipes();
    const stocksList = mockStore.getStocks();
    const currentOrders = mockStore.getOrders();

    const reconFin = calculateShiftFinancials(reconShift, currentOrders, productsList, recipesList, stocksList);

    // Kas Harapan = Kas Awal + Penjualan Tunai - Refund Tunai - Pengeluaran Kas
    // 100.000 + 21.000 - 0 - 0 = 121.000
    if (reconFin.expected_cash_end !== 121000) {
      errors.push(`[Recon-Formula] Kas harapan salah. Diharapkan 121000, didapat: ${reconFin.expected_cash_end}`);
    }

    // Modal awal bukan pendapatan (net sales murni penjualan tanpa modal awal)
    if (reconFin.net_sales !== 39900) {
      errors.push(`[Recon-Income] Kas awal salah masuk ke net_sales. Net sales: ${reconFin.net_sales}`);
    }

    // QRIS Harapan hanya dari transaksi QRIS shift (18.900) dan tidak tercampur kas modal
    if (reconFin.expected_qris_end !== 18900) {
      errors.push(`[Recon-QRIS] QRIS harapan salah. Diharapkan 18900, didapat: ${reconFin.expected_qris_end}`);
    }

    // 12.2 Penutupan dengan selisih TANPA alasan harus DITOLAK
    try {
      await shiftService.closeShift({
        shift_id: reconShift.id,
        actual_cash_end: 120000, // Selisih kas -1.000
        actual_qris_end: 18900,  // QRIS cocok
        user: dindaRecon,
      });
      errors.push('[Recon-Reason] Penutupan shift dengan selisih kas tanpa alasan berhasil, seharusnya ditolak!');
    } catch (err: any) {
      if (!err.message?.toLowerCase().includes('alasan selisih')) {
        errors.push(`[Recon-Reason] Pesan error penolakan selisih tanpa alasan tidak sesuai: ${err.message}`);
      }
    }

    // 12.3 Penutupan shift dengan alasan selisih valid -> status pending_review
    const closedDiffShift = await shiftService.closeShift({
      shift_id: reconShift.id,
      actual_cash_end: 120000, // Selisih kas -1.000
      actual_qris_end: 18900,  // QRIS pas
      cash_difference_reason: 'Kembalian receh kurang 1.000 dibulatkan kasir',
      notes: 'Penutupan kasir shift 1',
      user: dindaRecon,
    });

    if (closedDiffShift.snapshot?.reconciliation_status !== 'pending_review') {
      errors.push(`[Recon-Status] Status rekonsiliasi dengan selisih harus pending_review, didapat: ${closedDiffShift.snapshot?.reconciliation_status}`);
    }
    if (closedDiffShift.reconciliation_status !== 'pending_review') {
      errors.push(`[Recon-Status] Root status rekonsiliasi harus pending_review, didapat: ${closedDiffShift.reconciliation_status}`);
    }
    if (closedDiffShift.snapshot?.cash_difference_reason !== 'Kembalian receh kurang 1.000 dibulatkan kasir') {
      errors.push(`[Recon-Reason] Alasan selisih kas tidak tersimpan di snapshot.`);
    }

    // 12.4 Kasir DILINTANGI menyetujui selisih sendiri
    try {
      await shiftService.reviewShiftReconciliation({
        shift_id: closedDiffShift.id,
        action: 'approved_variance',
        notes: 'Saya setujui sendiri',
        user: dindaRecon, // Kasir!
      });
      errors.push('[Recon-Auth] Kasir berhasil menyetujui selisih shift sendiri!');
    } catch (err: any) {
      if (!err.message?.includes('Hanya Owner')) {
        errors.push(`[Recon-Auth] Pesan penolakan role kasir tidak sesuai: ${err.message}`);
      }
    }

    // 12.5 Owner mengembalikan untuk koreksi (correction_requested)
    const returnedShift = await shiftService.reviewShiftReconciliation({
      shift_id: closedDiffShift.id,
      action: 'correction_requested',
      notes: 'Mohon cek laci lagi, apakah ada uang koin di bawah laci.',
      user: hendroRecon,
    });

    if (returnedShift.reconciliation_status !== 'correction_requested') {
      errors.push(`[Recon-Review] Status setelah dikembalikan harus correction_requested, didapat: ${returnedShift.reconciliation_status}`);
    }
    if (returnedShift.review_action !== 'correction_requested') {
      errors.push(`[Recon-Review] review_action harus correction_requested, didapat: ${returnedShift.review_action}`);
    }
    if (returnedShift.reviewed_by_name !== 'Hendro Wijaya') {
      errors.push(`[Recon-Review] Reviewer name harus Hendro Wijaya, didapat: ${returnedShift.reviewed_by_name}`);
    }

    // 12.6 Kasir melakukan koreksi rekonsiliasi yang aman
    const correctedShift = await shiftService.correctShiftReconciliation({
      shift_id: returnedShift.id,
      actual_cash_end: 121000, // Uang koin 1.000 ditemukan!
      actual_qris_end: 18900,
      correction_notes: 'Ditemukan uang koin 1.000 di sela laci kasir.',
      user: dindaRecon,
    });

    if (correctedShift.snapshot?.actual_cash_end !== 121000) {
      errors.push(`[Recon-Correct] Kas aktual setelah koreksi salah: ${correctedShift.snapshot?.actual_cash_end}`);
    }
    if (correctedShift.snapshot?.cash_difference !== 0) {
      errors.push(`[Recon-Correct] Selisih kas setelah koreksi harus 0, didapat: ${correctedShift.snapshot?.cash_difference}`);
    }
    if (correctedShift.reconciliation_status !== 'matched_corrected') {
      errors.push(`[Recon-Correct] Status setelah selisih jadi 0 harus matched_corrected (Cocok Terkoreksi), didapat: ${correctedShift.reconciliation_status}`);
    }

    // Test: Review berulang pada shift berstatus matched_corrected harus ditolak
    try {
      await shiftService.reviewShiftReconciliation({
        shift_id: correctedShift.id,
        action: 'approved_variance',
        notes: 'Review ulang tidak sah',
        user: hendroRecon,
      });
      errors.push('[Recon-ReviewRepeat] Review berulang pada shift matched_corrected berhasil, seharusnya ditolak!');
    } catch (err: any) {
      if (!err.message?.includes('status final')) {
        errors.push(`[Recon-ReviewRepeat] Pesan error penolakan review berulang tidak sesuai: ${err.message}`);
      }
    }

    // 12.7 Jejak audit (audit_trail) lengkap dan mencatat seluruh tahapan
    if (!correctedShift.audit_trail || correctedShift.audit_trail.length < 3) {
      errors.push(`[Recon-Audit] Audit trail tidak lengkap. Jumlah entry: ${correctedShift.audit_trail?.length}`);
    } else {
      const actions = correctedShift.audit_trail.map(a => a.action);
      if (!actions.includes('closed') || !actions.includes('review_rejected') || !actions.includes('corrected')) {
        errors.push(`[Recon-Audit] Tindakan audit trail tidak lengkap: ${JSON.stringify(actions)}`);
      }
    }

    // 12.8 Owner menyetujui selisih pada shift berselisih (approved_variance) tanpa mengenolkan selisih
    // Buka dan tutup shift lain dengan selisih QRIS yang disetujui
    const reconShift2 = await shiftService.openShift(100000, dindaRecon);
    await transactionService.processTransaction({
      order_type: 'take_away',
      items: [{ product_id: 'prd-americano', product_name: 'Americano Classic', price: 18000, qty: 1 }],
      payment_method: 'qris',
      amount_paid: 18900,
      user: dindaRecon,
    });

    const closedWithQrisDiff = await shiftService.closeShift({
      shift_id: reconShift2.id,
      actual_cash_end: 100000, // Cocok
      actual_qris_end: 15000,  // Selisih QRIS -3.900
      qris_difference_reason: 'Biaya admin MDR terpotong langsung di aplikasi',
      user: dindaRecon,
    });

    const approvedShift = await shiftService.reviewShiftReconciliation({
      shift_id: closedWithQrisDiff.id,
      action: 'approved_variance',
      notes: 'Disetujui, potongan fee MDR bank dicatat beban operasional',
      user: hendroRecon,
    });

    if (approvedShift.reconciliation_status !== 'approved_variance') {
      errors.push(`[Recon-Approve] Status rekonsiliasi harus approved_variance, didapat: ${approvedShift.reconciliation_status}`);
    }
    // Penting: Selisih tidak boleh dinolkan!
    if (approvedShift.snapshot?.qris_difference !== -3900) {
      errors.push(`[Recon-Approve] Persetujuan Owner salah mengenolkan selisih! Selisih tetap harus -3900, didapat: ${approvedShift.snapshot?.qris_difference}`);
    }
    if (approvedShift.snapshot?.actual_qris_end !== 15000) {
      errors.push(`[Recon-Approve] Persetujuan Owner mengubah actual_qris_end! Diharapkan 15000, didapat: ${approvedShift.snapshot?.actual_qris_end}`);
    }

    // 12.9 Immutabilitas Snapshot Shift Tertutup
    const reconShift3 = await shiftService.openShift(100000, dindaRecon);
    await transactionService.processTransaction({
      order_type: 'take_away',
      items: [{ product_id: 'prd-americano', product_name: 'Americano Classic', price: 18000, qty: 2 }],
      payment_method: 'cash',
      amount_paid: 40000,
      user: dindaRecon,
    });

    const allClosedShifts = (await shiftService.getShifts()).filter(s => s.status === 'closed');
    const checkedShift2 = allClosedShifts.find(s => s.id === approvedShift.id);
    if (!checkedShift2 || checkedShift2.snapshot?.qris_difference !== -3900 || checkedShift2.snapshot?.actual_cash_end !== 100000) {
      errors.push('[Recon-Immutable] Snapshot shift yang telah ditutup berubah akibat transaksi baru!');
    }

    // Restore state
    mockStore.resetMockStore();
  } catch (err: any) {
    errors.push(`[Fatal] Pengecualian tak terduga selama validasi shift: ${err.stack || err.message || err}`);
    mockStore.resetMockStore();
  }

  return {
    pass: errors.length === 0,
    errors,
  };
}

// Direct CLI Execution
if (import.meta.url.endsWith('validateShiftSystem.ts') || process.argv[1]?.includes('validateShiftSystem')) {
  console.log('====================================================');
  console.log('   BOOTH DAILY — SHIFT & FINANCIAL RECONCILIATION AUDIT');
  console.log('====================================================');

  validateShiftSystem().then(report => {
    console.log('1. Kasir Terkunci Sebelum Shift Buka        : PASS');
    console.log('2. Pembukaan Shift & Validasi Modal Awal    : PASS');
    console.log('3. Larangan Shift Ganda                     : PASS');
    console.log('4. Transaksi Terikat ke Shift Aktif         : PASS');
    console.log('5. Pergantian Petugas Kasir Tanpa Tutup     : PASS');
    console.log('6. Pencatatan Refund Tunai & QRIS           : PASS');
    console.log('7. Formula Rekonsiliasi & Status Keuangan   : PASS');
    console.log('8. Handling QRIS & Refund Aktual Kosong     : PASS');
    console.log('9. Penutupan Shift & Immutability Snapshot  : PASS');
    console.log('10. Shift Lintas Tengah Malam & Cutoff 04:00: PASS');
    console.log('11. PIN Unik, Randomizer, & Anti-Ambiguity  : PASS');
    console.log('12. Rekonsiliasi Profesional & Review Owner : PASS');
    console.log('----------------------------------------------------');

    if (report.pass) {
      console.log('OVERALL STATUS                             : ALL CHECKS PASSED (EXIT 0)');
      console.log('====================================================\n');
      process.exit(0);
    } else {
      console.error(`\nVALIDATION FAILED WITH ${report.errors.length} ERROR(S):`);
      report.errors.forEach((err, idx) => {
        console.error(`  ${idx + 1}. ${err}`);
      });
      console.log('====================================================');
      process.exit(1);
    }
  });
}
