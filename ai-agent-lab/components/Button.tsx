import React from 'react';
import { ACCENT_COLOR } from '../constants'; // ACCENT_COLOR is 'green'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--page-background)] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  // CSS variables map to specific shades of green, gray, red, etc.
  // Example: --accent-bg might be green-600 in light, green-500 in dark.
  // Example: --button-secondary-text might be gray-800 in light, zinc-100 in dark.
  const variantStyles = {
    primary: `bg-[var(--accent-bg)] text-[var(--accent-text-on-bg)] hover:bg-[var(--accent-bg-hover)] focus:ring-[var(--input-focus-ring)]`,
    secondary: `bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover-bg)] focus:ring-[var(--input-focus-ring)]`,
    danger: `bg-[var(--danger-bg)] text-[var(--danger-text-on-bg)] hover:bg-[var(--danger-bg-hover)] focus:ring-red-500 dark:focus:ring-red-400`, // Danger focus ring can be specific
    ghost: `text-[var(--accent-text)] hover:bg-[var(--accent-text-hover-bg)] focus:ring-[var(--input-focus-ring)]`,
  };
  
  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--accent-text-on-bg)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {leftIcon && !isLoading && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && !isLoading && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

export default Button;