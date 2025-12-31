import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Props for LoadingFallback component
 */
export interface LoadingFallbackProps {
  /**
   * Name of the component being loaded
   */
  componentName: string;

  /**
   * Optional loading message
   */
  message?: string;

  /**
   * Size variant
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Whether to show the component name
   * @default false
   */
  showComponentName?: boolean;
}

/**
 * Loading fallback component shown during data hydration
 *
 * @example
 * ```tsx
 * <LoadingFallback
 *   componentName="UserProfile"
 *   message="Loading user data..."
 *   size="medium"
 * />
 * ```
 */
export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  componentName,
  message,
  size = 'medium',
  showComponentName = false,
}) => {
  const sizeClasses = {
    small: 'p-3',
    medium: 'p-4',
    large: 'p-6',
  };

  const iconSizes = {
    small: 'h-4 w-4',
    medium: 'h-5 w-5',
    large: 'h-6 w-6',
  };

  const textSizes = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  return (
    <div
      className={`rounded-lg border border-blue-200 bg-blue-50 ${sizeClasses[size]}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="loading-fallback"
    >
      <div className="flex items-center gap-3">
        <Loader2
          className={`${iconSizes[size]} text-blue-600 animate-spin`}
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className={`${textSizes[size]} font-medium text-blue-900`}>
            {message || 'Loading component...'}
          </p>
          {showComponentName && (
            <p className={`${textSizes[size]} text-blue-700 opacity-75 mt-0.5`}>
              {componentName}
            </p>
          )}
        </div>
      </div>
      <span className="sr-only">Loading {componentName}</span>
    </div>
  );
};

/**
 * Skeleton loading component for more detailed loading states
 */
export const SkeletonLoader: React.FC<{
  lines?: number;
  className?: string;
}> = ({ lines = 3, className = '' }) => {
  return (
    <div className={`space-y-3 ${className}`} data-testid="skeleton-loader">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 bg-gray-200 rounded animate-pulse"
          style={{
            width: `${Math.random() * 30 + 70}%`,
          }}
        />
      ))}
    </div>
  );
};

/**
 * Card skeleton for loading card-based components
 */
export const CardSkeleton: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}
      data-testid="card-skeleton"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      </div>
      <SkeletonLoader lines={3} />
    </div>
  );
};
