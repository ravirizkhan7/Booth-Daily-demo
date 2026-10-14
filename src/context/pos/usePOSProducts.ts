import { useState, useCallback } from 'react';
import { Product, Category } from '../../types';
import { productService } from '../../services/productService';
import { ToastType } from './usePOSToast';
import { getSecondaryCache } from '../../mock/persistence/storage';

export interface UsePOSProductsProps {
  showToast: (message: string, type?: ToastType) => void;
}

export const usePOSProducts = ({ showToast }: UsePOSProductsProps) => {
  const [products, setProducts] = useState<Product[]>(() => {
    return getSecondaryCache<Product[]>('boothdaily_cached_products') ?? [];
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    return getSecondaryCache<Category[]>('boothdaily_cached_categories') ?? [];
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('cat-all');

  // Product CRUD
  const addProduct = async (productData: Omit<Product, 'id'>, imageFile?: File | null) => {
    const newPrd = await productService.createProduct(productData, imageFile);
    setProducts(prev => {
      const exists = prev.some(
        p => String(p.id) === String(newPrd.id)
      );

      if (exists) {
        return prev.map(
          p => String(p.id) === String(newPrd.id)
            ? newPrd
            : p
        );
      }

      return [newPrd, ...prev];
    });
    showToast(`Produk "${newPrd.name}" berhasil ditambahkan`, 'success');
    return newPrd;
  };

  const editProduct = async (id: string, productData: Partial<Product>, imageFile?: File | null) => {
    const updated = await productService.updateProduct(id, productData, imageFile);
    setProducts(prev => prev.map(p => p.id === id ? updated : p));
    showToast(`Produk "${updated.name}" berhasil diperbarui`, 'success');
    return updated;
  };

  const removeProduct = async (id: string) => {
    const prd = products.find(p => p.id === id);
    const success = await productService.deleteProduct(id);
    if (success) {
      setProducts(prev => prev.filter(p => p.id !== id));
      showToast(`Produk "${prd?.name || ''}" berhasil dihapus`, 'success');
    }
    return success;
  };

  const toggleFavorite = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const result = await productService.toggleFavorite(productId);
    const newFavorite = result?.is_favorite ?? !product.is_favorite;
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_favorite: newFavorite } : p));
    showToast(newFavorite ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit', 'info');
  };

  // Category CRUD
  const addCategory = async (categoryData: Omit<Category, 'id' | 'slug'>) => {
    const newCat = await productService.createCategory(categoryData);
    setCategories(prev => {
      const exists = prev.some(
        c => String(c.id) === String(newCat.id)
      );

      if (exists) {
        return prev.map(
          c => String(c.id) === String(newCat.id)
            ? newCat
            : c
        );
      }

      return [...prev, newCat];
    });
    showToast(`Kategori "${newCat.name}" berhasil ditambahkan`, 'success');
    return newCat;
  };

  const editCategory = async (id: string, categoryData: Partial<Category>) => {
    const updated = await productService.updateCategory(id, categoryData);
    setCategories(prev => prev.map(c => c.id === id ? updated : c));
    showToast(`Kategori "${updated.name}" berhasil diperbarui`, 'success');
    return updated;
  };

  const removeCategory = async (id: string) => {
    const cat = categories.find(c => c.id === id);
    const success = await productService.deleteCategory(id);
    if (success) {
      setCategories(prev => prev.filter(c => c.id !== id));
      showToast(`Kategori "${cat?.name || ''}" berhasil dihapus`, 'success');
    }
    return success;
  };

  // Realtime update helpers
  const handleProductRealtimeChange = useCallback((payload: { action: string; product_id: number | string; product: any | null }) => {
    const productId = String(payload.product_id);

    if (payload.action === 'deleted') {
      setProducts(prev => prev.filter(p => String(p.id) !== productId));
      return;
    }

    if (payload.product) {
      const normalizedProduct: Product = {
        id: productId,
        category_id: String(payload.product.category_id),
        name: payload.product.name,
        price: Number(payload.product.price),
        cost_price: Number(payload.product.cost_price || 0),
        image_url: payload.product.image_url || '',
        description: payload.product.description || '',
        is_active: Boolean(payload.product.is_active),
        is_favorite: Boolean(payload.product.is_favorite),
      };

      if (payload.action === 'created') {
        setProducts(prev => {
          const exists = prev.some(p => String(p.id) === productId);
          if (exists) {
            return prev.map(p => String(p.id) === productId ? normalizedProduct : p);
          }
          return [normalizedProduct, ...prev];
        });
      } else {
        // 'updated' | 'toggled'
        setProducts(prev =>
          prev.map(p => String(p.id) === productId ? normalizedProduct : p)
        );
      }
    }
  }, []);

  const handleCategoryRealtimeChange = useCallback((payload: { action: string; category_id: number | string; category: any | null }) => {
    const categoryId = String(payload.category_id);

    if (payload.action === 'deleted') {
      setCategories(prev => prev.filter(c => String(c.id) !== categoryId));
      return;
    }

    if (payload.category) {
      const normalizedCategory: Category = {
        id: categoryId,
        name: payload.category.name,
        slug: payload.category.slug || '',
        icon_name: payload.category.icon_name || 'tag',
      };

      if (payload.action === 'created') {
        setCategories(prev => {
          const exists = prev.some(c => String(c.id) === categoryId);
          if (exists) {
            return prev.map(c => String(c.id) === categoryId ? normalizedCategory : c);
          }
          return [...prev, normalizedCategory];
        });
      } else {
        // 'updated'
        setCategories(prev =>
          prev.map(c => String(c.id) === categoryId ? normalizedCategory : c)
        );
      }
    }
  }, []);

  return {
    products,
    setProducts,
    categories,
    setCategories,
    selectedCategory,
    setSelectedCategory,
    addProduct,
    editProduct,
    removeProduct,
    toggleFavorite,
    addCategory,
    editCategory,
    removeCategory,
    handleProductRealtimeChange,
    handleCategoryRealtimeChange,
  };
};
