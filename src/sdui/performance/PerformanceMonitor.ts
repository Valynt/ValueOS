/**
 * Performance Monitor
 * 
 * Tracks and reports SDUI performance metrics including render times,
 * data binding resolution, and component lifecycle events.
 */

/**
 * Performance metric
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Performance threshold
 */
export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: 'ms' | 'bytes' | 'count';
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: string;
  message: string;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  period: {
    start: string;
    end: string;
  };
  metrics: {
    [key: string]: {
      count: number;
      min: number;
      max: number;
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
  };
  alerts: PerformanceAlert[];
  summary: {
    totalMeasurements: number;
    alertCount: number;
    slowestOperation: string;
    fastestOperation: string;
  };
}

/**
 * Performance Monitor Service
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private alerts: PerformanceAlert[] = [];
  private maxMetrics = 1000;
  private alertCallbacks: Set<(alert: PerformanceAlert) => void> = new Set();

  private constructor() {
    this.initializeDefaultThresholds();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Initialize default thresholds
   */
  private initializeDefaultThresholds(): void {
    this.setThreshold('page_render', { warning: 500, critical: 1000, unit: 'ms' });
    this.setThreshold('component_render', { warning: 100, critical: 300, unit: 'ms' });
    this.setThreshold('data_binding', { warning: 200, critical: 500, unit: 'ms' });
    this.setThreshold('data_fetch', { warning: 1000, critical: 3000, unit: 'ms' });
    this.setThreshold('bundle_size', { warning: 500000, critical: 1000000, unit: 'bytes' });
  }

  /**
   * Set performance threshold
   */
  public setThreshold(metric: string, threshold: Omit<PerformanceThreshold, 'metric'>): void {
    this.thresholds.set(metric, { metric, ...threshold });
  }

  /**
   * Record metric
   */
  public record(name: string, value: number, unit: 'ms' | 'bytes' | 'count' = 'ms', metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      metadata,
    };

    this.metrics.push(metric);

    // Trim old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Check thresholds
    this.checkThreshold(metric);
  }

  /**
   * Start timing
   */
  public startTiming(name: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.record(name, duration, 'ms');
    };
  }

  /**
   * Measure async operation
   */
  public async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const endTiming = this.startTiming(name);
    try {
      return await operation();
    } finally {
      endTiming();
    }
  }

  /**
   * Check threshold
   */
  private checkThreshold(metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metric.name);
    if (!threshold || threshold.unit !== metric.unit) {
      return;
    }

    let severity: 'warning' | 'critical' | null = null;
    let thresholdValue = 0;

    if (metric.value >= threshold.critical) {
      severity = 'critical';
      thresholdValue = threshold.critical;
    } else if (metric.value >= threshold.warning) {
      severity = 'warning';
      thresholdValue = threshold.warning;
    }

    if (severity) {
      const alert: PerformanceAlert = {
        metric: metric.name,
        value: metric.value,
        threshold: thresholdValue,
        severity,
        timestamp: metric.timestamp,
        message: `${metric.name} exceeded ${severity} threshold: ${metric.value}${metric.unit} > ${thresholdValue}${metric.unit}`,
      };

      this.alerts.push(alert);
      this.emitAlert(alert);

      console.warn(`[Performance ${severity.toUpperCase()}]`, alert.message);
    }
  }

  /**
   * Get metrics
   */
  public getMetrics(name?: string, since?: string): PerformanceMetric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter((m) => m.name === name);
    }

    if (since) {
      const sinceDate = new Date(since);
      filtered = filtered.filter((m) => new Date(m.timestamp) >= sinceDate);
    }

    return filtered;
  }

  /**
   * Get alerts
   */
  public getAlerts(severity?: 'warning' | 'critical', since?: string): PerformanceAlert[] {
    let filtered = this.alerts;

    if (severity) {
      filtered = filtered.filter((a) => a.severity === severity);
    }

    if (since) {
      const sinceDate = new Date(since);
      filtered = filtered.filter((a) => new Date(a.timestamp) >= sinceDate);
    }

    return filtered;
  }

  /**
   * Generate performance report
   */
  public generateReport(since?: string): PerformanceReport {
    const metrics = this.getMetrics(undefined, since);
    const alerts = this.getAlerts(undefined, since);

    const metricsByName = new Map<string, number[]>();
    metrics.forEach((m) => {
      if (!metricsByName.has(m.name)) {
        metricsByName.set(m.name, []);
      }
      metricsByName.get(m.name)!.push(m.value);
    });

    const metricStats: PerformanceReport['metrics'] = {};
    metricsByName.forEach((values, name) => {
      const sorted = values.sort((a, b) => a - b);
      metricStats[name] = {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      };
    });

    let slowestOperation = '';
    let slowestValue = 0;
    let fastestOperation = '';
    let fastestValue = Infinity;

    Object.entries(metricStats).forEach(([name, stats]) => {
      if (stats.max > slowestValue) {
        slowestValue = stats.max;
        slowestOperation = name;
      }
      if (stats.min < fastestValue) {
        fastestValue = stats.min;
        fastestOperation = name;
      }
    });

    return {
      period: {
        start: since || metrics[0]?.timestamp || new Date().toISOString(),
        end: new Date().toISOString(),
      },
      metrics: metricStats,
      alerts,
      summary: {
        totalMeasurements: metrics.length,
        alertCount: alerts.length,
        slowestOperation,
        fastestOperation,
      },
    };
  }

  /**
   * Add alert callback
   */
  public onAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertCallbacks.add(callback);
    return () => {
      this.alertCallbacks.delete(callback);
    };
  }

  /**
   * Emit alert
   */
  private emitAlert(alert: PerformanceAlert): void {
    this.alertCallbacks.forEach((callback) => callback(alert));
  }

  /**
   * Clear metrics
   */
  public clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Clear alerts
   */
  public clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get statistics
   */
  public getStats(): {
    metricsCount: number;
    alertsCount: number;
    thresholdsCount: number;
    oldestMetric: string | null;
    newestMetric: string | null;
  } {
    return {
      metricsCount: this.metrics.length,
      alertsCount: this.alerts.length,
      thresholdsCount: this.thresholds.size,
      oldestMetric: this.metrics[0]?.timestamp || null,
      newestMetric: this.metrics[this.metrics.length - 1]?.timestamp || null,
    };
  }
}

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitor(metricName: string) {
  const monitor = PerformanceMonitor.getInstance();

  const startTiming = () => monitor.startTiming(metricName);

  const record = (value: number, unit: 'ms' | 'bytes' | 'count' = 'ms') => {
    monitor.record(metricName, value, unit);
  };

  return { startTiming, record };
}

export default PerformanceMonitor;
