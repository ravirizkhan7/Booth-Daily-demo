/**
 * Media Storage Service
 * Menggunakan IndexedDB untuk menyimpan data asset gambar logo (Logo Aplikasi & Logo Printer)
 * secara terpisah dari LocalStorage snapshot utama guna mencegah batasan kuota storage browser (5MB).
 */

const DB_NAME = 'booth_daily_media';
const DB_VERSION = 1;
const STORE_NAME = 'branding';

export type MediaKey = 'app_logo' | 'printer_logo';

// In-memory fallback untuk lingkungan non-browser (Node.js test runners / CLI)
const memoryMediaStore = new Map<MediaKey, string>();

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  return null;
}

function openDatabase(): Promise<IDBDatabase> {
  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error('IndexedDB tidak didukung pada lingkungan ini.'));
  }

  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Gagal membuka IndexedDB.'));
  });
}

export const mediaStorage = {
  /**
   * Mengambil data URL media berdasarkan key ('app_logo' | 'printer_logo').
   */
  async getMedia(key: MediaKey): Promise<string | null> {
    const idb = getIndexedDB();
    if (!idb) {
      return memoryMediaStore.get(key) || null;
    }

    try {
      const db = await openDatabase();
      return new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          resolve((req.result as string) || null);
        };
        req.onerror = () => reject(req.error || new Error(`Gagal membaca media ${key}`));
      });
    } catch (err) {
      console.warn(`[MediaStorage] Fallback to memory store for ${key}:`, err);
      return memoryMediaStore.get(key) || null;
    }
  },

  /**
   * Menyimpan data URL media ke IndexedDB.
   */
  async saveMedia(key: MediaKey, dataUrl: string): Promise<void> {
    if (!dataUrl || typeof dataUrl !== 'string') {
      throw new Error('Data media tidak valid.');
    }

    // Selalu simpan juga di memory store sebagai cache
    memoryMediaStore.set(key, dataUrl);

    const idb = getIndexedDB();
    if (!idb) {
      return;
    }

    const db = await openDatabase();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(dataUrl, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error(`Gagal menyimpan media ${key}`));
    });
  },

  /**
   * Menghapus data media dari IndexedDB.
   */
  async deleteMedia(key: MediaKey): Promise<void> {
    memoryMediaStore.delete(key);

    const idb = getIndexedDB();
    if (!idb) {
      return;
    }

    const db = await openDatabase();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error(`Gagal menghapus media ${key}`));
    });
  },

  /**
   * Membaca kedua logo sekaligus untuk inisialisasi aplikasi.
   */
  async getAllMedia(): Promise<{ appLogo: string | null; printerLogo: string | null }> {
    const [appLogo, printerLogo] = await Promise.all([
      this.getMedia('app_logo'),
      this.getMedia('printer_logo'),
    ]);
    return { appLogo, printerLogo };
  },

  /**
   * Mengatur ulang atau memulihkan kedua logo sekaligus secara terkoordinasi.
   */
  async restoreMedia(logos: { appLogo: string | null; printerLogo: string | null }): Promise<void> {
    if (logos.appLogo) {
      await this.saveMedia('app_logo', logos.appLogo);
    } else {
      await this.deleteMedia('app_logo');
    }

    if (logos.printerLogo) {
      await this.saveMedia('printer_logo', logos.printerLogo);
    } else {
      await this.deleteMedia('printer_logo');
    }
  },

  /**
   * Menghapus seluruh media dari penyimpanan (misal saat reset atau pengujian terisolasi).
   */
  async clearAllMedia(): Promise<void> {
    memoryMediaStore.clear();
    const idb = getIndexedDB();
    if (!idb) return;
    const db = await openDatabase();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Gagal membersihkan IndexedDB'));
      tx.onabort = () => reject(tx.error || new Error('Transaksi IndexedDB dibatalkan'));
      tx.onerror = () => reject(tx.error || new Error('Transaksi IndexedDB gagal'));
    });
  },
};

