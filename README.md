# ☕ Booth Daily — Standalone Functional Portfolio Demo

Aplikasi web **Point of Sale (POS) & Coffee Shop Management System** modern, cepat, dan responsif. Proyek ini merupakan **Standalone Functional Portfolio Showcase** yang berjalan **100% di sisi client (browser)** menggunakan arsitektur **Mock Repository & Reactive Local Storage Store**, tanpa memerlukan server backend Laravel, database MySQL, ataupun koneksi WebSocket eksternal.

Dibangun dengan **React 19**, **TypeScript**, **Vite 8**, dan **Tailwind CSS v4**, aplikasi ini mendemonstrasikan seluruh alur bisnis POS nyata: mulai dari pemilihan menu, diskon otomatis, kalkulasi pajak, otorisasi PIN kasir, pengurangan stok berbasis resep, mutasi inventaris, pencetakan struk termal, manajemen CRUD multi-entitas, hingga ekspor laporan spreadsheet Excel dan dokumen PDF.

---

## 📋 Daftar Isi

1. [Tujuan Portofolio](#-tujuan-portofolio)
2. [Fitur Utama](#-fitur-utama)
3. [Teknologi & Stack](#-teknologi--stack)
4. [Arsitektur Standalone Demo](#-arsitektur-standalone-demo)
5. [Arsitektur Mock Data & Entitas](#-arsitektur-mock-data--entitas)
6. [Akun Demo & Kredensial](#-akun-demo--kredensial)
7. [Alur Transaksi Kasir & Checkout](#-alur-transaksi-kasir--checkout)
8. [Manajemen CRUD & Fitur Administrasi](#-manajemen-crud--fitur-administrasi)
9. [Instalasi & Menjalankan Proyek](#-instalasi--menjalankan-proyek)
10. [Panduan Build & Deployment](#-panduan-build--deployment)
11. [Suite Pengujian & Validasi Otomatis](#-suite-pengujian--validasi-otomatis)
12. [Reset Data Demo](#-reset-data-demo)
13. [Batasan & Catatan Sumber Daya Eksternal](#-batasan--catatan-sumber-daya-eksternal)
14. [Lisensi](#-lisensi)

---

## 🎯 Tujuan Portofolio

Proyek ini dirancang sebagai demonstrasi portofolio profesional untuk menampilkan:
- **Arsitektur Frontend Skala Menengah ke Atas**: Pola *Domain Hooks*, *Service Layer Adapters*, *In-Memory Store Mutation*, dan *Route-Based Code Splitting*.
- **Interaksi Bisnis Lengkap**: Logika kalkulasi POS, diskon bertingkat, penyesuaian porsi resep bahan baku, audit trail mutasi stok, dan pembatasan otorisasi peran (*Owner* vs *Karyawan*).
- **Zero Backend Hosting Overhead**: Seluruh fitur dapat diuji secara langsung melalui browser statis (*Vercel, Netlify, GitHub Pages*) dengan performa instan dan konsistensi data penuh antar sesi pengguna.

---

## ✨ Fitur Utama

* **Kasir POS Cepat & Responsif**:
  - Pemilihan menu berbasis kategori horizontal dan pencarian teks cepat.
  - Pilihan tipe pesanan (*Dine In* dan *Take Away*) dengan opsi catatan barista (*Less Sugar, No Ice, Extra Shot*, dll.).
  - Metode pembayaran resmi: **Cash** (dengan kalkulasi otomatis uang diterima dan kembalian) serta **QRIS** (nominal pas).
* **Otorisasi Transaksi PIN Terisolasi**:
  - Mode **Guest** memungkinkan kasir langsung memproses transaksi di POS tanpa login akun penuh.
  - Verifikasi keamanan transaksi melalui **PIN Kasir / Owner** (4 digit) tanpa *privilege escalation* terhadap sesi frontend.
* **Pengurangan Stok Otomatis Berbasis Resep (*Recipe Stock Deduction*)**:
  - Setiap produk terhubung dengan komposisi bahan baku gram/ml.
  - Saat pesanan berhasil, stok bahan baku berkurang secara atomik dan mencatat riwayat mutasi (*Stock History*).
  - Indikator ketersediaan menu mendeteksi secara otomatis jika bahan menipis atau habis (*Sold Out*).
* **Pencetakan Struk Termal 80mm**:
  - Struk belanja terformat rapi dengan nomor pesanan unik `ORD-YYYYMMDD-XXXX`, tanggal, kasir, rincian item, diskon, pajak, dan kembalian.
  - Fitur simulasi cetak struk termal via *isolated iframe* browser dan tombol salin teks struk ke clipboard.
* **Manajemen CRUD Multi-Entitas**:
  - **Produk & Kategori**: Tambah, edit, hapus produk, dan tandai menu favorit.
  - **Resep Minuman**: Atur estimasi waktu seduh, komposisi bahan baku, instruksi langkah pembuatan, tips barista, dan upload/crop foto.
  - **Inventori Bahan Baku**: Pantau status stok (Aman, Menipis, Habis), update stok cepat (*Stock In / Out*), dan telusuri log mutasi historis.
  - **Pembelian Bahan (*Purchase Orders*)**: Catat faktur belanja supplier yang secara otomatis menambah stok bahan baku.
  - **Karyawan & Hak Akses**: Manajemen staf dengan role *Owner* dan *Karyawan*, PIN unik, serta pengaturan kredensial.
  - **Aturan Diskon Promo**: Diskon persentase bertingkat dengan syarat minimal belanja.
  - **Pengaturan Toko**: Nama booth, alamat, nomor telepon, footer struk, dan persentase tarif pajak.
* **Refund Transaksi & Pemulihan Stok**:
  - Fitur refund pesanan yang otomatis mengembalikan stok bahan baku ke inventaris dan mencatat mutasi pengembalian.
* **Dashboard & Laporan Finansial**:
  - Visualisasi grafik tren penjualan mingguan, bulanan, dan tahunan.
  - Metrik omzet, laba kotor, HPP (*Cost of Goods Sold*), dan ringkasan metode pembayaran.
  - Ekspor laporan spreadsheet Excel (`.xlsx`) dan dokumen formal PDF (`.pdf`) secara instan (*Client-Side Lazy Loading*).
* **Desain UI/UX Modern & Aksesibel**:
  - Dukungan penuh **Light Mode** (*Warm Coffee & Cream*) dan **Dark Mode** (*Deep Charcoal*).
  - Responsif sempurna dari layar mobile ultra-compact (320px, 375px), tablet (768px, 1024px), hingga desktop lebar (1440px+).

---

## 🛠️ Teknologi & Stack

* **Frontend Framework**: React 19 (`react: ^19.2.8`, `react-dom: ^19.2.8`)
* **Bahasa & Typing**: TypeScript (`typescript: ~7.0.2`)
* **Build Tool & Bundler**: Vite 8 (`vite: ^8.2.1`, `@vitejs/plugin-react: ^6.0.5`)
* **Styling**: Tailwind CSS v4 (`tailwindcss: ^4.3.3`, `@tailwindcss/vite: ^4.3.3`)
* **Routing**: React Router DOM v7 (`react-router-dom: ^7.18.2`)
* **Icons**: Lucide React (`lucide-react: ^1.31.0`)
* **Image Cropping**: React Easy Crop (`react-easy-crop: ^6.2.3`)
* **Lazy Document Exporters**:
  - jsPDF & jsPDF-AutoTable (`jspdf: ^4.2.1`, `jspdf-autotable: ^5.0.8`)
  - SheetJS (`xlsx: 0.20.3`)
* **State & Persistence**: In-Memory Reactive Store + LocalStorage Layer (`boothdaily_demo_store`)
* **Test & Validation**: TypeScript execution (`tsx: ^4.23.12`)

---

## 🏛️ Arsitektur Standalone Demo

Aplikasi menggunakan pola **Service Adapter & In-Memory Central Store**:

```text
┌─────────────────────────────────────────────────────────────┐
│                          UI Pages                           │
│  (POSPage, DashboardPage, ProductsPage, ReportsPage, dll.)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 React Context & Custom Hooks                │
│                 (POSContext & usePOS() Facade)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Service Layer Orchestration                 │
│    (transactionService, orderService, productService, dll.) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Mock Repositories Layer                     │
│    (productRepository, orderRepository, stockRepository)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Central Reactive Mock Store                  │
│       (Atomic Mutations, Relational Integrity & Snapshot)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               Browser LocalStorage Persistence              │
│                 key: "boothdaily_demo_store"                │
└─────────────────────────────────────────────────────────────┘
```

- **Zero Backend HTTP Calls**: Tidak ada permintaan jaringan HTTP ke server backend saat runtime normal aplikasi.
- **WebSocket Isolation**: Menggunakan `SafeChannelStub` bebas error untuk mengisolasi event channel tanpa koneksi Pusher/Reverb nyata.

---

## 📊 Arsitektur Mock Data & Entitas

Aplikasi menyediakan dataset awal yang komprehensif dan saling terhubung secara relasional:

1. **Users** (3 akun demo: 1 Owner, 2 Karyawan)
2. **Categories** (6 kategori menu)
3. **Products** (15 varian minuman & makanan)
4. **Stocks** (13 bahan baku dengan unit gram, ml, pcs, dll.)
5. **Recipes** (15 resep standar dengan komposisi bahan & waktu penyajian)
6. **Orders** (50 transaksi historis 30 hari terakhir)
7. **Purchases** (7 faktur pembelian bahan supplier)
8. **Stock Histories** (25 riwayat mutasi stok)
9. **Discount Rules** (3 aturan promo diskon bertingkat)
10. **Settings** (Pengaturan toko Booth Daily & tarif pajak 5%)

---

## 🔑 Akun Demo & Kredensial

Pengunjung portofolio dapat mencoba berbagai peran pengguna melalui tombol **"Akun Demo"** pada kartu login:

| Peran (*Role*) | Nama Lengkap | Email | Username | Password | PIN Transaksi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 👑 **Owner** | Hendro Wijaya | `owner@boothdaily.com` | `hendro` | `demo123` | **`1234`** |
| ☕ **Karyawan** | Dinda Lestari | `dinda@boothdaily.com` | `dinda` | `demo123` | **`5678`** |
| ☕ **Karyawan** | Budi Santoso | `budi@boothdaily.com` | `budi` | `demo123` | **`9012`** |

> **Panduan Penggunaan:**
> - **Password** (`demo123`) digunakan saat melakukan login masuk ke sistem manajemen.
> - **PIN Transaksi** (4 digit) digunakan untuk otorisasi cepat saat kasir memproses pesanan di POS.

---

## 🛒 Alur Transaksi Kasir & Checkout

```text
Katalog Menu → Keranjang (Cart) → Pilih Dine In / Take Away
   ↓
Klik "Bayar Sekarang"
   ↓
Modal PIN & Pembayaran (Cash / QRIS)
   ↓
Verifikasi PIN Kasir (4 Digit)
   ↓
Validasi Pembayaran & Stok Bahan Baku
   ↓
Buat Pesanan (ORD-YYYYMMDD-XXXX) & Kurangi Stok Otomatis
   ↓
Catat Mutasi Stock History & Perbarui State Toko
   ↓
Buka Modal Struk Belanja → Cetak Termal 80mm / Salin Teks
```

---

## 🛠️ Manajemen CRUD & Fitur Administrasi

- **Dashboard**: Analisis performa omzet harian, laba kotor, dan grafik penjualan real-time.
- **Produk & Kategori**: Manajemen katalog menu, harga jual, estimasi HPP, kategori, dan toggle status aktif.
- **Resep Minuman**: Konfigurasi takaran bahan per cup, instruksi seduh, dan tips barista.
- **Inventori & Stok**: Audit stok real-time, update stok masuk/keluar, dan log mutasi terperinci.
- **Pembelian Bahan (PO)**: Catat belanja bahan baku dari supplier yang otomatis menambah kuantitas stok.
- **Karyawan**: Pengelolaan data staf, peran akses (*Owner* / *Karyawan*), dan reset PIN transaksi.
- **Pengaturan & Diskon**: Aturan promo diskon belanja otomatis dan tarif pajak toko.
- **Laporan Finansial**: Rekapitulasi penjualan, pembelian, arus kas, top menu terlaris, dan ekspor instan (.xlsx / .pdf).

---

## 🚀 Instalasi & Menjalankan Proyek

### Prasyarat:
- **Node.js**: `>= 18.x` atau `>= 20.x` (LTS direkomendasikan)
- **NPM**: `>= 9.x`

### 1. Clone Repository
```bash
git clone <repository-url>
cd Booth-Daily-demo
```

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Jalankan Development Server
```bash
npm run dev
```
Akses aplikasi melalui browser di `http://localhost:3000`.

---

## 📦 Panduan Build & Deployment

### 1. Build untuk Produksi
```bash
npm run build
```
Hasil kompilasi teroptimasi akan dihasilkan di direktori `dist/` ($~130$ kB gzipped untuk initial bundle).

### 2. Preview Hasil Build
```bash
npm run preview
```

### 3. Deployment ke Static Hosting
Aplikasi dapat dideploy secara instan ke platform hosting statis:
- **Vercel**: Repository sudah menyertakan konfigurasi `vercel.json` untuk SPA routing rewrite.
- **Netlify**: Gunakan build command `npm run build` dan publish directory `dist`.
- **GitHub Pages / Cloudflare Pages**: Pastikan fallback routing diarahkan ke `index.html`.

---

## 🧪 Suite Pengujian & Validasi Otomatis

Proyek dilengkapi dengan 5 suite validasi relasional dan fungsional berbasis TypeScript:

```bash
# 1. Validasi Mock Data Foundation & Integritas Relasional
npm run validate:mock

# 2. Validasi Mock Repositories & Service Layer Adapters
npm run validate:phase2

# 3. Validasi Checkout Flow, Pengurangan Stok & Order Creation
npm run validate:phase3

# 4. Validasi Full CRUD Management, Dynamic Auth & Refunds
npm run validate:phase4

# 5. Validasi Standalone Integration, Guest Checkout & Role Isolation
npm run validate:phase5

# 6. Pengecekan TypeScript Type Checking
npm run lint

# 7. Verifikasi Build Produksi Vite
npm run build
```

---

## 🔄 Reset Data Demo

Jika dataset telah dimodifikasi selama pengujian dan Anda ingin mengembalikannya ke kondisi awal:
1. Masuk ke halaman **Pengaturan** (sebagai Owner) dan klik tombol **"Muat Ulang Seluruh Data Toko"**, atau
2. Hapus kunci `boothdaily_demo_store` dari LocalStorage browser (*F12 → Application → Local Storage*), lalu muat ulang (*refresh*) halaman.

---

## ⚠️ Batasan & Catatan Sumber Daya Eksternal

- **100% Client-Side Standalone**: Aplikasi tidak membutuhkan server backend API, database MySQL, atau WebSocket aktif untuk menjalankan seluruh alurnya.
- **Sumber Daya Gambar**: Foto produk dan avatar pengguna menggunakan kombinasi aset statis lokal (`src/assets/icon.png`) serta URL gambar demo (Unsplash CDN). Koneksi internet hanya dibutuhkan jika browser ingin memuat gambar dari Unsplash CDN.

---

## 📄 Lisensi

Proyek ini dipersiapkan sebagai portofolio demonstrasi fungsional mandiri (*Standalone Functional Demo*). Seluruh hak cipta desain antarmuka dan kode dilindungi untuk keperluan showcase portofolio pengembang.