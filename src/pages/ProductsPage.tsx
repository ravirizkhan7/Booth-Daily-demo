import { NumberInput } from '../components/common/NumberInput';
import React, { useState } from 'react';
import { usePOS } from '../hooks/usePOS';
import { Product } from '../types';
import { formatRupiah } from '../utils/formatters';
import { getImageUrl } from '../utils/axios';
import { Plus, Search, Edit2, Trash2, Heart, BookOpen, Coffee, X } from 'lucide-react';
import { ImageUpload } from '../components/common/ImageUpload';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const ProductsPage: React.FC = () => {
  const {
    products,
    categories,
    addProduct,
    editProduct,
    removeProduct,
    openRecipeModal
  } = usePOS();

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('cat-all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showFavorites, setShowFavorites] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Confirm delete state
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category_id: 'cat-1',
    price: 20000,
    cost_price: 8000,
    image_url: '',
    description: '',
    is_active: true,
    is_favorite: false
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // File foto baru hasil crop+compress dari ImageUpload.
  // null = tidak ada perubahan foto (pakai foto lama / tidak ada foto).
  const [imageFile, setImageFile] = useState<File | null>(null);

  const filteredProducts = products.filter(p => {
    const matchesCat =
      selectedCat === 'cat-all' || p.category_id === selectedCat;

    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase());

    const matchesFavorite =
      !showFavorites || p.is_favorite;

    const matchesStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'active' && p.is_active) ||
      (selectedStatus === 'inactive' && !p.is_active);

    return (
      matchesCat &&
      matchesSearch &&
      matchesFavorite &&
      matchesStatus
    );
  });

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormErrors({});
    const defaultCatId = categories.find(c => c.id !== 'cat-all')?.id || 'cat-1';
    setFormData({
      name: '',
      category_id: defaultCatId,
      price: 20000,
      cost_price: 8000,
      image_url: '',
      description: '',
      is_active: true,
      is_favorite: false
    });
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormErrors({});
    setFormData({
      name: p.name,
      category_id: p.category_id,
      price: p.price,
      cost_price: p.cost_price,
      image_url: p.image_url || '',
      description: p.description || '',
      is_active: p.is_active,
      is_favorite: p.is_favorite
    });
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    await removeProduct(deletingProduct.id);
    setDeletingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      errors.name = 'Nama produk wajib diisi';
    }
    if (formData.price < 0) {
      errors.price = 'Harga jual tidak boleh negatif';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }


    if (editingProduct) {
      await editProduct(editingProduct.id, formData, imageFile);
    } else {
      await addProduct(formData, imageFile);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Coffee className="w-6 h-6 text-[#C68B59]" />
            Kelola Menu & Produk
          </h1>
          <p className="text-xs text-stone-500 font-medium">
            Tambah, atur harga, foto produk, dan kelola ketersediaan menu Booth Daily.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 text-[#D4A373]" />
          Tambah Produk Baru
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#1E1C1A] p-4 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        {/* Search + Status */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />

            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama produk..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373]"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373] cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Non-Aktif</option>
          </select>
        </div>

        {/* Category + Favorite Filter */}
        <div className="flex items-center gap-2">
          {/* Category Scroll */}
          <div className="flex items-center gap-2 overflow-x-auto flex-1 scrollbar-none pb-1">
            {/* Semua */}
            <button
              onClick={() => setSelectedCat('cat-all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${selectedCat === 'cat-all'
                ? 'bg-[#3B2A1F] text-[#F7F5F2] border-[#3B2A1F] shadow-sm'
                : 'bg-stone-50 dark:bg-[#171514] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                }`}
            >
              Semua
            </button>

            {/* Categories */}
            {categories
              .filter(cat => cat.id !== 'cat-all')
              .map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${selectedCat === cat.id
                    ? 'bg-[#3B2A1F] text-[#F7F5F2] border-[#3B2A1F] shadow-sm'
                    : 'bg-stone-50 dark:bg-[#171514] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                    }`}
                >
                  {cat.name}
                </button>
              ))}
          </div>

          {/* Favorite */}
          <button
            onClick={() => setShowFavorites(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${showFavorites
              ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
              : 'bg-stone-50 dark:bg-[#171514] text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30'
              }`}
          >
            <Heart
              className={`w-4 h-4 ${showFavorites ? 'fill-current' : ''}`}
            />
            Favorit
          </button>
        </div>
      </div>

      {/* Product List Table */}
      <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-stone-50 dark:bg-[#23201D] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="p-4">Produk</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">Harga Jual</th>
                <th className="p-4">Modal (HPP)</th>
                <th className="p-4">Status</th>
                <th className="p-4">Favorit</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-400 font-semibold">
                    Tidak ada produk ditemukan.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const cat = categories.find(c => c.id === p.category_id);
                  return (
                    <tr key={p.id} className="hover:bg-stone-50/50 dark:hover:bg-[#25221F] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={getImageUrl(p.image_url)} alt={p.name} className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-stone-200 dark:border-stone-800" />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0 border border-stone-200 dark:border-stone-800 text-stone-400">
                              <Coffee className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-extrabold text-stone-900 dark:text-stone-100 text-sm">{p.name}</p>
                            <p className="text-[11px] text-stone-400 line-clamp-1">{p.description || 'Tidak ada deskripsi'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-stone-600 dark:text-stone-300 font-bold">{cat?.name || 'Umum'}</td>
                      <td className="p-4 font-black text-[#3B2A1F] dark:text-[#D4A373] text-sm">{formatRupiah(p.price)}</td>
                      <td className="p-4 text-stone-500 font-bold">{formatRupiah(p.cost_price)}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${p.is_active ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-stone-200 text-stone-600'}`}>
                          {p.is_active ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>
                      <td className="p-4">
                        {p.is_favorite ? <Heart className="w-4 h-4 fill-rose-500 text-rose-500" /> : <span className="text-stone-300">-</span>}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openRecipeModal(p)}
                            className="p-2 rounded-xl bg-amber-500/10 text-[#C68B59] hover:bg-amber-500/20 transition-colors cursor-pointer"
                            title="Lihat Resep"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 transition-colors cursor-pointer"
                            title="Edit Produk"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProduct(p)}
                            className="p-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors cursor-pointer"
                            title="Hapus Produk"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit Product */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl border border-stone-200 dark:border-stone-800 my-auto">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Nama Produk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  placeholder="Contoh: Kopi Susu Gula Aren"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
                />
                {formErrors.name && (
                  <p className="text-rose-500 text-[11px] font-bold mt-1">{formErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Kategori <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none"
                  >
                    {categories.filter(c => c.id !== 'cat-all').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Harga Jual (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <NumberInput
                    isCurrency={true}
                    required
                    min={0}
                    value={formData.price}
                    onChange={val => setFormData({ ...formData, price: val })}
                    placeholder="Rp 0"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold focus:outline-none"
                  />
                  {formErrors.price && (
                    <p className="text-rose-500 text-[11px] font-bold mt-1">{formErrors.price}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Modal / HPP (Rp)
                  </label>
                  <NumberInput
                    isCurrency={true}
                    min={0}
                    value={formData.cost_price}
                    onChange={val => setFormData({ ...formData, cost_price: val })}
                    placeholder="Rp 0"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-6 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded text-[#3B2A1F]"
                    />
                    <span>Produk Aktif</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={formData.is_favorite}
                      onChange={e => setFormData({ ...formData, is_favorite: e.target.checked })}
                      className="w-4 h-4 rounded text-[#3B2A1F]"
                    />
                    <span>Favorit</span>
                  </label>
                </div>
              </div>

              {/* Upload Foto Produk dengan crop, kompresi otomatis & preview */}
              <ImageUpload
                label="Foto Produk"
                value={formData.image_url}
                onFileChange={file => setImageFile(file)}
              />

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Deskripsi Produk
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="Deskripsi singkat rasa atau keunggulan menu..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-extrabold shadow-md transition-all cursor-pointer"
                >
                  {editingProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Delete */}
      <ConfirmDialog
        isOpen={!!deletingProduct}
        title="Hapus Produk?"
        message={`Apakah Anda yakin ingin menghapus produk "${deletingProduct?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Hapus Produk"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingProduct(null)}
      />
    </div>
  );
};