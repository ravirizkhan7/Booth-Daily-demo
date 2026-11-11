[EN](#english) | [ID](#bahasa-indonesia)

---

<!-- ENGLISH VERSION -->
<a id="english" name="english"></a>

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

---

<!-- INDONESIAN VERSION -->
<a id="bahasa-indonesia" name="bahasa-indonesia"></a>

# Booth Daily Demo — Catatan Teknis & Referensi Audit Historis

> **Tipe Dokumen:** Catatan Rekayasa Proyek & Referensi Arsitektur Terpadu  
> **Repositori:** Booth Daily Demo (`booth_daily`)  
> **Status Proyek:** Prototipe Portofolio / Referensi Rekayasa  
> **Arsitektur:** Single Page Application Sisi Klien Mandiri (React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4)

---

## 1. Ringkasan Proyek

**Booth Daily Demo** adalah prototipe aplikasi Point of Sale (POS) dan sistem manajemen coffee shop interaktif yang dirancang untuk mendemonstrasikan arsitektur frontend modern, modularitas service berbasis domain, dan logika bisnis operasional ritel langsung di dalam browser pengguna.

Proyek ini beroperasi sepenuhnya di sisi klien tanpa memerlukan server backend aktif, database relasional eksternal, maupun koneksi jaringan persisten. Aplikasi ini menampilkan alur kerja operasional coffee shop ritel dari ujung ke ujung—meliputi pencatatan pesanan kasir, pengurangan bahan baku mentah berbasis resep, pembukuan shift dengan kontrol kas kecil (petty cash), pengembalian dana transaksi multi-tahap, pembuatan laporan analitik dinamis, serta ekspor dan impor cadangan data terenkripsi.

Dokumen ini berfungsi sebagai referensi rekayasa perangkat lunak yang mencatat pola arsitektur, tahapan evolusi fitur, rangkaian validasi otomatis, serta batasan teknis yang ditetapkan sepanjang siklus hidup proyek.

---

## 2. Arsitektur & Fondasi Teknis

### 2.1 Mock Store Reaktif Terpusat
- **Inti Store (`src/mock/store.ts`):** Repository in-memory terpusat yang mengelola koleksi state terstruktur untuk produk, kategori, bahan baku, pesanan pembelian (PO), transaksi penjualan, shift kerja, pengaturan toko, dan log audit.
- **Langganan Reaktif (Reactive Subscriptions):** Komponen tampilan berlangganan pada perubahan state di dalam store, memicu render ulang antarmuka secara otomatis saat terjadi mutasi data tanpa memerlukan muat ulang halaman secara penuh.
- **Isolasi Stub Eksternal:** Menyediakan stub sisi klien yang aman untuk Laravel Echo, Pusher, dan WebSocket guna memastikan eksekusi yang stabil di lingkungan offline tanpa menimbulkan pesan kesalahan koneksi jaringan.

### 2.2 Persistensi Sisi Klien
- **Driver Penyimpanan (`src/mock/persistence/storage.ts`):** State aplikasi diserialisasi ke dalam `localStorage` browser di bawah kunci penyimpanan `boothdaily_demo_store`.
- **Batasan Persistensi:** Persistensi data mengandalkan serialisasi JSON dari snapshot store saat terjadi mutasi data. Fitur ini bukan merupakan database transaksional yang mendukung kepatuhan ACID, serta tidak menyediakan write-ahead logging (WAL), penguncian baris (row-level locking), maupun jaminan commit terdistribusi.
- **Hidrasi Data & Factory Reset:** Saat aplikasi pertama kali dijalankan, store secara otomatis memuat data seed operasional coffee shop yang realistis. Utilitas Factory Reset dengan otorisasi Owner tersedia di menu Pengaturan untuk memulihkan database ke kondisi data seed awal yang bersih.

---

## 3. Alur Kerja Bisnis Utama

### 3.1 Terminal POS & Pemrosesan Pesanan
- **Navigasi Menu:** Filter kategori horizontal, pencarian teks instan, dan lencana ketersediaan stok visual (`out_of_stock`, `low_stock`).
- **Manajemen Keranjang Belanja:** Pemilihan tipe pesanan (Dine-In vs. Take-Away) dengan rekalkulasi promo otomatis, catatan kustomisasi barista (misalnya tingkat kemanisan, preferensi es), dan perhitungan pajak serta biaya layanan secara real-time.
- **Pilihan Metode Pembayaran:** Transaksi tunai dengan perhitungan uang kembalian instan, serta simulasi pemrosesan pembayaran non-tunai QRIS dinamis.

### 3.2 Inventaris Berbasis Resep & Akuntansi HPP
- **Pengurangan Bill of Materials (BOM):** Produk jadi terhubung langsung ke resep komposisi bahan baku (misalnya biji espresso dalam gram, susu segar dalam mililiter, cup kertas dalam satuan pcs). Penyelesaian pesanan memotong stok bahan baku mentah melalui operasi memori atomik.
- **Metode Biaya Rata-Rata Tertimbang (WAC / HPP):** Faktur pesanan pembelian dari pemasok menambah stok bahan baku dan secara dinamis memperbarui Harga Pokok Penjualan (HPP / COGS) bahan baku menggunakan formula biaya rata-rata tertimbang berdasarkan jumlah stok masuk dan harga beli satuan.
- **Dynamic Stock Guard:** Pengecekan ketersediaan stok secara real-time mencegah checkout produk yang bahan baku resep penyusunnya telah habis.

### 3.3 Siklus Shift Kasir & Laci Kas Kecil
- **Pembukuan Shift:** Kasir membuka shift dengan mendeklarasikan modal kas awal. Seluruh penjualan tunai secara otomatis menambah total saldo kas laci yang diharapkan.
- **Pengeluaran Kas Operasional (Petty Cash):** Kasir dapat mencatat pengeluaran kas operasional harian dengan kategorisasi resmi, catatan keterangan, dan pemotongan langsung dari saldo kas laci yang diharapkan.
- **Rekonsiliasi Akhir Shift:** Saat penutupan shift, kasir memasukkan hitungan fisik uang kas riil di laci, dan sistem mengevaluasi status selisih lebih/kurang kas disertai audit status transaksi QRIS (`no_transaction`, `matched`, `unreconciled`).

### 3.4 Siklus Pengembalian Dana (Refund) Transaksi
- **Otorisasi Dua Tahap:** Kasir mengajukan permohonan refund dengan alasan wajib dan verifikasi PIN; persetujuan final memerlukan otorisasi PIN Owner atau Manajer.
- **Restocking Bahan Baku:** Transaksi refund yang disetujui mendukung opsi pengembalian bahan baku resep yang sebelumnya terpotong kembali ke inventaris aktif.
- **Pencatatan Log Audit:** Setiap transaksi refund menghasilkan catatan log audit yang terhubung dengan nomor struk asli dan catatan pengeluaran dana.

### 3.5 Pembuatan Laporan & Ekspor Dokumen
- **Metrik Operasional:** Perhitungan pendapatan kotor, margin laba bersih, total diskon yang diberikan, kewajiban pajak, dan rincian transaksi tunai vs. non-tunai secara real-time.
- **Batas Waktu Operasional Sadar Zona Waktu:** Agregasi transaksi dan shift mendukung batasan hari operasional (misalnya batas cutoff pukul 04:00 WIB) untuk mengelompokkan shift larut malam secara akurat ke hari operasional yang benar.
- **Ekspor Sisi Klien:** Pembuatan langsung berkas spreadsheet terformat (`.xlsx` via SheetJS) serta cetak struk termal dan laporan keuangan (`.pdf` via jsPDF dan jsPDF-AutoTable) dari dalam browser.

---

## 4. Milestone Rekayasa Perangkat Lunak

### Milestone 1 — Arsitektur Core Store & Fondasi POS
- Membangun struktur mock store reaktif in-memory dan kontrak repository entitas.
- Membangun terminal kasir utama dengan grid produk responsif dan navigasi filter kategori.
- Mengimplementasikan kalkulasi keranjang belanja dasar, perhitungan pajak, dan kembalian tunai.

### Milestone 2 — Operasional Shift & Rekonsiliasi Laci Kas
- Mengimplementasikan siklus lengkap shift (modal kas awal, pengeluaran kas operasional, dan penutupan shift).
- Membangun modul rekonsiliasi kas yang membandingkan kas fisik riil dengan kas yang diharapkan sistem.
- Membuat modul audit status transaksi QRIS dan pelaporan selisih non-tunai.

### Milestone 3 — Akuntansi Inventaris & Mesin Kalkulasi HPP
- Mengintegrasikan pemotongan bahan baku berbasis resep untuk produk minuman komposit.
- Mengembangkan modul perhitungan Biaya Rata-Rata Tertimbang (Weighted Average Cost / WAC) untuk pesanan pembelian masuk.
- Mengimplementasikan helper konversi satuan (misalnya kilogram ke gram, liter ke mililiter) dan kebijakan pembulatan nilai rupiah.

### Milestone 4 — Subsistem Refund Multi-Tahap & Penguatan Hak Akses
- Merancang modal pengajuan dan persetujuan refund transaksi khusus (`src/components/transactions/`).
- Mendeprekasi persentase diskon VIP lawas yang di-hardcode dan menggantikannya dengan evaluasi aturan promo terpadu.
- Menambahkan isolasi sesi berbasis peran antara alur kerja Kasir dan alur kerja Owner.

### Milestone 5 — Optimalisasi UX Pengaturan & Tata Letak Responsif
- Memperkuat tata letak responsif di lima breakpoint standar: ponsel 360px, ponsel 375px, tablet portrait 768px, tablet landscape 1024px, dan monitor desktop 1440px.
- Menstandarkan pemformatan input mata uang dan validasi nilai batas melalui komponen `NumberInput.tsx`.
- Memperbaiki komponen `InfoPopover`: menghilangkan animasi masuk yang tidak diinginkan, meniadakan kedipan (flicker) pergantian konten, menambahkan penutupan otomatis saat scroll di luar area, dan mengaktifkan scroll chaining pada daftar promo mobile.

### Milestone 6 — Pemisahan Modul Watermark & Struk Termal
- Mengekstrak dan memodularisasi perenderan watermark struk ke dalam utilitas khusus (`src/mock/watermark/`).
- Memisahkan logika pembuatan kanvas struk dari komponen modal presentasi.
- Menstandarkan format tata letak struk termal 58mm dan 80mm dengan simulasi barcode transaksi.

---

## 5. Validasi & Jaminan Kualitas

### 5.1 Framework Validasi Programatik
Repositori ini memiliki **27 suite validasi otomatis** yang berada di dalam direktori `src/mock/validation/`. Seluruh suite ini dapat dijalankan secara lokal menggunakan `tsx` atau Node (`npm run validate:*`) untuk memverifikasi transisi state, formula perhitungan finansial, dan stabilitas regresi kode.

> **Catatan:** Seluruh suite ini merupakan skrip programatik lokal untuk verifikasi pengembang; saat ini belum ada pipeline otomatisasi CI/CD eksternal yang dikonfigurasi.

| # | Nama File Validator | Cakupan & Tanggung Jawab |
| :-: | :--- | :--- |
| 1 | `validateBackupRestore.ts` | Memvalidasi enkripsi AES-GCM 256-bit, PBKDF2 (600.000 iterasi), pencegahan kebocoran plaintext, integritas relasional, dan rollback jurnal pemulihan. |
| 2 | `validateCashierDisbursement.ts` | Memverifikasi pengeluaran kas kecil oleh kasir selama shift aktif, pemotongan saldo laci, dan batasan otorisasi. |
| 3 | `validateDataIntegrity.ts` | Memvalidasi integritas persistensi, inisialisasi seed instalasi baru, pemulihan snapshot, penanganan JSON rusak, dan keabsahan skema. |
| 4 | `validateFactoryReset.ts` | Memvalidasi otorisasi khusus Owner untuk factory reset, verifikasi PIN, reset allowlist penyimpanan, dan pengaman anti-manipulasi. |
| 5 | `validateHPPHelpers.ts` | Memverifikasi helper kalkulasi murni (59 skenario): `calculateGrossAmount`, konversi satuan basis, pengaman anti-bypass, dan rumus laba kotor. |
| 6 | `validateHPPPhase2.ts` | Menguji rekalkulasi Biaya Rata-Rata Tertimbang (WAC) dan pemulihan stok saat pesanan pembelian masuk (20 skenario). |
| 7 | `validateHPPPhase3.ts` | Memvalidasi faktor susut resep, konversi satuan, snapshot HPP saat checkout, dan keatomikan pemotongan stok bahan baku (18 skenario). |
| 8 | `validateHPPPhase4.ts` | Menguji jejak audit finansial, visibilitas pelaporan, klasifikasi HPP 3-tier, dan sinkronisasi berkas ekspor (12 skenario). |
| 9 | `validateLegacyRefundHardening.ts` | Memverifikasi kompatibilitas mundur untuk skema refund lawas dan runner mock custom hook. |
| 10 | `validateLegacyVIPDiscountDeprecation.ts` | Memvalidasi bahwa pengaturan `vip_discount_percentage` lawas telah didepresiasi demi manajemen aturan promo terpadu. |
| 11 | `validateMockData.ts` | Memvalidasi integritas referensial antar produk, kategori, bahan baku, resep, shift, dan pengguna pada data seed mock. |
| 12 | `validateNumberInputFormatting.ts` | Memvalidasi pemformatan input numerik (12 kriteria): pemformatan di bawah 1.000, ribuan, jutaan, dan imutabilitas formula bisnis. |
| 13 | `validatePhase2.ts` | Memverifikasi autentikasi mock (Owner vs. Kasir), persistensi sesi di `boothdaily_demo`, dan perlindungan rute berbasis peran. |
| 14 | `validatePhase3.ts` | Memvalidasi verifikasi PIN kasir/owner, pengaman ketersediaan stok saat checkout, dan rollback mutasi jika kas tidak mencukupi. |
| 15 | `validatePhase4.ts` | Memverifikasi operasi CRUD entitas (produk, kategori, item stok) dan perlindungan referensial terhadap data yatim (orphaned). |
| 16 | `validatePhase5.ts` | Memvalidasi startup aplikasi yang bersih, audit keamanan status tamu, dan isolasi stub aman WebSocket/Echo. |
| 17 | `validateQRISReconciliation.ts` | Memvalidasi agregasi transaksi QRIS akhir shift, evaluasi status (`no_transaction`, `matched`, `unreconciled`), dan pelaporan selisih. |
| 18 | `validateRefundWorkflow.ts` | Menguji alur kerja refund multi-tahap (31 skenario): pengajuan kasir dengan PIN, persetujuan owner, restocking bahan, dan log audit. |
| 19 | `validateReportUserFilter.ts` | Memvalidasi filter kasir/pengguna pada laporan keuangan, keselarasan batas hari operasional, dan konsistensi ekspor Excel. |
| 20 | `validateSecurityFixes.ts` | Memverifikasi validasi peran berbasis sesi, mencegah eskalasi hak akses di sisi klien, dan menguji pengaman review rekonsiliasi oleh owner. |
| 21 | `validateSettingsUXRefinement.ts` | Menguji aturan diskon terpadu (Umum vs. VIP), evaluasi prioritas diskon non-stacking, dan validasi modal pengaturan. |
| 22 | `validateShiftDateFilters.ts` | Memvalidasi evaluasi batas filter tanggal, perbedaan zona waktu UTC vs. lokal, dan batas hari operasional tengah malam. |
| 23 | `validateShiftExpenses.ts` | Menguji pengeluaran kas kecil shift (16 skenario bisnis): validasi nilai positif, kategori enum resmi, dan hak edit kasir vs owner. |
| 24 | `validateShiftReconciliationScenarios.ts` | Memverifikasi skenario rekonsiliasi shift nyata: kas & QRIS cocok, selisih lebih/kurang kas, dan catatan audit. |
| 25 | `validateShiftSystem.ts` | Memvalidasi siklus hidup shift: penguncian kasir sebelum shift dibuka, validasi modal kas awal, PIN acak unik, dan penutupan shift. |
| 26 | `validateUnitConversionAndRounding.ts` | Menguji akuntansi HPP unit-first integer, pembulatan rupiah bilangan bulat, konversi paket pembelian, dan penyesuaian stok saat update/delete PO. |
| 27 | `validateVIPAndReportSettings.ts` | Memvalidasi metadata laporan persisten (nama penandatangan, jabatan), batas hari operasional, dan aturan diskon VIP. |

### 5.2 Analisis Kode Statis
- **Kompiler TypeScript (`tsc --noEmit`):** Dijalankan melalui perintah `npm run lint` dengan konfigurasi tipe ketat (strict typing) aktif pada `tsconfig.json`.

---

## 6. Model Keamanan & Batasan Prototipe

Aplikasi ini beroperasi dalam batasan prototipe yang disengaja untuk keperluan demonstrasi portofolio:

- **Isolasi Penyimpanan Lokal:** Seluruh state aplikasi berada secara eksklusif di dalam `localStorage` browser pengguna. Data tidak pernah dikirimkan ke server eksternal kecuali jika diekspor secara manual oleh pengguna.
- **Simulasi Autentikasi:** Akun pengguna bawaan (`owner`, `manager`, `cashier`) menggunakan kata sandi mock dalam format teks biasa di berkas data seed untuk kemudahan evaluasi. Ini adalah simulasi frontend dan bukan sistem autentikasi produksi yang aman.
- **Pengaman PIN Sisi Klien:** Permintaan PIN kasir dan supervisor dievaluasi di memori terhadap data pengguna lokal. Fitur ini mendemonstrasikan UX otorisasi frontend dan bukan kontrol akses yang ditegakkan oleh server.
- **Simulasi Payment Gateway:** Transaksi QRIS dan kartu EDC menyimulasikan hook keberhasilan pembayaran secara lokal; fitur ini tidak terhubung ke jaringan perbankan atau payment gateway sungguhan.
- **Cakupan Kriptografi Cadangan Data (`src/services/backupService.ts`):**
  - Mengimplementasikan Web Crypto API browser menggunakan AES-GCM (panjang kunci 256-bit) dengan derivasi kunci PBKDF2 (`KDF_ITERATIONS = 600000`, SHA-256).
  - Menggunakan salt acak (16 byte) dan IV (12 byte) yang aman secara kriptografi, dihasilkan melalui `crypto.getRandomValues`.
  - AES-GCM menyediakan verifikasi tag autentikasi 128-bit bawaan; ciphertext yang rusak atau kata sandi yang salah akan otomatis menggagalkan proses dekripsi.
  - *Batasan Cakupan Eksplisit:* Enkripsi hanya berlaku untuk berkas cadangan `.json` hasil ekspor saat disimpan di disk. Penyimpanan runtime browser (`localStorage`) tetap tersimpan dalam format teks biasa (plaintext JSON) tanpa enkripsi.

---

## 7. Batasan Teknis yang Diketahui

- **Kapasitas Kuota Penyimpanan Browser:** Batas kuota `localStorage` browser umumnya berkisar antara 5 MB hingga 10 MB per origin. Menyimpan ribuan transaksi historis atau gambar base64 besar dapat mendekati batas kapasitas ini, sehingga membutuhkan ekspor atau reset berkala.
- **Satu Tab / Satu Instance:** Aplikasi tidak menyinkronkan state antar-tab browser atau antar-perangkat secara bersamaan.
- **Pemrosesan di Thread Utama:** Pengurutan data, pemfilteran, dan perenderan dokumen PDF/Excel berjalan di main thread JavaScript; dataset yang sangat besar dapat menimbulkan latensi visual sementara saat proses ekspor berlangsung.

---

## 8. Pertimbangan Pengembangan Masa Depan

Jika prototipe ini akan dikembangkan menjadi sistem produksi multi-terminal, rekomendasi arsitektur berikut disarankan untuk diterapkan:

1. **Integrasi Backend API & Database Relasional:** Beralih dari mock repository in-memory dan `localStorage` ke backend API yang aman (misalnya Laravel atau Node.js) dengan dukungan database PostgreSQL atau MySQL yang memiliki isolasi transaksi ACID.
2. **Manajemen Identitas & Akses (IAM) Standar Industri:** Mengimplementasikan OAuth2 / OpenID Connect dengan cookie sesi HTTP-only yang aman serta verifikasi token RBAC di sisi server.
3. **Integrasi Payment Gateway Langsung:** Menghubungkan sistem dengan payment gateway resmi (misalnya Midtrans, Xendit, atau DOKU SNAP BI) untuk pembuatan QRIS dinamis real-time, webhook penyelesaian transaksi, dan tokenisasi kartu.
4. **Sinkronisasi Multi-Perangkat Real-Time:** Menerapkan WebSocket atau Server-Sent Events (SSE) untuk menyinkronkan antrean pesanan, Kitchen Display System (KDS), dan pemotongan stok bahan baku antar-terminal kasir secara instan.
