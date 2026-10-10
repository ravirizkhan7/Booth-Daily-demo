import React, { useState } from 'react';
import { usePOS } from '../hooks/usePOS';
import { Category } from '../types';
import { 
  ListFilter, Plus, Edit2, Trash2, Search, X,
  Coffee, CupSoda, GlassWater, Cookie, IceCream, Flame, Utensils, Sparkles, Tag,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

const ICON_OPTIONS = [
  { name: 'Coffee', icon: Coffee },
  { name: 'CupSoda', icon: CupSoda },
  { name: 'GlassWater', icon: GlassWater },
  { name: 'Cookie', icon: Cookie },
  { name: 'IceCream', icon: IceCream },
  { name: 'Flame', icon: Flame },
  { name: 'Utensils', icon: Utensils },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Tag', icon: Tag }
];

export const CategoriesPage: React.FC = () => {
  const { categories, products, addCategory, editCategory, removeCategory } = usePOS();

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    icon_name: 'Coffee',
    is_active: true
  });

  const [formError, setFormError] = useState('');

  // Filter out "cat-all" for management, keep user created categories
  const manageableCategories = categories.filter(c => c.id !== 'cat-all');

  const filteredCategories = manageableCategories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage) || 1;
  const paginatedCategories = filteredCategories.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormError('');
    setFormData({
      name: '',
      icon_name: 'Coffee',
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Category) => {
    setEditingCategory(c);
    setFormError('');
    setFormData({
      name: c.name,
      icon_name: c.icon_name || 'Coffee',
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;
    await removeCategory(deletingCategory.id);
    setDeletingCategory(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Nama kategori wajib diisi');
      return;
    }

    if (editingCategory) {
      await editCategory(editingCategory.id, formData);
    } else {
      await addCategory(formData);
    }

    setIsModalOpen(false);
  };

  const getIconComponent = (iconName: string) => {
    const found = ICON_OPTIONS.find(i => i.name === iconName);
    const IconComp = found ? found.icon : Tag;
    return <IconComp className="w-5 h-5 text-[#D4A373]" />;
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <ListFilter className="w-6 h-6 text-[#C68B59]" />
            Kelola Kategori Menu
          </h1>
          <p className="text-xs text-stone-500 font-medium">
            Kelompokkan produk berdasarkan jenis minuman, makanan, snack, dan dessert.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-sm font-bold shadow-md transition-all cursor-pointer w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 text-[#D4A373]" />
          Tambah Kategori
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-[#1E1C1A] p-4 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari nama kategori..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
          />
        </div>
      </div>

      {/* Table List */}
      <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[550px]">
            <thead className="bg-stone-50 dark:bg-[#23201D] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="p-4">Icon</th>
                <th className="p-4">Nama Kategori</th>
                <th className="p-4">Slug URL</th>
                <th className="p-4">Jumlah Menu</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
              {paginatedCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-400 font-semibold">
                    Tidak ada kategori ditemukan.
                  </td>
                </tr>
              ) : (
                paginatedCategories.map(cat => {
                  const menuCount = products.filter(p => p.category_id === cat.id).length;
                  return (
                    <tr key={cat.id} className="hover:bg-stone-50/50 dark:hover:bg-[#25221F] transition-colors">
                      <td className="p-4">
                        <div className="w-10 h-10 rounded-2xl bg-[#3B2A1F]/10 dark:bg-[#D4A373]/10 border border-[#3B2A1F]/20 flex items-center justify-center shrink-0">
                          {getIconComponent(cat.icon_name)}
                        </div>
                      </td>
                      <td className="p-4 font-extrabold text-stone-900 dark:text-stone-100 text-sm">
                        {cat.name}
                      </td>
                      <td className="p-4 font-mono text-stone-400">
                        /{cat.slug}
                      </td>
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-full bg-[#C68B59]/10 text-[#C68B59] font-black text-xs">
                          {menuCount} Produk
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cat)}
                            className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 transition-colors cursor-pointer"
                            title="Edit Kategori"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingCategory(cat)}
                            className="p-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors cursor-pointer"
                            title="Hapus Kategori"
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 bg-stone-50 dark:bg-[#23201D] border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs font-semibold">
            <span className="text-stone-500">
              Halaman {currentPage} dari {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 disabled:opacity-40 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 disabled:opacity-40 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Add/Edit Category */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-stone-200 dark:border-stone-800">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Nama Kategori <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => {
                    setFormData({ ...formData, name: e.target.value });
                    setFormError('');
                  }}
                  placeholder="Contoh: Cold Brew & Mocktails"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
                />
                {formError && (
                  <p className="text-rose-500 text-[11px] font-bold mt-1">{formError}</p>
                )}
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-2">
                  Pilih Icon Kategori
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {ICON_OPTIONS.map(opt => {
                    const IconComp = opt.icon;
                    const isSelected = formData.icon_name === opt.name;
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon_name: opt.name })}
                        className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 transition-all cursor-pointer min-h-[44px] ${
                          isSelected
                            ? 'bg-[#3B2A1F] text-[#F7F5F2] border-[#3B2A1F] shadow-md ring-2 ring-[#D4A373]/50'
                            : 'bg-stone-50 dark:bg-[#171514] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-stone-400'
                        }`}
                      >
                        <IconComp className={`w-5 h-5 ${isSelected ? 'text-[#D4A373]' : 'text-stone-600 dark:text-stone-300'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-extrabold shadow-md transition-all cursor-pointer"
                >
                  {editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingCategory}
        title="Hapus Kategori?"
        message={`Apakah Anda yakin ingin menghapus kategori "${deletingCategory?.name}"?`}
        confirmText="Ya, Hapus Kategori"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingCategory(null)}
      />
    </div>
  );
};
