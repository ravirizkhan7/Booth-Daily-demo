export interface PixelCropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---- Konfigurasi kompresi (bisa disesuaikan) ----
const MAX_OUTPUT_DIMENSION = 1000; // px, sisi terpanjang hasil crop
const TARGET_MAX_SIZE_BYTES = 200 * 1024; // ~200KB
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.05;
const INITIAL_QUALITY = 0.85;

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (err) => reject(err));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Gagal memproses gambar (toBlob gagal).'));
      },
      'image/jpeg',
      quality
    );
  });
}

async function compressCanvasToTarget(
  canvas: HTMLCanvasElement,
  targetBytes: number
): Promise<Blob> {
  let quality = INITIAL_QUALITY;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > targetBytes && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
    blob = await canvasToBlob(canvas, quality);
    if (quality === MIN_QUALITY) break;
  }

  return blob;
}

export async function getCroppedCompressedFile(
  imageSrc: string,
  pixelCrop: PixelCropArea,
  originalFileName: string
): Promise<File> {
  const image = await createImage(imageSrc);

  let outputWidth = pixelCrop.width;
  let outputHeight = pixelCrop.height;
  const largestSide = Math.max(outputWidth, outputHeight);

  if (largestSide > MAX_OUTPUT_DIMENSION) {
    const scale = MAX_OUTPUT_DIMENSION / largestSide;
    outputWidth = Math.round(outputWidth * scale);
    outputHeight = Math.round(outputHeight * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser tidak mendukung canvas untuk memproses gambar.');
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  const blob = await compressCanvasToTarget(canvas, TARGET_MAX_SIZE_BYTES);

  const baseName = originalFileName.replace(/\.[^/.]+$/, '') || 'foto-produk';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_RAW_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function processLogoImage(
  file: File,
  options: {
    maxDimension?: number;
    format?: 'image/webp' | 'image/png';
    quality?: number;
  } = {}
): Promise<string> {
  const { maxDimension = 512, format = 'image/webp', quality = 0.85 } = options;

  if (!file || !(file instanceof File)) {
    throw new Error('File gambar tidak valid.');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    throw new Error('Format file tidak didukung. Harap gunakan file PNG, JPEG, atau WebP.');
  }

  if (file.size > MAX_RAW_FILE_SIZE) {
    throw new Error('Ukuran file terlalu besar. Maksimal ukuran gambar adalah 5MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const img = await createImage(dataUrl);

        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          throw new Error('Dimensi gambar tidak valid.');
        }

        const maxSide = Math.max(width, height);
        if (maxSide > maxDimension) {
          const ratio = maxDimension / maxSide;
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context tidak tersedia.');
        }

        ctx.drawImage(img, 0, 0, width, height);
        const processedDataUrl = canvas.toDataURL(format, quality);
        resolve(processedDataUrl);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Gagal memproses gambar logo.'));
      }
    };
    reader.readAsDataURL(file);
  });
}