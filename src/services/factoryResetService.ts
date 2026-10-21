import { mockStore } from '../mock/store';
export { mockStore };
import {
  clearAppStorageAllowlist,
  getRestoreJournal,
  getFactoryResetJournal,
  saveFactoryResetJournal,
  clearFactoryResetJournal,
  FactoryResetJournal,
} from '../mock/persistence/storage';
import { mediaStorage } from './mediaStorage';
import { sessionManager } from '../mock/repositories/sessionManager';
import { userService } from './userService';

let isResetInProgress = false;

export interface FactoryResetCallbacks {
  onResetStarted?: () => void;
  onResetFailed?: (errorMsg: string) => void;
}

export interface FactoryResetResult {
  success: boolean;
  message: string;
}

export const factoryResetService = {
  /**
   * Status apakah operasi reset pabrik sedang berjalan (mencegah klik ganda / eksekusi simultan).
   */
  isResetting(): boolean {
    return isResetInProgress;
  },

  /**
   * Menjalankan reset pabrik (Factory Reset) secara bertahap (WAL Saga):
   * 1. PREFLIGHT:
   *    - Otorisasi sesi Owner aktif
   *    - Verifikasi PIN Owner (mendapatkan tiket verifikasi PIN nyata)
   *    - Cek status jurnal restore S3 dan write-lock
   * 2. COMMITMENT POINT (SINKRON TANPA AWAIT):
   *    - Simpan jurnal STAGE_1_INITIALIZED
   *    - Pasang write-lock lokal
   *    - Pasang UI gate ke 'pending'
   *    - Terbitkan reseed ticket terotorisasi
   * 3. ASYNCHRONOUS DESTRUCTIVE PIPELINE:
   *    - STAGE_2: Bersihkan IndexedDB media
   *    - STAGE_3: Bersihkan allowlist LocalStorage
   *    - STAGE_4: Reseed store dengan otorisasi tiket
   *    - STAGE_5: Verifikasi state final
   *    - Hapus jurnal & buka write-lock
   */
  async executeFactoryReset(
    ownerPin: string,
    callbacks?: FactoryResetCallbacks
  ): Promise<FactoryResetResult> {
    if (isResetInProgress) {
      throw new Error('Operasi reset pabrik sedang berjalan. Harap tunggu hingga selesai.');
    }

    isResetInProgress = true;

    try {
      // ------------------------------------------------------------------
      // FASE 1: PREFLIGHT (Bebas efek samping, UI tidak terkunci)
      // ------------------------------------------------------------------
      const currentOwner = mockStore.assertActiveOwnerSession(
        'mereset data demo ke kondisi awal pabrik'
      );

      if (!ownerPin || typeof ownerPin !== 'string') {
        throw new Error('PIN Owner diperlukan untuk otorisasi reset pabrik.');
      }

      const pinAuth = await userService.verifyPin(ownerPin.trim());
      if (
        !pinAuth ||
        String(pinAuth.user.id) !== String(currentOwner.id) ||
        pinAuth.user.role !== 'owner' ||
        !pinAuth.user.is_active ||
        !pinAuth.token
      ) {
        throw new Error(
          'Otorisasi ditolak: PIN Owner tidak valid atau tidak cocok dengan akun yang sedang login.'
        );
      }

      const pendingRestore = getRestoreJournal();
      if (pendingRestore) {
        throw new Error(
          `Reset pabrik diblokir: Terdeteksi proses pemulihan (recovery) data cadangan yang belum selesai atau berstatus ${pendingRestore.stage}. Selesaikan pemulihan terlebih dahulu.`
        );
      }

      const existingResetJournal = getFactoryResetJournal();
      if (existingResetJournal && existingResetJournal.stage !== 'STAGE_FAILED') {
        throw new Error(
          `Reset pabrik diblokir: Terdeteksi proses reset pabrik yang sedang berjalan (${existingResetJournal.stage}).`
        );
      }

      if (mockStore.getIsWriteLocked()) {
        throw new Error(
          'Reset pabrik diblokir: Sistem penyimpanan sedang dalam kondisi proteksi terkunci (write-lock).'
        );
      }

      // ------------------------------------------------------------------
      // FASE 2: COMMITMENT POINT (SINKRON TANPA AWAIT)
      // ------------------------------------------------------------------
      const journalId = `factory-reset-${Date.now()}`;
      const initialJournal: FactoryResetJournal = {
        id: journalId,
        startedAt: new Date().toISOString(),
        stage: 'STAGE_1_INITIALIZED',
        retryCount: 0,
      };

      const journalSaveResult = saveFactoryResetJournal(initialJournal);
      if (!journalSaveResult.success) {
        throw new Error(
          `Gagal menginisialisasi jurnal reset pabrik: ${journalSaveResult.error || 'Penyimpanan gagal'}`
        );
      }

      // 1. Kunci write-lock memori lokal (sinkron)
      mockStore.setWriteLock(true);

      // 2. Kunci UI Gate ke status 'pending' (sinkron)
      callbacks?.onResetStarted?.();

      // 3. Terbitkan reseed ticket terotorisasi sekali-pakai (sinkron)
      const reseedTicket = mockStore.issueReseedTicket(pinAuth.token);

      // ------------------------------------------------------------------
      // FASE 3: ASYNCHRONOUS DESTRUCTIVE PIPELINE (FAIL-CLOSED)
      // ------------------------------------------------------------------
      try {
        // Stage 2: Bersihkan Media Logo pada IndexedDB
        try {
          await mediaStorage.clearAllMedia();
        } catch (mediaErr: any) {
          throw new Error(`Gagal membersihkan media logo: ${mediaErr?.message || 'IndexedDB error'}`);
        }
        saveFactoryResetJournal({
          ...initialJournal,
          stage: 'STAGE_2_INDEXEDDB_CLEARED',
        });

        // Stage 3: Bersihkan LocalStorage Berdasarkan Allowlist Resmi
        const clearStorageResult = clearAppStorageAllowlist({ removeJournal: false });
        if (!clearStorageResult.success) {
          throw new Error(
            clearStorageResult.error || 'Gagal membersihkan penyimpanan lokal aplikasi.'
          );
        }
        saveFactoryResetJournal({
          ...initialJournal,
          stage: 'STAGE_3_STORAGE_CLEARED',
        });

        // Stage 4: Reseed Store ke Seed Awal & Persist
        mockStore.reseedStore({
          type: 'OWNER_TICKET',
          ticket: reseedTicket,
        });
        saveFactoryResetJournal({
          ...initialJournal,
          stage: 'STAGE_4_STORE_RESEEDED',
        });

        // Stage 5: Verifikasi State Final
        await this.verifyFinalResetState();
        saveFactoryResetJournal({
          ...initialJournal,
          stage: 'STAGE_5_VERIFIED',
        });

        // Tahap Akhir: Bersihkan Jurnal, Sesi, dan Buka Lock
        clearFactoryResetJournal();
        sessionManager.clearSession();
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.removeItem('token');
            window.localStorage.removeItem('token_id');
            window.localStorage.removeItem('boothdaily_user_session');
            window.localStorage.removeItem('boothdaily_user_data');
          } catch {
            // ignore
          }
        }
        mockStore.setWriteLock(false);

        return {
          success: true,
          message: 'Seluruh data demo, sesi, dan media berhasil direset ke kondisi awal.',
        };
      } catch (pipelineErr: any) {
        console.error('[FactoryReset] Kegagalan pasca-komitmen:', pipelineErr);
        mockStore.setWriteLock(true);
        const lastStage = getFactoryResetJournal()?.stage || 'STAGE_1_INITIALIZED';
        saveFactoryResetJournal({
          ...initialJournal,
          stage: 'STAGE_FAILED',
          failedAtStage: lastStage,
          error: pipelineErr?.message || 'Terjadi kesalahan tak terduga selama reset pabrik.',
        });
        callbacks?.onResetFailed?.(
          pipelineErr?.message || 'Kegagalan kritis pemulihan reset pabrik.'
        );
        throw pipelineErr;
      }
    } finally {
      isResetInProgress = false;
    }
  },

  /**
   * Memverifikasi keadaan aktual setelah reset berhasil dijalankan.
   */
  async verifyFinalResetState(): Promise<void> {
    // 1. Verifikasi Media
    const media = await mediaStorage.getAllMedia();
    if (media.appLogo !== null || media.printerLogo !== null) {
      throw new Error('Verifikasi gagal: Media logo belum bersih.');
    }

    // 2. Verifikasi Settings & Store Name
    const settings = mockStore.getSettings();
    if (settings.store_name !== 'BOOTH DAILY') {
      throw new Error(`Verifikasi gagal: Nama toko tidak sesuai (${settings.store_name}).`);
    }

    // 3. Verifikasi Jumlah Seed Katalog
    const products = mockStore.getProducts();
    if (products.length !== 15) {
      throw new Error(`Verifikasi gagal: Jumlah produk (${products.length}) tidak sesuai seed (15).`);
    }
    const categories = mockStore.getCategories();
    if (categories.length !== 6) {
      throw new Error(`Verifikasi gagal: Jumlah kategori (${categories.length}) tidak sesuai seed (6).`);
    }
    const stocks = mockStore.getStocks();
    if (stocks.length !== 13) {
      throw new Error(`Verifikasi gagal: Jumlah stok (${stocks.length}) tidak sesuai seed (13).`);
    }
    const recipes = mockStore.getRecipes();
    const totalIngredients = recipes.reduce(
      (sum, r) => sum + (Array.isArray(r.ingredients) ? r.ingredients.length : 0),
      0
    );
    if (totalIngredients !== 30) {
      throw new Error(
        `Verifikasi gagal: Total relasi bahan resep (${totalIngredients}) tidak sesuai seed (30).`
      );
    }
  },

  /**
   * Menjalankan pemulihan otomatis (crash recovery) atau retry jika terdeteksi jurnal reset pabrik aktif.
   */
  async recoverInterruptedReset(): Promise<FactoryResetResult> {
    const journal = getFactoryResetJournal();
    if (!journal) {
      return {
        success: true,
        message: 'Tidak ada proses reset pabrik yang tertunda.',
      };
    }

    mockStore.setWriteLock(true);

    try {
      // Eksekusi roll-forward idempoten penuh dari Stage 1
      await mediaStorage.clearAllMedia();
      saveFactoryResetJournal({
        ...journal,
        stage: 'STAGE_2_INDEXEDDB_CLEARED',
      });

      const clearStorageResult = clearAppStorageAllowlist({ removeJournal: false });
      if (!clearStorageResult.success) {
        throw new Error(
          clearStorageResult.error || 'Gagal membersihkan penyimpanan aplikasi saat recovery.'
        );
      }
      saveFactoryResetJournal({
        ...journal,
        stage: 'STAGE_3_STORAGE_CLEARED',
      });

      // Reseed dengan otorisasi RECOVERY_JOURNAL
      mockStore.reseedStore({
        type: 'RECOVERY_JOURNAL',
        journalId: journal.id,
      });
      saveFactoryResetJournal({
        ...journal,
        stage: 'STAGE_4_STORE_RESEEDED',
      });

      await this.verifyFinalResetState();
      saveFactoryResetJournal({
        ...journal,
        stage: 'STAGE_5_VERIFIED',
      });

      clearFactoryResetJournal();
      sessionManager.clearSession();
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem('token');
          window.localStorage.removeItem('token_id');
          window.localStorage.removeItem('boothdaily_user_session');
          window.localStorage.removeItem('boothdaily_user_data');
        } catch {
          // ignore
        }
      }
      mockStore.setWriteLock(false);

      return {
        success: true,
        message: 'Pemulihan reset pabrik yang terputus berhasil diselesaikan ke kondisi awal bawaan.',
      };
    } catch (err: any) {
      saveFactoryResetJournal({
        ...journal,
        stage: 'STAGE_FAILED',
        error: err?.message || 'Gagal menjalankan pemulihan reset pabrik.',
        retryCount: (journal.retryCount || 0) + 1,
      });
      throw err;
    }
  },
};
