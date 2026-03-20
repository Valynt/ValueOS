import React, { ErrorInfo, ReactNode } from "react";

import { captureException } from "../lib/sentry";

import ErrorBoundary from "./ErrorBoundary";

interface ProviderWrapperProps {
  children: ReactNode;
}

/**
 * ProviderWrapper - Wraps all providers with comprehensive error boundaries
 * Provides different error handling strategies for different provider types
 */
const ProviderWrapper: React.FC<ProviderWrapperProps> = ({ children }) => {
  const handleAuthError = (error: Error, _errorInfo: ErrorInfo) => {
    captureException(error);
  };

  const handleNetworkError = (error: Error, _errorInfo: ErrorInfo) => {
    captureException(error);
  };

  const handleCriticalError = (error: Error, _errorInfo: ErrorInfo) => {
    captureException(error);
  };

  return (
    <ErrorBoundary onError={handleCriticalError}>
      <ErrorBoundary
        onError={handleAuthError}
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="max-w-md w-full bg-card shadow-lg rounded-lg p-6">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <svg
                    className="h-12 w-12 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h2 className="text-lg font-medium text-foreground mb-2">Authentication Error</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  We encountered an issue with authentication. Please try logging in again.
                </p>
                <button
                  onClick={() => (window.location.href = "/login")}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Go to Login
                </button>
              </div>
            </div>
          </div>
        }
      >
        <ErrorBoundary onError={handleNetworkError}>{children}</ErrorBoundary>
      </ErrorBoundary>
    </ErrorBoundary>
  );
};

export default ProviderWrapper;
