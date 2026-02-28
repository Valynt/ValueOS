/**
 * Agent Performance Monitor
 *
 * Comprehensive monitoring system for agent performance, health scoring,
 * and real-time metrics collection with alerting capabilities.
 */

import { EventEmitter } from "events";

import { logger } from "../../lib/logger";

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

// ============================================================================
// AgentPerformanceMonitor Implementation
// ============================================================================

export class AgentPerformanceMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private metricsHistory = new Map<string, AgentMetrics[]>();
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

    // Store metrics history
    const history = this.metricsHistory.get(metrics.agentId) || [];
    history.push(timestampedMetrics);

    // Trim old metrics based on retention period
    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod * 60 * 60 * 1000;
    const filteredHistory = history.filter((m) => m.timestamp > cutoffTime);

    this.metricsHistory.set(metrics.agentId, filteredHistory);

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
    const history = this.metricsHistory.get(agentId) || [];

    if (!timeRange) {
      return history;
    }

    const cutoffTime = Date.now() - timeRange;
    return history.filter((m) => m.timestamp > cutoffTime);
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

    for (const history of this.metricsHistory.values()) {
      if (history.length > 0) {
        const latest = history[history.length - 1];
        if (latest) {
          totalLatency += latest.latency;
          totalMemoryUsage += latest.memoryUsage;
          totalRequestsPerMinute += latest.requestsPerMinute;
          metricsCount++;
        }
      }
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
    for (const [agentId, history] of this.metricsHistory.entries()) {
      if (history.length === 0) continue;

      // Calculate aggregated metrics for the last interval
      const cutoffTime = Date.now() - this.config.metricsAggregationInterval * 1000;
      const recentMetrics = history.filter((m) => m.timestamp > cutoffTime);

      if (recentMetrics.length > 0) {
        const aggregated = this.calculateAggregatedMetrics(recentMetrics);
        this.emit("aggregatedMetrics", { agentId, metrics: aggregated });
      }
    }
  }

  private calculateAggregatedMetrics(metrics: AgentMetrics[]): Partial<AgentMetrics> {
    const count = metrics.length;

    return {
      executionTime: metrics.reduce((sum, m) => sum + m.executionTime, 0) / count,
      latency: metrics.reduce((sum, m) => sum + m.latency, 0) / count,
      memoryUsage: metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / count,
      successRate: metrics.reduce((sum, m) => sum + m.successRate, 0) / count,
      errorRate: metrics.reduce((sum, m) => sum + m.errorRate, 0) / count,
      confidenceScore: metrics.reduce((sum, m) => sum + m.confidenceScore, 0) / count,
      requestsPerMinute: metrics.reduce((sum, m) => sum + m.requestsPerMinute, 0),
      messagesPerMinute: metrics.reduce((sum, m) => sum + m.messagesPerMinute, 0),
    };
  }

  private performHealthChecks(): void {
    for (const [agentId, history] of this.metricsHistory.entries()) {
      if (history.length === 0) continue;

      const latest = history[history.length - 1];
      if (!latest) continue;

      const healthScore = this.calculateHealthScore(agentId, latest, history);

      this.healthScores.set(agentId, healthScore);
      this.emit("healthScore", healthScore);
    }
  }

  private calculateHealthScore(
    agentId: string,
    latest: AgentMetrics,
    history: AgentMetrics[]
  ): AgentHealthScore {
    const thresholds = this.config.performanceThresholds;

    // Performance score (0-100)
    const latencyScore = Math.max(0, 100 - (latest.latency / thresholds.maxLatency) * 100);
    const memoryScore = Math.max(0, 100 - (latest.memoryUsage / thresholds.maxMemoryUsage) * 100);
    const performanceScore = (latencyScore + memoryScore) / 2;

    // Reliability score (0-100)
    const reliabilityScore = latest.successRate * 100;

    // Quality score (0-100)
    const qualityScore = latest.confidenceScore * 50 + latest.responseQuality * 50;

    // Overall score
    const overallScore = performanceScore * 0.4 + reliabilityScore * 0.3 + qualityScore * 0.3;

    // Health status
    const isHealthy = overallScore >= 70 && latest.errorRate < 0.1;

    // Warnings and errors
    const warnings: string[] = [];
    const errors: string[] = [];

    if (latest.latency > thresholds.maxLatency) {
      errors.push(`High latency: ${latest.latency}ms`);
    } else if (latest.latency > thresholds.maxLatency * 0.7) {
      warnings.push(`Elevated latency: ${latest.latency}ms`);
    }

    if (latest.memoryUsage > thresholds.maxMemoryUsage) {
      errors.push(`High memory usage: ${latest.memoryUsage}MB`);
    } else if (latest.memoryUsage > thresholds.maxMemoryUsage * 0.7) {
      warnings.push(`Elevated memory usage: ${latest.memoryUsage}MB`);
    }

    if (latest.successRate < thresholds.minSuccessRate) {
      errors.push(`Low success rate: ${(latest.successRate * 100).toFixed(1)}%`);
    }

    // Trend analysis
    const trend = this.calculateTrend(history);

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

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

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
