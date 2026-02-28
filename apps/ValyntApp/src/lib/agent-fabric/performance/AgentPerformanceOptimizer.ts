/**
 * Agent Performance Optimizer
 *
 * Provides performance optimization features including:
 * - Configurable sampling for high-volume scenarios
 * - Caching for frequently accessed telemetry data
 * - Resource usage monitoring and optimization
 * - Adaptive performance tuning
 */

import { EventEmitter } from "events";

import { logger } from "../../../utils/logger";

export interface PerformanceConfig {
  /** Enable performance optimization */
  enabled: boolean;
  /** Sampling rate for telemetry (0-1) */
  telemetrySamplingRate: number;
  /** Cache TTL in milliseconds */
  cacheTTL: number;
  /** Maximum cache size */
  maxCacheSize: number;
  /** Performance thresholds */
  thresholds: {
    maxExecutionTime: number;
    maxMemoryUsage: number;
    maxCpuUsage: number;
    maxTokenUsage: number;
  };
  /** Auto-tuning enabled */
  autoTuning: boolean;
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  tokenUsage: number;
  cacheHitRate: number;
  throughput: number;
  errorRate: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  ttl: number;
}

export class AgentPerformanceOptimizer extends EventEmitter {
  private config: PerformanceConfig;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private metrics: PerformanceMetrics = {
    executionTime: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    tokenUsage: 0,
    cacheHitRate: 0,
    throughput: 0,
    errorRate: 0,
  };

  private performanceHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 1000;

  constructor(config: Partial<PerformanceConfig> = {}) {
    super();
    this.config = {
      enabled: true,
      telemetrySamplingRate: 0.1,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 1000,
      thresholds: {
        maxExecutionTime: 10000, // 10 seconds
        maxMemoryUsage: 512 * 1024 * 1024, // 512MB
        maxCpuUsage: 80, // 80%
        maxTokenUsage: 10000, // 10k tokens
      },
      autoTuning: true,
      ...config,
    };

    // Clean up expired cache entries periodically
    setInterval(() => this.cleanupCache(), this.config.cacheTTL);
  }

  /**
   * Get cached data or compute and cache it
   */
  async getCachedOrCompute<T>(key: string, computeFn: () => Promise<T>, ttl?: number): Promise<T> {
    if (!this.config.enabled) {
      return await computeFn();
    }

    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < (ttl || this.config.cacheTTL)) {
      cached.accessCount++;
      this.metrics.cacheHitRate = this.calculateCacheHitRate();
      return cached.data;
    }

    // Compute and cache the result
    const startTime = Date.now();
    const result = await computeFn();
    const endTime = Date.now();

    // Cache the result
    if (this.cache.size < this.config.maxCacheSize) {
      this.cache.set(key, {
        data: result,
        timestamp: now,
        accessCount: 1,
        ttl: ttl || this.config.cacheTTL,
      });
      this.metrics.cacheHitRate = this.calculateCacheHitRate();
    }

