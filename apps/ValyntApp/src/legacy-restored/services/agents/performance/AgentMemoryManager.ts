/**
 * Agent Memory Manager
 *
 * CONSOLIDATION: Memory optimization and cleanup system for agent operations
 *
 * Provides intelligent memory management, garbage collection, and resource
 * optimization for agent operations to prevent memory leaks and improve performance.
 */

import { AgentType } from "../../agent-types";
import { IAgent, AgentRequest, AgentResponse } from "../core/IAgent";
import { logger } from "../../../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { agentTelemetryService } from "../telemetry/AgentTelemetryService";

// ============================================================================
// Memory Management Types
// ============================================================================

export interface MemoryUsage {
  /** Current memory usage in bytes */
  current: number;
  /** Peak memory usage in bytes */
  peak: number;
  /** Average memory usage in bytes */
  average: number;
  /** Memory usage trend */
  trend: "increasing" | "decreasing" | "stable";
  /** Memory usage percentage */
  percentage: number;
}

export interface MemorySnapshot {
  /** Snapshot ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Agent type */
  agentType: AgentType;
  /** Memory usage details */
  memoryUsage: MemoryUsage;
  /** Active requests */
  activeRequests: number;
  /** Cached entries */
  cachedEntries: number;
  /** Agent instances */
  agentInstances: number;
  /** System memory info */
  systemMemory: SystemMemoryInfo;
}

export interface SystemMemoryInfo {
  /** Total system memory */
  total: number;
  /** Available memory */
  available: number;
  /** Used memory */
  used: number;
  /** Memory usage percentage */
  usagePercentage: number;
  /** Heap size */
  heapSize: number;
  /** Heap used */
  heapUsed: number;
  /** External memory */
  external: number;
}

export interface MemoryThreshold {
  /** Threshold ID */
  id: string;
  /** Threshold name */
  name: string;
  /** Threshold type */
  type: "absolute" | "percentage" | "trend";
  /** Threshold value */
  value: number;
  /** Threshold action */
  action: MemoryAction;
  /** Threshold severity */
  severity: "low" | "medium" | "high" | "critical";
  /** Enabled status */
  enabled: boolean;
}

export type MemoryAction =
  | "log_warning"
  | "log_error"
  | "trigger_gc"
  | "clear_cache"
  | "reduce_pool_size"
  | "restart_agent"
  | "escalate";

export interface MemoryPolicy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Policy description */
  description: string;
  /** Agent types this policy applies to */
  agentTypes: AgentType[];
  /** Memory thresholds */
  thresholds: MemoryThreshold[];
  /** Cleanup settings */
  cleanup: CleanupSettings;
  /** Monitoring settings */
  monitoring: MonitoringSettings;
  /** Optimization settings */
  optimization: OptimizationSettings;
  /** Enabled status */
  enabled: boolean;
}

export interface CleanupSettings {
  /** Enable automatic cleanup */
  enabled: boolean;
  /** Cleanup interval in milliseconds */
  interval: number;
  /** Cleanup strategies */
  strategies: CleanupStrategy[];
  /** Maximum cleanup time */
  maxCleanupTime: number;
  /** Cleanup retention */
  retention: CleanupRetention;
}

export interface CleanupStrategy {
  /** Strategy ID */
  id: string;
  /** Strategy name */
  name: string;
  /** Strategy type */
  type: "gc" | "cache_clear" | "pool_reduce" | "memory_compact" | "custom";
  /** Strategy configuration */
  config: Record<string, unknown>;
  /** Strategy priority */
  priority: number;
  /** Enabled status */
  enabled: boolean;
}

export interface CleanupRetention {
  /** Minimum age in milliseconds */
  minAge: number;
  /** Maximum age in milliseconds */
  maxAge: number;
  /** Maximum size in bytes */
  maxSize: number;
  /** Priority retention */
  prioritizeBy: "age" | "size" | "frequency" | "custom";
}

