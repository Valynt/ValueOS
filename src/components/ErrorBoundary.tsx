/**
 * Error Boundary Component
 * Provides graceful error handling for UI templates
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logSecurityEvent } from '../utils/templateSecurity';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error: error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for monitoring
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    // Log security event if it's a potential security issue
    if (error.message.includes('xss') || error.message.includes('script') || error.message.includes('eval')) {
      logSecurityEvent({
        type: 'xss_attempt',
        source: 'ErrorBoundary',
        details: { error: error.message, stack: error.stack },
      });
    } else {
      logSecurityEvent({
        type: 'runtime_error',
        source: 'ErrorBoundary',
        details: { error: error.message, componentStack: errorInfo.componentStack },
      });
    }

    // Update state
    this.setState({
      hasError: true,
      error: error,
      errorInfo: errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Render fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div 
          className="error-boundary-fallback"
          role="alert"
          aria-live="assertive"
          style={{
            padding: '2rem',
            margin: '1rem',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
          }}
        >
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
            ⚠️ Something went wrong
          </h2>
          
          <p style={{ marginBottom: '1rem' }}>
            We encountered an unexpected error. Our team has been notified.
          </p>
          
          <details style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600' }}>
              Technical Details (for support)
            </summary>
            <pre 
              style={{ 
                marginTop: '0.5rem', 
                padding: '0.5rem', 
                backgroundColor: '#f8f8f8',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '0.75rem',
              }}
            >
              {this.state.error?.message}
              {'\n'}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              onClick={this.resetError}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Try Again
            </button>
            
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WrappedComponent;
}

// Hook for error boundary (for functional components)
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);
  
  const resetError = () => setError(null);
  
  return {
    error,
    resetError,
    setError,
  };
}

// Template-specific error boundaries
export const TemplateErrorBoundary: React.FC<{ children: ReactNode; templateName: string }> = ({
  children,
  templateName,
}) => {
  const fallback = (
    <div 
      className="template-error-fallback"
      role="alert"
      aria-live="assertive"
      style={{
        padding: '2rem',
        margin: '1rem',
        border: '2px solid #f59e0b',
        borderRadius: '8px',
        backgroundColor: '#fffbeb',
        color: '#92400e',
      }}
    >
      <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 'bold' }}>
        🛠️ {templateName} Template Error
      </h2>
      
      <p style={{ marginBottom: '1rem' }}>
        This template encountered an error. Please try the following:
      </p>
      
      <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
        <li>Refresh the page</li>
        <li>Clear your browser cache</li>
        <li>Contact support if the issue persists</li>
      </ul>
      
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#f59e0b',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '600',
        }}
      >
        Reload Template
      </button>
    </div>
  );

  return (
    <ErrorBoundary 
      fallback={fallback}
      onError={(error, errorInfo) => {
        logSecurityEvent({
          type: 'runtime_error',
          source: `Template:${templateName}`,
          details: { 
            error: error.message, 
            stack: error.stack,
            componentStack: errorInfo.componentStack 
          },
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;