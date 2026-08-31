import { Recipe } from '../../types';
import { mockStore } from '../store';
import { fileToBase64 } from '../utils/imageHelper';

export const recipeRepository = {
  async getRecipes(): Promise<Recipe[]> {
    return mockStore.getRecipes();
  },

  async getRecipeByProductId(productId: string): Promise<Recipe | undefined> {
    return mockStore.getRecipeByProductId(productId);
  },

  async createRecipe(recipeData: Omit<Recipe, 'id'>): Promise<Recipe> {
    return mockStore.addRecipe(recipeData);
  },

  async updateRecipe(id: string, recipeData: Partial<Recipe>): Promise<Recipe> {
    return mockStore.updateRecipe(id, recipeData);
  },

  async uploadRecipeImage(id: string, imageFile: File): Promise<Recipe> {
    const imageUrl = await fileToBase64(imageFile);
    return mockStore.updateRecipe(id, { image_url: imageUrl });
  },

  async deleteRecipe(id: string): Promise<boolean> {
    return mockStore.deleteRecipe(id);
  },
};
