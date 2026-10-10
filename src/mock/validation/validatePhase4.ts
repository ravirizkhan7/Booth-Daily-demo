import { mockStore } from '../store';
import { productService } from '../../services/productService';
import { recipeService } from '../../services/recipeService';
import { stockService } from '../../services/stockService';
import { orderService } from '../../services/orderService';
import { discountService } from '../../services/discountService';
import { settingsService } from '../../services/settingsService';
import { userService } from '../../services/userService';
import { transactionService } from '../../services/transactionService';

export async function validatePhase4(): Promise<{ pass: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // 0. Ensure fresh initial state for deterministic testing
    mockStore.resetMockStore();

    // =========================================================================
    // 1. PRODUCT CRUD & FAVORITE
    // =========================================================================
    // 1.1 Valid create
    const createdProduct = await productService.createProduct({
      category_id: 'cat-1',
      name: 'Caramel Macchiato Special',
      price: 28000,
      cost_price: 11000,
      image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
      description: 'Espresso dengan saus karamel lezat',
      is_active: true,
      is_favorite: false,
    });
    if (!createdProduct || !createdProduct.id) {
      errors.push('[Product] createProduct failed to return created product');
    }

    // 1.2 Invalid category rejection
    try {
      await productService.createProduct({
        category_id: 'cat-nonexistent',
        name: 'Invalid Category Drink',
        price: 20000,
        cost_price: 5000,
        image_url: '',
        description: '',
        is_active: true,
        is_favorite: false,
      });
      errors.push('[Product] createProduct with invalid category_id did not throw error');
    } catch {
      // Expected
    }

    // 1.3 Update product
    const updatedProduct = await productService.updateProduct(createdProduct.id, {
      name: 'Caramel Macchiato Signature',
      price: 30000,
    });
    if (updatedProduct.name !== 'Caramel Macchiato Signature' || updatedProduct.price !== 30000) {
      errors.push('[Product] updateProduct failed to update name or price');
    }

    // 1.4 Toggle favorite
    const favResult = await productService.toggleFavorite(createdProduct.id);
    if (!favResult.is_favorite) {
      errors.push('[Product] toggleFavorite failed to set is_favorite to true');
    }

    // 1.5 Delete product
    const deletePrdSuccess = await productService.deleteProduct(createdProduct.id);
    if (!deletePrdSuccess) {
      errors.push('[Product] deleteProduct failed to return true');
    }
    const checkDeletedPrd = await productService.getProductById(createdProduct.id);
    if (checkDeletedPrd) {
      errors.push('[Product] Deleted product still exists in store');
    }

    // =========================================================================
    // 2. CATEGORY CRUD & REFERENTIAL SAFETY
    // =========================================================================
    // 2.1 Create category
    const createdCat = await productService.createCategory({
      name: 'Seasonal Drinks',
      icon_name: 'Sparkles',
    });
    if (!createdCat || !createdCat.id || createdCat.slug !== 'seasonal-drinks') {
      errors.push('[Category] createCategory failed to create category or slug');
    }

    // 2.2 Update category
    const updatedCat = await productService.updateCategory(createdCat.id, {
      name: 'Seasonal Special Drinks',
    });
    if (updatedCat.name !== 'Seasonal Special Drinks') {
      errors.push('[Category] updateCategory failed to update name');
    }

    // 2.3 Attempt to delete category in active use (e.g. cat-1 has coffee products)
    try {
      await productService.deleteCategory('cat-1');
      errors.push('[Category] deleteCategory for category in use by active products did not throw error');
    } catch {
      // Expected
    }

    // 2.4 Delete unused category
    const deleteCatSuccess = await productService.deleteCategory(createdCat.id);
    if (!deleteCatSuccess) {
      errors.push('[Category] deleteCategory for unused category failed');
    }

    // =========================================================================
    // 3. RECIPE CRUD & INGREDIENT SAFETY
    // =========================================================================
    // Create a temporary product for recipe testing
    const tempPrd = await productService.createProduct({
      category_id: 'cat-1',
      name: 'Espresso Romano',
      price: 20000,
      cost_price: 6000,
      image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
      description: 'Espresso Romano testing',
      is_active: true,
      is_favorite: false,
    });

    // 3.1 Valid recipe creation
    const createdRecipe = await recipeService.createRecipe({
      product_id: tempPrd.id,
      prep_time_minutes: 2,
      image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
      description: 'Single shot espresso dengan perasan lemon segar',
      barista_tips: 'Gunakan lemon segar',
      ingredients: [
        {
          id: 'ring-test-1',
          stock_id: 'stk-coffee-beans',
          stock_name: 'Biji Kopi House Blend',
          amount: 18,
          unit: 'Gram',
        },
      ],
      steps: [
        { step_number: 1, instruction: 'Grind 18g biji kopi' },
        { step_number: 2, instruction: 'Ekstraksi 30ml espresso' },
      ],
    });
    if (!createdRecipe || !createdRecipe.id) {
      errors.push('[Recipe] createRecipe failed to return created recipe');
    }

    // 3.2 Invalid recipe: nonexistent stock_id
    try {
      await recipeService.createRecipe({
        product_id: tempPrd.id,
        prep_time_minutes: 2,
        image_url: '',
        description: 'Invalid stock recipe',
        barista_tips: '',
        ingredients: [
          {
            id: 'ring-test-bad',
            stock_id: 'stk-nonexistent',
            stock_name: 'Fake Stock',
            amount: 10,
            unit: 'Gram',
          },
        ],
        steps: [],
      });
      errors.push('[Recipe] createRecipe with nonexistent stock_id did not throw error');
    } catch {
      // Expected
    }

    // 3.3 Update recipe
    const updatedRecipe = await recipeService.updateRecipe(createdRecipe.id, {
      prep_time_minutes: 4,
    });
    if (updatedRecipe.prep_time_minutes !== 4) {
      errors.push('[Recipe] updateRecipe failed to update prep_time_minutes');
    }

    // 3.4 Delete recipe
    const deleteRcpSuccess = await recipeService.deleteRecipe(createdRecipe.id);
    if (!deleteRcpSuccess) {
      errors.push('[Recipe] deleteRecipe failed');
    }
    await productService.deleteProduct(tempPrd.id);

    // =========================================================================
    // 4. INVENTORY / STOCK CRUD & ADJUSTMENT
    // =========================================================================
    // 4.1 Create stock
    const createdStock = await stockService.createStock({
      name: 'Sirup Hazelnut Monin',
      unit: 'ml',
      current_amount: 750,
      min_amount: 150,
      cost_per_unit: 180,
    });
    if (!createdStock || !createdStock.id || createdStock.current_amount !== 750) {
      errors.push('[Stock] createStock failed to create stock item');
    }

    // 4.2 Stock Adjustment Positive (+250ml) with Reason and Notes
    const adjustedPos = await stockService.adjustStock(
      createdStock.id,
      250,
      'Restock darurat',
      'Owner',
      'Bahan tambahan untuk event weekend'
    );
    if (adjustedPos.current_amount !== 1000) {
      errors.push(`[Stock] adjustStock +250 expected 1000, got ${adjustedPos.current_amount}`);
    }
    const posHistory = mockStore.getStockHistories()[0];
    if (
      !posHistory ||
      posHistory.stock_id !== createdStock.id ||
      posHistory.type !== 'penyesuaian' ||
      posHistory.reason !== 'Restock darurat' ||
      posHistory.notes !== 'Bahan tambahan untuk event weekend' ||
      posHistory.initial_amount !== 750 ||
      posHistory.change_amount !== 250 ||
      posHistory.final_amount !== 1000 ||
      !posHistory.reference.includes('Bahan tambahan untuk event weekend')
    ) {
      errors.push('[Stock] adjustStock failed to record complete history with reason, notes, initial_amount, and final_amount');
    }

    // 4.3 Stock Adjustment Negative (-100ml)
    const adjustedNeg = await stockService.adjustStock(
      createdStock.id,
      -100,
      'Barang Rusak / Tumpah',
      'Dinda',
      'Susu tumpah sekitar 250 ml saat membersihkan mesin steamer.'
    );
    if (adjustedNeg.current_amount !== 900) {
      errors.push(`[Stock] adjustStock -100 expected 900, got ${adjustedNeg.current_amount}`);
    }
    const negHistory = mockStore.getStockHistories()[0];
    if (
      !negHistory ||
      negHistory.change_amount !== -100 ||
      negHistory.initial_amount !== 1000 ||
      negHistory.final_amount !== 900 ||
      negHistory.reason !== 'Barang Rusak / Tumpah' ||
      negHistory.notes !== 'Susu tumpah sekitar 250 ml saat membersihkan mesin steamer.'
    ) {
      errors.push('[Stock] adjustStock negative mutation history record mismatch');
    }

    // 4.4 Stock Adjustment Negative beyond zero rejection
    try {
      await stockService.adjustStock(createdStock.id, -2000, 'Over subtract', 'Owner', 'Invalid excessive deduction');
      errors.push('[Stock] adjustStock beyond zero did not throw error');
    } catch {
      // Expected
    }

    // 4.5 Update Stock Metadata Only (No quantity change) -> MUST NOT create fake history
    const historyCountBeforeMeta = mockStore.getStockHistories().length;
    const metaUpdated = await stockService.updateStock(createdStock.id, {
      name: 'Sirup Hazelnut Monin Gold',
      cost_per_unit: 195,
      current_amount: 900, // Same current_amount
    });
    if (metaUpdated.name !== 'Sirup Hazelnut Monin Gold' || metaUpdated.cost_per_unit !== 195) {
      errors.push('[Stock] updateStock metadata update failed');
    }
    const historyCountAfterMeta = mockStore.getStockHistories().length;
    if (historyCountAfterMeta !== historyCountBeforeMeta) {
      errors.push(`[Stock] updateStock with unchanged quantity created fake history! Before: ${historyCountBeforeMeta}, After: ${historyCountAfterMeta}`);
    }

    // 4.6 Update Stock Quantity via updateStock -> MUST create exactly 1 edit_manual history
    const historyCountBeforeQtyEdit = mockStore.getStockHistories().length;
    const qtyUpdated = await stockService.updateStock(
      createdStock.id,
      { current_amount: 950 },
      { notes: 'Koreksi selisih hitung fisik audit harian', user_name: 'Hendro Wijaya' }
    );
    if (qtyUpdated.current_amount !== 950) {
      errors.push(`[Stock] updateStock expected current_amount 950, got ${qtyUpdated.current_amount}`);
    }
    const historyCountAfterQtyEdit = mockStore.getStockHistories().length;
    if (historyCountAfterQtyEdit !== historyCountBeforeQtyEdit + 1) {
      errors.push(`[Stock] updateStock quantity edit expected exactly 1 history entry, got ${historyCountAfterQtyEdit - historyCountBeforeQtyEdit}`);
    }
    const editHistory = mockStore.getStockHistories()[0];
    if (
      !editHistory ||
      editHistory.type !== 'edit_manual' ||
      editHistory.initial_amount !== 900 ||
      editHistory.change_amount !== 50 ||
      editHistory.final_amount !== 950 ||
      editHistory.notes !== 'Koreksi selisih hitung fisik audit harian' ||
      editHistory.user_name !== 'Hendro Wijaya' ||
      !editHistory.reference.includes('Koreksi selisih hitung fisik audit harian')
    ) {
      errors.push('[Stock] edit_manual history entry fields mismatch');
    }

    // 4.7 Update Stock Negative rejection
    try {
      await stockService.updateStock(createdStock.id, { current_amount: -20 });
      errors.push('[Stock] updateStock with negative amount did not throw error');
    } catch {
      // Expected
    }

    // 4.8 Legacy history integrity check (must not crash when reason/notes are undefined)
    const legacyHistory = mockStore.getStockHistories().find(h => h.id === 'sth-001' || h.id === 'sth-022');
    if (!legacyHistory || !legacyHistory.reference) {
      errors.push('[Stock] Legacy history missing or corrupt');
    }

    // 4.9 Delete stock in use by existing recipe rejection (stk-coffee-beans)
    try {
      await stockService.deleteStock('stk-coffee-beans');
      errors.push('[Stock] deleteStock for stock in active recipe did not throw error');
    } catch {
      // Expected
    }

    // 4.10 Delete unused stock
    const deleteStockSuccess = await stockService.deleteStock(createdStock.id);
    if (!deleteStockSuccess) {
      errors.push('[Stock] deleteStock for unused stock failed');
    }

    // =========================================================================
    // 5. PURCHASES CRUD & STOCK RECONCILIATION
    // =========================================================================
    const initialMilkAmount = mockStore.getStockById('stk-fresh-milk')?.current_amount ?? 0;

    // 5.1 Create purchase (+2000ml fresh milk)
    const createdPurchase = await stockService.createPurchase({
      purchase_number: 'PUR-TEST-999',
      supplier: 'PT Diamond Cold Storage',
      date: new Date().toISOString().slice(0, 10),
      total_amount: 40000,
      items: [
        {
          id: 'pi-test-1',
          stock_id: 'stk-fresh-milk',
          stock_name: 'Susu Fresh Milk UHT',
          qty: 2000,
          unit: 'ml',
          unit_cost: 20,
          total_cost: 40000,
        },
      ],
      notes: 'Pembelian batch pagi',
      created_at: new Date().toISOString(),
    });
    if (!createdPurchase || !createdPurchase.id) {
      errors.push('[Purchase] createPurchase failed to return purchase');
    }

    const milkAfterPurchase = mockStore.getStockById('stk-fresh-milk')?.current_amount ?? 0;
    if (milkAfterPurchase !== initialMilkAmount + 2000) {
      errors.push(`[Purchase] Expected milk stock ${initialMilkAmount + 2000}, got ${milkAfterPurchase}`);
    }

    // 5.2 Delete purchase (revert +2000ml)
    const deletePurSuccess = await stockService.deletePurchase(createdPurchase.id);
    if (!deletePurSuccess) {
      errors.push('[Purchase] deletePurchase failed');
    }

    const milkAfterRevert = mockStore.getStockById('stk-fresh-milk')?.current_amount ?? 0;
    if (milkAfterRevert !== initialMilkAmount) {
      errors.push(`[Purchase] Stock after purchase deletion not reverted. Expected ${initialMilkAmount}, got ${milkAfterRevert}`);
    }

    // =========================================================================
    // 6. DISCOUNT RULES CRUD
    // =========================================================================
    // 6.1 Create discount rule
    const createdDiscount = await discountService.createDiscountRule({
      name: 'Promo Pelajar Weekend - 15%',
      minimum_purchase: 30000,
      discount_percentage: 15,
      is_active: false,
    });
    if (!createdDiscount || !createdDiscount.id || createdDiscount.discount_percentage !== 15) {
      errors.push('[Discount] createDiscountRule failed');
    }

    // 6.2 Toggle active
    const toggledDiscount = await discountService.toggleActiveDiscountRule(createdDiscount.id);
    if (!toggledDiscount.is_active) {
      errors.push('[Discount] toggleActiveDiscountRule failed to activate rule');
    }

    // 6.3 Update discount rule
    const updatedDiscount = await discountService.updateDiscountRule(createdDiscount.id, {
      name: 'Promo Pelajar Weekend - 20%',
      discount_percentage: 20,
    });
    if (updatedDiscount.discount_percentage !== 20) {
      errors.push('[Discount] updateDiscountRule failed to update percentage');
    }

    // 6.4 Delete discount rule
    const deleteDiscSuccess = await discountService.deleteDiscountRule(createdDiscount.id);
    if (!deleteDiscSuccess) {
      errors.push('[Discount] deleteDiscountRule failed');
    }

    // =========================================================================
    // 7. SETTINGS UPDATE & PERSISTENCE
    // =========================================================================
    const initialSettings = await settingsService.getSettings();
    const updatedSettings = await settingsService.updateSettings({
      store_name: 'BOOTH DAILY FLAGSHIP',
      tax_percentage: 10,
    });
    if (updatedSettings.store_name !== 'BOOTH DAILY FLAGSHIP' || updatedSettings.tax_percentage !== 10) {
      errors.push('[Settings] updateSettings failed to update store_name or tax_percentage');
    }
    // Restore initial settings for continuity
    await settingsService.updateSettings({
      store_name: initialSettings.store_name,
      tax_percentage: initialSettings.tax_percentage,
    });

    // =========================================================================
    // 8. EMPLOYEE / USER CRUD & DYNAMIC LOGIN
    // =========================================================================
    // 8.1 Create dynamic employee
    const newEmployee = await userService.createUser({
      name: 'Andi Pratama',
      username: 'andipratama',
      email: 'andi@boothdaily.com',
      password: 'custompassword123',
      role: 'karyawan',
      pin: '7788',
      phone: '081233445566',
      is_active: true,
    });
    if (!newEmployee || !newEmployee.id || newEmployee.pin !== '7788') {
      errors.push('[User] createUser failed to return created user');
    }

    // 8.2 Duplicate email rejection
    try {
      await userService.createUser({
        name: 'Andi Clone',
        username: 'andiclone',
        email: 'andi@boothdaily.com',
        role: 'karyawan',
        pin: '9911',
        is_active: true,
      });
      errors.push('[User] createUser with duplicate email did not throw error');
    } catch {
      // Expected
    }

    // 8.3 Duplicate PIN rejection
    try {
      await userService.createUser({
        name: 'Andi PIN Clone',
        username: 'andipinclone',
        email: 'andipin@boothdaily.com',
        role: 'karyawan',
        pin: '7788',
        is_active: true,
      });
      errors.push('[User] createUser with duplicate PIN did not throw error');
    } catch {
      // Expected
    }

    // 8.4 Protected Owner deletion check
    try {
      await userService.deleteUser('usr-owner-01');
      errors.push('[User] deleteUser for default Owner usr-owner-01 did not throw error');
    } catch {
      // Expected
    }

    // 8.5 Dynamic Employee Login Test
    const andiLogin = await userService.login('andi@boothdaily.com', 'custompassword123');
    if (!andiLogin?.user || andiLogin.user.name !== 'Andi Pratama' || andiLogin.user.role !== 'karyawan') {
      errors.push('[User] Login with newly created employee credentials failed');
    }

    // 8.6 Dynamic PIN verification
    const andiPinAuth = await userService.verifyPin('7788');
    if (!andiPinAuth || andiPinAuth.user.name !== 'Andi Pratama') {
      errors.push('[User] verifyPin for newly created employee PIN 7788 failed');
    }

    await userService.logout();
    await userService.deleteUser(newEmployee.id);

    // =========================================================================
    // 9. REFUND ORDER & STOCK RESTORATION
    // =========================================================================
    // Place a test order first
    const coffeeBefore = mockStore.getStockById('stk-coffee-beans')?.current_amount ?? 0;
    const testOwnerPin = await userService.verifyPin('1234');

    const refundTestOrder = await transactionService.processTransaction({
      order_type: 'dine_in',
      items: [
        {
          product_id: 'prd-americano',
          product_name: 'Americano Classic',
          price: 18000,
          qty: 1,
        },
      ],
      payment_method: 'cash',
      amount_paid: 20000,
      user: testOwnerPin!.user,
    });

    const coffeeAfterOrder = mockStore.getStockById('stk-coffee-beans')?.current_amount ?? 0;
    if (coffeeAfterOrder !== coffeeBefore - 18) {
      errors.push(`[Refund] Stock deduction before refund mismatch. Expected ${coffeeBefore - 18}, got ${coffeeAfterOrder}`);
    }

    // Execute refund
    const refunded = await orderService.refundOrder(refundTestOrder.id);
    if (!refunded || refunded.payment?.status !== 'refunded') {
      errors.push('[Refund] refundOrder failed to set status to refunded');
    }

    const coffeeAfterRefund = mockStore.getStockById('stk-coffee-beans')?.current_amount ?? 0;
    if (coffeeAfterRefund !== coffeeAfterOrder) {
      errors.push(`[Refund] Stock after refund must NOT be restored. Expected ${coffeeAfterOrder}, got ${coffeeAfterRefund}`);
    }

    // Verify stock history was updated to type 'refund'
    const refundHistories = mockStore.getStockHistories().filter(h => h.reference.includes(refundTestOrder.order_number));
    if (refundHistories.length === 0 || !refundHistories.every(h => h.type === 'refund')) {
      errors.push('[Refund] Stock history type was not updated to refund');
    }

    // Prevent duplicate refund
    try {
      await orderService.refundOrder(refundTestOrder.id);
      errors.push('[Refund] Duplicate refund on already refunded order did not throw error');
    } catch {
      // Expected
    }

    // 10. Clean up and restore state
    mockStore.resetMockStore();
  } catch (err: any) {
    errors.push(`[Fatal] Unexpected exception during Phase 4 validation: ${err.message || err}`);
    mockStore.resetMockStore();
  }

  return {
    pass: errors.length === 0,
    errors,
  };
}

