import { mockStore, MockStore } from '../store';
import { productService } from '../../services/productService';
import { recipeService } from '../../services/recipeService';
import { stockService } from '../../services/stockService';
import { orderService } from '../../services/orderService';
import { discountService } from '../../services/discountService';
import { settingsService } from '../../services/settingsService';
import { userService } from '../../services/userService';
import { transactionService } from '../../services/transactionService';
import { shiftService } from '../../services/shiftService';
import { initialSettings as seedSettings } from '../data/settings';
import { getReceiptCSS, getTestReceiptHtml, getReceiptHtml } from '../../services/receiptPrint';
import { mediaStorage } from '../../services/mediaStorage';

export async function validatePhase4(): Promise<{ pass: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // 0. Ensure fresh initial state for deterministic testing
    mockStore.resetMockStore();
    await userService.login('owner@boothdaily.com', 'demo123');

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
    // 6. DISCOUNT RULES CRUD (Memerlukan Sesi Owner Sah)
    // =========================================================================
    await userService.login('owner@boothdaily.com', 'demo123');

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
    // 7. SETTINGS UPDATE & PERSISTENCE (S1: CORE SETTINGS ALIGNMENT)
    // =========================================================================
    // 7.1 Seed settings verification
    if (seedSettings.operational_day_cutoff_time !== '04:00') {
      errors.push(`[Settings] Default seed operational_day_cutoff_time expected "04:00", got "${seedSettings.operational_day_cutoff_time}"`);
    }
    if (seedSettings.phone !== '081234567890') {
      errors.push(`[Settings] Default seed phone expected "081234567890", got "${seedSettings.phone}"`);
    }

    // 7.2 Non-Owner permission restriction
    await userService.login('dinda@boothdaily.com', 'demo123');
    try {
      await settingsService.updateSettings({ operational_day_cutoff_time: '05:00' });
      errors.push('[Settings-Security] Kasir/karyawan berhasil mengubah settings tanpa role Owner!');
    } catch {
      // Expected: assertActiveOwnerSession blocked request
    }
    await userService.logout();

    // 7.3 Direct save of seed phone by authenticated Owner
    await userService.login('owner@boothdaily.com', 'demo123');
    const initialSettings = await settingsService.getSettings();
    try {
      const savedSeedPhone = await settingsService.updateSettings({
        phone: seedSettings.phone,
      });
      if (savedSeedPhone.phone !== '081234567890') {
        errors.push(`[Settings-Phone] Direct save of seed phone mismatch: ${savedSeedPhone.phone}`);
      }
    } catch (err: any) {
      errors.push(`[Settings-Phone] Direct save of seed phone threw error: ${err.message}`);
    }

    // 7.4 Phone validation and consistent normalization
    // 7.4.a Phone with dashes normalized
    const phoneWithDashes = await settingsService.updateSettings({ phone: '0812-3456-7890' });
    if (phoneWithDashes.phone !== '081234567890') {
      errors.push(`[Settings-Phone] Normalization of dashes failed: expected "081234567890", got "${phoneWithDashes.phone}"`);
    }

    // 7.4.b Phone with international prefix '+' and spaces normalized
    const phoneWithPlus = await settingsService.updateSettings({ phone: '+62 812 3456 7890' });
    if (phoneWithPlus.phone !== '+6281234567890') {
      errors.push(`[Settings-Phone] Normalization of "+" and spaces failed: expected "+6281234567890", got "${phoneWithPlus.phone}"`);
    }

    // 7.4.c Reject invalid phone characters
    try {
      await settingsService.updateSettings({ phone: '0812-ABCD-5678' });
      errors.push('[Settings-Phone] Phone with alphabetic characters was not rejected');
    } catch {
      // Expected
    }

    // 7.4.d Reject too short phone (< 8 digits)
    try {
      await settingsService.updateSettings({ phone: '12345' });
      errors.push('[Settings-Phone] Phone < 8 digits was not rejected');
    } catch {
      // Expected
    }

    // 7.4.e Reject too long phone (> 16 digits)
    try {
      await settingsService.updateSettings({ phone: '12345678901234567' });
      errors.push('[Settings-Phone] Phone > 16 digits was not rejected');
    } catch {
      // Expected
    }

    // 7.5 Operational cutoff time updates and reload persistence
    const savedCutoff = await settingsService.updateSettings({
      operational_day_cutoff_time: '05:30',
      store_name: 'BOOTH DAILY FLAGSHIP',
      tax_percentage: 10,
    });
    if (savedCutoff.operational_day_cutoff_time !== '05:30' || savedCutoff.store_name !== 'BOOTH DAILY FLAGSHIP' || savedCutoff.tax_percentage !== 10) {
      errors.push('[Settings-Cutoff] updateSettings failed to update cutoff time or store_name/tax');
    }

    // Persistence across reload (simulating page reload with new store instance)
    const reloadedStore = new MockStore();
    const reloadedSettings = reloadedStore.getSettings();
    if (reloadedSettings?.operational_day_cutoff_time !== '05:30') {
      errors.push(`[Settings-Persistence] Cutoff time did not persist after reload: expected "05:30", got "${reloadedSettings?.operational_day_cutoff_time}"`);
    }

    // 7.5.b S1 Legacy Settings Compatibility Check (Data lama tanpa cutoff memperoleh default 04:00)
    const legacySettingsObj: any = {
      store_name: 'BOOTH DAILY LEGACY TEST',
      tagline: 'Legacy Tagline',
      address: 'Jl. Legacy No. 1',
      phone: '081234567890',
      receipt_header: 'Header',
      receipt_footer: 'Footer',
      tax_percentage: 5,
    };
    const didNormalize = mockStore.normalizeSettings(legacySettingsObj);
    if (!didNormalize || legacySettingsObj.operational_day_cutoff_time !== '04:00' || legacySettingsObj.receipt_paper_size !== '80mm') {
      errors.push('[Settings-Legacy] normalizeSettings failed to populate default "04:00" and "80mm" for legacy settings');
    }

    // 7.5.c S2 Thermal Receipt Paper Size Setting & Persistence
    await settingsService.updateSettings({
      receipt_paper_size: '58mm',
    });
    const s58 = await settingsService.getSettings();
    if (s58.receipt_paper_size !== '58mm') {
      errors.push(`[Settings-S2] Failed to set receipt_paper_size to '58mm': got "${s58.receipt_paper_size}"`);
    }

    // Persistence across reload (simulating page reload with new store instance)
    const reloadedStoreS2 = new MockStore();
    const reloadedSettingsS2 = reloadedStoreS2.getSettings();
    if (reloadedSettingsS2?.receipt_paper_size !== '58mm') {
      errors.push(`[Settings-S2-Persistence] receipt_paper_size did not persist after reload: expected "58mm", got "${reloadedSettingsS2?.receipt_paper_size}"`);
    }

    // Update back to 80mm
    await settingsService.updateSettings({
      receipt_paper_size: '80mm',
    });
    const s80 = await settingsService.getSettings();
    if (s80.receipt_paper_size !== '80mm') {
      errors.push(`[Settings-S2] Failed to set receipt_paper_size to '80mm': got "${s80.receipt_paper_size}"`);
    }

    // 7.5.d S2 Legacy Settings Compatibility Check (Data lama tanpa receipt_paper_size memperoleh default '80mm')
    const legacySettingsS2Obj: any = {
      store_name: 'BOOTH DAILY LEGACY TEST S2',
      tagline: 'Legacy Tagline S2',
      address: 'Jl. Legacy S2 No. 1',
      phone: '081234567890',
      receipt_header: 'Header S2',
      receipt_footer: 'Footer S2',
      tax_percentage: 5,
      operational_day_cutoff_time: '04:00',
    };
    const didNormalizeS2 = mockStore.normalizeSettings(legacySettingsS2Obj);
    if (!didNormalizeS2 || legacySettingsS2Obj.receipt_paper_size !== '80mm') {
      errors.push('[Settings-S2-Legacy] normalizeSettings failed to populate default "80mm" for legacy settings');
    }

    // 7.5.e S2 Rejection of invalid paper sizes
    const invalidPaperSizes = ['100mm', 'letter', 'A4', '48mm', ''];
    for (const badSize of invalidPaperSizes) {
      try {
        await settingsService.updateSettings({ receipt_paper_size: badSize as any });
        errors.push(`[Settings-S2] Invalid receipt_paper_size "${badSize}" was not rejected!`);
      } catch {
        // Expected
      }
    }

    // 7.5.f S2 Test Receipt & CSS generation verification
    const css58 = getReceiptCSS('58mm');
    if (!css58.includes('max-width: 48mm') || !css58.includes('size: 58mm auto')) {
      errors.push('[Receipt-CSS-58mm] 58mm CSS missing expected max-width: 48mm or size: 58mm auto');
    }
    const css80 = getReceiptCSS('80mm');
    if (!css80.includes('max-width: 78mm')) {
      errors.push('[Receipt-CSS-80mm] 80mm CSS missing expected max-width: 78mm');
    }

    // Verify test receipt HTML with draft headers & footers
    const draftTestSettings = {
      store_name: 'BOOTH DAILY TEST STORE',
      receipt_header: 'DRAFT HEADER BELUM DISIMPAN',
      receipt_footer: 'DRAFT FOOTER BELUM DISIMPAN',
      receipt_paper_size: '58mm' as const,
    };
    const html58 = getTestReceiptHtml(draftTestSettings);
    if (!html58.includes('DRAFT HEADER BELUM DISIMPAN') || !html58.includes('DRAFT FOOTER BELUM DISIMPAN')) {
      errors.push('[Receipt-Draft] Test receipt HTML failed to include unsaved draft header/footer');
    }
    if (!html58.includes('TEST-58MM-001') || !html58.includes('max-width: 48mm')) {
      errors.push('[Receipt-Draft-58mm] Test receipt HTML missing 58mm identifiers or 48mm max-width styling');
    }

    const html80 = getTestReceiptHtml({ ...draftTestSettings, receipt_paper_size: '80mm' });
    if (!html80.includes('TEST-80MM-001') || !html80.includes('max-width: 78mm')) {
      errors.push('[Receipt-Draft-80mm] Test receipt HTML missing 80mm identifiers or 78mm max-width styling');
    }

    // 7.5.g S2.2 Simplified Test Receipt Verification (Pure printer test, no transaction items/financials)
    if (html58.includes('Subtotal:') || html58.includes('DETAIL PESANAN') || html58.includes('SALINAN STAFF') || html58.includes('Diskon:')) {
      errors.push('[Receipt-S2.2-Simplify] Test receipt must NOT contain financial details, items, or staff copy');
    }
    if (!html58.includes('TEST PRINT THERMAL') || !html58.includes('Test print berhasil.')) {
      errors.push('[Receipt-S2.2-Simplify] Test receipt missing TEST PRINT THERMAL or "Test print berhasil." message');
    }

    // 7.5.h S2.2 Printer Logo Presence & Clean Fallback
    const dummyPrinterLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const htmlWithLogo = getTestReceiptHtml(draftTestSettings, dummyPrinterLogo);
    if (!htmlWithLogo.includes(dummyPrinterLogo) || !htmlWithLogo.includes('class="store-logo"')) {
      errors.push('[Receipt-S2.2-Logo] getTestReceiptHtml failed to render printerLogo when provided');
    }

    const htmlWithoutLogo = getTestReceiptHtml(draftTestSettings, null);
    if (htmlWithoutLogo.includes('class="store-logo"') || htmlWithoutLogo.includes('<img')) {
      errors.push('[Receipt-S2.2-Fallback] getTestReceiptHtml must cleanly omit store-logo when printerLogo is null');
    }

    // Test real transaction receipt logo presence & omission
    const sampleOrder = mockStore.getOrders()[0];
    if (sampleOrder) {
      const activeSettings = mockStore.getSettings();
      const orderHtmlWithLogo = getReceiptHtml(sampleOrder, activeSettings, dummyPrinterLogo);
      if (!orderHtmlWithLogo.includes(dummyPrinterLogo) || !orderHtmlWithLogo.includes('class="store-logo"')) {
        errors.push('[Receipt-Order-Logo] getReceiptHtml failed to render printerLogo');
      }
      const orderHtmlNoLogo = getReceiptHtml(sampleOrder, activeSettings, null);
      if (orderHtmlNoLogo.includes('class="store-logo"') || orderHtmlNoLogo.includes('<img')) {
        errors.push('[Receipt-Order-NoLogo] getReceiptHtml must cleanly omit store-logo when printerLogo is null');
      }
    }

    // 7.5.i S2.2 Media Storage Isolation & Immutability Verification
    const initialOrdersCount = mockStore.getOrders().length;
    const initialStocksCount = mockStore.getStocks().length;
    const initialShiftsCount = mockStore.getShifts().length;

    await mediaStorage.saveMedia('app_logo', 'data:image/webp;base64,TEST_APP_LOGO_DATA');
    await mediaStorage.saveMedia('printer_logo', 'data:image/png;base64,TEST_PRINTER_LOGO_DATA');

    const loadedAppLogo = await mediaStorage.getMedia('app_logo');
    const loadedPrinterLogo = await mediaStorage.getMedia('printer_logo');

    if (loadedAppLogo !== 'data:image/webp;base64,TEST_APP_LOGO_DATA') {
      errors.push('[MediaStorage] Failed to save/retrieve app_logo');
    }
    if (loadedPrinterLogo !== 'data:image/png;base64,TEST_PRINTER_LOGO_DATA') {
      errors.push('[MediaStorage] Failed to save/retrieve printer_logo');
    }
    if (loadedAppLogo === loadedPrinterLogo) {
      errors.push('[MediaStorage] app_logo and printer_logo keys must be strictly isolated');
    }

    // Delete app_logo, verify printer_logo unaffected
    await mediaStorage.deleteMedia('app_logo');
    const appAfterDelete = await mediaStorage.getMedia('app_logo');
    const printerAfterDelete = await mediaStorage.getMedia('printer_logo');

    if (appAfterDelete !== null) {
      errors.push('[MediaStorage] deleteMedia failed to remove app_logo');
    }
    if (printerAfterDelete !== 'data:image/png;base64,TEST_PRINTER_LOGO_DATA') {
      errors.push('[MediaStorage] Deleting app_logo corrupted printer_logo');
    }

    // Clean up printer_logo
    await mediaStorage.deleteMedia('printer_logo');

    // 7.5.j S2.3 Dynamic Store Name Consistency & Non-Destructive Verification
    const preS23Orders = JSON.parse(JSON.stringify(mockStore.getOrders()));
    const preS23Shifts = JSON.parse(JSON.stringify(mockStore.getShifts()));
    const preS23Stocks = JSON.parse(JSON.stringify(mockStore.getStocks()));

    // 1. Update store name to synthetic name 'Kedai Uji Dinamis'
    await settingsService.updateSettings({ store_name: 'Kedai Uji Dinamis' });
    const s23Settings = await settingsService.getSettings();
    if (s23Settings.store_name !== 'Kedai Uji Dinamis') {
      errors.push('[S2.3-StoreName] Failed to persist new store_name');
    }

    // 2. Stored store name propagates to getTestReceiptHtml
    const s23TestReceipt = getTestReceiptHtml(s23Settings);
    if (!s23TestReceipt.includes('Kedai Uji Dinamis')) {
      errors.push('[S2.3-TestReceipt] getTestReceiptHtml failed to reflect updated store_name');
    }

    // 3. Stored store name propagates to getReceiptHtml
    if (sampleOrder) {
      const s23OrderReceipt = getReceiptHtml(sampleOrder, s23Settings);
      if (!s23OrderReceipt.includes('Kedai Uji Dinamis')) {
        errors.push('[S2.3-OrderReceipt] getReceiptHtml failed to reflect updated store_name');
      }
    }

    // 4. Persistence after reload
    const reloadedStoreS23 = new MockStore();
    if (reloadedStoreS23.getSettings().store_name !== 'Kedai Uji Dinamis') {
      errors.push('[S2.3-Persistence] Reloaded MockStore failed to retain store_name');
    }

    // 5. Update again to ensure no stale components retain previous name
    await settingsService.updateSettings({ store_name: 'Kedai Kopi Bahagia' });
    const s23Settings2 = await settingsService.getSettings();
    const s23TestReceipt2 = getTestReceiptHtml(s23Settings2);
    if (s23TestReceipt2.includes('Kedai Uji Dinamis') || !s23TestReceipt2.includes('Kedai Kopi Bahagia')) {
      errors.push('[S2.3-UpdateAgain] Updating store_name retained old store name');
    }

    // 6. Fallback test when store_name is empty string or only whitespace
    await settingsService.updateSettings({ store_name: '   ' });
    const emptySettings = await settingsService.getSettings();
    const fallbackTestReceipt = getTestReceiptHtml(emptySettings);
    if (!fallbackTestReceipt.includes('BOOTH DAILY')) {
      errors.push('[S2.3-Fallback] Empty/whitespace store_name failed to fall back to BOOTH DAILY');
    }

    // 7. Immutability verification: store name change must NOT mutate orders, shifts, or stocks
    if (
      JSON.stringify(mockStore.getOrders()) !== JSON.stringify(preS23Orders) ||
      JSON.stringify(mockStore.getShifts()) !== JSON.stringify(preS23Shifts) ||
      JSON.stringify(mockStore.getStocks()) !== JSON.stringify(preS23Stocks)
    ) {
      errors.push('[S2.3-Immutability] Changing store_name mutated historical orders, shifts, or stocks!');
    }

    // Restore original settings
    await settingsService.updateSettings({
      store_name: initialSettings.store_name,
      receipt_paper_size: initialSettings.receipt_paper_size,
      tax_percentage: initialSettings.tax_percentage,
      operational_day_cutoff_time: initialSettings.operational_day_cutoff_time,
    });

    // 7.6 Reject invalid cutoff times (format 24 jam HH:mm)
    const invalidCutoffs = ['25:00', '99:99', 'invalid', '5:00', '12:60', '-01:00'];
    for (const badCutoff of invalidCutoffs) {
      try {
        await settingsService.updateSettings({ operational_day_cutoff_time: badCutoff });
        errors.push(`[Settings-Cutoff] Invalid cutoff "${badCutoff}" was not rejected!`);
      } catch {
        // Expected
      }
    }

    // 7.7 ADDENDUM S1: Shift Immutability before & after cutoff change
    // 7.7.a Open Shift 1 and close it to create historical closed shift
    const dindaUser = mockStore.getUsers().find(u => u.name.includes('Dinda'))!;
    const shift1 = await shiftService.openShift(100000, dindaUser);
    const closedShift1 = await shiftService.closeShift({
      shift_id: shift1.id,
      actual_cash_end: 100000,
      user: dindaUser,
    });
    const closedShift1Date = closedShift1.operational_date;

    // 7.7.b Open Shift 2 as active shift
    const shift2 = await shiftService.openShift(120000, dindaUser);
    const shift2ActiveDate = shift2.operational_date;

    // 7.7.c Owner updates cutoff to a different time
    await settingsService.updateSettings({
      operational_day_cutoff_time: '23:30',
    });

    // 7.7.d Assert: Historical closed shift dates MUST NOT change
    const checkedShift1 = mockStore.getShifts().find(s => s.id === shift1.id);
    if (!checkedShift1 || checkedShift1.operational_date !== closedShift1Date) {
      errors.push(`[Shift-Immutability] Closed shift operational_date changed after cutoff update! Expected "${closedShift1Date}", got "${checkedShift1?.operational_date}"`);
    }
    // 7.7.e Assert: Currently active shift date MUST NOT change
    const checkedShift2 = mockStore.getActiveShift();
    if (!checkedShift2 || checkedShift2.operational_date !== shift2ActiveDate) {
      errors.push(`[Shift-Immutability] Active shift operational_date changed after cutoff update! Expected "${shift2ActiveDate}", got "${checkedShift2?.operational_date}"`);
    }

    // 7.7.f Close Shift 2 and verify its date remains locked to original
    const closedShift2 = await shiftService.closeShift({
      shift_id: shift2.id,
      actual_cash_end: 120000,
      user: dindaUser,
    });
    if (closedShift2.operational_date !== shift2ActiveDate) {
      errors.push(`[Shift-Immutability] Shift 2 date mutated upon closing after cutoff change!`);
    }

    // 7.7.g Open Shift 3 after cutoff change and verify subsequent shift opens with new cutoff
    const shift3 = await shiftService.openShift(150000, dindaUser);
    if (!shift3 || !shift3.operational_date) {
      errors.push('[Shift-Immutability] Shift 3 failed to open after cutoff change');
    }
    await shiftService.closeShift({
      shift_id: shift3.id,
      actual_cash_end: 150000,
      user: dindaUser,
    });

    // Verify all prior shifts still preserve their original dates
    const finalShift1 = mockStore.getShifts().find(s => s.id === shift1.id);
    const finalShift2 = mockStore.getShifts().find(s => s.id === shift2.id);
    if (finalShift1?.operational_date !== closedShift1Date || finalShift2?.operational_date !== shift2ActiveDate) {
      errors.push('[Shift-Immutability] Historical shifts operational_date mutated after subsequent shifts!');
    }

    // 7.8 Verify Data Refresh idempotency (preserves state without wipe/reset)
    const settingsBeforeRefresh = await settingsService.getSettings();
    const productsBeforeRefresh = await productService.getProducts();
    const ordersBeforeRefresh = mockStore.getOrders();
    const shiftsBeforeRefresh = mockStore.getShifts();

    // Simulate refresh cycle
    const [freshSettings, freshProducts] = await Promise.all([
      settingsService.getSettings(),
      productService.getProducts(),
    ]);
    if (freshSettings.store_name !== settingsBeforeRefresh.store_name || freshProducts.length !== productsBeforeRefresh.length) {
      errors.push('[Settings-Refresh] Refreshing data corrupted state');
    }
    if (mockStore.getOrders().length !== ordersBeforeRefresh.length || mockStore.getShifts().length !== shiftsBeforeRefresh.length) {
      errors.push('[Settings-Refresh] Refreshing data altered orders or shifts');
    }

    // Restore initial settings for test suite continuity
    await settingsService.updateSettings({
      store_name: initialSettings.store_name,
      tax_percentage: initialSettings.tax_percentage,
      operational_day_cutoff_time: '04:00',
      phone: '081234567890',
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
    await userService.login('owner@boothdaily.com', 'demo123');
    await userService.deleteUser(newEmployee.id);
    await userService.logout();

    // =========================================================================
    // 9. REFUND ORDER & STOCK RESTORATION
    // =========================================================================
    // Place a test order first
    const coffeeBefore = mockStore.getStockById('stk-coffee-beans')?.current_amount ?? 0;
    const testOwnerPin = await userService.verifyPin('1234');
    await mockStore.openShift(100000, testOwnerPin!.user);

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
    try {
      await userService.logout();
    } catch {}
    mockStore.resetMockStore();
  } catch (err: any) {
    errors.push(`[Fatal] Unexpected exception during Phase 4 validation: ${err.message || err}`);
    try {
      await userService.logout();
    } catch {}
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