    return result;
  }

  /**
   * Monitor and optimize agent performance
   */
  monitorPerformance(agentType: string, executionTime: number, resourceUsage: any): void {
    if (!this.config.enabled) return;

    // Update metrics
    this.metrics.executionTime = this.calculateAverage(
      this.metrics.executionTime,
      executionTime,
      this.performanceHistory.length
    );

    if (resourceUsage) {
      this.metrics.memoryUsage = resourceUsage.memoryUsage || 0;
      this.metrics.cpuUsage = resourceUsage.cpuUsage || 0;
    }

    // Check thresholds and trigger optimizations
    this.checkThresholds(agentType);

    // Record performance history
    this.recordPerformanceHistory();

    // Auto-tune if enabled
    if (this.config.autoTuning) {
      this.autoTune(agentType);
    }

    // Emit performance event
    this.emit("performanceUpdate", {
      agentType,
      metrics: { ...this.metrics },
      resourceUsage,
    });
  }

  /**
   * Check if performance thresholds are exceeded
   */
  private checkThresholds(agentType: string): void {
    const { thresholds } = this.config;

    if (this.metrics.executionTime > thresholds.maxExecutionTime) {
      logger.warn(
        `Performance threshold exceeded for ${agentType}: execution time ${this.metrics.executionTime}ms > ${thresholds.maxExecutionTime}ms`
      );
      this.emit("thresholdExceeded", {
        agentType,
        metric: "executionTime",
        value: this.metrics.executionTime,
        threshold: thresholds.maxExecutionTime,
      });
    }

    if (this.metrics.memoryUsage > thresholds.maxMemoryUsage) {
      logger.warn(
        `Performance threshold exceeded for ${agentType}: memory usage ${this.metrics.memoryUsage}MB > ${thresholds.maxMemoryUsage}MB`
      );
      this.emit("thresholdExceeded", {
        agentType,
        metric: "memoryUsage",
        value: this.metrics.memoryUsage,
        threshold: thresholds.maxMemoryUsage,
      });
    }

    if (this.metrics.cpuUsage > thresholds.maxCpuUsage) {
      logger.warn(
        `Performance threshold exceeded for ${agentType}: CPU usage ${this.metrics.cpuUsage}% > ${thresholds.maxCpuUsage}%`
      );
      this.emit("thresholdExceeded", {
        agentType,
        metric: "cpuUsage",
        value: this.metrics.cpuUsage,
        threshold: thresholds.maxCpuUsage,
      });
    }
  }

  /**
   * Auto-tune performance parameters
   */
  private autoTune(agentType: string): void {
    // Adjust sampling rate based on error rate
    if (this.metrics.errorRate > 5) {
      this.config.telemetrySamplingRate = Math.min(1, this.config.telemetrySamplingRate * 1.5);
    } else if (this.metrics.errorRate < 1) {
      this.config.telemetrySamplingRate = Math.max(0.01, this.config.telemetrySamplingRate * 0.8);
    }

    // Adjust cache TTL based on hit rate
    if (this.metrics.cacheHitRate < 0.5) {
      this.config.cacheTTL = Math.max(60000, this.config.cacheTTL * 0.8); // Reduce TTL
    } else if (this.metrics.cacheHitRate > 0.9) {
      this.config.cacheTTL = Math.min(30 * 60 * 1000, this.config.cacheTTL * 1.2); // Increase TTL
    }

    logger.info(`Auto-tuned performance for ${agentType}`, {
      samplingRate: this.config.telemetrySamplingRate,
      cacheTTL: this.config.cacheTTL,
      errorRate: this.metrics.errorRate,
      cacheHitRate: this.metrics.cacheHitRate,
    });
  }

  /**
   * Calculate average value from history
   */
  private calculateAverage(current: number, newValue: number, historySize: number): number {
    if (historySize === 0) return newValue;
    const weight = Math.min(historySize, 10);
    return (current * (weight - 1) + newValue) / weight;
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const totalAccesses = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + entry.accessCount,
      0
    );
    const hits = totalAccesses - this.cache.size;
    return totalAccesses > 0 ? hits / totalAccesses : 0;
  }

  /**
   * Record performance history
   */
  private recordPerformanceHistory(): void {
    this.performanceHistory.push({ ...this.metrics });

    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance configuration
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Update performance configuration
   */
  updateConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("Updated performance configuration", config);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.config.maxCacheSize,
      cacheHitRate: this.metrics.cacheHitRate,
      averageExecutionTime: this.metrics.executionTime,
      errorRate: this.metrics.errorRate,
      throughput: this.metrics.throughput,
      historySize: this.performanceHistory.length,
      config: this.config,
    };
  }

  /**
   * Reset performance metrics
   */
  reset(): void {
    this.metrics = {
      executionTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      tokenUsage: 0,
      cacheHitRate: 0,
      throughput: 0,
      errorRate: 0,
    };
    this.performanceHistory = [];
    this.cache.clear();
    logger.info("Reset performance metrics");
  }
}

export const agentPerformanceOptimizer = new AgentPerformanceOptimizer({
  enabled: true,
  telemetrySamplingRate: 0.1,
  cacheTTL: 5 * 60 * 1000,
  maxCacheSize: 1000,
  thresholds: {
    maxExecutionTime: 10000,
    maxMemoryUsage: 512 * 1024 * 1024,
    maxCpuUsage: 80,
    maxTokenUsage: 10000,
  },
  autoTuning: true,
});
