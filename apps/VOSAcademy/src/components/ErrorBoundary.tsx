import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  showHomeButton?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  showHomeButton?: boolean;
}

export function ErrorFallback({ error, resetError, showHomeButton = true }: ErrorFallbackProps) {
  const handleRetry = () => {
    resetError();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-xl border border-border bg-card text-card-foreground shadow-beautiful-lg">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We encountered an unexpected error. This has been reported to our team.
          </p>
        </div>

        <div className="space-y-4 px-6 pb-6">
          <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <p className="text-sm">
              {error.message || 'An unexpected error occurred'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </button>

            {showHomeButton && (
              <button
                type="button"
                onClick={handleGoHome}
                className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </button>
            )}
          </div>

          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Error Details (Development)
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // In a real app, you might log this to an error reporting service
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={this.handleReset}
          showHomeButton={this.props.showHomeButton}
        />
      );
    }

    return this.props.children;
  }
}

// Hook for managing async operations with error handling
export function useAsyncOperation() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const execute = React.useCallback(async <T,>(
    operation: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await operation();
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unexpected error occurred');
      setError(error);
      onError?.(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = React.useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { loading, error, execute, reset };
}

// Generic loading component
export function LoadingSpinner({ size = 'md', text }: { size?: 'sm' | 'md' | 'lg'; text?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className="flex items-center justify-center gap-2" role="status" aria-live="polite">
      <div
        className={`${sizeClasses[size]} border-2 border-primary border-t-transparent rounded-full animate-spin`}
        aria-hidden="true"
      />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// Skeleton loading components
export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-card p-4">
      <div className="mb-3 space-y-2">
        <div className="mb-1 h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-3 rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
        <div className="h-3 w-4/6 rounded bg-muted" />
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 bg-muted rounded ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export default ErrorBoundary;
