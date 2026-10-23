import React, { useState } from 'react';
import {
  X,
  Upload,
  Lock,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Store,
  Users,
  Package,
  Calendar,
  Image,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { backupService, BackupPreviewSummary } from '../../services/backupService';

interface RestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onSuccess: (requireRelogin: boolean) => void;
}

export const RestoreModal: React.FC<RestoreModalProps> = ({
  isOpen,
  onClose,
  showToast,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [password, setPassword] = useState('');
  const [ownerPin, setOwnerPin] = useState('');
  const [confirmedRisk, setConfirmedRisk] = useState(false);
  const [previewSummary, setPreviewSummary] = useState<BackupPreviewSummary | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isProcessing) return;
    setStep(1);
    setFileContent(null);
    setFileName('');
    setPassword('');
    setOwnerPin('');
    setConfirmedRisk(false);
    setPreviewSummary(null);
    setErrorMsg(null);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setErrorMsg('Format file harus berupa file JSON terenkripsi (.enc.json).');
      return;
    }

    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result as string;
      setFileContent(content);
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca file dari perangkat.');
    };
    reader.readAsText(file);
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fileContent) {
      setErrorMsg('Silakan pilih file cadangan (.enc.json) terlebih dahulu.');
      return;
    }

    if (!password) {
      setErrorMsg('Kata sandi backup diperlukan untuk mendekripsi file.');
      return;
    }

    setIsProcessing(true);
    try {
      const summary = await backupService.previewBackup(fileContent, password);
      setPreviewSummary(summary);
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mendekripsi atau memvalidasi file cadangan.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStep2Restore = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!ownerPin) {
      setErrorMsg('PIN Owner aktif diperlukan untuk otorisasi akhir.');
      return;
    }

    if (!confirmedRisk) {
      setErrorMsg('Harap konfirmasi pernyataan pemulihan data.');
      return;
    }

    if (!fileContent) return;

    setIsProcessing(true);
    try {
      const result = await backupService.restoreBackup(fileContent, password, ownerPin);
      showToast(result.message, 'success');
      onSuccess(result.requireRelogin);
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memulihkan cadangan data.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#1E1C1A] w-full max-w-xl rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-stone-900 dark:text-stone-100">
                Pulihkan Data Toko (Restore)
              </h2>
              <span className="text-[10px] font-semibold text-stone-400">
                {step === 1 ? 'Langkah 1/2: Pilih File & Kata Sandi' : 'Langkah 2/2: Ringkasan & Otorisasi PIN'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="p-1.5 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {errorMsg && (
          <div className="m-5 mb-0 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-2.5 leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="p-5 space-y-4">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                File Cadangan Terenkripsi (.enc.json)
              </label>
              <div className="border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-2xl p-4 text-center hover:border-amber-500/50 transition-colors">
                <input
                  type="file"
                  id="backupFileInput"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="backupFileInput"
                  className="cursor-pointer flex flex-col items-center gap-1.5"
                >
                  <FileText className="w-7 h-7 text-stone-400" />
                  <span className="font-bold text-stone-700 dark:text-stone-300">
                    {fileName || 'Pilih file cadangan dari komputer'}
                  </span>
                  <span className="text-[10px] text-stone-400">
                    {fileContent ? 'File siap diperiksa' : 'Format didukung: boothdaily_backup_*.enc.json'}
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                Kata Sandi Backup
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  disabled={isProcessing}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi yang digunakan saat pencadangan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleClose}
                className="px-4 py-2 rounded-xl font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isProcessing || !fileContent || !password}
                className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold bg-[#C68B59] hover:bg-[#B57A48] text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mendekripsi & Memvalidasi...</span>
                  </>
                ) : (
                  <>
                    <span>Periksa File</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleStep2Restore} className="p-5 space-y-4">
            {previewSummary && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-2.5">
                  <div className="font-extrabold text-xs text-stone-900 dark:text-stone-100 flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-[#C68B59]" /> {previewSummary.store_name}
                    </span>
                    <span className="text-[10px] font-semibold text-stone-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(previewSummary.created_at).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                    <div className="p-2 rounded-xl bg-white dark:bg-[#1A1817] border border-stone-100 dark:border-stone-800">
                      <span className="text-stone-400 block text-[10px]">Pengguna</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">
                        {previewSummary.users_count} Akun ({previewSummary.active_owners.join(', ')})
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-[#1A1817] border border-stone-100 dark:border-stone-800">
                      <span className="text-stone-400 block text-[10px]">Produk & Menu</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">
                        {previewSummary.products_count} Produk ({previewSummary.categories_count} Kategori)
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-[#1A1817] border border-stone-100 dark:border-stone-800">
                      <span className="text-stone-400 block text-[10px]">Transaksi & Shift</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">
                        {previewSummary.orders_count} Pesanan, {previewSummary.shifts_count} Shift
                        {typeof previewSummary.expenses_count === 'number' && previewSummary.expenses_count > 0 ? `, ${previewSummary.expenses_count} Pengeluaran` : ''}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-[#1A1817] border border-stone-100 dark:border-stone-800">
                      <span className="text-stone-400 block text-[10px]">Bahan Baku & Resep</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">
                        {previewSummary.stocks_count} Stok, {previewSummary.recipes_count} Resep
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-[#1A1817] border border-stone-100 dark:border-stone-800">
                      <span className="text-stone-400 block text-[10px]">Logo Branding</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">
                        {previewSummary.has_app_logo ? '✓ Logo Aplikasi' : '— Tidak ada logo'}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-[#1A1817] border border-stone-100 dark:border-stone-800">
                      <span className="text-stone-400 block text-[10px]">Logo Printer Struk</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">
                        {previewSummary.has_printer_logo ? '✓ Logo Printer' : '— Tidak ada logo'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200 space-y-1.5 leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    Peringatan Penggantian Data Toko
                  </div>
                  <p className="text-[11px] opacity-90">
                    Memulihkan data cadangan akan menimpa seluruh transaksi, stok, shift, dan pengaturan saat ini.
                    Proses ini dilindungi oleh mekanisme commit atomik (2PC) dan rollback otomatis jika terjadi kegagalan.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Verifikasi PIN Owner Aktif
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      maxLength={6}
                      required
                      disabled={isProcessing}
                      value={ownerPin}
                      onChange={e => setOwnerPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Masukkan PIN Owner Anda (contoh: 1234)"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold tracking-widest text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={confirmedRisk}
                    onChange={e => setConfirmedRisk(e.target.checked)}
                    className="mt-0.5 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 select-none">
                    Saya mengonfirmasi bahwa data operasional saat ini akan digantikan dengan data cadangan ini.
                  </span>
                </label>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setStep(1);
                  setErrorMsg(null);
                }}
                className="px-4 py-2 rounded-xl font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                Kembali
              </button>
              <button
                type="submit"
                disabled={isProcessing || !ownerPin || !confirmedRisk}
                className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memulihkan Atomik...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Konfirmasi & Pulihkan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
