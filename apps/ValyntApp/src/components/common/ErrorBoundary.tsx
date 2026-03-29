import { AlertTriangle, Home, MessageSquare, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { safeNavigate, safeReload, navigateToLogin } from "@/lib/safeNavigation";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: string; // Context where the error occurred (e.g., "dashboard", "canvas")
  showDetails?: boolean; // Whether to show error details in production
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

  handleReset = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(
        (prev) =>
          ({
            hasError: false,
            retryCount: prev.retryCount + 1,
          }) as State
      );
    } else {
      // After max retries, redirect to home safely
      safeNavigate("/dashboard", { fallback: "/login" });
    }
  };

  getErrorType = (error: Error): "network" | "auth" | "data" | "unknown" => {
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
  };

  getErrorMessage = (errorType: string, context?: string) => {
    const messages = {
      network: {
        title: "Connection Problem",
        description:
          "Unable to connect to our servers. Please check your internet connection and try again.",
        icon: WifiOff,
      },
      auth: {
        title: "Authentication Required",
        description: "Your session has expired. Please sign in again to continue.",
        icon: MessageSquare,
      },
      data: {
        title: "Data Loading Error",
        description: `Unable to load ${context || "content"}. The data might be temporarily unavailable.`,
        icon: AlertTriangle,
      },
      unknown: {
        title: "Something went wrong",
        description: "We encountered an unexpected error. Our team has been notified.",
        icon: AlertTriangle,
      },
    };

    return messages[errorType as keyof typeof messages] || messages.unknown;
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorType = this.state.error ? this.getErrorType(this.state.error) : "unknown";
      const {
        title,
        description,
        icon: Icon,
      } = this.getErrorMessage(errorType, this.props.context);
      const showDetails = this.props.showDetails || import.meta.env.DEV;
      const canRetry = this.state.retryCount < this.maxRetries;

      return (
        <div
          className="flex items-center justify-center min-h-screen bg-background px-4"
          role="alert"
          aria-labelledby="error-title"
        >
          <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 text-center border">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-full mb-4">
              <Icon className="h-8 w-8 text-destructive" aria-hidden="true" />
            </div>

            <h1 id="error-title" className="text-2xl font-bold text-foreground mb-2">
              {title}
            </h1>

            <p className="text-muted-foreground mb-6">{description}</p>

            {errorType === "network" && (
              <Alert className="mb-6 text-left">
                <Wifi className="h-4 w-4" />
                <AlertDescription>
                  <strong>Troubleshooting tips:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Check your internet connection</li>
                    <li>Try refreshing the page</li>
                    <li>Clear your browser cache</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {showDetails && this.state.error && (
              <details className="text-left mb-6 p-4 bg-muted rounded-lg">
                <summary className="cursor-pointer text-sm font-medium text-foreground mb-2">
                  Error Details{" "}
                  {this.state.retryCount > 0 && `(Attempt ${this.state.retryCount + 1})`}
                </summary>
                <pre className="text-xs text-destructive overflow-auto whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {canRetry ? (
                <Button onClick={this.handleReset}>
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  Try Again{" "}
                  {this.state.retryCount > 0 && `(${this.state.retryCount}/${this.maxRetries})`}
                </Button>
              ) : (sfeR
                < Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Reload Page
            </Button>
              )}

            <Button variant="outline" onClick={() => safeNavigate("/dashboard", { fallback: "/login" })}>
              <Home className="h-4 w-4 mr-2" aria-hidden="true" />
              Go to Home
            </Button>
          </div>

          {errorType === "auth" && (
            <p className="text-xs text-muted-foreground mt-4">
              <button
                onClick={() => navigateToLogin()}
                className="underline hover:text-foreground bg-transparent border-none cursor-pointer p-0"
              >
                Click here to sign in
              </button>
            </p>
          )}
        </div>
        </div >
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
