/**
 * Circuit Breaker Monitoring and Metrics System
 *
 * Provides comprehensive monitoring for all circuit breakers:
 * - Real-time metrics collection
 * - Health status aggregation
 * - Performance analytics
 * - Alerting integration
 * - Dashboard data provider
 */

import { logger } from "../logger";
import { analyticsClient } from "../analyticsClient";
import { HttpClientFactory } from "./HttpClientWithCircuitBreaker";
import {
  circuitBreakerStateChanges,
  circuitBreakerHealthScore,
  circuitBreakerFailureRate,
  circuitBreakerResponseTime,
  systemHealthStatus,
  serviceHealthStatus,
  circuitBreakerAlerts,
} from "../monitoring/metrics";

export interface CircuitBreakerMetrics {
  serviceName: string;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  successCount: number;
  totalRequests: number;
  failureRate: number;
  averageResponseTime: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  uptime: number;
  healthScore: number;
}

export interface SystemHealthStatus {
  overall: "healthy" | "degraded" | "unhealthy";
  services: CircuitBreakerMetrics[];
  summary: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    overallFailureRate: number;
    averageResponseTime: number;
  };
  timestamp: Date;
}

export interface AlertConfig {
  failureRateThreshold: number;
  responseTimeThreshold: number;
  consecutiveFailuresThreshold: number;
  serviceDownThreshold: number;
  alertCooldownMs: number; // Minimum time between alerts of same type
  maxAlertsPerHour: number; // Rate limiting for alerts
  enableEscalation: boolean; // Enable alert escalation
  escalationThreshold: number; // Minutes before escalating alerts
  recoveryIntervalMs: number; // Interval for monitoring/recovery cycles
}

export interface AlertRule {
  name: string;
  condition: (systemHealth: SystemHealthStatus) => boolean;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  cooldownMs: number;
  enabled: boolean;
}

export interface PerformanceConfig {
  enableSampling: boolean;
  samplingRate: number; // 0.0-1.0, where 1.0 = 100% sampling
  healthCheckSamplingRate: number; // Health checks are expensive, sample less frequently
  maxMetricsPerService: number; // Limit metrics history per service
  cleanupIntervalMs: number; // How often to run cleanup
  enableCompression: boolean; // Compress old metrics
}

/**
 * Circuit Breaker Monitor
 */
export class CircuitBreakerMonitor {
  private metricsHistory: Map<string, CircuitBreakerMetrics[]> = new Map();
  private alertConfig: AlertConfig = {
    failureRateThreshold: 0.5, // 50%
    responseTimeThreshold: 5000, // 5 seconds
    consecutiveFailuresThreshold: 5,
    serviceDownThreshold: 0.8, // 80% of services down
    alertCooldownMs: 300000, // 5 minutes
    maxAlertsPerHour: 10,
    enableEscalation: true,
    escalationThreshold: 15, // 15 minutes
    recoveryIntervalMs: 30000, // 30 seconds
  };
  private alertHistory: Map<string, { lastTriggered: number; count: number }> =
    new Map();
  private activeAlerts: Map<string, { triggered: number; severity: string }> =
    new Map();

  private performanceConfig: PerformanceConfig = {
    enableSampling: true,
    samplingRate: 0.8, // Sample 80% of operations
    healthCheckSamplingRate: 0.5, // Sample 50% of health checks (expensive)
    maxMetricsPerService: 1000, // Keep max 1000 metrics per service
    cleanupIntervalMs: 300000, // Cleanup every 5 minutes
    enableCompression: true,
  };

