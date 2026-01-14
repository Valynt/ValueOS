/**
 * Skeleton Loading System
 *
 * Standardized skeleton components with Suspense boundaries for zero layout shift.
 * Provides consistent loading states across all async components.
 */

import React, { Suspense, ReactNode, ComponentType } from "react";

// Base skeleton component with shimmer animation
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: "rectangular" | "circular" | "rounded";
  animation?: "pulse" | "wave" | "none";
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = "1rem",
  className = "",
  variant = "rectangular",
  animation = "pulse",
}) => {
  const baseClasses = "bg-gray-200 dark:bg-gray-700";

  const variantClasses = {
    rectangular: "",
    circular: "rounded-full",
    rounded: "rounded-md",
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-pulse", // TODO: Implement wave animation
    none: "",
  };

  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
      role="status"
      aria-label="Loading..."
    />
  );
};

// Skeleton text component
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}> = ({ lines = 3, className = "", lastLineWidth = "75%" }) => (
  <div
    className={`space-y-2 ${className}`}
    role="status"
    aria-label="Loading text"
  >
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        height="1rem"
        width={i === lines - 1 ? lastLineWidth : "100%"}
      />
    ))}
  </div>
);

// Card skeleton matching common card layouts
export const SkeletonCard: React.FC<{
  className?: string;
  showAvatar?: boolean;
  showActions?: boolean;
  contentLines?: number;
}> = ({
  className = "",
  showAvatar = true,
  showActions = true,
  contentLines = 3,
}) => (
  <div
    className={`p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 ${className}`}
    role="status"
    aria-label="Loading card"
  >
    {showAvatar && (
      <div className="flex items-center space-x-3 mb-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton height="1.25rem" width="60%" />
          <Skeleton height="0.875rem" width="40%" />
        </div>
      </div>
    )}
    <SkeletonText lines={contentLines} />
    {showActions && (
      <div className="flex space-x-2 mt-4">
        <Skeleton height="2rem" width="80px" />
        <Skeleton height="2rem" width="100px" />
      </div>
    )}
  </div>
);

// Table skeleton with header and rows
export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
  showHeader?: boolean;
}> = ({ rows = 5, columns = 4, className = "", showHeader = true }) => (
  <div
    className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 ${className}`}
    role="status"
    aria-label="Loading table"
  >
    {showHeader && (
      <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 p-4">
        <div className="flex space-x-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={`header-${i}`} height="1.25rem" width="120px" />
          ))}
        </div>
      </div>
    )}
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`row-${i}`} className="p-4">
          <div className="flex space-x-4">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={`cell-${i}-${j}`} height="1rem" width="120px" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Form skeleton for input-heavy components
export const SkeletonForm: React.FC<{
  fields?: number;
  className?: string;
  showLabels?: boolean;
  showSubmit?: boolean;
}> = ({ fields = 4, className = "", showLabels = true, showSubmit = true }) => (
  <div
    className={`space-y-6 ${className}`}
    role="status"
    aria-label="Loading form"
  >
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i} className="space-y-2">
        {showLabels && <Skeleton height="1rem" width="120px" />}
        <Skeleton height="2.5rem" width="100%" variant="rounded" />
      </div>
    ))}
    {showSubmit && (
      <div className="flex space-x-3 pt-4">
        <Skeleton height="2.5rem" width="100px" variant="rounded" />
        <Skeleton height="2.5rem" width="80px" variant="rounded" />
      </div>
    )}
  </div>
);

// Sidebar skeleton for navigation layouts
export const SkeletonSidebar: React.FC<{
  className?: string;
  items?: number;
  showHeader?: boolean;
}> = ({ className = "", items = 8, showHeader = true }) => (
  <div
    className={`w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 ${className}`}
    role="status"
    aria-label="Loading sidebar"
  >
    {showHeader && (
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <Skeleton height="1.5rem" width="80%" />
      </div>
    )}
    <div className="p-4 space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3 p-2">
          <Skeleton variant="circular" width={24} height={24} />
          <Skeleton height="1rem" width="120px" />
        </div>
      ))}
    </div>
  </div>
);

// List skeleton for list-based content
export const SkeletonList: React.FC<{
  items?: number;
  className?: string;
  itemHeight?: string;
  showAvatars?: boolean;
}> = ({
  items = 5,
  className = "",
  itemHeight = "3rem",
  showAvatars = false,
}) => (
  <div
    className={`space-y-3 ${className}`}
    role="status"
    aria-label="Loading list"
  >
    {Array.from({ length: items }).map((_, i) => (
      <div
        key={i}
        className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
      >
        {showAvatars && <Skeleton variant="circular" width={32} height={32} />}
        <div className="flex-1 space-y-1">
          <Skeleton height="1rem" width="80%" />
          <Skeleton height="0.75rem" width="60%" />
        </div>
        <Skeleton height="1.5rem" width="60px" />
      </div>
    ))}
  </div>
);

// Content skeleton for article/blog content
export const SkeletonContent: React.FC<{
  className?: string;
  titleLines?: number;
  bodyLines?: number;
  showMeta?: boolean;
}> = ({ className = "", titleLines = 1, bodyLines = 8, showMeta = true }) => (
  <div
    className={`space-y-4 ${className}`}
    role="status"
    aria-label="Loading content"
  >
    {showMeta && (
      <div className="flex items-center space-x-2">
        <Skeleton variant="circular" width={24} height={24} />
        <Skeleton height="0.875rem" width="120px" />
        <Skeleton height="0.875rem" width="80px" />
      </div>
    )}
    <SkeletonText
      lines={titleLines}
      className="space-y-3"
      lastLineWidth="90%"
    />
    <SkeletonText lines={bodyLines} className="space-y-2" lastLineWidth="70%" />
  </div>
);

// Suspense boundary wrapper with skeleton fallback
interface SuspenseSkeletonProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error) => void;
}

export const SuspenseSkeleton: React.FC<SuspenseSkeletonProps> = ({
  children,
  fallback,
  onError,
}) => <Suspense fallback={fallback}>{children}</Suspense>;

// Higher-order component for async components with skeleton loading
export function withSkeletonLoading<P extends object>(
  Component: ComponentType<P>,
  skeletonFallback: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <SuspenseSkeleton fallback={skeletonFallback}>
      <Component {...props} />
    </SuspenseSkeleton>
  );

  WrappedComponent.displayName = `withSkeletonLoading(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Utility function to create layout-preserving skeleton
export const createLayoutSkeleton = (
  children: ReactNode,
  isLoading: boolean,
  skeletonComponent: ReactNode
): ReactNode => {
  if (isLoading) {
    return skeletonComponent;
  }
  return children;
};

// Export types for external use
export type { SkeletonProps };
