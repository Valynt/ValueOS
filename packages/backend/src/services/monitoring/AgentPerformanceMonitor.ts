/**
 * Agent Performance Monitor
 *
 * Comprehensive monitoring system for agent performance, health scoring,
 * and real-time metrics collection with alerting capabilities.
 */

import { EventEmitter } from "events";

import { logger } from "../../lib/logger.js";

// ============================================================================
// Types
// ============================================================================

export interface AgentMetrics {
  agentId: string;
  agentType: string;
  sessionId: string;

  // Performance metrics
  executionTime: number;
  latency: number;
  memoryUsage: number;
  cpuUsage: number;

  // Quality metrics
  successRate: number;
  errorRate: number;
  confidenceScore: number;
  responseQuality: number;

  // Throughput metrics
  requestsPerMinute: number;
  messagesPerMinute: number;

  // Timestamp
  timestamp: number;
}

export interface AgentHealthScore {
  agentId: string;
  overallScore: number; // 0-100
  performanceScore: number;
  reliabilityScore: number;
  qualityScore: number;

  // Health indicators
  isHealthy: boolean;
  warnings: string[];
  errors: string[];

  // Trends
  trendDirection: "improving" | "stable" | "degrading";
  trendPercentage: number;

  timestamp: number;
}

export interface PerformanceAlert {
  id: string;
  agentId: string;
  severity: "low" | "medium" | "high" | "critical";
  type: "performance" | "reliability" | "quality" | "resource";
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
}

export interface MonitoringConfig {
  // Metrics collection
  metricsRetentionPeriod: number; // hours
  metricsAggregationInterval: number; // seconds

  // Health scoring
  healthCheckInterval: number; // seconds
  performanceThresholds: {
    maxLatency: number; // ms
    maxMemoryUsage: number; // MB
    minSuccessRate: number; // percentage
    minConfidenceScore: number; // 0-1
  };

  // Alerting
  alertThresholds: {
    latencyWarning: number; // ms
    latencyCritical: number; // ms
    errorRateWarning: number; // percentage
    errorRateCritical: number; // percentage
    memoryWarning: number; // MB
    memoryCritical: number; // MB
  };
}

type MetricAccumulator = {
  executionTime: number;
  latency: number;
  memoryUsage: number;
  cpuUsage: number;
  successRate: number;
  errorRate: number;
  confidenceScore: number;
  responseQuality: number;
  requestsPerMinute: number;
  messagesPerMinute: number;
};

type MetricWindowSnapshot = {
  count: number;
  sums: MetricAccumulator;
};

type AgentMetricStore = {
  history: MetricDeque;
  latest: AgentMetrics | null;
  windows: Map<number, RollingMetricWindow>;
};

const createEmptyAccumulator = (): MetricAccumulator => ({
  executionTime: 0,
  latency: 0,
  memoryUsage: 0,
  cpuUsage: 0,
  successRate: 0,
  errorRate: 0,
  confidenceScore: 0,
  responseQuality: 0,
  requestsPerMinute: 0,
  messagesPerMinute: 0,
});

const addMetricToAccumulator = (accumulator: MetricAccumulator, metrics: AgentMetrics): void => {
  accumulator.executionTime += metrics.executionTime;
  accumulator.latency += metrics.latency;
  accumulator.memoryUsage += metrics.memoryUsage;
  accumulator.cpuUsage += metrics.cpuUsage;
  accumulator.successRate += metrics.successRate;
  accumulator.errorRate += metrics.errorRate;
  accumulator.confidenceScore += metrics.confidenceScore;
  accumulator.responseQuality += metrics.responseQuality;
  accumulator.requestsPerMinute += metrics.requestsPerMinute;
  accumulator.messagesPerMinute += metrics.messagesPerMinute;
};

const subtractMetricFromAccumulator = (accumulator: MetricAccumulator, metrics: AgentMetrics): void => {
  accumulator.executionTime -= metrics.executionTime;
  accumulator.latency -= metrics.latency;
  accumulator.memoryUsage -= metrics.memoryUsage;
  accumulator.cpuUsage -= metrics.cpuUsage;
  accumulator.successRate -= metrics.successRate;
  accumulator.errorRate -= metrics.errorRate;
  accumulator.confidenceScore -= metrics.confidenceScore;
  accumulator.responseQuality -= metrics.responseQuality;
  accumulator.requestsPerMinute -= metrics.requestsPerMinute;
  accumulator.messagesPerMinute -= metrics.messagesPerMinute;
};

class MetricDeque {
  private items: AgentMetrics[] = [];
  private startIndex = 0;

  get length(): number {
    return this.items.length - this.startIndex;
  }

