import React from 'react';

interface TextInputProps {
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  type?: 'text' | 'number';
  error?: boolean;
  ariaLabel?: string;
}

export const TextInput: React.FC<TextInputProps> = ({
  value,
  placeholder,
  onChange,
  disabled = false,
  type = 'text',
  error = false,
  ariaLabel,
}) => {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`input ${error ? 'border-red-500' : ''}`}
    />
  );
};
