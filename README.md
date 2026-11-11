[EN](#english) | [ID](#bahasa-indonesia)

---

<!-- ENGLISH VERSION -->
<a id="english" name="english"></a>

# ☕ Booth Daily — Modern Coffee Shop POS & Management System

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Architecture](https://img.shields.io/badge/Architecture-100%25_Client--Side_Standalone-2ea44f)](#architecture--zero-backend-design)

> A modern, responsive **Point of Sale (POS) and Coffee Shop Management System** built as an interactive **Standalone Client-Side Showcase**. Designed to demonstrate modular frontend architecture, reactive client-side state management, domain-driven services, and realistic business workflows directly in the browser—with zero backend server requirements.

---

## Visual Showcase & Previews

Experience the responsive interface and workflows across core operational modules:

### 1. Point of Sale (POS) & Checkout
Fast cashier terminal featuring categorical filtering, live search, custom barista notes, dine-in / take-away switching, and cash / QRIS split payments.
![POS Cashier Interface](docs/screenshots/pos.png)

---

### 2. Management Dashboard & Metrics
Daily turnover, gross profit estimates, product sales ranking, and sales trajectory charts.
![Dashboard Overview](docs/screenshots/dashboard.png)

---

### 3. Recipe-Based Inventory & Stock Tracking
Ingredient level tracking down to grams/milliliters with low-stock alerts and transaction mutation logs.
![Inventory Management](docs/screenshots/inventory.png)

---

### 4. Financial Analytics & Document Exports
Revenue breakdowns by payment method and order type, with client-side Excel and PDF export pipelines.
![Reports & Financials](docs/screenshots/reports.png)

---

### 5. Settings, Promotional Rules & Encrypted Backup
Store configurations, tiered promotional rules, receipt templates, and client-side AES-GCM 256-bit encrypted data backup & recovery.
![Settings & Data Security](docs/screenshots/settings.png)

---

## Key Highlights & Capabilities

### Point of Sale (POS) Terminal
- **Intuitive Order Flow:** Category navigation pills, text search, quantity adjustments, and custom barista instructions (*Less Sugar, No Ice, Extra Shot*).
- **Flexible Order Types:** One-click toggle between **Dine In** (table assignment) and **Take Away**.
- **Payment Method Simulation:** 
  - **Cash:** Real-time cash received input, quick denomination buttons, and automatic change calculation.
  - **QRIS:** Simulated cashless transaction validation for exact payment amounts (local prototype simulation, not connected to an external payment gateway).
- **Cashier PIN Authorization:** Simulated 4-digit PIN verification modal allowing guests or cashiers to authorize transactions locally without full account privilege escalation.
- **80mm Thermal Receipt Simulation:** Pixel-perfect receipt rendering in an isolated iframe with browser print trigger and one-click text copying to clipboard.

### Recipe-Based Automated Stock Deduction
- **Ingredient Tracking:** Each beverage and menu item is mapped to a recipe with exact raw ingredient quantities (grams, milliliters, pieces).
- **Automated Deduction:** Placing an order deducts raw stock and records an audit log entry in `Stock History` within the client-side store.
- **Dynamic Stock Guard:** Menus automatically flag items as **Sold Out** or **Low Stock** when recipe ingredients drop below required thresholds.
- **Refund Inventory Reversion:** Refunding an order restores deducted raw ingredients back to inventory with dedicated mutation logs.

### Staff, Shifts & Cash Drawer Reconciliation
- **Shift Lifecycle:** Open shifts with verified beginning cash balance, track operational cash sales vs. cashless QRIS, and close shifts with cash drawer count verification.
- **Petty Cash Disbursements:** Record operational cash outflows with reason and manager PIN authorization.
- **Cash Discrepancy Auditing:** Automatic comparison between expected cash in drawer and actual physical cash submitted.

### Financial Reporting & Document Generation
- **Visual Analytics:** Interactive multi-period sales trend charts (daily, weekly, monthly, annual).
- **Key Retail Metrics:** Gross Revenue, Cost of Goods Sold (COGS / HPP), Net Profit, Average Ticket Size, and Top 5 Best-Selling Products.
- **Client-Side Document Exports:**
  - **Excel (`.xlsx`):** Multi-sheet financial statements powered by SheetJS.
  - **PDF (`.pdf`):** Formatted tabular reports with branded headers powered by jsPDF and AutoTable.
  - *Lazy loaded on-demand to keep initial bundle size lean.*

### Encrypted Local Backup & Data Resilience
- **Client-Side AES-GCM 256-Bit:** Export the entire relational store into an encrypted `.json` snapshot secured with PBKDF2 passphrase key derivation (600,000 iterations).
- **Integrity Verification:** Restoring snapshots performs cryptographic decryption via Web Crypto API with native AES-GCM authentication tag verification, schema structural validation, and reactive store re-hydration.
- **Factory Reset:** Safe, confirmation-gated factory reset to restore default relational seed state at any time.

### Modern Responsive UI / UX
- **Tailwind CSS v4:** Clean warm coffee palette (`Amber`, `Stone`, `Emerald`), consistent typographic scale, and smooth micro-interactions.
- **Dark Mode Support:** Full high-contrast dark theme optimized for low-light cafe counter environments.
- **Responsive Geometry:** Tested across mobile screens (320px, 360px, 375px), tablets (768px, 1024px), and wide desktop displays (1440px+).

---

## Architecture & Zero-Backend Design

Booth Daily Demo operates **entirely in the user's browser** without requiring an external backend API, database server, or cloud subscriptions:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                               Presentation Layer                            │
│           React 19 Pages (POS, Dashboard, Inventory, Reports, Settings)     │
│                 Accessible Modals & Dynamic InfoPopovers                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         State & Facade Layer                                │
│                   POSContext & Custom Domain Hooks                          │
│          (usePOSCart, usePOSOrders, usePOSPayments, usePOSDiscounts)         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Service Orchestration                             │
│     (orderService, transactionService, stockService, backupService, etc.)   │
│             Atomic recipe calculation, HPP computation, PIN checks          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Mock Repositories                                 │
│        (orderRepository, productRepository, stockRepository, userRepository)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Central Reactive Mock Store                          │
│                 Single-source-of-truth in-memory state                      │
│                  Relational queries & transactional updates                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Browser LocalStorage Persistence                        │
│                   Key: "boothdaily_demo_store"                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Characteristics:
1. **Instant Local Execution:** All data reads and transactional writes resolve in-memory without network latency.
2. **Simulated Relational Integrity:** Mock repositories simulate relational integrity constraints (foreign key cascades, unique constraints).
3. **Simulated Real-Time Events:** Uses an internal `SafeChannelStub` to simulate multi-window event dispatching without live WebSocket dependencies.
4. **Static Deployment Ready:** The entire application builds into static assets ready for deployment on static hosting platforms.

> ⚠️ **Data Storage Notice:** Application data is persisted in browser LocalStorage under the key `boothdaily_demo_store`. LocalStorage is browser-local and client-managed; it is intended for prototype evaluation and demonstrations, not as a persistent multi-user production database.

---

## Roles & Access Control

The prototype implements role-based route protection and persona management:

### Access Modes & Permissions
- **Guest Mode (Unauthenticated):** Visitors can freely browse the public POS ordering terminal (`/`) and view recipes (`/recipes`). Guests can construct orders, customize drinks, and trigger the checkout flow. However, finalizing transactions requires a staff PIN, and administrative views (Dashboard, Inventory, Shifts, Reports, Settings) are strictly protected. Guest users do not have Owner or management privileges.
- **Staff / Cashier Personas:** Access to POS cashiering, shift opening and closing, cash drawer reconciliation, transaction history, and inventory status.
- **Owner Persona:** Unrestricted access across all operational and administrative screens, including Store Settings, promotional discount rules, financial reports, employee management, and encrypted backup/restore.

| Role | Persona | Permissions Scope |
| :--- | :--- | :--- |
| 👑 **Owner** | Store Owner Persona | Unrestricted administrative access (Settings, Reports, Staff Management, Financials, Inventory, Backup & Restore) |
| ☕ **Staff / Cashier** | Cashier Persona 1 | Front-of-house operations (POS cashiering, order history, inventory status, shift management) |
| ☕ **Staff / Cashier** | Cashier Persona 2 | Front-of-house operations (POS cashiering, order history, inventory status, shift management) |

> 💡 **Accessing Demo Accounts:**
> Visitors can conveniently populate credentials for any role by clicking the built-in **"Akun Demo"** helper button on the login screen, which auto-fills credentials for the selected persona without manual typing. This is an interactive convenience feature for quick evaluation, not a security mechanism.
>
> *Note on Authentication:* User authentication and staff PIN checks are simulated locally within the client-side mock store. Passwords are stored in plain text for demonstration convenience and are not cryptographically hashed.

---

## Relational Mock Dataset

The initial bootstrap seed provides a specialty coffee shop dataset:

- **Users:** 3 accounts (1 Owner, 2 Cashiers) with pre-configured authentication profiles and transaction PINs.
- **Categories:** 6 product categories (Signature Coffee, Classic Espresso, Manual Brew, Tea & Beverages, Pastries, Main Course).
- **Products:** 15 handcrafted items with cost prices, selling prices, categories, and recipe links.
- **Raw Ingredients (Stocks):** 13 tracked inventory items (Coffee Beans, Fresh Milk, Oat Milk, Vanilla Syrup, Caramel Sauce, Cups, Straws, etc.).
- **Standard Recipes:** 15 ingredient bill-of-materials per item.
- **Historical Orders:** 50 pre-populated transactions spanning the past 30 days for rich analytics visualization.
- **Purchase Orders:** 7 historical supplier ingredient restock invoices.
- **Stock Audit Logs:** 25 historical stock adjustment and mutation records.
- **Promotional Rules:** 3 tiered discount rules (e.g., Happy Hour, Weekend Specials, Volume Discounts).
- **Store Configuration:** Store identity, tax rate (5%), and receipt footer notes.

---

## Getting Started

### Prerequisites
- **Node.js:** `>= 20.19.0` or `>= 22.12.0` (LTS recommended)
- **Package Manager:** `npm` (`v9.x`+) or `pnpm`

### Installation

1. **Clone the Repository:**
   ```bash
   git clone <repository-url>
   cd Booth-Daily-demo
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:3000` (configured via `--port=3000 --host=0.0.0.0`).

---

## Production Build & Deployment

### Compile Static Build:
```bash
npm run build
```
Optimized static bundles are written to `dist/`. The main entry JavaScript chunk is ~126 kB gzipped (~469 kB uncompressed, plus ~18 kB gzipped CSS). Additional lazy-loaded chunks (individual pages and document export engines like SheetJS and jsPDF) are dynamically fetched on demand, keeping initial page load fast.

### Local Preview of Production Build:
```bash
npm run preview
```

### Static Hosting Deployments:
- **Vercel:** Includes pre-configured `vercel.json` with SPA catch-all rewrites (`"source": "/:path*", "destination": "/index.html"`).
- **Netlify:** Set build command to `npm run build` and publish directory to `dist`.
- **GitHub Pages / Cloudflare Pages:** Ensure routing redirects unmapped routes to `/index.html`.

---

## Validation & Automated Testing

The repository includes automated validation scripts to verify data integrity, mathematical calculations, and user flows:

```bash
# 1. Foundation Mock Integrity & Relational Verification
npm run validate:mock

# 2. Service Layer Adapters & Repositories Validation
npm run validate:phase2

# 3. Checkout Flow, Recipe Stock Deductions & Order Creation
npm run validate:phase3

# 4. Full CRUD Operations, Staff Roles & Refund Restorations
npm run validate:phase4

# 5. Standalone Integration, Guest Checkout & Security Checks
npm run validate:phase5

# 6. Static TypeScript Type Checking (tsc --noEmit)
npm run lint

# 7. Production Build Verification
npm run build
```

---

## Resetting Demo Data

To return the application to its clean factory seed state at any time:
1. Navigate to **Pengaturan (Settings)** as an Owner and click **"Muat Ulang Seluruh Data Toko (Factory Reset)"**. This cleanly reinstates the initial relational seed dataset.

> 🛠️ **Troubleshooting State:** If browser storage state ever becomes corrupted during testing, clearing the browser LocalStorage key `boothdaily_demo_store` in Developer Tools and refreshing the page will also trigger fresh seed initialization.

---

## Project Structure

```text
Booth-Daily-demo/
├── docs/
│   ├── HISTORICAL_AUDIT_SUMMARY.md # Consolidated engineering logs and audit history
│   └── screenshots/              # High-DPI application showcase screenshots
│       ├── dashboard.png
│       ├── inventory.png
│       ├── pos.png
│       ├── reports.png
│       └── settings.png
├── src/
│   ├── assets/                   # App logos and iconography
│   ├── components/               # Reusable UI components & modals
│   │   ├── common/               # ConfirmDialog, NumberInput, PINModal, ReceiptModal
│   │   ├── layout/               # Header, Sidebar, MobileMenu, BottomNav
│   │   ├── pos/                  # ProductCard, CartSidebar, CategoryBar, CloseShiftModal
│   │   ├── settings/             # DiscountRuleModal, BackupModal, RestoreModal
│   │   └── transactions/         # TransactionDetailModal, RefundModal
│   ├── context/                  # React Context & domain hook facades (POSContext)
│   ├── layouts/                  # MainLayout with responsive navigation shell
│   ├── mock/                     # Standalone mock infrastructure
│   │   ├── data/                 # Seed data (products, recipes, orders, stocks, users)
│   │   ├── persistence/          # LocalStorage persistence layer
│   │   ├── repositories/         # Relational query & mutation repositories
│   │   ├── store.ts              # Central reactive store
│   │   └── validation/           # Automated validation test scripts
│   ├── pages/                    # Route entry points (POS, Dashboard, Inventory, etc.)
│   ├── services/                 # Business logic services (order, stock, backup, export)
│   ├── types/                    # Shared TypeScript interfaces & domain types
│   ├── utils/                    # Math helpers, receipt formatters, shift calculations
│   ├── App.tsx                   # Main router configuration & route guards
│   └── main.tsx                  # Application entry point
├── package.json
├── tsconfig.json
├── vercel.json
├── vite.config.ts
└── README.md
```

---

## About This Project

This project was developed as a frontend engineering portfolio demonstration to showcase complex state orchestration, point-of-sale operational logic, and responsive UI design in a standalone client-side environment.

---

<!-- INDONESIAN VERSION -->
<a id="bahasa-indonesia" name="bahasa-indonesia"></a>

# ☕ Booth Daily — Sistem POS & Manajemen Coffee Shop Modern

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Arsitektur](https://img.shields.io/badge/Arsitektur-100%25_Client--Side_Mandiri-2ea44f)](#arsitektur--desain-tanpa-backend)

> Aplikasi web **Point of Sale (POS) dan Sistem Manajemen Coffee Shop** modern dan responsif yang dibangun sebagai **Showcase Portofolio Sisi Klien Mandiri (Standalone Client-Side)**. Dirancang untuk mendemonstrasikan arsitektur frontend modular, manajemen state reaktif di sisi klien, domain service terstruktur, dan alur operasional bisnis nyata langsung di browser—tanpa memerlukan server backend eksternal.

---

## Tampilan Visual & Preview

Lihat antarmuka responsif dan alur kerja aplikasi di berbagai modul operasional utama:

### 1. Point of Sale (POS) & Checkout
Terminal kasir cepat dengan filter kategori, pencarian langsung, catatan barista kustom, pilihan dine-in / take-away, serta pembayaran tunai maupun QRIS.
![Antarmuka Kasir POS](docs/screenshots/pos.png)

---

### 2. Dashboard Manajemen & Metrik
Informasi omzet harian, perkiraan laba kotor, peringkat penjualan produk, dan grafik tren penjualan interaktif.
![Ringkasan Dashboard](docs/screenshots/dashboard.png)

---

### 3. Inventaris Berbasis Resep & Pelacakan Stok
Pelacakan bahan baku hingga satuan gram/mililiter dengan peringatan stok menipis dan riwayat mutasi stok transaksi.
![Manajemen Inventaris](docs/screenshots/inventory.png)

---

### 4. Analitik Keuangan & Ekspor Dokumen
Rincian pendapatan berdasarkan metode pembayaran dan tipe pesanan, dilengkapi fitur ekspor spreadsheet Excel dan dokumen PDF di sisi klien.
![Laporan & Keuangan](docs/screenshots/reports.png)

---

### 5. Pengaturan, Aturan Promo & Backup Terenkripsi
Konfigurasi toko, aturan diskon bertingkat, template struk belanja, dan cadangan data terenkripsi AES-GCM 256-bit di sisi klien.
![Pengaturan & Keamanan Data](docs/screenshots/settings.png)

---

## Fitur Utama & Kemampuan

### Terminal Point of Sale (POS)
- **Alur Pemesanan Intuitif:** Tab kategori horizontal, pencarian teks cepat, penyesuaian jumlah pesanan, dan instruksi khusus barista (*Less Sugar, No Ice, Extra Shot*).
- **Fleksibilitas Tipe Pesanan:** Peralihan satu klik antara **Dine In** (dengan nomor meja) dan **Take Away**.
- **Simulasi Metode Pembayaran:**
  - **Cash (Tunai):** Input nominal uang diterima secara real-time, tombol pecahan uang cepat, dan kalkulasi otomatis uang kembalian.
  - **QRIS:** Validasi transaksi non-tunai nominal pas tersimulasi (simulasi prototipe lokal, tidak terhubung ke payment gateway eksternal).
- **Otorisasi PIN Kasir:** Modal verifikasi PIN 4-digit yang memungkinkan staf atau kasir mengesahkan transaksi secara lokal tanpa eskalasi hak akses akun secara penuh.
- **Simulasi Struk Termal 80mm:** Render tampilan struk presisi di dalam iframe terisolasi dengan pemicu cetak bawaan browser dan fitur salin teks struk ke clipboard.

### Pengurangan Stok Otomatis Berbasis Resep
- **Pelacakan Bahan Baku:** Setiap produk menu terhubung ke resep komposisi bahan baku dalam satuan presisi (gram, mililiter, pcs).
- **Pengurangan Otomatis:** Penyelesaian pesanan memotong stok bahan baku mentah secara atomik di memori dan mencatat riwayat mutasi pada `Stock History`.
- **Dynamic Stock Guard:** Menu secara otomatis menandai produk sebagai **Sold Out** (Habis) atau **Low Stock** (Menipis) saat bahan baku resep berada di bawah batas minimum.
- **Pengembalian Stok Saat Refund:** Pengembalian dana transaksi (refund) mengembalikan bahan baku resep yang terpotong ke inventaris aktif disertai log mutasi khusus.

### Manajemen Staf, Shift & Rekonsiliasi Kas Laci
- **Siklus Hidup Shift:** Buka shift dengan modal kas awal terverifikasi, lacak penjualan tunai operasional vs. non-tunai QRIS, dan tutup shift dengan verifikasi fisik laci kasir.
- **Pengeluaran Kas Operasional (Petty Cash):** Catat pengeluaran tunai harian disertai keterangan dan verifikasi PIN otorisasi.
- **Audit Selisih Kas:** Perbandingan otomatis antara estimasi kas sistem di laci dengan hitungan fisik riil yang diserahkan kasir.

### Laporan Keuangan & Pembuatan Dokumen
- **Analitik Visual:** Grafik tren penjualan interaktif multi-periode (harian, mingguan, bulanan, tahunan).
- **Metrik Utama Ritel:** Omzet Kotor, Harga Pokok Penjualan (HPP / COGS), Laba Bersih, Rata-rata Nilai Transaksi, dan 5 Produk Terlaris.
- **Ekspor Dokumen di Sisi Klien:**
  - **Excel (`.xlsx`):** Laporan keuangan multi-lembar kerja didukung oleh SheetJS.
  - **PDF (`.pdf`):** Laporan tabular terformat rapi dengan kop dokumen didukung oleh jsPDF dan AutoTable.
  - *Dimuat secara lazy load saat dibutuhkan agar ukuran bundle awal tetap ringan.*

### Backup Lokal Terenkripsi & Ketahanan Data
- **Enkripsi AES-GCM 256-Bit Sisi Klien:** Ekspor seluruh data store relasional ke dalam berkas snapshot `.json` terenkripsi yang dilindungi derivasi kunci passphrase PBKDF2 (600.000 iterasi).
- **Verifikasi Integritas:** Pemulihan data cadangan menjalankan dekripsi kriptografi melalui Web Crypto API dengan verifikasi tag autentikasi native AES-GCM, validasi struktur skema, dan hidrasi ulang store reaktif.
- **Factory Reset (Muat Ulang Data Awal):** Utilitas reset data toko dengan konfirmasi aman untuk mengembalikan dataset seed relasional awal kapan saja.

### UI/UX Modern & Responsif
- **Tailwind CSS v4:** Palet warna hangat khas coffee shop (`Amber`, `Stone`, `Emerald`), skala tipografi konsisten, dan mikro-interaksi yang halus.
- **Dukungan Dark Mode:** Tema gelap kontras tinggi yang nyaman untuk lingkungan meja kasir minim cahaya.
- **Geometri Responsif:** Diuji di berbagai resolusi layar ponsel (320px, 360px, 375px), tablet (768px, 1024px), hingga monitor desktop lebar (1440px+).

---

## Arsitektur & Desain Tanpa Backend

Booth Daily Demo berjalan **sepenuhnya di dalam browser pengguna** tanpa memerlukan backend API eksternal, server database, maupun langganan cloud:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Lapisan Presentasi                             │
│           Halaman React 19 (POS, Dashboard, Inventory, Reports, Settings)   │
│                 Modal Aksesibel & InfoPopover Dinamis                       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Lapisan State & Facade                            │
│                      POSContext & Custom Domain Hooks                       │
│          (usePOSCart, usePOSOrders, usePOSPayments, usePOSDiscounts)         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Orkestrasi Service                              │
│     (orderService, transactionService, stockService, backupService, dll.)   │
│            Kalkulasi resep atomik, perhitungan HPP, verifikasi PIN          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Mock Repositories                              │
│        (orderRepository, productRepository, stockRepository, userRepository)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Mock Store Reaktif Terpusat                         │
│                    Single-source-of-truth in-memory state                   │
│                   Kueri relasional & pembaruan transaksional                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Persistensi LocalStorage Browser                        │
│                     Kunci: "boothdaily_demo_store"                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Karakteristik Arsitektur:
1. **Eksekusi Lokal Instan:** Seluruh pembacaan data dan mutasi transaksional diselesaikan di memori tanpa latensi jaringan.
2. **Integritas Relasional Tersimulasi:** Mock repository menyimulasikan batasan integritas relasional (cascade foreign key, batasan unik).
3. **Simulasi Event Real-Time:** Menggunakan `SafeChannelStub` internal untuk menyimulasikan pengiriman event antar-jendela tanpa ketergantungan WebSocket aktif.
4. **Siap Deployment Statis:** Seluruh aplikasi dikompilasi menjadi aset statis murni yang siap dideploy di platform hosting statis.

> ⚠️ **Catatan Penyimpanan Data:** Data aplikasi disimpan di LocalStorage browser dengan kunci `boothdaily_demo_store`. LocalStorage bersifat lokal per-browser dan dikelola oleh sisi klien; fitur ini ditujukan untuk evaluasi prototipe dan demonstrasi portofolio, bukan sebagai database produksi multi-pengguna permanen.

---

## Peran & Pembatasan Akses

Prototipe ini menerapkan perlindungan rute berbasis peran dan manajemen persona pengguna:

### Mode Akses & Hak Istimewa
- **Mode Tamu (Guest Mode):** Pengunjung dapat bebas melihat terminal pemesanan POS publik (`/`) dan melihat daftar resep (`/recipes`). Tamu dapat menyusun pesanan, menyesuaikan catatan minuman, dan membuka alur checkout. Namun, finalisasi transaksi memerlukan PIN staf, dan halaman administratif (Dashboard, Inventory, Shifts, Reports, Settings) terlindungi secara ketat. Pengguna tamu tidak memiliki hak akses Owner maupun manajemen.
- **Persona Staf / Kasir:** Akses ke terminal kasir POS, pembukaan dan penutupan shift, rekonsiliasi kas laci, riwayat transaksi, dan status inventaris.
- **Persona Owner:** Akses penuh tanpa batas ke seluruh halaman operasional dan administratif, termasuk Pengaturan Toko, aturan diskon promosi, laporan keuangan, manajemen staf, serta backup dan pemulihan data terenkripsi.

| Peran | Persona | Cakupan Hak Akses |
| :--- | :--- | :--- |
| 👑 **Owner** | Persona Pemilik Toko | Akses administratif tanpa batas (Pengaturan, Laporan, Manajemen Staf, Keuangan, Inventaris, Backup & Restore) |
| ☕ **Staf / Kasir** | Persona Kasir 1 | Operasional meja kasir (Kasir POS, riwayat pesanan, status inventaris, manajemen shift) |
| ☕ **Staf / Kasir** | Persona Kasir 2 | Operasional meja kasir (Kasir POS, riwayat pesanan, status inventaris, manajemen shift) |

> 💡 **Mengakses Akun Demo:**
> Pengunjung dapat dengan mudah mengisi kredensial login untuk peran apa pun dengan mengeklik tombol pembantu **"Akun Demo"** di halaman login. Tombol ini akan otomatis mengisikan data akun yang dipilih tanpa perlu mengetik manual. Ini adalah fitur interaktif untuk kemudahan evaluasi portofolio, bukan sistem keamanan autentikasi produksi.
>
> *Catatan Autentikasi:* Autentikasi pengguna dan pengecekan PIN staf disimulasikan secara lokal di dalam mock store sisi klien. Kata sandi akun demo disimpan dalam teks biasa untuk kemudahan pengujian dan tidak di-hash secara kriptografis.

---

## Dataset Mock Relasional

Inisialisasi awal aplikasi menyediakan dataset realistis untuk operasional coffee shop:

- **Pengguna:** 3 akun (1 Owner, 2 Kasir) dengan profil autentikasi dan PIN transaksi bawaan.
- **Kategori:** 6 kategori menu (Signature Coffee, Classic Espresso, Manual Brew, Tea & Beverages, Pastries, Main Course).
- **Produk:** 15 item menu dengan harga modal, harga jual, kategori, dan tautan resep bahan baku.
- **Bahan Baku Mentah (Stok):** 13 item inventaris yang dilacak (Biji Kopi, Susu Segar, Susu Oat, Sirup Vanila, Saus Karamel, Cup, Sedotan, dll.).
- **Resep Standar:** 15 komposisi bahan baku (BOM) per item menu.
- **Pesanan Historis:** 50 transaksi yang tersebar dalam 30 hari terakhir untuk visualisasi grafik analitik yang kaya.
- **Pesanan Pembelian (PO):** 7 faktur pembelian bahan baku masuk dari pemasok.
- **Log Mutasi Stok:** 25 riwayat catatan penyesuaian dan mutasi inventaris.
- **Aturan Promosi:** 3 aturan diskon bertingkat (Happy Hour, Promo Akhir Pekan, Diskon Volume).
- **Konfigurasi Toko:** Identitas toko, tarif pajak (5%), dan catatan kaki struk belanja.

---

## Panduan Memulai

### Prasyarat
- **Node.js:** `>= 20.19.0` atau `>= 22.12.0` (disarankan versi LTS)
- **Package Manager:** `npm` (`v9.x`+) atau `pnpm`

### Langkah Instalasi

1. **Clone Repositori:**
   ```bash
   git clone <repository-url>
   cd Booth-Daily-demo
   ```

2. **Instal Dependensi:**
   ```bash
   npm install
   ```

3. **Jalankan Development Server:**
   ```bash
   npm run dev
   ```
   Buka browser dan akses alamat `http://localhost:3000` (dikonfigurasi via `--port=3000 --host=0.0.0.0`).

---

## Build Produksi & Deployment

### Kompilasi Build Statis:
```bash
npm run build
```
Berkas bundel statis yang teroptimasi akan dihasilkan di folder `dist/`. Ukuran chunk JavaScript utama sekitar ~126 kB gzipped (~469 kB uncompressed, ditambah ~18 kB gzipped CSS). Chunk halaman lain dan modul ekspor dokumen (SheetJS, jsPDF) dimuat secara lazy load saat dibutuhkan, menjaga kecepatan muat awal halaman tetap optimal.

### Preview Lokal Hasil Build Produksi:
```bash
npm run preview
```

### Panduan Deployment Hosting Statis:
- **Vercel:** Telah menyertakan berkas konfigurasi `vercel.json` dengan aturan rewrite SPA (`"source": "/:path*", "destination": "/index.html"`).
- **Netlify:** Atur build command ke `npm run build` dan publish directory ke `dist`.
- **GitHub Pages / Cloudflare Pages:** Pastikan konfigurasi pengalihan rute mengarahkan rute yang tidak terdaftar ke `/index.html`.

---

## Validasi & Pengujian Otomatis

Repositori ini menyertakan skrip validasi otomatis untuk memverifikasi integritas data, perhitungan matematis, dan alur interaksi pengguna:

```bash
# 1. Verifikasi Integritas Mock Data & Hubungan Relasional
npm run validate:mock

# 2. Validasi Adaptor Service Layer & Repositories
npm run validate:phase2

# 3. Validasi Alur Checkout, Pengurangan Stok Resep & Pembuatan Pesanan
npm run validate:phase3

# 4. Validasi Operasi CRUD Penuh, Peran Staf & Pengembalian Stok Refund
npm run validate:phase4

# 5. Validasi Integrasi Standalone, Guest Checkout & Pengecekan Keamanan
npm run validate:phase5

# 6. Pengecekan Tipe Statis TypeScript (tsc --noEmit)
npm run lint

# 7. Verifikasi Kompilasi Build Produksi Vite
npm run build
```

---

## Reset Data Demo

Untuk mengembalikan data aplikasi ke kondisi awal pabrik (factory seed) kapan saja:
1. Buka menu **Pengaturan (Settings)** sebagai akun Owner, lalu klik tombol **"Muat Ulang Seluruh Data Toko (Factory Reset)"**. Tindakan ini akan mengembalikan seluruh dataset relasional ke kondisi awal.

> 🛠️ **Pemecahan Masalah State:** Jika status penyimpanan browser mengalami kendala selama pengujian, menghapus kunci LocalStorage `boothdaily_demo_store` di Developer Tools browser dan memuat ulang halaman (*refresh*) juga akan memicu inisialisasi ulang data awal secara bersih.

---

## Struktur Proyek

```text
Booth-Daily-demo/
├── docs/
│   ├── HISTORICAL_AUDIT_SUMMARY.md # Catatan rekayasa dan ringkasan audit historis
│   └── screenshots/              # Screenshot showcase aplikasi beresolusi tinggi
│       ├── dashboard.png
│       ├── inventory.png
│       ├── pos.png
│       ├── reports.png
│       └── settings.png
├── src/
│   ├── assets/                   # Logo aplikasi dan ikonografi
│   ├── components/               # Komponen UI & modal yang dapat digunakan kembali
│   │   ├── common/               # ConfirmDialog, NumberInput, PINModal, ReceiptModal
│   │   ├── layout/               # Header, Sidebar, MobileMenu, BottomNav
│   │   ├── pos/                  # ProductCard, CartSidebar, CategoryBar, CloseShiftModal
│   │   ├── settings/             # DiscountRuleModal, BackupModal, RestoreModal
│   │   └── transactions/         # TransactionDetailModal, RefundModal
│   ├── context/                  # React Context & facade domain hook (POSContext)
│   ├── layouts/                  # MainLayout dengan kerangka navigasi responsif
│   ├── mock/                     # Infrastruktur mock mandiri
│   │   ├── data/                 # Data seed (produk, resep, pesanan, stok, pengguna)
│   │   ├── persistence/          # Lapisan persistensi LocalStorage
│   │   ├── repositories/         # Repository kueri & mutasi data relasional
│   │   ├── store.ts              # Store reaktif terpusat
│   │   └── validation/           # Skrip pengujian validasi otomatis
│   ├── pages/                    # Halaman rute utama (POS, Dashboard, Inventory, dll.)
│   ├── services/                 # Layanan logika bisnis (pesanan, stok, backup, ekspor)
│   ├── types/                    # Antarmuka TypeScript & tipe domain bersama
│   ├── utils/                    # Helper perhitungan, pemformat struk, kalkulasi shift
│   ├── App.tsx                   # Konfigurasi router utama & pelindung rute
│   └── main.tsx                  # Titik masuk utama aplikasi
├── package.json
├── tsconfig.json
├── vercel.json
├── vite.config.ts
└── README.md
```

---

## Tentang Proyek Ini

Proyek ini dikembangkan sebagai demonstrasi portofolio rekayasa perangkat lunak frontend untuk menampilkan orkestrasi state yang kompleks, logika operasional point-of-sale ritel, dan desain antarmuka responsif dalam lingkungan sisi klien yang sepenuhnya mandiri.
