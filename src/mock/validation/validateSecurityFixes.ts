import { MockStore } from '../store';
import { sessionManager } from '../repositories/sessionManager';
import {
  setStorageDriver,
  resetStorageDriver,
  StorageDriver,
  DEMO_STORAGE_KEY,
} from '../persistence/storage';
import { User, Shift } from '../../types';

class NodeMemoryStorageDriver implements StorageDriver {
  public store: Record<string, string> = {};
  public isAvailable(): boolean {
    return true;
  }
  public getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  public setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  public removeItem(key: string): void {
    delete this.store[key];
  }
  public clear(): void {
    this.store = {};
  }
}

class FailingMemoryDriver extends NodeMemoryStorageDriver {
  public failOnWrite = false;
  public writeAttempts = 0;
  public override setItem(key: string, value: string): void {
    this.writeAttempts++;
    if (this.failOnWrite) {
      const err = new Error('Disk quota exceeded (simulated error)');
      err.name = 'QuotaExceededError';
      throw err;
    }
    super.setItem(key, value);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION_FAILED] ${message}`);
  }
}

export async function runSecurityRegressionTests(): Promise<{
  pass: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  const testDriver = new FailingMemoryDriver();
  setStorageDriver(testDriver);

  // Simpan session awal jika ada
  const initialSession = sessionManager.getSession();

  try {
    const store = new MockStore();

    // Pastikan user default ada
    const ownerUser = store.getUsers().find(u => u.id === 'usr-owner-01' && u.role === 'owner' && u.is_active);
    const employeeUser = store.getUsers().find(u => u.id === 'usr-karyawan-01' && u.role === 'karyawan' && u.is_active);
    assert(Boolean(ownerUser), 'Seed Owner (usr-owner-01) harus tersedia dan aktif');
    assert(Boolean(employeeUser), 'Seed Karyawan (usr-karyawan-01) harus tersedia dan aktif');

    // Buat dummy inactive owner untuk pengetesan
    sessionManager.setSession({
      userId: ownerUser!.id,
      token: 'init_token',
      loggedInAt: new Date().toISOString(),
    });
    const inactiveOwner = store.addUser({
      id: 'usr-owner-inactive-test',
      name: 'Inactive Owner Test',
      email: 'inactive_owner_sec@boothdaily.com',
      role: 'owner',
      pin: '7766',
      is_active: false,
    });
    sessionManager.clearSession();

    // =========================================================================
    // HELPER: Siapkan Shift Tertutup dengan Selisih untuk Review
    // =========================================================================
    const setupPendingReviewShift = (shiftIdSuffix: string): Shift => {
      // Buka shift sebagai kasir
      const shift = store.openShift(100000, employeeUser!);
      // Tutup shift dengan selisih kas (misal fisik kas 95.000, kurang 5.000)
      const closed = store.closeShift({
        shift_id: shift.id,
        actual_cash_end: 95000,
        actual_qris_end: null,
        actual_refund_total: null,
        cash_difference_reason: 'Uang receh hilang di bawah meja',
        notes: 'Selisih kas test',
        user: employeeUser!,
      });
      assert(closed.status === 'closed', 'Shift harus berhasil ditutup');
      assert(closed.reconciliation_status === 'pending_review', 'Status rekonsiliasi harus pending_review');
      return closed;
    };

    console.log('\n--- PENGUJIAN DEFECT-SEC-01 (Role Spoofing on reviewShiftReconciliation) ---');

    // -------------------------------------------------------------------------
    // TEST 1: Owner aktif dengan sesi valid dapat menyetujui rekonsiliasi
    // -------------------------------------------------------------------------
    try {
      const shift1 = setupPendingReviewShift('t1');
      sessionManager.setSession({
        userId: ownerUser!.id,
        token: 'owner_valid_session',
        loggedInAt: new Date().toISOString(),
      });

      const approved = store.reviewShiftReconciliation({
        shift_id: shift1.id,
        action: 'approved_variance',
        notes: 'Disetujui oleh Owner sah',
      });

      assert(approved.reconciliation_status === 'approved_variance', 'Test 1: Status shift harus approved_variance');
      assert(approved.reviewed_by_user_id === ownerUser!.id, 'Test 1: reviewed_by_user_id harus ID Owner dari sesi');
      assert(approved.reviewed_by_name === ownerUser!.name, 'Test 1: reviewed_by_name harus Nama Owner dari sesi');
      console.log('✓ Test 1 PASS: Owner aktif dengan sesi valid berhasil menyetujui rekonsiliasi');
    } catch (err: any) {
      errors.push(`Test 1 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Karyawan aktif ditolak ketika mengirim payload.user.role: 'owner' (Role Spoofing)
    // -------------------------------------------------------------------------
    try {
      const shift2 = setupPendingReviewShift('t2');
      sessionManager.setSession({
        userId: employeeUser!.id, // Sesi aktif adalah KARYAWAN!
        token: 'employee_session',
        loggedInAt: new Date().toISOString(),
      });

      let spoofBlocked = false;
      try {
        store.reviewShiftReconciliation({
          shift_id: shift2.id,
          action: 'approved_variance',
          notes: 'Percobaan spoofing role',
          user: {
            ...employeeUser!,
            role: 'owner' as any, // Pemalsuan caller!
          },
        });
      } catch (err: any) {
        if (err.message.includes('Hanya Owner')) {
          spoofBlocked = true;
        } else {
          throw new Error(`Pesan error tidak sesuai: ${err.message}`);
        }
      }

      assert(spoofBlocked, 'Test 2: Karyawan aktif dengan payload role: owner harus ditolak');
      const shiftCheck = store.getShiftById(shift2.id);
      assert(shiftCheck?.reconciliation_status === 'pending_review', 'Test 2: Status shift tidak boleh berubah');
      console.log('✓ Test 2 PASS: Karyawan aktif ditolak meskipun mengirim payload.user.role: "owner"');
    } catch (err: any) {
      errors.push(`Test 2 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Guest tanpa sesi ditolak
    // -------------------------------------------------------------------------
    try {
      const shift3 = setupPendingReviewShift('t3');
      sessionManager.clearSession(); // Tidak ada sesi

      let guestBlocked = false;
      try {
        store.reviewShiftReconciliation({
          shift_id: shift3.id,
          action: 'approved_variance',
          notes: 'Review tanpa sesi',
          user: ownerUser!,
        });
      } catch (err: any) {
        if (err.message.includes('Sesi login Owner aktif diperlukan')) {
          guestBlocked = true;
        } else {
          throw new Error(`Pesan error tidak sesuai: ${err.message}`);
        }
      }

      assert(guestBlocked, 'Test 3: Guest tanpa sesi harus ditolak');
      console.log('✓ Test 3 PASS: Guest tanpa sesi ditolak meninjau rekonsiliasi');
    } catch (err: any) {
      errors.push(`Test 3 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 4: ID Owner palsu atau tidak terdaftar ditolak
    // -------------------------------------------------------------------------
    try {
      const shift4 = setupPendingReviewShift('t4');
      sessionManager.setSession({
        userId: 'usr-fake-nonexistent-owner',
        token: 'fake_token',
        loggedInAt: new Date().toISOString(),
      });

      let unregBlocked = false;
      try {
        store.reviewShiftReconciliation({
          shift_id: shift4.id,
          action: 'approved_variance',
          notes: 'Review dengan ID palsu',
        });
      } catch (err: any) {
        if (err.message.includes('Pengguna sesi tidak ditemukan')) {
          unregBlocked = true;
        } else {
          throw new Error(`Pesan error tidak sesuai: ${err.message}`);
        }
      }

      assert(unregBlocked, 'Test 4: ID Owner palsu/tidak terdaftar harus ditolak');
      console.log('✓ Test 4 PASS: ID Owner tidak terdaftar ditolak meninjau rekonsiliasi');
    } catch (err: any) {
      errors.push(`Test 4 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Akun Owner nonaktif ditolak
    // -------------------------------------------------------------------------
    try {
      const shift5 = setupPendingReviewShift('t5');
      sessionManager.setSession({
        userId: inactiveOwner.id,
        token: 'inactive_owner_token',
        loggedInAt: new Date().toISOString(),
      });

      let inactiveBlocked = false;
      try {
        store.reviewShiftReconciliation({
          shift_id: shift5.id,
          action: 'approved_variance',
          notes: 'Review dengan Owner nonaktif',
        });
      } catch (err: any) {
        if (err.message.includes('dinonaktifkan atau tidak aktif')) {
          inactiveBlocked = true;
        } else {
          throw new Error(`Pesan error tidak sesuai: ${err.message}`);
        }
      }

      assert(inactiveBlocked, 'Test 5: Akun Owner nonaktif harus ditolak');
      console.log('✓ Test 5 PASS: Akun Owner nonaktif ditolak meninjau rekonsiliasi');
    } catch (err: any) {
      errors.push(`Test 5 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Audit trail mencatat identitas Owner dari sesi yang terverifikasi
    // -------------------------------------------------------------------------
    try {
      const shift6 = setupPendingReviewShift('t6');
      sessionManager.setSession({
        userId: ownerUser!.id,
        token: 'verified_owner_tok',
        loggedInAt: new Date().toISOString(),
      });

      const reviewed = store.reviewShiftReconciliation({
        shift_id: shift6.id,
        action: 'correction_requested',
        notes: 'Periksa kembali mutasi kas',
        user: { id: 'spoofed-id', name: 'Spoofed Caller', role: 'owner' } as any, // Caller kirim nama/id lain
      });

      assert(Boolean(reviewed.audit_trail && reviewed.audit_trail.length > 0), 'Test 6: Audit trail harus ada');
      const latestAudit = reviewed.audit_trail![reviewed.audit_trail!.length - 1];
      assert(latestAudit.action === 'review_rejected', 'Test 6: Audit action harus review_rejected');
      assert(latestAudit.user_id === ownerUser!.id, 'Test 6: Audit user_id harus ID Owner sesi terverifikasi');
      assert(latestAudit.user_name === ownerUser!.name, 'Test 6: Audit user_name harus Nama Owner sesi terverifikasi');
      assert(latestAudit.user_role === 'owner', 'Test 6: Audit user_role harus owner');
      console.log('✓ Test 6 PASS: Jejak audit mencatat identitas Owner dari sesi terverifikasi, bukan dari caller');
    } catch (err: any) {
      errors.push(`Test 6 Gagal: ${err.message}`);
    }

    console.log('\n--- PENGUJIAN DEFECT-SEC-02 (Store Layer Session Guard for Users & Settings) ---');

    // -------------------------------------------------------------------------
    // TEST 7: addUser() tanpa sesi ditolak tanpa mutasi
    // -------------------------------------------------------------------------
    try {
      sessionManager.clearSession();
      const usersBefore = store.getUsers().length;
      let blocked = false;
      try {
        store.addUser({
          name: 'Hacker User',
          email: 'hacker@demo.com',
          role: 'karyawan',
          pin: '9988',
          is_active: true,
        });
      } catch (err: any) {
        if (err.message.includes('Sesi login Owner aktif diperlukan')) {
          blocked = true;
        }
      }
      assert(blocked, 'Test 7: addUser() tanpa sesi harus ditolak');
      assert(store.getUsers().length === usersBefore, 'Test 7: State users tidak boleh termutasi');
      console.log('✓ Test 7 PASS: addUser() tanpa sesi ditolak tanpa mutasi');
    } catch (err: any) {
      errors.push(`Test 7 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 8: updateUser() tanpa sesi ditolak tanpa mutasi
    // -------------------------------------------------------------------------
    try {
      sessionManager.clearSession();
      const targetUser = employeeUser!;
      let blocked = false;
      try {
        store.updateUser(targetUser.id, { name: 'Hacked Employee Name' });
      } catch (err: any) {
        if (err.message.includes('Sesi login Owner aktif diperlukan')) {
          blocked = true;
        }
      }
      assert(blocked, 'Test 8: updateUser() tanpa sesi harus ditolak');
      const refreshed = store.getUserById(targetUser.id);
      assert(refreshed?.name === targetUser.name, 'Test 8: Nama pengguna tidak boleh berubah');
      console.log('✓ Test 8 PASS: updateUser() tanpa sesi ditolak tanpa mutasi');
    } catch (err: any) {
      errors.push(`Test 8 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 9: deleteUser() tanpa sesi ditolak tanpa mutasi
    // -------------------------------------------------------------------------
    try {
      sessionManager.clearSession();
      const targetUser = employeeUser!;
      const usersBefore = store.getUsers().length;
      let blocked = false;
      try {
        store.deleteUser(targetUser.id);
      } catch (err: any) {
        if (err.message.includes('Sesi login Owner aktif diperlukan')) {
          blocked = true;
        }
      }
      assert(blocked, 'Test 9: deleteUser() tanpa sesi harus ditolak');
      assert(store.getUsers().length === usersBefore, 'Test 9: Pengguna tidak boleh terhapus');
      console.log('✓ Test 9 PASS: deleteUser() tanpa sesi ditolak tanpa mutasi');
    } catch (err: any) {
      errors.push(`Test 9 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 10: updateSettings() tanpa sesi ditolak tanpa mutasi
    // -------------------------------------------------------------------------
    try {
      sessionManager.clearSession();
      const settingsBefore = store.getSettings();
      let blocked = false;
      try {
        store.updateSettings({ store_name: 'HACKED STORE NAME' });
      } catch (err: any) {
        if (err.message.includes('Sesi login Owner aktif diperlukan')) {
          blocked = true;
        }
      }
      assert(blocked, 'Test 10: updateSettings() tanpa sesi harus ditolak');
      assert(store.getSettings().store_name === settingsBefore.store_name, 'Test 10: Pengaturan toko tidak boleh berubah');
      console.log('✓ Test 10 PASS: updateSettings() tanpa sesi ditolak tanpa mutasi');
    } catch (err: any) {
      errors.push(`Test 10 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Keempat operasi menolak sesi karyawan dan metadata role palsu
    // -------------------------------------------------------------------------
    try {
      sessionManager.setSession({
        userId: employeeUser!.id, // Karyawan
        token: 'karyawan_token',
        loggedInAt: new Date().toISOString(),
      });

      // 11a. addUser
      let addBlocked = false;
      try {
        store.addUser({ name: 'Staff by Staff', email: 'sbs@demo.com', role: 'owner' as any, pin: '3322', is_active: true });
      } catch (err: any) {
        if (err.message.includes('Hanya Owner')) addBlocked = true;
      }
      assert(addBlocked, 'Test 11a: addUser oleh karyawan harus ditolak');

      // 11b. updateUser
      let updateBlocked = false;
      try {
        store.updateUser(employeeUser!.id, { name: 'Attempted Self Elevation' });
      } catch (err: any) {
        if (err.message.includes('Hanya Owner')) updateBlocked = true;
      }
      assert(updateBlocked, 'Test 11b: updateUser oleh karyawan harus ditolak');

      // 11c. deleteUser
      let deleteBlocked = false;
      try {
        store.deleteUser('usr-karyawan-02');
      } catch (err: any) {
        if (err.message.includes('Hanya Owner')) deleteBlocked = true;
      }
      assert(deleteBlocked, 'Test 11c: deleteUser oleh karyawan harus ditolak');

      // 11d. updateSettings
      let settingsBlocked = false;
      try {
        store.updateSettings({ store_name: 'Employee Override' });
      } catch (err: any) {
        if (err.message.includes('Hanya Owner')) settingsBlocked = true;
      }
      assert(settingsBlocked, 'Test 11d: updateSettings oleh karyawan harus ditolak');

      console.log('✓ Test 11 PASS: Keempat operasi menolak sesi karyawan dan metadata role palsu');
    } catch (err: any) {
      errors.push(`Test 11 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 12: Owner aktif dengan sesi valid tetap dapat menjalankan operasi yang diizinkan
    // -------------------------------------------------------------------------
    try {
      sessionManager.setSession({
        userId: ownerUser!.id,
        token: 'valid_owner_token',
        loggedInAt: new Date().toISOString(),
      });

      // 12a. addUser
      const createdUser = store.addUser({
        name: 'Valid New Cashier',
        email: 'validcashier@boothdaily.com',
        role: 'karyawan',
        pin: '6543',
        is_active: true,
      });
      assert(Boolean(createdUser.id), 'Test 12a: Owner berhasil menambahkan user');

      // 12b. updateUser
      const updatedUser = store.updateUser(createdUser.id, {
        name: 'Renamed Cashier',
      });
      assert(updatedUser.name === 'Renamed Cashier', 'Test 12b: Owner berhasil memperbarui user');

      // 12c. updateSettings
      const updatedSettings = store.updateSettings({
        store_name: 'BOOTH DAILY FLAGSHIP OWNER',
        tax_percentage: 11,
      });
      assert(updatedSettings.store_name === 'BOOTH DAILY FLAGSHIP OWNER', 'Test 12c: Owner berhasil update store_name');
      assert(updatedSettings.tax_percentage === 11, 'Test 12c: Owner berhasil update tax_percentage');

      // 12d. deleteUser
      const deleted = store.deleteUser(createdUser.id);
      assert(deleted === true, 'Test 12d: Owner berhasil menghapus user');
      assert(store.getUserById(createdUser.id) === undefined, 'Test 12d: User terhapus tidak ada di state');

      console.log('✓ Test 12 PASS: Owner aktif dengan sesi valid berhasil menjalankan addUser, updateUser, updateSettings, deleteUser');
    } catch (err: any) {
      errors.push(`Test 12 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 13: Kegagalan otorisasi maupun persistensi tidak meninggalkan perubahan parsial (Rollback)
    // -------------------------------------------------------------------------
    try {
      sessionManager.setSession({
        userId: ownerUser!.id,
        token: 'owner_fail_test',
        loggedInAt: new Date().toISOString(),
      });

      const initialSettings = store.getSettings();
      testDriver.failOnWrite = true; // Simulasikan QuotaExceededError

      let writeFailed = false;
      try {
        store.updateSettings({ store_name: 'NEVER PERSISTED STORE' });
      } catch (err: any) {
        if (err.name === 'QuotaExceededError' || err.message.includes('Quota')) {
          writeFailed = true;
        }
      }

      assert(writeFailed, 'Test 13: Penulisan storage saat disk penuh harus throw QuotaExceededError');
      // Verifikasi RAM state di-rollback 100% ke snapshot awal
      const settingsAfterFail = store.getSettings();
      assert(
        settingsAfterFail.store_name === initialSettings.store_name,
        'Test 13: State RAM harus di-rollback ke snapshot awal saat penulisan disk gagal'
      );

      testDriver.failOnWrite = false; // Pulihkan storage
      console.log('✓ Test 13 PASS: Kegagalan persistensi storage rollback 100% tanpa perubahan parsial');
    } catch (err: any) {
      errors.push(`Test 13 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 14: Verifikasi Integritas Data Historis & HPP Tidak Terganggu
    // -------------------------------------------------------------------------
    try {
      const products = store.getProducts();
      assert(products.length === 15, 'Test 14: 15 Katalog produk tetap utuh');

      const stocks = store.getStocks();
      assert(stocks.length === 13, 'Test 14: 13 Inventaris bahan baku tetap utuh');

      const orders = store.getOrders();
      assert(Array.isArray(orders), 'Test 14: Riwayat order valid');

      console.log('✓ Test 14 PASS: Integritas data historis, inventaris, dan produk tetap utuh');
    } catch (err: any) {
      errors.push(`Test 14 Gagal: ${err.message}`);
    }

    // =========================================================================
    // TAHAP S0: REGRESI KEAMANAN & PERSISTENSI OPERASI PROMO DISKON
    // =========================================================================

    // -------------------------------------------------------------------------
    // TEST 15: Operasi Promo Diskon tanpa sesi ditolak tanpa mutasi RAM/storage
    // -------------------------------------------------------------------------
    try {
      sessionManager.clearSession();
      const initialRules = store.getDiscountRules();
      const initialStorageRaw = testDriver.getItem(DEMO_STORAGE_KEY);
      const targetRule = initialRules[0];
      assert(Boolean(targetRule), 'Test 15: Harus ada minimal 1 aturan promo diskon awal');

      // 1. addDiscountRule
      let addBlocked = false;
      try {
        store.addDiscountRule({
          name: 'Promo Ilegal Tanpa Sesi',
          minimum_purchase: 10000,
          discount_percentage: 10,
        });
      } catch (err: any) {
        if (err.message.includes('Sesi login Owner aktif diperlukan untuk mengelola promo diskon')) {
          addBlocked = true;
        }
      }
      assert(addBlocked, 'Test 15: addDiscountRule tanpa sesi harus ditolak');

      // 2. updateDiscountRule
      let updateBlocked = false;
      try {
        store.updateDiscountRule(targetRule.id, { discount_percentage: 99 });
      } catch (err: any) {
        if (err.message.includes('Sesi login Owner aktif diperlukan untuk mengelola promo diskon')) {
          updateBlocked = true;
        }
      }
      assert(updateBlocked, 'Test 15: updateDiscountRule tanpa sesi harus ditolak');

      // 3. toggleActiveDiscountRule
      let toggleBlocked = false;
      try {
        store.toggleActiveDiscountRule(targetRule.id);
      } catch (err: any) {
        if (err.message.includes('Sesi login Owner aktif diperlukan untuk mengelola promo diskon')) {
          toggleBlocked = true;
        }
      }
      assert(toggleBlocked, 'Test 15: toggleActiveDiscountRule tanpa sesi harus ditolak');

      // 4. deleteDiscountRule
      let deleteBlocked = false;
      try {
        store.deleteDiscountRule(targetRule.id);
      } catch (err: any) {
        if (err.message.includes('Sesi login Owner aktif diperlukan untuk mengelola promo diskon')) {
          deleteBlocked = true;
        }
      }
      assert(deleteBlocked, 'Test 15: deleteDiscountRule tanpa sesi harus ditolak');

      // Verifikasi RAM & Storage tidak termutasi
      const rulesAfter = store.getDiscountRules();
      assert(rulesAfter.length === initialRules.length, 'Test 15: Jumlah diskon di RAM tidak boleh berubah');
      assert(rulesAfter[0].discount_percentage === targetRule.discount_percentage, 'Test 15: Persentase diskon di RAM tidak boleh berubah');
      assert(testDriver.getItem(DEMO_STORAGE_KEY) === initialStorageRaw, 'Test 15: Storage utama tidak boleh termutasi');

      console.log('✓ Test 15 PASS: Seluruh operasi Promo Diskon tanpa sesi ditolak tanpa mutasi RAM/storage');
    } catch (err: any) {
      errors.push(`Test 15 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 16: Operasi Promo Diskon dengan sesi Kasir/Karyawan ditolak tanpa mutasi
    // -------------------------------------------------------------------------
    try {
      sessionManager.setSession({
        userId: employeeUser!.id,
        token: 'kasir_disc_token',
        loggedInAt: new Date().toISOString(),
      });

      const initialRules = store.getDiscountRules();
      const initialStorageRaw = testDriver.getItem(DEMO_STORAGE_KEY);
      const targetRule = initialRules[0];

      // 1. addDiscountRule
      let addBlocked = false;
      try {
        store.addDiscountRule({
          name: 'Promo Ilegal Kasir',
          minimum_purchase: 20000,
          discount_percentage: 15,
        });
      } catch (err: any) {
        if (err.message.includes('Hanya Owner yang berwenang mengelola promo diskon')) {
          addBlocked = true;
        }
      }
      assert(addBlocked, 'Test 16: addDiscountRule oleh kasir harus ditolak');

      // 2. updateDiscountRule
      let updateBlocked = false;
      try {
        store.updateDiscountRule(targetRule.id, { discount_percentage: 50 });
      } catch (err: any) {
        if (err.message.includes('Hanya Owner yang berwenang mengelola promo diskon')) {
          updateBlocked = true;
        }
      }
      assert(updateBlocked, 'Test 16: updateDiscountRule oleh kasir harus ditolak');

      // 3. toggleActiveDiscountRule
      let toggleBlocked = false;
      try {
        store.toggleActiveDiscountRule(targetRule.id);
      } catch (err: any) {
        if (err.message.includes('Hanya Owner yang berwenang mengelola promo diskon')) {
          toggleBlocked = true;
        }
      }
      assert(toggleBlocked, 'Test 16: toggleActiveDiscountRule oleh kasir harus ditolak');

      // 4. deleteDiscountRule
      let deleteBlocked = false;
      try {
        store.deleteDiscountRule(targetRule.id);
      } catch (err: any) {
        if (err.message.includes('Hanya Owner yang berwenang mengelola promo diskon')) {
          deleteBlocked = true;
        }
      }
      assert(deleteBlocked, 'Test 16: deleteDiscountRule oleh kasir harus ditolak');

      // Verifikasi RAM & Storage tidak termutasi
      assert(store.getDiscountRules().length === initialRules.length, 'Test 16: State RAM tidak boleh berubah');
      assert(testDriver.getItem(DEMO_STORAGE_KEY) === initialStorageRaw, 'Test 16: Storage utama tidak boleh termutasi');

      console.log('✓ Test 16 PASS: Seluruh operasi Promo Diskon dengan sesi Kasir ditolak tanpa mutasi RAM/storage');
    } catch (err: any) {
      errors.push(`Test 16 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 17: Operasi Promo Diskon dengan sesi Owner tidak aktif ditolak tanpa mutasi
    // -------------------------------------------------------------------------
    try {
      sessionManager.setSession({
        userId: inactiveOwner.id,
        token: 'inactive_owner_disc_token',
        loggedInAt: new Date().toISOString(),
      });

      const initialRules = store.getDiscountRules();
      const initialStorageRaw = testDriver.getItem(DEMO_STORAGE_KEY);
      const targetRule = initialRules[0];

      // 1. addDiscountRule
      let addBlocked = false;
      try {
        store.addDiscountRule({
          name: 'Promo Ilegal Inactive Owner',
          minimum_purchase: 20000,
          discount_percentage: 15,
        });
      } catch (err: any) {
        if (err.message.includes('Akun pengguna dinonaktifkan atau tidak aktif')) {
          addBlocked = true;
        }
      }
      assert(addBlocked, 'Test 17: addDiscountRule oleh inactive owner harus ditolak');

      // 2. updateDiscountRule
      let updateBlocked = false;
      try {
        store.updateDiscountRule(targetRule.id, { discount_percentage: 30 });
      } catch (err: any) {
        if (err.message.includes('Akun pengguna dinonaktifkan atau tidak aktif')) {
          updateBlocked = true;
        }
      }
      assert(updateBlocked, 'Test 17: updateDiscountRule oleh inactive owner harus ditolak');

      // 3. toggleActiveDiscountRule
      let toggleBlocked = false;
      try {
        store.toggleActiveDiscountRule(targetRule.id);
      } catch (err: any) {
        if (err.message.includes('Akun pengguna dinonaktifkan atau tidak aktif')) {
          toggleBlocked = true;
        }
      }
      assert(toggleBlocked, 'Test 17: toggleActiveDiscountRule oleh inactive owner harus ditolak');

      // 4. deleteDiscountRule
      let deleteBlocked = false;
      try {
        store.deleteDiscountRule(targetRule.id);
      } catch (err: any) {
        if (err.message.includes('Akun pengguna dinonaktifkan atau tidak aktif')) {
          deleteBlocked = true;
        }
      }
      assert(deleteBlocked, 'Test 17: deleteDiscountRule oleh inactive owner harus ditolak');

      // Verifikasi RAM & Storage tidak termutasi
      assert(store.getDiscountRules().length === initialRules.length, 'Test 17: State RAM tidak boleh berubah');
      assert(testDriver.getItem(DEMO_STORAGE_KEY) === initialStorageRaw, 'Test 17: Storage utama tidak boleh termutasi');

      console.log('✓ Test 17 PASS: Seluruh operasi Promo Diskon dengan akun Owner tidak aktif ditolak tanpa mutasi');
    } catch (err: any) {
      errors.push(`Test 17 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 18: Operasi Promo Diskon dengan sesi Owner sah berhasil dan persisten
    // -------------------------------------------------------------------------
    try {
      sessionManager.setSession({
        userId: ownerUser!.id,
        token: 'owner_valid_disc_token',
        loggedInAt: new Date().toISOString(),
      });

      const baselineCount = store.getDiscountRules().length;

      // 1. addDiscountRule berhasil
      const addedRule = store.addDiscountRule({
        name: 'Promo Sah Akhir Pekan 12%',
        minimum_purchase: 40000,
        discount_percentage: 12,
        is_active: false,
      });
      assert(Boolean(addedRule?.id), 'Test 18: addedRule harus memiliki ID');
      assert(addedRule.discount_percentage === 12, 'Test 18: discount_percentage harus 12');
      assert(addedRule.is_active === false, 'Test 18: is_active harus false');
      assert(store.getDiscountRules().length === baselineCount + 1, 'Test 18: Jumlah diskon di RAM harus bertambah 1');

      // Verifikasi persisten di storage
      const storageAfterAdd = JSON.parse(testDriver.getItem(DEMO_STORAGE_KEY)!);
      const ruleInStorage = storageAfterAdd.discountRules.find((r: any) => r.id === addedRule.id);
      assert(Boolean(ruleInStorage), 'Test 18: Aturan baru harus persisten di storage');
      assert(ruleInStorage.discount_percentage === 12, 'Test 18: Nilai di storage harus sinkron');

      // 2. toggleActiveDiscountRule berhasil
      const toggled = store.toggleActiveDiscountRule(addedRule.id);
      assert(toggled.is_active === true, 'Test 18: is_active harus menjadi true setelah toggle');
      assert(store.getDiscountRules().find(r => r.id === addedRule.id)?.is_active === true, 'Test 18: Status aktif di RAM harus true');
      const storageAfterToggle = JSON.parse(testDriver.getItem(DEMO_STORAGE_KEY)!);
      assert(storageAfterToggle.discountRules.find((r: any) => r.id === addedRule.id)?.is_active === true, 'Test 18: Status aktif di storage harus true');

      // 3. updateDiscountRule berhasil
      const updated = store.updateDiscountRule(addedRule.id, {
        name: 'Promo Sah Akhir Pekan 15%',
        discount_percentage: 15,
      });
      assert(updated.discount_percentage === 15, 'Test 18: discount_percentage harus diperbarui ke 15');
      assert(store.getDiscountRules().find(r => r.id === addedRule.id)?.discount_percentage === 15, 'Test 18: Persentase di RAM harus 15');
      const storageAfterUpdate = JSON.parse(testDriver.getItem(DEMO_STORAGE_KEY)!);
      assert(storageAfterUpdate.discountRules.find((r: any) => r.id === addedRule.id)?.discount_percentage === 15, 'Test 18: Persentase di storage harus 15');

      // 4. deleteDiscountRule berhasil
      const deleted = store.deleteDiscountRule(addedRule.id);
      assert(deleted === true, 'Test 18: deleteDiscountRule harus mengembalikan true');
      assert(store.getDiscountRules().length === baselineCount, 'Test 18: Jumlah diskon di RAM kembali ke baseline');
      assert(!store.getDiscountRules().some(r => r.id === addedRule.id), 'Test 18: Rule harus terhapus dari RAM');
      const storageAfterDelete = JSON.parse(testDriver.getItem(DEMO_STORAGE_KEY)!);
      assert(!storageAfterDelete.discountRules.some((r: any) => r.id === addedRule.id), 'Test 18: Rule harus terhapus dari storage');

      console.log('✓ Test 18 PASS: Seluruh operasi Promo Diskon dengan sesi Owner sah berhasil dan persisten di RAM/storage');
    } catch (err: any) {
      errors.push(`Test 18 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 19: Kegagalan persistensi storage (QuotaExceeded) pada Promo Diskon di-rollback 100%
    // -------------------------------------------------------------------------
    try {
      sessionManager.setSession({
        userId: ownerUser!.id,
        token: 'owner_fail_test_disc',
        loggedInAt: new Date().toISOString(),
      });

      const ramBaseline = store.getDiscountRules();
      const storageBaseline = testDriver.getItem(DEMO_STORAGE_KEY);
      const targetRule = ramBaseline[0];
      const originalPercentage = targetRule.discount_percentage;
      const originalActive = targetRule.is_active;

      testDriver.failOnWrite = true; // Aktifkan simulasi QuotaExceededError

      // 1. addDiscountRule gagal tulis
      let addFailed = false;
      try {
        store.addDiscountRule({
          name: 'Promo Gagal Disk Penuh',
          minimum_purchase: 50000,
          discount_percentage: 20,
        });
      } catch (err: any) {
        if (err.name === 'QuotaExceededError' || err.message.includes('Quota')) {
          addFailed = true;
        }
      }
      assert(addFailed, 'Test 19: addDiscountRule harus throw QuotaExceededError');
      assert(store.getDiscountRules().length === ramBaseline.length, 'Test 19: RAM tidak boleh bertambah setelah add gagal');
      assert(testDriver.getItem(DEMO_STORAGE_KEY) === storageBaseline, 'Test 19: Storage tidak boleh berubah setelah add gagal');

      // 2. updateDiscountRule gagal tulis
      let updateFailed = false;
      try {
        store.updateDiscountRule(targetRule.id, { discount_percentage: 99 });
      } catch (err: any) {
        if (err.name === 'QuotaExceededError' || err.message.includes('Quota')) {
          updateFailed = true;
        }
      }
      assert(updateFailed, 'Test 19: updateDiscountRule harus throw QuotaExceededError');
      assert(
        store.getDiscountRules().find(r => r.id === targetRule.id)?.discount_percentage === originalPercentage,
        'Test 19: RAM harus di-rollback ke persentase asli setelah update gagal'
      );
      assert(testDriver.getItem(DEMO_STORAGE_KEY) === storageBaseline, 'Test 19: Storage tidak boleh berubah setelah update gagal');

      // 3. toggleActiveDiscountRule gagal tulis
      let toggleFailed = false;
      try {
        store.toggleActiveDiscountRule(targetRule.id);
      } catch (err: any) {
        if (err.name === 'QuotaExceededError' || err.message.includes('Quota')) {
          toggleFailed = true;
        }
      }
      assert(toggleFailed, 'Test 19: toggleActiveDiscountRule harus throw QuotaExceededError');
      assert(
        store.getDiscountRules().find(r => r.id === targetRule.id)?.is_active === originalActive,
        'Test 19: RAM harus di-rollback ke status aktif asli setelah toggle gagal'
      );
      assert(testDriver.getItem(DEMO_STORAGE_KEY) === storageBaseline, 'Test 19: Storage tidak boleh berubah setelah toggle gagal');

      // 4. deleteDiscountRule gagal tulis
      let deleteFailed = false;
      try {
        store.deleteDiscountRule(targetRule.id);
      } catch (err: any) {
        if (err.name === 'QuotaExceededError' || err.message.includes('Quota')) {
          deleteFailed = true;
        }
      }
      assert(deleteFailed, 'Test 19: deleteDiscountRule harus throw QuotaExceededError');
      assert(
        store.getDiscountRules().some(r => r.id === targetRule.id),
        'Test 19: RAM tidak boleh menghapus rule setelah delete gagal'
      );
      assert(testDriver.getItem(DEMO_STORAGE_KEY) === storageBaseline, 'Test 19: Storage tidak boleh berubah setelah delete gagal');

      testDriver.failOnWrite = false; // Pulihkan storage driver

      // Verifikasi akhir: state RAM dan storage 100% identik dengan baseline sebelum kegagalan
      const finalRamRules = store.getDiscountRules();
      assert(finalRamRules.length === ramBaseline.length, 'Test 19: Jumlah diskon akhir harus identik dengan baseline');
      assert(
        JSON.stringify(finalRamRules) === JSON.stringify(ramBaseline),
        'Test 19: Seluruh objek diskon di RAM harus identik dengan snapshot sebelum kegagalan'
      );
      assert(
        testDriver.getItem(DEMO_STORAGE_KEY) === storageBaseline,
        'Test 19: Data storage harus identik dengan snapshot sebelum kegagalan'
      );

      console.log('✓ Test 19 PASS: Kegagalan persistensi storage pada Promo Diskon di-rollback 100% tanpa perubahan parsial');
    } catch (err: any) {
      testDriver.failOnWrite = false;
      errors.push(`Test 19 Gagal: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 20: Urutan Otorisasi: Penolakan otorisasi mendahului persistensi migrasi
    //          dan tidak memicu penulisan storage atau mutasi data diskon
    // -------------------------------------------------------------------------
    try {
      // 1. Simulasikan kondisi migrasi pending dan storage write failure
      (store as any).hasPendingMigrationPersist = true;
      testDriver.failOnWrite = true;

      const initialRules = store.getDiscountRules();
      const targetRule = initialRules[0];
      assert(Boolean(targetRule), 'Test 20: Minimal harus ada 1 promo diskon untuk pengujian');
      const initialStorageRaw = testDriver.getItem(DEMO_STORAGE_KEY);
      const initialWriteAttempts = testDriver.writeAttempts;

      // =======================================================================
      // SKENARIO A: Tanpa Sesi (Guest) -> ke-4 metode ditolak sebelum migrasi
      // =======================================================================
      sessionManager.clearSession();

      // 1. addDiscountRule tanpa sesi
      let guestAddBlocked = false;
      try {
        store.addDiscountRule({
          name: 'Promo Ilegal Tanpa Sesi Saat Pending',
          minimum_purchase: 10000,
          discount_percentage: 10,
        });
      } catch (err: any) {
        assert(
          err.message.includes('Sesi login Owner aktif diperlukan untuk mengelola promo diskon'),
          `Test 20 (Guest add): Pesan error salah: ${err.message}`
        );
        assert(
          !err.message.includes('DataIntegrityError'),
          `Test 20 (Guest add): Tidak boleh memicu DataIntegrityError: ${err.message}`
        );
        guestAddBlocked = true;
      }
      assert(guestAddBlocked, 'Test 20: addDiscountRule tanpa sesi harus ditolak otorisasi');

      // 2. updateDiscountRule tanpa sesi
      let guestUpdateBlocked = false;
      try {
        store.updateDiscountRule(targetRule.id, { discount_percentage: 95 });
      } catch (err: any) {
        assert(
          err.message.includes('Sesi login Owner aktif diperlukan untuk mengelola promo diskon'),
          `Test 20 (Guest update): Pesan error salah: ${err.message}`
        );
        assert(
          !err.message.includes('DataIntegrityError'),
          `Test 20 (Guest update): Tidak boleh memicu DataIntegrityError: ${err.message}`
        );
        guestUpdateBlocked = true;
      }
      assert(guestUpdateBlocked, 'Test 20: updateDiscountRule tanpa sesi harus ditolak otorisasi');

      // 3. toggleActiveDiscountRule tanpa sesi
      let guestToggleBlocked = false;
      try {
        store.toggleActiveDiscountRule(targetRule.id);
      } catch (err: any) {
        assert(
          err.message.includes('Sesi login Owner aktif diperlukan untuk mengelola promo diskon'),
          `Test 20 (Guest toggle): Pesan error salah: ${err.message}`
        );
        assert(
          !err.message.includes('DataIntegrityError'),
          `Test 20 (Guest toggle): Tidak boleh memicu DataIntegrityError: ${err.message}`
        );
        guestToggleBlocked = true;
      }
      assert(guestToggleBlocked, 'Test 20: toggleActiveDiscountRule tanpa sesi harus ditolak otorisasi');

      // 4. deleteDiscountRule tanpa sesi
      let guestDeleteBlocked = false;
      try {
        store.deleteDiscountRule(targetRule.id);
      } catch (err: any) {
        assert(
          err.message.includes('Sesi login Owner aktif diperlukan untuk mengelola promo diskon'),
          `Test 20 (Guest delete): Pesan error salah: ${err.message}`
        );
        assert(
          !err.message.includes('DataIntegrityError'),
          `Test 20 (Guest delete): Tidak boleh memicu DataIntegrityError: ${err.message}`
        );
        guestDeleteBlocked = true;
      }
      assert(guestDeleteBlocked, 'Test 20: deleteDiscountRule tanpa sesi harus ditolak otorisasi');

      // =======================================================================
      // SKENARIO B: Sesi Kasir/Karyawan -> ke-4 metode ditolak sebelum migrasi
      // =======================================================================
      sessionManager.setSession({
        userId: employeeUser!.id,
        token: 'cashier_token_test_20',
        loggedInAt: new Date().toISOString(),
      });

      // 1. addDiscountRule kasir
      let cashierAddBlocked = false;
      try {
        store.addDiscountRule({
          name: 'Promo Ilegal Kasir Saat Pending',
          minimum_purchase: 15000,
          discount_percentage: 15,
        });
      } catch (err: any) {
        assert(
          err.message.includes('Hanya Owner yang berwenang mengelola promo diskon'),
          `Test 20 (Cashier add): Pesan error salah: ${err.message}`
        );
        assert(
          !err.message.includes('DataIntegrityError'),
          `Test 20 (Cashier add): Tidak boleh memicu DataIntegrityError: ${err.message}`
        );
        cashierAddBlocked = true;
      }
      assert(cashierAddBlocked, 'Test 20: addDiscountRule oleh kasir harus ditolak otorisasi');

      // 2. updateDiscountRule kasir
      let cashierUpdateBlocked = false;
      try {
        store.updateDiscountRule(targetRule.id, { discount_percentage: 80 });
      } catch (err: any) {
        assert(
          err.message.includes('Hanya Owner yang berwenang mengelola promo diskon'),
          `Test 20 (Cashier update): Pesan error salah: ${err.message}`
        );
        assert(
          !err.message.includes('DataIntegrityError'),
          `Test 20 (Cashier update): Tidak boleh memicu DataIntegrityError: ${err.message}`
        );
        cashierUpdateBlocked = true;
      }
      assert(cashierUpdateBlocked, 'Test 20: updateDiscountRule oleh kasir harus ditolak otorisasi');

      // 3. toggleActiveDiscountRule kasir
      let cashierToggleBlocked = false;
      try {
        store.toggleActiveDiscountRule(targetRule.id);
      } catch (err: any) {
        assert(
          err.message.includes('Hanya Owner yang berwenang mengelola promo diskon'),
          `Test 20 (Cashier toggle): Pesan error salah: ${err.message}`
        );
        assert(
          !err.message.includes('DataIntegrityError'),
          `Test 20 (Cashier toggle): Tidak boleh memicu DataIntegrityError: ${err.message}`
        );
        cashierToggleBlocked = true;
      }
      assert(cashierToggleBlocked, 'Test 20: toggleActiveDiscountRule oleh kasir harus ditolak otorisasi');

      // 4. deleteDiscountRule kasir
      let cashierDeleteBlocked = false;
      try {
        store.deleteDiscountRule(targetRule.id);
      } catch (err: any) {
        assert(
          err.message.includes('Hanya Owner yang berwenang mengelola promo diskon'),
          `Test 20 (Cashier delete): Pesan error salah: ${err.message}`
        );
        assert(
          !err.message.includes('DataIntegrityError'),
          `Test 20 (Cashier delete): Tidak boleh memicu DataIntegrityError: ${err.message}`
        );
        cashierDeleteBlocked = true;
      }
      assert(cashierDeleteBlocked, 'Test 20: deleteDiscountRule oleh kasir harus ditolak otorisasi');

      // =======================================================================
      // SKENARIO C: Sesi Owner Tidak Aktif -> ke-4 metode ditolak sebelum migrasi
      // =======================================================================
      sessionManager.setSession({
        userId: inactiveOwner.id,
        token: 'inactive_owner_token_test_20',
        loggedInAt: new Date().toISOString(),
      });

      // 1. addDiscountRule inactive owner
      let inactiveAddBlocked = false;
      try {
        store.addDiscountRule({
          name: 'Promo Ilegal Inactive Owner Saat Pending',
          minimum_purchase: 25000,
          discount_percentage: 20,
        });
      } catch (err: any) {
        assert(
          err.message.includes('Akun pengguna dinonaktifkan atau tidak aktif'),
          `Test 20 (Inactive add): Pesan error salah: ${err.message}`
        );
        assert(
          !err.message.includes('DataIntegrityError'),
          `Test 20 (Inactive add): Tidak boleh memicu DataIntegrityError: ${err.message}`
        );
        inactiveAddBlocked = true;
      }
      assert(inactiveAddBlocked, 'Test 20: addDiscountRule oleh inactive owner harus ditolak otorisasi');

      // 2. updateDiscountRule inactive owner
      let inactiveUpdateBlocked = false;
      try {
        store.updateDiscountRule(targetRule.id, { discount_percentage: 70 });
      } catch (err: any) {
        assert(
          err.message.includes('Akun pengguna dinonaktifkan atau tidak aktif'),
          `Test 20 (Inactive update): Pesan error salah: ${err.message}`
        );
        assert(
          !err.message.includes('DataIntegrityError'),
          `Test 20 (Inactive update): Tidak boleh memicu DataIntegrityError: ${err.message}`
        );
        inactiveUpdateBlocked = true;
      }
      assert(inactiveUpdateBlocked, 'Test 20: updateDiscountRule oleh inactive owner harus ditolak otorisasi');

      // 3. toggleActiveDiscountRule inactive owner
      let inactiveToggleBlocked = false;
      try {
        store.toggleActiveDiscountRule(targetRule.id);
      } catch (err: any) {
        assert(
          err.message.includes('Akun pengguna dinonaktifkan atau tidak aktif'),
          `Test 20 (Inactive toggle): Pesan error salah: ${err.message}`
        );
        assert(
          !err.message.includes('DataIntegrityError'),
          `Test 20 (Inactive toggle): Tidak boleh memicu DataIntegrityError: ${err.message}`
        );
        inactiveToggleBlocked = true;
      }
      assert(inactiveToggleBlocked, 'Test 20: toggleActiveDiscountRule oleh inactive owner harus ditolak otorisasi');

      // 4. deleteDiscountRule inactive owner
      let inactiveDeleteBlocked = false;
      try {
        store.deleteDiscountRule(targetRule.id);
      } catch (err: any) {
        assert(
          err.message.includes('Akun pengguna dinonaktifkan atau tidak aktif'),
          `Test 20 (Inactive delete): Pesan error salah: ${err.message}`
        );
        assert(
          !err.message.includes('DataIntegrityError'),
          `Test 20 (Inactive delete): Tidak boleh memicu DataIntegrityError: ${err.message}`
        );
        inactiveDeleteBlocked = true;
      }
      assert(inactiveDeleteBlocked, 'Test 20: deleteDiscountRule oleh inactive owner harus ditolak otorisasi');

      // =======================================================================
      // VERIFIKASI KEBIJAKAN ZERO-TOUCH STATE & STORAGE SETELAH 12 PENOLAKAN
      // =======================================================================
      assert(
        (store as any).hasPendingMigrationPersist === true,
        'Test 20: hasPendingMigrationPersist tetap bernilai true (tidak terhapus atau termutasi)'
      );
      assert(
        store.getDiscountRules().length === initialRules.length,
        'Test 20: Jumlah data promo diskon di RAM tetap sama dengan initial'
      );
      assert(
        JSON.stringify(store.getDiscountRules()) === JSON.stringify(initialRules),
        'Test 20: Seluruh objek promo diskon di RAM 100% utuh tanpa mutasi parsial'
      );
      assert(
        testDriver.getItem(DEMO_STORAGE_KEY) === initialStorageRaw,
        'Test 20: Raw storage tidak berubah satu karakter pun'
      );
      assert(
        testDriver.writeAttempts === initialWriteAttempts,
        `Test 20: Persistensi tidak boleh dipanggil (writeAttempts awal=${initialWriteAttempts}, saat ini=${testDriver.writeAttempts})`
      );

      // =======================================================================
      // SKENARIO D: Sesi Owner Aktif Sah Membuktikan ensureMigrationPersisted()
      //             Benar-Benar Dijalankan Setelah Otorisasi Berhasil
      // =======================================================================
      sessionManager.setSession({
        userId: ownerUser!.id,
        token: 'active_owner_token_test_20',
        loggedInAt: new Date().toISOString(),
      });

      // Bagian D.1: Ketika failOnWrite = true, pastikan ensureMigrationPersisted()
      // mengeksekusi penulisan disk, gagal, dan melempar DataIntegrityError
      const attemptsBeforeOwnerAuth = testDriver.writeAttempts;
      let migrationIntegrityBlocked = false;
      try {
        store.addDiscountRule({
          name: 'Promo Sah Saat Storage Bermasalah',
          minimum_purchase: 10000,
          discount_percentage: 10,
        });
      } catch (err: any) {
        if (
          err.name === 'DataIntegrityError' ||
          err.message.includes('DataIntegrityError') ||
          err.message.includes('Storage tidak sinkron')
        ) {
          migrationIntegrityBlocked = true;
        }
      }
      assert(
        migrationIntegrityBlocked,
        'Test 20: Saat Owner aktif memanggil, ensureMigrationPersisted() benar-benar dieksekusi dan melempar DataIntegrityError'
      );
      assert(
        testDriver.writeAttempts > attemptsBeforeOwnerAuth,
        'Test 20: ensureMigrationPersisted() terbukti mencoba menulis snapshot ke storage (writeAttempts bertambah)'
      );
      assert(
        (store as any).hasPendingMigrationPersist === true,
        'Test 20: hasPendingMigrationPersist tetap true karena penulisan storage gagal'
      );

      // Bagian D.2: Ketika storage pulih (failOnWrite = false), pastikan
      // ensureMigrationPersisted() berhasil menyimpan snapshot, membersihkan flag pending,
      // dan menyelesaikan operasi add, update, toggle, delete dengan sukses
      testDriver.failOnWrite = false;

      const validRule = store.addDiscountRule({
        name: 'Promo Akhir Pekan Sah S0',
        minimum_purchase: 30000,
        discount_percentage: 12,
        is_active: false,
      });
      assert(Boolean(validRule?.id), 'Test 20: addDiscountRule oleh Owner sah mengembalikan aturan baru');
      assert(
        (store as any).hasPendingMigrationPersist === false,
        'Test 20: hasPendingMigrationPersist berhasil dibersihkan (false) setelah storage pulih'
      );
      assert(
        store.getDiscountRules().some(r => r.id === validRule.id),
        'Test 20: Aturan baru masuk ke RAM'
      );
      const storageAfterAdd = JSON.parse(testDriver.getItem(DEMO_STORAGE_KEY)!);
      assert(
        storageAfterAdd.discountRules.some((r: any) => r.id === validRule.id),
        'Test 20: Aturan baru persisten di storage'
      );

      // Mutasi lanjutan oleh Owner sah: update, toggle, delete
      const updatedRule = store.updateDiscountRule(validRule.id, { discount_percentage: 18 });
      assert(updatedRule.discount_percentage === 18, 'Test 20: updateDiscountRule berhasil dijalankan Owner sah');

      const toggledRule = store.toggleActiveDiscountRule(validRule.id);
      assert(toggledRule.is_active === true, 'Test 20: toggleActiveDiscountRule berhasil dijalankan Owner sah');

      const deletedRule = store.deleteDiscountRule(validRule.id);
      assert(deletedRule === true, 'Test 20: deleteDiscountRule berhasil dijalankan Owner sah');
      assert(!store.getDiscountRules().some(r => r.id === validRule.id), 'Test 20: Aturan terhapus dari RAM');

      console.log('✓ Test 20 PASS: Pemeriksaan otorisasi terbukti mendahului persistensi migrasi dan mutasi state');
    } catch (err: any) {
      testDriver.failOnWrite = false;
      (store as any).hasPendingMigrationPersist = false;
      errors.push(`Test 20 Gagal: ${err.message}`);
    }

  } finally {
    // Pulihkan storage driver dan session awal
    resetStorageDriver();
    if (initialSession) {
      sessionManager.setSession(initialSession);
    } else {
      sessionManager.clearSession();
    }
  }

  console.log('\n===============================================================');
  if (errors.length === 0) {
    console.log('   SELURUH REGRESI KEAMANAN DEFECT-SEC-01 & 02 LULUS (100% PASS)');
    console.log('===============================================================\n');
    return { pass: true, errors: [] };
  } else {
    console.error(`   REGRESI KEAMANAN GAGAL DENGAN ${errors.length} ERROR:`);
    errors.forEach((e, idx) => console.error(`   ${idx + 1}. ${e}`));
    console.log('===============================================================\n');
    return { pass: false, errors };
  }
}

// Direct CLI Execution
if (
  import.meta.url.endsWith('validateSecurityFixes.ts') ||
  process.argv[1]?.includes('validateSecurityFixes')
) {
  runSecurityRegressionTests().then(res => {
    if (res.pass) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
}
