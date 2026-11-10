import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  allowDecimals?: boolean;
  isCurrency?: boolean;
  allowNegative?: boolean;
}

/**
 * Helper to determine the cursor offset in a formatted string
 * based on the number of actual digits that should appear before the cursor.
 */
export function getCursorPositionFromDigitCount(
  formattedStr: string,
  targetDigits: number,
  hasLeadingMinus = false
): number {
  if (targetDigits <= 0) return hasLeadingMinus ? 1 : 0;
  let digitCount = 0;
  for (let i = 0; i < formattedStr.length; i++) {
    if (/\d/.test(formattedStr[i])) {
      digitCount++;
      if (digitCount === targetDigits) {
        return i + 1;
      }
    }
  }
  return formattedStr.length;
}

/**
 * Format numeric value for display:
 * - isCurrency: Indonesian format with automatic dots for thousands (e.g. 1000 -> "1.000", 0 -> "0")
 * - non-currency: standard string representation
 */
export function formatInitialValue(
  val: number | null | undefined,
  isCurrency: boolean,
  allowNegative = false
): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  if (!allowNegative && val < 0) return '0';
  if (isCurrency) {
    if (val < 0) {
      return '-' + Math.round(Math.abs(val)).toLocaleString('id-ID');
    }
    return Math.round(val).toLocaleString('id-ID');
  }
  return val.toString();
}

/**
 * Pure parser / sanitizer helper to evaluate raw input string.
 * Used for deterministic validation and test assertions.
 */