  push(metrics: AgentMetrics): void {
    this.items.push(metrics);
  }

  peekFront(): AgentMetrics | undefined {
    return this.items[this.startIndex];
  }

  shift(): AgentMetrics | undefined {
    if (this.length === 0) {
      return undefined;
    }

    const item = this.items[this.startIndex];
    this.startIndex += 1;
    this.compact();
    return item;
  }

  trimBefore(cutoffTime: number, onRemove?: (metrics: AgentMetrics) => void): void {
    while (true) {
      const oldest = this.peekFront();
      if (!oldest || oldest.timestamp > cutoffTime) {
        break;
      }

      const removed = this.shift();
      if (removed) {
        onRemove?.(removed);
      }
    }
  }

  last(): AgentMetrics | undefined {
    return this.length > 0 ? this.items[this.items.length - 1] : undefined;
  }

  toArray(): AgentMetrics[] {
    return this.items.slice(this.startIndex);
  }

  filterSince(cutoffTime: number): AgentMetrics[] {
    const activeItems = this.toArray();
    return activeItems.filter((metrics) => metrics.timestamp > cutoffTime);
  }

  lastN(count: number): AgentMetrics[] {
    if (count <= 0 || this.length === 0) {
      return [];
    }

    const start = Math.max(this.startIndex, this.items.length - count);
    return this.items.slice(start);
  }

  private compact(): void {
    if (this.startIndex > 64 && this.startIndex * 2 >= this.items.length) {
      this.items = this.items.slice(this.startIndex);
      this.startIndex = 0;
    }
  }
}

class RollingMetricWindow {
  private readonly metrics = new MetricDeque();
  private readonly sums: MetricAccumulator = createEmptyAccumulator();

  constructor(private readonly windowMs: number) {}

  push(metrics: AgentMetrics): void {
    this.metrics.push(metrics);
    addMetricToAccumulator(this.sums, metrics);
    this.trim(metrics.timestamp - this.windowMs);
  }

  trim(cutoffTime: number): void {
    this.metrics.trimBefore(cutoffTime, (removedMetrics) => {
      subtractMetricFromAccumulator(this.sums, removedMetrics);
    });
  }

  snapshot(): MetricWindowSnapshot {
    return {
      count: this.metrics.length,
      sums: { ...this.sums },
    };
  }
}

// ============================================================================
// AgentPerformanceMonitor Implementation
// ============================================================================

