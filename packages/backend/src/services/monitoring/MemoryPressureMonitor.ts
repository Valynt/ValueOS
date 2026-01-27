/**
 * Memory Pressure Monitor
 *
 * Monitors system memory usage and provides pressure detection
 * for adaptive resource management in high-traffic scenarios.
 */

import { logger } from "../../lib/logger.js";

// ============================================================================
// Types
// ============================================================================

export type MemoryPressure = 'low' | 'medium' | 'high' | 'critical';

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  heapUsedPercentage: number;
  pressure: MemoryPressure;
  timestamp: number;
}

export interface MemoryThresholds {
  mediumPressure: number; // % of heap used
  highPressure: number;   // % of heap used
  criticalPressure: number; // % of heap used
  maxCacheSize: number;   // Maximum cache entries
  cleanupThreshold: number; // % of cache to clean when pressure detected
}

export interface MemoryPressureListener {
  onPressureChange(pressure: MemoryPressure, stats: MemoryStats): void;
}

// ============================================================================
// Memory Pressure Monitor Implementation
// ============================================================================

export class MemoryPressureMonitor {
  private listeners: Set<MemoryPressureListener> = new Set();
  private currentPressure: MemoryPressure = 'low';
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastStats: MemoryStats | null = null;

  private readonly DEFAULT_THRESHOLDS: MemoryThresholds = {
    mediumPressure: 60,    // 60% heap usage
    highPressure: 75,      // 75% heap usage
    criticalPressure: 90,  // 90% heap usage
    maxCacheSize: 1000,
    cleanupThreshold: 30,  // Clean 30% of cache on pressure
  };

  constructor(
    private thresholds: Partial<MemoryThresholds> = {},
    private monitoringIntervalMs: number = 5000 // 5 seconds
  ) {
    this.thresholds = { ...this.DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Start monitoring memory pressure
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      logger.warn('Memory monitoring already started');
      return;
    }

    this.monitoringInterval = setInterval(() => {
      this.checkMemoryPressure();
    }, this.monitoringIntervalMs);

    logger.info('Memory pressure monitoring started', {
      thresholds: this.thresholds,
      intervalMs: this.monitoringIntervalMs,
    });
  }

  /**
   * Stop monitoring memory pressure
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Memory pressure monitoring stopped');
    }
  }

  /**
   * Add a listener for memory pressure changes
   */
  addListener(listener: MemoryPressureListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a listener for memory pressure changes
   */
  removeListener(listener: MemoryPressureListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Get current memory statistics
   */
  getCurrentStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    const heapUsedPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    const stats: MemoryStats = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      heapUsedPercentage,
      pressure: this.calculatePressure(heapUsedPercentage),
      timestamp: Date.now(),
    };

    this.lastStats = stats;
    return stats;
  }

  /**
   * Force immediate memory pressure check
   */
  checkMemoryPressure(): MemoryStats {
    const stats = this.getCurrentStats();
    const previousPressure = this.currentPressure;
    this.currentPressure = stats.pressure;

    // Notify listeners if pressure changed
    if (previousPressure !== stats.pressure) {
      logger.warn('Memory pressure changed', {
        from: previousPressure,
        to: stats.pressure,
        heapUsedPercentage: stats.heapUsedPercentage,
        heapUsedMB: Math.round(stats.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(stats.heapTotal / 1024 / 1024),
      });

      this.listeners.forEach(listener => {
        try {
          listener.onPressureChange(stats.pressure, stats);
        } catch (error) {
          logger.error('Error in memory pressure listener', error instanceof Error ? error : undefined);
        }
      });
    }

    return stats;
  }

  /**
   * Get recommended cache size based on current memory pressure
   */
  getRecommendedCacheSize(): number {
    const stats = this.getCurrentStats();

    switch (stats.pressure) {
      case 'critical':
        return Math.floor(this.thresholds.maxCacheSize * 0.2); // 20% of max
      case 'high':
        return Math.floor(this.thresholds.maxCacheSize * 0.4); // 40% of max
      case 'medium':
        return Math.floor(this.thresholds.maxCacheSize * 0.7); // 70% of max
      default:
        return this.thresholds.maxCacheSize;
    }
  }

  /**
   * Get recommended cleanup percentage
   */
  getCleanupPercentage(): number {
    const stats = this.getCurrentStats();

    switch (stats.pressure) {
      case 'critical':
        return 50; // Clean 50%
      case 'high':
        return this.thresholds.cleanupThreshold;
      case 'medium':
        return 20; // Clean 20%
      default:
        return 0; // No cleanup needed
    }
  }

  /**
   * Check if garbage collection should be triggered
   */
  shouldTriggerGC(): boolean {
    const stats = this.getCurrentStats();
    return stats.pressure === 'high' || stats.pressure === 'critical';
  }

  /**
   * Trigger garbage collection if available
   */
  triggerGC(): boolean {
    if (global.gc) {
      logger.debug('Triggering manual garbage collection');
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * Get memory pressure trend
   */
  getPressureTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (!this.lastStats) return 'stable';

    const currentStats = this.getCurrentStats();
    const pressureLevels = { low: 1, medium: 2, high: 3, critical: 4 };

    const currentLevel = pressureLevels[currentStats.pressure];
    const previousLevel = pressureLevels[this.lastStats.pressure];

    if (currentLevel > previousLevel) return 'increasing';
    if (currentLevel < previousLevel) return 'decreasing';
    return 'stable';
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private calculatePressure(heapUsedPercentage: number): MemoryPressure {
    if (heapUsedPercentage >= this.thresholds.criticalPressure) return 'critical';
    if (heapUsedPercentage >= this.thresholds.highPressure) return 'high';
    if (heapUsedPercentage >= this.thresholds.mediumPressure) return 'medium';
    return 'low';
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let memoryPressureMonitorInstance: MemoryPressureMonitor | null = null;

export function getMemoryPressureMonitor(
  thresholds?: Partial<MemoryThresholds>,
  intervalMs?: number
): MemoryPressureMonitor {
  if (!memoryPressureMonitorInstance) {
    memoryPressureMonitorInstance = new MemoryPressureMonitor(thresholds, intervalMs);
  }
  return memoryPressureMonitorInstance;
}

export function resetMemoryPressureMonitor(): void {
  if (memoryPressureMonitorInstance) {
    memoryPressureMonitorInstance.stopMonitoring();
  }
  memoryPressureMonitorInstance = null;
}
