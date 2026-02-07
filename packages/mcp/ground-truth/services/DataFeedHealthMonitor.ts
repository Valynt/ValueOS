/**
 * Data Feed Health Monitor
 *
 * Monitors the health, performance, and reliability of live data feeds from SEC, BLS, and Census APIs.
 * Provides alerting, metrics collection, and automated remediation.
 */

import { logger } from "../lib/logger.js";
import { LiveDataFeedService } from "./LiveDataFeedService.js";

export interface DataFeedHealthStatus {
  feedName: string;
  status: "healthy" | "degraded" | "unhealthy" | "offline";
  lastSuccessfulFetch: string | null;
  consecutiveFailures: number;
  averageResponseTime: number;
  errorRate: number;
  dataFreshness: "fresh" | "stale" | "outdated" | "unknown";
  lastChecked: string;
  alerts: DataFeedAlert[];
}

export interface DataFeedAlert {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  autoRemediation?: {
    action: string;
    executedAt: string;
    success: boolean;
  };
}

export interface DataFeedMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptimePercentage: number;
  dataQualityScore: number;
  cacheHitRate: number;
}

export class DataFeedHealthMonitor {
  private dataFeedService: LiveDataFeedService;
  private healthStatus = new Map<string, DataFeedHealthStatus>();
  private alerts = new Map<string, DataFeedAlert[]>();
  private metrics = new Map<string, DataFeedMetrics>();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertCallbacks: ((alert: DataFeedAlert) => void)[] = [];

  // Health check thresholds
  private thresholds = {
    maxConsecutiveFailures: 5,
    maxErrorRate: 0.1, // 10%
    maxResponseTime: 30000, // 30 seconds
    maxDataAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    minUptime: 0.95, // 95%
  };

  constructor(dataFeedService: LiveDataFeedService) {
    this.dataFeedService = dataFeedService;
  }

