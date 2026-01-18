import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error without exposing sensitive information
    console.error("ErrorBoundary caught an error:", error.name);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Store error info for debugging
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    if (this.state.retryCount < 3) {
      this.setState((prevState) => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  render() {
    if (this.state.hasError) {
      // Check if it's an authentication-related error
      const isAuthError =
        this.state.error?.message?.toLowerCase().includes("auth") ||
        this.state.error?.message?.toLowerCase().includes("token") ||
        this.state.error?.message?.toLowerCase().includes("session");

      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-red-400"
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
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">
                    {isAuthError ? "Authentication Error" : "Something went wrong"}
                  </h3>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <p>
                  {isAuthError
                    ? "There was an issue with authentication. Please try logging in again."
                    : "An unexpected error occurred. Please refresh the page and try again."}
                </p>
                {this.state.retryCount > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Retry attempt {this.state.retryCount} of 3
                  </p>
                )}
              </div>
              <div className="mt-4 flex space-x-3">
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={this.handleRetry}
                  disabled={this.state.retryCount >= 3}
                >
                  {this.state.retryCount >= 3 ? "Max Retries Reached" : "Try Again"}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </button>
                {isAuthError && (
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    onClick={() => {
                      // Clear auth data and redirect to login
                      localStorage.clear();
                      sessionStorage.clear();
                      window.location.href = "/login";
                    }}
                  >
                    Clear Session
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
