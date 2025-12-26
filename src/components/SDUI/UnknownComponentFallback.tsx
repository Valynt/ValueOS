import React from "react";
import { AlertTriangle } from "lucide-react";
import { logger } from "../../lib/logger";
import { env } from "../../lib/env";

export interface UnknownComponentFallbackProps {
  componentType: string;
  error?: Error;
  retry?: () => void;
}

/**
 * UnknownComponentFallback
 *
 * Displayed when a dynamic component fails to load or the component type is not recognized.
 * Prevents the entire UI from crashing and provides diagnostic information for developers.
 */
export const UnknownComponentFallback: React.FC<
  UnknownComponentFallbackProps
> = ({ componentType, error, retry }) => {
  // Log the error for observability
  React.useEffect(() => {
    logger.error(
      `Unknown or failed component: ${componentType}`,
      error || new Error("Unknown component type")
    );
  }, [componentType, error]);

  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm"
      data-testid="unknown-component-fallback"
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-gray-900">
        Component Unavailable
      </h3>
      <p className="mb-4 text-xs text-gray-600 max-w-xs mx-auto">
        The component "{componentType}" could not be rendered. Our engineers
        have been notified.
      </p>

      {retry && (
        <button
          onClick={retry}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
        >
          Try Reloading
        </button>
      )}

      {env.isDevelopment && error && (
        <div className="mt-4 text-left">
          <p className="text-[10px] font-mono text-amber-800 bg-amber-100/50 p-2 rounded overflow-auto max-h-32">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </p>
        </div>
      )}
    </div>
  );
};
