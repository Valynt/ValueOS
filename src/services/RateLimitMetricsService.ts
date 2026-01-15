/**
 * Rate Limit Metrics Service
 *
 * Provides real-time monitoring and analytics for rate limit effectiveness
 * Tracks performance, violations, and system health
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TenantAwareService } from './TenantAwareService';
import { log } from '../lib/logger';
import { redisCircuitBreaker } from './RedisCircuitBreaker';
import { RateLimitKeyService } from './RateLimitKeyService';

export interface RateLimitMetrics {
  timestamp: Date;
  tenantId: string;
  service: string;
  tier: string;
  totalRequests: number;
  blockedRequests: number;
  allowedRequests: number;
  averageResponseTime: number;
  violations: number;
  circuitBreakerTrips: number;
  redisErrors: number;
  topViolators: Array<{
    userId?: string;
    ip?: string;
    violations: number;
    tier: string;
  }>;
  endpointStats: Array<{
    endpoint: string;
    method: string;
    requests: number;
    violations: number;
    blockRate: number;
  }>;
}

export interface MetricsQuery {
  tenantId?: string;
  service?: string;
  tier?: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  granularity?: 'minute' | 'hour' | 'day';
}

export interface RateLimitDashboard {
  overview: {
    totalRequests: number;
    totalViolations: number;
    overallBlockRate: number;
    averageResponseTime: number;
    systemHealth: 'healthy' | 'degraded' | 'critical';
    activeCircuits: number;
  };
  services: Array<{
    name: string;
    requests: number;
    violations: number;
    blockRate: number;
    avgResponseTime: number;
    health: 'healthy' | 'degraded' | 'critical';
  }>;
  tiers: Array<{
    name: string;
    requests: number;
    violations: number;
    blockRate: number;
    topViolators: number;
  }>;
  trends: Array<{
    timestamp: Date;
    requests: number;
    violations: number;
    blockRate: number;
  }>;
  alerts: Array<{
    type: 'high_violation_rate' | 'circuit_breaker' | 'redis_error' | 'performance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
    resolved?: boolean;
  }>;
}

export class RateLimitMetricsService extends TenantAwareService {
  private metricsCache: Map<string, RateLimitMetrics[]> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_ENTRIES = 1000;

  constructor(supabase: SupabaseClient) {
    super('RateLimitMetricsService');
    this.supabase = supabase;
  }

  /**
   * Record rate limit metrics for a request
   */
  async recordMetrics(data: {
    tenantId: string;
    service: string;
    tier: string;
    endpoint: string;
    method: string;
    blocked: boolean;
    responseTime: number;
    userId?: string;
    ip?: string;
  }): Promise<void> {
    try {
      const timestamp = new Date();
      const cacheKey = this.generateCacheKey(data.tenantId, data.service, timestamp);

      // Get existing metrics for this time window
      let metrics = this.metricsCache.get(cacheKey);
      if (!metrics || metrics.length === 0) {
        metrics = [{
          timestamp,
          tenantId: data.tenantId,
          service: data.service,
          tier: data.tier,
          totalRequests: 0,
          blockedRequests: 0,
          allowedRequests: 0,
          averageResponseTime: 0,
          violations: 0,
          circuitBreakerTrips: 0,
          redisErrors: 0,
          topViolators: [],
          endpointStats: []
        }];
      }

      const currentMetrics = metrics[0];

      // Update counters
      currentMetrics.totalRequests++;
      if (data.blocked) {
        currentMetrics.blockedRequests++;
        currentMetrics.violations++;
      } else {
        currentMetrics.allowedRequests++;
      }

      // Update average response time
      currentMetrics.averageResponseTime =
        (currentMetrics.averageResponseTime * (currentMetrics.totalRequests - 1) + data.responseTime) /
        currentMetrics.totalRequests;

      // Update endpoint stats
      this.updateEndpointStats(currentMetrics, data.endpoint, data.method, data.blocked);

      // Update top violators
      if (data.blocked) {
        this.updateTopViolators(currentMetrics, data.userId, data.ip, data.tier);
      }

      // Cache the updated metrics
      this.metricsCache.set(cacheKey, metrics);

      // Periodically persist to database
      if (currentMetrics.totalRequests % 100 === 0) {
        await this.persistMetrics(currentMetrics);
      }

    } catch (error) {
      log.error('Failed to record rate limit metrics', error as Error, data);
    }
  }

  /**
   * Get rate limit dashboard data
   */
  async getDashboard(query: MetricsQuery): Promise<RateLimitDashboard> {
    try {
      const metrics = await this.queryMetrics(query);

      // Calculate overview
      const overview = this.calculateOverview(metrics);

      // Calculate service breakdown
      const services = this.calculateServiceBreakdown(metrics);

      // Calculate tier breakdown
      const tiers = this.calculateTierBreakdown(metrics);

      // Calculate trends
      const trends = this.calculateTrends(metrics, query.granularity || 'hour');

      // Get active alerts
      const alerts = await this.getActiveAlerts(query);

      return {
        overview,
        services,
        tiers,
        trends,
        alerts
      };

    } catch (error) {
      log.error('Failed to get rate limit dashboard', error as Error, query);
      throw error;
    }
  }

  /**
   * Query metrics from cache and database
   */
  private async queryMetrics(query: MetricsQuery): Promise<RateLimitMetrics[]> {
    const allMetrics: RateLimitMetrics[] = [];

    // Get cached metrics
    for (const [cacheKey, metrics] of this.metricsCache.entries()) {
      for (const metric of metrics) {
        if (this.matchesQuery(metric, query)) {
          allMetrics.push(metric);
        }
      }
    }

    // Get historical metrics from database
    const historicalMetrics = await this.getHistoricalMetrics(query);
    allMetrics.push(...historicalMetrics);

    // Sort by timestamp
    return allMetrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Check if metric matches query criteria
   */
  private matchesQuery(metric: RateLimitMetrics, query: MetricsQuery): boolean {
    if (query.tenantId && metric.tenantId !== query.tenantId) return false;
    if (query.service && metric.service !== query.service) return false;
    if (query.tier && metric.tier !== query.tier) return false;
    if (metric.timestamp < query.timeRange.start || metric.timestamp > query.timeRange.end) return false;

    return true;
  }

  /**
   * Get historical metrics from database
   */
  private async getHistoricalMetrics(query: MetricsQuery): Promise<RateLimitMetrics[]> {
    try {
      const { data } = await this.supabase
        .from('rate_limit_metrics')
        .select('*')
        .gte('timestamp', query.timeRange.start.toISOString())
        .lte('timestamp', query.timeRange.end.toISOString())
        .order('timestamp', { ascending: true });

      if (!data) return [];

      return data.map(row => ({
        timestamp: new Date(row.timestamp),
        tenantId: row.tenant_id,
        service: row.service,
        tier: row.tier,
        totalRequests: row.total_requests,
        blockedRequests: row.blocked_requests,
        allowedRequests: row.allowed_requests,
        averageResponseTime: row.average_response_time,
        violations: row.violations,
        circuitBreakerTrips: row.circuit_breaker_trips,
        redisErrors: row.redis_errors,
        topViolators: row.top_violators || [],
        endpointStats: row.endpoint_stats || []
      }));

    } catch (error) {
      log.error('Failed to get historical metrics', error as Error);
      return [];
    }
  }

  /**
   * Calculate overview statistics
   */
  private calculateOverview(metrics: RateLimitMetrics[]) {
    const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalViolations = metrics.reduce((sum, m) => sum + m.violations, 0);
    const overallBlockRate = totalRequests > 0 ? (totalViolations / totalRequests) * 100 : 0;
    const averageResponseTime = metrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / metrics.length;

    // Get circuit breaker stats
    const circuitStats = redisCircuitBreaker.getStats();
    const systemHealth = this.determineSystemHealth(overallBlockRate, circuitStats);

    return {
      totalRequests,
      totalViolations,
      overallBlockRate,
      averageResponseTime,
      systemHealth,
      activeCircuits: circuitStats.openCircuits
    };
  }

  /**
   * Calculate service breakdown
   */
  private calculateServiceBreakdown(metrics: RateLimitMetrics[]) {
    const serviceMap = new Map<string, {
      requests: number;
      violations: number;
      responseTime: number;
      count: number;
    }>();

    for (const metric of metrics) {
      const existing = serviceMap.get(metric.service) || {
        requests: 0,
        violations: 0,
        responseTime: 0,
        count: 0
      };

      existing.requests += metric.totalRequests;
      existing.violations += metric.violations;
      existing.responseTime += metric.averageResponseTime;
      existing.count++;

      serviceMap.set(metric.service, existing);
    }

    return Array.from(serviceMap.entries()).map(([name, stats]) => ({
      name,
      requests: stats.requests,
      violations: stats.violations,
      blockRate: stats.requests > 0 ? (stats.violations / stats.requests) * 100 : 0,
      avgResponseTime: stats.responseTime / stats.count,
      health: this.determineServiceHealth(stats.violations / stats.requests)
    }));
  }

  /**
   * Calculate tier breakdown
   */
  private calculateTierBreakdown(metrics: RateLimitMetrics[]) {
    const tierMap = new Map<string, {
      requests: number;
      violations: number;
      violators: Set<string>;
    }>();

    for (const metric of metrics) {
      const existing = tierMap.get(metric.tier) || {
        requests: 0,
        violations: 0,
        violators: new Set()
      };

      existing.requests += metric.totalRequests;
      existing.violations += metric.violations;

      // Add unique violators
      for (const violator of metric.topViolators) {
        const key = violator.userId || violator.ip || 'unknown';
        existing.violators.add(key);
      }

      tierMap.set(metric.tier, existing);
    }

    return Array.from(tierMap.entries()).map(([name, stats]) => ({
      name,
      requests: stats.requests,
      violations: stats.violations,
      blockRate: stats.requests > 0 ? (stats.violations / stats.requests) * 100 : 0,
      topViolators: stats.violators.size
    }));
  }

  /**
   * Calculate trends data
   */
  private calculateTrends(metrics: RateLimitMetrics[], granularity: string) {
    const timeMap = new Map<string, {
      requests: number;
      violations: number;
    }>();

    for (const metric of metrics) {
      const timeKey = this.getTimeKey(metric.timestamp, granularity);
      const existing = timeMap.get(timeKey) || { requests: 0, violations: 0 };

      existing.requests += metric.totalRequests;
      existing.violations += metric.violations;

      timeMap.set(timeKey, existing);
    }

    return Array.from(timeMap.entries())
      .map(([timeKey, stats]) => ({
        timestamp: new Date(timeKey),
        requests: stats.requests,
        violations: stats.violations,
        blockRate: stats.requests > 0 ? (stats.violations / stats.requests) * 100 : 0
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get active alerts
   */
  private async getActiveAlerts(query: MetricsQuery): Promise<Array<{
    type: 'high_violation_rate' | 'circuit_breaker' | 'redis_error' | 'performance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
    resolved?: boolean;
  }>> {
    const alerts = [];

    // Check for high violation rates
    const recentMetrics = await this.queryMetrics({
      ...query,
      timeRange: {
        start: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        end: new Date()
      }
    });

    const totalRequests = recentMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalViolations = recentMetrics.reduce((sum, m) => sum + m.violations, 0);
    const violationRate = totalRequests > 0 ? (totalViolations / totalRequests) * 100 : 0;

    if (violationRate > 10) {
      alerts.push({
        type: 'high_violation_rate',
        severity: violationRate > 25 ? 'critical' : violationRate > 15 ? 'high' : 'medium',
        message: `High violation rate: ${violationRate.toFixed(2)}%`,
        timestamp: new Date()
      });
    }

    // Check circuit breaker status
    const circuitStats = redisCircuitBreaker.getStats();
    if (circuitStats.openCircuits > 0) {
      alerts.push({
        type: 'circuit_breaker',
        severity: circuitStats.openCircuits > 3 ? 'critical' : 'high',
        message: `${circuitStats.openCircuits} circuits open`,
        timestamp: new Date()
      });
    }

    // Check for performance issues
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / recentMetrics.length;
    if (avgResponseTime > 1000) { // 1 second
      alerts.push({
        type: 'performance',
        severity: avgResponseTime > 5000 ? 'critical' : avgResponseTime > 2000 ? 'high' : 'medium',
        message: `High average response time: ${avgResponseTime.toFixed(2)}ms`,
        timestamp: new Date()
      });
    }

    return alerts;
  }

  /**
   * Update endpoint statistics
   */
  private updateEndpointStats(metrics: RateLimitMetrics, endpoint: string, method: string, blocked: boolean) {
    let endpointStat = metrics.endpointStats.find(s => s.endpoint === endpoint && s.method === method);

    if (!endpointStat) {
      endpointStat = {
        endpoint,
        method,
        requests: 0,
        violations: 0,
        blockRate: 0
      };
      metrics.endpointStats.push(endpointStat);
    }

    endpointStat.requests++;
    if (blocked) {
      endpointStat.violations++;
    }
    endpointStat.blockRate = (endpointStat.violations / endpointStat.requests) * 100;
  }

  /**
   * Update top violators
   */
  private updateTopViolators(metrics: RateLimitMetrics, userId?: string, ip?: string, tier?: string) {
    const key = userId || ip || 'unknown';
    let violator = metrics.topViolators.find(v => (v.userId || v.ip) === key);

    if (!violator) {
      violator = {
        userId,
        ip,
        violations: 0,
        tier: tier || 'unknown'
      };
      metrics.topViolators.push(violator);
    }

    violator.violations++;

    // Keep only top 10 violators
    metrics.topViolators.sort((a, b) => b.violations - a.violations);
    if (metrics.topViolators.length > 10) {
      metrics.topViolators = metrics.topViolators.slice(0, 10);
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(tenantId: string, service: string, timestamp: Date): string {
    const timeWindow = Math.floor(timestamp.getTime() / (60 * 1000)) * (60 * 1000); // 1-minute windows
    return `${tenantId}:${service}:${timeWindow}`;
  }

  /**
   * Get time key for trends
   */
  private getTimeKey(timestamp: Date, granularity: string): string {
    const date = new Date(timestamp);

    switch (granularity) {
      case 'minute':
        return date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
      case 'hour':
        return date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      case 'day':
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
      default:
        return date.toISOString().slice(0, 13);
    }
  }

  /**
   * Determine system health
   */
  private determineSystemHealth(blockRate: number, circuitStats: any): 'healthy' | 'degraded' | 'critical' {
    if (blockRate > 25 || circuitStats.openCircuits > 3) return 'critical';
    if (blockRate > 10 || circuitStats.openCircuits > 0) return 'degraded';
    return 'healthy';
  }

  /**
   * Determine service health
   */
  private determineServiceHealth(blockRate: number): 'healthy' | 'degraded' | 'critical' {
    if (blockRate > 30) return 'critical';
    if (blockRate > 15) return 'degraded';
    return 'healthy';
  }

  /**
   * Persist metrics to database
   */
  private async persistMetrics(metrics: RateLimitMetrics): Promise<void> {
    try {
      await this.supabase.from('rate_limit_metrics').insert({
        tenant_id: metrics.tenantId,
        service: metrics.service,
        tier: metrics.tier,
        timestamp: metrics.timestamp,
        total_requests: metrics.totalRequests,
        blocked_requests: metrics.blockedRequests,
        allowed_requests: metrics.allowedRequests,
        average_response_time: metrics.averageResponseTime,
        violations: metrics.violations,
        circuit_breaker_trips: metrics.circuitBreakerTrips,
        redis_errors: metrics.redisErrors,
        top_violators: metrics.topViolators,
        endpoint_stats: metrics.endpointStats
      });
    } catch (error) {
      log.error('Failed to persist metrics', error as Error);
    }
  }

  /**
   * Cleanup old cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, metrics] of this.metricsCache.entries()) {
      if (metrics.length > 0 && metrics[0].timestamp.getTime() < now - this.CACHE_TTL) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.metricsCache.delete(key);
    }

    // Prevent cache from growing too large
    if (this.metricsCache.size > this.MAX_CACHE_ENTRIES) {
      const entries = Array.from(this.metricsCache.entries())
        .sort((a, b) => a[1][0].timestamp.getTime() - b[1][0].timestamp.getTime());

      // Remove oldest entries
      const toRemove = entries.slice(0, this.metricsCache.size - this.MAX_CACHE_ENTRIES);
      for (const [key] of toRemove) {
        this.metricsCache.delete(key);
      }
    }

    if (keysToDelete.length > 0) {
      log.debug('Cleaned up rate limit metrics cache', { removed: keysToDelete.length });
    }
  }

  /**
   * Get real-time system health
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    metrics: {
      activeConnections: number;
      circuitBreakerStats: any;
      cacheSize: number;
      averageResponseTime: number;
      errorRate: number;
    };
    }> {
    const circuitStats = redisCircuitBreaker.getStats();
    const recentMetrics = Array.from(this.metricsCache.values()).flat().slice(-100); // Last 100 entries

    const averageResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / recentMetrics.length
      : 0;

    const totalRequests = recentMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalViolations = recentMetrics.reduce((sum, m) => sum + m.violations, 0);
    const errorRate = totalRequests > 0 ? (totalViolations / totalRequests) * 100 : 0;

    const status = this.determineSystemHealth(errorRate, circuitStats);

    return {
      status,
      metrics: {
        activeConnections: this.metricsCache.size,
        circuitBreakerStats,
        cacheSize: this.metricsCache.size,
        averageResponseTime,
        errorRate
      }
    };
  }
}
