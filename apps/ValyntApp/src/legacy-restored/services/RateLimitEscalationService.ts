/**
 * Rate Limit Escalation Service
 *
 * Implements risk-based escalation engine as defined in threat-model.md:
 * - Dynamic rate limit adjustments based on threat scores
 * - Automated response actions (log, reduce_limit, temp_block, permanent_block)
 * - Recovery scheduling and policy enforcement
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TenantAwareService } from './TenantAwareService';
import { log } from '../lib/logger';
import { SecurityEvent } from './AdvancedThreatDetectionService';

export interface EscalationRule {
  riskThreshold: number;
  action: 'log' | 'reduce_limit' | 'temp_block' | 'extended_block' | 'permanent_block';
  duration: number; // milliseconds
  reduction?: number; // percentage for limit reduction
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface ThreatContext {
  tenantId: string;
  userId?: string;
  ip?: string;
  endpoint?: string;
  riskScore: number;
  threatTypes: string[];
  timeWindow: number;
  additionalData: Record<string, any>;
}

export interface EscalationAction {
  id: string;
  type: EscalationRule['action'];
  target: string; // user ID, IP, or global
  rule: EscalationRule;
  context: ThreatContext;
  executedAt: Date;
  expiresAt?: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'expired';
  result?: string;
  metadata: Record<string, any>;
}

export interface RateLimitAdjustment {
  key: string;
  originalLimit: number;
  newLimit: number;
  reductionPercentage: number;
  reason: string;
  expiresAt: Date;
  isActive: boolean;
}

export class RateLimitEscalationService extends TenantAwareService {
  private escalationRules = new Map<number, EscalationRule>([
    [0.3, {
      riskThreshold: 0.3,
      action: 'log',
      duration: 15 * 60 * 1000, // 15 minutes
      severity: 'low',
      description: 'Low-level threat detected - logging only'
    }],
    [0.5, {
      riskThreshold: 0.5,
      action: 'reduce_limit',
      duration: 30 * 60 * 1000, // 30 minutes
      reduction: 50, // 50% reduction
      severity: 'medium',
      description: 'Medium threat - rate limit reduced by 50%'
    }],
    [0.7, {
      riskThreshold: 0.7,
      action: 'temp_block',
      duration: 60 * 60 * 1000, // 1 hour
      severity: 'high',
      description: 'High threat - temporary block applied'
    }],
    [0.8, {
      riskThreshold: 0.8,
      action: 'extended_block',
      duration: 6 * 60 * 60 * 1000, // 6 hours
      severity: 'high',
      description: 'Critical threat - extended block applied'
    }],
    [0.9, {
      riskThreshold: 0.9,
      action: 'permanent_block',
      duration: 0, // Permanent
      severity: 'critical',
      description: 'Severe threat - permanent block applied'
    }]
  ]);

  private activeActions = new Map<string, EscalationAction>();
  private rateLimitAdjustments = new Map<string, RateLimitAdjustment>();
  private blockedIPs = new Set<string>();
  private blockedUsers = new Set<string>();

  constructor(supabase: SupabaseClient) {
    super('RateLimitEscalationService');
    this.supabase = supabase;

    // Initialize recovery scheduler
    this.initializeRecoveryScheduler();
  }

  /**
   * Main escalation entry point
   */
  async escalate(key: string, riskScore: number, context: ThreatContext): Promise<{
    action: EscalationAction | null;
    previousActions: EscalationAction[];
    recommendations: string[];
  }> {
    log.info('Rate limit escalation triggered', { key, riskScore, context });

    try {
      // Find applicable escalation rule
      const rule = this.findEscalationRule(riskScore);
      if (!rule) {
        log.debug('No escalation rule found for risk score', { riskScore });
        return {
          action: null,
          previousActions: this.getPreviousActions(key),
          recommendations: ['Monitor for further activity']
        };
      }

      // Check if escalation is already active
      const existingAction = this.getActiveAction(key);
      if (existingAction && this.shouldSkipEscalation(existingAction, rule)) {
        log.debug('Skipping escalation - higher severity action already active', {
          key,
          existingAction: existingAction.type,
          newAction: rule.action
        });
        return {
          action: null,
          previousActions: this.getPreviousActions(key),
          recommendations: ['Current escalation already in effect']
        };
      }

      // Execute escalation action
      const action = await this.executeEscalationAction(key, rule, context);

      // Store action
      this.activeActions.set(action.id, action);

      // Log to database
      await this.logEscalationAction(action);

      // Generate recommendations
      const recommendations = this.generateEscalationRecommendations(action, context);

      log.info('Escalation action executed', {
        actionId: action.id,
        type: action.type,
        target: action.target,
        riskScore
      });

      return {
        action,
        previousActions: this.getPreviousActions(key),
        recommendations
      };
    } catch (error) {
      log.error('Escalation failed', error as Error, { key, riskScore, context });
      throw error;
    }
  }

  /**
   * Check if a key is currently blocked or rate limited
   */
  async checkEscalationStatus(key: string): Promise<{
    isBlocked: boolean;
    isRateLimited: boolean;
    currentLimit?: number;
    blockExpiresAt?: Date;
    activeActions: EscalationAction[];
  }> {
    const activeActions = this.getPreviousActions(key).filter(action =>
      action.status === 'executing' ||
      (action.expiresAt && action.expiresAt > new Date())
    );

    const isBlocked = activeActions.some(action =>
      ['temp_block', 'extended_block', 'permanent_block'].includes(action.type)
    );

    const rateLimitAdjustment = Array.from(this.rateLimitAdjustments.values())
      .find(adj => adj.key === key && adj.isActive);

    return {
      isBlocked,
      isRateLimited: !!rateLimitAdjustment,
      currentLimit: rateLimitAdjustment?.newLimit,
      blockExpiresAt: activeActions.find(a => a.expiresAt)?.expiresAt,
      activeActions
    };
  }

  /**
   * Process security event for automatic escalation
   */
  async processSecurityEvent(event: SecurityEvent): Promise<{
    escalated: boolean;
    actions: EscalationAction[];
  }> {
    // Calculate risk score from event
    const riskScore = this.calculateEventRiskScore(event);

    if (riskScore < 0.3) {
      return { escalated: false, actions: [] };
    }

    // Determine escalation key
    const key = this.generateEscalationKey(event);

    // Create threat context
    const context: ThreatContext = {
      tenantId: event.tenantId,
      userId: event.userId,
      ip: event.details?.ip,
      endpoint: event.details?.endpoint,
      riskScore,
      threatTypes: [event.eventType],
      timeWindow: 5, // 5 minutes
      additionalData: event.details || {}
    };

    // Trigger escalation
    const result = await this.escalate(key, riskScore, context);

    return {
      escalated: !!result.action,
      actions: result.action ? [result.action] : []
    };
  }

  /**
   * Find the appropriate escalation rule for a risk score
   */
  private findEscalationRule(riskScore: number): EscalationRule | null {
    // Find the highest threshold that's less than or equal to the risk score
    const thresholds = Array.from(this.escalationRules.keys()).sort((a, b) => b - a);

    for (const threshold of thresholds) {
      if (riskScore >= threshold) {
        return this.escalationRules.get(threshold)!;
      }
    }

    return null;
  }

  /**
   * Execute the specific escalation action
   */
  private async executeEscalationAction(
    key: string,
    rule: EscalationRule,
    context: ThreatContext
  ): Promise<EscalationAction> {
    const action: EscalationAction = {
      id: `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: rule.action,
      target: key,
      rule,
      context,
      executedAt: new Date(),
      expiresAt: rule.duration > 0 ? new Date(Date.now() + rule.duration) : undefined,
      status: 'executing',
      metadata: {}
    };

    switch (rule.action) {
      case 'log':
        await this.executeLogAction(action);
        break;
      case 'reduce_limit':
        await this.executeReduceLimitAction(action);
        break;
      case 'temp_block':
        await this.executeTempBlockAction(action);
        break;
      case 'extended_block':
        await this.executeExtendedBlockAction(action);
        break;
      case 'permanent_block':
        await this.executePermanentBlockAction(action);
        break;
      default:
        throw new Error(`Unknown escalation action: ${rule.action}`);
    }

    action.status = 'completed';
    return action;
  }

  /**
   * Execute log action
   */
  private async executeLogAction(action: EscalationAction): Promise<void> {
    log.warn('Threat detected - logging action', {
      actionId: action.id,
      target: action.target,
      riskScore: action.context.riskScore,
      threatTypes: action.context.threatTypes,
      description: action.rule.description
    });

    action.result = 'Threat logged successfully';
    action.metadata.logLevel = 'warning';
  }

  /**
   * Execute rate limit reduction action
   */
  private async executeReduceLimitAction(action: EscalationAction): Promise<void> {
    const reduction = action.rule.reduction || 50;
    const key = action.target;

    // Get current rate limit
    const currentLimit = await this.getCurrentRateLimit(key);
    if (!currentLimit) {
      log.warn('Could not find current rate limit for key', { key });
      action.status = 'failed';
      action.result = 'Current rate limit not found';
      return;
    }

    // Calculate new limit
    const newLimit = Math.max(1, Math.floor(currentLimit * (1 - reduction / 100)));

    // Apply rate limit adjustment
    const adjustment: RateLimitAdjustment = {
      key,
      originalLimit: currentLimit,
      newLimit,
      reductionPercentage: reduction,
      reason: `Threat escalation - ${action.rule.description}`,
      expiresAt: action.expiresAt!,
      isActive: true
    };

    this.rateLimitAdjustments.set(`${key}_${action.id}`, adjustment);

    // Update rate limiter (this would integrate with actual rate limiting middleware)
    await this.updateRateLimit(key, newLimit);

    // Schedule recovery
    this.scheduleRecovery(key, action.rule.duration);

    log.info('Rate limit reduced', {
      actionId: action.id,
      key,
      originalLimit: currentLimit,
      newLimit,
      reduction,
      expiresAt: action.expiresAt
    });

    action.result = `Rate limit reduced from ${currentLimit} to ${newLimit}`;
    action.metadata.adjustment = adjustment;
  }

  /**
   * Execute temporary block action
   */
  private async executeTempBlockAction(action: EscalationAction): Promise<void> {
    const key = action.target;

    // Add to block list
    if (key.startsWith('user:')) {
      this.blockedUsers.add(key);
    } else if (key.startsWith('ip:')) {
      this.blockedIPs.add(key);
    }

    // Schedule recovery
    this.scheduleRecovery(key, action.rule.duration);

    log.warn('Temporary block applied', {
      actionId: action.id,
      target: key,
      duration: action.rule.duration,
      expiresAt: action.expiresAt
    });

    action.result = `Temporary block applied for ${action.rule.duration / 60000} minutes`;
    action.metadata.blockType = 'temporary';
  }

  /**
   * Execute extended block action
   */
  private async executeExtendedBlockAction(action: EscalationAction): Promise<void> {
    const key = action.target;

    // Add to block list
    if (key.startsWith('user:')) {
      this.blockedUsers.add(key);
    } else if (key.startsWith('ip:')) {
      this.blockedIPs.add(key);
    }

    // Notify security team
    await this.notifySecurityTeam(action);

    // Schedule recovery
    this.scheduleRecovery(key, action.rule.duration);

    log.error('Extended block applied', undefined, {
      actionId: action.id,
      target: key,
      duration: action.rule.duration,
      expiresAt: action.expiresAt
    });

    action.result = `Extended block applied for ${action.rule.duration / 3600000} hours`;
    action.metadata.blockType = 'extended';
  }

  /**
   * Execute permanent block action
   */
  private async executePermanentBlockAction(action: EscalationAction): Promise<void> {
    const key = action.target;

    // Add to permanent block list
    if (key.startsWith('user:')) {
      this.blockedUsers.add(key);
    } else if (key.startsWith('ip:')) {
      this.blockedIPs.add(key);
    }

    // Create security incident
    await this.createSecurityIncident(action);

    // Notify security team immediately
    await this.notifySecurityTeam(action);

    log.error('Permanent block applied', undefined, {
      actionId: action.id,
      target: key,
      riskScore: action.context.riskScore
    });

    action.result = 'Permanent block applied - security incident created';
    action.metadata.blockType = 'permanent';
  }

  /**
   * Check if escalation should be skipped due to existing higher severity action
   */
  private shouldSkipEscalation(existingAction: EscalationAction, newRule: EscalationRule): boolean {
    const severityOrder = ['log', 'reduce_limit', 'temp_block', 'extended_block', 'permanent_block'];
    const existingIndex = severityOrder.indexOf(existingAction.type);
    const newIndex = severityOrder.indexOf(newRule.action);

    return existingIndex >= newIndex;
  }

  /**
   * Generate escalation key from security event
   */
  private generateEscalationKey(event: SecurityEvent): string {
    if (event.userId) {
      return `user:${event.userId}`;
    }
    if (event.details?.ip) {
      return `ip:${event.details.ip}`;
    }
    return `tenant:${event.tenantId}:global`;
  }

  /**
   * Calculate risk score from security event
   */
  private calculateEventRiskScore(event: SecurityEvent): number {
    let score = 0;

    // Base score from severity
    switch (event.severity) {
      case 'critical': score += 0.8; break;
      case 'high': score += 0.6; break;
      case 'medium': score += 0.4; break;
      case 'low': score += 0.2; break;
    }

    // Add score from event type
    const eventTypeScores: Record<string, number> = {
      'auth.failed': 0.3,
      'auth.denied': 0.4,
      'rate_limit.exceeded': 0.5,
      'api.abuse': 0.6,
      'data.exfiltration': 0.8,
      'privilege_escalation': 0.9
    };

    score += eventTypeScores[event.eventType] || 0.1;

    // Add score from existing risk score if available
    if (event.riskScore) {
      score = Math.max(score, event.riskScore / 100);
    }

    return Math.min(score, 1.0);
  }

  /**
   * Get previous actions for a key
   */
  private getPreviousActions(key: string): EscalationAction[] {
    return Array.from(this.activeActions.values())
      .filter(action => action.target === key)
      .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
  }

  /**
   * Get active action for a key
   */
  private getActiveAction(key: string): EscalationAction | null {
    return this.getPreviousActions(key).find(action =>
      action.status === 'executing' ||
      (action.expiresAt && action.expiresAt > new Date())
    ) || null;
  }

  /**
   * Schedule recovery for rate limit adjustments
   */
  private scheduleRecovery(key: string, duration: number): void {
    setTimeout(async () => {
      await this.recoverRateLimit(key);
    }, duration);
  }

  /**
   * Recover rate limit to original value
   */
  private async recoverRateLimit(key: string): Promise<void> {
    const adjustments = Array.from(this.rateLimitAdjustments.values())
      .filter(adj => adj.key === key && adj.isActive);

    for (const adjustment of adjustments) {
      adjustment.isActive = false;

      // Restore original limit
      await this.updateRateLimit(key, adjustment.originalLimit);

      log.info('Rate limit recovered', {
        key,
        originalLimit: adjustment.originalLimit,
        restoredAt: new Date()
      });
    }
  }

  /**
   * Initialize recovery scheduler
   */
  private initializeRecoveryScheduler(): void {
    // Check for expired actions every minute
    setInterval(() => {
      this.cleanupExpiredActions();
    }, 60 * 1000);
  }

  /**
   * Clean up expired actions
   */
  private cleanupExpiredActions(): void {
    const now = new Date();

    for (const [id, action] of this.activeActions.entries()) {
      if (action.expiresAt && action.expiresAt < now) {
        action.status = 'expired';

        // Remove from block lists
        if (['temp_block', 'extended_block'].includes(action.type)) {
          if (action.target.startsWith('user:')) {
            this.blockedUsers.delete(action.target);
          } else if (action.target.startsWith('ip:')) {
            this.blockedIPs.delete(action.target);
          }
        }

        log.info('Escalation action expired', {
          actionId: id,
          type: action.type,
          target: action.target
        });
      }
    }
  }

  /**
   * Generate escalation recommendations
   */
  private generateEscalationRecommendations(action: EscalationAction, context: ThreatContext): string[] {
    const recommendations: string[] = [];

    switch (action.type) {
      case 'log':
        recommendations.push('Continue monitoring for escalation');
        if (context.riskScore > 0.4) {
          recommendations.push('Consider implementing additional authentication');
        }
        break;

      case 'reduce_limit':
        recommendations.push('Monitor user behavior during reduced rate limit');
        recommendations.push('Review recent activity patterns');
        break;

      case 'temp_block':
        recommendations.push('Investigate source of suspicious activity');
        recommendations.push('Consider additional verification requirements');
        break;

      case 'extended_block':
        recommendations.push('Immediate security team notification sent');
        recommendations.push('Review all recent activity from blocked source');
        break;

      case 'permanent_block':
        recommendations.push('Security incident created - immediate investigation required');
        recommendations.push('Review and update security policies');
        break;
    }

    return recommendations;
  }

  // Integration methods (would connect to actual services)
  private async getCurrentRateLimit(key: string): Promise<number | null> {
    // This would integrate with the actual rate limiting service
    return 60; // Default fallback
  }

  private async updateRateLimit(key: string, newLimit: number): Promise<void> {
    // This would update the actual rate limiting middleware
    log.debug('Rate limit updated', { key, newLimit });
  }

  private async logEscalationAction(action: EscalationAction): Promise<void> {
    try {
      await this.supabase.from('rate_limit_escalations').insert({
        id: action.id,
        type: action.type,
        target: action.target,
        risk_score: action.context.riskScore,
        threat_types: action.context.threatTypes,
        rule_description: action.rule.description,
        executed_at: action.executedAt.toISOString(),
        expires_at: action.expiresAt?.toISOString(),
        status: action.status,
        result: action.result,
        metadata: action.metadata
      });
    } catch (error) {
      log.error('Failed to log escalation action', error as Error);
    }
  }

  private async notifySecurityTeam(action: EscalationAction): Promise<void> {
    // This would integrate with notification systems
    log.error('Security team notification', undefined, {
      actionId: action.id,
      type: action.type,
      target: action.target,
      severity: action.rule.severity
    });
  }

  private async createSecurityIncident(action: EscalationAction): Promise<void> {
    try {
      await this.supabase.from('security_incidents').insert({
        tenant_id: action.context.tenantId,
        title: `Permanent Block: ${action.target}`,
        description: `Automatic permanent block due to ${action.rule.description}`,
        severity: 'critical',
        incident_type: 'rate_limit_escalation',
        affected_resources: [action.target],
        threat_indicators: action.context.threatTypes,
        risk_score: action.context.riskScore * 100,
        detected_at: action.executedAt.toISOString(),
        status: 'detected'
      });
    } catch (error) {
      log.error('Failed to create security incident', error as Error);
    }
  }

  /**
   * Check if IP or user is blocked
   */
  public isBlocked(key: string): boolean {
    if (key.startsWith('user:')) {
      return this.blockedUsers.has(key);
    }
    if (key.startsWith('ip:')) {
      return this.blockedIPs.has(key);
    }
    return false;
  }

  /**
   * Get adjusted rate limit for key
   */
  public getAdjustedRateLimit(key: string): number | null {
    const adjustment = Array.from(this.rateLimitAdjustments.values())
      .find(adj => adj.key === key && adj.isActive);

    return adjustment ? adjustment.newLimit : null;
  }
}
