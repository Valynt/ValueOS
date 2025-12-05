/**
 * SDUI Skeleton Loader
 * 
 * Skeleton loading states specifically designed for SDUI components.
 * Provides stage-aware loading animations.
 * 
 * Phase 4: UX Polish
 */

import React from 'react';

export interface SDUISkeletonLoaderProps {
  stage?: string;
  variant?: 'card' | 'list' | 'table' | 'full';
}

/**
 * SDUI-specific Skeleton Loader
 * 
 * Provides contextual loading states for different SDUI scenarios
 */
export const SDUISkeletonLoader: React.FC<SDUISkeletonLoaderProps> = ({
  stage,
  variant = 'card',
}) => {
  const Skeleton = ({ className = '' }: { className?: string }) => (
    <div
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 
                  bg-[length:200%_100%] rounded ${className}`}
      style={{
        animation: 'shimmer 2s infinite',
      }}
    />
  );

  if (variant === 'full') {
    return (
      <div className="space-y-4 p-6">
        {/* Header skeleton */}
        <div className="flex items-start gap-4">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="space-y-3 mt-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {/* Action buttons skeleton */}
        <div className="flex gap-3 mt-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
            <Skeleton className="w-10 h-10 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        {/* Table rows */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 border-b border-gray-200">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default: card variant with stage context
  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-4">
      {/* Agent header */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        {stage && (
          <div className="px-3 py-1 bg-gray-100 rounded-full">
            <Skeleton className="h-4 w-20" />
          </div>
        )}
      </div>

      {/* Response content */}
      <div className="space-y-3 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>

      {/* Reasoning steps */}
      <div className="space-y-2 pt-4 border-t border-gray-200">
        <Skeleton className="h-4 w-32" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2 items-start">
            <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
};

/**
 * Inline shimmer animation styles (add to global CSS)
 */
export const SDUISkeletonStyles = `
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
`;
