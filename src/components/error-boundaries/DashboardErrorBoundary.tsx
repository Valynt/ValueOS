/**
 * Dashboard Error Boundary
 * Specialized error boundary for full-page dashboard views with recovery options
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  XCircle,
} from "lucide-react";

interface Props {
  children: ReactNode;
  title?: string;
  recoveryOptions?: Array<{
    label: string;
    action: () => void;
    icon?: ReactNode;
  }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showFullError?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      "Dashboard Error Boundary caught an error:",
      error,
      errorInfo
    );

    this.setState({
      error,
      errorInfo,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.logErrorToMonitoring(error, errorInfo);
  }

  private logErrorToMonitoring(error: Error, errorInfo: ErrorInfo) {
    try {
      // Log to monitoring service
      const errorPayload = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        dashboardTitle: this.props.title,
      };

      // Send to backend logging endpoint
      // fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorPayload),
      // }).catch(console.error);

      console.log("[Dashboard Error]", errorPayload);
    } catch (loggingError) {
      console.error("Failed to log dashboard error:", loggingError);
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private toggleDetails = () => {
    this.setState({ showDetails: !this.state.showDetails });
  };

  render() {
    if (this.state.hasError) {
      const {
        title = "Dashboard",
        recoveryOptions,
        showFullError,
      } = this.props;

      return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Header */}
          <div className="h-14 border-b border-border px-6 flex items-center bg-card">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-600" />
              <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded font-medium">
                Error
              </span>
            </div>
          </div>

          {/* Error Content */}
          <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
            <div className="max-w-2xl w-full">
              {/* Error Card */}
              <div className="bg-white border-2 border-red-200 rounded-lg p-8 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      Unable to Load {title}
                    </h2>

                    <p className="text-gray-600 mb-6">
                      We encountered an unexpected error while loading this
                      dashboard. Your data is safe, but something went wrong
                      with the display.
                    </p>

                    {/* Error Message */}
                    {(showFullError ||
                      process.env.NODE_ENV === "development") &&
                      this.state.error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
                          <p className="text-sm font-medium text-red-800 mb-1">
                            Error Details:
                          </p>
                          <p className="text-sm text-red-700 font-mono break-all">
                            {this.state.error.toString()}
                          </p>
                        </div>
                      )}

                    {/* Recovery Actions */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-700">
                        What would you like to do?
                      </p>

                      <div className="grid grid-cols-1 gap-2">
                        {/* Default Recovery Options */}
                        <button
                          onClick={this.handleReset}
                          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Try Again</span>
                        </button>

                        <button
                          onClick={this.handleReload}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Reload Page</span>
                        </button>

                        {/* Custom Recovery Options */}
                        {recoveryOptions?.map((option, index) => (
                          <button
                            key={index}
                            onClick={option.action}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            {option.icon}
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Technical Details (Development Mode) */}
                    {process.env.NODE_ENV === "development" &&
                      this.state.errorInfo && (
                        <div className="mt-6">
                          <button
                            onClick={this.toggleDetails}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                          >
                            {this.state.showDetails ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                            <span>Component Stack Trace</span>
                          </button>

                          {this.state.showDetails && (
                            <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-64">
                              {this.state.errorInfo.componentStack}
                            </pre>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {/* Help Text */}
              <div className="mt-4 text-center text-sm text-gray-500">
                If this problem persists, please contact support with the error
                details above.
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DashboardErrorBoundary;
