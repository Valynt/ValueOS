/**
 * Lazy Loading Configuration and Utilities
 *
 * Optimizes bundle size by loading components and modules on demand.
 */

import { lazy, ComponentType, Suspense, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

// Loading component for lazy loaded components
export const LoadingFallback: ComponentType<{ message?: string }> = ({
  message = 'Loading...'
}) => (
  <div className="flex items-center justify-center p-8">
    <div className="flex items-center gap-3">
      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      <span className="text-gray-600">{message}</span>
    </div>
  </div>
);

// Error boundary for lazy loaded components
export const LazyErrorBoundary: ComponentType<{
  children: ReactNode;
  fallback?: ReactNode;
}> = ({ children, fallback }) => (
  <Suspense
    fallback={fallback || <LoadingFallback message="Loading component..." />}
  >
    {children}
  </Suspense>
);

/**
 * Lazy loaded components with proper typing and error handling
 */
export const LazyComponents = {
  // Chat components
  ChatCanvasLayout: lazy(() =>
    import('../components/ChatCanvas/ChatCanvasLayout').then(module => ({
      default: module.ChatCanvasLayout
    }))
  ),

  CanvasWorkspace: lazy(() =>
    import('../components/ChatCanvas/CanvasWorkspace').then(module => ({
      default: module.CanvasWorkspace
    }))
  ),

  CommandBar: lazy(() =>
    import('../components/Agent/CommandBar').then(module => ({
      default: module.CommandBar
    }))
  ),

  // Modal components
  UploadNotesModal: lazy(() =>
    import('../components/Modals').then(module => ({
      default: module.UploadNotesModal
    }))
  ),

  EmailAnalysisModal: lazy(() =>
    import('../components/Modals').then(module => ({
      default: module.EmailAnalysisModal
    }))
  ),

  CRMImportModal: lazy(() =>
    import('../components/Modals').then(module => ({
      default: module.CRMImportModal
    }))
  ),

  SalesCallModal: lazy(() =>
    import('../components/Modals').then(module => ({
      default: module.SalesCallModal
    }))
  ),

  // Report components
  PrintReportLayout: lazy(() =>
    import('../components/Report/PrintReportLayout').then(module => ({
      default: module.PrintReportLayout
    }))
  ),

  ExportPreviewModal: lazy(() =>
    import('../components/Modals').then(module => ({
      default: module.ExportPreviewModal
    }))
  ),

  // SDUI components (conditionally loaded based on usage)
  TextBlock: lazy(() =>
    import('../components/SDUI').then(module => ({
      default: module.TextBlock
    }))
  ),

  MetricBadge: lazy(() =>
    import('../components/SDUI').then(module => ({
      default: module.MetricBadge
    }))
  ),

  ValueHypothesisCard: lazy(() =>
    import('../components/SDUI').then(module => ({
      default: module.ValueHypothesisCard
    }))
  ),

  AgentResponseCard: lazy(() =>
    import('../components/SDUI').then(module => ({
      default: module.AgentResponseCard
    }))
  ),

  // Services (lazy loaded for better performance)
  AgentChatService: lazy(() =>
    import('../services/AgentChatService').then(module => ({
      default: module.agentChatService
    }))
  ),

  WorkflowStateService: lazy(() =>
    import('../services/WorkflowStateService').then(module => ({
      default: module.WorkflowStateService
    }))
  ),

  // Analytics and monitoring
  TelemetryService: lazy(() =>
    import('../lib/telemetry/SDUITelemetry').then(module => ({
      default: module.sduiTelemetry
    }))
  ),
};

/**
 * Higher-order component for lazy loading with custom loading states
 */
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  loadingMessage?: string,
  errorFallback?: ReactNode
): ComponentType<P> {
  return function LazyWrapper(props: P) {
    return (
      <LazyErrorBoundary fallback={errorFallback}>
        <Component {...props} />
      </LazyErrorBoundary>
    );
  };
}

/**
 * Dynamic import utility for modules
 */