export function sanitizeNumericInput(
  rawVal: string,
  options: { isCurrency?: boolean; allowDecimals?: boolean; allowNegative?: boolean }
): {
  value: number;
  formatted: string;
  isValid: boolean;
  isRejected: boolean;
  reason?: string;
} {
  const { isCurrency = false, allowDecimals = false, allowNegative = false } = options;

  // Strict rejection of negative inputs when allowNegative is false
  if (!allowNegative && rawVal.includes('-')) {
    return {
      value: 0,
      formatted: '',
      isValid: false,
      isRejected: true,
      reason: 'Nominal tidak boleh negatif',
    };
  }

  if (isCurrency) {
    const isNeg = allowNegative && rawVal.startsWith('-');
    if (rawVal === '-') {
      return { value: 0, formatted: '-', isValid: true, isRejected: false };
    }
    const cleanDigits = rawVal.replace(/\D/g, '');
    if (cleanDigits === '') {
      return { value: 0, formatted: isNeg ? '-' : '', isValid: true, isRejected: false };
    }
    const normalized = cleanDigits.replace(/^0+(?=\d)/, '');
    const rawNum = parseInt(normalized, 10);
    const num = isNeg ? -rawNum : rawNum;
    const formatted = (isNeg ? '-' : '') + Math.abs(num).toLocaleString('id-ID');
    return { value: num, formatted, isValid: true, isRejected: false };
  }

  if (allowDecimals) {
    const isNeg = allowNegative && rawVal.startsWith('-');
    let val = rawVal.replace(allowNegative ? /[^0-9.,-]/g : /[^0-9.,]/g, '');
    if (allowNegative && val.includes('-')) {
      val = (isNeg ? '-' : '') + val.replace(/-/g, '');
    }
    if (val === '-' || val === '-.' || val === '-,') {
      return { value: 0, formatted: val, isValid: true, isRejected: false };
    }
    const normalized = val.replace(',', '.');
    const num = parseFloat(normalized);
    return {
      value: isNaN(num) ? 0 : num,
      formatted: val,
      isValid: !isNaN(num),
      isRejected: false,
    };
  }

  // Integer non-decimal mode
  const isNeg = allowNegative && rawVal.startsWith('-');
  if (rawVal === '-') {
    return { value: 0, formatted: '-', isValid: true, isRejected: false };
  }
  const clean = rawVal.replace(/\D/g, '');
  if (clean === '') {
    return { value: 0, formatted: isNeg ? '-' : '', isValid: true, isRejected: false };
  }
  const normalized = clean.replace(/^0+(?=\d)/, '');
  const rawNum = parseInt(normalized, 10);
  const num = isNeg ? -rawNum : rawNum;
  return {
    value: num,
    formatted: (isNeg ? '-' : '') + Math.abs(num).toString(),
    isValid: true,
    isRejected: false,
  };
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  allowDecimals = false,
  isCurrency = false,
  allowNegative = false,
  className = '',
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState<string>(() =>
    formatInitialValue(value, isCurrency, allowNegative)
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNegativeFeedback = () => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    if (inputRef.current && typeof window !== 'undefined') {
      const rect = inputRef.current.getBoundingClientRect();
      const fitsBelow = rect.bottom + 32 <= window.innerHeight;
      setTooltipPos({
        top: fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - 28),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 180)),
      });
    }
    setFeedback('Nominal tidak boleh negatif');
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
      setTooltipPos(null);
    }, 1800);
  };

  // Sync internalValue when parent prop value changes externally
  useEffect(() => {
    const isNeg = allowNegative && internalValue.startsWith('-');
    if (isCurrency) {
      const cleanInternal = internalValue.replace(/\D/g, '');
      const parsed = cleanInternal === '' ? 0 : parseInt(cleanInternal, 10);
      const numInternal = isNeg ? -parsed : parsed;
      // Only sync if actual numeric value is different
      if (numInternal !== value) {
        if (internalValue === '' && value === 0) {
          return;
        }
        setInternalValue(formatInitialValue(value, true, allowNegative));
      }
    } else if (allowDecimals) {
      const normalizedInternal = internalValue.replace(',', '.');
      const numInternal =
        normalizedInternal === '' || normalizedInternal === '-' ? 0 : parseFloat(normalizedInternal);
      const isTrailingDecimal = internalValue.endsWith('.') || internalValue.endsWith(',');
      if (!isTrailingDecimal && numInternal !== value) {
        if (internalValue === '' && value === 0) {
          return;
        }
        setInternalValue(formatInitialValue(value, false, allowNegative));
      }
    } else {
      const cleanInternal = internalValue.replace(/\D/g, '');
      const parsed = cleanInternal === '' ? 0 : parseInt(cleanInternal, 10);
      const numInternal = isNeg ? -parsed : parsed;
      if (numInternal !== value) {
        if (internalValue === '' && value === 0) {
          return;
        }
        setInternalValue(formatInitialValue(value, false, allowNegative));
      }
    }
  }, [value, isCurrency, allowDecimals, allowNegative]);

  const updateCaret = (targetDigits: number, formatted: string, hasLeadingMinus = false) => {
    const newPos = getCursorPositionFromDigitCount(formatted, targetDigits, hasLeadingMinus);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cursorPos = e.target.selectionEnd ?? rawVal.length;

    // Strict guard: if negative input is not allowed and minus sign is detected
    if (!allowNegative && rawVal.includes('-')) {
      showNegativeFeedback();
      if (inputRef.current) {
        inputRef.current.value = internalValue;
      }
      return;
    }

    // Dismiss any active feedback on valid input
    if (feedback) {
      setFeedback(null);
      setTooltipPos(null);
    }

    if (isCurrency) {
      const isNeg = allowNegative && rawVal.startsWith('-');

      // Solitary minus typed
      if (rawVal === '-') {
        setInternalValue('-');
        onChange(0);
        return;
      }

      // Count digits before cursor in typed raw string
      const digitsBeforeCursor = rawVal.slice(0, cursorPos).replace(/\D/g, '').length;
      const cleanDigits = rawVal.replace(/\D/g, '');

      if (cleanDigits === '') {
        setInternalValue(isNeg ? '-' : '');
        onChange(0);
        return;
      }

      // Remove leading zeros if followed by other digits (e.g. "05" -> "5", but "0" stays "0")
      const normalized = cleanDigits.replace(/^0+(?=\d)/, '');
      const strippedCount = cleanDigits.length - normalized.length;
      const targetDigits = Math.max(0, digitsBeforeCursor - strippedCount);

      const rawNum = parseInt(normalized, 10);
      const num = isNeg ? -rawNum : rawNum;
      const formatted = (isNeg ? '-' : '') + Math.abs(num).toLocaleString('id-ID');

      setInternalValue(formatted);
      onChange(num);
      updateCaret(targetDigits, formatted, isNeg);
      return;
    }

    if (allowDecimals) {
      const isNeg = allowNegative && rawVal.startsWith('-');
      // Support decimal input with comma or dot
      let val = rawVal.replace(allowNegative ? /[^0-9.,-]/g : /[^0-9.,]/g, '');

      // Allow at most one decimal separator (the first one typed)
      const firstSepMatch = val.match(/[.,]/);
      if (firstSepMatch && firstSepMatch.index !== undefined) {
        const sepIndex = firstSepMatch.index;
        const sepChar = firstSepMatch[0];
        let beforeSep = val.slice(0, sepIndex).replace(/[.,]/g, '');
        const afterSep = val.slice(sepIndex + 1).replace(/[.,]/g, '');
        // Strip leading zeros before digits in integer part, e.g. "05.2" -> "5.2", but "0.2" stays "0.2"
        const beforeNeg = isNeg && beforeSep.startsWith('-');
        if (beforeNeg) beforeSep = beforeSep.slice(1);
        beforeSep = beforeSep.replace(/^0+(?=\d)/, '');
        if (beforeSep === '') beforeSep = '0';
        val = (beforeNeg ? '-' : '') + beforeSep + sepChar + afterSep;
      } else {
        // No decimal separator yet: normalize leading zero before digit
        const valNeg = isNeg && val.startsWith('-');
        if (valNeg) val = val.slice(1);
        val = val.replace(/^0+(?=\d)/, '');
        val = (valNeg ? '-' : '') + val;
      }

      // Handle minus placement if negative numbers allowed
      if (allowNegative && val.includes('-')) {
        val = (isNeg ? '-' : '') + val.replace(/-/g, '');
      }

      // Enforce max if props.max defined
      if (props.max !== undefined && val !== '' && val !== '-' && val !== '.' && val !== ',') {
        const checkNum = parseFloat(val.replace(',', '.'));
        if (!isNaN(checkNum) && checkNum > Number(props.max)) {
          val = props.max.toString();
        }
      }

      setInternalValue(val);

      if (val === '' || val === '-' || val === '.' || val === ',') {
        onChange(0);
        return;
      }

      const normalized = val.replace(',', '.');
      const num = parseFloat(normalized);
      if (!isNaN(num)) {
        onChange(num);
      }
      return;
    }

    // Standard non-decimal integer
    const isNeg = allowNegative && rawVal.startsWith('-');
    if (rawVal === '-') {
      setInternalValue('-');
      onChange(0);
      return;
    }

    const clean = rawVal.replace(/\D/g, '');
    if (clean === '') {
      setInternalValue(isNeg ? '-' : '');
      onChange(0);
      return;
    }

    let normalized = clean.replace(/^0+(?=\d)/, '');
    let rawNum = parseInt(normalized, 10);
    let num = isNeg ? -rawNum : rawNum;

    if (props.max !== undefined && num > Number(props.max)) {
      num = Number(props.max);
      normalized = Math.abs(num).toString();
    }
    if (allowNegative && props.min !== undefined && num < Number(props.min)) {
      num = Number(props.min);
      normalized = Math.abs(num).toString();
    }

    const formatted = (num < 0 ? '-' : '') + normalized;
    setInternalValue(formatted);
    onChange(num);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // If value is 0, auto-select so user can immediately type a replacement digit without getting '05'
    if (internalValue === '0' || internalValue === '0,0' || internalValue === '0.0') {
      e.target.select();
    }
    if (props.onFocus) {
      props.onFocus(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFeedback(null);
    setTooltipPos(null);

    const isNeg = allowNegative && internalValue.startsWith('-');
    if (
      internalValue === '' ||
      internalValue === '-' ||
      internalValue === '.' ||
      internalValue === ',' ||
      internalValue === '-.' ||
      internalValue === '-,'
    ) {
      const defaultVal = props.min !== undefined && Number(props.min) > 0 ? props.min.toString() : '0';
      setInternalValue(defaultVal);
      onChange(Number(defaultVal) || 0);
    } else if (allowDecimals) {
      let clean = internalValue.replace(',', '.');
      if (clean.endsWith('.')) {
        clean = clean.slice(0, -1);
      }
      let num = parseFloat(clean);
      if (!isNaN(num)) {
        if (!allowNegative && num < 0) num = 0;
        if (props.min !== undefined && num < Number(props.min)) num = Number(props.min);
        if (props.max !== undefined && num > Number(props.max)) num = Number(props.max);
        setInternalValue(num.toString());
        onChange(num);
      } else {
        setInternalValue('0');
        onChange(0);
      }
    } else {
      let clean = internalValue.replace(/\D/g, '');
      let rawNum = clean === '' ? 0 : parseInt(clean, 10);
      let num = isNeg ? -rawNum : rawNum;
      if (!isNaN(num)) {
        if (!allowNegative && num < 0) num = 0;
        if (props.min !== undefined && num < Number(props.min)) num = Number(props.min);
        if (props.max !== undefined && num > Number(props.max)) num = Number(props.max);
        if (isCurrency) {
          const formatted = (num < 0 ? '-' : '') + Math.abs(Math.round(num)).toLocaleString('id-ID');
          setInternalValue(formatted);
        } else {
          setInternalValue(num.toString());
        }
        onChange(num);
      } else {
        setInternalValue('0');
        onChange(0);
      }
    }

    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!allowNegative && text.includes('-')) {
      e.preventDefault();
      showNegativeFeedback();
      return;
    }
    if (props.onPaste) {
      props.onPaste(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Intercept minus key if allowNegative is false
    if (!allowNegative) {
      if (e.key === '-' || e.key === 'Minus' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        showNegativeFeedback();
        return;
      }
    } else {
      // allowNegative is true: only allow '-' at the beginning
      if (e.key === '-' || e.key === 'Minus' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
        const selStart = inputRef.current?.selectionStart ?? 0;
        if (selStart !== 0 || internalValue.includes('-')) {
          e.preventDefault();
          return;
        }
      }
    }

    if (isCurrency && inputRef.current) {
      const { selectionStart, selectionEnd } = inputRef.current;
      if (selectionStart !== null && selectionStart === selectionEnd) {
        const isNeg = allowNegative && internalValue.startsWith('-');
        // Backspace right after a thousand separator dot '.'
        if (e.key === 'Backspace' && selectionStart > 0) {
          if (internalValue[selectionStart - 1] === '.') {
            e.preventDefault();
            // Delete the digit before the dot (at selectionStart - 2)
            const before = internalValue.slice(0, Math.max(0, selectionStart - 2));
            const after = internalValue.slice(selectionStart);
            const combined = before + after;
            const clean = combined.replace(/\D/g, '');

            if (clean === '') {
              setInternalValue(isNeg ? '-' : '');
              onChange(0);
              return;
            }

            const normalized = clean.replace(/^0+(?=\d)/, '');
            const rawParsed = parseInt(normalized, 10);
            const num = isNeg ? -rawParsed : rawParsed;
            const formatted = (isNeg ? '-' : '') + Math.abs(num).toLocaleString('id-ID');
            const digitsBefore = before.replace(/\D/g, '').length;

            setInternalValue(formatted);
            onChange(num);
            updateCaret(digitsBefore, formatted, isNeg);
            return;
          }
        } else if (e.key === 'Delete' && selectionStart < internalValue.length) {
          // Delete right before a thousand separator dot '.'
          if (internalValue[selectionStart] === '.') {
            e.preventDefault();
            // Delete the digit after the dot (at selectionStart + 1)
            const before = internalValue.slice(0, selectionStart);
            const after = internalValue.slice(selectionStart + 2);
            const combined = before + after;
            const clean = combined.replace(/\D/g, '');

            if (clean === '') {
              setInternalValue(isNeg ? '-' : '');
              onChange(0);
              return;
            }

            const normalized = clean.replace(/^0+(?=\d)/, '');
            const rawParsed = parseInt(normalized, 10);
            const num = isNeg ? -rawParsed : rawParsed;
            const formatted = (isNeg ? '-' : '') + Math.abs(num).toLocaleString('id-ID');
            const digitsBefore = before.replace(/\D/g, '').length;

            setInternalValue(formatted);
            onChange(num);
            updateCaret(digitsBefore, formatted, isNeg);
            return;
          }
        }
      }
    }

    if (props.onKeyDown) {
      props.onKeyDown(e);
    }
  };

  // Strip type from props so parent cannot override type="text"
  const { type: _discardedType, ...restProps } = props;

  return (
    <>
      <input
        {...restProps}
        ref={inputRef}
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        value={internalValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`${className} ${feedback ? 'ring-2 ring-rose-500/50 border-rose-500 transition-all' : ''}`}
      />
      {feedback && typeof document !== 'undefined' && tooltipPos && createPortal(
        <div
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            zIndex: 99999,
          }}
          className="px-2.5 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-lg shadow-lg pointer-events-none animate-in fade-in flex items-center gap-1.5"
          role="alert"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>{feedback}</span>
        </div>,
        document.body
      )}
    </>
  );
};
