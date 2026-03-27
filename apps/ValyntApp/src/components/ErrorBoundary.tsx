/**
 * ErrorBoundary
 *
 * Catches React rendering errors and displays a recovery UI.
 *
 * UX Principles:
 * - Error Prevention > Error Messages: explains how to fix, not just what went wrong
 * - POLA: consistent styling with design system tokens
 * - Immediate Feedback: clear error state with actionable recovery options
 * - Accessibility: role="alert", focus management, keyboard-accessible actions
 */

import { Component, ErrorInfo, ReactNode, useState } from "react";

import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** X-Request-ID from the UnifiedApiClient — displayed in error state so users can copy it for support. */
  requestId?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

type ErrorCategory = "auth" | "network" | "generic";

function categorizeError(error?: Error): ErrorCategory {
  const msg = error?.message?.toLowerCase() ?? "";
  if (msg.includes("auth") || msg.includes("token") || msg.includes("session") || msg.includes("401")) {
    return "auth";
  }
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("timeout") || msg.includes("503")) {
    return "network";
  }
  return "generic";
}

const errorContent: Record<ErrorCategory, { title: string; description: string; fixHint: string }> = {
  auth: {
    title: "Authentication Error",
    description: "Your session may have expired or your credentials are no longer valid.",
    fixHint: "Try logging in again. If the problem persists, clear your browser session.",
  },
  network: {
    title: "Connection Problem",
    description: "We couldn't reach the server. This is usually temporary.",
    fixHint: "Check your internet connection and try again in a few seconds.",
  },
  generic: {
    title: "Something went wrong",
    description: "An unexpected error occurred while rendering this page.",
    fixHint: "Try again or refresh the page. If this keeps happening, contact support.",
  },
};

/** Inline component — uses hooks, so it must live outside the class boundary. */
function RequestIdCopy({ requestId }: { requestId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(requestId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-md bg-secondary/50 border border-border p-3 mb-4">
      <p className="text-xs font-medium text-foreground mb-1">Request ID</p>
      <div className="flex items-center gap-2">
        <code className="text-xs text-muted-foreground font-mono break-all flex-1">
          {requestId}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "shrink-0 text-xs px-2 py-1 rounded border transition-colors",
            copied
              ? "border-green-400 text-green-700 bg-green-50"
              : "border-border text-muted-foreground hover:bg-secondary",
          )}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error.name);
    this.props.onError?.(error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    if (this.state.retryCount < 3) {
      this.setState((prev) => ({
        hasError: false,
        retryCount: prev.retryCount + 1,
      }));
    }
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const category = categorizeError(this.state.error);
    const content = errorContent[category];
    const canRetry = this.state.retryCount < 3;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div
          className="max-w-md w-full rounded-lg border border-border bg-card shadow-lg p-6"
          role="alert"
          aria-live="assertive"
        >
          {/* Icon + Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              category === "auth" ? "bg-warning/10" : "bg-destructive/10"
            )}>
              <svg
                className={cn(
                  "h-5 w-5",
                  category === "auth" ? "text-warning" : "text-destructive"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{content.title}</h3>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-2">{content.description}</p>

          {/* Fix hint */}
          <div className="rounded-md bg-secondary/50 border border-border p-3 mb-4">
            <p className="text-xs font-medium text-foreground mb-0.5">How to fix</p>
            <p className="text-xs text-muted-foreground">{content.fixHint}</p>
          </div>

          {/* Retry counter */}
          {this.state.retryCount > 0 && (
            <p className="text-xs text-muted-foreground mb-3">
              Retry attempt {this.state.retryCount} of 3
            </p>
          )}

          {/* Request ID — copy for support tickets */}
          {this.props.requestId && (
            <RequestIdCopy requestId={this.props.requestId} />
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              disabled={!canRetry}
              className={cn(
                "inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:pointer-events-none"
              )}
            >
              {canRetry ? "Try Again" : "Max Retries Reached"}
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className={cn(
                "inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
                "border border-border text-foreground hover:bg-secondary",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
            >
              Refresh Page
            </button>

            {category === "auth" && (
              <button
                type="button"
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.href = "/login";
                }}
                className={cn(
                  "inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                )}
              >
                Clear Session & Login
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
