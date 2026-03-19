/**
 * System Resource Monitor
 *
 * Monitors CPU, memory, and system load for dynamic resource management
 * and adaptive concurrency scaling.
 */

import os from "os";

import { logger } from "../../lib/logger.js";

import { getMemoryPressureMonitor, MemoryPressure } from "./MemoryPressureMonitor.js";

// ============================================================================
// Types
// ============================================================================

export interface SystemResources {
  cpu: {
    usage: number;
    loadAverage: number[];
    coreCount: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    pressure: MemoryPressure;
  };
  heap: {
    used: number;
    total: number;
    percentage: number;
  };
  timestamp: number;
}

export interface ResourceThresholds {
  maxCpuUsage: number;
  maxMemoryUsage: number;
  maxHeapUsage: number;
  minFreeMemory: number; // MB
  scalingFactor: number;
  minConcurrency: number;
  maxConcurrency: number;
}

export interface ResourceListener {
  onResourceChange(resources: SystemResources): void;
}

// ============================================================================
// System Resource Monitor Implementation
// ============================================================================

export class SystemResourceMonitor {
  private listeners: Set<ResourceListener> = new Set();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastResources: SystemResources | null = null;
  private memoryMonitor = getMemoryPressureMonitor();
  private previousResources: SystemResources | null = null;
  private readonly coreCount: number;

  // CPU delta tracking for accurate usage calculation
  private lastCpuUsage = process.cpuUsage();
  private lastCpuTime = Date.now();

  private readonly DEFAULT_THRESHOLDS: ResourceThresholds = {
    maxCpuUsage: 80,        // 80% CPU usage
    maxMemoryUsage: 85,     // 85% system memory
    maxHeapUsage: 75,       // 75% heap usage
    minFreeMemory: 512,     // 512 MB minimum free
    scalingFactor: 0.8,    // Scale down to 80% under pressure
    minConcurrency: 2,
    maxConcurrency: 20,
  };

  constructor(
    private thresholds: Partial<ResourceThresholds> = {},
    private monitoringIntervalMs: number = 3000 // 3 seconds
  ) {
    this.thresholds = { ...this.DEFAULT_THRESHOLDS, ...thresholds };
    this.coreCount = os.cpus().length;
  }

  /**
   * Start monitoring system resources
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      logger.warn("System resource monitoring already started");
      return;
    }

    this.monitoringInterval = setInterval(() => {
      this.checkResources();
    }, this.monitoringIntervalMs);

    logger.info("System resource monitoring started", {
      thresholds: this.thresholds,
      intervalMs: this.monitoringIntervalMs,
    });
  }

  /**
   * Stop monitoring system resources
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info("System resource monitoring stopped");
    }
  }

  /**
   * Add a listener for resource changes
   */
  addListener(listener: ResourceListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a listener for resource changes
   */
  removeListener(listener: ResourceListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Get current system resources
   */
  getCurrentResources(forceRefresh = false): SystemResources {
    if (!forceRefresh && this.lastResources) {
      return this.lastResources;
    }

    return this.sampleResources();
  }

  /**
   * Calculate optimal concurrency based on current resources
   */
  getOptimalConcurrency(baseConcurrency: number, forceRefresh = false): number {
    const resources = this.getCurrentResources(forceRefresh);
    let optimalConcurrency = baseConcurrency;

    // Scale down based on CPU usage
    if (resources.cpu.usage > this.thresholds.maxCpuUsage) {
      const cpuFactor = this.thresholds.maxCpuUsage / resources.cpu.usage;
      optimalConcurrency = Math.floor(optimalConcurrency * cpuFactor);
    }

    // Scale down based on memory usage
    if (resources.memory.percentage > this.thresholds.maxMemoryUsage) {
      const memoryFactor = this.thresholds.maxMemoryUsage / resources.memory.percentage;
      optimalConcurrency = Math.floor(optimalConcurrency * memoryFactor);
    }

    // Scale down based on heap usage
    if (resources.heap.percentage > this.thresholds.maxHeapUsage) {
      const heapFactor = this.thresholds.maxHeapUsage / resources.heap.percentage;
      optimalConcurrency = Math.floor(optimalConcurrency * heapFactor);
    }

    // Apply memory pressure scaling
    switch (resources.memory.pressure) {
      case 'critical':
        optimalConcurrency = Math.floor(optimalConcurrency * 0.3);
        break;
      case 'high':
        optimalConcurrency = Math.floor(optimalConcurrency * 0.5);
        break;
      case 'medium':
        optimalConcurrency = Math.floor(optimalConcurrency * 0.7);
        break;
    }

    // Ensure within bounds
    optimalConcurrency = Math.max(
      this.thresholds.minConcurrency,
      Math.min(this.thresholds.maxConcurrency, optimalConcurrency)
    );

    if (optimalConcurrency !== baseConcurrency) {
      logger.debug('Concurrency scaled based on resources', {
        base: baseConcurrency,
        optimal: optimalConcurrency,
        cpuUsage: resources.cpu.usage,
        memoryUsage: resources.memory.percentage,
        heapUsage: resources.heap.percentage,
        pressure: resources.memory.pressure,
      });
    }

    return optimalConcurrency;
  }

  /**
   * Check if system is under high load
   */
  isUnderHighLoad(forceRefresh = false): boolean {
    const resources = this.getCurrentResources(forceRefresh);

    return (
      resources.cpu.usage > this.thresholds.maxCpuUsage ||
      resources.memory.percentage > this.thresholds.maxMemoryUsage ||
      resources.heap.percentage > this.thresholds.maxHeapUsage ||
      resources.memory.pressure === 'high' ||
      resources.memory.pressure === 'critical'
    );
  }

  /**
   * Get resource utilization trend
   */
  getResourceTrend(forceRefresh = false): "increasing" | "decreasing" | "stable" {
    const current = this.getCurrentResources(forceRefresh);
    const previous = this.previousResources;

    if (!previous) return "stable";

    const cpuTrend = current.cpu.usage > previous.cpu.usage ? 1 : -1;
    const memoryTrend = current.memory.percentage > previous.memory.percentage ? 1 : -1;
    const heapTrend = current.heap.percentage > previous.heap.percentage ? 1 : -1;

    const totalTrend = cpuTrend + memoryTrend + heapTrend;

    if (totalTrend > 0) return "increasing";
    if (totalTrend < 0) return "decreasing";
    return "stable";
  }

  /**
   * Get system health score (0-100)
   */
  getHealthScore(forceRefresh = false): number {
    const resources = this.getCurrentResources(forceRefresh);

    const cpuScore = Math.max(0, 100 - resources.cpu.usage);
    const memoryScore = Math.max(0, 100 - resources.memory.percentage);
    const heapScore = Math.max(0, 100 - resources.heap.percentage);

    // Apply pressure penalties
    let pressurePenalty = 0;
    switch (resources.memory.pressure) {
      case 'critical': pressurePenalty = 30; break;
      case 'high': pressurePenalty = 20; break;
      case 'medium': pressurePenalty = 10; break;
    }

    const baseScore = (cpuScore + memoryScore + heapScore) / 3;
    return Math.max(0, baseScore - pressurePenalty);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private checkResources(): void {
    const resources = this.sampleResources();

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener.onResourceChange(resources);
      } catch (error) {
        logger.error("Error in resource listener", error instanceof Error ? error : undefined);
      }
    });

    // Log warnings for high resource usage
    if (this.isUnderHighLoad()) {
      logger.warn("High system resource usage detected", {
        cpuUsage: resources.cpu.usage,
        memoryUsage: resources.memory.percentage,
        heapUsage: resources.heap.percentage,
        pressure: resources.memory.pressure,
        healthScore: this.getHealthScore(),
      });
    }
  }

