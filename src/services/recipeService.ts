import { Recipe } from '../types';
import { recipeRepository } from '../mock/repositories/recipeRepository';

export const recipeService = {
  async getRecipes(): Promise<Recipe[]> {
    return recipeRepository.getRecipes();
  },

  async getRecipeByProductId(productId: string): Promise<Recipe | undefined> {
    return recipeRepository.getRecipeByProductId(productId);
  },

  async createRecipe(recipeData: Omit<Recipe, 'id'>): Promise<Recipe> {
    return recipeRepository.createRecipe(recipeData);
  },

  async updateRecipe(id: string, recipeData: Partial<Recipe>): Promise<Recipe> {
    return recipeRepository.updateRecipe(id, recipeData);
  },

  async uploadRecipeImage(id: string, imageFile: File): Promise<Recipe> {
    return recipeRepository.uploadRecipeImage(id, imageFile);
  },

  async deleteRecipe(id: string): Promise<boolean> {
    return recipeRepository.deleteRecipe(id);
  },
};