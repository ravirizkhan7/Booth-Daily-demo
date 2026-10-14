import React from 'react';
import { Delete, ShieldAlert } from 'lucide-react';

interface PinKeypadProps {
  pin?: string;
  value?: string;
  onChange: (pin: string) => void;
  maxLength?: number;
  errorMessage?: string;
  label?: string;
  subtitle?: string;
  disabled?: boolean;
  className?: string;
  onComplete?: (pin: string) => void;
}

export const PinKeypad: React.FC<PinKeypadProps> = ({
  pin,
  value,
  onChange,
  maxLength = 4,
  errorMessage,
  label,
  subtitle,
  disabled = false,
  className = '',
  onComplete,
}) => {
  const currentPin = value !== undefined ? value : (pin || '');

  const handleKeyClick = (num: string) => {
    if (disabled) return;
    if (currentPin.length < maxLength) {
      const nextPin = currentPin + num;
      onChange(nextPin);
      if (nextPin.length === maxLength && onComplete) {
        onComplete(nextPin);
      }
    }
  };

  const handleDelete = () => {
    if (disabled) return;
    onChange(currentPin.slice(0, -1));
  };

  const handleClear = () => {
    if (disabled) return;
    onChange('');
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-center space-y-1">
        {label && (
          <label className="block text-[11px] font-extrabold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            {label}
          </label>
        )}
        {subtitle && (
          <p className="text-[11px] text-stone-400 dark:text-stone-500 font-medium">
            {subtitle}
          </p>
        )}

        {/* PIN Dots */}
        <div className="flex justify-center items-center gap-3 my-2.5">
          {Array.from({ length: maxLength }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                currentPin.length > i
                  ? 'bg-[#3B2A1F] dark:bg-[#D4A373] border-[#3B2A1F] dark:border-[#D4A373] scale-110 shadow-sm'
                  : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-[#25221F]'
              }`}
            />
          ))}
        </div>

        {errorMessage && (
          <div className="flex items-center justify-center gap-1.5 p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold animate-shake mt-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* 3x4 On-Screen Keypad Grid */}
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <button
            key={num}
            type="button"
            disabled={disabled}
            onClick={() => handleKeyClick(num)}
            className="py-2.5 bg-white dark:bg-[#25221F] hover:bg-stone-100 dark:hover:bg-[#2F2B27] active:scale-95 text-stone-900 dark:text-[#F7F5F2] font-black text-lg rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={handleClear}
          className="py-2.5 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-xs rounded-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Hapus semua"
        >
          C
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleKeyClick('0')}
          className="py-2.5 bg-white dark:bg-[#25221F] hover:bg-stone-100 dark:hover:bg-[#2F2B27] active:scale-95 text-stone-900 dark:text-[#F7F5F2] font-black text-lg rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={handleDelete}
          className="py-2.5 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center rounded-2xl active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Hapus satu angka"
        >
          <Delete className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
