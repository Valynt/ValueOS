import { logger } from '../../lib/logger';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Props for ComponentErrorBoundary
 */
interface ComponentErrorBoundaryProps {
  /**
   * Child components to render
   */
  children: ReactNode;

  /**
   * Name of the component being wrapped (for error reporting)
   */
  componentName: string;

  /**
   * Custom fallback UI to show on error
   */
  fallback?: ReactNode;

  /**
   * Callback when an error is caught
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /**
   * Whether to show error details in the UI
   * @default false in production, true in development
   */
  showErrorDetails?: boolean;

  /**
   * Whether to allow retry after error
   * @default true
   */
  allowRetry?: boolean;
}

/**
 * State for ComponentErrorBoundary
 */
interface ComponentErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Error boundary specifically designed for SDUI component rendering.
 * Catches errors in child components and displays a graceful fallback.
 *
 * Features:
 * - Isolated error handling per component
 * - Custom fallback UI
 * - Error logging and reporting
 * - Retry capability
 * - Development-friendly error details
 *
 * @example
 * ```tsx
 * <ComponentErrorBoundary
 *   componentName="MyComponent"
 *   onError={(error) => logError(error)}
 * >
 *   <MyComponent {...props} />
 * </ComponentErrorBoundary>
 * ```
 */
export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  /**
   * Update state when an error is caught
   */
  static getDerivedStateFromError(error: Error): ComponentErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log error and call error handler
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { componentName, onError } = this.props;

    // Log to console
    logger.error(
      `Error in SDUI component "${componentName}":`,
      error,
      errorInfo
    );

    // Update state with error info
    this.setState({ errorInfo });

    // Call error handler if provided
    onError?.(error, errorInfo);

    // Log to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with error tracking service (e.g., Sentry)
      // logErrorToService(error, { componentName, errorInfo });
    }
  }

  /**
   * Reset error state to retry rendering
   */
  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  /**
   * Render fallback UI when error occurs
   */
  renderFallback(): ReactNode {
    const { componentName, fallback, showErrorDetails, allowRetry = true } = this.props;
    const { error, errorInfo } = this.state;

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    // Determine if we should show error details
    const shouldShowDetails =
      showErrorDetails ?? process.env.NODE_ENV === 'development';

    // Default fallback UI
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900"
        role="alert"
        aria-live="assertive"
        data-testid="component-error-boundary"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold mb-1">
              Component Error: {componentName}
            </h3>

            <p className="text-sm text-red-800 mb-3">
              This component encountered an error and could not be rendered.
            </p>

            {shouldShowDetails && error && (
              <details className="mb-3">
                <summary className="cursor-pointer text-sm font-medium text-red-700 hover:text-red-900 mb-2">
                  Error Details
                </summary>
                <div className="rounded bg-red-100 p-3 text-xs font-mono">
                  <div className="mb-2">
                    <strong>Message:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div className="mb-2">
                      <strong>Stack:</strong>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {errorInfo && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {allowRetry && (
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                aria-label={`Retry rendering ${componentName}`}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with ComponentErrorBoundary
 *
 * @example
 * ```tsx
 * const SafeComponent = withComponentErrorBoundary(MyComponent, {
 *   componentName: 'MyComponent',
 *   onError: (error) => logError(error),
 * });
 * ```
 */
export function withComponentErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  boundaryProps: Omit<ComponentErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ComponentErrorBoundary {...boundaryProps}>
      <Component {...props} />
    </ComponentErrorBoundary>
  );

  WrappedComponent.displayName = `withComponentErrorBoundary(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WrappedComponent;
}
