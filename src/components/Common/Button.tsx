/**
 * Enhanced Button Component
 * Provides consistent button styling with proper states, loading, and accessibility
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses = {
  primary: `
    bg-indigo-600 text-white
    hover:bg-indigo-700
    active:bg-indigo-800
    disabled:bg-indigo-300 disabled:cursor-not-allowed
    shadow-sm hover:shadow-md
    transition-all duration-200
  `,
  secondary: `
    bg-gray-600 text-white
    hover:bg-gray-700
    active:bg-gray-800
    disabled:bg-gray-300 disabled:cursor-not-allowed
    shadow-sm hover:shadow-md
    transition-all duration-200
  `,
  outline: `
    bg-transparent border-2 border-indigo-600 text-indigo-600
    hover:bg-indigo-50
    active:bg-indigo-100
    disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed
    transition-all duration-200
  `,
  ghost: `
    bg-transparent text-gray-700
    hover:bg-gray-100
    active:bg-gray-200
    disabled:text-gray-300 disabled:cursor-not-allowed
    transition-all duration-200
  `,
  danger: `
    bg-red-600 text-white
    hover:bg-red-700
    active:bg-red-800
    disabled:bg-red-300 disabled:cursor-not-allowed
    shadow-sm hover:shadow-md
    transition-all duration-200
  `,
};

const sizeClasses = {
  xs: 'px-2.5 py-1 text-xs rounded',
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        className={`
          inline-flex items-center justify-center gap-2
          font-medium
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          focus-visible:ring-indigo-500
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <>
            <Loader2
              className={`
                ${size === 'xs' ? 'w-3 h-3' : ''}
                ${size === 'sm' ? 'w-4 h-4' : ''}
                ${size === 'md' ? 'w-4 h-4' : ''}
                ${size === 'lg' ? 'w-5 h-5' : ''}
                animate-spin
              `}
              aria-hidden="true"
            />
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
            {children}
            {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * Icon Button
 * Square button with just an icon
 */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  label: string; // Required for accessibility
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = 'ghost',
      size = 'md',
      loading = false,
      label,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      xs: 'p-1 text-xs',
      sm: 'p-1.5 text-sm',
      md: 'p-2 text-base',
      lg: 'p-3 text-lg',
    };

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-label={label}
        aria-busy={loading}
        aria-disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          rounded-lg
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          focus-visible:ring-indigo-500
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2
            className={`
              ${size === 'xs' ? 'w-3 h-3' : ''}
              ${size === 'sm' ? 'w-4 h-4' : ''}
              ${size === 'md' ? 'w-5 h-5' : ''}
              ${size === 'lg' ? 'w-6 h-6' : ''}
              animate-spin
            `}
            aria-hidden="true"
          />
        ) : (
          <span aria-hidden="true">{icon}</span>
        )}
        <span className="sr-only">{label}</span>
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

/**
 * Button Group
 * Group related buttons together
 */
interface ButtonGroupProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  orientation = 'horizontal',
  className = '',
}) => {
  return (
    <div
      className={`
        inline-flex
        ${orientation === 'horizontal' ? 'flex-row' : 'flex-col'}
        ${className}
      `}
      role="group"
    >
      {children}
    </div>
  );
};
