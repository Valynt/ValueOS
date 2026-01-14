import { SupabaseClient } from '@supabase/supabase-js';
import { TenantAwareService } from './TenantAwareService';
import { log } from '../lib/logger';
import { sanitizeUser } from '../lib/piiFilter';
import { MLAnomalyDetectionService, AnomalyDetectionResult } from './MLAnomalyDetectionService';
import { DynamicBaselineService } from './DynamicBaselineService';

export interface SecurityEvent {
  id: string;
  tenantId: string;
  userId?: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details: Record<string, any>;
  timestamp: Date;
  riskScore: number;
}

export interface ThreatIndicator {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectionLogic: (event: SecurityEvent) => boolean;
  riskScore: number;
}

export interface AnomalyPattern {
  id: string;
  name: string;
  description: string;
  baseline: {
    mean: number;
    stdDev: number;
    threshold: number;
  };
  window: number; // minutes
  category: string;
}

export interface UserActivity {
  id: string;
  user_id: string;
  activity_type: string;
  details: Record<string, any>;
  created_at: Date;
}

export interface BehaviorAnalysis {
  anomalies: Array<{ type: string; description: string; severity: string }>;
  patterns: {
    totalActivities: number;
    unusualHoursCount: number;
    locationChangesCount: number;
    securityFailuresCount: number;
  };
}

export class AdvancedThreatDetectionService extends TenantAwareService {
  private readonly threatIndicators: ThreatIndicator[] = [
    {
      id: 'brute_force_attempt',
      name: 'Brute Force Attack',
      description: 'Multiple failed authentication attempts from same source',
      category: 'authentication',
      severity: 'high',
      riskScore: 80,
      detectionLogic: (event) => {
        return event.eventType === 'auth.failed' &&
               event.details?.failureReason === 'invalid_credentials' &&
               event.details?.attemptCount > 5;
      }
    },
    {
      id: 'suspicious_login_location',
      name: 'Geographic Anomaly',
      description: 'Login from unusual geographic location',
      category: 'authentication',
      severity: 'medium',
      riskScore: 60,
      detectionLogic: (event) => {
        return event.eventType === 'auth.success' &&
               event.details?.isGeographicAnomaly === true;
      }
    },
    {
      id: 'privilege_escalation',
      name: 'Privilege Escalation Attempt',
      description: 'User attempting to access resources beyond their permission level',
      category: 'authorization',
      severity: 'critical',
      riskScore: 95,
      detectionLogic: (event) => {
        return event.eventType === 'auth.denied' &&
               event.details?.reason === 'insufficient_permissions' &&
               event.details?.resourceType === 'admin';
      }
    },
    {
      id: 'data_exfiltration',
      name: 'Potential Data Exfiltration',
      description: 'Unusual volume of data export activity',
      category: 'data_access',
      severity: 'high',
      riskScore: 85,
      detectionLogic: (event) => {
        return event.eventType === 'data.export' &&
               event.details?.recordCount > 10000;
      }
    },
    {
      id: 'api_abuse',
      name: 'API Abuse Pattern',
      description: 'Unusual API call patterns indicating automated attacks',
      category: 'api',
      severity: 'medium',
      riskScore: 70,
      detectionLogic: (event) => {
        return event.eventType === 'api.rate_limit_exceeded' &&
               event.details?.timeWindow === 'minute' &&
               event.details?.requestCount > 100;
      }
    }
  ];

  private readonly anomalyPatterns: AnomalyPattern[] = [
    {
      id: 'login_spike',
      name: 'Login Spike Anomaly',
      description: 'Unusual spike in login attempts',
      baseline: { mean: 50, stdDev: 10, threshold: 3 },
      window: 60, // 1 hour
      category: 'authentication'
    },
    {
      id: 'api_traffic_anomaly',
      name: 'API Traffic Anomaly',
      description: 'Unusual API traffic patterns',
      baseline: { mean: 1000, stdDev: 200, threshold: 2.5 },
      window: 15, // 15 minutes
      category: 'api'
    },
    {
      id: 'data_access_anomaly',
      name: 'Data Access Anomaly',
      description: 'Unusual data access patterns',
      baseline: { mean: 100, stdDev: 25, threshold: 3 },
      window: 30, // 30 minutes
      category: 'data_access'
    }
  ];

  private mlService: MLAnomalyDetectionService;
  private baselineService: DynamicBaselineService;
  private auditLog: any; // Simplified audit log for now

  constructor(supabase: SupabaseClient) {
    super('AdvancedThreatDetectionService');
    this.supabase = supabase;
    this.mlService = new MLAnomalyDetectionService(supabase);
    this.baselineService = new DynamicBaselineService(supabase);
    this.auditLog = {
      log: async (data: any) => {
        // Simplified audit logging
        log.info('Audit log', data);
      }
    };
  }

