import React, { useState } from 'react';
import { usePOS } from '../hooks/usePOS';
import { User } from '../types';
import { userService } from '../services/userService';
import { Users, Plus, KeyRound, Edit2, Trash2, X, User as UserIcon } from 'lucide-react';
import { ImageUpload } from '../components/common/ImageUpload';

const DEFAULT_PASSWORD = 'demo123';

export const EmployeesPage: React.FC = () => {
  const { usersList, refreshData, showToast } = usePOS();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [resetPassword, setResetPassword] = useState(false);
  const [role, setRole] = useState<'owner' | 'karyawan'>('karyawan');
  const [pin, setPin] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getErrorMessage = (err: any) => {
    return (
      err?.response?.data?.message ||
      err?.message ||
      'Terjadi kesalahan saat memproses data karyawan.'
    );
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setName('');
    setUsername('');
    setEmail('');
    setPassword(DEFAULT_PASSWORD);
    setResetPassword(false);
    setRole('karyawan');
    setPin(String(Math.floor(1000 + Math.random() * 9000)));
    setPhone('');
    setIsActive(true);
    setAvatarFile(null);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setName(u.name || '');
    setUsername(u.username || '');
    setEmail(u.email || '');
    setPassword(DEFAULT_PASSWORD);
    setResetPassword(false);
    setRole(u.role);
    setPin(u.pin || '');
    setPhone(u.phone || '');
    setIsActive(u.is_active ?? true);
    setAvatarFile(null);
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setFormError('');
    setResetPassword(false);
  };

  const handleDelete = async (id: string, userName: string) => {
    if (!window.confirm(`Hapus karyawan "${userName}"?`)) return;

    try {
      await userService.deleteUser(id);
      await refreshData();
      showToast(`Karyawan "${userName}" telah dihapus`, 'info');
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = name.trim();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanPin = pin.trim();
    const generatedEmail = `${cleanName.toLowerCase().replace(/\s+/g, '')}@boothdaily.com`;
    const finalEmail = cleanEmail || generatedEmail;

    if (!cleanName) {
      setFormError('Nama lengkap wajib diisi.');
      return;
    }

    if (!cleanUsername) {
      setFormError('Username wajib diisi.');
      return;
    }

    if (!finalEmail) {
      setFormError('Email wajib diisi.');
      return;
    }

    if (!editingUser && DEFAULT_PASSWORD.length < 8) {
      setFormError('Password default minimal 8 karakter.');
      return;
    }

    if (cleanPhone && !/^\+?[0-9]+$/.test(cleanPhone)) {
      setFormError('Nomor telepon hanya boleh berisi angka (dan tanda + di awal).');
      return;
    }

    if (!editingUser && !/^\d{4}$/.test(cleanPin)) {
      setFormError('PIN wajib tepat 4 digit.');
      return;
    }

    if (editingUser && cleanPin && !/^\d{4}$/.test(cleanPin)) {
      setFormError('PIN baru harus tepat 4 digit.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingUser) {
        await userService.updateUser(
          editingUser.id,
          {
            name: cleanName,
            username: cleanUsername,
            email: finalEmail,
            role,
            phone: cleanPhone,
            is_active: isActive,
            ...(cleanPin ? { pin: cleanPin } : {}),
            ...(resetPassword ? { password: DEFAULT_PASSWORD } : {})
          },
          avatarFile
        );

        showToast(
          resetPassword
            ? 'Data karyawan berhasil diperbarui dan password direset'
            : 'Data karyawan berhasil diperbarui',
          'success'
        );
      } else {
        await userService.createUser(
          {
            name: cleanName,
            username: cleanUsername,
            email: finalEmail,
            password: DEFAULT_PASSWORD,
            role,
            pin: cleanPin,
            phone,
            is_active: isActive
          },
          avatarFile
        );

        showToast('Karyawan baru berhasil ditambahkan', 'success');
      }

      await refreshData();
      setIsModalOpen(false);
      setResetPassword(false);
    } catch (err: any) {
      const message = getErrorMessage(err);
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#C68B59]" />
            Kelola Tim & Karyawan
          </h1>
          <p className="text-xs text-stone-500">
            Atur akun, PIN otorisasi transaksi, foto profil, status, dan hak akses staf Booth Daily.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-sm font-bold shadow-md transition-all w-full sm:w-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#D4A373]" />
          Tambah Staf Baru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {usersList.map(u => (
          <div
            key={u.id}
            className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center shrink-0">
                  {u?.avatar ? (
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    <UserIcon className="w-5 h-5 text-stone-500 dark:text-stone-400" />
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100 truncate">
                    {u.name}
                  </h3>
                  <p className="text-xs text-stone-500 truncate">{u.email}</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${u.role === 'owner'
                    ? 'bg-[#3B2A1F] text-[#D4A373]'
                    : 'bg-emerald-500/10 text-emerald-600'
                    }`}
                >
                  {u.role === 'owner' ? 'Owner' : 'Karyawan'}
                </span>

                <span
                  className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${u.is_active
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : 'bg-stone-200 text-stone-600'
                    }`}
                >
                  {u.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-[#23201D] rounded-2xl border border-stone-100 dark:border-stone-800 flex justify-between items-center text-xs">
              <span className="text-stone-500 font-semibold flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#C68B59]" />
                PIN Kasir:
              </span>

              <span className="font-mono font-black text-sm tracking-widest text-stone-900 dark:text-stone-100">
                {u.pin || '••••'}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                onClick={() => handleOpenEdit(u)}
                className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200"
                title="Edit Staf"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              {usersList.length > 1 && (
                <button
                  onClick={() => handleDelete(u.id, u.name)}
                  className="p-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                  title="Hapus Staf"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-stone-200 dark:border-stone-800 my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                {editingUser ? 'Edit Data Staf' : 'Tambah Staf Baru'}
              </h3>

              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="p-1.5 rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <ImageUpload
                label="Foto Profil"
                value={editingUser?.avatar || ''}
                onFileChange={file => setAvatarFile(file)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>

                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nama Kasir / Staf"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Username <span className="text-rose-500">*</span>
                  </label>

                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="username"
                    autoComplete="username"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Email <span className="text-rose-500">*</span>
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="staf@boothdaily.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Password
                </label>

                <input
                  type="text"
                  value={password}
                  readOnly
                  tabIndex={-1}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-100 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-mono font-bold text-stone-700 dark:text-stone-300 cursor-default select-all focus:outline-none"
                />

                <p className="text-[10px] text-stone-400 mt-1.5">
                  Password default akun: <span className="font-bold">password</span>
                </p>
              </div>

              {editingUser && (
                <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 cursor-pointer">
                  <div>
                    <p className="font-bold text-stone-800 dark:text-stone-200">
                      Reset Password
                    </p>
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                      Centang untuk mengembalikan password menjadi password default.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={resetPassword}
                    onChange={e => setResetPassword(e.target.checked)}
                    className="w-4 h-4 rounded text-[#3B2A1F]"
                  />
                </label>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Role Jabatan <span className="text-rose-500">*</span>
                  </label>

                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as 'owner' | 'karyawan')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
                  >
                    <option value="karyawan">Karyawan</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    PIN 4 Digit {!editingUser && <span className="text-rose-500">*</span>}
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={e =>
                      setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder={editingUser ? 'Kosongkan jika tidak diubah' : '1234'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-mono font-black text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
                />
              </div>

              <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-800 cursor-pointer">
                <div>
                  <p className="font-bold text-stone-800 dark:text-stone-200">
                    Status Akun
                  </p>

                  <p className="text-[10px] text-stone-400 mt-0.5">
                    Nonaktifkan akun untuk mencegah login.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-[#3B2A1F]"
                />
              </label>

              {formError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl font-bold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-extrabold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? 'Menyimpan...'
                    : editingUser
                      ? 'Simpan Perubahan'
                      : 'Simpan Staf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};