  private monitoringInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Main monitoring interval
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.checkAlerts();
        this.cleanupOldMetrics();
      } catch (error) {
        logger.error("Monitoring cycle failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.alertConfig.recoveryIntervalMs);

    // Separate cleanup interval for performance
    this.cleanupInterval = setInterval(() => {
      try {
        this.performDeepCleanup();
      } catch (error) {
        logger.error("Deep cleanup failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.performanceConfig.cleanupIntervalMs);

    logger.info("Circuit breaker monitoring started", {
      monitoringInterval: this.alertConfig.recoveryIntervalMs,
      cleanupInterval: this.performanceConfig.cleanupIntervalMs,
      samplingEnabled: this.performanceConfig.enableSampling,
      samplingRate: this.performanceConfig.samplingRate,
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isMonitoring = false;
    logger.info("Circuit breaker monitoring stopped");
  }

  /**
   * Collect metrics from all circuit breakers
   */
  private async collectMetrics(): Promise<void> {
    try {
      const clients = HttpClientFactory.getAllClients();
      const metrics: CircuitBreakerMetrics[] = [];

      for (const [serviceName, client] of clients) {
        const status = client.getCircuitBreakerStatus();

        // Apply sampling to reduce load
        const shouldSample =
          !this.performanceConfig.enableSampling ||
          Math.random() < this.performanceConfig.samplingRate;

        if (!shouldSample) {
          // Still collect basic metrics without expensive health checks
          const basicMetric: CircuitBreakerMetrics = {
            serviceName,
            state: status.state,
            failureCount: status.failureCount || 0,
            successCount: this.calculateSuccessCount(serviceName),
            totalRequests: this.calculateTotalRequests(serviceName),
            failureRate: this.calculateFailureRate(serviceName),
            averageResponseTime: this.calculateAverageResponseTime(serviceName),
            lastFailureTime: status.lastFailureTime,
            lastSuccessTime: this.calculateLastSuccessTime(serviceName),
            uptime: this.calculateUptime(serviceName),
            healthScore: this.calculateHealthScore(status, true), // Assume healthy when not checking
          };
          metrics.push(basicMetric);
          this.updateMetricsHistory(serviceName, basicMetric);
          continue;
        }

        // Full collection with health checks (sampled)
        const shouldHealthCheck =
          Math.random() < this.performanceConfig.healthCheckSamplingRate;
        const healthStatus = shouldHealthCheck
          ? await client.getHealthStatus()
          : {
              healthy: true,
              circuitBreaker: status,
              lastChecked: new Date().toISOString(),
            };

        const metric: CircuitBreakerMetrics = {
          serviceName,
          state: status.state,
          failureCount: status.failureCount || 0,
          successCount: this.calculateSuccessCount(serviceName),
          totalRequests: this.calculateTotalRequests(serviceName),
          failureRate: this.calculateFailureRate(serviceName),
          averageResponseTime: this.calculateAverageResponseTime(serviceName),
          lastFailureTime: status.lastFailureTime,
          lastSuccessTime: this.calculateLastSuccessTime(serviceName),
          uptime: this.calculateUptime(serviceName),
          healthScore: this.calculateHealthScore(status, healthStatus.healthy),
        };

        // Record metrics for dashboard integration (only for sampled metrics)
        circuitBreakerHealthScore.set(
          { service: serviceName },
          metric.healthScore
        );
        circuitBreakerFailureRate.set(
          { service: serviceName },
          metric.failureRate
        );

        if (healthStatus.healthy) {
          serviceHealthStatus.set({ service: serviceName }, 0); // healthy
        } else if (metric.healthScore >= 0.5) {
          serviceHealthStatus.set({ service: serviceName }, 1); // degraded
        } else {
          serviceHealthStatus.set({ service: serviceName }, 2); // unhealthy
        }

        metrics.push(metric);
        this.updateMetricsHistory(serviceName, metric);
      }

      // Send metrics to analytics (sampled)
      if (Math.random() < this.performanceConfig.samplingRate) {
        analyticsClient.track("circuit_breaker_metrics", {
          services: metrics,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error(
        "Failed to collect circuit breaker metrics",
        error instanceof Error ? error : new Error("Unknown error")
      );
    }
  }

  /**
   * Check for alert conditions
   */
  private async checkAlerts(): Promise<void> {
    const systemHealth = await this.getSystemHealthStatus();
    const { summary } = systemHealth;

    // Check overall system health
    if (summary.overallFailureRate > this.alertConfig.failureRateThreshold) {
      this.triggerAlert(
        "HIGH_FAILURE_RATE",
        {
          failureRate: summary.overallFailureRate,
          threshold: this.alertConfig.failureRateThreshold,
        },
        "high"
      );
    }

    if (summary.averageResponseTime > this.alertConfig.responseTimeThreshold) {
      this.triggerAlert(
        "HIGH_RESPONSE_TIME",
        {
          responseTime: summary.averageResponseTime,
          threshold: this.alertConfig.responseTimeThreshold,
        },
        "medium"
      );
    }

    if (summary.unhealthyServices > 0) {
      const severity =
        summary.unhealthyServices > summary.totalServices * 0.5
          ? "critical"
          : "high";
      this.triggerAlert(
        "SERVICES_UNHEALTHY",
        {
          unhealthyServices: summary.unhealthyServices,
          totalServices: summary.totalServices,
        },
        severity
      );
    }

    // Check individual services
    for (const service of systemHealth.services) {
      if (service.failureRate > this.alertConfig.failureRateThreshold) {
        this.triggerAlert(
          "SERVICE_HIGH_FAILURE_RATE",
          {
            serviceName: service.serviceName,
            failureRate: service.failureRate,
          },
          "medium"
        );
      }

      if (
        service.averageResponseTime > this.alertConfig.responseTimeThreshold
      ) {
        this.triggerAlert(
          "SERVICE_HIGH_RESPONSE_TIME",
          {
            serviceName: service.serviceName,
            responseTime: service.averageResponseTime,
          },
          "low"
        );
      }

      if (service.state === "OPEN") {
        this.triggerAlert(
          "SERVICE_CIRCUIT_OPEN",
          {
            serviceName: service.serviceName,
            failureCount: service.failureCount,
          },
          "high"
        );
      }
    }
  }

  /**
   * Trigger alert with enhanced logic
   */
  private triggerAlert(
    alertType: string,
    data: any,
    severity: "low" | "medium" | "high" | "critical" = "medium"
  ): void {
    const now = Date.now();
    const alertKey = `${alertType}:${JSON.stringify(data)}`;
    const historyKey = alertType;

    // Check cooldown
    const lastTriggered = this.alertHistory.get(historyKey)?.lastTriggered || 0;
    if (now - lastTriggered < this.alertConfig.alertCooldownMs) {
      return; // Skip alert due to cooldown
    }

    // Check rate limiting (alerts per hour)
    const hourAgo = now - 60 * 60 * 1000;
    const recentAlerts = Array.from(this.alertHistory.values()).filter(
      (entry) => entry.lastTriggered > hourAgo
    ).length;

    if (recentAlerts >= this.alertConfig.maxAlertsPerHour) {
      logger.warn("Alert rate limit exceeded, skipping alert", {
        alertType,
        recentAlerts,
        limit: this.alertConfig.maxAlertsPerHour,
      });
      return;
    }

    // Check for escalation
    const activeAlert = this.activeAlerts.get(alertKey);
    if (activeAlert && this.alertConfig.enableEscalation) {
      const alertAge = (now - activeAlert.triggered) / (1000 * 60); // minutes
      if (alertAge >= this.alertConfig.escalationThreshold) {
        severity =
          severity === "critical"
            ? "critical"
            : severity === "high"
              ? "critical"
              : "high";
        logger.warn("Alert escalated due to age", {
          alertType,
          originalSeverity: activeAlert.severity,
          newSeverity: severity,
          ageMinutes: alertAge,
        });
      }
    }

    // Update alert history
    const historyEntry = this.alertHistory.get(historyKey) || {
      lastTriggered: 0,
      count: 0,
    };
    historyEntry.lastTriggered = now;
    historyEntry.count++;
    this.alertHistory.set(historyKey, historyEntry);

    // Track active alert
    this.activeAlerts.set(alertKey, { triggered: now, severity });

    // Record alert metric for dashboard
    circuitBreakerAlerts.inc({
      type: alertType,
      severity,
      service: data.serviceName || "system",
    });

    logger.warn("Circuit breaker alert triggered", {
      alertType,
      severity,
      data,
      timestamp: new Date().toISOString(),
    });

    analyticsClient.track("circuit_breaker_alert", {
      alertType,
      severity,
      data,
      timestamp: new Date().toISOString(),
    });

    // Here you could integrate with external alerting systems
    // like PagerDuty, Slack, email, etc.
    this.sendExternalAlert(alertType, severity, data);
  }

  /**
   * Send alert to external systems
   */
  private sendExternalAlert(
    alertType: string,
    severity: string,
    data: any
  ): void {
    // Placeholder for external alerting integration
    // This could send to PagerDuty, Slack, email, etc.
    logger.info("External alert sent", { alertType, severity, data });
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealthStatus(): Promise<SystemHealthStatus> {
    const clients = HttpClientFactory.getAllClients();
    const services: CircuitBreakerMetrics[] = [];

    let totalRequests = 0;
    let totalFailures = 0;
    let totalResponseTime = 0;
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    // Check health for all services concurrently
    const healthChecks = await Promise.allSettled(
      Array.from(clients.entries()).map(async ([serviceName, client]) => {
        try {
          const healthStatus = await client.getHealthStatus();
          return { serviceName, healthStatus };
        } catch (error) {
          // If health check fails, consider service unhealthy
          return {
            serviceName,
            healthStatus: {
              service: serviceName,
              healthy: false,
              circuitBreaker: client.getCircuitBreakerStatus(),
              lastChecked: new Date().toISOString(),
              // error: error instanceof Error ? error.message : "Unknown error", // Removed invalid property
            },
          };
        }
      })
    );

    // Process results
    const healthStatusMap = new Map(
      healthChecks.map((result) =>
        result.status === "fulfilled"
          ? [result.value.serviceName, result.value.healthStatus]
          : [
              result.reason,
              {
                service: result.reason,
                healthy: false,
                lastChecked: new Date().toISOString(),
              },
            ]
      )
    );

    for (const [serviceName, client] of clients) {
      const status = client.getCircuitBreakerStatus();
      const healthStatus = healthStatusMap.get(serviceName);

      const metric: CircuitBreakerMetrics = {
        serviceName,
        state: status.state,
        failureCount: status.failureCount || 0,
        successCount: this.calculateSuccessCount(serviceName),
        totalRequests: this.calculateTotalRequests(serviceName),
        failureRate: this.calculateFailureRate(serviceName),
        averageResponseTime: this.calculateAverageResponseTime(serviceName),
        lastFailureTime: status.lastFailureTime,
        lastSuccessTime: this.calculateLastSuccessTime(serviceName),
        uptime: this.calculateUptime(serviceName),
        healthScore: this.calculateHealthScore(
          status,
          healthStatus?.healthy ?? false
        ),
      };

      services.push(metric);

      // Aggregate metrics
      totalRequests += metric.totalRequests;
      totalFailures += metric.failureCount;
      totalResponseTime += metric.averageResponseTime;

      // Count health status
      if (metric.healthScore >= 0.8) {
        healthyCount++;
      } else if (metric.healthScore >= 0.5) {
        degradedCount++;
      } else {
        unhealthyCount++;
      }
    }

    const overallFailureRate =
      totalRequests > 0 ? totalFailures / totalRequests : 0;
    const averageResponseTime =
      services.length > 0 ? totalResponseTime / services.length : 0;

    // Determine overall system health
    let overall: "healthy" | "degraded" | "unhealthy";
    let statusValue: number;
    if (unhealthyCount === 0 && degradedCount === 0) {
      overall = "healthy";
      statusValue = 0;
    } else if (
      services.length > 0 &&
      unhealthyCount / services.length < this.alertConfig.serviceDownThreshold
    ) {
      overall = "degraded";
      statusValue = 1;
    } else {
      overall = "unhealthy";
      statusValue = 2;
    }

    // Record system health status metric
    systemHealthStatus.set(statusValue);

    return {
      overall,
      services,
      summary: {
        totalServices: services.length,
        healthyServices: healthyCount,
        degradedServices: degradedCount,
        unhealthyServices: unhealthyCount,
        overallFailureRate,
        averageResponseTime,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get metrics history for a service
   */
  getMetricsHistory(
    serviceName: string,
    limit: number = 100
  ): CircuitBreakerMetrics[] {
    const history = this.metricsHistory.get(serviceName) || [];
    return history.slice(-limit);
  }

  /**
   * Get service performance trends
   */
  getPerformanceTrends(
    serviceName: string,
    hours: number = 24
  ): {
    failureRateTrend: number[];
    responseTimeTrend: number[];
    timestamps: Date[];
  } {
    const history = this.getMetricsHistory(serviceName);
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const filteredHistory = history.filter(
      (m) => m.lastFailureTime && m.lastFailureTime > cutoffTime
    );

    return {
      failureRateTrend: filteredHistory.map((m) => m.failureRate),
      responseTimeTrend: filteredHistory.map((m) => m.averageResponseTime),
      timestamps: filteredHistory.map((m) => m.lastFailureTime || new Date()),
    };
  }

  /**
   * Update metrics history
   */
  private updateMetricsHistory(
    serviceName: string,
    metric: CircuitBreakerMetrics
  ): void {
    if (!this.metricsHistory.has(serviceName)) {
      this.metricsHistory.set(serviceName, []);
    }

    const history = this.metricsHistory.get(serviceName)!;
    history.push(metric);

    // Keep only last 1000 entries per service
    if (history.length > 1000) {
      this.metricsHistory.set(serviceName, history.slice(-1000));
    }
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

    for (const [serviceName, history] of this.metricsHistory) {
      const filteredHistory = history.filter(
        (m) => (m.lastFailureTime?.getTime() || 0) > cutoffTime
      );

      if (filteredHistory.length !== history.length) {
        this.metricsHistory.set(serviceName, filteredHistory);
      }
    }
  }

  /**
   * Perform deep cleanup with compression and memory optimization
   */
  private performDeepCleanup(): void {
    const now = Date.now();
    let totalMetricsBefore = 0;
    let totalMetricsAfter = 0;

    for (const [serviceName, history] of this.metricsHistory) {
      totalMetricsBefore += history.length;

      // Limit metrics per service
      if (history.length > this.performanceConfig.maxMetricsPerService) {
        const limitedHistory = history.slice(
          -this.performanceConfig.maxMetricsPerService
        );
        this.metricsHistory.set(serviceName, limitedHistory);
      }

      // Compress old metrics (keep only essential data for old entries)
      const compressedHistory = history.map((metric, index) => {
        // Compress metrics older than 1 day, keep recent ones detailed
        const isOldMetric = index < history.length - 100; // Keep last 100 detailed
        if (isOldMetric && this.performanceConfig.enableCompression) {
          return {
            ...metric,
            // Remove detailed timing data for old metrics to save memory
            lastSuccessTime: undefined,
            lastFailureTime: metric.lastFailureTime, // Keep failure time for trends
          };
        }
        return metric;
      });

      this.metricsHistory.set(serviceName, compressedHistory);
      totalMetricsAfter += compressedHistory.length;
    }

    // Clean up old alert history
    const alertCutoffTime = now - 24 * 60 * 60 * 1000; // 24 hours ago
    for (const [alertKey, history] of this.alertHistory) {
      if (history.lastTriggered < alertCutoffTime) {
        this.alertHistory.delete(alertKey);
      }
    }

    // Clean up resolved active alerts older than 1 hour
    const activeAlertCutoff = now - 60 * 60 * 1000; // 1 hour ago
    for (const [alertKey, alert] of this.activeAlerts) {
      if (alert.triggered < activeAlertCutoff) {
        this.activeAlerts.delete(alertKey);
      }
    }

    if (totalMetricsBefore !== totalMetricsAfter) {
      logger.info("Deep cleanup completed", {
        servicesProcessed: this.metricsHistory.size,
        totalMetricsBefore,
        totalMetricsAfter,
        reductionPercent: (
          ((totalMetricsBefore - totalMetricsAfter) / totalMetricsBefore) *
          100
        ).toFixed(1),
      });
    }
  }

  // Helper methods for metric calculations
  private calculateSuccessCount(serviceName: string): number {
    const history = this.getMetricsHistory(serviceName, 10); // Get last 10 metrics
    if (history.length === 0) return 0;

    // Use the most recent metric's success count, or calculate from total - failures
    const latest = history[0];
    if (latest.successCount !== undefined) {
      return latest.successCount;
    }

    // Fallback: calculate from total requests and failure rate
    const totalRequests = latest.totalRequests || 0;
    const failureRate = latest.failureRate || 0;
    return Math.max(0, totalRequests - Math.floor(totalRequests * failureRate));
  }

  private calculateTotalRequests(serviceName: string): number {
    const history = this.getMetricsHistory(serviceName, 1);
    return history.length > 0 ? history[0].totalRequests || 0 : 0;
  }

  private calculateFailureRate(serviceName: string): number {
    const history = this.getMetricsHistory(serviceName, 1);
    return history.length > 0 ? history[0].failureRate || 0 : 0;
  }

  private calculateAverageResponseTime(serviceName: string): number {
    const history = this.getMetricsHistory(serviceName, 10); // Use recent history for averaging
    if (history.length === 0) return 0;

    const validLatencies = history
      .map((m) => m.averageResponseTime)
      .filter((latency) => latency !== undefined && latency > 0);

    if (validLatencies.length === 0) return 0;

    return (
      validLatencies.reduce((sum, latency) => sum + latency, 0) /
      validLatencies.length
    );
  }

  private calculateLastSuccessTime(serviceName: string): Date | undefined {
    const history = this.getMetricsHistory(serviceName, 50); // Look back further for success time
    const latestSuccess = history.find((m) => m.lastSuccessTime);
    return latestSuccess?.lastSuccessTime;
  }

  private calculateUptime(serviceName: string): number {
    const history = this.getMetricsHistory(serviceName, 100); // Use longer history for uptime
    if (history.length === 0) return 100;

    // Count how many metrics show healthy state (closed or half-open)
    const healthyStates = history.filter(
      (m) => m.state === "CLOSED" || m.state === "HALF_OPEN"
    ).length;

    return history.length > 0 ? (healthyStates / history.length) * 100 : 100;
  }

  private calculateHealthScore(status: any, isHealthy: boolean): number {
    let score = 1.0;

    if (status.state === "OPEN") {
      score = 0.0;
    } else if (status.state === "HALF_OPEN") {
      score = 0.5;
    }

    if (!isHealthy) {
      score *= 0.5;
    }

    const failureRate = this.calculateFailureRate(status);
    score *= 1 - failureRate;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Export metrics for external monitoring systems
   */
  async exportMetrics(): Promise<{
    timestamp: Date;
    systemHealth: SystemHealthStatus;
    individualServices: Record<string, CircuitBreakerMetrics>;
  }> {
    return {
      timestamp: new Date(),
      systemHealth: await this.getSystemHealthStatus(),
      individualServices: Object.fromEntries(
        Array.from(HttpClientFactory.getAllClients()).map(([name]) => [
          name,
          this.getMetricsHistory(name, 1)[0] || null,
        ])
      ),
    };
  }

  /**
   * Reset all monitoring data
   */
  reset(): void {
    this.metricsHistory.clear();
    logger.info("Circuit breaker monitor reset");
  }
}

/**
 * Global circuit breaker monitor instance
 */
export const circuitBreakerMonitor = new CircuitBreakerMonitor();

/**
 * Express middleware for circuit breaker health endpoint
 */
export function circuitBreakerHealthMiddleware() {
  return async (req: any, res: any) => {
    try {
      const health = await circuitBreakerMonitor.getSystemHealthStatus();
      const statusCode =
        health.overall === "healthy"
          ? 200
          : health.overall === "degraded"
            ? 200
            : 503;

      res.status(statusCode).json({
        service: "circuit-breaker-monitor",
        status: health.overall,
        timestamp: health.timestamp,
        details: health,
      });
    } catch (error) {
      res.status(503).json({
        service: "circuit-breaker-monitor",
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}
