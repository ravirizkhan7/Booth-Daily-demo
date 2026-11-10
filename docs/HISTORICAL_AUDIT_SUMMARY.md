# Booth Daily Demo — Historical Engineering & Audit Reference

> **Document Type:** Project Engineering Log & Consolidated Architecture Reference  
> **Repository:** Booth Daily Demo (`booth_daily`)  
> **Project Status:** Portfolio Demo / Engineering Reference  
> **Architecture:** Standalone Client-Side Single Page Application (React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4)

---

## 1. Project Overview

**Booth Daily Demo** is an interactive Point of Sale (POS) and coffee shop management prototype designed to showcase modern front-end architecture, domain-driven service modularity, and operational business logic directly in the browser.

The project operates entirely client-side without requiring a live backend server, external relational database, or persistent network connection. It demonstrates end-to-end retail coffee shop workflows—including cashier order entry, recipe-based raw ingredient depletion, shift accounting with petty cash controls, multi-step transaction refunds, dynamic report generation, and encrypted backup export/import.

This document serves as an engineering reference recording the architectural patterns, feature evolution milestones, automated validation suites, and technical boundaries established throughout the project lifecycle.

---

## 2. Architecture & Technical Foundations

### 2.1 Centralized Reactive Mock Store
- **Store Core (`src/mock/store.ts`):** Central in-memory repository managing normalized state collections for products, categories, ingredients, purchase orders, transactions, shifts, settings, and audit logs.
- **Reactive Subscriptions:** View components subscribe to store changes, triggering UI re-renders upon state mutations without full-page reloads.
- **External Stub Isolation:** Safe client-side stubs for Laravel Echo, Pusher, and WebSockets ensure graceful execution in offline environments without throwing network connection errors.

### 2.2 Client-Side Persistence
- **Storage Driver (`src/mock/persistence/storage.ts`):** State is serialized to browser `localStorage` under the key `boothdaily_demo_store`.
- **Persistence Boundary:** State persistence relies on JSON serialization of the store snapshot upon mutation. It is not an ACID-compliant transactional database and does not provide write-ahead logging, row-level locking, or distributed commit guarantees.
- **Hydration & Factory Reset:** On first launch, the store automatically hydrates with realistic coffee shop operational seed data. An Owner-authorized Factory Reset utility is available in Settings to restore the database to its pristine seed state.

---

## 3. Core Business Workflows

### 3.1 POS Terminal & Order Processing
- **Menu Navigation:** Horizontal category filtering, instant text search, and visual stock availability badges (`out_of_stock`, `low_stock`).
- **Cart Management:** Order type selection (Dine-In vs. Take-Away) with automatic promotional recalculation, customizable item notes (e.g., sugar level, ice preference), and real-time tax/service fee computations.
- **Tender Options:** Cash transactions with instant change calculation, and simulated dynamic QRIS payment processing.

### 3.2 Recipe-Driven Inventory & Cost Accounting
- **Bill of Materials (BOM) Depletion:** Finished products map to ingredient recipes (e.g., espresso beans in grams, fresh milk in milliliters, paper cups in units). Order completion deducts raw ingredient stock quantities in atomic memory operations.
- **Weighted Average Cost (WAC / HPP):** Supplier purchase receipts restock raw materials and dynamically adjust the ingredient Cost of Goods Sold (Harga Pokok Penjualan) using weighted average cost formulas based on incoming batch quantities and unit prices.
- **Stock Depletion Guards:** Real-time stock availability checks prevent checking out items whose required raw ingredients are depleted.

### 3.3 Cashier Shift Lifecycle & Petty Cash Drawer
- **Shift Accounting:** Cashiers open shifts with a declared physical cash float. All cash sales automatically increment expected drawer totals.
- **Midday Disbursements:** Cashiers can record operational expenses (petty cash disbursements) with strict categorization, remarks, and immediate deduction from expected drawer cash.
- **End-Shift Reconciliation:** Closing cashiers enter physical cash counts, and the system evaluates cash overage/shortage alongside a dedicated QRIS status audit (`no_transaction`, `matched`, `unreconciled`).

### 3.4 Transaction Refund Lifecycle
- **Two-Step Authorization:** Cashiers initiate refund requests with mandatory reason codes and PIN authorization; final processing requires an Owner/Manager PIN approval.
- **Inventory Restocking:** Approved refunds support optional restocking of depleted recipe ingredients back to active inventory.
- **Audit Logging:** Every refund creates a linked audit trail cross-referencing original receipt identifiers and disbursement notes.

### 3.5 Reporting & Document Generation
- **Operational Metrics:** Real-time calculation of gross revenue, net margin, total discounts, tax liabilities, and cash vs. non-cash splits.
- **Timezone-Aware Operational Cutoffs:** Shift and transaction aggregations support operational day boundaries (e.g., 04:00 AM cutoff) to accurately group late-night shifts.
- **Client-Side Export:** Direct browser generation of formatted spreadsheet workbooks (`.xlsx` via SheetJS) and printable thermal receipts and financial statements (`.pdf` via jsPDF and jsPDF-AutoTable).

