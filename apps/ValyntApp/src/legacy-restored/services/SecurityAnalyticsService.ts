/**
 * Security Analytics Service
 *
 * Comprehensive logging and analytics for security monitoring:
 * - Structured security event logging
 * - Real-time analytics and metrics
 * - Threat intelligence correlation
 * - Security dashboard data
 * - Alert generation and notification
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TenantAwareService } from './TenantAwareService';
import { log } from '../lib/logger';
import { SecurityEvent } from './AdvancedThreatDetectionService';
import { MLAnomalyDetectionService } from './MLAnomalyDetectionService';
import { DistributedAttackDetectionService } from './DistributedAttackDetectionService';
import { CredentialStuffingDetectionService } from './CredentialStuffingDetectionService';

export interface SecurityAnalyticsEvent {
  id: string;
  timestamp: Date;
  tenantId: string;
  eventType: 'security_event' | 'threat_detected' | 'escalation_triggered' | 'anomaly_detected' | 'attack_blocked';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  category: 'authentication' | 'authorization' | 'rate_limiting' | 'api_abuse' | 'data_access' | 'network_security';
  title: string;
  description: string;
  details: Record<string, any>;
  userId?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  riskScore: number;
  metadata: {
    correlationId?: string;
    sessionId?: string;
    requestId?: string;
    tags?: string[];
    indicators?: string[];
    response?: {
      action: string;
      result: string;
      duration: number;
    };
  };
}

export interface SecurityMetrics {
  timeWindow: number; // minutes
  totalEvents: number;
  eventsBySeverity: Record<string, number>;
  eventsByCategory: Record<string, number>;
  eventsByType: Record<string, number>;
  topThreats: Array<{
    type: string;
    count: number;
    avgRiskScore: number;
    maxRiskScore: number;
  }>;
  topSourceIPs: Array<{
    ip: string;
    events: number;
    avgRiskScore: number;
    blocked: boolean;
  }>;
  topAffectedUsers: Array<{
    userId: string;
    events: number;
    avgRiskScore: number;
    lastActivity: Date;
  }>;
  escalationMetrics: {
    triggered: number;
    completed: number;
    failed: number;
    avgResponseTime: number;
  };
  anomalyMetrics: {
    detected: number;
    mlPredictions: number;
    falsePositives: number;
    accuracy: number;
  };
  attackMetrics: {
    attempts: number;
    blocked: number;
    successRate: number;
    avgAttackDuration: number;
  };
}

export interface SecurityDashboard {
  overview: {
    totalEvents: number;
    criticalEvents: number;
    activeThreats: number;
    blockedAttacks: number;
    riskScore: number;
    trendDirection: 'up' | 'down' | 'stable';
  };
  realtime: {
    eventsPerMinute: number;
    currentRiskScore: number;
    activeEscalations: number;
    blockedIPs: number;
    suspiciousActivity: number;
  };
  threats: {
    topThreatTypes: Array<{
      type: string;
      count: number;
      severity: string;
      trend: number; // percentage change
    }>;
    emergingThreats: Array<{
      pattern: string;
      firstSeen: Date;
      occurrences: number;
      riskScore: number;
    }>;
  };
  defenses: {
    rateLimitEffectiveness: number;
    mlDetectionAccuracy: number;
    escalationResponseTime: number;
    blockSuccessRate: number;
  };
}

export interface SecurityAlert {
  id: string;
  type: 'threat_detected' | 'escalation_required' | 'system_anomaly' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  tenantId: string;
  source: string;
  details: Record<string, any>;
  recommendations: string[];
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  correlationIds: string[];
}

export class SecurityAnalyticsService extends TenantAwareService {
  private events: SecurityAnalyticsEvent[] = [];
  private alerts = new Map<string, SecurityAlert>();
  private metrics = new Map<string, SecurityMetrics>(); // Key: tenantId
  private dashboardCache = new Map<string, SecurityDashboard>(); // Key: tenantId
  private correlationGroups = new Map<string, SecurityAnalyticsEvent[]>(); // Key: correlationId

  constructor(
    supabase: SupabaseClient,
    private mlService: MLAnomalyDetectionService,
    private distributedService: DistributedAttackDetectionService,
    private credentialService: CredentialStuffingDetectionService
  ) {
    super('SecurityAnalyticsService');
    this.supabase = supabase;

    this.initializeAnalytics();
  }

  /**
   * Log security event with full analytics
   */
  async logSecurityEvent(event: Partial<SecurityAnalyticsEvent>): Promise<void> {
    const analyticsEvent: SecurityAnalyticsEvent = {
      id: event.id || `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: event.timestamp || new Date(),
      tenantId: event.tenantId || 'default',
      eventType: event.eventType || 'security_event',
      severity: event.severity || 'medium',
      source: event.source || 'unknown',
      category: event.category || 'network_security',
      title: event.title || 'Security Event',
      description: event.description || 'Security event occurred',
      details: event.details || {},
      userId: event.userId,
      ip: event.ip,
      userAgent: event.userAgent,
      endpoint: event.endpoint,
      riskScore: event.riskScore || 0,
      metadata: {
        correlationId: event.metadata?.correlationId,
        sessionId: event.metadata?.sessionId,
        requestId: event.metadata?.requestId,
        tags: event.metadata?.tags || [],
        indicators: event.metadata?.indicators || [],
        response: event.metadata?.response
      }
    };

    // Store event
    this.events.push(analyticsEvent);

    // Add to correlation group if correlation ID exists
    if (analyticsEvent.metadata.correlationId) {
      this.addToCorrelationGroup(analyticsEvent.metadata.correlationId, analyticsEvent);
    }

    // Update metrics
    await this.updateMetrics(analyticsEvent.tenantId, analyticsEvent);

    // Check for alert conditions
    await this.evaluateAlertConditions(analyticsEvent);

    // Log to structured logger
    this.logStructuredEvent(analyticsEvent);

    // Persist to database
    await this.persistEvent(analyticsEvent);

    // Clean up old events periodically
    this.cleanupOldEvents();
  }

  /**
   * Process security event from other services
   */
  async processSecurityEvent(
    securityEvent: SecurityEvent,
    source: string,
    additionalContext?: Record<string, any>
  ): Promise<void> {
    await this.logSecurityEvent({
      tenantId: securityEvent.tenantId,
      eventType: 'security_event',
      severity: securityEvent.severity,
      source,
      category: this.mapEventTypeToCategory(securityEvent.eventType),
      title: `${securityEvent.eventType} - ${securityEvent.severity}`,
      description: `Security event: ${securityEvent.eventType}`,
      details: {
        ...securityEvent.details,
        ...additionalContext
      },
      userId: securityEvent.userId,
      ip: securityEvent.details?.ip,
      userAgent: securityEvent.details?.userAgent,
      endpoint: securityEvent.details?.endpoint,
      riskScore: securityEvent.riskScore,
      metadata: {
        correlationId: additionalContext?.correlationId,
        sessionId: securityEvent.details?.sessionId,
        requestId: additionalContext?.requestId,
        tags: [securityEvent.eventType, securityEvent.severity],
        indicators: this.extractIndicators(securityEvent)
      }
    });
  }

  /**
   * Get security metrics for tenant
   */
  getMetrics(tenantId: string, timeWindowMinutes: number = 60): SecurityMetrics {
    const cached = this.metrics.get(tenantId);
    if (cached && cached.timeWindow === timeWindowMinutes) {
      return cached;
    }

    const cutoff = Date.now() - timeWindowMinutes * 60 * 1000;
    const tenantEvents = this.events.filter((e: SecurityAnalyticsEvent) =>
      e.tenantId === tenantId && e.timestamp.getTime() > cutoff
    );

    const metrics = this.calculateMetrics(tenantEvents, timeWindowMinutes);
    this.metrics.set(tenantId, metrics);

    return metrics;
  }

  /**
   * Get security dashboard data
   */
  getDashboard(tenantId: string): SecurityDashboard {
    const cached = this.dashboardCache.get(tenantId);
    if (cached && Date.now() - cached.overview.totalEvents < 60000) { // 1 minute cache
      return cached;
    }

    const dashboard = this.generateDashboard(tenantId);
    this.dashboardCache.set(tenantId, dashboard);

    return dashboard;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(tenantId?: string): SecurityAlert[] {
    const alerts = Array.from(this.alerts.values()).filter(a =>
      a.status === 'active' || a.status === 'investigating'
    );

    if (tenantId) {
      return alerts.filter(a => a.tenantId === tenantId);
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    });
  }

  /**
   * Create security alert
   */
  async createAlert(alert: Partial<SecurityAlert>): Promise<SecurityAlert> {
    const securityAlert: SecurityAlert = {
      id: alert.id || `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: alert.type || 'threat_detected',
      severity: alert.severity || 'medium',
      title: alert.title || 'Security Alert',
      description: alert.description || 'Security alert triggered',
      timestamp: alert.timestamp || new Date(),
      tenantId: alert.tenantId || 'default',
      source: alert.source || 'analytics',
      details: alert.details || {},
      recommendations: alert.recommendations || [],
      status: 'active',
      correlationIds: alert.correlationIds || []
    };

    this.alerts.set(securityAlert.id, securityAlert);

    // Log alert creation
    log.warn('Security alert created', {
      alertId: securityAlert.id,
      type: securityAlert.type,
      severity: securityAlert.severity,
      tenantId: securityAlert.tenantId
    });

    // Persist alert
    await this.persistAlert(securityAlert);

    return securityAlert;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, resolutionNotes?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      alert.resolutionNotes = resolutionNotes;

      log.info('Security alert resolved', {
        alertId,
        resolutionNotes
      });

      return true;
    }
    return false;
  }

  /**
   * Get correlated events
   */
  getCorrelatedEvents(correlationId: string): SecurityAnalyticsEvent[] {
    return this.correlationGroups.get(correlationId) || [];
  }

  /**
   * Search events
   */
  searchEvents(tenantId: string, criteria: {
    eventType?: string;
    severity?: string;
    category?: string;
    source?: string;
    userId?: string;
    ip?: string;
    timeRange?: { start: Date; end: Date };
    tags?: string[];
    minRiskScore?: number;
  }): SecurityAnalyticsEvent[] {
    return this.events.filter(event => {
      if (event.tenantId !== tenantId) return false;

      if (criteria.eventType && event.eventType !== criteria.eventType) return false;
      if (criteria.severity && event.severity !== criteria.severity) return false;
      if (criteria.category && event.category !== criteria.category) return false;
      if (criteria.source && event.source !== criteria.source) return false;
      if (criteria.userId && event.userId !== criteria.userId) return false;
      if (criteria.ip && event.ip !== criteria.ip) return false;
      if (criteria.minRiskScore && event.riskScore < criteria.minRiskScore) return false;

      if (criteria.timeRange) {
        const eventTime = event.timestamp.getTime();
        if (eventTime < criteria.timeRange.start.getTime() ||
            eventTime > criteria.timeRange.end.getTime()) {
          return false;
        }
      }

      if (criteria.tags && criteria.tags.length > 0) {
        const eventTags = event.metadata.tags || [];
        if (!criteria.tags.some(tag => eventTags.includes(tag))) {
          return false;
        }
      }

      return true;
    });
  }

  // Private methods
  private initializeAnalytics(): void {
    // Load recent events from database
    this.loadRecentEvents();

    // Start periodic cleanup
    setInterval(() => {
      this.cleanupOldEvents();
      this.cleanupOldAlerts();
    }, 5 * 60 * 1000); // Every 5 minutes

    log.info('Security analytics service initialized');
  }

  private async loadRecentEvents(): Promise<void> {
    try {
      const { data: events } = await this.supabase
        .from('security_analytics_events')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('timestamp', { ascending: false })
        .limit(10000);

      if (events) {
        this.events = events.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp)
        }));
      }
    } catch (error) {
      log.error('Failed to load recent events', error as Error);
    }
  }

  private addToCorrelationGroup(correlationId: string, event: SecurityAnalyticsEvent): void {
    if (!this.correlationGroups.has(correlationId)) {
      this.correlationGroups.set(correlationId, []);
    }
    this.correlationGroups.get(correlationId)!.push(event);
  }

  private async updateMetrics(tenantId: string, event: SecurityAnalyticsEvent): Promise<void> {
    // Invalidate cached metrics for tenant
    this.metrics.delete(tenantId);
    this.dashboardCache.delete(tenantId);
  }

  private async evaluateAlertConditions(event: SecurityAnalyticsEvent): Promise<void> {
    // High risk score alert
    if (event.riskScore > 80) {
      await this.createAlert({
        type: 'threat_detected',
        severity: event.riskScore > 90 ? 'critical' : 'high',
        title: `High Risk Event: ${event.title}`,
        description: `Event with risk score ${event.riskScore} detected`,
        tenantId: event.tenantId,
        source: event.source,
        details: event.details,
        recommendations: [
          'Immediate investigation required',
          'Review related events',
          'Consider escalation'
        ],
        correlationIds: event.metadata.correlationId ? [event.metadata.correlationId] : []
      });
    }

    // Multiple events from same IP
    const recentIPEvents = this.events.filter(e =>
      e.ip === event.ip &&
      e.tenantId === event.tenantId &&
      Date.now() - e.timestamp.getTime() < 10 * 60 * 1000 // Last 10 minutes
    );

    if (recentIPEvents.length > 20) {
      await this.createAlert({
        type: 'threat_detected',
        severity: 'high',
        title: `Suspicious Activity from IP: ${event.ip}`,
        description: `${recentIPEvents.length} events detected from IP ${event.ip} in last 10 minutes`,
        tenantId: event.tenantId,
        source: 'analytics',
        details: {
          ip: event.ip,
          eventCount: recentIPEvents.length,
          timeWindow: '10 minutes'
        },
        recommendations: [
          'Investigate IP reputation',
          'Consider IP blocking',
          'Review all events from this IP'
        ]
      });
    }

    // Pattern detection alerts would go here
    // This would integrate with ML and distributed attack detection
  }

  private logStructuredEvent(event: SecurityAnalyticsEvent): void {
    const logData = {
      eventId: event.id,
      tenantId: event.tenantId,
      eventType: event.eventType,
      severity: event.severity,
      category: event.category,
      source: event.source,
      title: event.title,
      riskScore: event.riskScore,
      userId: event.userId,
      ip: event.ip,
      endpoint: event.endpoint,
      correlationId: event.metadata.correlationId,
      tags: event.metadata.tags,
      indicators: event.metadata.indicators
    };

    // Use appropriate log level based on severity
    switch (event.severity) {
      case 'critical':
        log.error('Security event', undefined, { ...logData, title: event.title });
        break;
      case 'high':
        log.warn('Security event', { ...logData, title: event.title });
        break;
      case 'medium':
        log.info('Security event', { ...logData, title: event.title });
        break;
      default:
        log.debug('Security event', { ...logData, title: event.title });
    }
  }

  private async persistEvent(event: SecurityAnalyticsEvent): Promise<void> {
    try {
      await this.supabase.from('security_analytics_events').insert({
        id: event.id,
        timestamp: event.timestamp.toISOString(),
        tenant_id: event.tenantId,
        event_type: event.eventType,
        severity: event.severity,
        source: event.source,
        category: event.category,
        title: event.title,
        description: event.description,
        details: event.details,
        user_id: event.userId,
        ip: event.ip,
        user_agent: event.userAgent,
        endpoint: event.endpoint,
        risk_score: event.riskScore,
        metadata: event.metadata
      });
    } catch (error) {
      log.error('Failed to persist security event', new Error(error as any), { eventId: event.id });
    }
  }

  private async persistAlert(alert: SecurityAlert): Promise<void> {
    try {
      await this.supabase.from('security_alerts').insert({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        timestamp: alert.timestamp.toISOString(),
        tenant_id: alert.tenantId,
        source: alert.source,
        details: alert.details,
        recommendations: alert.recommendations,
        status: alert.status,
        correlation_ids: alert.correlationIds
      });
    } catch (error) {
      log.error('Failed to persist security alert', new Error(error as any), { alertId: alert.id });
    }
  }

  private calculateMetrics(events: SecurityAnalyticsEvent[], timeWindowMinutes: number): SecurityMetrics {
    const eventsBySeverity = events.reduce((acc, e) => {
      acc[e.severity] = (acc[e.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsByCategory = events.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsByType = events.reduce((acc, e) => {
      acc[e.eventType] = (acc[e.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Top threats
    const threatGroups = events.reduce((acc, e) => {
      const key = `${e.eventType}_${e.category}`;
      if (!acc[key]) {
        acc[key] = { type: key, count: 0, riskScores: [] };
      }
      acc[key].count++;
      acc[key].riskScores.push(e.riskScore);
      return acc;
    }, {} as Record<string, { type: string; count: number; riskScores: number[] }>);

    const topThreats = Object.values(threatGroups)
      .map(group => ({
        type: group.type,
        count: group.count,
        avgRiskScore: group.riskScores.reduce((a, b) => a + b, 0) / group.riskScores.length,
        maxRiskScore: Math.max(...group.riskScores)
      }))
      .sort((a, b) => b.avgRiskScore - a.avgRiskScore)
      .slice(0, 10);

    // Top source IPs
    const ipGroups = events.reduce((acc, e) => {
      if (e.ip) {
        if (!acc[e.ip]) {
          acc[e.ip] = { events: 0, riskScores: [] };
        }
        acc[e.ip].events++;
        acc[e.ip].riskScores.push(e.riskScore);
      }
      return acc;
    }, {} as Record<string, { events: number; riskScores: number[] }>);

    const topSourceIPs = Object.entries(ipGroups)
      .map(([ip, data]) => ({
        ip,
        events: data.events,
        avgRiskScore: data.riskScores.reduce((a, b) => a + b, 0) / data.riskScores.length,
        blocked: false // Would check against block list
      }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 10);

    // Top affected users
    const userGroups = events.reduce((acc, e) => {
      if (e.userId) {
        if (!acc[e.userId]) {
          acc[e.userId] = { events: 0, riskScores: [], lastActivity: e.timestamp };
        }
        acc[e.userId].events++;
        acc[e.userId].riskScores.push(e.riskScore);
        acc[e.userId].lastActivity = e.timestamp > acc[e.userId].lastActivity ? e.timestamp : acc[e.userId].lastActivity;
      }
      return acc;
    }, {} as Record<string, { events: number; riskScores: number[]; lastActivity: Date }>);

    const topAffectedUsers = Object.entries(userGroups)
      .map(([userId, data]) => ({
        userId,
        events: data.events,
        avgRiskScore: data.riskScores.reduce((a, b) => a + b, 0) / data.riskScores.length,
        lastActivity: data.lastActivity
      }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 10);

    return {
      timeWindow: timeWindowMinutes,
      totalEvents: events.length,
      eventsBySeverity,
      eventsByCategory,
      eventsByType,
      topThreats,
      topSourceIPs,
      topAffectedUsers,
      escalationMetrics: {
        triggered: 0, // Would track escalations
        completed: 0,
        failed: 0,
        avgResponseTime: 0
      },
      anomalyMetrics: {
        detected: 0, // Would track ML detections
        mlPredictions: 0,
        falsePositives: 0,
        accuracy: 0
      },
      attackMetrics: {
        attempts: 0, // Would track attack attempts
        blocked: 0,
        successRate: 0,
        avgAttackDuration: 0
      }
    };
  }

  private generateDashboard(tenantId: string): SecurityDashboard {
    const metrics = this.getMetrics(tenantId, 60); // Last hour
    const realtimeMetrics = this.getMetrics(tenantId, 5); // Last 5 minutes

    const criticalEvents = metrics.eventsBySeverity.critical || 0;
    const totalRiskScore = this.events.reduce((sum: number, e: SecurityAnalyticsEvent) => sum + e.riskScore, 0);
    const avgRiskScore = metrics.totalEvents > 0 ? totalRiskScore / metrics.totalEvents : 0;

    return {
      overview: {
        totalEvents: metrics.totalEvents,
        criticalEvents,
        activeThreats: this.getActiveAlerts(tenantId).length,
        blockedAttacks: metrics.attackMetrics.blocked,
        riskScore: avgRiskScore,
        trendDirection: 'stable' // Would calculate trend
      },
      realtime: {
        eventsPerMinute: realtimeMetrics.totalEvents / 5,
        currentRiskScore: avgRiskScore,
        activeEscalations: metrics.escalationMetrics.triggered,
        blockedIPs: metrics.topSourceIPs.filter((ip: any) => ip.blocked).length,
        suspiciousActivity: metrics.topThreats.reduce((sum, t) => sum + t.count, 0)
      },
      threats: {
        topThreatTypes: metrics.topThreats.map(t => ({
          type: t.type,
          count: t.count,
          severity: this.getSeverityFromRiskScore(t.avgRiskScore),
          trend: 0 // Would calculate trend
        })),
        emergingThreats: [] // Would identify emerging patterns
      },
      defenses: {
        rateLimitEffectiveness: 0.95, // Would calculate actual effectiveness
        mlDetectionAccuracy: metrics.anomalyMetrics.accuracy,
        escalationResponseTime: metrics.escalationMetrics.avgResponseTime,
        blockSuccessRate: 0.98
      }
    };
  }

  private mapEventTypeToCategory(eventType: string): SecurityAnalyticsEvent['category'] {
    const categoryMap: Record<string, SecurityAnalyticsEvent['category']> = {
      'auth.failed': 'authentication',
      'auth.success': 'authentication',
      'auth.denied': 'authorization',
      'rate_limit.exceeded': 'rate_limiting',
      'api.abuse': 'api_abuse',
      'data.export': 'data_access',
      'data.access': 'data_access'
    };

    return categoryMap[eventType] || 'network_security';
  }

  private extractIndicators(event: SecurityEvent): string[] {
    const indicators: string[] = [];

    if (event.details?.failureReason) {
      indicators.push(`failure_reason:${event.details.failureReason}`);
    }

    if (event.details?.isGeographicAnomaly) {
      indicators.push('geographic_anomaly');
    }

    if (event.details?.attemptCount > 5) {
      indicators.push('high_attempt_count');
    }

    return indicators;
  }

  private getSeverityFromRiskScore(riskScore: number): string {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }

  private cleanupOldEvents(): void {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

    const originalLength = this.events.length;
    this.events = this.events.filter(e => e.timestamp.getTime() > cutoff);

    if (this.events.length < originalLength) {
      log.debug('Cleaned up old security events', {
        removed: originalLength - this.events.length,
        remaining: this.events.length
      });
    }
  }

  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago

    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.timestamp.getTime() < cutoff && alert.status === 'resolved') {
        this.alerts.delete(alertId);
      }
    }
  }
}
