import { Product, Category } from '../types';
import { productRepository } from '../mock/repositories/productRepository';

export const productService = {
  async getProducts(): Promise<Product[]> {
    return productRepository.getProducts();
  },

  async getCategories(): Promise<Category[]> {
    return productRepository.getCategories();
  },

  async getProductById(id: string): Promise<Product | undefined> {
    return productRepository.getProductById(id);
  },

  async createProduct(
    productData: Omit<Product, 'id'>,
    imageFile?: File | null
  ): Promise<Product> {
    return productRepository.createProduct(productData, imageFile);
  },

  async updateProduct(
    id: string,
    productData: Partial<Product>,
    imageFile?: File | null
  ): Promise<Product> {
    return productRepository.updateProduct(id, productData, imageFile);
  },

  async deleteProduct(id: string): Promise<boolean> {
    return productRepository.deleteProduct(id);
  },

  async createCategory(
    categoryData: Omit<Category, 'id' | 'slug'>
  ): Promise<Category> {
    return productRepository.createCategory(categoryData);
  },

  async updateCategory(
    id: string,
    categoryData: Partial<Category>
  ): Promise<Category> {
    return productRepository.updateCategory(id, categoryData);
  },

  async deleteCategory(id: string): Promise<boolean> {
    return productRepository.deleteCategory(id);
  },

  async toggleFavorite(id: string): Promise<{ is_favorite: boolean }> {
    return productRepository.toggleFavorite(id);
  },
};