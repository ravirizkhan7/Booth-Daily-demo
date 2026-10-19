import { useState, useEffect, useCallback } from 'react';
import { mediaStorage } from '../../services/mediaStorage';
import { processLogoImage } from '../../services/imageProcessing';

export interface UsePOSMediaProps {
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  enabled?: boolean;
}

export const usePOSMedia = (props?: UsePOSMediaProps) => {
  const enabled = props?.enabled ?? true;
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [printerLogo, setPrinterLogo] = useState<string | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState<boolean>(true);

  const refreshMedia = useCallback(async () => {
    try {
      setIsLoadingMedia(true);
      const { appLogo: loadedApp, printerLogo: loadedPrinter } = await mediaStorage.getAllMedia();
      setAppLogo(loadedApp);
      setPrinterLogo(loadedPrinter);
      setIsLoadingMedia(false);
    } catch (err) {
      console.error('[usePOSMedia] Gagal memuat logo dari mediaStorage:', err);
      setIsLoadingMedia(false);
    }
  }, []);

  // Muat logo dari IndexedDB HANYA setelah recovery/bootstrap diverifikasi selesai (enabled === true).
  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const initMedia = async () => {
      try {
        const { appLogo: loadedApp, printerLogo: loadedPrinter } = await mediaStorage.getAllMedia();
        if (isMounted) {
          setAppLogo(loadedApp);
          setPrinterLogo(loadedPrinter);
          setIsLoadingMedia(false);
        }
      } catch (err) {
        console.error('[usePOSMedia] Gagal memuat logo dari mediaStorage:', err);
        if (isMounted) {
          setIsLoadingMedia(false);
        }
      }
    };

    initMedia();

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  const uploadAppLogo = useCallback(async (file: File): Promise<string> => {
    try {
      const dataUrl = await processLogoImage(file, {
        maxDimension: 512,
        format: 'image/webp',
        quality: 0.85,
      });

      await mediaStorage.saveMedia('app_logo', dataUrl);
      setAppLogo(dataUrl);
      props?.showToast?.('Logo aplikasi berhasil diperbarui!', 'success');
      return dataUrl;
    } catch (err: any) {
      console.error('[usePOSMedia] Gagal upload logo aplikasi:', err);
      props?.showToast?.(err?.message || 'Gagal memproses logo aplikasi', 'error');
      throw err;
    }
  }, [props]);

  const deleteAppLogo = useCallback(async (): Promise<void> => {
    try {
      await mediaStorage.deleteMedia('app_logo');
      setAppLogo(null);
      props?.showToast?.('Logo aplikasi berhasil dihapus (kembali ke logo bawaan).', 'success');
    } catch (err: any) {
      console.error('[usePOSMedia] Gagal menghapus logo aplikasi:', err);
      props?.showToast?.(err?.message || 'Gagal menghapus logo aplikasi', 'error');
      throw err;
    }
  }, [props]);

  const uploadPrinterLogo = useCallback(async (file: File): Promise<string> => {
    try {
      // Untuk logo printer thermal, gunakan PNG untuk mempertahankan ketajaman garis dan transparansi
      const dataUrl = await processLogoImage(file, {
        maxDimension: 384,
        format: 'image/png',
      });

      await mediaStorage.saveMedia('printer_logo', dataUrl);
      setPrinterLogo(dataUrl);
      props?.showToast?.('Logo printer struk berhasil diperbarui!', 'success');
      return dataUrl;
    } catch (err: any) {
      console.error('[usePOSMedia] Gagal upload logo printer:', err);
      props?.showToast?.(err?.message || 'Gagal memproses logo printer struk', 'error');
      throw err;
    }
  }, [props]);

  const deletePrinterLogo = useCallback(async (): Promise<void> => {
    try {
      await mediaStorage.deleteMedia('printer_logo');
      setPrinterLogo(null);
      props?.showToast?.('Logo printer struk berhasil dihapus (struk menggunakan teks nama toko).', 'success');
    } catch (err: any) {
      console.error('[usePOSMedia] Gagal menghapus logo printer:', err);
      props?.showToast?.(err?.message || 'Gagal menghapus logo printer', 'error');
      throw err;
    }
  }, [props]);

  return {
    appLogo,
    printerLogo,
    isLoadingMedia,
    uploadAppLogo,
    deleteAppLogo,
    uploadPrinterLogo,
    deletePrinterLogo,
    refreshMedia,
  };
};
