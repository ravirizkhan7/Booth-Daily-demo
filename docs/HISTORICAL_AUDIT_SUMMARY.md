# Booth Daily Demo — Historical Engineering & Audit Summary

> **Document Type:** Project Engineering Log & Consolidated Audit Summary  
> **Repository:** Booth Daily Demo (`pos-demo-web`)  
> **Status:** Production-Ready Portfolio Release  
> **Architecture:** Standalone Client-Side Single Page Application (React 18 + TypeScript + Vite + Tailwind CSS)

---

## 1. Executive Summary

**Booth Daily Demo** is an enterprise-grade Point of Sale (POS) and inventory management prototype tailored for specialty coffee shops and F&B retail operations. Built as a fully autonomous client-side application, it provides complete cashier workflows, recipe-based inventory depletion, shift reconciliation, real-time reporting, and encrypted backup/restore capabilities without requiring a live backend service.

This document consolidates key architectural decisions, feature evolution phases, validation methodologies, and security models established during the engineering lifecycle.

---

## 2. Architecture & Technical Foundations

### 2.1 Zero-Backend In-Memory Reactive Store
- **Store Architecture (`src/mock/store.ts`):** Centralized reactive state store managing products, categories, transactions, shifts, inventory items, purchase orders, operational settings, and audit logs.
- **Persistence Layer (`src/mock/persistence/storage.ts`):** Multi-entity local persistence backed by browser `localStorage` under the storage key `boothdaily_demo_store`. Changes are debounced and committed atomically to maintain state integrity across reloads.
- **Dynamic Seeding:** Automatic hydration with realistic coffee shop operational data (menus, ingredients, historical shifts, transactions) on first initialization, with one-click factory reset.

### 2.2 Recipe-Driven Inventory & Cost Accounting
- **Atomic Stock Deductions:** Products map to composite recipes consisting of multiple raw inventory ingredients (e.g., espresso beans, fresh milk, syrup, paper cups). POS order completion automatically decrements ingredient stock quantities in atomic batches.
- **Rolling Weighted Average HPP (COGS):** Inventory purchases calculate Cost of Goods Sold (Harga Pokok Penjualan) dynamically based on incoming purchase batch costs and quantities.
- **Stock Depletion Guards:** Real-time stock badge alerts (`out_of_stock`, `low_stock`) and POS checkout guards prevent negative inventory states.

### 2.3 Cryptographic Backup & Restore Subsystem
- **Standard Web Crypto API:** Client-side encryption engine (`src/services/backupService.ts`) utilizing industry-standard AES-GCM (256-bit key length) paired with PBKDF2 key derivation (100,000 iterations, SHA-256) and cryptographically secure random salt/IV generation.
- **Integrity Verification:** Encrypted export bundles include SHA-256 HMAC digest verification ensuring tamper-detection prior to deserialization and state restoration.

---

## 3. Engineering Evolution & Key Milestones

### Phase 1 & 2: Core POS & Inventory Framework
- Initialized POS transaction pipeline supporting multiple payment methods (Cash, QRIS, Debit/Card, Split Payment).
- Implemented inventory catalog, stock tracking, and supplier purchase order workflows.
- Built responsive cashier cart with real-time tax, service charge, and discount calculations.

### Phase 3: Operational Workflows & Shift Management
- **Shift Accounting:** Comprehensive shift lifecycle management (Open Shift with petty cash float, midday disbursements, and End Shift reconciliation).
- **Cashier Disbursements:** Controlled cash disbursements during active shifts with categorization, notes, and strict balance deductions from physical cash drawer totals.
- **Supervisor PIN Security:** Modal authorization guards for sensitive operational actions (void transactions, refunds, custom discounts, and shift closures).

### Phase 4: Discounts, Refunds, and Financial Reconciliation
- **VIP Room & Dine-In/Takeaway Logic:** Support for specialized room discounts and takeaway surcharge/discount behaviors, complete with automatic cart resets when switching order types.
- **Refund Subsystem (`src/services/refundService.ts`):** Full transaction refund lifecycle with inventory restocking options, financial adjustment logging, and original receipt cross-referencing.
- **Reporting Engine:** Real-time financial reports, revenue breakdowns, product profitability metrics, operational hour cutoffs, and exportable statements (Excel `.xlsx` and PDF).

### Watermark & Receipt Rendering Subsystem
- Modularized receipt canvas generation into dedicated watermark utilities (`src/mock/watermark/`), decoupling visual receipt styling from modal UI components.
- Standardized thermal paper receipt simulation (58mm/80mm layouts) with barcode generation, transaction metadata, and printable CSS rules.

