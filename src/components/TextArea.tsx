import React from 'react';

interface TextAreaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  ariaLabel?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  rows = 4,
  ariaLabel,
}) => {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      aria-label={ariaLabel}
      className="textarea"
    />
  );
};