export class AgentPerformanceMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private metricsHistory = new Map<string, AgentMetricStore>();
  private healthScores = new Map<string, AgentHealthScore>();
  private activeAlerts = new Map<string, PerformanceAlert>();
  private aggregationInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();

    this.config = {
      metricsRetentionPeriod: 24, // 24 hours
      metricsAggregationInterval: 60, // 1 minute
      healthCheckInterval: 30, // 30 seconds
      performanceThresholds: {
        maxLatency: 5000, // 5 seconds
        maxMemoryUsage: 512, // 512 MB
        minSuccessRate: 0.95, // 95%
        minConfidenceScore: 0.7, // 70%
      },
      alertThresholds: {
        latencyWarning: 2000, // 2 seconds
        latencyCritical: 5000, // 5 seconds
        errorRateWarning: 0.05, // 5%
        errorRateCritical: 0.15, // 15%
        memoryWarning: 256, // 256 MB
        memoryCritical: 512, // 512 MB
      },
      ...config,
    };

    this.startMonitoring();
  }

  /**
   * Record agent execution metrics
   */
  recordMetrics(metrics: Omit<AgentMetrics, "timestamp">): void {
    const timestampedMetrics: AgentMetrics = {
      ...metrics,
      timestamp: Date.now(),
    };

    const store = this.getOrCreateMetricStore(metrics.agentId);
    store.latest = timestampedMetrics;
    store.history.push(timestampedMetrics);
    store.history.trimBefore(timestampedMetrics.timestamp - this.getRetentionWindowMs());

    for (const windowMs of this.getActiveWindowDurations()) {
      this.getOrCreateWindow(store, windowMs).push(timestampedMetrics);
    }

    // Check for alerts
    this.checkAlerts(timestampedMetrics);

    // Emit metrics for external monitoring
    this.emit("metrics", timestampedMetrics);
  }

  /**
   * Get current health score for an agent
   */
  getHealthScore(agentId: string): AgentHealthScore | null {
    return this.healthScores.get(agentId) || null;
  }

  /**
   * Get metrics history for an agent
   */
  getMetricsHistory(agentId: string, timeRange?: number): AgentMetrics[] {
    const store = this.metricsHistory.get(agentId);

    if (!store) {
      return [];
    }

    this.trimStoreHistory(store, Date.now());

    if (!timeRange) {
      return store.history.toArray();
    }

    const cutoffTime = Date.now() - timeRange;
    return store.history.filterSince(cutoffTime);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(agentId?: string): PerformanceAlert[] {
    const alerts = Array.from(this.activeAlerts.values());

    if (agentId) {
      return alerts.filter((alert) => alert.agentId === agentId);
    }

    return alerts;
  }

  /**
   * Get aggregated metrics across all agents
   */
  getAggregatedMetrics(): {
    totalAgents: number;
    healthyAgents: number;
    averageLatency: number;
    averageMemoryUsage: number;
    totalRequestsPerMinute: number;
    activeAlerts: number;
  } {
    const agentIds = Array.from(this.metricsHistory.keys());
    const healthScores = Array.from(this.healthScores.values());
    const alerts = Array.from(this.activeAlerts.values());

    const healthyAgents = healthScores.filter((score) => score.isHealthy).length;

    let totalLatency = 0;
    let totalMemoryUsage = 0;
    let totalRequestsPerMinute = 0;
    let metricsCount = 0;

    for (const store of this.metricsHistory.values()) {
      const latest = store.latest;
      if (!latest) {
        continue;
      }

      totalLatency += latest.latency;
      totalMemoryUsage += latest.memoryUsage;
      totalRequestsPerMinute += latest.requestsPerMinute;
      metricsCount += 1;
    }

    return {
      totalAgents: agentIds.length,
      healthyAgents,
      averageLatency: metricsCount > 0 ? totalLatency / metricsCount : 0,
      averageMemoryUsage: metricsCount > 0 ? totalMemoryUsage / metricsCount : 0,
      totalRequestsPerMinute,
      activeAlerts: alerts.filter((alert) => !alert.resolved).length,
    };
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.timestamp = Date.now(); // Update resolution timestamp
      this.emit("alertResolved", alert);
    }
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.rebuildRollingWindows();

    // Restart monitoring with new config
    this.stopMonitoring();
    this.startMonitoring();
  }

  /**
   * Shutdown the monitor
   */
  shutdown(): void {
    this.stopMonitoring();
    this.removeAllListeners();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startMonitoring(): void {
    // Start metrics aggregation
    this.aggregationInterval = setInterval(() => {
      this.aggregateMetrics();
    }, this.config.metricsAggregationInterval * 1000);

    // Start health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval * 1000);

    logger.info("Agent performance monitoring started", {
      aggregationInterval: this.config.metricsAggregationInterval,
      healthCheckInterval: this.config.healthCheckInterval,
    });
  }

  private stopMonitoring(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    logger.info("Agent performance monitoring stopped");
  }

  private aggregateMetrics(): void {
    const now = Date.now();
    const aggregationWindowMs = this.getAggregationWindowMs();

    for (const [agentId, store] of this.metricsHistory.entries()) {
      this.trimStoreHistory(store, now);

      const aggregationWindow = this.getOrCreateWindow(store, aggregationWindowMs);
      aggregationWindow.trim(now - aggregationWindowMs);

      const recentSnapshot = aggregationWindow.snapshot();
      if (recentSnapshot.count === 0) {
        continue;
      }

      this.emit("aggregatedMetrics", {
        agentId,
        metrics: this.toAggregatedMetrics(recentSnapshot),
      });
    }
  }

  private calculateAggregatedMetrics(metrics: AgentMetrics[]): Partial<AgentMetrics> {
    const totals = createEmptyAccumulator();

    for (const metric of metrics) {
      addMetricToAccumulator(totals, metric);
    }

    return this.toAggregatedMetrics({ count: metrics.length, sums: totals });
  }

  private performHealthChecks(): void {
    const now = Date.now();
    const healthWindowMs = this.getHealthWindowMs();

    for (const [agentId, store] of this.metricsHistory.entries()) {
      this.trimStoreHistory(store, now);

      const latest = store.latest;
      if (!latest) {
        continue;
      }

      const healthWindow = this.getOrCreateWindow(store, healthWindowMs);
      healthWindow.trim(now - healthWindowMs);

      const recentSnapshot = healthWindow.snapshot();
      if (recentSnapshot.count === 0) {
        continue;
      }

      const healthScore = this.calculateHealthScore(
        agentId,
        latest,
        recentSnapshot,
        store.history.lastN(10)
      );

      this.healthScores.set(agentId, healthScore);
      this.emit("healthScore", healthScore);
    }
  }

  private calculateHealthScore(
    agentId: string,
    latest: AgentMetrics,
    recentMetrics: MetricWindowSnapshot,
    trendHistory: AgentMetrics[]
  ): AgentHealthScore {
    const thresholds = this.config.performanceThresholds;
    const averagedMetrics = this.toAggregatedMetrics(recentMetrics);
    const averageLatency = averagedMetrics.latency ?? latest.latency;
    const averageMemoryUsage = averagedMetrics.memoryUsage ?? latest.memoryUsage;
    const averageSuccessRate = averagedMetrics.successRate ?? latest.successRate;
    const averageErrorRate = averagedMetrics.errorRate ?? latest.errorRate;
    const averageConfidenceScore = averagedMetrics.confidenceScore ?? latest.confidenceScore;
    const averageResponseQuality = averagedMetrics.responseQuality ?? latest.responseQuality;

    // Performance score (0-100)
    const latencyScore = Math.max(0, 100 - (averageLatency / thresholds.maxLatency) * 100);
    const memoryScore = Math.max(0, 100 - (averageMemoryUsage / thresholds.maxMemoryUsage) * 100);
    const performanceScore = (latencyScore + memoryScore) / 2;

    // Reliability score (0-100)
    const reliabilityScore = averageSuccessRate * 100;

    // Quality score (0-100)
    const qualityScore = averageConfidenceScore * 50 + averageResponseQuality * 50;

    // Overall score
    const overallScore = performanceScore * 0.4 + reliabilityScore * 0.3 + qualityScore * 0.3;

    // Health status
    const isHealthy = overallScore >= 70 && averageErrorRate < 0.1;

    // Warnings and errors
    const warnings: string[] = [];
    const errors: string[] = [];

    if (averageLatency > thresholds.maxLatency) {
      errors.push(`High latency: ${latest.latency}ms`);
    } else if (averageLatency > thresholds.maxLatency * 0.7) {
      warnings.push(`Elevated latency: ${latest.latency}ms`);
    }

    if (averageMemoryUsage > thresholds.maxMemoryUsage) {
      errors.push(`High memory usage: ${latest.memoryUsage}MB`);
    } else if (averageMemoryUsage > thresholds.maxMemoryUsage * 0.7) {
      warnings.push(`Elevated memory usage: ${latest.memoryUsage}MB`);
    }

    if (averageSuccessRate < thresholds.minSuccessRate) {
      errors.push(`Low success rate: ${(latest.successRate * 100).toFixed(1)}%`);
    }

    // Trend analysis
    const trend = this.calculateTrend(trendHistory);

    return {
      agentId,
      overallScore,
      performanceScore,
      reliabilityScore,
      qualityScore,
      isHealthy,
      warnings,
      errors,
      trendDirection: trend.direction,
      trendPercentage: trend.percentage,
      timestamp: Date.now(),
    };
  }

  private calculateTrend(history: AgentMetrics[]): {
    direction: "improving" | "stable" | "degrading";
    percentage: number;
  } {
    if (history.length < 10) {
      return { direction: "stable", percentage: 0 };
    }

    const recent = history.slice(-5);
    const older = history.slice(-10, -5);

    const recentAvg = recent.reduce((sum, m) => sum + m.successRate, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.successRate, 0) / older.length;

    const change = olderAvg === 0 ? 0 : ((recentAvg - olderAvg) / olderAvg) * 100;

    let direction: "improving" | "stable" | "degrading";
    if (Math.abs(change) < 5) {
      direction = "stable";
    } else if (change > 0) {
      direction = "improving";
    } else {
      direction = "degrading";
    }

    return { direction, percentage: change };
  }

  private checkAlerts(metrics: AgentMetrics): void {
    const thresholds = this.config.alertThresholds;

    // Latency alerts
    if (metrics.latency > thresholds.latencyCritical) {
      this.createAlert(
        metrics.agentId,
        "critical",
        "performance",
        `Critical latency: ${metrics.latency}ms`,
        metrics.latency,
        thresholds.latencyCritical
      );
    } else if (metrics.latency > thresholds.latencyWarning) {
      this.createAlert(
        metrics.agentId,
        "medium",
        "performance",
        `High latency: ${metrics.latency}ms`,
        metrics.latency,
        thresholds.latencyWarning
      );
    }

    // Error rate alerts
    if (metrics.errorRate > thresholds.errorRateCritical) {
      this.createAlert(
        metrics.agentId,
        "critical",
        "reliability",
        `Critical error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
        metrics.errorRate,
        thresholds.errorRateCritical
      );
    } else if (metrics.errorRate > thresholds.errorRateWarning) {
      this.createAlert(
        metrics.agentId,
        "medium",
        "reliability",
        `High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
        metrics.errorRate,
        thresholds.errorRateWarning
      );
    }

    // Memory alerts
    if (metrics.memoryUsage > thresholds.memoryCritical) {
      this.createAlert(
        metrics.agentId,
        "critical",
        "resource",
        `Critical memory usage: ${metrics.memoryUsage}MB`,
        metrics.memoryUsage,
        thresholds.memoryCritical
      );
    } else if (metrics.memoryUsage > thresholds.memoryWarning) {
      this.createAlert(
        metrics.agentId,
        "medium",
        "resource",
        `High memory usage: ${metrics.memoryUsage}MB`,
        metrics.memoryUsage,
        thresholds.memoryWarning
      );
    }
  }

  private createAlert(
    agentId: string,
    severity: "low" | "medium" | "high" | "critical",
    type: "performance" | "reliability" | "quality" | "resource",
    message: string,
    currentValue: number,
    threshold: number
  ): void {
    const alertId = `${agentId}-${type}-${Date.now()}`;

    const alert: PerformanceAlert = {
      id: alertId,
      agentId,
      severity,
      type,
      message,
      currentValue,
      threshold,
      timestamp: Date.now(),
      resolved: false,
    };

    this.activeAlerts.set(alertId, alert);
    this.emit("alert", alert);

    logger.warn("Agent performance alert", {
      alertId,
      agentId,
      severity,
      type,
      message,
      currentValue,
      threshold,
    });
  }

  private getOrCreateMetricStore(agentId: string): AgentMetricStore {
    const existingStore = this.metricsHistory.get(agentId);
    if (existingStore) {
      return existingStore;
    }

    const store: AgentMetricStore = {
      history: new MetricDeque(),
      latest: null,
      windows: new Map<number, RollingMetricWindow>(),
    };

    this.metricsHistory.set(agentId, store);
    return store;
  }

  private getOrCreateWindow(store: AgentMetricStore, windowMs: number): RollingMetricWindow {
    const existingWindow = store.windows.get(windowMs);
    if (existingWindow) {
      return existingWindow;
    }

    const window = new RollingMetricWindow(windowMs);
    for (const metric of store.history.toArray()) {
      window.push(metric);
    }

    store.windows.set(windowMs, window);
    return window;
  }

  private getRetentionWindowMs(): number {
    return this.config.metricsRetentionPeriod * 60 * 60 * 1000;
  }

  private getAggregationWindowMs(): number {
    return Math.min(this.config.metricsAggregationInterval * 1000, this.getRetentionWindowMs());
  }

  private getHealthWindowMs(): number {
    return Math.min(this.config.healthCheckInterval * 1000, this.getRetentionWindowMs());
  }

  private getActiveWindowDurations(): number[] {
    return Array.from(new Set([this.getAggregationWindowMs(), this.getHealthWindowMs()]));
  }

  private trimStoreHistory(store: AgentMetricStore, now: number): void {
    store.history.trimBefore(now - this.getRetentionWindowMs());
  }

  private rebuildRollingWindows(): void {
    const activeWindowDurations = this.getActiveWindowDurations();
    const now = Date.now();

    for (const store of this.metricsHistory.values()) {
      this.trimStoreHistory(store, now);
      store.windows = new Map<number, RollingMetricWindow>();

      for (const windowMs of activeWindowDurations) {
        const window = new RollingMetricWindow(windowMs);
        for (const metric of store.history.toArray()) {
          window.push(metric);
        }
        store.windows.set(windowMs, window);
      }
    }
  }

  private toAggregatedMetrics(snapshot: MetricWindowSnapshot): Partial<AgentMetrics> {
    if (snapshot.count === 0) {
      return {};
    }

    return {
      executionTime: snapshot.sums.executionTime / snapshot.count,
      latency: snapshot.sums.latency / snapshot.count,
      memoryUsage: snapshot.sums.memoryUsage / snapshot.count,
      cpuUsage: snapshot.sums.cpuUsage / snapshot.count,
      successRate: snapshot.sums.successRate / snapshot.count,
      errorRate: snapshot.sums.errorRate / snapshot.count,
      confidenceScore: snapshot.sums.confidenceScore / snapshot.count,
      responseQuality: snapshot.sums.responseQuality / snapshot.count,
      requestsPerMinute: snapshot.sums.requestsPerMinute,
      messagesPerMinute: snapshot.sums.messagesPerMinute,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let performanceMonitorInstance: AgentPerformanceMonitor | null = null;

export function getAgentPerformanceMonitor(
  config?: Partial<MonitoringConfig>
): AgentPerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new AgentPerformanceMonitor(config);
  }
  return performanceMonitorInstance;
}