export async function dynamicImport<T>(
  importFn: () => Promise<T>,
  timeout: number = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Dynamic import timed out after ${timeout}ms`));
    }, timeout);

    importFn()
      .then((module) => {
        clearTimeout(timeoutId);
        resolve(module);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Preload utility for critical components
 */
export class ComponentPreloader {
  private static preloadedComponents = new Set<string>();

  /**
   * Preload a component
   */
  static async preload(componentName: keyof typeof LazyComponents): Promise<void> {
    if (this.preloadedComponents.has(componentName)) {
      return;
    }

    try {
      await LazyComponents[componentName];
      this.preloadedComponents.add(componentName);
    } catch (error) {
      console.warn(`Failed to preload component: ${componentName}`, error);
    }
  }

  /**
   * Preload multiple components
   */
  static async preloadMultiple(components: (keyof typeof LazyComponents)[]): Promise<void> {
    const promises = components.map(component => this.preload(component));
    await Promise.allSettled(promises);
  }

  /**
   * Check if component is preloaded
   */
  static isPreloaded(componentName: string): boolean {
    return this.preloadedComponents.has(componentName);
  }

  /**
   * Get list of preloaded components
   */
  static getPreloadedComponents(): string[] {
    return Array.from(this.preloadedComponents);
  }
}

/**
 * Route-based lazy loading configuration
 */
export const ROUTE_LAZY_LOADING = {
  // Main routes
  '/': {
    component: 'ChatCanvasLayout',
    preload: true,
    fallback: <LoadingFallback message="Loading workspace..." />,
  },

  '/reports': {
    component: 'PrintReportLayout',
    preload: false,
    fallback: <LoadingFallback message="Loading reports..." />,
  },

  '/settings': {
    component: 'ChatCanvasLayout', // Reuse main layout
    preload: false,
    fallback: <LoadingFallback message="Loading settings..." />,
  },

  // Modal routes (loaded on demand)
  '/upload-notes': {
    component: 'UploadNotesModal',
    preload: false,
    fallback: <LoadingFallback message="Opening upload dialog..." />,
  },

  '/email-analysis': {
    component: 'EmailAnalysisModal',
    preload: false,
    fallback: <LoadingFallback message="Opening email analysis..." />,
  },

  '/crm-import': {
    component: 'CRMImportModal',
    preload: false,
    fallback: <LoadingFallback message="Opening CRM import..." />,
  },

  '/sales-call': {
    component: 'SalesCallModal',
    preload: false,
    fallback: <LoadingFallback message="Opening call analysis..." />,
  },
};

/**
 * Hook for lazy loading components with state management
 */
import { useState, useEffect } from 'react';

export function useLazyComponent<T extends ComponentType<any>>(
  componentName: keyof typeof LazyComponents,
  preload: boolean = false
) {
  const [component, setComponent] = useState<ComponentType<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (preload && !component) {
      loadComponent();
    }
  }, [preload, component]);

  const loadComponent = async () => {
    if (component) return component;

    setLoading(true);
    setError(null);

    try {
      const LazyComponent = LazyComponents[componentName];
      setComponent(() => LazyComponent as ComponentType<T>);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load component'));
    } finally {
      setLoading(false);
    }
  };

  return {
    component,
    loading,
    error,
    loadComponent,
  };
}

/**
 * Bundle size monitoring utilities
 */
export class BundleSizeMonitor {
  private static measurements: Array<{
    timestamp: number;
    component: string;
    size: number;
    loadTime: number;
  }> = [];

  /**
   * Record component load metrics
   */
  static record(componentName: string, size: number, loadTime: number): void {
    this.measurements.push({
      timestamp: Date.now(),
      component: componentName,
      size,
      loadTime,
    });

    // Keep only last 100 measurements
    if (this.measurements.length > 100) {
      this.measurements = this.measurements.slice(-50);
    }
  }

  /**
   * Get average load time
   */
  static getAverageLoadTime(): number {
    if (this.measurements.length === 0) return 0;

    const totalTime = this.measurements.reduce((sum, m) => sum + m.loadTime, 0);
    return totalTime / this.measurements.length;
  }

  /**
   * Get total bundle size
   */
  static getTotalBundleSize(): number {
    return this.measurements.reduce((sum, m) => sum + m.size, 0);
  }

  /**
   * Get component statistics
   */
  static getComponentStats(): Record<string, { count: number; avgSize: number; avgLoadTime: number }> {
    const stats: Record<string, {
      count: number;
      totalSize: number;
      totalLoadTime: number;
    }> = {};

    for (const measurement of this.measurements) {
      if (!stats[measurement.component]) {
        stats[measurement.component] = {
          count: 0,
          totalSize: 0,
          totalLoadTime: 0,
        };
      }

      stats[measurement.component].count++;
      stats[measurement.component].totalSize += measurement.size;
      stats[measurement.component].totalLoadTime += measurement.loadTime;
    }

    // Convert to averages
    const result: Record<string, { count: number; avgSize: number; avgLoadTime: number }> = {};

    for (const [component, data] of Object.entries(stats)) {
      result[component] = {
        count: data.count,
        avgSize: data.totalSize / data.count,
        avgLoadTime: data.totalLoadTime / data.count,
      };
    }

    return result;
  }
}

/**
 * Performance optimization utilities
 */
export const PerformanceOptimizations = {
  /**
   * Debounce function for preventing excessive calls
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  /**
   * Throttle function for rate limiting
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Memoize expensive computations
   */
  memoize<T extends (...args: any[]) => any>(func: T): T {
    const cache = new Map();

    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  },
};
