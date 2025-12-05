/**
 * Lazy Component Loader
 * 
 * Provides lazy loading and code splitting for SDUI components.
 * Improves initial load time by loading components on demand.
 */

import React, { Suspense, lazy, ComponentType } from 'react';
import { LoadingFallback } from '../components/LoadingFallback';

/**
 * Lazy load configuration
 */
export interface LazyLoadConfig {
  /**
   * Component name
   */
  name: string;

  /**
   * Import function
   */
  loader: () => Promise<{ default: ComponentType<any> }>;

  /**
   * Loading fallback component
   */
  fallback?: React.ReactNode;

  /**
   * Error fallback component
   */
  errorFallback?: React.ComponentType<{ error: Error; retry: () => void }>;

  /**
   * Preload on hover
   */
  preloadOnHover?: boolean;

  /**
   * Retry attempts on load failure
   */
  retryAttempts?: number;

  /**
   * Retry delay in milliseconds
   */
  retryDelay?: number;
}

/**
 * Lazy component cache
 */
const lazyComponentCache = new Map<string, React.LazyExoticComponent<ComponentType<any>>>();

/**
 * Preload cache
 */
const preloadCache = new Set<string>();

/**
 * Create lazy component with retry logic
 */
function createLazyComponent(config: LazyLoadConfig): React.LazyExoticComponent<ComponentType<any>> {
  // Check cache
  if (lazyComponentCache.has(config.name)) {
    return lazyComponentCache.get(config.name)!;
  }

  // Create loader with retry logic
  const loaderWithRetry = async () => {
    const { retryAttempts = 3, retryDelay = 1000 } = config;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        return await config.loader();
      } catch (error) {
        lastError = error as Error;
        console.warn(`[LazyLoader] Failed to load ${config.name} (attempt ${attempt + 1}/${retryAttempts})`);

        if (attempt < retryAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError || new Error(`Failed to load component: ${config.name}`);
  };

  // Create lazy component
  const LazyComponent = lazy(loaderWithRetry);

  // Cache it
  lazyComponentCache.set(config.name, LazyComponent);

  return LazyComponent;
}

/**
 * Preload component
 */
export function preloadComponent(config: LazyLoadConfig): void {
  if (preloadCache.has(config.name)) {
    return;
  }

  preloadCache.add(config.name);
  config.loader().catch((error) => {
    console.error(`[LazyLoader] Failed to preload ${config.name}:`, error);
    preloadCache.delete(config.name);
  });
}

/**
 * Error boundary for lazy components
 */
class LazyComponentErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
    componentName: string;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[LazyLoader] Error loading ${this.props.componentName}:`, error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
    // Clear cache to force reload
    lazyComponentCache.delete(this.props.componentName);
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.retry} />;
      }

      return (
        <div className="sdui-lazy-error">
          <div className="sdui-lazy-error-content">
            <h3>Failed to load component</h3>
            <p>{this.state.error.message}</p>
            <button onClick={this.retry} className="sdui-lazy-error-retry">
              Retry
            </button>
          </div>

          <style jsx>{`
            .sdui-lazy-error {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 48px;
              background-color: #1A1A1A;
              border: 1px solid #FF3B30;
              border-radius: 8px;
            }

            .sdui-lazy-error-content {
              text-align: center;
              max-width: 400px;
            }

            .sdui-lazy-error-content h3 {
              color: #FF3B30;
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 8px;
            }

            .sdui-lazy-error-content p {
              color: #B3B3B3;
              font-size: 14px;
              margin-bottom: 16px;
            }

            .sdui-lazy-error-retry {
              padding: 8px 16px;
              background-color: transparent;
              border: 1px solid #39FF14;
              border-radius: 4px;
              color: #39FF14;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 150ms;
            }

            .sdui-lazy-error-retry:hover {
              background-color: rgba(57, 255, 20, 0.1);
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Lazy component wrapper
 */
export const LazyComponent: React.FC<
  LazyLoadConfig & {
    props?: any;
    onMouseEnter?: () => void;
  }
> = ({ name, loader, fallback, errorFallback, preloadOnHover, props, onMouseEnter, ...config }) => {
  const LazyComp = createLazyComponent({ name, loader, ...config });

  const handleMouseEnter = () => {
    if (preloadOnHover) {
      preloadComponent({ name, loader, ...config });
    }
    onMouseEnter?.();
  };

  return (
    <div onMouseEnter={handleMouseEnter}>
      <LazyComponentErrorBoundary fallback={errorFallback} componentName={name}>
        <Suspense fallback={fallback || <LoadingFallback />}>
          <LazyComp {...props} />
        </Suspense>
      </LazyComponentErrorBoundary>
    </div>
  );
};

/**
 * Lazy load multiple components
 */
export function preloadComponents(configs: LazyLoadConfig[]): Promise<void[]> {
  return Promise.all(configs.map((config) => config.loader().then(() => {})));
}

/**
 * Clear lazy component cache
 */
export function clearLazyCache(): void {
  lazyComponentCache.clear();
  preloadCache.clear();
}

/**
 * Get cache statistics
 */
export function getLazyCacheStats(): {
  cached: number;
  preloaded: number;
  components: string[];
} {
  return {
    cached: lazyComponentCache.size,
    preloaded: preloadCache.size,
    components: Array.from(lazyComponentCache.keys()),
  };
}

export default LazyComponent;
