import React, { useState, useEffect } from 'react';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  allowDecimals?: boolean;
}

export const NumberInput: React.FC<NumberInputProps> = ({ value, onChange, allowDecimals = false, ...props }) => {
  const [internalValue, setInternalValue] = useState<string>(value.toString());

  useEffect(() => {
    // Only update internal string if it represents a different numeric value
    // This allows typing things like '1.' without it being immediately overwritten by '1'
    const numInternal = Number(internalValue);
    if (numInternal !== value && !(internalValue === '' && value === 0)) {
      setInternalValue(value.toString());
    }
  }, [value, internalValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    
    if (val !== '') {
      // Remove leading zeros if not followed by a dot
      if (/^0+(?!\.)/.test(val)) {
        val = val.replace(/^0+/, '');
        if (val === '') {
          val = '0';
        } else if (val.startsWith('.')) {
          val = '0' + val;
        }
      }
    }

    setInternalValue(val);

    if (val === '') {
      onChange(0);
    } else {
      const num = Number(val);
      if (!isNaN(num)) {
        onChange(num);
      }
    }
  };

  return (
    <input
      type="number"
      step={allowDecimals ? 'any' : (props.step ?? '1')}
      value={internalValue}
      onChange={handleChange}
      {...props}
    />
  );
};
