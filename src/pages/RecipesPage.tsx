import { NumberInput } from '../components/common/NumberInput';
import React, { useState } from 'react';
import { usePOS } from '../hooks/usePOS';
import { Recipe, RecipeIngredient, RecipeStep } from '../types';
import { formatRupiah } from '../utils/formatters';
import { getImageUrl } from '../utils/axios';
import {
  BookOpen, Clock, Coffee, Plus, Edit3, Trash2, Eye, X,
  Lightbulb, Search
} from 'lucide-react';
import { ImageUpload } from '../components/common/ImageUpload';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const RecipesPage: React.FC = () => {
  const {
    recipes,
    products,
    stocks,
    saveRecipeData,
    removeRecipe,
    openRecipeModal,
    currentUser
  } = usePOS();

  const isOwner = currentUser?.role === 'owner';

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [deletingRecipe, setDeletingRecipe] = useState<Recipe | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    product_id: '',
    prep_time_minutes: 3,
    image_url: '',
    description: '',
    barista_tips: '',
    ingredients: [] as RecipeIngredient[],
    steps: [] as RecipeStep[]
  });

  const [formError, setFormError] = useState('');

  // File foto baru hasil crop+compress dari ImageUpload.
  // null = tidak ada perubahan foto (pakai foto lama / tidak ada foto).
  const [imageFile, setImageFile] = useState<File | null>(null);

  const productIdsWithRecipe = new Set(recipes.map(r => r.product_id));

  const availableProducts = editingRecipe
    ? products
    : products.filter(p => !productIdsWithRecipe.has(p.id));

  const hasAvailableProducts = products.some(p => !productIdsWithRecipe.has(p.id));

  const filteredRecipes = recipes.filter(r => {
    const product = products.find(p => p.id === r.product_id);
    if (!product) return false;
    return product.name.toLowerCase().includes(search.toLowerCase());
  });

  const handleOpenAdd = () => {
    setEditingRecipe(null);
    setFormError('');
    // Pick first product that doesn't have a recipe yet
    const unusedProduct = products.find(p => !productIdsWithRecipe.has(p.id));
    const defaultProductId = unusedProduct ? unusedProduct.id : '';

    setFormData({
      product_id: defaultProductId,
      prep_time_minutes: 3,
      image_url: '',
      description: 'Resep standar pembuatan minuman Booth Daily.',
      barista_tips: 'Gunakan bahan bersuhu dingin agar cita rasa terjaga.',
      ingredients: stocks.length > 0 ? [
        {
          id: `ring-${Date.now()}-1`,
          stock_id: stocks[0].id,
          stock_name: stocks[0].name,
          amount: 1,
          unit: stocks[0].unit
        }
      ] : [],
      steps: [
        { step_number: 1, instruction: 'Persiapkan bahan dan alat seduh.' },
        { step_number: 2, instruction: 'Sajikan minuman ke dalam cup bersih.' }
      ]
    });
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setFormError('');
    setFormData({
      product_id: recipe.product_id,
      prep_time_minutes: recipe.prep_time_minutes,
      image_url: recipe.image_url || '',
      description: recipe.description || '',
      barista_tips: recipe.barista_tips || '',
      ingredients: recipe.ingredients ? [...recipe.ingredients] : [],
      steps: recipe.steps ? [...recipe.steps] : []
    });
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRecipe) return;
    await removeRecipe(deletingRecipe.id);
    setDeletingRecipe(null);
  };

  // Dynamic Ingredients Handlers
  const handleAddIngredient = () => {
    if (stocks.length === 0) return;
    const firstStock = stocks[0];
    const newItem: RecipeIngredient = {
      id: `ring-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      stock_id: firstStock.id,
      stock_name: firstStock.name,
      amount: 1,
      unit: firstStock.unit
    };
    setFormData(prev => ({ ...prev, ingredients: [...prev.ingredients, newItem] }));
  };

  const handleIngredientChange = (
    index: number,
    field: keyof RecipeIngredient,
    value: any
  ) => {
    setFormData(prev => {
      const updated = [...prev.ingredients];

      if (field === 'stock_id') {
        const foundStock = stocks.find(s => String(s.id) === String(value));

        if (foundStock) {
          updated[index] = {
            ...updated[index],
            stock_id: foundStock.id,
            stock_name: foundStock.name,
            unit: foundStock.unit
          };
        }
      } else {
        updated[index] = {
          ...updated[index],
          [field]: value
        };
      }

      return {
        ...prev,
        ingredients: updated
      };
    });
  };

  const handleRemoveIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  // Dynamic Steps Handlers
  const handleAddStep = () => {
    setFormData(prev => {
      const nextNum = prev.steps.length + 1;
      return {
        ...prev,
        steps: [...prev.steps, { step_number: nextNum, instruction: '' }]
      };
    });
  };

  const handleStepChange = (index: number, instruction: string) => {
    setFormData(prev => {
      const updated = [...prev.steps];
      updated[index] = { ...updated[index], instruction };
      return { ...prev, steps: updated };
    });
  };

  const handleRemoveStep = (index: number) => {
    setFormData(prev => {
      const filtered = prev.steps.filter((_, i) => i !== index);
      const renumbered = filtered.map((s, idx) => ({ ...s, step_number: idx + 1 }));
      return { ...prev, steps: renumbered };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id) {
      setFormError('Pilih produk terlebih dahulu');
      return;
    }
    if (formData.ingredients.length === 0) {
      setFormError('Tambahkan minimal 1 bahan resep');
      return;
    }

    // image_url tidak perlu dikirim di sini — foto baru (kalau ada)
    // dikirim terpisah lewat imageFile setelah data resep tersimpan.
    await saveRecipeData(
      {
        product_id: formData.product_id,
        prep_time_minutes: Number(formData.prep_time_minutes) || 3,
        image_url: formData.image_url,
        description: formData.description,
        barista_tips: formData.barista_tips,
        ingredients: formData.ingredients,
        steps: formData.steps
      },
      editingRecipe?.id,
      imageFile
    );

    setIsModalOpen(false);
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#C68B59]" />
            Kelola Resep & Standar Barista
          </h1>
          <p className="text-xs text-stone-500 font-medium">
            Resep standar pembuatan minuman dan makanan agar kualitas rasa selalu konsisten di tangan semua karyawan.
          </p>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={handleOpenAdd}
            disabled={!hasAvailableProducts}
            title={!hasAvailableProducts ? 'Semua produk sudah memiliki resep' : undefined}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-sm font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 text-[#D4A373]" />
            Tambah Resep Baru
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-[#1E1C1A] p-4 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari resep produk..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
          />
        </div>
      </div>

      {/* Recipe Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRecipes.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 text-stone-400 font-medium">
            Belum ada resep ditemukan. Klik "Tambah Resep Baru" untuk membuat resep.
          </div>
        ) : (
          filteredRecipes.map(recipe => {
            const product = products.find(p => p.id === recipe.product_id);
            if (!product) return null;

            const displayImage = recipe.image_url || product.image_url;

            return (
              <div
                key={recipe.id}
                className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 w-full overflow-hidden bg-stone-900">
                    {displayImage ? (
                      <img
                        src={getImageUrl(displayImage)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-600">
                        <Coffee className="w-10 h-10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 text-white flex justify-between items-end">
                      <div>
                        <h3 className="font-extrabold text-base leading-tight">{product.name}</h3>
                        <span className="text-xs text-[#D4A373] font-bold">{formatRupiah(product.price)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-stone-300 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-md font-bold">
                        <Clock className="w-3.5 h-3.5 text-[#D4A373]" />
                        <span>{recipe.prep_time_minutes} Mins</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 text-xs">
                    <p className="text-stone-600 dark:text-stone-300 line-clamp-2 italic font-medium">
                      "{recipe.description || 'Tidak ada deskripsi'}"
                    </p>

                    <div className="space-y-1.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                      <span className="font-extrabold text-stone-400 uppercase text-[10px] flex items-center gap-1 tracking-wider">
                        <Coffee className="w-3 h-3 text-[#C68B59]" /> BAHAN DIBUTUHKAN ({recipe.ingredients.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {recipe.ingredients.map(ing => (
                          <span key={ing.id} className="px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-[#25221F] text-stone-800 dark:text-stone-200 font-bold text-[10px] border border-stone-200 dark:border-stone-800">
                            {ing.stock_name} ({ing.amount} {ing.unit})
                          </span>
                        ))}
                      </div>
                    </div>

                    {recipe.barista_tips && (
                      <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-900 dark:text-amber-300 text-[11px]">
                        <span className="font-extrabold flex items-center gap-1">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          Tips Barista:
                        </span>
                        <p className="mt-0.5 line-clamp-2">{recipe.barista_tips}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-[#181614] border-t border-stone-100 dark:border-stone-800 flex justify-between items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openRecipeModal(product)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#3B2A1F] text-[#F7F5F2] font-bold text-xs hover:bg-[#2A1E16] transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#D4A373]" />
                    <span>Lihat</span>
                  </button>

                  {isOwner && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(recipe)}
                        className="p-1.5 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 transition-colors cursor-pointer"
                        title="Edit Resep"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingRecipe(recipe)}
                        className="p-1.5 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors cursor-pointer"
                        title="Hapus Resep"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add / Edit Recipe */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl border border-stone-200 dark:border-stone-800 my-auto max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3 shrink-0">
              <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                {editingRecipe ? 'Edit Resep Standar' : 'Tambah Resep Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Pilih Produk <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.product_id}
                    onChange={e => setFormData({ ...formData, product_id: e.target.value })}
                    disabled={!!editingRecipe || availableProducts.length === 0}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {availableProducts.length === 0 ? (
                      <option value="" disabled>Semua produk sudah memiliki resep</option>
                    ) : (
                      availableProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))
                    )}
                  </select>
                  {editingRecipe ? (
                    <p className="text-[10px] text-stone-400 font-medium mt-1">
                      Produk tidak bisa diubah saat mengedit resep.
                    </p>
                  ) : availableProducts.length === 0 ? (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                      Semua produk sudah memiliki resep.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Estimasi Waktu Penyajian (Menit) <span className="text-rose-500">*</span>
                  </label>
                  <NumberInput
                    type="number"
                    min={1}
                    required
                    value={formData.prep_time_minutes}
                    onChange={val => setFormData({ ...formData, prep_time_minutes: val })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* Upload Foto Penyajian dengan crop & kompresi otomatis */}
              <ImageUpload
                label="Foto Hasil Penyajian (Opsional)"
                value={formData.image_url}
                onFileChange={file => setImageFile(file)}
              />

              {/* Dynamic Form: Ingredients */}
              <div className="space-y-2 p-3.5 bg-stone-50 dark:bg-[#161413] rounded-2xl border border-stone-200 dark:border-stone-800">
                <div className="flex justify-between items-center">
                  <label className="block font-extrabold text-stone-800 dark:text-stone-200 uppercase text-[11px]">
                    DAFTAR BAHAN BAKU RESEP
                  </label>
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="px-3 py-1 rounded-xl bg-[#3B2A1F] text-[#F7F5F2] font-bold text-[11px] flex items-center gap-1 hover:bg-[#2A1E16] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#D4A373]" />
                    Tambah Bahan
                  </button>
                </div>

                {formData.ingredients.length === 0 ? (
                  <p className="text-stone-400 italic text-center py-2">Belum ada bahan baku ditambahkan.</p>
                ) : (
                  formData.ingredients.map((ing, idx) => (
                    <div key={ing.id || idx} className="flex flex-col sm:grid sm:grid-cols-12 gap-2 items-stretch sm:items-center bg-white dark:bg-[#1E1C1A] p-2.5 rounded-xl border border-stone-200 dark:border-stone-800">
                      <div className="flex-1 sm:col-span-5">
                        <label className="block sm:hidden text-[10px] font-bold text-stone-400 mb-0.5">Pilih Bahan Baku</label>
                        <select
                          value={ing.stock_id}
                          onChange={e => handleIngredientChange(idx, 'stock_id', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold text-[11px]"
                        >
                          {stocks.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 sm:contents">
                        <div className="flex-1 sm:col-span-3">
                          <label className="block sm:hidden text-[10px] font-bold text-stone-400 mb-0.5">Jumlah</label>
                          <NumberInput
                            type="number"
                            step="any"
                            min={0.001}
                            allowDecimals={true}
                            value={ing.amount}
                            onChange={val => handleIngredientChange(idx, 'amount', val)}
                            placeholder="Jumlah"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-[11px]"
                          />
                        </div>

                        <div className="flex-1 sm:col-span-3">
                          <label className="block sm:hidden text-[10px] font-bold text-stone-400 mb-0.5">Satuan</label>
                          <input
                            type="text"
                            readOnly
                            disabled
                            value={ing.unit}
                            title="Satuan otomatis mengikuti satuan dasar bahan baku"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 font-bold text-stone-600 dark:text-stone-300 text-[11px] cursor-not-allowed"
                          />
                        </div>

                        <div className="sm:col-span-1 text-center pt-4 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredient(idx)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Hapus Bahan"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Dynamic Form: Steps */}
              <div className="space-y-2 p-3.5 bg-stone-50 dark:bg-[#161413] rounded-2xl border border-stone-200 dark:border-stone-800">
                <div className="flex justify-between items-center">
                  <label className="block font-extrabold text-stone-800 dark:text-stone-200 uppercase text-[11px]">
                    LANGKAH PEMBUATAN
                  </label>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="px-3 py-1 rounded-xl bg-[#3B2A1F] text-[#F7F5F2] font-bold text-[11px] flex items-center gap-1 hover:bg-[#2A1E16] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#D4A373]" />
                    Tambah Langkah
                  </button>
                </div>

                {formData.steps.length === 0 ? (
                  <p className="text-stone-400 italic text-center py-2">Belum ada langkah instruksi ditambahkan.</p>
                ) : (
                  formData.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-[#1E1C1A] p-2 rounded-xl border border-stone-200 dark:border-stone-800">
                      <span className="w-6 h-6 rounded-lg bg-[#3B2A1F] text-[#F7F5F2] font-black text-[11px] flex items-center justify-center shrink-0">
                        {step.step_number}
                      </span>
                      <input
                        type="text"
                        value={step.instruction}
                        onChange={e => handleStepChange(idx, e.target.value)}
                        placeholder={`Instruksi langkah ${step.step_number}...`}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Barista Tips & Deskripsi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Tips Barista
                  </label>
                  <textarea
                    value={formData.barista_tips}
                    onChange={e => setFormData({ ...formData, barista_tips: e.target.value })}
                    rows={2}
                    placeholder="Contoh: Gunakan susu dingin agar foam lebih stabil..."
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Deskripsi Singkat
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    placeholder="Deskripsi cita rasa..."
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-rose-600 font-bold text-xs">{formError}</p>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!editingRecipe && availableProducts.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-extrabold shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Simpan Resep
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingRecipe}
        title="Hapus Resep?"
        message="Apakah Anda yakin ingin menghapus resep ini?"
        confirmText="Ya, Hapus Resep"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingRecipe(null)}
      />
    </div>
  );
};