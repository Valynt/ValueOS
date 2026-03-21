/**
 * withSuspense
 *
 * Higher-order component that wraps a component with a React Suspense boundary.
 * Use this on lazy-loaded routes and data-heavy feature components to provide
 * granular loading states rather than a single top-level spinner.
 *
 * Usage:
 *   const LazyDashboard = withSuspense(lazy(() => import('./views/Dashboard')));
 *   const LazyDashboard = withSuspense(lazy(() => import('./views/Dashboard')), <PageSkeleton />);
 */

import React, { type ComponentType, type ReactNode, Suspense } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

/**
 * Wraps a component with a Suspense boundary and a configurable fallback.
 */
export function withSuspense<P extends object>(
  WrappedComponent: ComponentType<P>,
  fallback: ReactNode = <LoadingSpinner />
): ComponentType<P> {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  function WithSuspenseWrapper(props: P) {
    return (
      <Suspense fallback={fallback}>
        <WrappedComponent {...props} />
      </Suspense>
    );
  }

  WithSuspenseWrapper.displayName = `WithSuspense(${displayName})`;
  return WithSuspenseWrapper;
}

export default withSuspense;
