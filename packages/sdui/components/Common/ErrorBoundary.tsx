import React, { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  onError?: (error: Error, errorInfo?: ErrorInfo) => void;
  fallback?: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div role="alert" style={{ padding: "1rem", color: "#b91c1c" }}>
          <p>Something went wrong rendering this component.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
