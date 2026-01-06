/**
 * Settings Loading States
 * 
 * Sprint 2 Enhancement: Standardized loading indicators
 * Provides consistent loading UX across all settings pages
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

// ============================================================================
// Loading Spinner
// ============================================================================

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <Loader2
      className={`animate-spin text-blue-600 ${sizeClasses[size]} ${className}`}
    />
  );
};

// ============================================================================
// Full Page Loading
// ============================================================================

export interface FullPageLoadingProps {
  message?: string;
}

export const FullPageLoading: React.FC<FullPageLoadingProps> = ({
  message = 'Loading settings...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
};

// ============================================================================
// Section Loading
// ============================================================================

export interface SectionLoadingProps {
  message?: string;
  className?: string;
}

export const SectionLoading: React.FC<SectionLoadingProps> = ({
  message = 'Loading...',
  className = '',
}) => {
  return (
    <div className={`flex items-center space-x-3 py-6 ${className}`}>
      <LoadingSpinner size="md" />
      <span className="text-sm text-gray-600">{message}</span>
    </div>
  );
};

// ============================================================================
// Inline Loading
// ============================================================================

export interface InlineLoadingProps {
  message?: string;
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({
  message = 'Saving...',
}) => {
  return (
    <span className="inline-flex items-center space-x-2 text-sm text-gray-600">
      <LoadingSpinner size="sm" />
      <span>{message}</span>
    </span>
  );
};

// ============================================================================
// Skeleton Loader
// ============================================================================

export interface SkeletonProps {
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = 'h-4 w-full',
  count = 1,
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-gray-200 rounded ${className}`}
        />
      ))}
    </>
  );
};

// ============================================================================
// Settings Form Skeleton
// ============================================================================

export const SettingsFormSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Section 1 */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Section 2 */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Loading Overlay
// ============================================================================

export interface LoadingOverlayProps {
  message?: string;
  transparent?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Loading...',
  transparent = false,
}) => {
  return (
    <div
      className={`
        absolute inset-0 flex items-center justify-center z-50
        ${transparent ? 'bg-white/50' : 'bg-white'}
      `}
    >
      <div className="flex flex-col items-center space-y-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
};

// ============================================================================
// Button Loading State
// ============================================================================

export interface LoadingButtonProps {
  loading: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading,
  children,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
}) => {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        flex items-center justify-center px-4 py-2 rounded-lg
        transition-colors font-medium
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {loading && <LoadingSpinner size="sm" className="mr-2" />}
      {children}
    </button>
  );
};

// ============================================================================
// Saving Indicator
// ============================================================================

export interface SavingIndicatorProps {
  saving: boolean;
  saved: boolean;
  error?: string;
}

export const SavingIndicator: React.FC<SavingIndicatorProps> = ({
  saving,
  saved,
  error,
}) => {
  if (saving) {
    return <InlineLoading message="Saving..." />;
  }

  if (error) {
    return (
      <span className="text-sm text-red-600">
        Failed to save: {error}
      </span>
    );
  }

  if (saved) {
    return (
      <span className="text-sm text-green-600">
        ✓ Saved
      </span>
    );
  }

  return null;
};
