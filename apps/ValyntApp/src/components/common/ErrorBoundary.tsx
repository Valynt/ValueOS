/**
 * ErrorBoundary
 *
 * React error boundary that catches errors in child components.
 * Delegates all UI rendering to ErrorFallback for separation of concerns.
 */
import { Component, ErrorInfo, ReactNode } from "react";

import { ErrorFallback, ErrorType } from "./ErrorFallback";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: string;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, retryCount: 0 };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private getErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("connection")
    ) {
      return "network";
    }
    if (
      message.includes("auth") ||
      message.includes("unauthorized") ||
      message.includes("forbidden")
    ) {
      return "auth";
    }
    if (message.includes("data") || message.includes("parse") || message.includes("json")) {
      return "data";
    }
    return "unknown";
  }

  private handleReset = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState((prev) => ({
        hasError: false,
        retryCount: prev.retryCount + 1,
      }));
    }
  };

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  override render() {
    if (this.state.hasError) {
      // Allow custom fallback override
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorType = this.state.error ? this.getErrorType(this.state.error) : "unknown";

      return (
        <ErrorFallback
          errorType={errorType}
          context={this.props.context}
          retryCount={this.state.retryCount}
          maxRetries={this.maxRetries}
          error={this.state.error}
          showDetails={this.props.showDetails ?? (import.meta.env.DEV)}
          onRetry={this.handleReset}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}
