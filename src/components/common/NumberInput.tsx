import React, { useState, useEffect, useRef } from 'react';

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  allowDecimals?: boolean;
  isCurrency?: boolean;
}

/**
 * Helper to determine the cursor offset in a formatted string
 * based on the number of actual digits that should appear before the cursor.
 */
function getCursorPositionFromDigitCount(formattedStr: string, targetDigits: number): number {
  if (targetDigits <= 0) return 0;
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
function formatInitialValue(val: number | null | undefined, isCurrency: boolean): string {
  if (val === undefined || val === null || isNaN(val)) return '';
  if (isCurrency) {
    return Math.round(val).toLocaleString('id-ID');
  }
  return val.toString();
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  allowDecimals = false,
  isCurrency = false,
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState<string>(() => formatInitialValue(value, isCurrency));

  // Sync internalValue when parent prop value changes externally
  useEffect(() => {
    if (isCurrency) {
      const cleanInternal = internalValue.replace(/\D/g, '');
      const numInternal = cleanInternal === '' ? 0 : parseInt(cleanInternal, 10);
      // Only sync if actual numeric value is different
      if (numInternal !== value) {
        // When value is 0 and user is actively clearing the field, let it stay empty
        if (internalValue === '' && value === 0) {
          return;
        }
        setInternalValue(formatInitialValue(value, true));
      }
    } else if (allowDecimals) {
      const normalizedInternal = internalValue.replace(',', '.');
      const numInternal = normalizedInternal === '' ? 0 : parseFloat(normalizedInternal);
      // Do not interrupt user while typing a trailing decimal separator e.g. "18." or "18,"
      const isTrailingDecimal = internalValue.endsWith('.') || internalValue.endsWith(',');
      if (!isTrailingDecimal && numInternal !== value) {
        if (internalValue === '' && value === 0) {
          return;
        }
        setInternalValue(formatInitialValue(value, false));
      }
    } else {
      const cleanInternal = internalValue.replace(/\D/g, '');
      const numInternal = cleanInternal === '' ? 0 : parseInt(cleanInternal, 10);
      if (numInternal !== value) {
        if (internalValue === '' && value === 0) {
          return;
        }
        setInternalValue(formatInitialValue(value, false));
      }
    }
  }, [value, isCurrency, allowDecimals]);

  const updateCaret = (targetDigits: number, formatted: string) => {
    const newPos = getCursorPositionFromDigitCount(formatted, targetDigits);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cursorPos = e.target.selectionEnd ?? rawVal.length;

    if (isCurrency) {
      // Count digits before cursor in typed raw string
      const digitsBeforeCursor = rawVal.slice(0, cursorPos).replace(/\D/g, '').length;
      const cleanDigits = rawVal.replace(/\D/g, '');

      if (cleanDigits === '') {
        setInternalValue('');
        onChange(0);
        return;
      }

      // Remove leading zeros if followed by other digits (e.g. "05" -> "5", but "0" stays "0")
      const normalized = cleanDigits.replace(/^0+(?=\d)/, '');
      const strippedCount = cleanDigits.length - normalized.length;
      const targetDigits = Math.max(0, digitsBeforeCursor - strippedCount);

      const num = parseInt(normalized, 10);
      const formatted = num.toLocaleString('id-ID');

      setInternalValue(formatted);
      onChange(num);
      updateCaret(targetDigits, formatted);
      return;
    }

    if (allowDecimals) {
      // Support decimal input with comma or dot
      let val = rawVal.replace(/[^0-9.,-]/g, '');

      // Allow at most one decimal separator (the first one typed)
      const firstSepMatch = val.match(/[.,]/);
      if (firstSepMatch && firstSepMatch.index !== undefined) {
        const sepIndex = firstSepMatch.index;
        const sepChar = firstSepMatch[0];
        const beforeSep = val.slice(0, sepIndex).replace(/[.,]/g, '');
        const afterSep = val.slice(sepIndex + 1).replace(/[.,]/g, '');
        val = beforeSep + sepChar + afterSep;
      }

      // Handle minus if negative numbers allowed
      if (val.includes('-')) {
        const isNeg = val.startsWith('-');
        val = (isNeg ? '-' : '') + val.replace(/-/g, '');
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
    const clean = rawVal.replace(/\D/g, '');
    if (clean === '') {
      setInternalValue('');
      onChange(0);
      return;
    }

    const normalized = clean.replace(/^0+(?=\d)/, '');
    const num = parseInt(normalized, 10);
    setInternalValue(normalized);
    onChange(num);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isCurrency && inputRef.current) {
      const { selectionStart, selectionEnd } = inputRef.current;
      if (selectionStart !== null && selectionStart === selectionEnd) {
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
              setInternalValue('');
              onChange(0);
              return;
            }

            const normalized = clean.replace(/^0+(?=\d)/, '');
            const num = parseInt(normalized, 10);
            const formatted = num.toLocaleString('id-ID');
            const digitsBefore = before.replace(/\D/g, '').length;

            setInternalValue(formatted);
            onChange(num);
            updateCaret(digitsBefore, formatted);
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
              setInternalValue('');
              onChange(0);
              return;
            }

            const normalized = clean.replace(/^0+(?=\d)/, '');
            const num = parseInt(normalized, 10);
            const formatted = num.toLocaleString('id-ID');
            const digitsBefore = before.replace(/\D/g, '').length;

            setInternalValue(formatted);
            onChange(num);
            updateCaret(digitsBefore, formatted);
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
    <input
      {...restProps}
      ref={inputRef}
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      value={internalValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
};
