/**
 * Canvas Error Boundary
 *
 * Specialized error boundary for canvas-related components.
 * Provides graceful fallbacks for SDUI rendering errors.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../../lib/logger';

interface Props {
  children: ReactNode;
  caseId?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Canvas ErrorBoundary caught an error:', error, {
      componentStack: errorInfo.componentStack,
      caseId: this.props.caseId
    });

    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-background">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full mb-4">
              <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden="true" />
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-2">
              Canvas Rendering Error
            </h3>

            <p className="text-muted-foreground mb-6">
              We encountered an issue rendering this content. This might be due to
              invalid data or a temporary glitch.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>

              {this.props.caseId && (
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted transition-colors"
                >
                  Refresh Page
                </button>
              )}
            </div>

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground mb-2">
                  Error Details (Development)
                </summary>
                <div className="p-3 bg-muted rounded-lg">
                  <pre className="text-xs text-red-600 overflow-auto">
                    {this.state.error.toString()}
                  </pre>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-gray-600 mt-2 overflow-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Minimal error boundary for non-critical components
 */
export const MinimalErrorBoundary: React.FC<{
  children: ReactNode;
  fallback?: ReactNode;
}> = ({ children, fallback }) => {
  return (
    <div className="error-boundary-wrapper">
      {children}
    </div>
  );
};
