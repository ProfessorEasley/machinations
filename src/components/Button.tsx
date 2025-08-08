// Component: Button.tsx
import React from 'react';

interface ButtonProps {
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick?: () => void;
  fullWidth?: boolean;
  ariaLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  icon,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick,
  fullWidth = false,
  ariaLabel,
}) => {
  const base = `btn ${variant} ${size} ${fullWidth ? 'w-full' : ''}`;
  return (
    <button
      className={base}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {label}
    </button>
  );
};

