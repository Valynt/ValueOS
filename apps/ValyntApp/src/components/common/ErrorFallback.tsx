/**
 * ErrorFallback
 *
 * Pure UI component for rendering error recovery UI.
 * Separated from ErrorBoundary to keep the boundary class lean.
 */
import { AlertTriangle, Home, MessageSquare, RefreshCw, Wifi, WifiOff } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SafeLink } from "./SafeLink";

export type ErrorType = "network" | "auth" | "data" | "unknown";

interface ErrorFallbackProps {
  errorType: ErrorType;
  context?: string;
  retryCount: number;
  maxRetries: number;
  error?: Error | null;
  showDetails?: boolean;
  onRetry: () => void;
  onReload: () => void;
}

const errorMessages: Record<ErrorType, { title: string; description: string; icon: typeof AlertTriangle }> = {
  network: {
    title: "Connection Problem",
    description: "Unable to connect to our servers. Please check your internet connection and try again.",
    icon: WifiOff,
  },
  auth: {
    title: "Authentication Required",
    description: "Your session has expired. Please sign in again to continue.",
    icon: MessageSquare,
  },
  data: {
    title: "Data Loading Error",
    description: "The data might be temporarily unavailable.",
    icon: AlertTriangle,
  },
  unknown: {
    title: "Something went wrong",
    description: "We encountered an unexpected error. Our team has been notified.",
    icon: AlertTriangle,
  },
};

function getErrorMessage(errorType: ErrorType, context?: string) {
  const base = errorMessages[errorType] ?? errorMessages.unknown;
  if (errorType === "data" && context) {
    return {
      ...base,
      description: `Unable to load ${context}. ${base.description}`,
    };
  }
  return base;
}

export function ErrorFallback({
  errorType,
  context,
  retryCount,
  maxRetries,
  error,
  showDetails,
  onRetry,
  onReload,
}: ErrorFallbackProps) {
  const { title, description, icon: Icon } = getErrorMessage(errorType, context);
  const canRetry = retryCount < maxRetries;

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

        {showDetails && error && (
          <details className="text-left mb-6 p-4 bg-muted rounded-lg">
            <summary className="cursor-pointer text-sm font-medium text-foreground mb-2">
              Error Details{" "}
              {retryCount > 0 && `(Attempt ${retryCount + 1})`}
            </summary>
            <pre className="text-xs text-destructive overflow-auto whitespace-pre-wrap">
              {error.toString()}
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {canRetry ? (
            <Button onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Try Again{" "}
              {retryCount > 0 && `(${retryCount}/${maxRetries})`}
            </Button>
          ) : (
            <Button onClick={onReload}>
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Reload Page
            </Button>
          )}

          {/* SafeLink provides native <a> fallback for no-JS scenarios */}
          <SafeLink
            to="/dashboard"
            fallback="/login"
            variant="button"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Go to Home
          </SafeLink>
        </div>

        {errorType === "auth" && (
          <p className="text-xs text-muted-foreground mt-4">
            <SafeLink
              to="/login"
              className="underline hover:text-foreground"
            >
              Click here to sign in
            </SafeLink>
          </p>
        )}
      </div>
    </div>
  );
}
