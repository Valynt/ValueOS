/**
 * ExecutiveLayoutErrorBoundary Component
 *
 * Hierarchical error boundaries for the three-panel layout.
 * Each panel can fail independently without crashing the entire app.
 * Logs errors to console and optionally to monitoring service.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { analyticsClient } from '@/lib/analyticsClient';
import { RequestIdContext, type RequestIdContextValue } from '@valueos/sdui';

interface Props {
  children: ReactNode;
  /** Fallback UI when error occurs */
  fallback?: ReactNode;
  /** Name for debugging/logging */
  boundaryName: string;
  /** Optional className for styling */
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ExecutiveLayoutErrorBoundary extends Component<Props, State> {
  static override contextType = RequestIdContext;
  declare context: RequestIdContextValue;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const route = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
    const correlationId = this.context?.lastFailedRequestId ?? undefined;
    const payload = {
      boundary_name: this.sanitizeTelemetryField(this.props.boundaryName),
      error_message: this.sanitizeTelemetryField(error.message),
      component_stack: this.sanitizeTelemetryField(errorInfo.componentStack),
      route: this.sanitizeTelemetryField(route),
      ...(correlationId ? { correlation_id: this.sanitizeTelemetryField(correlationId) } : {}),
    };

    // Keep console logging minimal to avoid leaking sensitive payloads.
    console.error(`[${this.props.boundaryName}] Error caught`, {
      error_message: payload.error_message,
      route: payload.route,
      ...(correlationId ? { correlation_id: payload.correlation_id } : {}),
    });

    analyticsClient.track('react_error_boundary_triggered', payload);
  }

  private sanitizeTelemetryField(value: string, maxLength = 2000): string {
    return value.replace(/[\r\n\t]+/g, ' ').slice(0, maxLength);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      // Return custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div
          className={cn(
            'p-6 rounded-xl bg-md-error-container border border-md-error',
            'flex flex-col items-center justify-center text-center',
            this.props.className
          )}
        >
          <MaterialIcon
            icon="error_outline"
            size="xl"
            className="text-md-on-error-container mb-4"
          />
          <h3 className="text-lg font-semibold text-md-on-error-container mb-2">
            This section encountered an error
          </h3>
          <p className="text-sm text-md-on-error-container/80 mb-4 max-w-xs">
            {this.state.error?.message || 'Something went wrong'}
          </p>
          <button
            onClick={this.resetErrorBoundary}
            className="px-4 py-2 bg-md-primary text-md-on-primary rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Placeholder components for different error scenarios
 */
export function NavPlaceholder() {
  return (
    <div className="w-20 bg-md-surface-container-lowest border-r border-md-outline-variant flex flex-col items-center py-6">
      <div className="w-12 h-12 bg-md-primary-container rounded-xl mb-8" />
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="w-10 h-10 bg-md-surface-container-high rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function AISidebarPlaceholder() {
  return (
    <div className="w-[380px] bg-md-surface-container-lowest border-l border-md-outline-variant p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-md-surface-container-high rounded-lg" />
        <div className="space-y-1">
          <div className="w-24 h-4 bg-md-surface-container-high rounded" />
          <div className="w-16 h-3 bg-md-surface-container-high rounded" />
        </div>
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-4 bg-md-surface-container-high rounded-xl">
            <div className="w-full h-12 bg-md-surface-container rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FullPageError() {
  return (
    <div className="h-screen flex items-center justify-center bg-md-surface p-6">
      <div className="max-w-md text-center">
        <MaterialIcon
          icon="error_outline"
          size="xl"
          className="text-md-error mx-auto mb-4"
        />
        <h1 className="text-2xl font-bold text-md-on-surface mb-2">
          Application Error
        </h1>
        <p className="text-md-on-surface-variant mb-6">
          We're sorry, but something went wrong. Please refresh the page or try again later.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-md-primary text-md-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}
