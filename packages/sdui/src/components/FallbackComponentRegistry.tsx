/**
 * Fallback Component Registry
 *
 * Provides graceful degradation when components fail to load or render.
 * Maintains a registry of fallback components with priority-based selection.
 */

import React, { ComponentType, ReactNode } from "react";
import { logger } from "../../lib/logger";
import { AlertTriangle, RefreshCw, Info, Loader2 } from "lucide-react";

/**
 * Fallback component configuration
 */
export interface FallbackComponentConfig {
  /**
   * Component name this fallback is for
   */
  componentName: string;

  /**
   * Fallback component to render
   */
  component: ComponentType<FallbackProps>;

  /**
   * Priority level (lower = higher priority)
   */
  priority: number;

  /**
   * Conditions when this fallback should be used
   */
  conditions?: {
    /**
     * Error types this fallback handles
     */
    errorTypes?: string[];

    /**
     * Component versions this fallback supports
     */
    versions?: number[];

    /**
     * Custom predicate function
     */
    predicate?: (error: Error, context?: any) => boolean;
  };

  /**
   * Metadata about the fallback
   */
  metadata?: {
    description?: string;
    author?: string;
    version?: string;
    capabilities?: string[];
  };
}

/**
 * Props passed to fallback components
 */
export interface FallbackProps {
  /**
   * Original error that occurred
   */
  error?: Error;

  /**
   * Component name that failed
   */
  componentName: string;

  /**
   * Error context information
   */
  errorContext?: {
    errorInfo?: React.ErrorInfo;
    retryCount?: number;
    circuitBreakerState?: string;
    correlationId?: string;
  };

  /**
   * Callback to attempt retry
   */
  onRetry?: () => void;

  /**
   * Whether retry is allowed
   */
  canRetry?: boolean;

  /**
   * Additional props passed through
   */
  [key: string]: any;
}

/**
 * Registry entry with additional runtime data
 */
interface RegistryEntry extends FallbackComponentConfig {
  /**
   * When this entry was registered
   */
  registeredAt: number;

  /**
   * Usage statistics
   */
  stats: {
    timesUsed: number;
    lastUsed?: number;
    successRate: number;
  };
}

/**
 * Fallback Registry Manager
 */
export class FallbackComponentRegistry {
  private registry: Map<string, RegistryEntry[]> = new Map();
  private globalFallbacks: RegistryEntry[] = [];
  private maxEntriesPerComponent = 5;
  private statsEnabled = true;

  /**
   * Register a fallback component for a specific component
   */
  register(config: FallbackComponentConfig): void {
    const entry: RegistryEntry = {
      ...config,
      registeredAt: Date.now(),
      stats: {
        timesUsed: 0,
        successRate: 1.0,
      },
    };

    const existing = this.registry.get(config.componentName) || [];
    const updated = [...existing, entry]
      .sort((a, b) => a.priority - b.priority)
      .slice(0, this.maxEntriesPerComponent);

    this.registry.set(config.componentName, updated);

    logger.info("Fallback component registered", {
      componentName: config.componentName,
      priority: config.priority,
      totalEntries: updated.length,
    });
  }

  /**
   * Register a global fallback (used when no specific fallback is found)
   */
  registerGlobal(config: FallbackComponentConfig): void {
    const entry: RegistryEntry = {
      ...config,
      registeredAt: Date.now(),
      stats: {
        timesUsed: 0,
        successRate: 1.0,
      },
    };

    this.globalFallbacks = [...this.globalFallbacks, entry]
      .sort((a, b) => a.priority - b.priority)
      .slice(0, this.maxEntriesPerComponent);

    logger.info("Global fallback component registered", {
      componentName: config.componentName,
      priority: config.priority,
    });
  }

  /**
   * Get the best fallback for a component and error
   */
  getFallback(
    componentName: string,
    error?: Error,
    context?: any
  ): ComponentType<FallbackProps> | null {
    const specificFallbacks = this.registry.get(componentName) || [];
    const allFallbacks = [...specificFallbacks, ...this.globalFallbacks];

    for (const entry of allFallbacks) {
      if (this.matchesConditions(entry, error, context)) {
        this.recordUsage(entry);
        return entry.component;
      }
    }

    return null;
  }

