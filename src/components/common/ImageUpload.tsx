import React, { useRef, useState, useCallback, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { UploadCloud, X, AlertCircle, Check, ZoomIn } from 'lucide-react';
import { getCroppedCompressedFile } from '../../services/imageProcessing';

interface AspectOption {
  label: string;
  value: number; // width / height
}

const ASPECT_OPTIONS: AspectOption[] = [
  { label: '1:1', value: 1 },
  { label: '3:4', value: 3 / 4 },
  { label: '4:3', value: 4 / 3 },
];

interface ImageUploadProps {
  /** URL foto yang sudah tersimpan di server (mode edit). */
  value?: string;
  /**
   * Dipanggil dengan File hasil crop + compress ketika user memilih &
   * mengonfirmasi foto baru, atau `null` ketika foto dihapus.
   * Kalau user tidak mengubah apa-apa, fungsi ini tidak dipanggil sama
   * sekali — artinya foto lama di server tetap dipakai.
   */
  onFileChange: (file: File | null) => void;
  label?: string;
  error?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onFileChange,
  label = 'Foto Produk',
  error,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Preview foto final (hasil crop) yang ditampilkan di luar modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // State untuk modal crop
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [rawFileName, setRawFileName] = useState<string>('foto-produk');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number>(ASPECT_OPTIONS[0].value);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

  // Bersihkan object URL preview lama supaya tidak bocor memori
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const openCropModalWithFile = (file: File) => {
    setLocalError('');

    if (!allowedTypes.includes(file.type)) {
      setLocalError('Format file tidak didukung. Gunakan JPG, JPEG, PNG, atau WEBP.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawImageSrc(reader.result);
        setRawFileName(file.name);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setAspect(ASPECT_OPTIONS[0].value);
        setCroppedAreaPixels(null);
        setIsCropOpen(true);
      }
    };
    reader.onerror = () => setLocalError('Gagal membaca file gambar.');
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) openCropModalWithFile(file);
    // reset input supaya bisa pilih file yang sama lagi kalau perlu
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) openCropModalWithFile(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setLocalError('');
    onFileChange(null);
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPx: Area) => {
    setCroppedAreaPixels(croppedAreaPx);
  }, []);

  const handleCancelCrop = () => {
    setIsCropOpen(false);
    setRawImageSrc(null);
  };

  const handleConfirmCrop = async () => {
    if (!rawImageSrc || !croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const file = await getCroppedCompressedFile(rawImageSrc, croppedAreaPixels, rawFileName);

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const newPreviewUrl = URL.createObjectURL(file);

      setPreviewUrl(newPreviewUrl);
      onFileChange(file);
      setIsCropOpen(false);
      setRawImageSrc(null);
    } catch (err) {
      setLocalError('Gagal memproses gambar. Coba foto lain.');
    } finally {
      setIsProcessing(false);
    }
  };

  const displayedImage = previewUrl || value || '';

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
          {label}
        </label>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
      />

      {displayedImage ? (
        <div className="relative group rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-[#151312] aspect-video flex items-center justify-center">
          <img
            src={displayedImage}
            alt="Preview"
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white/90 text-stone-900 rounded-xl text-xs font-bold shadow hover:bg-white transition-colors"
            >
              Ubah Gambar
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold shadow hover:bg-rose-700 transition-colors"
              title="Hapus Gambar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-2 ${isDragging
            ? 'border-[#3B2A1F] dark:border-[#D4A373] bg-[#3B2A1F]/5 dark:bg-[#D4A373]/5'
            : 'border-stone-300 dark:border-stone-700 hover:border-[#3B2A1F] dark:hover:border-[#D4A373] bg-stone-50/50 dark:bg-[#151312]/50'
            }`}
        >
          <div className="w-10 h-10 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500">
            <UploadCloud className="w-5 h-5 text-[#3B2A1F] dark:text-[#D4A373]" />
          </div>
          <div>
            <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
              Klik atau seret file gambar ke sini
            </p>
            <p className="text-[10px] text-stone-400 font-medium mt-0.5">
              Format: JPG, JPEG, PNG, WEBP — ukuran bebas, akan dikompres otomatis
            </p>
          </div>
        </div>
      )}

      {(error || localError) && (
        <div className="flex items-center gap-1.5 text-rose-600 text-xs font-bold pt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error || localError}</span>
        </div>
      )}

      {/* Modal Crop */}
      {isCropOpen && rawImageSrc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl w-full max-w-lg shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 px-5 py-3.5">
              <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100">
                Atur & Crop Foto
              </h3>
              <button
                type="button"
                onClick={handleCancelCrop}
                className="p-1.5 rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Area crop */}
            <div className="relative w-full h-80 bg-stone-900">
              <Cropper
                image={rawImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="p-5 space-y-4">
              {/* Pilihan rasio */}
              <div>
                <p className="text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1.5">
                  Rasio Foto
                </p>
                <div className="flex items-center gap-2">
                  {ASPECT_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setAspect(opt.value)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${aspect === opt.value
                        ? 'bg-[#3B2A1F] text-[#F7F5F2] border-[#3B2A1F]'
                        : 'bg-stone-50 dark:bg-[#171514] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-stone-300'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zoom */}
              <div>
                <p className="text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1.5 flex items-center gap-1">
                  <ZoomIn className="w-3.5 h-3.5" /> Zoom
                </p>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-[#3B2A1F]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCancelCrop}
                  disabled={isProcessing}
                  className="px-4 py-2.5 rounded-xl font-bold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCrop}
                  disabled={isProcessing || !croppedAreaPixels}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-extrabold shadow-md transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    'Memproses...'
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Gunakan Foto
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};