import React, { useEffect, useState } from 'react';
import { usePOS } from '../../hooks/usePOS';
import { X, User, Mail, Key, ShieldCheck, Save, Sparkles, Phone } from 'lucide-react';
import { ImageUpload } from './ImageUpload';

export const EditAccountModal: React.FC = () => {
  const {
    isEditAccountModalOpen,
    closeEditAccountModal,
    currentUser,
    updateCurrentUserAccount
  } = usePOS();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser && isEditAccountModalOpen) {
      setName(currentUser.name || '');
      setUsername(currentUser.username || '');
      setEmail(currentUser.email || '');
      setPassword('');
      setPin('');
      setPhone(currentUser.phone || '');
      setAvatarFile(null);
      setError('');
    }
  }, [currentUser, isEditAccountModalOpen]);

  if (!isEditAccountModalOpen || !currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    const cleanPassword = password;
    const cleanPin = pin.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setError('Nama lengkap tidak boleh kosong.');
      return;
    }

    if (!cleanUsername) {
      setError('Username tidak boleh kosong.');
      return;
    }

    if (!cleanEmail) {
      setError('Email tidak boleh kosong.');
      return;
    }

    if (cleanPassword && cleanPassword.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }

    if (cleanPhone && !/^\+?[0-9]+$/.test(cleanPhone)) {
      setError('Nomor telepon hanya boleh berisi angka (dan tanda + di awal).');
      return;
    }

    if (cleanPin && !/^\d{4}$/.test(cleanPin)) {
      setError('PIN harus tepat 4 digit angka.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await updateCurrentUserAccount(
        {
          name: cleanName,
          username: cleanUsername,
          email: cleanEmail,
          phone: cleanPhone,
          ...(cleanPassword ? { password: cleanPassword } : {}),
          ...(cleanPin ? { pin: cleanPin } : {})
        },
        avatarFile
      );

      if (!result.success) {
        setError(result.message);
        return;
      }

      closeEditAccountModal();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Gagal memperbarui akun.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden my-auto max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 bg-[#3B2A1F] text-[#F7F5F2] flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D4A373]/20 flex items-center justify-center border border-[#D4A373]/30">
              <User className="w-5 h-5 text-[#D4A373]" />
            </div>

            <div>
              <h2 className="text-base font-black tracking-wide">Edit Akun Saya</h2>
              <p className="text-xs text-[#D4A373]/80 font-medium">
                Ubah Profil & Kredensial
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeEditAccountModal}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          <ImageUpload
            label="Foto Profil"
            value={currentUser.avatar || ''}
            onFileChange={file => setAvatarFile(file)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#3B2A1F] dark:text-[#D4A373]" />
                Nama Lengkap
              </label>

              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Masukkan Nama Lengkap"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#151312] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#3B2A1F] dark:text-[#D4A373]" />
                Username
              </label>

              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Masukkan Username"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#151312] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#3B2A1F] dark:text-[#D4A373]" />
              Email
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Masukkan Alamat Email"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#151312] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#3B2A1F] dark:text-[#D4A373]" />
              Nomor Telepon
            </label>

            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={e => {
                const val = e.target.value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
                setPhone(val);
              }}
              placeholder="Contoh: 08123456789 atau +628123456789"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#151312] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#3B2A1F] dark:text-[#D4A373]" />
                Password Baru
              </label>

              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Kosongkan jika tidak diubah"
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#151312] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#3B2A1F] dark:text-[#D4A373]" />
                PIN Transaksi
              </label>

              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e =>
                  setPin(
                    e.target.value.replace(/\D/g, '').slice(0, 4)
                  )
                }
                placeholder="4 digit"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#151312] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373] font-mono tracking-widest text-center"
              />
            </div>
          </div>

          <div className="pt-4 flex flex-col-reverse sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={closeEditAccountModal}
              disabled={isSubmitting}
              className="w-full sm:flex-1 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold transition-all disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:flex-1 py-3 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Menyimpan...</span>
              ) : (
                <>
                  <Save className="w-4 h-4 text-[#D4A373]" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};