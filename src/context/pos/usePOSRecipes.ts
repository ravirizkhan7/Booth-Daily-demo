import { useState, useCallback } from 'react';
import { Recipe, Product } from '../../types';
import { recipeService } from '../../services/recipeService';
import { ToastType } from './usePOSToast';

export interface UsePOSRecipesProps {
  showToast: (message: string, type?: ToastType) => void;
}

export const usePOSRecipes = ({ showToast }: UsePOSRecipesProps) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedRecipeProduct, setSelectedRecipeProduct] = useState<Product | null>(null);

  const openRecipeModal = useCallback((product: Product) => {
    const recipe = recipes.find(r => r.product_id === product.id);
    setSelectedRecipe(recipe || null);
    setSelectedRecipeProduct(product);
  }, [recipes]);

  const closeRecipeModal = useCallback(() => {
    setSelectedRecipe(null);
    setSelectedRecipeProduct(null);
  }, []);

  const saveRecipeData = async (
    recipeData: Omit<Recipe, 'id'>,
    recipeId?: string,
    imageFile?: File | null
  ) => {
    let saved = recipeId
      ? await recipeService.updateRecipe(recipeId, recipeData)
      : await recipeService.createRecipe(recipeData);

    if (imageFile) {
      saved = await recipeService.uploadRecipeImage(saved.id, imageFile);
    }

    setRecipes(prev => {
      const idx = prev.findIndex(r => r.id === saved.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });

    showToast('Resep berhasil disimpan', 'success');
    return saved;
  };

  const removeRecipe = async (id: string) => {
    const success = await recipeService.deleteRecipe(id);
    if (success) {
      setRecipes(prev => prev.filter(r => r.id !== id));
      showToast('Resep berhasil dihapus', 'success');
    }
    return success;
  };

  const handleRecipeRealtimeChange = useCallback(async () => {
    try {
      const updatedRecipes = await recipeService.getRecipes();
      setRecipes(updatedRecipes);
    } catch (err) {
      console.error('[Realtime] Failed to sync recipes after recipe.changed:', err);
    }
  }, []);

  return {
    recipes,
    setRecipes,
    selectedRecipe,
    selectedRecipeProduct,
    openRecipeModal,
    closeRecipeModal,
    saveRecipeData,
    removeRecipe,
    handleRecipeRealtimeChange,
  };
};
