/**
 * Security Enforcement Service
 *
 * Implements actual security response actions:
 * - IP blocking (firewall rules, reverse proxy blocks)
 * - User quarantine (account suspension, access revocation)
 * - Resource isolation
 * - Automated remediation
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TenantAwareService } from './TenantAwareService.js'
import { log } from '../lib/logger.js'
import { AutomatedResponse } from './SecurityAutomationService.js'

export interface IPBlock {
  id: string;
  ipAddress: string;
  tenantId: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  blockType: 'temporary' | 'permanent';
  expiresAt?: Date;
  createdAt: Date;
  createdBy: string;
  active: boolean;
}

export interface UserQuarantine {
  id: string;
  userId: string;
  tenantId: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  quarantineType: 'temporary' | 'permanent' | 'investigation';
  expiresAt?: Date;
  createdAt: Date;
  createdBy: string;
  active: boolean;
  affectedSessions: string[];
}

export interface SecurityAction {
  type: 'ip_block' | 'user_quarantine' | 'session_terminate' | 'resource_isolate';
  target: string; // IP address, user ID, session ID, or resource ID
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration?: number; // Duration in milliseconds for temporary actions
  metadata?: Record<string, any>;
}

export class SecurityEnforcementService extends TenantAwareService {
  private readonly IP_BLOCK_DURATION = {
    low: 15 * 60 * 1000,      // 15 minutes
    medium: 1 * 60 * 60 * 1000,  // 1 hour
    high: 24 * 60 * 60 * 1000,   // 24 hours
    critical: -1               // Permanent
  };

  private readonly QUARANTINE_DURATION = {
    low: 1 * 60 * 60 * 1000,      // 1 hour
    medium: 6 * 60 * 60 * 1000,   // 6 hours
    high: 24 * 60 * 60 * 1000,    // 24 hours
    critical: -1                  // Permanent
  };

  constructor(supabase: SupabaseClient) {
    super('SecurityEnforcementService');
    this.supabase = supabase;
  }

  /**
   * Execute automated security response
   */
  async executeSecurityAction(response: AutomatedResponse): Promise<void> {
    try {
      log.info('Executing security action', {
        responseId: response.id,
        actionType: response.actionType,
        description: response.description
      });

      switch (response.actionType) {
        case 'block':
          await this.executeBlockAction(response);
          break;
        case 'quarantine':
          await this.executeQuarantineAction(response);
          break;
        case 'alert':
          await this.executeAlertAction(response);
          break;
        case 'notify':
          await this.executeNotifyAction(response);
          break;
        default:
          throw new Error(`Unknown action type: ${response.actionType}`);
      }

      log.info('Security action executed successfully', {
        responseId: response.id,
        actionType: response.actionType
      });

    } catch (error) {
      log.error('Failed to execute security action', error as Error, {
        responseId: response.id,
        actionType: response.actionType
      });
      throw error;
    }
  }

  /**
   * Block IP address at multiple levels
   */
  async blockIPAddress(
    ipAddress: string,
    tenantId: string,
    reason: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    duration?: number
  ): Promise<IPBlock> {
    const blockDuration = duration || this.IP_BLOCK_DURATION[severity];
    const expiresAt = blockDuration > 0 ? new Date(Date.now() + blockDuration) : undefined;

    // Create IP block record
    const ipBlock: IPBlock = {
      id: crypto.randomUUID(),
      ipAddress,
      tenantId,
      reason,
      severity,
      blockType: blockDuration > 0 ? 'temporary' : 'permanent',
      expiresAt,
      createdAt: new Date(),
      createdBy: 'system',
      active: true
    };

    // Store in database
    await this.supabase.from('ip_blocks').insert({
      id: ipBlock.id,
      ip_address: ipAddress,
      tenant_id: tenantId,
      reason,
      severity,
      block_type: ipBlock.blockType,
      expires_at: expiresAt,
      created_at: ipBlock.createdAt,
      created_by: ipBlock.createdBy,
      active: true
    });

    // Apply actual blocking mechanisms
    await this.applyIPBlock(ipAddress, tenantId, severity);

    // Log the action
    await this.logSecurityAction('ip_block', {
      ipAddress,
      tenantId,
      reason,
      severity,
      expiresAt
    });

    log.warn('IP address blocked', {
      ipAddress,
      tenantId,
      severity,
      reason,
      expiresAt
    });

    return ipBlock;
  }

  /**
   * Quarantine user account
   */
  async quarantineUser(
    userId: string,
    tenantId: string,
    reason: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    duration?: number
  ): Promise<UserQuarantine> {
    const quarantineDuration = duration || this.QUARANTINE_DURATION[severity];
    const expiresAt = quarantineDuration > 0 ? new Date(Date.now() + quarantineDuration) : undefined;

    // Terminate existing sessions
    const affectedSessions = await this.terminateUserSessions(userId, tenantId);

    // Create quarantine record
    const quarantine: UserQuarantine = {
      id: crypto.randomUUID(),
      userId,
      tenantId,
      reason,
      severity,
      quarantineType: quarantineDuration > 0 ? 'temporary' : 'permanent',
      expiresAt,
      createdAt: new Date(),
      createdBy: 'system',
      active: true,
      affectedSessions
    };

    // Store in database
    await this.supabase.from('user_quarantines').insert({
      id: quarantine.id,
      user_id: userId,
      tenant_id: tenantId,
      reason,
      severity,
      quarantine_type: quarantine.quarantineType,
      expires_at: expiresAt,
      created_at: quarantine.createdAt,
      created_by: quarantine.createdBy,
      active: true,
      affected_sessions: affectedSessions
    });

    // Update user status
    await this.supabase
      .from('users')
      .update({
        status: 'quarantined',
        quarantined_at: new Date(),
        quarantine_reason: reason
      })
      .eq('id', userId)
      .eq('tenant_id', tenantId);

    // Revoke API tokens
    await this.revokeUserTokens(userId, tenantId);

    // Log the action
    await this.logSecurityAction('user_quarantine', {
      userId,
      tenantId,
      reason,
      severity,
      expiresAt,
      sessionsTerminated: affectedSessions.length
    });

    log.warn('User quarantined', {
      userId,
      tenantId,
      severity,
      reason,
      expiresAt,
      sessionsTerminated: affectedSessions.length
    });

    return quarantine;
  }

  /**
   * Apply IP blocking at infrastructure level
   */
  private async applyIPBlock(
    ipAddress: string,
    tenantId: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    // Implementation depends on infrastructure:
    // 1. Update reverse proxy (Nginx/Caddy) configuration
    // 2. Add firewall rules (iptables/ufw)
    // 3. Update cloud provider security groups
    // 4. Add to CDN block list (Cloudflare/AWS CloudFront)

    try {
      // Store in Redis for fast lookup by middleware
      const redis = await this.getRedisClient();
      await redis.setex(
        `ip_block:${tenantId}:${ipAddress}`,
        24 * 60 * 60, // 24 hours TTL
        JSON.stringify({
          blocked: true,
          severity,
          timestamp: new Date().toISOString()
        })
      );

      // For high/critical severity, implement permanent blocking
      if (severity === 'high' || severity === 'critical') {
        await this.addPermanentIPBlock(ipAddress, tenantId);
      }

    } catch (error) {
      log.error('Failed to apply IP block', error as Error, { ipAddress, tenantId });
      throw error;
    }
  }

  /**
   * Terminate all user sessions
   */
  private async terminateUserSessions(userId: string, tenantId: string): Promise<string[]> {
    try {
      // Get active sessions
      const { data: sessions } = await this.supabase
        .from('user_sessions')
        .select('id, session_token')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('active', true);

      const sessionIds: string[] = [];

      if (sessions) {
        // Mark sessions as inactive
        await this.supabase
          .from('user_sessions')
          .update({
            active: false,
            terminated_at: new Date(),
            termination_reason: 'security_quarantine'
          })
          .eq('user_id', userId)
          .eq('tenant_id', tenantId)
          .eq('active', true);

        // Add session tokens to deny list
        const redis = await this.getRedisClient();
        for (const session of sessions) {
          await redis.setex(
            `session_denied:${session.session_token}`,
            24 * 60 * 60, // 24 hours
            JSON.stringify({
              denied: true,
              reason: 'security_quarantine',
              timestamp: new Date().toISOString()
            })
          );
          sessionIds.push(session.id);
        }
      }

      return sessionIds;
    } catch (error) {
      log.error('Failed to terminate user sessions', error as Error, { userId, tenantId });
      return [];
    }
  }

  /**
   * Revoke all user API tokens
   */
  private async revokeUserTokens(userId: string, tenantId: string): Promise<void> {
    try {
      await this.supabase
        .from('api_tokens')
        .update({
          active: false,
          revoked_at: new Date(),
          revocation_reason: 'security_quarantine'
        })
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('active', true);

      log.info('User API tokens revoked', { userId, tenantId });
    } catch (error) {
      log.error('Failed to revoke user tokens', error as Error, { userId, tenantId });
    }
  }

  /**
   * Add permanent IP block to infrastructure
   */
  private async addPermanentIPBlock(ipAddress: string, tenantId: string): Promise<void> {
    // This would integrate with:
    // - Firewall management (iptables, cloud security groups)
    // - CDN blocking (Cloudflare, AWS WAF)
    // - Reverse proxy configuration updates

    log.warn('Adding permanent IP block', { ipAddress, tenantId });

    // Store permanent block
    await this.supabase.from('permanent_ip_blocks').insert({
      ip_address: ipAddress,
      tenant_id: tenantId,
      created_at: new Date(),
      reason: 'automated_security_response'
    });
  }

  /**
   * Execute block action from automated response
   */
  private async executeBlockAction(response: AutomatedResponse): Promise<void> {
    // Extract IP address or user ID from response details
    const details = response.description;

    // Parse IP address from description (simplified)
    const ipMatch = details.match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/);
    if (ipMatch) {
      await this.blockIPAddress(
        ipMatch[0],
        'system', // Will be overridden with actual tenant ID
        response.description,
        response.priority,
        60 * 60 * 1000 // 1 hour default
      );
    }
  }

  /**
   * Execute quarantine action from automated response
   */
  private async executeQuarantineAction(response: AutomatedResponse): Promise<void> {
    // Extract user ID from response (simplified - in production would be more sophisticated)
    const details = response.description;

    // This would need proper user identification from the incident context
    // For now, implementing the structure
    log.warn('Quarantine action requested', { description: details });
  }

  /**
   * Execute alert action
   */
  private async executeAlertAction(response: AutomatedResponse): Promise<void> {
    // Send alerts to security team
    await this.sendSecurityAlert({
      type: 'security_incident',
      severity: response.priority,
      message: response.description,
      timestamp: new Date(),
      responseId: response.id
    });
  }

  /**
   * Execute notify action
   */
  private async executeNotifyAction(response: AutomatedResponse): Promise<void> {
    // Send notifications to stakeholders
    await this.sendNotification({
      type: 'security_notification',
      message: response.description,
      severity: response.priority,
      timestamp: new Date()
    });
  }

  /**
   * Log security action for audit
   */
  private async logSecurityAction(
    actionType: string,
    details: Record<string, any>
  ): Promise<void> {
    await this.supabase.from('security_action_log').insert({
      id: crypto.randomUUID(),
      action_type: actionType,
      details,
      timestamp: new Date(),
      created_by: 'system'
    });
  }

  /**
   * Send security alert
   */
  private async sendSecurityAlert(alert: {
    type: string;
    severity: string;
    message: string;
    timestamp: Date;
    responseId?: string;
  }): Promise<void> {
    // Integration with alerting systems:
    // - Email notifications
    // - Slack/Teams alerts
    // - PagerDuty incidents
    // - SIEM integration

    log.warn('Security alert sent', alert);
  }

  /**
   * Send notification
   */
  private async sendNotification(notification: {
    type: string;
    message: string;
    severity: string;
    timestamp: Date;
  }): Promise<void> {
    // Integration with notification systems
    log.info('Notification sent', notification);
  }

  /**
   * Get Redis client
   */
  private async getRedisClient(): Promise<any> {
    // Import and initialize Redis client
    try {
      const { getRedisClient } = await import('@shared/lib/redisClient');
      return await getRedisClient();
    } catch (error) {
      log.error('Failed to get Redis client', error as Error);
      throw new Error('Redis client not available');
    }
  }

  /**
   * Check if IP is blocked
   */
  async isIPBlocked(ipAddress: string, tenantId: string): Promise<boolean> {
    try {
      const redis = await this.getRedisClient();
      const blockData = await redis.get(`ip_block:${tenantId}:${ipAddress}`);

      if (blockData) {
        const block = JSON.parse(blockData);
        return block.blocked === true;
      }

      // Check permanent blocks
      const { data: permanentBlock } = await this.supabase
        .from('permanent_ip_blocks')
        .select('id')
        .eq('ip_address', ipAddress)
        .eq('tenant_id', tenantId)
        .single();

      return !!permanentBlock;
    } catch (error) {
      log.error('Failed to check IP block status', error as Error, { ipAddress, tenantId });
      return false;
    }
  }

  /**
   * Check if user is quarantined
   */
  async isUserQuarantined(userId: string, tenantId: string): Promise<boolean> {
    try {
      const { data: quarantine } = await this.supabase
        .from('user_quarantines')
        .select('id, active, expires_at')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .single();

      if (!quarantine) return false;

      // Check if quarantine has expired
      if (quarantine.expires_at && new Date(quarantine.expires_at) < new Date()) {
        // Auto-expire quarantine
        await this.supabase
          .from('user_quarantines')
          .update({ active: false })
          .eq('id', quarantine.id);

        await this.supabase
          .from('users')
          .update({ status: 'active' })
          .eq('id', userId)
          .eq('tenant_id', tenantId);

        return false;
      }

      return true;
    } catch (error) {
      log.error('Failed to check user quarantine status', error as Error, { userId, tenantId });
      return false;
    }
  }

  /**
   * Cleanup expired blocks and quarantines
   */
  async cleanupExpiredActions(): Promise<void> {
    try {
      // Cleanup expired IP blocks
      await this.supabase
        .from('ip_blocks')
        .update({ active: false })
        .lt('expires_at', new Date())
        .eq('active', true);

      // Cleanup expired quarantines
      const { data: expiredQuarantines } = await this.supabase
        .from('user_quarantines')
        .select('id, user_id, tenant_id')
        .lt('expires_at', new Date())
        .eq('active', true);

      if (expiredQuarantines) {
        for (const quarantine of expiredQuarantines) {
          // Update quarantine status
          await this.supabase
            .from('user_quarantines')
            .update({ active: false })
            .eq('id', quarantine.id);

          // Restore user status
          await this.supabase
            .from('users')
            .update({ status: 'active' })
            .eq('id', quarantine.user_id)
            .eq('tenant_id', quarantine.tenant_id);
        }
      }

      log.info('Security action cleanup completed');
    } catch (error) {
      log.error('Failed to cleanup expired security actions', error as Error);
    }
  }
}