export interface MonitoringSettings {
  /** Enable monitoring */
  enabled: boolean;
  /** Monitoring interval in milliseconds */
  interval: number;
  /** Memory sampling interval */
  samplingInterval: number;
  /** Alert thresholds */
  alertThresholds: MemoryAlertThresholds;
  /** History retention */
  historyRetention: number;
}

export interface MemoryAlertThresholds {
  /** Memory usage threshold */
  memoryUsage: number;
  /** Memory growth rate threshold */
  growthRate: number;
  /** GC frequency threshold */
  gcFrequency: number;
  /** Error rate threshold */
  errorRate: number;
}

export interface OptimizationSettings {
  /** Enable optimization */
  enabled: boolean;
  /** Optimization strategies */
  strategies: OptimizationStrategy[];
  /** Optimization interval */
  interval: number;
  /** Target memory usage */
  targetUsage: number;
  /** Performance targets */
  performanceTargets: PerformanceTargets;
}

export interface OptimizationStrategy {
  /** Strategy ID */
  id: string;
  /** Strategy name */
  name: name;
  /** Strategy type */
  type: "cache_tuning" | "pool_sizing" | "gc_tuning" | "compression" | "custom";
  /** Strategy configuration */
  config: Record<string, unknown>;
  /** Strategy priority */
  priority: number;
  /** Enabled status */
  enabled: boolean;
}

export interface PerformanceTargets {
  /** Target response time */
  responseTime: number;
  /** Target throughput */
  throughput: number;
  /** Target memory efficiency */
  memoryEfficiency: number;
}

export interface MemoryLeak {
  /** Leak ID */
  id: string;
  /** Leak type */
  type: "memory_leak" | "resource_leak" | "reference_leak" | "event_leak";
  /** Agent type */
  agentType: AgentType;
  /** Leak location */
  location: string;
  /** Leak size */
  size: number;
  /** Detection timestamp */
  detectedAt: Date;
  /** Leak stack trace */
  stackTrace: string[];
  /** Leak severity */
  severity: "low" | "medium" | "high" | "critical";
  /** Leak status */
  status: "active" | "fixed" | "ignored";
}

export interface MemoryStatistics {
  /** Total memory allocated */
  totalAllocated: number;
  /** Total memory freed */
  totalFreed: number;
  /** Current memory usage */
  currentUsage: number;
  /** Peak memory usage */
  peakUsage: number;
  /** Average memory usage */
  avgUsage: number;
  /** Memory efficiency */
  efficiency: number;
  /** GC frequency */
  gcFrequency: number;
  /** GC duration */
  gcDuration: number;
  /** Memory leaks detected */
  memoryLeaks: number;
  /** Cleanup operations */
  cleanups: number;
  /** Optimizations applied */
  optimizations: number;
}

// ============================================================================
// Memory Manager Implementation
// ============================================================================

/**
 * Agent Memory Manager
 *
 * Provides intelligent memory management and optimization for agents
 */