---

## 4. Engineering Milestones

### Milestone 1 — Core Store Architecture & POS Foundations
- Established in-memory reactive store structure and repository contracts.
- Built core cashier terminal with responsive product grid and category filtering.
- Implemented basic shopping cart math, tax calculations, and cash change logic.

### Milestone 2 — Shift Operations & Cash Drawer Reconciliation
- Implemented full shift lifecycle (opening float, midday disbursements, and shift closure).
- Built cash reconciliation comparing expected vs. actual drawer counts.
- Created dedicated QRIS status tracking and discrepancy reporting.

### Milestone 3 — Inventory Accounting & HPP Calculation Engine
- Integrated recipe-based ingredient depletion for composite beverage products.
- Engineered Weighted Average Cost (WAC) calculations for incoming supplier purchase orders.
- Implemented unit conversion helpers (e.g., kilograms to grams, liters to milliliters) and rounding policies.

### Milestone 4 — Multi-Step Refund Subsystem & Role Hardening
- Designed dedicated refund request and approval modals (`src/components/transactions/`).
- Deprecated legacy hardcoded VIP discount percentages in favor of unified promo rule evaluation.
- Added role-based session isolation between Cashier and Owner workflows.

### Milestone 5 — Responsive UI & Settings Optimization
- Hardened responsive layout across five standard viewports: 360px mobile, 375px mobile, 768px tablet portrait, 1024px tablet landscape, and 1440px desktop.
- Standardized currency input formatting and boundary validation via `NumberInput.tsx`.
- Refactored `InfoPopover`: removed unintended entrance animations, eliminated content switching flicker, added outside-scroll dismissal, and enabled mobile list scroll chaining.

### Milestone 6 — Watermark & Thermal Receipt Subsystem Decoupling
- Extracted and modularized receipt watermark rendering into dedicated utilities (`src/mock/watermark/`).
- Decoupled canvas generation logic from modal presentation components.
- Standardized 58mm and 80mm thermal receipt layouts with barcode simulation.

---

## 5. Validation & Quality Assurance

### 5.1 Programmatic Validation Framework
The project includes **27 automated validation suites** located in `src/mock/validation/`. These suites are executed locally using `tsx` or Node (`npm run validate:*`) to verify state transitions, financial formulas, and regression safety.

> **Note:** These suites represent locally executed programmatic scripts for developer verification; there is currently no automated CI/CD pipeline configured.

| # | Validator File | Scope & Responsibility |
| :-: | :--- | :--- |
| 1 | `validateBackupRestore.ts` | Validates AES-GCM 256-bit encryption, PBKDF2 (600,000 iterations), zero plaintext leak, relational integrity, and restore journal rollback. |
| 2 | `validateCashierDisbursement.ts` | Verifies cashier petty cash disbursements during active shifts, balance deductions, and authorization constraints. |
| 3 | `validateDataIntegrity.ts` | Validates persistence integrity, fresh install seed initialization, snapshot recovery, corrupt JSON handling, and schema sanity. |
| 4 | `validateFactoryReset.ts` | Validates Owner-only factory reset authorization, PIN verification, storage allowlist reset, and anti-tamper constraints. |
| 5 | `validateHPPHelpers.ts` | Verifies pure calculation helpers (59 scenarios): `calculateGrossAmount`, unit conversion base units, anti-bypass guards, and gross profit math. |
| 6 | `validateHPPPhase2.ts` | Tests Weighted Average Cost (WAC) recalculations and inventory restock amounts upon supplier purchases (20 scenarios). |
| 7 | `validateHPPPhase3.ts` | Validates recipe waste factors, unit conversions, checkout HPP snapshotting, and stock deduction atomicity (18 scenarios). |
| 8 | `validateHPPPhase4.ts` | Tests financial audit trails, reporting visibility, 3-tier HPP classification, and export synchronization (12 scenarios). |
| 9 | `validateLegacyRefundHardening.ts` | Verifies backward compatibility for legacy refund schemas and custom hook mock runners. |
| 10 | `validateLegacyVIPDiscountDeprecation.ts` | Validates that legacy `vip_discount_percentage` settings are cleanly deprecated in favor of unified promo rule management. |
| 11 | `validateMockData.ts` | Validates referential integrity across products, categories, ingredients, recipes, shifts, and users in mock seed data. |
| 12 | `validateNumberInputFormatting.ts` | Validates formatted numeric inputs (12 criteria): currency formatting below 1,000, thousands, millions, and formula immutability. |
| 13 | `validatePhase2.ts` | Verifies mock authentication (Owner vs. Cashier), session persistence in `boothdaily_demo`, and role-based route access. |
| 14 | `validatePhase3.ts` | Validates cashier/owner PIN checks, checkout stock availability guards, and insufficient cash zero-mutation rollbacks. |
| 15 | `validatePhase4.ts` | Verifies entity CRUD operations (products, categories, inventory items) and relational protection against orphaned references. |
| 16 | `validatePhase5.ts` | Validates clean application startup, guest state safety audit, and WebSocket/Echo safe stub isolation. |
| 17 | `validateQRISReconciliation.ts` | Validates end-shift QRIS transaction aggregation, status evaluation (`no_transaction`, `matched`, `unreconciled`), and discrepancy reporting. |
| 18 | `validateRefundWorkflow.ts` | Tests multi-step refund workflows (31 scenarios): cashier request with PIN, owner approval, inventory restocking, and financial audit logging. |
| 19 | `validateReportUserFilter.ts` | Validates financial reporting cashier/user filtering, operational cutoff alignment, and Excel export consistency. |
| 20 | `validateSecurityFixes.ts` | Verifies session-based role validation, prevents client privilege escalation, and tests owner review authorization guards. |
| 21 | `validateSettingsUXRefinement.ts` | Tests unified discount rules (General vs. VIP), non-stacking priority evaluation, and modal validation guards. |
| 22 | `validateShiftDateFilters.ts` | Validates date filter boundary evaluation, UTC vs. local timezone offsets, and operational midnight cutoffs. |
| 23 | `validateShiftExpenses.ts` | Tests shift petty cash operational expenses (16 business scenarios): positive integer validation, enum categories, and cashier vs owner edit permissions. |
| 24 | `validateShiftReconciliationScenarios.ts` | Verifies real-world shift reconciliation scenarios: cash & QRIS match, cash shortage/overage, and audit remarks. |
| 25 | `validateShiftSystem.ts` | Validates the complete shift lifecycle: POS lock prior to shift open, initial cash float validation, unique randomizer PINs, and shift closure. |
| 26 | `validateUnitConversionAndRounding.ts` | Tests unit-first integer HPP accounting, Rupiah integer rounding, purchase package conversions, and purchase update/delete stock adjustments. |
| 27 | `validateVIPAndReportSettings.ts` | Validates persistent report metadata (signer name, title), operational day cutoffs, and VIP discount rule settings. |