  /**
   * Analyzes security events for threats using indicator-based detection
   */
  async analyzeSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'riskScore'>): Promise<{
    threats: ThreatIndicator[];
    riskScore: number;
    recommendations: string[];
  }> {
    const fullEvent: SecurityEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      riskScore: 0
    };

    const detectedThreats: ThreatIndicator[] = [];
    let totalRiskScore = 0;

    // Check against all threat indicators
    for (const indicator of this.threatIndicators) {
      if (indicator.detectionLogic(fullEvent)) {
        detectedThreats.push(indicator);
        totalRiskScore = Math.max(totalRiskScore, indicator.riskScore);
      }
    }

    // Store the security event
    await this.storeSecurityEvent(fullEvent);

    // Check for behavioral anomalies
    const anomalies = await this.detectAnomalies(fullEvent);

    // Generate recommendations
    const recommendations = this.generateRecommendations(detectedThreats, anomalies);

    // Log threat detection
    if (detectedThreats.length > 0) {
      await this.auditLog.log({
        userId: event.userId || 'system',
        action: 'threat.detected',
        resourceType: 'security_event',
        resourceId: fullEvent.id,
        details: {
          tenantId: event.tenantId,
          threats: detectedThreats.map(t => t.name),
          riskScore: totalRiskScore,
          eventType: event.eventType
        },
        status: totalRiskScore >= 80 ? 'critical' : 'warning'
      });

      log.warn('Threat detected', {
        eventId: fullEvent.id,
        tenantId: event.tenantId,
        userId: event.userId,
        threats: detectedThreats.map(t => t.name),
        riskScore: totalRiskScore
      });
    }

    return {
      threats: detectedThreats,
      riskScore: totalRiskScore,
      recommendations
    };
  }

  /**
   * Performs behavioral analytics to detect anomalies using ML models
   */
  async detectAnomalies(event: SecurityEvent): Promise<AnomalyPattern[]> {
    try {
      // Use ML service for advanced anomaly detection
      const mlAnalysis = await this.mlService.analyzeEvent(event);

      // Convert ML results to AnomalyPattern format for compatibility
      const detectedAnomalies: AnomalyPattern[] = [];

      for (const anomaly of mlAnalysis.anomalies) {
        if (anomaly.isAnomalous) {
          // Map ML anomaly types to existing patterns
          const pattern = this.mapMLAnomalyToPattern(anomaly);
          if (pattern) {
            detectedAnomalies.push(pattern);
          }
        }
      }

      return detectedAnomalies;
    } catch (error) {
      log.error('ML anomaly detection failed, falling back to statistical', error as Error);

      // Fallback to statistical detection
      return this.detectAnomaliesStatistical(event);
    }
  }

  /**
   * Fallback statistical anomaly detection
   */
  private async detectAnomaliesStatistical(event: SecurityEvent): Promise<AnomalyPattern[]> {
    const detectedAnomalies: AnomalyPattern[] = [];

    for (const pattern of this.anomalyPatterns) {
      const isAnomalous = await this.checkAnomalyPattern(event, pattern);
      if (isAnomalous) {
        detectedAnomalies.push(pattern);
      }
    }

    return detectedAnomalies;
  }

  /**
   * Map ML anomaly results to existing pattern format
   */
  private mapMLAnomalyToPattern(mlAnomaly: AnomalyDetectionResult): AnomalyPattern | null {
    switch (mlAnomaly.anomalyType) {
      case 'temporal':
        return this.anomalyPatterns.find(p => p.id === 'login_spike') || null;
      case 'behavioral':
        return this.anomalyPatterns.find(p => p.id === 'data_access_anomaly') || null;
      case 'network':
        return this.anomalyPatterns.find(p => p.id === 'api_traffic_anomaly') || null;
      case 'resource':
        return this.anomalyPatterns.find(p => p.id === 'api_traffic_anomaly') || null;
      default:
        return null;
    }
  }

  /**
   * Analyzes user behavior patterns for insider threats
   */
  async analyzeUserBehavior(
    userId: string,
    tenantId: string,
    timeWindow: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<{
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    indicators: string[];
    recommendations: string[];
  }> {
    await this.validateTenantAccess(userId, tenantId);

    const startTime = new Date(Date.now() - timeWindow);

    // Get user's activity history
    const activities = await this.queryWithTenantCheck<UserActivity>(
      'user_activity_log',
      userId,
      {
        user_id: userId,
        created_at: { gte: startTime }
      }
    );

    const securityEvents = await this.queryWithTenantCheck<SecurityEvent>(
      'security_events',
      userId,
      {
        user_id: userId,
        timestamp: { gte: startTime }
      }
    );

    // Analyze behavior patterns
    const behaviorAnalysis = this.analyzeBehaviorPatterns(activities, securityEvents);

    // Determine risk level
    const riskLevel = this.calculateUserRiskLevel(behaviorAnalysis);

    // Generate indicators and recommendations
    const indicators = behaviorAnalysis.anomalies.map(a => a.description);
    const recommendations = this.generateUserRecommendations(riskLevel, behaviorAnalysis);

    // Store behavior analysis
    await this.storeBehaviorAnalysis(userId, tenantId, behaviorAnalysis, riskLevel);

    return {
      riskLevel,
      indicators,
      recommendations
    };
  }

  /**
   * Generates automated incident response actions
   */
  async generateIncidentResponse(
    threats: ThreatIndicator[],
    event: SecurityEvent
  ): Promise<{
    actions: Array<{
      type: 'alert' | 'block' | 'quarantine' | 'investigate';
      priority: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      automated: boolean;
    }>;
    escalationRequired: boolean;
  }> {
    const actions: Array<{
      type: 'alert' | 'block' | 'quarantine' | 'investigate';
      priority: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      automated: boolean;
    }> = [];

    const maxSeverity = Math.max(...threats.map(t => this.severityToNumber(t.severity)));
    const escalationRequired = maxSeverity >= this.severityToNumber('high');

    // Always create alert
    actions.push({
      type: 'alert',
      priority: this.numberToSeverity(maxSeverity),
      description: `Security alert: ${threats.map(t => t.name).join(', ')}`,
      automated: true
    });

    // Automated responses based on threat type
    for (const threat of threats) {
      switch (threat.id) {
        case 'brute_force_attempt':
          actions.push({
            type: 'block',
            priority: 'high',
            description: 'Temporarily block IP address due to brute force attempts',
            automated: true
          });
          break;

        case 'privilege_escalation':
          actions.push({
            type: 'quarantine',
            priority: 'critical',
            description: 'Quarantine user account for security review',
            automated: true
          });
          break;

        case 'data_exfiltration':
          actions.push({
            type: 'investigate',
            priority: 'high',
            description: 'Flag for immediate security investigation',
            automated: false
          });
          break;
      }
    }

    // Log incident response generation
    await this.auditLog.log({
      userId: event.userId || 'system',
      action: 'incident.response_generated',
      resourceType: 'security_event',
      resourceId: event.id,
      details: {
        tenantId: event.tenantId,
        threatCount: threats.length,
        actionsCount: actions.length,
        escalationRequired
      },
      status: 'success'
    });

    return { actions, escalationRequired };
  }

  // Private helper methods
  private async storeSecurityEvent(event: SecurityEvent): Promise<void> {
    await this.supabase
      .from('security_events')
      .insert({
        id: event.id,
        tenant_id: event.tenantId,
        user_id: event.userId,
        event_type: event.eventType,
        severity: event.severity,
        source: event.source,
        details: sanitizeUser(event.details),
        timestamp: event.timestamp,
        risk_score: event.riskScore
      });
  }

  private async checkAnomalyPattern(event: SecurityEvent, pattern: AnomalyPattern): Promise<boolean> {
    try {
      // Use dynamic baseline service instead of hardcoded values
      const currentValue = this.getEventValueForPattern(event, pattern);

      const anomalyResult = await this.baselineService.isAnomalous(
        event.tenantId,
        pattern.id,
        currentValue,
        'medium' // Default severity, could be dynamic based on context
      );

      // Record the metric for future learning
      await this.baselineService.recordMetric(
        event.tenantId,
        pattern.id,
        currentValue,
        {
          eventType: event.eventType,
          userId: event.userId,
          source: event.source
        }
      );

      return anomalyResult.isAnomalous;
    } catch (error) {
      log.error('Failed to check anomaly pattern with dynamic baseline', error as Error, {
        tenantId: event.tenantId,
        patternId: pattern.id
      });

      // Fallback to original statistical method
      return this.checkAnomalyPatternStatistical(event, pattern);
    }
  }

  /**
   * Fallback statistical anomaly detection (original method)
   */
  private async checkAnomalyPatternStatistical(event: SecurityEvent, pattern: AnomalyPattern): Promise<boolean> {
    const windowStart = new Date(Date.now() - pattern.window * 60 * 1000);

    // Get historical data for this pattern
    const historicalData = await this.supabase
      .from('security_metrics')
      .select('value')
      .eq('metric_name', pattern.id)
      .eq('tenant_id', event.tenantId)
      .gte('timestamp', windowStart)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (!historicalData.data || historicalData.data.length < 10) {
      return false; // Not enough data for anomaly detection
    }

    const values = historicalData.data.map((d: { value: number }) => d.value);
    const currentValue = this.getEventValueForPattern(event, pattern);

    // Simple statistical anomaly detection
    const mean = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / values.length
    );

    const zScore = Math.abs(currentValue - mean) / stdDev;
    return zScore > pattern.baseline.threshold;
  }

  private getEventValueForPattern(event: SecurityEvent, pattern: AnomalyPattern): number {
    // Map event data to pattern metrics
    switch (pattern.id) {
      case 'login_spike':
        return event.eventType === 'auth.success' ? 1 : 0;
      case 'api_traffic_anomaly':
        return event.eventType.startsWith('api.') ? 1 : 0;
      case 'data_access_anomaly':
        return event.eventType.includes('data') ? 1 : 0;
      default:
        return 0;
    }
  }

  private analyzeBehaviorPatterns(
    activities: UserActivity[],
    securityEvents: SecurityEvent[]
  ): BehaviorAnalysis {
    const anomalies: Array<{ type: string; description: string; severity: string }> = [];

    // Check for unusual access times
    const unusualHours = activities.filter(a => {
      const hour = new Date(a.created_at).getHours();
      return hour < 6 || hour > 22; // Outside 6 AM - 10 PM
    });

    if (unusualHours.length > activities.length * 0.3) {
      anomalies.push({
        type: 'unusual_hours',
        description: 'Unusual access during off-hours',
        severity: 'medium'
      });
    }

    // Check for rapid location changes
    const locationChanges = activities.filter(a =>
      a.details?.location !== activities[activities.indexOf(a) - 1]?.details?.location
    );

    if (locationChanges.length > activities.length * 0.5) {
      anomalies.push({
        type: 'location_hopping',
        description: 'Frequent location changes',
        severity: 'high'
      });
    }

    // Check for failed operations
    const failedOps = securityEvents.filter(e => e.severity === 'high' || e.severity === 'critical');
    if (failedOps.length > 5) {
      anomalies.push({
        type: 'high_failure_rate',
        description: 'High number of security failures',
        severity: 'high'
      });
    }

    return {
      anomalies,
      patterns: {
        totalActivities: activities.length,
        unusualHoursCount: unusualHours.length,
        locationChangesCount: locationChanges.length,
        securityFailuresCount: failedOps.length
      }
    };
  }

  private calculateUserRiskLevel(analysis: BehaviorAnalysis): 'low' | 'medium' | 'high' | 'critical' {
    const highSeverityAnomalies = analysis.anomalies.filter((a: { type: string; description: string; severity: string }) => a.severity === 'high' || a.severity === 'critical');

    if (highSeverityAnomalies.length >= 2) return 'critical';
    if (highSeverityAnomalies.length >= 1) return 'high';
    if (analysis.anomalies.length >= 3) return 'medium';
    return 'low';
  }

  private generateRecommendations(threats: ThreatIndicator[], anomalies: AnomalyPattern[]): string[] {
    const recommendations: string[] = [];

    if (threats.some(t => t.category === 'authentication')) {
      recommendations.push('Enable multi-factor authentication');
      recommendations.push('Implement account lockout policies');
    }

    if (threats.some(t => t.category === 'authorization')) {
      recommendations.push('Review and tighten role-based access controls');
      recommendations.push('Implement principle of least privilege');
    }

    if (anomalies.length > 0) {
      recommendations.push('Monitor user behavior patterns');
      recommendations.push('Implement behavioral analytics alerts');
    }

    return recommendations;
  }

  private generateUserRecommendations(
    riskLevel: string,
    analysis: BehaviorAnalysis
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push('Immediate account review required');
      recommendations.push('Temporary access suspension recommended');
    }

    if (analysis.anomalies.some((a: { type: string; description: string; severity: string }) => a.type === 'unusual_hours')) {
      recommendations.push('Verify legitimacy of off-hours access');
    }

    if (analysis.anomalies.some((a: { type: string; description: string; severity: string }) => a.type === 'location_hopping')) {
      recommendations.push('Review recent location changes');
    }

    return recommendations;
  }

  private severityToNumber(severity: string): number {
    switch (severity) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      case 'critical': return 4;
      default: return 1;
    }
  }

  private numberToSeverity(num: number): 'low' | 'medium' | 'high' | 'critical' {
    if (num >= 4) return 'critical';
    if (num >= 3) return 'high';
    if (num >= 2) return 'medium';
    return 'low';
  }

  private async storeBehaviorAnalysis(
    userId: string,
    tenantId: string,
    analysis: BehaviorAnalysis,
    riskLevel: string
  ): Promise<void> {
    await this.supabase
      .from('user_behavior_analysis')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        analysis_date: new Date(),
        risk_level: riskLevel,
        anomaly_count: analysis.anomalies.length,
        patterns: analysis.patterns
      });
  }
}