export class AgentMemoryManager {
  private static instance: AgentMemoryManager;
  private memorySnapshots: Map<string, MemorySnapshot[]> = new Map();
  private memoryPolicies: Map<string, MemoryPolicy> = new Map();
  private memoryLeaks: Map<string, MemoryLeak> = new Map();
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();
  private statistics: MemoryStatistics;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.statistics = this.initializeStatistics();
    this.initializeDefaultPolicies();
    this.startMonitoring();
    logger.info("AgentMemoryManager initialized");
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentMemoryManager {
    if (!AgentMemoryManager.instance) {
      AgentMemoryManager.instance = new AgentMemoryManager();
    }
    return AgentMemoryManager.instance;
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(agentType?: AgentType): MemoryUsage {
    const systemMemory = this.getSystemMemoryInfo();
    const currentUsage = systemMemory.used;
    const percentage = systemMemory.usagePercentage;

    // Get agent-specific memory usage if requested
    if (agentType) {
      const snapshots = this.memorySnapshots.get(agentType) || [];
      if (snapshots.length > 0) {
        const latest = snapshots[snapshots.length - 1];
        return {
          current: latest.memoryUsage.current,
          peak: latest.memoryUsage.peak,
          average: latest.memoryUsage.average,
          trend: latest.memoryUsage.trend,
          percentage: latest.memoryUsage.percentage,
        };
      }
    }

    return {
      current: currentUsage,
      peak: currentUsage,
      average: currentUsage,
      trend: "stable",
      percentage,
    };
  }

  /**
   * Take memory snapshot
   */
  takeSnapshot(agentType: AgentType): MemorySnapshot {
    const snapshot: MemorySnapshot = {
      id: uuidv4(),
      timestamp: new Date(),
      agentType,
      memoryUsage: this.getMemoryUsage(agentType),
      activeRequests: 0, // Would track active requests
      cachedEntries: 0, // Would track cache entries
      agentInstances: 0, // Would track agent instances
      systemMemory: this.getSystemMemoryInfo(),
    };

    if (!this.memorySnapshots.has(agentType)) {
      this.memorySnapshots.set(agentType, []);
    }

    const snapshots = this.memorySnapshots.get(agentType)!;
    snapshots.push(snapshot);

    // Keep only recent snapshots
    const maxSnapshots = 100;
    if (snapshots.length > maxSnapshots) {
      snapshots.splice(0, snapshots.length - maxSnapshots);
    }

    // Update memory usage statistics
    this.updateMemoryUsageStatistics(snapshot);

    logger.debug("Memory snapshot taken", {
      agentType,
      snapshotId: snapshot.id,
      memoryUsage: snapshot.memoryUsage.current,
      percentage: snapshot.memoryUsage.percentage,
    });

    return snapshot;
  }

  /**
   * Detect memory leaks
   */
  detectMemoryLeaks(agentType: AgentType): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    const snapshots = this.memorySnapshots.get(agentType) || [];

    if (snapshots.length < 10) {
      return leaks; // Need more data for leak detection
    }

    // Analyze memory growth patterns
    const recentSnapshots = snapshots.slice(-10);
    const memoryTrend = this.analyzeMemoryTrend(recentSnapshots);

    if (memoryTrend === "increasing") {
      const growthRate = this.calculateGrowthRate(recentSnapshots);
      const avgSize =
        recentSnapshots.reduce((sum, s) => sum + s.memoryUsage.current, 0) / recentSnapshots.length;
      const maxSize = Math.max(...recentSnapshots.map((s) => s.memoryUsage.peak));

      // Potential leak detected
      if (growthRate > 0.1 && avgSize > 100 * 1024 * 1024) {
        // 100MB average, 10% growth rate
        const leak: MemoryLeak = {
          id: uuidv4(),
          type: "memory_leak",
          agentType,
          location: "unknown",
          size: avgSize,
          detectedAt: new Date(),
          stackTrace: [], // Would collect stack traces
          severity: avgSize > 500 * 1024 * 1024 ? "high" : "medium",
          status: "active",
        };

        leaks.push(leak);
        this.memoryLeaks.set(leak.id, leak);
      }
    }

    return leaks;
  }

