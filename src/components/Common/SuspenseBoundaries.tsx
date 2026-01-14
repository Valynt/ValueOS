/**
 * Suspense Boundaries with Skeleton Fallbacks
 *
 * Provides zero-layout-shift loading states for async components using Suspense.
 */

import React, { Suspense, ReactNode, ComponentType } from "react";
import {
  SkeletonCard,
  SkeletonTable,
  SkeletonForm,
  SkeletonSidebar,
  SkeletonList,
  SkeletonContent,
  SkeletonText,
  Skeleton,
} from "./SkeletonSystem";

// Card content Suspense boundary
interface CardSuspenseProps {
  children: ReactNode;
  cardCount?: number;
  showAvatar?: boolean;
  showActions?: boolean;
}

export const CardSuspense: React.FC<CardSuspenseProps> = ({
  children,
  cardCount = 1,
  showAvatar = true,
  showActions = true,
}) => (
  <Suspense
    fallback={
      <div className="space-y-4">
        {Array.from({ length: cardCount }).map((_, i) => (
          <SkeletonCard
            key={i}
            showAvatar={showAvatar}
            showActions={showActions}
          />
        ))}
      </div>
    }
  >
    {children}
  </Suspense>
);

// Table content Suspense boundary
interface TableSuspenseProps {
  children: ReactNode;
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export const TableSuspense: React.FC<TableSuspenseProps> = ({
  children,
  rows = 5,
  columns = 4,
  showHeader = true,
}) => (
  <Suspense
    fallback={
      <SkeletonTable rows={rows} columns={columns} showHeader={showHeader} />
    }
  >
    {children}
  </Suspense>
);

// Form content Suspense boundary
interface FormSuspenseProps {
  children: ReactNode;
  fields?: number;
  showLabels?: boolean;
  showSubmit?: boolean;
}

export const FormSuspense: React.FC<FormSuspenseProps> = ({
  children,
  fields = 4,
  showLabels = true,
  showSubmit = true,
}) => (
  <Suspense
    fallback={
      <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
        <SkeletonForm
          fields={fields}
          showLabels={showLabels}
          showSubmit={showSubmit}
        />
      </div>
    }
  >
    {children}
  </Suspense>
);

// Sidebar content Suspense boundary
interface SidebarSuspenseProps {
  children: ReactNode;
  items?: number;
  showHeader?: boolean;
}

export const SidebarSuspense: React.FC<SidebarSuspenseProps> = ({
  children,
  items = 8,
  showHeader = true,
}) => (
  <Suspense
    fallback={<SkeletonSidebar items={items} showHeader={showHeader} />}
  >
    {children}
  </Suspense>
);

// List content Suspense boundary
interface ListSuspenseProps {
  children: ReactNode;
  items?: number;
  showAvatars?: boolean;
}

export const ListSuspense: React.FC<ListSuspenseProps> = ({
  children,
  items = 5,
  showAvatars = false,
}) => (
  <Suspense fallback={<SkeletonList items={items} showAvatars={showAvatars} />}>
    {children}
  </Suspense>
);

// Content/article Suspense boundary
interface ContentSuspenseProps {
  children: ReactNode;
  titleLines?: number;
  bodyLines?: number;
  showMeta?: boolean;
}

export const ContentSuspense: React.FC<ContentSuspenseProps> = ({
  children,
  titleLines = 1,
  bodyLines = 8,
  showMeta = true,
}) => (
  <Suspense
    fallback={
      <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
        <SkeletonContent
          titleLines={titleLines}
          bodyLines={bodyLines}
          showMeta={showMeta}
        />
      </div>
    }
  >
    {children}
  </Suspense>
);

// Dashboard layout Suspense boundary
interface DashboardSuspenseProps {
  children: ReactNode;
  sidebarItems?: number;
  mainCards?: number;
}

export const DashboardSuspense: React.FC<DashboardSuspenseProps> = ({
  children,
  sidebarItems = 6,
  mainCards = 3,
}) => (
  <Suspense
    fallback={
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <SkeletonSidebar items={sidebarItems} className="h-full" />
        <div className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: mainCards }).map((_, i) => (
              <SkeletonCard key={i} showAvatar={false} showActions={false} />
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <Skeleton height="2rem" width="200px" className="mb-4" />
            <SkeletonTable rows={8} columns={5} />
          </div>
        </div>
      </div>
    }
  >
    {children}
  </Suspense>
);

// Generic async content Suspense boundary
interface AsyncSuspenseProps {
  children: ReactNode;
  skeleton: ReactNode;
  errorFallback?: ReactNode;
}

export const AsyncSuspense: React.FC<AsyncSuspenseProps> = ({
  children,
  skeleton,
  errorFallback,
}) => <Suspense fallback={skeleton}>{children}</Suspense>;

// HOC for components that need skeleton loading
export function withSuspenseSkeleton<P extends object>(
  Component: ComponentType<P>,
  skeletonComponent: ReactNode,
  displayName?: string
) {
  const WrappedComponent = (props: P) => (
    <Suspense fallback={skeletonComponent}>
      <Component {...props} />
    </Suspense>
  );

  WrappedComponent.displayName =
    displayName ||
    `withSuspenseSkeleton(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Lazy loading wrapper with skeleton
export function lazyWithSkeleton<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  skeletonComponent: ReactNode
) {
  const LazyComponent = React.lazy(importFunc);

  return (props: React.ComponentProps<T>) => (
    <Suspense fallback={skeletonComponent}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

// Utility to measure and report layout shift (for CLS monitoring)
export const useLayoutShiftMonitor = () => {
  React.useEffect(() => {
    let initialRects = new Map<Element, DOMRect>();

    const observeLayout = () => {
      const elements = document.querySelectorAll("[data-skeleton-boundary]");
      elements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        initialRects.set(element, rect);
      });
    };

    const checkLayoutShift = () => {
      const elements = document.querySelectorAll("[data-skeleton-boundary]");
      let maxShift = 0;

      elements.forEach((element) => {
        const initialRect = initialRects.get(element);
        if (initialRect) {
          const currentRect = element.getBoundingClientRect();
          const shift =
            Math.abs(currentRect.top - initialRect.top) +
            Math.abs(currentRect.left - initialRect.left);
          maxShift = Math.max(maxShift, shift);
        }
      });

      // Report layout shift if significant (> 0.1 CLS)
      if (maxShift > 10) {
        // 10px threshold
        console.warn(`Layout shift detected: ${maxShift}px`);

        // Track in analytics if available
        if (typeof window !== "undefined" && (window as any).analytics) {
          (window as any).analytics.track("layout_shift", {
            shift_pixels: maxShift,
            threshold_exceeded: maxShift > 10,
          });
        }
      }
    };

    observeLayout();

    // Check for layout shifts after content loads
    const timeoutId = setTimeout(checkLayoutShift, 100);

    return () => clearTimeout(timeoutId);
  }, []);
};