  /**
   * Start monitoring data feeds
   */
  startMonitoring(intervalMinutes = 15): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, intervalMs);

    logger.info("Data feed health monitoring started", { intervalMinutes });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info("Data feed health monitoring stopped");
    }
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: DataFeedAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Perform health checks on all data feeds
   */
  private async performHealthChecks(): Promise<void> {
    const feedNames = [
      "sec-filings",
      "sec-company",
      "sec-xbrl",
      "bls-wage",
      "bls-employment",
      "bls-industry",
      "bls-cpi",
      "census-demographic",
      "census-economic",
      "census-business",
      "census-population",
    ];

    for (const feedName of feedNames) {
      await this.checkFeedHealth(feedName);
    }

    this.updateSystemMetrics();
    this.checkForSystemAlerts();

    logger.debug("Health checks completed", { feedsChecked: feedNames.length });
  }

  /**
   * Check health of a specific data feed
   */
  private async checkFeedHealth(feedName: string): Promise<void> {
    try {
      const qualityMetrics = this.dataFeedService.getDataQualityMetrics();
      const cacheStats = this.dataFeedService.getCacheStats();
      const feedMetrics = qualityMetrics[feedName];

      if (!feedMetrics) {
        // Initialize metrics for new feed
        this.initializeFeedMetrics(feedName);
        return;
      }

      const status = this.determineFeedStatus(feedName, feedMetrics, cacheStats);
      const dataFreshness = this.determineDataFreshness(feedMetrics.lastSuccessfulFetch);
      const alerts = this.checkForFeedAlerts(feedName, feedMetrics, status);

      const healthStatus: DataFeedHealthStatus = {
        feedName,
        status,
        lastSuccessfulFetch: feedMetrics.lastSuccessfulFetch,
        consecutiveFailures: feedMetrics.consecutiveFailures,
        averageResponseTime: feedMetrics.averageResponseTime,
        errorRate: feedMetrics.errorRate,
        dataFreshness,
        lastChecked: new Date().toISOString(),
        alerts,
      };

      this.healthStatus.set(feedName, healthStatus);

      // Process any new alerts
      for (const alert of alerts) {
        if (!this.alerts.get(feedName)?.find((a) => a.id === alert.id)) {
          this.triggerAlert(alert);
        }
      }

      // Update alerts list
      this.alerts.set(feedName, alerts);
    } catch (error) {
      logger.error("Failed to check feed health", { feedName, error });
    }
  }

  /**
   * Determine the health status of a data feed
   */
  private determineFeedStatus(
    feedName: string,
    metrics: any,
    cacheStats: any
  ): DataFeedHealthStatus["status"] {
    // Critical failures
    if (metrics.consecutiveFailures >= this.thresholds.maxConsecutiveFailures) {
      return "offline";
    }

    // High error rate
    if (metrics.errorRate > this.thresholds.maxErrorRate) {
      return "unhealthy";
    }

    // Slow response times
    if (metrics.averageResponseTime > this.thresholds.maxResponseTime) {
      return "degraded";
    }

    // Data freshness issues
    if (this.determineDataFreshness(metrics.lastSuccessfulFetch) === "outdated") {
      return "degraded";
    }

    // Low cache hit rate (might indicate data issues)
    if (cacheStats.hitRate < 0.5) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Determine data freshness based on last successful fetch
   */
  private determineDataFreshness(
    lastSuccessfulFetch: string
  ): DataFeedHealthStatus["dataFreshness"] {
    if (!lastSuccessfulFetch) return "unknown";

    const lastFetch = new Date(lastSuccessfulFetch);
    const now = new Date();
    const ageMs = now.getTime() - lastFetch.getTime();

    if (ageMs > this.thresholds.maxDataAge) return "outdated";
    if (ageMs > 24 * 60 * 60 * 1000) return "stale"; // 24 hours
    return "fresh";
  }

  /**
   * Check for alerts specific to a data feed
   */
  private checkForFeedAlerts(
    feedName: string,
    metrics: any,
    status: DataFeedHealthStatus["status"]
  ): DataFeedAlert[] {
    const alerts: DataFeedAlert[] = [];
    const now = new Date().toISOString();

    // Offline alert
    if (status === "offline") {
      alerts.push({
        id: `${feedName}-offline-${Date.now()}`,
        severity: "critical",
        message: `Data feed ${feedName} is offline after ${metrics.consecutiveFailures} consecutive failures`,
        timestamp: now,
        resolved: false,
      });
    }

    // High error rate alert
    if (metrics.errorRate > this.thresholds.maxErrorRate * 2) {
      alerts.push({
        id: `${feedName}-high-error-rate-${Date.now()}`,
        severity: "high",
        message: `Data feed ${feedName} has error rate of ${(metrics.errorRate * 100).toFixed(1)}%`,
        timestamp: now,
        resolved: false,
      });
    }

    // Slow response time alert
    if (metrics.averageResponseTime > this.thresholds.maxResponseTime * 1.5) {
      alerts.push({
        id: `${feedName}-slow-response-${Date.now()}`,
        severity: "medium",
        message: `Data feed ${feedName} response time is ${(metrics.averageResponseTime / 1000).toFixed(1)}s`,
        timestamp: now,
        resolved: false,
      });
    }

    // Data freshness alert
    if (this.determineDataFreshness(metrics.lastSuccessfulFetch) === "outdated") {
      alerts.push({
        id: `${feedName}-stale-data-${Date.now()}`,
        severity: "medium",
        message: `Data feed ${feedName} has outdated data (last updated: ${metrics.lastSuccessfulFetch})`,
        timestamp: now,
        resolved: false,
      });
    }

    return alerts;
  }

  /**
   * Check for system-level alerts
   */
  private checkForSystemAlerts(): void {
    const totalFeeds = this.healthStatus.size;
    const unhealthyFeeds = Array.from(this.healthStatus.values()).filter(
      (status) => status.status === "unhealthy" || status.status === "offline"
    ).length;

    const unhealthyPercentage = unhealthyFeeds / totalFeeds;

    if (unhealthyPercentage > 0.5) {
      // More than 50% of feeds unhealthy
      const alert: DataFeedAlert = {
        id: `system-high-failure-rate-${Date.now()}`,
        severity: "critical",
        message: `${unhealthyPercentage * 100}% of data feeds are unhealthy (${unhealthyFeeds}/${totalFeeds})`,
        timestamp: new Date().toISOString(),
        resolved: false,
      };
      this.triggerAlert(alert);
    }
  }

  /**
   * Update system-wide metrics
   */
  private updateSystemMetrics(): void {
    const qualityMetrics = this.dataFeedService.getDataQualityMetrics();
    const cacheStats = this.dataFeedService.getCacheStats();

    const totalRequests = Array.from(qualityMetrics.values()).reduce(
      (sum, metrics) => sum + (metrics.errorRate > 0 ? 100 : 0),
      0
    ); // Estimate

    const successfulRequests =
      Array.from(qualityMetrics.values()).filter((metrics) => metrics.consecutiveFailures === 0)
        .length * 10; // Estimate

    const failedRequests = totalRequests - successfulRequests;
    const averageResponseTime =
      Array.from(qualityMetrics.values()).reduce(
        (sum, metrics) => sum + metrics.averageResponseTime,
        0
      ) / qualityMetrics.size;

    const uptimePercentage =
      Array.from(this.healthStatus.values()).filter((status) => status.status === "healthy")
        .length / this.healthStatus.size;

    const dataQualityScore =
      Array.from(qualityMetrics.values()).reduce(
        (sum, metrics) => sum + metrics.errorRate * 100,
        0
      ) / qualityMetrics.size;

    const systemMetrics: DataFeedMetrics = {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      uptimePercentage,
      dataQualityScore: 100 - dataQualityScore, // Invert so higher is better
      cacheHitRate: cacheStats.hitRate,
    };

    this.metrics.set("system", systemMetrics);
  }

  /**
   * Trigger an alert to registered callbacks
   */
  private triggerAlert(alert: DataFeedAlert): void {
    logger.warn("Data feed alert triggered", {
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
    });

    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        logger.error("Alert callback failed", { error, alertId: alert.id });
      }
    }

    // Attempt auto-remediation for certain alerts
    this.attemptAutoRemediation(alert);
  }

  /**
   * Attempt automatic remediation for alerts
   */
  private async attemptAutoRemediation(alert: DataFeedAlert): Promise<void> {
    let action = "";
    let success = false;

    try {
      if (alert.message.includes("stale data") || alert.message.includes("outdated")) {
        // Try to refresh cache
        const feedName = alert.id.split("-")[0];
        await this.dataFeedService.refreshCache(feedName);
        action = "cache_refresh";
        success = true;
      } else if (alert.message.includes("slow response")) {
        // Clear expired cache to force fresh fetches
        this.dataFeedService.clearExpiredCache();
        action = "cache_cleanup";
        success = true;
      }

      if (success) {
        alert.autoRemediation = {
          action,
          executedAt: new Date().toISOString(),
          success: true,
        };
        logger.info("Auto-remediation successful", { alertId: alert.id, action });
      }
    } catch (error) {
      logger.error("Auto-remediation failed", { alertId: alert.id, action, error });
      if (alert.autoRemediation) {
        alert.autoRemediation.success = false;
      }
    }
  }

  /**
   * Initialize metrics for a new feed
   */
  private initializeFeedMetrics(feedName: string): void {
    const now = new Date().toISOString();

    const healthStatus: DataFeedHealthStatus = {
      feedName,
      status: "healthy",
      lastSuccessfulFetch: now,
      consecutiveFailures: 0,
      averageResponseTime: 1000, // 1 second default
      errorRate: 0,
      dataFreshness: "fresh",
      lastChecked: now,
      alerts: [],
    };

    this.healthStatus.set(feedName, healthStatus);
    this.alerts.set(feedName, []);
  }

  /**
   * Get health status for all feeds
   */
  getHealthStatus(): Record<string, DataFeedHealthStatus> {
    const status: Record<string, DataFeedHealthStatus> = {};
    for (const [feedName, health] of this.healthStatus.entries()) {
      status[feedName] = { ...health };
    }
    return status;
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): DataFeedMetrics | null {
    return this.metrics.get("system") || null;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): DataFeedAlert[] {
    const activeAlerts: DataFeedAlert[] = [];

    for (const alerts of this.alerts.values()) {
      activeAlerts.push(...alerts.filter((alert) => !alert.resolved));
    }

    return activeAlerts;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    for (const [feedName, alerts] of this.alerts.entries()) {
      const alertIndex = alerts.findIndex((alert) => alert.id === alertId);
      if (alertIndex !== -1) {
        alerts[alertIndex].resolved = true;
        alerts[alertIndex].resolvedAt = new Date().toISOString();
        logger.info("Alert resolved", { alertId, feedName });
        return true;
      }
    }
    return false;
  }
}
