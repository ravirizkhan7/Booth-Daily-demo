/**
 * SMART DEMO CONVERSION — PACKAGES & WHATSAPP URL BUILDER
 * Workspace: D:\project\Booth-Daily-demo
 */

import { WHATSAPP_CONFIG } from './watermark.config';

export type PackageId = 'basic' | 'business' | 'premium';

export interface PackageInfo {
  id: PackageId;
  name: string;
  monthlyPrice: number;
  priceLabel: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  badge?: string;
}

export const PACKAGE_DISCLAIMER =
  'Harga dan fitur bersifat ilustrasi untuk demo. Detail final dikonfirmasi melalui konsultasi.';

export const CONVERSION_PACKAGES: Record<PackageId, PackageInfo> = {
  basic: {
    id: 'basic',
    name: 'Booth Basic',
    monthlyPrice: 49000,
    priceLabel: 'Rp 49.000 / bln',
    description: 'Solusi kasir efisien untuk operasional booth harian.',
    features: [
      'Pencatatan transaksi kasir harian',
      'Manajemen katalog produk & kategori',
      'Laporan penjualan ringkas',
      'Dukungan cetak struk digital & fisik',
    ],
  },
  business: {
    id: 'business',
    name: 'Booth Business',
    monthlyPrice: 99000,
    priceLabel: 'Rp 99.000 / bln',
    description: 'Pilihan populer untuk booth berkembang dengan manajemen bahan baku & shift.',
    features: [
      'Semua fitur Booth Basic',
      'Pencatatan stok bahan baku & opname',
      'Manajemen buka & tutup shift kasir',
      'Ekspor laporan lengkap (Excel & PDF)',
      'Pengaturan diskon & promosi',
    ],
    isPopular: true,
    badge: 'Rekomendasi',
  },
  premium: {
    id: 'premium',
    name: 'Booth Premium',
    monthlyPrice: 199000,
    priceLabel: 'Rp 199.000 / bln',
    description: 'Paket terlengkap untuk analisis performa mendalam dan operasional lanjutan.',
    features: [
      'Semua fitur Booth Business',
      'Analisis tren penjualan & jam sibuk',
      'Dukungan multi-kasir & multi-role',
      'Prioritas bantuan operasional',
    ],
    badge: 'Lengkap',
  },
};

export const CONVERSION_PACKAGES_LIST: PackageInfo[] = [
  CONVERSION_PACKAGES.basic,
  CONVERSION_PACKAGES.business,
  CONVERSION_PACKAGES.premium,
];

/**
 * Validasi ketat package ID.
 * Mengembalikan true hanya jika ID terdaftar resmi ('basic' | 'business' | 'premium').
 */
export function isPackageId(value: unknown): value is PackageId {
  return value === 'basic' || value === 'business' || value === 'premium';
}

/**
 * Membangun URL WhatsApp resmi.
 * 
 * Aturan Mutlak:
 * 1. Jika package ID tidak valid, fungsi mengembalikan null (TIDAK ADA fallback otomatis ke paket lain).
 * 2. Pesan strictly ZERO PII: tidak memuat data kasir, nama pengguna, PIN, ID order, atau nominal transaksi.
 * 3. Tidak mengklaim registrasi atau pembelian telah selesai; hanya menyatakan minat konsultasi.
 */
export function buildWhatsAppConversionUrl(packageId: unknown): string | null {
  if (!isPackageId(packageId)) {
    return null;
  }

  const pkg = CONVERSION_PACKAGES[packageId];
  if (!pkg) {
    return null;
  }

  const message =
    `Halo Tim Booth Daily, saya tertarik mencoba sistem kasir Booth Daily setelah mencoba demo interaktif.\n\n` +
    `Paket yang ingin saya tanyakan: ${pkg.name} (${pkg.priceLabel}).\n` +
    `Mohon informasi lebih lanjut mengenai aktivasi dan alur setup sistem untuk bisnis saya. Terima kasih!`;

  return `https://wa.me/${WHATSAPP_CONFIG.PHONE_NUMBER}?text=${encodeURIComponent(message)}`;
}

