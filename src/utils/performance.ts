/**
 * Performance Monitoring and Optimization Utilities
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceBenchmark {
  target: number;
  warning: number;
  critical: number;
}

export const PERFORMANCE_BENCHMARKS: Record<string, PerformanceBenchmark> = {
  'settings.panel.load': { target: 200, warning: 300, critical: 500 },
  'settings.section.load': { target: 100, warning: 150, critical: 250 },
  'settings.search': { target: 50, warning: 100, critical: 200 },
  'settings.save': { target: 300, warning: 500, critical: 1000 },
};

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: Map<string, PerformanceObserver> = new Map();

  /**
   * Start measuring performance
   */
  startMeasure(name: string): () => number {
    const startTime = performance.now();
    performance.mark(`${name}-start`);

    return () => {
      const endTime = performance.now();
      performance.mark(`${name}-end`);

      try {
        performance.measure(name, `${name}-start`, `${name}-end`);
      } catch (error) {
        logger.warn('Performance measure failed:', error);
      }

      const duration = endTime - startTime;
      this.recordMetric({
        name,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
      });

      return duration;
    };
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Check against benchmarks
    const benchmark = PERFORMANCE_BENCHMARKS[metric.name];
    if (benchmark && metric.unit === 'ms') {
      if (metric.value > benchmark.critical) {
        logger.error('Performance critical: ${metric.name} took ${metric.value}ms');
        this.reportPerformanceIssue(metric, 'critical');
      } else if (metric.value > benchmark.warning) {
        logger.warn('Performance warning: ${metric.name} took ${metric.value}ms');
        this.reportPerformanceIssue(metric, 'warning');
      }
    }
  }

  /**
   * Get metrics for a specific measurement
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.filter((m) => m.name === name);
  }

  /**
   * Get average value for a metric
   */
  getAverage(name: string): number {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  /**
   * Get percentile value
   */
  getPercentile(name: string, percentile: number): number {
    const metrics = this.getMetrics(name).sort((a, b) => a.value - b.value);
    if (metrics.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * metrics.length) - 1;
    return metrics[index]?.value || 0;
  }

  /**
   * Observe Core Web Vitals
   */
  observeWebVitals(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    // Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;

        this.recordMetric({
          name: 'web-vitals.lcp',
          value: lastEntry.renderTime || lastEntry.loadTime,
          unit: 'ms',
          timestamp: Date.now(),
        });
      });

      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.set('lcp', lcpObserver);
    } catch (error) {
      logger.warn('LCP observation failed:', error);
    }

    // First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.recordMetric({
            name: 'web-vitals.fid',
            value: entry.processingStart - entry.startTime,
            unit: 'ms',
            timestamp: Date.now(),
          });
        });
      });

      fidObserver.observe({ type: 'first-input', buffered: true });
      this.observers.set('fid', fidObserver);
    } catch (error) {
      logger.warn('FID observation failed:', error);
    }

    // Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });

        this.recordMetric({
          name: 'web-vitals.cls',
          value: clsValue,
          unit: 'count',
          timestamp: Date.now(),
        });
      });

      clsObserver.observe({ type: 'layout-shift', buffered: true });
      this.observers.set('cls', clsObserver);
    } catch (error) {
      logger.warn('CLS observation failed:', error);
    }
  }

  /**
   * Report performance issue
   */
  private reportPerformanceIssue(
    metric: PerformanceMetric,
    severity: 'warning' | 'critical'
  ): void {
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('Performance Issue', {
        metric: metric.name,
        value: metric.value,
        unit: metric.unit,
        severity,
        timestamp: metric.timestamp,
      });
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    summary: Record<string, { avg: number; p50: number; p95: number; p99: number }>;
    issues: Array<{ name: string; severity: string; value: number }>;
  } {
    const metricNames = [...new Set(this.metrics.map((m) => m.name))];

    const summary: Record<string, any> = {};
    const issues: Array<{ name: string; severity: string; value: number }> = [];

    metricNames.forEach((name) => {
      summary[name] = {
        avg: Math.round(this.getAverage(name) * 100) / 100,
        p50: Math.round(this.getPercentile(name, 50) * 100) / 100,
        p95: Math.round(this.getPercentile(name, 95) * 100) / 100,
        p99: Math.round(this.getPercentile(name, 99) * 100) / 100,
      };

      const benchmark = PERFORMANCE_BENCHMARKS[name];
      if (benchmark) {
        const p95 = this.getPercentile(name, 95);
        if (p95 > benchmark.critical) {
          issues.push({ name, severity: 'critical', value: p95 });
        } else if (p95 > benchmark.warning) {
          issues.push({ name, severity: 'warning', value: p95 });
        }
      }
    });

    return { summary, issues };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Disconnect all observers
   */
  disconnect(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for performance monitoring
 */
export const usePerformanceMonitor = (name: string) => {
  const measureRef = React.useRef<(() => number) | null>(null);

  React.useEffect(() => {
    measureRef.current = performanceMonitor.startMeasure(name);

    return () => {
      if (measureRef.current) {
        measureRef.current();
      }
    };
  }, [name]);

  return {
    recordMetric: (metric: Omit<PerformanceMetric, 'timestamp'>) =>
      performanceMonitor.recordMetric({ ...metric, timestamp: Date.now() }),
  };
};

/**
 * Debounce function with performance tracking
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean; maxWait?: number } = {}
): T & { cancel: () => void; flush: () => void } {
  let timeoutId: NodeJS.Timeout | undefined;
  let maxTimeoutId: NodeJS.Timeout | undefined;
  let lastArgs: any[] | undefined;
  let lastThis: any;
  let result: any;
  let lastCallTime: number | undefined;
  let lastInvokeTime = 0;

  const { leading = false, trailing = true, maxWait } = options;

  function invokeFunc(time: number) {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args!);
    return result;
  }

  function startTimer(pendingFunc: () => void, wait: number) {
    return setTimeout(pendingFunc, wait);
  }

  function cancelTimer(id: NodeJS.Timeout) {
    clearTimeout(id);
  }

  function leadingEdge(time: number) {
    lastInvokeTime = time;
    timeoutId = startTimer(timerExpired, wait);
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time: number) {
    const timeSinceLastCall = time - lastCallTime!;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;

    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function shouldInvoke(time: number) {
    const timeSinceLastCall = time - lastCallTime!;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timeoutId = startTimer(timerExpired, remainingWait(time));
  }

  function trailingEdge(time: number) {
    timeoutId = undefined;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel() {
    if (timeoutId !== undefined) {
      cancelTimer(timeoutId);
    }
    if (maxTimeoutId !== undefined) {
      cancelTimer(maxTimeoutId);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timeoutId = maxTimeoutId = undefined;
  }

  function flush() {
    return timeoutId === undefined ? result : trailingEdge(Date.now());
  }

  function debounced(this: any, ...args: any[]) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxWait !== undefined) {
        timeoutId = startTimer(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    if (timeoutId === undefined) {
      timeoutId = startTimer(timerExpired, wait);
    }
    return result;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;

  return debounced as any;
}

import { logger } from './lib/logger';
import React from 'react';
