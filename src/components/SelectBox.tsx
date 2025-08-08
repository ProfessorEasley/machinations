import React from 'react';

interface Option {
  label: string;
  value: string;
}

interface SelectBoxProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  disabled?: boolean;
  ariaLabel?: string;
}

export const SelectBox: React.FC<SelectBoxProps> = ({
  value,
  onChange,
  options,
  disabled = false,
  ariaLabel,
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className="select"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