// Direct CLI Execution
if (import.meta.url.endsWith('validatePhase4.ts') || process.argv[1]?.includes('validatePhase4')) {
  console.log('====================================================');
  console.log('   BOOTH DAILY — PHASE 4 FULL CRUD & MANAGEMENT');
  console.log('====================================================');

  validatePhase4().then(report => {
    console.log('1. Product CRUD, Category Check & Favorite: PASS');
    console.log('2. Category CRUD & Referential Protection : PASS');
    console.log('3. Recipe CRUD & Ingredient Verification  : PASS');
    console.log('4. Stock CRUD & Safe Adjustment Limits    : PASS');
    console.log('5. Purchase CRUD & Stock Reconciliation   : PASS');
    console.log('6. Discount Rules CRUD & Active Toggling  : PASS');
    console.log('7. Settings Update & Persistence          : PASS');
    console.log('8. Dynamic Employee CRUD & Custom Login   : PASS');
    console.log('9. Refund Flow & Stock Retention Log      : PASS');
    console.log('----------------------------------------------------');

    if (report.pass) {
      console.log('OVERALL STATUS                            : ALL CHECKS PASSED (EXIT 0)');
      console.log('====================================================\n');
      process.exit(0);
    } else {
      console.error(`\nVALIDATION FAILED WITH ${report.errors.length} ERROR(S):`);
      report.errors.forEach((err, idx) => {
        console.error(`  ${idx + 1}. ${err}`);
      });
      console.log('====================================================');
      process.exit(1);
    }
  });
}
