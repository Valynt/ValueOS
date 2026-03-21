/**
 * withErrorBoundary
 *
 * Higher-order component that wraps a component with an ErrorBoundary.
 * Use this to provide per-route or per-feature error isolation so that
 * a failure in one section does not crash the entire application.
 *
 * Usage:
 *   const SafeDashboard = withErrorBoundary(Dashboard, { context: 'Dashboard' });
 */

import React, { type ComponentType, type ReactNode } from "react";
import ErrorBoundary from "./ErrorBoundary";

interface WithErrorBoundaryOptions {
  /** Human-readable context label shown in the fallback UI */
  context?: string;
  /** Custom fallback element — defaults to the ErrorBoundary's built-in fallback */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

/**
 * Wraps a component with an ErrorBoundary for isolated error containment.
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
): ComponentType<P> {
  const { context, fallback, onError } = options;
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary
        context={context ?? displayName}
        fallback={fallback}
        onError={onError}
      >
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  }

  WithErrorBoundaryWrapper.displayName = `WithErrorBoundary(${displayName})`;
  return WithErrorBoundaryWrapper;
}

export default withErrorBoundary;
