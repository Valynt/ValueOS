/**
 * Cache Performance Metrics
 *
 * Monitors and reports cache performance metrics including hit rates,
 * latency distributions, and cache effectiveness
 */

import { logger } from "../../lib/logger";

export interface CacheMetrics {
  // Hit rate metrics
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;

  // Latency metrics (in milliseconds)
  averageHitLatency: number;
  averageMissLatency: number;
  p95HitLatency: number;
  p95MissLatency: number;

  // Size metrics
  currentCacheSize: number;
  maxCacheSize: number;

  // Error metrics
  cacheErrors: number;
  redisErrors: number;

  // Time-based metrics
  metricsWindow: number; // Time window for rolling metrics (ms)
  lastResetTime: number;
}

export interface CacheOperationMetrics {
  operation: "get" | "set" | "delete";
  cacheType: "memory" | "redis";
  hit: boolean;
  latency: number;
  error?: string;
  timestamp: number;
}

/**
 * Cache performance monitor
 */
export class CachePerformanceMonitor {
  private metrics: CacheMetrics;
  private operations: CacheOperationMetrics[] = [];
  private maxOperationsHistory = 10000; // Keep last 10k operations for analysis

  constructor(private cacheName: string) {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize metrics with default values
   */
  private initializeMetrics(): CacheMetrics {
    return {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      averageHitLatency: 0,
      averageMissLatency: 0,
      p95HitLatency: 0,
      p95MissLatency: 0,
      currentCacheSize: 0,
      maxCacheSize: 0,
      cacheErrors: 0,
      redisErrors: 0,
      metricsWindow: 300000, // 5 minutes
      lastResetTime: Date.now(),
    };
  }

  /**
   * Record a cache operation
   */
  recordOperation(operation: Omit<CacheOperationMetrics, "timestamp">): void {
    const operationWithTimestamp: CacheOperationMetrics = {
      ...operation,
      timestamp: Date.now(),
    };

    this.operations.push(operationWithTimestamp);

    // Maintain operation history limit
    if (this.operations.length > this.maxOperationsHistory) {
      this.operations = this.operations.slice(-this.maxOperationsHistory);
    }

    // Update metrics
    this.updateMetrics(operationWithTimestamp);
  }

  /**
   * Update rolling metrics based on operation
   */
  private updateMetrics(operation: CacheOperationMetrics): void {
    this.metrics.totalRequests++;

    if (operation.hit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    // Update hit rate
    this.metrics.hitRate = this.metrics.cacheHits / this.metrics.totalRequests;

    // Track errors
    if (operation.error) {
      if (operation.cacheType === "redis") {
        this.metrics.redisErrors++;
      } else {
        this.metrics.cacheErrors++;
      }
    }

    // Clean old operations outside the metrics window
    this.cleanOldOperations();
  }

  /**
   * Remove operations outside the current metrics window
   */
  private cleanOldOperations(): void {
    const cutoffTime = Date.now() - this.metrics.metricsWindow;
    this.operations = this.operations.filter((op) => op.timestamp > cutoffTime);
  }

  /**
   * Update cache size metrics
   */
  updateCacheSize(currentSize: number, maxSize?: number): void {
    this.metrics.currentCacheSize = currentSize;
    if (maxSize !== undefined) {
      this.metrics.maxCacheSize = maxSize;
    }
  }

  /**
   * Recalculate latency percentiles
   */
  private recalculateLatencyMetrics(): void {
    const recentOperations = this.operations.filter(
      (op) => Date.now() - op.timestamp < this.metrics.metricsWindow
    );

    const hitLatencies = recentOperations
      .filter((op) => op.hit && op.operation === "get")
      .map((op) => op.latency)
      .sort((a, b) => a - b);

    const missLatencies = recentOperations
      .filter((op) => !op.hit && op.operation === "get")
      .map((op) => op.latency)
      .sort((a, b) => a - b);

    // Calculate averages
    this.metrics.averageHitLatency =
      hitLatencies.length > 0
        ? hitLatencies.reduce((sum, lat) => sum + lat, 0) / hitLatencies.length
        : 0;

    this.metrics.averageMissLatency =
      missLatencies.length > 0
        ? missLatencies.reduce((sum, lat) => sum + lat, 0) /
          missLatencies.length
        : 0;

    // Calculate P95 latencies
    this.metrics.p95HitLatency = this.calculatePercentile(hitLatencies, 95);
    this.metrics.p95MissLatency = this.calculatePercentile(missLatencies, 95);
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(
    sortedArray: number[],
    percentile: number
  ): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Get current metrics
   */
  getMetrics(): CacheMetrics {
    // Recalculate latency metrics before returning
    this.recalculateLatencyMetrics();

    return { ...this.metrics };
  }

  /**
   * Get detailed performance report
   */
  getPerformanceReport(): {
    metrics: CacheMetrics;
    recentOperations: CacheOperationMetrics[];
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const recentOperations = this.operations.slice(-100); // Last 100 operations

    const recommendations: string[] = [];

    // Analyze hit rate
    if (metrics.hitRate < 0.5) {
      recommendations.push(
        "Cache hit rate is below 50%. Consider increasing cache TTL or cache size."
      );
    } else if (metrics.hitRate > 0.95) {
      recommendations.push(
        "Cache hit rate is excellent (>95%). Current configuration is optimal."
      );
    }

    // Analyze latency
    if (metrics.averageHitLatency > 10) {
      recommendations.push(
        "Cache hit latency is high. Consider optimizing cache implementation."
      );
    }

    if (metrics.averageMissLatency > 100) {
      recommendations.push(
        "Cache miss latency is high. Backend service may be slow."
      );
    }

    // Analyze errors
    if (metrics.redisErrors > metrics.totalRequests * 0.01) {
      recommendations.push(
        "High Redis error rate detected. Check Redis connectivity."
      );
    }

    if (metrics.cacheErrors > metrics.totalRequests * 0.01) {
      recommendations.push(
        "High cache error rate detected. Check memory cache implementation."
      );
    }

    return {
      metrics,
      recentOperations,
      recommendations,
    };
  }

  /**
   * Reset metrics (for testing or manual reset)
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.operations = [];

    logger.info(`Cache metrics reset for ${this.cacheName}`);
  }

  /**
   * Export metrics for monitoring systems
   */
  exportForMonitoring(): Record<string, number> {
    const metrics = this.getMetrics();

    return {
      [`${this.cacheName}_total_requests`]: metrics.totalRequests,
      [`${this.cacheName}_cache_hits`]: metrics.cacheHits,
      [`${this.cacheName}_cache_misses`]: metrics.cacheMisses,
      [`${this.cacheName}_hit_rate`]: metrics.hitRate,
      [`${this.cacheName}_avg_hit_latency`]: metrics.averageHitLatency,
      [`${this.cacheName}_avg_miss_latency`]: metrics.averageMissLatency,
      [`${this.cacheName}_p95_hit_latency`]: metrics.p95HitLatency,
      [`${this.cacheName}_p95_miss_latency`]: metrics.p95MissLatency,
      [`${this.cacheName}_current_size`]: metrics.currentCacheSize,
      [`${this.cacheName}_max_size`]: metrics.maxCacheSize,
      [`${this.cacheName}_errors`]: metrics.cacheErrors,
      [`${this.cacheName}_redis_errors`]: metrics.redisErrors,
    };
  }
}

/**
 * Global cache performance monitor instances
 */
export const awsCacheMonitor = new CachePerformanceMonitor("aws_provider");
export const vaultCacheMonitor = new CachePerformanceMonitor("vault_provider");
export const fallbackCacheMonitor = new CachePerformanceMonitor(
  "fallback_provider"
);