### 5.2 Static Code Analysis
- **TypeScript Compiler (`tsc --noEmit`):** Executed via `npm run lint` with strict typing configuration enabled in `tsconfig.json`.

---

## 6. Security Model & Prototype Limitations

The application operates under intentional prototype boundaries appropriate for a portfolio demonstration:

- **Local Storage Isolation:** All application state resides exclusively in the browser's `localStorage`. No data is transmitted to an external server unless exported manually by the user.
- **Simulated Authentication:** Pre-seeded user accounts (`owner`, `manager`, `cashier`) use mock passwords stored in plaintext within client seed files for evaluation convenience. This is a front-end simulation and does not represent a production authentication system.
- **Client-Side PIN Guards:** Supervisor and cashier PIN prompts are evaluated in-memory against local user records. They demonstrate front-end authorization UX and do not provide server-enforced access control.
- **Simulated Payment Gateways:** QRIS codes and card transactions simulate successful capture hooks locally; they are not integrated with banking networks or payment processors.
- **Backup Cryptography Scope (`src/services/backupService.ts`):**
  - Implements the browser Web Crypto API using AES-GCM (256-bit key length) with PBKDF2 key derivation (`KDF_ITERATIONS = 600000`, SHA-256).
  - Uses cryptographically secure random salt (16 bytes) and IV (12 bytes) generated via `crypto.getRandomValues`.
  - AES-GCM provides built-in 128-bit authentication tag verification; corrupted ciphertext or incorrect passwords fail decryption.
  - *Explicit Scope Boundary:* Encryption applies solely to exported backup `.json` files at rest. Runtime browser storage (`localStorage`) remains unencrypted plaintext JSON.

---

## 7. Known Technical Boundaries

- **Browser Storage Limits:** Browser `localStorage` quotas typically range from 5 MB to 10 MB per origin. Storing thousands of historical transactions or large embedded images may approach browser capacity limits, necessitating periodic resets or exports.
- **Single-Tab / Single-Instance:** The application does not synchronize state across multiple browser tabs or devices simultaneously.
- **Main-Thread Processing:** Data sorting, filtering, and document rendering occur on the main JavaScript thread; large datasets may introduce momentary UI latency during heavy export generation.

---

## 8. Future Development Considerations

If transitioning this prototype into a multi-terminal production system, the following architectural additions would be recommended:

1. **Backend API & Relational Database:** Transition from in-memory mock repositories and `localStorage` to a secure backend API (e.g., Laravel or Node.js) backed by PostgreSQL or MySQL with ACID transaction isolation.
2. **Production Identity & Access Management:** Implement OAuth2 / OpenID Connect with secure HTTP-only session cookies and server-side RBAC token verification.
3. **Live Payment Gateway Integration:** Connect with certified payment gateways (e.g., Midtrans, Xendit, or DOKU SNAP BI) for real-time dynamic QRIS generation, settlement webhooks, and card tokenization.
4. **Real-Time Multi-Device Synchronization:** Deploy WebSockets or Server-Sent Events (SSE) to synchronize order queues, kitchen tickets (KDS), and inventory deductions across multiple cashier terminals.
