/**
 * Security Monitor and Alerting System
 *
 * Provides real-time monitoring of security events,
 * automated alerting, and threat detection.
 */

import { logger } from '../lib/logger';
import { getAuditLogger, AgentAuditLog } from '../services/AgentAuditLogger';
import { getSecureSharedContext } from '../services/SecureSharedContext';
import { secureMessageBus } from '../lib/agent-fabric/SecureMessageBus';

// ============================================================================
// Types
// ============================================================================

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: Date;
  source: string;
  description: string;
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export type SecurityEventType =
  | 'context_share_denied'
  | 'context_share_blocked'
  | 'message_signature_invalid'
  | 'replay_attack_detected'
  | 'agent_compromised'
  | 'circuit_breaker_opened'
  | 'high_sensitivity_data_access'
  | 'unauthorized_communication_attempt'
  | 'encryption_failure'
  | 'audit_log_anomaly';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityAlert {
  id: string;
  eventId: string;
  type: AlertType;
  severity: SecuritySeverity;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  escalationLevel: number;
  autoResolved: boolean;
}

export type AlertType =
  | 'immediate_notification'
  | 'email_alert'
  | 'slack_notification'
  | 'pager_duty'
  | 'security_team_escalation'
  | 'management_escalation';

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsBySeverity: Record<SecuritySeverity, number>;
  activeAlerts: number;
  acknowledgedAlerts: number;
  escalatedAlerts: number;
  meanTimeToResolution: number;
  compromisedAgents: number;
  blockedCommunications: number;
}

export interface MonitoringConfig {
  alertThresholds: {
    deniedContextShares: number; // per minute
    invalidSignatures: number; // per minute
    replayAttacks: number; // per minute
    compromisedAgents: number; // total
  };
  escalationRules: {
    highSensitivityAccess: AlertType[];
    agentCompromised: AlertType[];
    circuitBreakerOpened: AlertType[];
  };
  retentionPeriod: number; // days
}

// ============================================================================
// Security Monitor Implementation
// ============================================================================

