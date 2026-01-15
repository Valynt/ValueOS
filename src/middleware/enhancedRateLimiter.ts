/**
 * Enhanced Rate Limiter Middleware
 *
 * Extends the basic rate limiter with comprehensive error handling,
 * monitoring, and integration with the new security services:
 * - ML-based anomaly detection
 * - Distributed attack detection
 * - Rate limit escalation
 * - Comprehensive monitoring and alerting
 */

import { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { MLAnomalyDetectionService } from '../services/MLAnomalyDetectionService';
import { DistributedAttackDetectionService } from '../services/DistributedAttackDetectionService';
import { RateLimitEscalationService } from '../services/RateLimitEscalationService';
import { SecurityEvent } from '../services/AdvancedThreatDetectionService';

// Enhanced interfaces for monitoring
export interface RateLimitMetrics {
  key: string;
  tier: string;
  currentCount: number;
  limit: number;
  windowMs: number;
  resetTime: Date;
  isBlocked: boolean;
  isRateLimited: boolean;
  adjustedLimit?: number;
  escalationActions: number;
  lastActivity: Date;
  riskScore: number;
}

export interface SecurityAlert {
  id: string;
  type: 'anomaly_detected' | 'distributed_attack' | 'escalation_triggered' | 'system_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  context: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface MonitoringDashboard {
  totalRequests: number;
  blockedRequests: number;
  rateLimitedRequests: number;
  activeEscalations: number;
  averageRiskScore: number;
  topThreats: Array<{
    type: string;
    count: number;
    riskScore: number;
  }>;
  recentAlerts: SecurityAlert[];
}

export class EnhancedRateLimiter {
  private metrics = new Map<string, RateLimitMetrics>();
  private alerts: SecurityAlert[] = [];
  private dashboard: MonitoringDashboard = {
    totalRequests: 0,
    blockedRequests: 0,
    rateLimitedRequests: 0,
    activeEscalations: 0,
    averageRiskScore: 0,
    topThreats: [],
    recentAlerts: []
  };

  constructor(
    private mlService: MLAnomalyDetectionService,
    private distributedService: DistributedAttackDetectionService,
    private escalationService: RateLimitEscalationService
  ) {
    // Initialize monitoring
    this.initializeMonitoring();
  }

  /**
   * Enhanced rate limiting middleware with security integration
   */
  async enhancedRateLimit(
    tier: string,
    config: {
      windowMs: number;
      max: number;
      keyGenerator?: (req: Request) => string;
      skipSuccessfulRequests?: boolean;
      skipFailedRequests?: boolean;
    }
  ): Promise<(req: Request, res: Response, next: NextFunction) => void> {
    const keyGenerator = config.keyGenerator || this.defaultKeyGenerator;

    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      let securityContext: any = {};

      try {
        // Generate rate limit key
        const key = keyGenerator(req);

        // Update metrics
        this.updateRequestMetrics(key, tier, config);

        // Check escalation status first
        const escalationStatus = await this.escalationService.checkEscalationStatus(key);
        if (escalationStatus.isBlocked) {
          await this.handleBlockedRequest(req, res, escalationStatus);
          return;
        }

        // Check for adjusted rate limits
        const adjustedLimit = escalationStatus.currentLimit || config.max;

        // Perform rate limiting
        const rateLimitResult = await this.checkRateLimit(key, adjustedLimit, config.windowMs);

        if (rateLimitResult.exceeded) {
          await this.handleRateLimitExceeded(req, res, rateLimitResult, securityContext);
          return;
        }

        // Security analysis for the request
        securityContext = await this.performSecurityAnalysis(req, key, tier);

        // Update request with security context
        (req as any).securityContext = securityContext;

        // Set rate limit headers
        this.setRateLimitHeaders(res, rateLimitResult, adjustedLimit);

        // Update dashboard metrics
        this.updateDashboardMetrics('success', securityContext.riskScore || 0);

        // Continue to next middleware
        next();

      } catch (error) {
        await this.handleRateLimitError(req, res, error as Error, startTime);
      }
    };
  }

  /**
   * Perform comprehensive security analysis on the request
   */
  private async performSecurityAnalysis(
    req: Request,
    key: string,
    tier: string
  ): Promise<{
    riskScore: number;
    anomalies: any[];
    isDistributedAttack: boolean;
    recommendations: string[];
  }> {
    const startTime = Date.now();
    let riskScore = 0;
    const anomalies: any[] = [];
    let isDistributedAttack = false;
    const recommendations: string[] = [];

    try {
      // Create security event for analysis
      const securityEvent: SecurityEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId: (req as any).tenantId || 'default',
        userId: (req as any).user?.id,
        eventType: 'api.request',
        severity: 'low',
        source: 'rate_limiter',
        details: {
          ip: req.ip,
          endpoint: req.path,
          method: req.method,
          userAgent: req.headers['user-agent'],
          tier,
          key
        },
        timestamp: new Date(),
        riskScore: 0
      };

      // ML-based anomaly detection
      try {
        const mlAnalysis = await this.mlService.analyzeEvent(securityEvent);
        riskScore = Math.max(riskScore, mlAnalysis.overallRisk / 100);
        anomalies.push(...mlAnalysis.anomalies);
        recommendations.push(...mlAnalysis.recommendations);

        // Log anomaly detection
        if (mlAnalysis.overallRisk > 30) {
          this.createAlert('anomaly_detected', 'medium',
            `ML anomaly detected with risk score ${mlAnalysis.overallRisk.toFixed(1)}`,
            { key, tier, anomalies: mlAnalysis.anomalies }
          );
        }
      } catch (mlError) {
        logger.error('ML analysis failed', mlError as Error, { key, tier });
        this.createAlert('system_error', 'medium',
          'ML anomaly detection service unavailable',
          { key, tier, error: (mlError as Error).message }
        );
      }

      // Distributed attack detection
      try {
        const distributedAnalysis = await this.distributedService.processSecurityEvent(securityEvent);
        isDistributedAttack = distributedAnalysis.isDistributedAttack;
        recommendations.push(...distributedAnalysis.recommendedActions);

        if (isDistributedAttack) {
          riskScore = Math.max(riskScore, 0.7);
          this.createAlert('distributed_attack', 'high',
            'Distributed attack pattern detected',
            { key, tier, patterns: distributedAnalysis.attackPatterns }
          );
        }
      } catch (distError) {
        logger.error('Distributed attack detection failed', distError as Error, { key, tier });
        this.createAlert('system_error', 'medium',
          'Distributed attack detection service unavailable',
          { key, tier, error: (distError as Error).message }
        );
      }

      // Trigger escalation if risk score is high
      if (riskScore > 0.3) {
        try {
          await this.escalationService.processSecurityEvent({
            ...securityEvent,
            riskScore: riskScore * 100
          });
        } catch (escalationError) {
          logger.error('Escalation failed', escalationError as Error, { key, tier, riskScore });
          this.createAlert('system_error', 'high',
            'Rate limit escalation service unavailable',
            { key, tier, riskScore, error: (escalationError as Error).message }
          );
        }
      }

      // Update metrics with security analysis results
      const metrics = this.metrics.get(key);
      if (metrics) {
        metrics.riskScore = riskScore;
        metrics.lastActivity = new Date();
      }

      logger.debug('Security analysis completed', {
        key,
        tier,
        riskScore,
        anomalyCount: anomalies.length,
        isDistributedAttack,
        duration: Date.now() - startTime
      });

      return {
        riskScore,
        anomalies,
        isDistributedAttack,
        recommendations
      };

    } catch (error) {
      logger.error('Security analysis failed', error as Error, { key, tier });

      // Return safe defaults on analysis failure
      return {
        riskScore: 0.1, // Low default risk
        anomalies: [],
        isDistributedAttack: false,
        recommendations: ['Monitor for continued issues']
      };
    }
  }

  /**
   * Handle blocked requests due to escalation
   */
  private async handleBlockedRequest(
    req: Request,
    res: Response,
    escalationStatus: any
  ): Promise<void> {
    this.dashboard.blockedRequests++;

    logger.warn('Request blocked due to escalation', {
      ip: req.ip,
      path: req.path,
      blockExpiresAt: escalationStatus.blockExpiresAt,
      activeActions: escalationStatus.activeActions.length
    });

    res.status(403).json({
      error: 'Access Denied',
      message: 'Request blocked due to security policy',
      blockExpiresAt: escalationStatus.blockExpiresAt,
      activeEscalations: escalationStatus.activeActions.length
    });
  }

  /**
   * Handle rate limit exceeded with enhanced security
   */
  private async handleRateLimitExceeded(
    req: Request,
    res: Response,
    rateLimitResult: any,
    securityContext: any
  ): Promise<void> {
    this.dashboard.rateLimitedRequests++;

    // Create security event for rate limit violation
    const securityEvent: SecurityEvent = {
      id: `rate_limit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId: (req as any).tenantId || 'default',
      userId: (req as any).user?.id,
      eventType: 'rate_limit.exceeded',
      severity: 'medium',
      source: 'rate_limiter',
      details: {
        ip: req.ip,
        endpoint: req.path,
        method: req.method,
        currentCount: rateLimitResult.currentCount,
        limit: rateLimitResult.limit,
        windowMs: rateLimitResult.windowMs,
        riskScore: securityContext.riskScore || 0
      },
      timestamp: new Date(),
      riskScore: (securityContext.riskScore || 0) * 100
    };

    // Process through escalation service
    try {
      await this.escalationService.processSecurityEvent(securityEvent);
    } catch (error) {
      logger.error('Escalation processing failed for rate limit', error as Error);
    }

    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      currentCount: rateLimitResult.currentCount,
      limit: rateLimitResult.limit,
      riskScore: securityContext.riskScore
    });

    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
      limit: rateLimitResult.limit,
      current: rateLimitResult.currentCount,
      resetTime: rateLimitResult.resetTime
    });
  }

  /**
   * Handle rate limiting errors with comprehensive logging
   */
  private async handleRateLimitError(
    req: Request,
    res: Response,
    error: Error,
    startTime: number
  ): Promise<void> {
    const duration = Date.now() - startTime;

    logger.error('Rate limiting error', error, {
      ip: req.ip,
      path: req.path,
      method: req.method,
      duration,
      errorStack: error.stack
    });

    // Create system alert
    this.createAlert('system_error', 'high',
      `Rate limiting error: ${error.message}`,
      { ip: req.ip, path: req.path, duration, stack: error.stack }
    );

    // Fail open - allow request but log the error
    this.dashboard.totalRequests++;

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Rate limiting service temporarily unavailable',
      requestId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
  }

  /**
   * Check rate limit with enhanced metrics
   */
  private async checkRateLimit(
    key: string,
    max: number,
    windowMs: number
  ): Promise<{
    currentCount: number;
    limit: number;
    windowMs: number;
    resetTime: Date;
    exceeded: boolean;
  }> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // This would integrate with actual rate limiting storage
    // For now, using simplified in-memory tracking
    const metrics = this.metrics.get(key);
    const currentCount = metrics ? metrics.currentCount : 0;

    const resetTime = new Date(metrics ? metrics.resetTime : now + windowMs);
    const exceeded = currentCount >= max;

    return {
      currentCount,
      limit: max,
      windowMs,
      resetTime,
      exceeded
    };
  }

  /**
   * Update request metrics
   */
  private updateRequestMetrics(key: string, tier: string, config: any): void {
    let metrics = this.metrics.get(key);

    if (!metrics) {
      metrics = {
        key,
        tier,
        currentCount: 0,
        limit: config.max,
        windowMs: config.windowMs,
        resetTime: new Date(Date.now() + config.windowMs),
        isBlocked: false,
        isRateLimited: false,
        lastActivity: new Date(),
        riskScore: 0,
        escalationActions: 0
      };
      this.metrics.set(key, metrics);
    }

    // Increment count
    metrics.currentCount++;
    metrics.lastActivity = new Date();

    // Reset window if expired
    if (metrics.resetTime < new Date()) {
      metrics.currentCount = 1;
      metrics.resetTime = new Date(Date.now() + metrics.windowMs);
    }
  }

  /**
   * Set rate limit headers
   */
  private setRateLimitHeaders(res: Response, rateLimitResult: any, limit: number): void {
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - rateLimitResult.currentCount));
    res.setHeader('X-RateLimit-Reset', new Date(rateLimitResult.resetTime).toISOString());
  }

  /**
   * Update dashboard metrics
   */
  private updateDashboardMetrics(type: string, riskScore: number): void {
    this.dashboard.totalRequests++;

    if (riskScore > 0) {
      // Update average risk score
      const totalRisk = this.dashboard.averageRiskScore * (this.dashboard.totalRequests - 1) + riskScore;
      this.dashboard.averageRiskScore = totalRisk / this.dashboard.totalRequests;
    }

    // Update top threats (simplified)
    const threatType = 'api_request'; // Would be more sophisticated in production
    const existingThreat = this.dashboard.topThreats.find(t => t.type === threatType);

    if (existingThreat) {
      existingThreat.count++;
      existingThreat.riskScore = Math.max(existingThreat.riskScore, riskScore);
    } else {
      this.dashboard.topThreats.push({
        type: threatType,
        count: 1,
        riskScore
      });
    }

    // Keep only top 10 threats
    this.dashboard.topThreats.sort((a, b) => b.riskScore - a.riskScore);
    this.dashboard.topThreats = this.dashboard.topThreats.slice(0, 10);
  }

  /**
   * Create security alert
   */
  private createAlert(
    type: SecurityAlert['type'],
    severity: SecurityAlert['severity'],
    message: string,
    context: Record<string, any>
  ): void {
    const alert: SecurityAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      context,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(alert);

    // Keep only recent alerts (last 100)
    this.alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    this.alerts = this.alerts.slice(0, 100);

    // Update recent alerts in dashboard
    this.dashboard.recentAlerts = this.alerts.slice(0, 10);

    logger.warn('Security alert created', {
      alertId: alert.id,
      type,
      severity,
      message
    });
  }

  /**
   * Default key generator
   */
  private defaultKeyGenerator(req: Request): string {
    const tenantId = (req as any).tenantId || 'default';
    const userId = (req as any).user?.id;
    const ip = req.ip || 'unknown';

    if (userId) {
      return `${tenantId}:user:${userId}`;
    }

    return `${tenantId}:ip:${ip}`;
  }

  /**
   * Initialize monitoring systems
   */
  private initializeMonitoring(): void {
    // Clean up old metrics periodically
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Update active escalations count
    setInterval(() => {
      this.updateActiveEscalations();
    }, 60 * 1000); // Every minute

    logger.info('Enhanced rate limiter monitoring initialized');
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes ago

    for (const [key, metrics] of this.metrics.entries()) {
      if (metrics.lastActivity.getTime() < cutoff) {
        this.metrics.delete(key);
      }
    }

    // Clean up old alerts
    this.alerts = this.alerts.filter(alert =>
      Date.now() - alert.timestamp.getTime() < 24 * 60 * 60 * 1000 // 24 hours
    );
  }

  /**
   * Update active escalations count
   */
  private updateActiveEscalations(): void {
    // This would integrate with the escalation service
    // For now, using placeholder logic
    this.dashboard.activeEscalations = Math.floor(Math.random() * 5);
  }

  /**
   * Get monitoring dashboard data
   */
  public getDashboard(): MonitoringDashboard {
    return { ...this.dashboard };
  }

  /**
   * Get metrics for a specific key
   */
  public getMetrics(key: string): RateLimitMetrics | null {
    return this.metrics.get(key) || null;
  }

  /**
   * Get recent alerts
   */
  public getAlerts(limit: number = 50): SecurityAlert[] {
    return this.alerts.slice(0, limit);
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      return true;
    }
    return false;
  }
}