### Settings UI & Responsive UX Refinement
- **Normalized Input Controls (`src/components/common/NumberInput.tsx`):** Standardized currency and numeric inputs with locale-aware thousand separators and instant raw value bindings.
- **Settings Architecture:** Refactored business profile, tax rates, payment gateway credentials, discount rules, and data management into unified responsive tabbed panels.
- **InfoPopover UX Optimization:** Removed unintended entrance transitions, eliminated content-switching flicker, implemented outside scroll-dismissal, and enabled smooth mobile scroll chaining.
- **Global Breakpoint Compliance:** Hardened layout responsiveness across five standard screen viewports (360px mobile, 375px mobile, 768px tablet portrait, 1024px tablet landscape, and 1440px desktop).

---

## 4. Verification Framework & Automated Suites

The codebase includes 27 programmatic validation suites in `src/mock/validation/` designed to verify critical business logic and state transitions in CI/CD and build pipelines:

1. `validateCartState.ts` — Verifies cart calculations, line item discounts, and tax application.
2. `validateCashDisbursement.ts` — Verifies petty cash drawer deductions and shift balance tracking.
3. `validateCashierDisbursement.ts` — Ensures role-based authorization for cashier petty cash disbursements.
4. `validateClosingShiftReconciliation.ts` — Validates cash drawer expected vs actual reconciliation.
5. `validateCompositeRecipes.ts` — Ensures composite ingredient deductions match product BOM specifications.
6. `validateCustomerFeedbackFlow.ts` — Checks order review and rating persistence.
7. `validateDailyRevenueCalculation.ts` — Verifies end-of-day revenue, net margin, and expense aggregation.
8. `validateDiscountRules.ts` — Validates rule priorities, minimum order quantities, and date validity.
9. `validateDynamicPricing.ts` — Verifies tiered pricing and time-based promotional overrides.
10. `validateEnhancedSecurityRoleAuth.ts` — Tests RBAC permissions across Owner, Manager, and Cashier roles.
11. `validateExpenseTracking.ts` — Validates operational expense categorization and balance impacts.
12. `validateHPPHelpers.ts` — Confirms weighted average HPP and profit margin formulas.
13. `validateIngredientLevelAlerts.ts` — Checks threshold-based ingredient reorder warning triggers.
14. `validateInventoryStockIntegrity.ts` — Validates stock consistency under concurrent order decrements.
15. `validateKitchenDisplaySystemSync.ts` — Tests KDS order status synchronization and ticket generation.
16. `validateLegacyRefundHardening.ts` — Validates backward compatibility for historical refund schemas.
17. `validateLegacyVIPDiscountDeprecation.ts` — Ensures smooth migration of legacy VIP discount models.
18. `validateMultiPaymentProcessing.ts` — Validates multi-tender transactions and exact change math.
19. `validateNumberInputFormatting.ts` — Verifies currency formatting, paste sanitation, and boundary handling.
20. `validateOperationalCutoff.ts` — Tests operational day boundaries spanning past midnight.
21. `validatePromotionRules.ts` — Validates bundle deals, BOGO logic, and maximum discount caps.
22. `validatePurchaseOrderWorkflow.ts` — Verifies purchase order lifecycles and inventory receipt updates.
23. `validateReceiptGeneration.ts` — Checks receipt line items, tax disclosures, and invoice numbers.
24. `validateRefundWorkflow.ts` — Validates refund ledger entries, inventory returns, and audit notes.
25. `validateReportUserFilter.ts` — Ensures cashier/user filtering in financial summaries functions accurately.
26. `validateSettingsUXRefinement.ts` — Validates settings state persistence and validation guards.
27. `validateVIPAndReportSettings.ts` — Tests VIP tier discount calculations and report alignment.

---

## 5. Security Model & Prototype Boundaries

As a client-side demonstration prototype, the application operates under specific deliberate boundaries:

- **Client Storage Isolation:** All application state resides inside the browser's `localStorage`. Data does not leave the client device unless exported explicitly via encrypted backup.
- **Demo Authentication:** Hardcoded demo personas (`owner`, `manager`, `cashier`) with fixed test credentials are provided for friction-free evaluation. In a production enterprise deployment, authentication would integrate with an OAuth2/OIDC identity provider.
- **Simulated Payment Gateways:** Payment integrations (QRIS dynamic QR codes, EDC card transactions) simulate instantaneous authorization hooks suitable for demo environments without live payment gateway contracts.
- **Supervisor PIN Authorization:** Sensitive actions use an in-app supervisor PIN workflow. In a multi-terminal production system, PIN hashes would be validated by a remote auth service.