export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private events: Map<string, SecurityEvent> = new Map();
  private alerts: Map<string, SecurityAlert> = new Map();
  private auditLogger = getAuditLogger();
  private sharedContext = getSecureSharedContext();
  private config: MonitoringConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  private readonly DEFAULT_CONFIG: MonitoringConfig = {
    alertThresholds: {
      deniedContextShares: 5, // 5 per minute
      invalidSignatures: 3, // 3 per minute
      replayAttacks: 1, // 1 per minute
      compromisedAgents: 1, // 1 total
    },
    escalationRules: {
      highSensitivityAccess: ['immediate_notification', 'email_alert'],
      agentCompromised: ['immediate_notification', 'slack_notification', 'pager_duty'],
      circuitBreakerOpened: ['immediate_notification', 'security_team_escalation'],
    },
    retentionPeriod: 30, // 30 days
  };

  private constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.startMonitoring();
  }

  static getInstance(config?: Partial<MonitoringConfig>): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor(config);
    }
    return SecurityMonitor.instance;
  }

  /**
   * Start real-time monitoring
   */
  private startMonitoring(): void {
    // Monitor audit logs every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.analyzeAuditLogs();
    }, 30000);

    // Update metrics every 5 minutes
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 300000);

    logger.info('Security monitoring started', {
      alertThresholds: this.config.alertThresholds,
      escalationRules: Object.keys(this.config.escalationRules),
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    logger.info('Security monitoring stopped');
  }

  /**
   * Record a security event
   */
  recordEvent(
    type: SecurityEventType,
    severity: SecuritySeverity,
    source: string,
    description: string,
    details: Record<string, any>
  ): SecurityEvent {
    const event: SecurityEvent = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      timestamp: new Date(),
      source,
      description,
      details,
      resolved: false,
    };

    this.events.set(event.id, event);

    logger.warn('Security event recorded', {
      eventId: event.id,
      type,
      severity,
      source,
      description,
    });

    // Check if alert should be triggered
    this.evaluateAlerting(event);

    return event;
  }

  /**
   * Analyze recent audit logs for anomalies
   */
  private async analyzeAuditLogs(): Promise<void> {
    try {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const recentLogs = await this.auditLogger.query({
        startDate: oneMinuteAgo,
        limit: 1000,
      });

      // Analyze for patterns
      await this.analyzeDeniedContextShares(recentLogs);
      await this.analyzeInvalidSignatures(recentLogs);
      await this.analyzeReplayAttacks(recentLogs);
      await this.analyzeHighSensitivityAccess(recentLogs);
      await this.analyzeCommunicationPatterns(recentLogs);

    } catch (error) {
      logger.error('Error analyzing audit logs', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Analyze denied context shares
   */
  private async analyzeDeniedContextShares(logs: AgentAuditLog[]): Promise<void> {
    const deniedShares = logs.filter(log =>
      log.input_query === 'context_share_denied' && !log.success
    );

    if (deniedShares.length >= this.config.alertThresholds.deniedContextShares) {
      this.recordEvent(
        'context_share_denied',
        'high',
        'audit_analysis',
        `High rate of denied context shares: ${deniedShares.length} in last minute`,
        {
          count: deniedShares.length,
          threshold: this.config.alertThresholds.deniedContextShares,
          agents: deniedShares.map(log => log.agent_name),
          reasons: deniedShares.map(log => log.error_message),
        }
      );
    }
  }

  /**
   * Analyze invalid signatures
   */
  private async analyzeInvalidSignatures(logs: AgentAuditLog[]): Promise<void> {
    const signatureErrors = logs.filter(log =>
      log.error_message?.includes('signature') ||
      log.error_message?.includes('Invalid message signature')
    );

    if (signatureErrors.length >= this.config.alertThresholds.invalidSignatures) {
      this.recordEvent(
        'message_signature_invalid',
        'high',
        'audit_analysis',
        `High rate of invalid message signatures: ${signatureErrors.length} in last minute`,
        {
          count: signatureErrors.length,
          threshold: this.config.alertThresholds.invalidSignatures,
          agents: signatureErrors.map(log => log.agent_name),
        }
      );
    }
  }

  /**
   * Analyze replay attacks
   */
  private async analyzeReplayAttacks(logs: AgentAuditLog[]): Promise<void> {
    const replayAttacks = logs.filter(log =>
      log.error_message?.includes('replay') ||
      log.error_message?.includes('Replay attack detected')
    );

    if (replayAttacks.length >= this.config.alertThresholds.replayAttacks) {
      this.recordEvent(
        'replay_attack_detected',
        'critical',
        'audit_analysis',
        `Replay attack detected: ${replayAttacks.length} attempts in last minute`,
        {
          count: replayAttacks.length,
          threshold: this.config.alertThresholds.replayAttacks,
          agents: replayAttacks.map(log => log.agent_name),
        }
      );
    }
  }

  /**
   * Analyze high sensitivity data access
   */
  private async analyzeHighSensitivityAccess(logs: AgentAuditLog[]): Promise<void> {
    const highSensitivityAccess = logs.filter(log =>
      log.error_message?.includes('trust level') ||
      log.error_message?.includes('sensitive data') ||
      log.context?.metadata?.dataSensitivity === 'high'
    );

    if (highSensitivityAccess.length > 0) {
      this.recordEvent(
        'high_sensitivity_data_access',
        'high',
        'audit_analysis',
        `High sensitivity data access attempts: ${highSensitivityAccess.length} in last minute`,
        {
          count: highSensitivityAccess.length,
          agents: highSensitivityAccess.map(log => log.agent_name),
          contexts: highSensitivityAccess.map(log => log.context?.metadata),
        }
      );
    }
  }

  /**
   * Analyze communication patterns for anomalies
   */
  private async analyzeCommunicationPatterns(logs: AgentAuditLog[]): Promise<void> {
    // Group by agent pairs
    const agentPairs = new Map<string, number>();

    logs.forEach(log => {
      if (log.context?.metadata?.toAgent) {
        const pair = `${log.agent_name}-${log.context.metadata.toAgent}`;
        agentPairs.set(pair, (agentPairs.get(pair) || 0) + 1);
      }
    });

    // Look for unusual patterns
    for (const [pair, count] of agentPairs.entries()) {
      if (count > 20) { // More than 20 communications per minute
        this.recordEvent(
          'unauthorized_communication_attempt',
          'medium',
          'pattern_analysis',
          `Unusual communication pattern: ${count} messages for ${pair}`,
          {
            agentPair: pair,
            count,
            threshold: 20,
          }
        );
      }
    }
  }

  /**
   * Evaluate if an alert should be triggered
   */
  private evaluateAlerting(event: SecurityEvent): void {
    const alertTypes = this.config.escalationRules[event.type] || ['immediate_notification'];

    alertTypes.forEach(alertType => {
      this.createAlert(event.id, alertType, event.severity);
    });
  }

  /**
   * Create a security alert
   */
  private createAlert(
    eventId: string,
    type: AlertType,
    severity: SecuritySeverity
  ): SecurityAlert {
    const alert: SecurityAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventId,
      type,
      severity,
      message: this.generateAlertMessage(eventId, type, severity),
      timestamp: new Date(),
      acknowledged: false,
      escalationLevel: this.calculateEscalationLevel(severity),
      autoResolved: false,
    };

    this.alerts.set(alert.id, alert);

    // Send alert notification
    this.sendAlert(alert);

    return alert;
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(
    eventId: string,
    type: AlertType,
    severity: SecuritySeverity
  ): string {
    const event = this.events.get(eventId);
    if (!event) return 'Security alert generated';

    return `[${severity.toUpperCase()}] ${event.description} (${type})`;
  }

  /**
   * Calculate escalation level
   */
  private calculateEscalationLevel(severity: SecuritySeverity): number {
    switch (severity) {
      case 'critical': return 3;
      case 'high': return 2;
      case 'medium': return 1;
      case 'low': return 0;
      default: return 0;
    }
  }

  /**
   * Send alert notification
   */
  private sendAlert(alert: SecurityAlert): void {
    logger.warn('Security alert triggered', {
      alertId: alert.id,
      eventId: alert.eventId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      escalationLevel: alert.escalationLevel,
    });

    // In production, integrate with actual notification systems
    switch (alert.type) {
      case 'email_alert':
        this.sendEmailAlert(alert);
        break;
      case 'slack_notification':
        this.sendSlackAlert(alert);
        break;
      case 'pager_duty':
        this.sendPagerDutyAlert(alert);
        break;
      case 'security_team_escalation':
        this.escalateToSecurityTeam(alert);
        break;
      case 'management_escalation':
        this.escalateToManagement(alert);
        break;
      case 'immediate_notification':
        this.sendImmediateNotification(alert);
        break;
    }
  }

  /**
   * Send email alert (placeholder)
   */
  private sendEmailAlert(alert: SecurityAlert): void {
    logger.info('Email alert sent', { alertId: alert.id, message: alert.message });
    // TODO: Integrate with email service
  }

  /**
   * Send Slack alert (placeholder)
   */
  private sendSlackAlert(alert: SecurityAlert): void {
    logger.info('Slack alert sent', { alertId: alert.id, message: alert.message });
    // TODO: Integrate with Slack API
  }

  /**
   * Send PagerDuty alert (placeholder)
   */
  private sendPagerDutyAlert(alert: SecurityAlert): void {
    logger.info('PagerDuty alert sent', { alertId: alert.id, message: alert.message });
    // TODO: Integrate with PagerDuty API
  }

  /**
   * Escalate to security team (placeholder)
   */
  private escalateToSecurityTeam(alert: SecurityAlert): void {
    logger.warn('Security team escalation', { alertId: alert.id, message: alert.message });
    // TODO: Integrate with security team notification system
  }

  /**
   * Escalate to management (placeholder)
   */
  private escalateToManagement(alert: SecurityAlert): void {
    logger.error('Management escalation', { alertId: alert.id, message: alert.message });
    // TODO: Integrate with management notification system
  }

  /**
   * Send immediate notification (placeholder)
   */
  private sendImmediateNotification(alert: SecurityAlert): void {
    logger.warn('Immediate notification sent', { alertId: alert.id, message: alert.message });
    // TODO: Integrate with real-time notification system
  }

  /**
   * Get security metrics
   */
  getMetrics(): SecurityMetrics {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentEvents = Array.from(this.events.values())
      .filter(event => event.timestamp >= oneDayAgo);

    const eventsByType = recentEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<SecurityEventType, number>);

    const eventsBySeverity = recentEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<SecuritySeverity, number>);

    const activeAlerts = Array.from(this.alerts.values()).filter(
      alert => !alert.acknowledged && !alert.autoResolved
    );

    const acknowledgedAlerts = Array.from(this.alerts.values()).filter(
      alert => alert.acknowledged
    );

    const escalatedAlerts = activeAlerts.filter(
      alert => alert.escalationLevel >= 2
    );

    const resolvedEvents = recentEvents.filter(event => event.resolved);
    const meanTimeToResolution = resolvedEvents.length > 0
      ? resolvedEvents.reduce((sum, event) => {
          const resolutionTime = event.resolvedAt!.getTime() - event.timestamp.getTime();
          return sum + resolutionTime;
        }, 0) / resolvedEvents.length / 1000 / 60 // Convert to minutes
      : 0;

    const compromisedAgents = recentEvents.filter(
      event => event.type === 'agent_compromised'
    ).length;

    const blockedCommunications = recentEvents.filter(
      event => event.type === 'unauthorized_communication_attempt'
    ).length;

    return {
      totalEvents: recentEvents.length,
      eventsByType,
      eventsBySeverity,
      activeAlerts: activeAlerts.length,
      acknowledgedAlerts: acknowledgedAlerts.length,
      escalatedAlerts: escalatedAlerts.length,
      meanTimeToResolution,
      compromisedAgents,
      blockedCommunications,
    };
  }

  /**
   * Update metrics and perform cleanup
   */
  private updateMetrics(): void {
    const metrics = this.getMetrics();

    logger.info('Security metrics updated', metrics);

    // Cleanup old events
    this.cleanupOldEvents();
  }

  /**
   * Cleanup old events and alerts
   */
  private cleanupOldEvents(): void {
    const cutoffDate = new Date(
      Date.now() - this.config.retentionPeriod * 24 * 60 * 60 * 1000
    );

    let eventsCleaned = 0;
    for (const [id, event] of this.events.entries()) {
      if (event.timestamp < cutoffDate) {
        this.events.delete(id);
        eventsCleaned++;
      }
    }

    let alertsCleaned = 0;
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoffDate) {
        this.alerts.delete(id);
        alertsCleaned++;
      }
    }

    if (eventsCleaned > 0 || alertsCleaned > 0) {
      logger.debug('Security data cleanup completed', {
        eventsCleaned,
        alertsCleaned,
        retentionPeriod: this.config.retentionPeriod,
      });
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    logger.info('Security alert acknowledged', {
      alertId,
      acknowledgedBy,
      acknowledgedAt: alert.acknowledgedAt,
    });

    return true;
  }

  /**
   * Resolve a security event
   */
  resolveEvent(eventId: string, resolvedBy: string): boolean {
    const event = this.events.get(eventId);
    if (!event) return false;

    event.resolved = true;
    event.resolvedAt = new Date();
    event.resolvedBy = resolvedBy;

    // Auto-resolve related alerts
    for (const alert of this.alerts.values()) {
      if (alert.eventId === eventId && !alert.acknowledged) {
        alert.autoResolved = true;
      }
    }

    logger.info('Security event resolved', {
      eventId,
      resolvedBy,
      resolvedAt: event.resolvedAt,
    });

    return true;
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 50): SecurityEvent[] {
    return Array.from(this.events.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged && !alert.autoResolved)
      .sort((a, b) => b.escalationLevel - a.escalationLevel);
  }

  /**
   * Get event by ID
   */
  getEvent(eventId: string): SecurityEvent | undefined {
    return this.events.get(eventId);
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): SecurityAlert | undefined {
    return this.alerts.get(alertId);
  }
}

// ============================================================================
// Exports
// ============================================================================

export function getSecurityMonitor(config?: Partial<MonitoringConfig>): SecurityMonitor {
  return SecurityMonitor.getInstance(config);
}

export default {
  SecurityMonitor,
  getSecurityMonitor,
};
