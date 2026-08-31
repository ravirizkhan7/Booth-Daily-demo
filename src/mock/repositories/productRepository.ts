import { Product, Category } from '../../types';
import { mockStore } from '../store';
import { fileToBase64 } from '../utils/imageHelper';

export const productRepository = {
  async getProducts(): Promise<Product[]> {
    return mockStore.getProducts();
  },

  async getCategories(): Promise<Category[]> {
    return mockStore.getCategories();
  },

  async getProductById(id: string): Promise<Product | undefined> {
    return mockStore.getProductById(id);
  },

  async createProduct(
    productData: Omit<Product, 'id'>,
    imageFile?: File | null
  ): Promise<Product> {
    const imageUrl = imageFile
      ? await fileToBase64(imageFile)
      : productData.image_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80';

    const payload = {
      ...productData,
      image_url: imageUrl,
    };

    return mockStore.addProduct(payload);
  },

  async updateProduct(
    id: string,
    productData: Partial<Product>,
    imageFile?: File | null
  ): Promise<Product> {
    const payload: Partial<Product> = { ...productData };
    if (imageFile) {
      payload.image_url = await fileToBase64(imageFile);
    }

    return mockStore.updateProduct(id, payload);
  },

  async deleteProduct(id: string): Promise<boolean> {
    return mockStore.deleteProduct(id);
  },

  async createCategory(
    categoryData: Omit<Category, 'id' | 'slug'>
  ): Promise<Category> {
    return mockStore.addCategory(categoryData);
  },

  async updateCategory(
    id: string,
    categoryData: Partial<Category>
  ): Promise<Category> {
    return mockStore.updateCategory(id, categoryData);
  },

  async deleteCategory(id: string): Promise<boolean> {
    return mockStore.deleteCategory(id);
  },

  async toggleFavorite(id: string): Promise<{ is_favorite: boolean }> {
    return mockStore.toggleProductFavorite(id);
  },
};
