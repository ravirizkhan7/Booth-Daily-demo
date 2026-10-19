import { mockStore } from '../mock/store';
import { clearAppStorageAllowlist, getRestoreJournal } from '../mock/persistence/storage';
import { mediaStorage } from './mediaStorage';
import { sessionManager } from '../mock/repositories/sessionManager';
import { userService } from './userService';

let isResetInProgress = false;

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
   * Menjalankan reset pabrik (Factory Reset) secara menyeluruh:
   * 1. Otorisasi sesi Owner aktif pada store layer.
   * 2. Verifikasi ulang PIN Owner pada data layer (tanpa mencatat PIN mentah ke log).
   * 3. Pengecekan recovery journal & write-lock (blokir jika ada jurnal tertunda/ROLLBACK_FAILED).
   * 4. Pembersihan media logo pada IndexedDB (booth_daily_media).
   * 5. Pembersihan LocalStorage berdasarkan allowlist resmi (boothdaily_* dan auth token).
   * 6. Pembersihan sesi aktif (sessionManager & auth storage).
   * 7. Inisialisasi ulang in-memory store ke default seed state valid & persistensi bersih.
   */
  async executeFactoryReset(ownerPin: string): Promise<FactoryResetResult> {
    if (isResetInProgress) {
      throw new Error('Operasi reset pabrik sedang berjalan. Harap tunggu hingga selesai.');
    }

    isResetInProgress = true;

    try {
      // 1. Otorisasi Sesi Owner Aktif
      const currentOwner = mockStore.assertActiveOwnerSession(
        'mereset data demo ke kondisi awal pabrik'
      );

      // 2. Verifikasi Ulang PIN Owner
      if (!ownerPin || typeof ownerPin !== 'string') {
        throw new Error('PIN Owner diperlukan untuk otorisasi reset pabrik.');
      }

      // Verifikasi PIN via userService (tanpa log PIN mentah)
      const pinAuth = await userService.verifyPin(ownerPin.trim());
      if (
        !pinAuth ||
        String(pinAuth.user.id) !== String(currentOwner.id) ||
        pinAuth.user.role !== 'owner' ||
        !pinAuth.user.is_active
      ) {
        throw new Error(
          'Otorisasi ditolak: PIN Owner tidak valid atau tidak cocok dengan akun yang sedang login.'
        );
      }

      // 3. Pengecualian Recovery Journal & Write-Lock
      const pendingJournal = getRestoreJournal();
      if (pendingJournal) {
        throw new Error(
          `Reset pabrik diblokir: Terdeteksi proses pemulihan (recovery) data yang belum selesai atau berstatus ${pendingJournal.stage}. Selesaikan pemulihan terlebih dahulu.`
        );
      }

      if (mockStore.getIsWriteLocked()) {
        throw new Error(
          'Reset pabrik diblokir: Sistem penyimpanan sedang dalam kondisi proteksi terkunci (write-lock).'
        );
      }

      // 4. Bersihkan Media Logo pada IndexedDB
      try {
        await mediaStorage.clearAllMedia();
      } catch (mediaErr: any) {
        console.error('[FactoryReset] Gagal membersihkan media IndexedDB:', mediaErr);
        throw new Error(`Gagal membersihkan media logo: ${mediaErr?.message || 'IndexedDB error'}`);
      }

      // 5. Bersihkan LocalStorage Berdasarkan Allowlist Resmi
      const clearStorageResult = clearAppStorageAllowlist({ removeJournal: false });
      if (!clearStorageResult.success) {
        throw new Error(
          clearStorageResult.error || 'Gagal membersihkan penyimpanan lokal aplikasi.'
        );
      }

      // 6. Bersihkan Sesi Autentikasi
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

      // 7. Inisialisasi Ulang State Store ke Seed Awal & Persist
      mockStore.reseedStore();

      return {
        success: true,
        message: 'Seluruh data demo, sesi, dan media berhasil direset ke kondisi awal.',
      };
    } finally {
      isResetInProgress = false;
    }
  },
};