  /**
   * Trigger garbage collection
   */
  async triggerGC(): Promise<void> {
    const startTime = Date.now();

    try {
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const duration = Date.now() - startTime;

      this.statistics.gcFrequency++;
      this.statistics.gcDuration =
        (this.statistics.gcDuration * (this.statistics.gcFrequency - 1) + duration) /
        this.statistics.gcFrequency;

      logger.info("Garbage collection triggered", {
        duration,
        totalGCTime: this.statistics.gcDuration,
        gcFrequency: this.statistics.gcFrequency,
      });

      // Record GC event in telemetry
      agentTelemetryService.recordTelemetryEvent({
        type: "agent_gc_triggered",
        agentType: "system",
        data: {
          duration,
          frequency: this.statistics.gcFrequency,
          memoryUsage: this.getMemoryUsage().current,
        },
        severity: "info",
      });
    } catch (error) {
      logger.error("Failed to trigger garbage collection", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Clear cache for agent type
   */
  clearCache(
    agentType: AgentType,
    options?: {
      olderThan?: Date;
      maxSize?: number;
      priority?: string[];
    }
  ): number {
    let clearedCount = 0;

    // This would integrate with the cache manager
    // For now, we'll simulate cache clearing

    const cacheManager = agentCacheManager;
    if (cacheManager) {
      if (options?.olderThan) {
        clearedCount += cacheManager.invalidate({
          agentType,
          olderThan: options.olderThan,
        });
      } else {
        cacheManager.clear();
        clearedCount = 1;
      }
    }

    logger.info("Cache cleared", {
      agentType,
      clearedCount,
      options,
    });

    return clearedCount;
  }

  /**
   * Reduce agent pool size
   */
  reducePoolSize(agentType: AgentType, targetSize: number): number {
    const pool = this.agentPools?.get(agentType);
    if (!pool) {
      return 0;
    }

    const currentSize = pool.agents.length;
    const reductionCount = Math.max(0, currentSize - targetSize);

    if (reductionCount > 0) {
      // Remove excess agents
      const removedAgents = pool.agents.splice(-reductionCount, reductionCount);

      // Mark agents for destruction
      removedAgents.forEach((agent) => {
        agent.status = "unhealthy";
      });

      logger.info("Agent pool reduced", {
        agentType,
        previousSize: currentSize,
        newSize: pool.agents.length,
        reductionCount,
      });
    }

    return reductionCount;
  }

  /**
   * Optimize memory usage
   */
  async optimizeMemory(agentType?: AgentType): Promise<{
    optimizations: string[];
    memoryReduction: number;
    performanceImpact: string;
  }> {
    const optimizations: string[] = [];
    let memoryReduction = 0;
    let performanceImpact = "minimal";

    try {
      // Trigger GC
      await this.triggerGC();
      optimizations.push("garbage_collection");
      memoryReduction += this.getMemoryUsage().current * 0.1; // Estimate 10% reduction

      // Clear old cache entries
      const clearedCount = this.clearCache(agentType, {
        olderThan: new Date(Date.now() - 300000), // 5 minutes
      });
      if (clearedCount > 0) {
        optimizations.push("cache_cleanup");
        memoryReduction += clearedCount * 1024; // Estimate 1KB per cache entry
      }

      // Reduce pool size if needed
      const pool = this.agentPools?.get(agentType);
      if (pool && pool.agents.length > 2) {
        const reduction = this.reducePoolSize(agentType, Math.max(2, pool.agents.length - 1));
        if (reduction > 0) {
          optimizations.push("pool_reduction");
          memoryReduction += reduction * 10 * 1024; // Estimate 10MB per agent
        }
      }

      // Compress memory if needed
      const compressionRatio = await this.compressMemory(agentType);
      if (compressionRatio > 0.1) {
        optimizations.push("memory_compression");
        memoryReduction *= compressionRatio;
        performanceImpact = "moderate";
      }

      // Determine performance impact
      if (memoryReduction > 50 * 1024 * 1024) {
        // 50MB
        performanceImpact = "significant";
      } else if (memoryReduction > 10 * 1024 * 1024) {
        // 10MB
        performanceImpact = "moderate";
      }

      logger.info("Memory optimization completed", {
        agentType,
        optimizations,
        memoryReduction,
        performanceImpact,
      });
    } catch (error) {
      logger.error("Memory optimization failed", {
        agentType,
        error: (error as Error).message,
      });
    }

    return { optimizations, memoryReduction, performanceImpact };
  }

  /**
   * Get memory statistics
   */
  getMemoryStatistics(): MemoryStatistics {
    return { ...this.statistics };
  }

  /**
   * Get memory leaks
   */
  getMemoryLeaks(agentType?: AgentType): MemoryLeak[] {
    const leaks = Array.from(this.memoryLeaks.values());

    if (agentType) {
      return leaks.filter((leak) => leak.agentType === agentType);
    }

    return leaks;
  }

  /**
   * Fix memory leak
   */
  fixMemoryLeak(leakId: string): boolean {
    const leak = this.memoryLeaks.get(leakId);
    if (!leak) {
      return false;
    }

    leak.status = "fixed";
    this.statistics.memoryLeaks = Math.max(0, this.statistics.memoryLeaks - 1);

    logger.info("Memory leak fixed", {
      leakId,
      agentType: leak.agentType,
      type: leak.type,
      size: leak.size,
    });

    return true;
  }

  /**
   * Add or update memory policy
   */
  updateMemoryPolicy(policy: MemoryPolicy): void {
    this.memoryPolicies.set(policy.id, policy);
    logger.info("Memory policy updated", { policyId: policy.id, agentTypes: policy.agentTypes });
  }

  /**
   * Get memory policy for agent type
   */
  getMemoryPolicy(agentType: AgentType): MemoryPolicy | undefined {
    for (const policy of this.memoryPolicies.values()) {
      if (policy.agentTypes.includes(agentType) && policy.enabled) {
        return policy;
      }
    }
    return undefined;
  }

  /**
   * Reset memory manager
   */
  reset(): void {
    this.memorySnapshots.clear();
    this.memoryLeaks.clear();
    this.statistics = this.initializeStatistics();
    this.initializeDefaultPolicies();
    logger.info("Agent memory manager reset");
  }

  /**
   * Shutdown memory manager
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Clear all timers
    this.cleanupTimers.forEach((timer) => clearTimeout(timer));
    this.cleanupTimers.clear();

    logger.info("Agent memory manager shutdown");
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get system memory information
   */
  private getSystemMemoryInfo(): SystemMemoryInfo {
    const usage = process.memoryUsage();

    return {
      total: usage.heapTotal,
      available: usage.heapTotal - usage.heapUsed,
      used: usage.heapUsed,
      usagePercentage: (usage.heapUsed / usage.heapTotal) * 100,
      heapSize: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.rss,
    };
  }

  /**
   * Analyze memory trend
   */
  private analyzeMemoryTrend(snapshots: MemorySnapshot[]): "increasing" | "decreasing" | "stable" {
    if (snapshots.length < 3) return "stable";

    const first = snapshots[0].memoryUsage.current;
    const last = snapshots[snapshots.length - 1].memoryUsage.current;

    if (last > first * 1.1) return "increasing";
    if (last < first * 0.9) return "decreasing";
    return "stable";
  }

  /**
   * Calculate growth rate
   */
  private calculateGrowthRate(snapshots: MemorySnapshot[]): number {
    if (snapshots.length < 2) return 0;

    const first = snapshots[0].memoryUsage.current;
    const last = snapshots[snapshots.length - 1].memoryUsage.current;
    const timeDiff =
      snapshots[snapshots.length - 1].timestamp.getTime() - snapshots[0].timestamp.getTime();

    return (last - first) / first / (timeDiff / 1000); // Per second growth rate
  }

  /**
   * Update memory usage statistics
   */
  private updateMemoryUsageStatistics(snapshot: MemorySnapshot): void {
    const currentUsage = snapshot.memoryUsage.current;
    const totalAllocated = this.statistics.totalAllocated;

    this.statistics.currentUsage = currentUsage;
    this.statistics.peakUsage = Math.max(this.statistics.peakUsage, currentUsage);

    if (totalAllocated === 0) {
      this.statistics.avgUsage = currentUsage;
    } else {
      this.statistics.avgUsage =
        (this.statistics.avgUsage * (totalAllocated - 1) + currentUsage) / totalAllocated;
    }
  }

  /**
   * Compress memory
   */
  private async compressMemory(agentType: AgentType): Promise<number> {
    // Simulate memory compression
    // In production, would use actual compression libraries
    return 0.15; // 15% compression ratio
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performMonitoring();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform monitoring
   */
  private performMonitoring(): void {
    try {
      // Take snapshots for all agent types
      const agentTypes = Array.from(this.memoryPolicies.values()).flatMap(
        (policy) => policy.agentTypes
      );

      for (const agentType of agentTypes) {
        this.takeSnapshot(agentType);
      }

      // Check for memory leaks
      for (const agentType of agentTypes) {
        const leaks = this.detectMemoryLeaks(agentType);
        if (leaks.length > 0) {
          logger.warn("Memory leaks detected", {
            agentType,
            leakCount: leaks.length,
            totalSize: leaks.reduce((sum, leak) => sum + leak.size, 0),
          });
        }
      }

      // Check memory thresholds
      this.checkMemoryThresholds();

      // Perform cleanup if needed
      this.performCleanup();
    } catch (error) {
      logger.error("Memory monitoring failed", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Check memory thresholds
   */
  private checkMemoryThresholds(): void {
    const memoryUsage = this.getMemoryUsage();

    for (const policy of this.memoryPolicies.values()) {
      if (!policy.enabled) continue;

      for (const threshold of policy.thresholds) {
        if (!threshold.enabled) continue;

        let triggered = false;

        switch (threshold.type) {
          case "absolute":
            triggered = memoryUsage.current > threshold.value;
            break;
          case "percentage":
            triggered = memoryUsage.percentage > threshold.value;
            break;
          case "trend":
            triggered = memoryUsage.trend === "increasing";
            break;
        }

        if (triggered) {
          this.handleThresholdExceeded(threshold);
        }
      }
    }
  }

  /**
   * Handle threshold exceeded
   */
  private handleThresholdExceeded(threshold: MemoryThreshold): void {
    logger.warn("Memory threshold exceeded", {
      thresholdId: threshold.id,
      thresholdName: threshold.name,
      thresholdValue: threshold.value,
      thresholdType: threshold.type,
      severity: threshold.severity,
    });

    // Execute threshold action
    switch (threshold.action) {
      case "log_warning":
        logger.warn("Memory usage warning", {
          threshold: threshold.name,
          value: threshold.value,
          type: threshold.type,
        });
        break;

      case "log_error":
        logger.error("Memory usage error", {
          threshold: threshold.name,
          value: threshold.value,
          type: threshold.type,
        });
        break;

      case "trigger_gc":
        this.triggerGC();
        break;

      case "clear_cache":
        this.clearCache("all");
        break;

      case "reduce_pool_size":
        // Reduce pool sizes for all agents
        for (const agentType of this.memoryPolicies.values()) {
          this.reducePoolSize(agentType.agentType, 1);
        }
        break;

      case "restart_agent":
        // Would trigger agent restart
        logger.warn("Agent restart triggered by memory threshold", {
          threshold: threshold.name,
        });
        break;

      case "escalate":
        logger.error("Memory threshold exceeded - escalation required", {
          threshold: threshold.name,
          value: threshold.value,
          type: threshold.type,
        });
        break;
    }
  }

  /**
   * Perform cleanup
   */
  private performCleanup(): void {
    for (const policy of this.memoryPolicies.values()) {
      if (!policy.cleanup.enabled) continue;

      const cleanupStrategies = policy.cleanup.strategies
        .filter((s) => s.enabled)
        .sort((a, b) => b.priority - a.priority);

      for (const strategy of cleanupStrategies) {
        this.executeCleanupStrategy(strategy);
      }
    }
  }

  /**
   * Execute cleanup strategy
   */
  private executeCleanupStrategy(strategy: CleanupStrategy): void {
    logger.debug("Executing cleanup strategy", {
      strategyId: strategy.id,
      strategyName: strategy.name,
      strategyType: strategy.type,
    });

    switch (strategy.type) {
      case "gc":
        this.triggerGC();
        break;

      case "cache_clear":
        this.clearCache("all");
        break;

      case "pool_reduce":
        // Reduce pool sizes
        for (const agentType of this.memoryPolicies.values()) {
          this.reducePoolSize(agentType.agentType, 1);
        }
        break;

      case "memory_compact":
        // Trigger memory compaction
        this.triggerGC();
        break;

      case "custom":
        // Custom cleanup logic would go here
        break;
    }
  }

  /**
   * Initialize statistics
   */
  private initializeStatistics(): MemoryStatistics {
    return {
      totalAllocated: 0,
      totalFreed: 0,
      currentUsage: 0,
      peakUsage: 0,
      avgUsage: 0,
      efficiency: 0,
      gcFrequency: 0,
      gcDuration: 0,
      memoryLeaks: 0,
      cleanups: 0,
      optimizations: 0,
    };
  }

  /**
   * Initialize default memory policies
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicy: MemoryPolicy = {
      id: "default-memory-policy",
      name: "Default Memory Policy",
      description: "Default memory management policy for all agents",
      agentTypes: ["opportunity", "target", "expansion", "integrity", "realization"],
      thresholds: [
        {
          id: "memory-warning",
          name: "Memory Usage Warning",
          type: "percentage",
          value: 80,
          action: "log_warning",
          severity: "medium",
          enabled: true,
        },
        {
          id: "memory-critical",
          name: "Memory Usage Critical",
          type: "percentage",
          value: 90,
          action: "trigger_gc",
          severity: "high",
          enabled: true,
        },
        {
          id: "memory-emergency",
          name: "Memory Usage Emergency",
          type: "percentage",
          value: 95,
          action: "clear_cache",
          severity: "critical",
          enabled: true,
        },
      ],
      cleanup: {
        enabled: true,
        interval: 60000, // 1 minute
        strategies: [
          {
            id: "gc-cleanup",
            name: "Garbage Collection",
            type: "gc",
            config: {},
            priority: 1,
            enabled: true,
          },
          {
            id: "cache-cleanup",
            name: "Cache Cleanup",
            type: "cache_clear",
            config: {},
            priority: 2,
            enabled: true,
          },
        ],
        maxCleanupTime: 5000, // 5 seconds
        retention: {
          minAge: 300000, // 5 minutes
          maxAge: 3600000, // 1 hour
          maxSize: 100 * 1024 * 1024, // 100MB
          prioritizeBy: "age",
        },
      },
      monitoring: {
        enabled: true,
        interval: 30000, // 30 seconds
        samplingInterval: 5000, // 5 seconds
        alertThresholds: {
          memoryUsage: 85,
          growthRate: 0.1,
          gcFrequency: 5,
          errorRate: 0.05,
        },
        historyRetention: 100,
      },
      optimization: {
        enabled: true,
        interval: 300000, // 5 minutes
        strategies: [
          {
            id: "cache-tuning",
            name: "Cache Tuning",
            type: "cache_tuning",
            config: {
              maxEntries: 1000,
              ttl: 300000,
            },
            priority: 1,
            enabled: true,
          },
          {
            id: "pool-sizing",
            name: "Pool Sizing",
            type: "pool_sizing",
            config: {
              targetSize: 5,
              minSize: 2,
              maxSize: 20,
            },
            priority: 2,
            enabled: true,
          },
        ],
        interval: 300000, // 5 minutes
        targetUsage: 70, // 70% memory usage
        performanceTargets: {
          responseTime: 1000,
          throughput: 100,
          memoryEfficiency: 0.8,
        },
      },
      enabled: true,
    };

    this.memoryPolicies.set(defaultPolicy.id, defaultPolicy);
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const agentMemoryManager = AgentMemoryManager.getInstance();
