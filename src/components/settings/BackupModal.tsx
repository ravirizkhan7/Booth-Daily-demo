import React, { useState } from 'react';
import { X, ShieldCheck, Lock, Download, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { backupService } from '../../services/backupService';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose, showToast }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isProcessing) return;
    setPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg('Kata sandi backup harus memiliki minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsProcessing(true);
    try {
      const { container, filename } = await backupService.exportBackup(password);
      backupService.downloadBackupFile(container, filename);
      showToast('Cadangan terenkripsi berhasil diunduh.', 'success');
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal membuat file cadangan.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#1E1C1A] w-full max-w-lg rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-stone-900 dark:text-stone-100">
                Cadangkan Data Toko Terenkripsi
              </h2>
              <span className="text-[10px] font-semibold text-stone-400">
                AES-GCM 256-bit • PBKDF2 600.000 Iterasi
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 space-y-1 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Lindungi Cadangan dengan Kata Sandi
            </div>
            <p className="text-[11px] opacity-90">
              Seluruh database toko (pengguna, menu, stok, resep, transaksi, shift) beserta Logo Aplikasi & Printer
              akan dienkripsi dengan standar tinggi. Kata sandi ini diperlukan saat proses pemulihan.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                Kata Sandi Backup Baru
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isProcessing}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                Konfirmasi Kata Sandi
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={isProcessing}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi backup"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div className="text-[10px] text-stone-400 leading-normal">
            Catatan: File hasil unduhan berformat <code className="font-mono text-stone-600 dark:text-stone-300">.enc.json</code>.
            File ini aman disimpan di media eksternal karena seluruh data dienkripsi (zero plaintext).
          </div>

          {/* Footer */}
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
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold bg-[#C68B59] hover:bg-[#B57A48] text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengenkrpsi...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Enkripsi & Unduh</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
