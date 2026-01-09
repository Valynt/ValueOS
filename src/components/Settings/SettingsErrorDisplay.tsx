/**
 * Settings Error Display Components
 * 
 * Sprint 2 Enhancement: Standardized error display
 * Provides consistent error UX across all settings pages
 */

import React from 'react';
import { AlertCircle, AlertTriangle, RefreshCw, XCircle } from 'lucide-react';

// ============================================================================
// Error Alert
// ============================================================================

export interface ErrorAlertProps {
  message: string;
  type?: 'error' | 'warning' | 'info';
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  type = 'error',
  onDismiss,
  onRetry,
  className = '',
}) => {
  const config = {
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600',
    },
    info: {
      icon: AlertCircle,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600',
    },
  };

  const { icon: Icon, bgColor, borderColor, textColor, iconColor } = config[type];

  return (
    <div
      className={`
        flex items-start space-x-3 p-4 rounded-lg border
        ${bgColor} ${borderColor} ${className}
      `}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${iconColor}`} />
      
      <div className="flex-1">
        <p className={`text-sm ${textColor}`}>{message}</p>
      </div>

      <div className="flex items-center space-x-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className={`
              p-1 rounded hover:bg-white/50 transition-colors
              ${textColor}
            `}
            title="Retry"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`
              p-1 rounded hover:bg-white/50 transition-colors
              ${textColor}
            `}
            title="Dismiss"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Inline Error
// ============================================================================

export interface InlineErrorProps {
  message: string;
  className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  className = '',
}) => {
  return (
    <p className={`text-sm text-red-600 flex items-center ${className}`}>
      <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
      {message}
    </p>
  );
};

// ============================================================================
// Error Page
// ============================================================================

export interface ErrorPageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onGoBack?: () => void;
}

export const ErrorPage: React.FC<ErrorPageProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  onGoBack,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="text-center space-y-3">
        <XCircle className="h-16 w-16 text-red-600 mx-auto" />
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-gray-600 max-w-md">{message}</p>
      </div>

      <div className="flex space-x-3">
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Go Back
          </button>
        )}
        
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Field Error
// ============================================================================

export interface FieldErrorProps {
  error?: string | null;
  touched?: boolean;
}

export const FieldError: React.FC<FieldErrorProps> = ({ error, touched }) => {
  if (!error || !touched) return null;

  return <InlineError message={error} className="mt-1" />;
};

// ============================================================================
// Error Boundary Fallback
// ============================================================================

export interface ErrorBoundaryFallbackProps {
  error: Error;
  resetError: () => void;
}

export const ErrorBoundaryFallback: React.FC<ErrorBoundaryFallbackProps> = ({
  error,
  resetError,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <XCircle className="h-8 w-8 text-red-600 flex-shrink-0" />
          <h2 className="text-xl font-bold text-gray-900">
            Settings Error
          </h2>
        </div>

        <div className="space-y-2">
          <p className="text-gray-600">
            An error occurred while loading settings:
          </p>
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <code className="text-sm text-red-800 break-all">
              {error.message}
            </code>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={resetError}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reload Page
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && error.stack && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
              Stack Trace
            </summary>
            <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-48">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Toast Notification (Simple)
// ============================================================================

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const config = {
    success: {
      bgColor: 'bg-green-600',
      icon: '✓',
    },
    error: {
      bgColor: 'bg-red-600',
      icon: '✕',
    },
    warning: {
      bgColor: 'bg-yellow-600',
      icon: '⚠',
    },
    info: {
      bgColor: 'bg-blue-600',
      icon: 'ℹ',
    },
  };

  const { bgColor, icon } = config[type];

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50
        flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg
        ${bgColor} text-white
        animate-slide-up
      `}
    >
      <span className="text-lg">{icon}</span>
      <p className="text-sm font-medium">{message}</p>
      <button
        onClick={onClose}
        className="ml-2 hover:bg-white/20 rounded p-1 transition-colors"
      >
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
};