  /**
   * Check if a fallback entry matches the current conditions
   */
  private matchesConditions(entry: RegistryEntry, error?: Error, context?: any): boolean {
    const { conditions } = entry;

    if (!conditions) return true;

    // Check error types
    if (conditions.errorTypes && error) {
      const errorType = error.constructor.name;
      if (!conditions.errorTypes.includes(errorType)) {
        return false;
      }
    }

    // Check versions
    if (conditions.versions && context?.componentVersion) {
      if (!conditions.versions.includes(context.componentVersion)) {
        return false;
      }
    }

    // Check custom predicate
    if (conditions.predicate && error) {
      try {
        return conditions.predicate(error, context);
      } catch (predicateError) {
        logger.error("Fallback predicate error", {
          componentName: entry.componentName,
          error: predicateError,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Record usage statistics for a fallback
   */
  private recordUsage(entry: RegistryEntry): void {
    if (!this.statsEnabled) return;

    entry.stats.timesUsed++;
    entry.stats.lastUsed = Date.now();

    // Update success rate (simplified - would need more tracking for real accuracy)
    const totalUsage = Array.from(this.registry.values())
      .flat()
      .concat(this.globalFallbacks)
      .reduce((sum, e) => sum + e.stats.timesUsed, 0);

    if (totalUsage > 0) {
      entry.stats.successRate = entry.stats.timesUsed / totalUsage;
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalComponents: number;
    totalFallbacks: number;
    componentStats: Record<string, { fallbackCount: number; totalUsage: number }>;
    globalFallbacks: number;
  } {
    const componentStats: Record<string, { fallbackCount: number; totalUsage: number }> = {};

    for (const [componentName, fallbacks] of this.registry.entries()) {
      componentStats[componentName] = {
        fallbackCount: fallbacks.length,
        totalUsage: fallbacks.reduce((sum, f) => sum + f.stats.timesUsed, 0),
      };
    }

    return {
      totalComponents: this.registry.size,
      totalFallbacks:
        Array.from(this.registry.values()).reduce((sum, fallbacks) => sum + fallbacks.length, 0) +
        this.globalFallbacks.length,
      componentStats,
      globalFallbacks: this.globalFallbacks.length,
    };
  }

  /**
   * Clear all registered fallbacks
   */
  clear(): void {
    this.registry.clear();
    this.globalFallbacks = [];
    logger.info("Fallback registry cleared");
  }

  /**
   * Remove a specific fallback
   */
  unregister(componentName: string, priority?: number): boolean {
    const fallbacks = this.registry.get(componentName);
    if (!fallbacks) return false;

    let removed = false;
    const updated = fallbacks.filter((entry) => {
      if (priority !== undefined && entry.priority === priority) {
        removed = true;
        return false;
      }
      return true;
    });

    if (removed) {
      if (updated.length === 0) {
        this.registry.delete(componentName);
      } else {
        this.registry.set(componentName, updated);
      }

      logger.info("Fallback component unregistered", {
        componentName,
        priority,
      });
    }

    return removed;
  }

  /**
   * Enable or disable statistics collection
   */
  setStatsEnabled(enabled: boolean): void {
    this.statsEnabled = enabled;
    logger.info("Fallback stats enabled", { enabled });
  }
}

// Global registry instance
export const fallbackRegistry = new FallbackComponentRegistry();

// Built-in fallback components

/**
 * Default error fallback - shows basic error information
 */
export const DefaultErrorFallback: ComponentType<FallbackProps> = ({
  componentName,
  error,
  errorContext,
  onRetry,
  canRetry = true,
}) => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
    <div className="flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-sm font-semibold mb-1">{componentName} Error</h3>
        <p className="text-sm text-red-800 mb-3">
          {error?.message || "An unexpected error occurred"}
        </p>
        {canRetry && onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </button>
        )}
      </div>
    </div>
  </div>
);

/**
 * Loading fallback - shows loading state
 */
export const LoadingFallback: ComponentType<FallbackProps> = ({ componentName }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-700">
    <div className="flex items-center gap-3">
      <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      <div className="flex-1">
        <h3 className="text-sm font-semibold mb-1">Loading {componentName}</h3>
        <p className="text-sm text-gray-600">Please wait while the component loads...</p>
      </div>
    </div>
  </div>
);

/**
 * Network error fallback - specific to network-related issues
 */
export const NetworkErrorFallback: ComponentType<FallbackProps> = ({
  componentName,
  error,
  onRetry,
  canRetry = true,
}) => (
  <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-900">
    <div className="flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-sm font-semibold mb-1">Network Error: {componentName}</h3>
        <p className="text-sm text-orange-800 mb-3">
          Unable to connect to the server. Please check your internet connection.
        </p>
        {canRetry && onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-100 rounded hover:bg-orange-200 transition-colors"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry Connection
          </button>
        )}
      </div>
    </div>
  </div>
);

/**
 * Permission error fallback - for access control issues
 */
export const PermissionErrorFallback: ComponentType<FallbackProps> = ({ componentName }) => (
  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-900">
    <div className="flex items-start gap-3">
      <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-sm font-semibold mb-1">Access Restricted: {componentName}</h3>
        <p className="text-sm text-yellow-800">
          You don't have permission to view this component. Please contact your administrator.
        </p>
      </div>
    </div>
  </div>
);

/**
 * Minimal fallback - most basic fallback for critical errors
 */
export const MinimalFallback: ComponentType<FallbackProps> = () => (
  <div className="rounded border border-gray-300 bg-gray-100 p-2 text-gray-600 text-center">
    <span className="text-xs">Component unavailable</span>
  </div>
);

// Register built-in fallbacks
fallbackRegistry.registerGlobal({
  componentName: "DefaultErrorFallback",
  component: DefaultErrorFallback,
  priority: 100,
  metadata: {
    description: "Default error fallback for general errors",
    author: "SDUI System",
    version: "1.0.0",
  },
});

fallbackRegistry.registerGlobal({
  componentName: "LoadingFallback",
  component: LoadingFallback,
  priority: 200,
  conditions: {
    errorTypes: ["TypeError", "ReferenceError"],
  },
  metadata: {
    description: "Loading state fallback",
    author: "SDUI System",
    version: "1.0.0",
  },
});

fallbackRegistry.registerGlobal({
  componentName: "NetworkErrorFallback",
  component: NetworkErrorFallback,
  priority: 50,
  conditions: {
    errorTypes: ["NetworkError", "FetchError", "AbortError"],
  },
  metadata: {
    description: "Network error fallback",
    author: "SDUI System",
    version: "1.0.0",
  },
});

fallbackRegistry.registerGlobal({
  componentName: "PermissionErrorFallback",
  component: PermissionErrorFallback,
  priority: 30,
  conditions: {
    errorTypes: ["PermissionError", "AuthorizationError"],
  },
  metadata: {
    description: "Permission error fallback",
    author: "SDUI System",
    version: "1.0.0",
  },
});

fallbackRegistry.registerGlobal({
  componentName: "MinimalFallback",
  component: MinimalFallback,
  priority: 999,
  metadata: {
    description: "Minimal fallback for critical errors",
    author: "SDUI System",
    version: "1.0.0",
  },
});

/**
 * Hook to get fallback component
 */
export function useFallbackComponent(
  componentName: string,
  error?: Error,
  context?: any
): ComponentType<FallbackProps> | null {
  return fallbackRegistry.getFallback(componentName, error, context);
}

/**
 * HOC to wrap components with automatic fallback
 */
export function withFallback<P extends object>(
  Component: ComponentType<P>,
  options: {
    fallbackComponent?: ComponentType<FallbackProps>;
    fallbackProps?: Partial<FallbackProps>;
  } = {}
): ComponentType<P> {
  const WrappedComponent = (props: P) => {
    const [error, setError] = React.useState<Error>();
    const [hasError, setHasError] = React.useState(false);

    const handleError = React.useCallback((err: Error) => {
      setError(err);
      setHasError(true);
    }, []);

    const handleRetry = React.useCallback(() => {
      setError(undefined);
      setHasError(false);
    }, []);

    if (hasError && error) {
      const FallbackComponent =
        options.fallbackComponent ||
        fallbackRegistry.getFallback(Component.displayName || Component.name || "Unknown", error);

      if (FallbackComponent) {
        return (
          <FallbackComponent
            componentName={Component.displayName || Component.name || "Unknown"}
            error={error}
            onRetry={handleRetry}
            canRetry={true}
            {...options.fallbackProps}
          />
        );
      }

      // Fallback to default error boundary
      return (
        <DefaultErrorFallback
          componentName={Component.displayName || Component.name || "Unknown"}
          error={error}
          onRetry={handleRetry}
        />
      );
    }

    return (
      <ComponentErrorBoundary
        componentName={Component.displayName || Component.name || "Unknown"}
        onError={handleError}
      >
        <Component {...props} />
      </ComponentErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withFallback(${Component.displayName || Component.name || "Component"})`;

  return WrappedComponent;
}