  private sampleResources(): SystemResources {
    const memUsage = process.memoryUsage();
    const memoryStats = this.memoryMonitor.getCurrentStats();

    // Get CPU usage (simplified - in production use proper CPU monitoring)
    const cpuUsage = this.getCpuUsage();

    // Get load average (Unix-like systems only)
    const loadAverage = process.platform !== 'win32'
      ? os.loadavg()
      : [0, 0, 0];

    // Get system memory (simplified)
    const systemMemory = this.getSystemMemory();

    const resources: SystemResources = {
      cpu: {
        usage: cpuUsage,
        loadAverage,
        coreCount: this.coreCount,
      },
      memory: {
        used: systemMemory.used,
        total: systemMemory.total,
        percentage: systemMemory.percentage,
        pressure: memoryStats.pressure,
      },
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      timestamp: Date.now(),
    };

    this.previousResources = this.lastResources;
    this.lastResources = resources;

    return resources;
  }

  private getCpuUsage(): number {
    const now = Date.now();
    const elapsedMs = now - this.lastCpuTime;
    if (elapsedMs < 1) return 0;

    const usage = process.cpuUsage(this.lastCpuUsage);
    // user + system time in microseconds; elapsedMs * 1000 = elapsed microseconds
    const totalCpuUs = usage.user + usage.system;
    const elapsedUs = elapsedMs * 1000 * this.coreCount; // scale by core count

    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = now;

    return Math.min(100, (totalCpuUs / elapsedUs) * 100);
  }

  private getSystemMemory(): { used: number; total: number; percentage: number } {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return {
      used,
      total,
      percentage: (used / total) * 100,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let systemResourceMonitorInstance: SystemResourceMonitor | null = null;

export function getSystemResourceMonitor(
  thresholds?: Partial<ResourceThresholds>,
  intervalMs?: number
): SystemResourceMonitor {
  if (!systemResourceMonitorInstance) {
    systemResourceMonitorInstance = new SystemResourceMonitor(thresholds, intervalMs);
  }
  return systemResourceMonitorInstance;
}

export function resetSystemResourceMonitor(): void {
  if (systemResourceMonitorInstance) {
    systemResourceMonitorInstance.stopMonitoring();
  }
  systemResourceMonitorInstance = null;
}
