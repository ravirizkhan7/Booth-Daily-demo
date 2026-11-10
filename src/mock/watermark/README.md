# Smart Demo Conversion (Adaptive Mode)
**Workspace:** `D:\project\Booth-Daily-demo\src\mock\watermark\`

Modul ini mengimplementasikan fitur konversi adaptif untuk demo interaktif Booth Daily POS. Sistem mendeteksi intensitas interaksi pengguna berdasarkan aktivitas nyata (transaksi, shift, produk, inventori, pembelian, kategori, ekspor laporan, dan retensi lintas hari) dan menampilkan edukasi paket layanan secara bertahap dan non-intrusif.

---

## 1. Arsitektur File (Maksimal 9 File Flat)

```text
src/mock/watermark/
├── README.md                     (1) Dokumentasi teknis & panduan arsitektur
├── watermark.config.ts           (2) Single source of truth nilai bobot, cap, tier, & cooldown
├── watermark.packages.ts         (3) Data paket layanan (Basic, Business, Premium) & URL WhatsApp
├── watermark.activity.ts         (4) Decoupled activity event bus, ledger, & scoring engine
├── watermark.storage.ts          (5) Storage manager, multi-tab sync, & in-memory fallback
├── WatermarkProvider.tsx         (6) React Context Provider, lifecycle, & POS modal safety gate
├── ConversionNotification.tsx    (7) UI Floating pill untuk Tier Engaged (sudut kanan bawah)
├── ConversionModal.tsx           (8) Dialog modal edukatif untuk Tier Active/Intensive
└── PackageSelectionModal.tsx     (9) Dialog perbandingan paket & CTA konsultasi WhatsApp
```

---

## 2. Model Scoring & Capping Lifetime (Maksimal 68 Poin)

| Aktivitas | Bobot Skor | Cap Aksi Lifetime | Poin Maksimal |
| :--- | :---: | :---: | :---: |
| Transaksi Berhasil | +3 | 5 kali | 15 poin |
| Buka/Tutup Shift | +3 | 3 kali | 9 poin |
| Tambah/Edit Produk | +2 | 5 kali | 10 poin |
| Mutasi Stok (Inventory) | +2 | 5 kali | 10 poin |
| Pembelian Baru | +2 | 3 kali | 6 poin |
| Tambah/Edit Kategori | +1 | 5 kali | 5 poin |
| Ekspor Laporan (Excel/PDF) | +1 | 3 kali | 3 poin |
| Kunjungan Lintas Hari | +5 | 2 hari berbeda | 10 poin |
| **TOTAL MAKSIMAL** | — | **31 Aksi** | **68 Poin** |

### Aturan Ketat:
- **Penghapusan data bernilai 0 poin** (hapus produk/kategori/stok tidak menambah skor).
- **Aksi gagal bernilai 0 poin**.
- **Data seed awal tidak pernah dihitung** (cold start selalu mulai dari 0 poin).
- **Deduplikasi kunci deterministik** mencegah aksi yang sama dihitung dua kali.
- **In-memory suppression (3 detik)** mencegah spam pada aksi edit dan ekspor.

---

## 3. Ambang Batas Tier & Perilaku Prompt

Tier diturunkan secara murni dari skor (`deriveTier(score)`):

- **EXPLORER (0–9 poin):** Senyap (*silent*), tanpa prompt UI apapun.
- **ENGAGED (10–24 poin):** `ConversionNotification` floating pill (auto-hide 8 detik, max 3x seumur demo, cooldown 5 menit).
- **ACTIVE (25–49 poin):** `ConversionModal` versi standar (auto-modal max 1x seumur demo).
- **INTENSIVE (50–68 poin):** `ConversionModal` versi Intensive (auto-modal max 1x seumur demo).

---

## 4. Keamanan Modal Kasir (POS Safety Gate) & Grace Period

Prompt konversi **tidak pernah diizinkan memotong atau menutupi alur operasional kasir**.

1. **Context Gate:** Memeriksa `isPinModalOpen`, `isReceiptModalOpen`, `isLoginModalOpen`, `isLogoutModalOpen`, `isEditAccountModalOpen`, `isOpenShiftModalOpen`, `isCloseShiftModalOpen`, serta status modal resep produk.
2. **DOM Gate:** Memeriksa elemen `.fixed.inset-0` atau `[aria-modal="true"]` yang bukan milik `[data-smart-demo]`.
3. **Grace Period (3 Detik):** Setelah modal POS ditutup, sistem menunggu 3 detik sebelum mengeksekusi prompt tertunda (*pending prompt*). Jika selama 3 detik kasir membuka modal baru, timer dibatalkan secara aman.

---

## 5. Cooldown Terpisah

- **Notification Cooldown:** 5 menit antar notifikasi.
- **Modal Cooldown:** 15 menit antar pemunculan modal.
- **Dismissal Cooldown:** 30 menit setelah pengguna menekan "Nanti Saja", tombol X, Escape, atau klik backdrop. Berlaku untuk seluruh tier (termasuk Intensive).
- **WhatsApp Cooldown:** 60 menit setelah tautan WhatsApp diklik.

---

## 6. Integrasi WhatsApp & Zero PII

- CTA utama berupa link `<a>` standar dengan atribut `target="_blank"` dan `rel="noopener noreferrer"`.
- URL mengarah ke nomor placeholder internasional `6280000000000`.
- Pesan strictly **ZERO PII**: hanya memuat template salam umum dan nama paket terpilih. Tidak ada nama kasir, PIN, ID order, maupun omzet yang dikirim.
- Paket yang didukung: `basic`, `business`, `premium`. ID yang tidak dikenal menghasilkan `null` (tidak ada fallback sembarangan).

