/**
 * Spinner Component
 * Loading indicators with multiple sizes and variants
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'white' | 'gray' | 'success' | 'error';
  label?: string;
  className?: string;
}

const sizeClasses = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const variantClasses = {
  primary: 'text-indigo-600',
  white: 'text-white',
  gray: 'text-gray-400',
  success: 'text-green-600',
  error: 'text-red-600',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  label,
  className = '',
}) => {
  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label || 'Loading'}
    >
      <Loader2
        className={`${sizeClasses[size]} ${variantClasses[variant]} animate-spin`}
        aria-hidden="true"
      />
      {label && (
        <span className={`text-sm ${variantClasses[variant]}`}>
          {label}
        </span>
      )}
      <span className="sr-only">{label || 'Loading'}</span>
    </div>
  );
};

/**
 * Full Page Spinner
 * Centers spinner in viewport for page-level loading
 */
interface PageSpinnerProps {
  label?: string;
  overlay?: boolean;
}

export const PageSpinner: React.FC<PageSpinnerProps> = ({
  label = 'Loading...',
  overlay = false,
}) => {
  return (
    <div
      className={`flex items-center justify-center ${
        overlay
          ? 'fixed inset-0 bg-black bg-opacity-50 z-50'
          : 'min-h-screen'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className={`flex flex-col items-center gap-3 ${overlay ? 'bg-white rounded-lg p-8 shadow-2xl' : ''}`}>
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" aria-hidden="true" />
        <p className="text-gray-700 font-medium">{label}</p>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
};

/**
 * Inline Spinner
 * Small spinner for inline loading states
 */
export const InlineSpinner: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <Loader2
      className={`w-4 h-4 animate-spin inline-block ${className}`}
      aria-hidden="true"
      role="status"
    />
  );
};

/**
 * Dots Spinner
 * Alternative loading animation using dots
 */
export const DotsSpinner: React.FC<{
  variant?: 'primary' | 'white' | 'gray';
  className?: string;
}> = ({ variant = 'primary', className = '' }) => {
  const dotColor = {
    primary: 'bg-indigo-600',
    white: 'bg-white',
    gray: 'bg-gray-400',
  };

  return (
    <div className={`flex items-center gap-1 ${className}`} role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${dotColor[variant]} animate-bounce`}
          style={{
            animationDelay: `${i * 0.15}s`,
          }}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
};

/**
 * Skeleton Pulse
 * Subtle loading placeholder
 */
export const SkeletonPulse: React.FC<{
  width?: string;
  height?: string;
  className?: string;
}> = ({ width = 'w-full', height = 'h-4', className = '' }) => {
  return (
    <div
      className={`${width} ${height} bg-gray-200 rounded animate-pulse ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading</span>
    </div>
  );
};

/**
 * Button Spinner
 * Spinner specifically designed for button loading states
 */
export const ButtonSpinner: React.FC<{
  variant?: 'white' | 'primary';
}> = ({ variant = 'white' }) => {
  return (
    <Loader2
      className={`w-4 h-4 animate-spin ${variant === 'white' ? 'text-white' : 'text-indigo-600'}`}
      aria-hidden="true"
    />
  );
};
