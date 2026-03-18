/**
 * Token Rotation Service
 *
 * Handles automatic token rotation on security events:
 * - Password changes
 * - MFA enrollment/changes
 * - Suspicious activity detection
 * - Role/permission changes
 * - Admin-initiated revocation
 */

import { createLogger } from '@shared/lib/logger';
import { getSupabaseClient } from '@shared/lib/supabase';

import { BaseService } from '../BaseService.js';
import { getSessionStore, SessionMetadata } from '../security/RedisSessionStore.js';

import { emailService } from './EmailService.js';
import { securityLogger } from './SecurityLogger.js';

const logger = createLogger({ component: 'TokenRotationService' });

export type SecurityEventType =
  | 'password_change'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'mfa_used_backup'
  | 'suspicious_activity'
  | 'role_change'
  | 'permission_change'
  | 'admin_revocation'
  | 'tenant_change'
  | 'device_compromise'
  | 'session_hijack_attempt'
  | 'brute_force_detected'
  | 'credential_breach';

export interface SecurityEvent {
  type: SecurityEventType;
  userId: string;
  tenantId?: string;
  sessionId?: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp?: number;
}

export interface TokenRotationResult {
  success: boolean;
  sessionsRevoked: number;
  tokensInvalidated: number;
  newSessionId?: string;
  error?: string;
}

export interface RotationPolicy {
  revokeAllSessions: boolean;
  revokeOtherSessions: boolean;
  requireReauth: boolean;
  notifyUser: boolean;
  notifyAdmin: boolean;
  logAudit: boolean;
}

export interface NotificationChannel {
  send(event: SecurityEvent, recipient: string, message: string): Promise<void>;
}

export interface NotificationService {
  email: NotificationChannel;
  sms?: NotificationChannel;
  push?: NotificationChannel;
}

// Default policies by event type
const ROTATION_POLICIES: Record<SecurityEventType, RotationPolicy> = {
  password_change: {
    revokeAllSessions: true,
    revokeOtherSessions: false,
    requireReauth: true,
    notifyUser: true,
    notifyAdmin: false,
    logAudit: true,
  },
  mfa_enabled: {
    revokeAllSessions: false,
    revokeOtherSessions: false,
    requireReauth: false,
    notifyUser: true,
    notifyAdmin: false,
    logAudit: true,
  },
  mfa_disabled: {
    revokeAllSessions: true,
    revokeOtherSessions: false,
    requireReauth: true,
    notifyUser: true,
    notifyAdmin: true,
    logAudit: true,
  },
  mfa_used_backup: {
    revokeAllSessions: false,
    revokeOtherSessions: false,
    requireReauth: false,
    notifyUser: true,
    notifyAdmin: false,
    logAudit: true,
  },
  suspicious_activity: {
    revokeAllSessions: false,
    revokeOtherSessions: true,
    requireReauth: true,
    notifyUser: true,
    notifyAdmin: true,
    logAudit: true,
  },
  role_change: {
    revokeAllSessions: true,
    revokeOtherSessions: false,
    requireReauth: true,
    notifyUser: true,
    notifyAdmin: true,
    logAudit: true,
  },
  permission_change: {
    revokeAllSessions: false,
    revokeOtherSessions: false,
    requireReauth: true,
    notifyUser: false,
    notifyAdmin: false,
    logAudit: true,
  },
  admin_revocation: {
    revokeAllSessions: true,
    revokeOtherSessions: false,
    requireReauth: true,
    notifyUser: true,
    notifyAdmin: true,
    logAudit: true,
  },
  tenant_change: {
    revokeAllSessions: true,
    revokeOtherSessions: false,
    requireReauth: true,
    notifyUser: true,
    notifyAdmin: true,
    logAudit: true,
  },
  device_compromise: {
    revokeAllSessions: false,
    revokeOtherSessions: false,
    requireReauth: true,
    notifyUser: true,
    notifyAdmin: true,
    logAudit: true,
  },
  session_hijack_attempt: {
    revokeAllSessions: true,
    revokeOtherSessions: false,
    requireReauth: true,
    notifyUser: true,
    notifyAdmin: true,
    logAudit: true,
  },
  brute_force_detected: {
    revokeAllSessions: false,
    revokeOtherSessions: false,
    requireReauth: false,
    notifyUser: true,
    notifyAdmin: true,
    logAudit: true,
  },
  credential_breach: {
    revokeAllSessions: true,
    revokeOtherSessions: false,
    requireReauth: true,
    notifyUser: true,
    notifyAdmin: true,
    logAudit: true,
  },
};

export class TokenRotationService extends BaseService {
  private sessionStore = getSessionStore();

  constructor() {
    super('TokenRotationService');
  }

  /**
   * Handle a security event and perform appropriate token rotation
   */
  async handleSecurityEvent(event: SecurityEvent): Promise<TokenRotationResult> {
    const policy = ROTATION_POLICIES[event.type];
    const timestamp = event.timestamp ?? Date.now();

    this.log('info', 'Processing security event', {
      type: event.type,
      userId: event.userId,
      severity: event.severity,
    });

    // Log security event
    if (policy.logAudit) {
      securityLogger.log({
        category: 'authentication',
        action: `security_event:${event.type}`,
        severity: event.severity === 'critical' ? 'error' : 'warn',
        metadata: {
          userId: event.userId,
          tenantId: event.tenantId,
          sessionId: event.sessionId,
          deviceId: event.deviceId,
          ...event.metadata,
        },
      });
    }

    let sessionsRevoked = 0;
    let tokensInvalidated = 0;

    try {
      // Revoke sessions based on policy
      if (policy.revokeAllSessions) {
        sessionsRevoked = await this.revokeAllUserSessions(event.userId, event.tenantId);
        tokensInvalidated = sessionsRevoked;
      } else if (policy.revokeOtherSessions && event.sessionId) {
        sessionsRevoked = await this.revokeOtherSessions(
          event.userId,
          event.sessionId,
          event.tenantId
        );
        tokensInvalidated = sessionsRevoked;
      } else if (event.deviceId && event.type === 'device_compromise') {
        sessionsRevoked = await this.sessionStore.invalidateDeviceSessions(
          event.deviceId,
          event.tenantId
        );
        tokensInvalidated = sessionsRevoked;
      }

      // Flag remaining sessions for re-auth if required
      if (policy.requireReauth && !policy.revokeAllSessions && event.sessionId) {
        await this.sessionStore.forceReauth(
          event.sessionId,
          event.tenantId,
          `Security event: ${event.type}`
        );
      }

      // Send notifications
      if (policy.notifyUser) {
        await this.notifyUser(event);
      }

      if (policy.notifyAdmin) {
        await this.notifyAdmin(event);
      }

      return {
        success: true,
        sessionsRevoked,
        tokensInvalidated,
      };
    } catch (error) {
      this.log('error', 'Failed to handle security event', {
        type: event.type,
        error: String(error),
      });

      return {
        success: false,
        sessionsRevoked,
        tokensInvalidated,
        error: String(error),
      };
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(
    userId: string,
    tenantId?: string,
    reason?: string
  ): Promise<number> {
    this.log('info', 'Revoking all user sessions', { userId, tenantId, reason });

    // Revoke from session store
    const storeCount = await this.sessionStore.invalidateUserSessions(userId, tenantId);

    // Also revoke from Supabase
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.admin.signOut(userId, 'global');

      if (error) {
        this.log('warn', 'Supabase signout failed', { error: error.message });
      }
    } catch (error) {
      this.log('warn', 'Failed to revoke Supabase sessions', { error: String(error) });
    }

    securityLogger.log({
      category: 'authentication',
      action: 'sessions_revoked',
      severity: 'warn',
      metadata: { userId, tenantId, count: storeCount, reason },
    });

    return storeCount;
  }

  /**
   * Revoke all sessions except the current one
   */
  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
    tenantId?: string
  ): Promise<number> {
    const userSessions = await this.sessionStore.getUserSessions(userId, tenantId);
    let revoked = 0;

    for (const session of userSessions) {
      const sessionId = this.extractSessionId(session);
      if (sessionId !== currentSessionId) {
        await this.sessionStore.delete(sessionId, tenantId);
        revoked++;
      }
    }

    this.log('info', 'Revoked other sessions', { userId, revoked });
    return revoked;
  }

  /**
   * Rotate refresh token for a session
   */
  async rotateRefreshToken(
    userId: string,
    sessionId: string,
    tenantId?: string
  ): Promise<{ success: boolean; newRefreshToken?: string; error?: string }> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        return { success: false, error: error.message };
      }

      // Update session metadata
      const metadata = await this.sessionStore.get(sessionId, tenantId);
      if (metadata) {
        metadata.securityFlags = {
          ...metadata.securityFlags,
          passwordLastVerified: Date.now(),
        };
        await this.sessionStore.set(sessionId, metadata);
      }

      return {
        success: true,
        newRefreshToken: data.session?.refresh_token,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Check if token rotation is required for a session
   */
  async isRotationRequired(
    sessionId: string,
    tenantId?: string
  ): Promise<{ required: boolean; reason?: string }> {
    const metadata = await this.sessionStore.get(sessionId, tenantId);

    if (!metadata) {
      return { required: true, reason: 'session_not_found' };
    }

    if (metadata.securityFlags?.forceReauth) {
      return { required: true, reason: 'security_event' };
    }

    if (metadata.securityFlags?.suspiciousActivity) {
      return { required: true, reason: 'suspicious_activity' };
    }

    // Check if session is near expiry (within 5 minutes)
    const fiveMinutes = 5 * 60 * 1000;
    if (metadata.absoluteExpiresAt - Date.now() < fiveMinutes) {
      return { required: true, reason: 'session_expiring' };
    }

    return { required: false };
  }

  // Private methods

  private extractSessionId(metadata: SessionMetadata): string {
    // Use deviceId as a proxy for session ID, or generate from userId + createdAt
    return metadata.deviceId || `${metadata.userId}:${metadata.createdAt}`;
  }

  private getEventDescription(eventType: SecurityEventType): string {
    const descriptions: Record<SecurityEventType, string> = {
      password_change: 'Password Changed',
      mfa_enabled: 'Multi-Factor Authentication Enabled',
      mfa_disabled: 'Multi-Factor Authentication Disabled',
      mfa_used_backup: 'Backup MFA Code Used',
      suspicious_activity: 'Suspicious Activity Detected',
      role_change: 'User Role Changed',
      permission_change: 'User Permissions Changed',
      admin_revocation: 'Admin Revoked Access',
      tenant_change: 'Tenant Association Changed',
      device_compromise: 'Device Compromised',
      session_hijack_attempt: 'Session Hijack Attempt',
      brute_force_detected: 'Brute Force Attack Detected',
      credential_breach: 'Credential Breach Detected',
    };
    return descriptions[eventType] || 'Security Event';
  }

  private generateUserNotificationMessage(event: SecurityEvent): string {
    const eventDesc = this.getEventDescription(event.type);
    const timestamp = new Date(event.timestamp || Date.now()).toLocaleString();

    return `
      <h2>Security Alert</h2>
      <p>Dear User,</p>
      <p>We detected a security event on your account:</p>
      <ul>
        <li><strong>Event:</strong> ${eventDesc}</li>
        <li><strong>Time:</strong> ${timestamp}</li>
        <li><strong>Severity:</strong> ${event.severity}</li>
      </ul>
      <p>If you did not initiate this action, please contact support immediately and change your password.</p>
      <p>For your security, we recommend:</p>
      <ul>
        <li>Review your recent account activity</li>
        <li>Change your password if suspicious</li>
        <li>Enable multi-factor authentication if not already enabled</li>
        <li>Check your devices and sessions</li>
      </ul>
      <p>Best regards,<br>ValueOS Security Team</p>
    `;
  }

  private generateAdminNotificationMessage(event: SecurityEvent): string {
    const eventDesc = this.getEventDescription(event.type);
    const timestamp = new Date(event.timestamp || Date.now()).toLocaleString();

    return `
      <h2>Security Alert - Admin Notification</h2>
      <p>A security event has been detected:</p>
      <ul>
        <li><strong>Event:</strong> ${eventDesc}</li>
        <li><strong>User ID:</strong> ${event.userId}</li>
        <li><strong>Tenant ID:</strong> ${event.tenantId || 'N/A'}</li>
        <li><strong>Session ID:</strong> ${event.sessionId || 'N/A'}</li>
        <li><strong>Device ID:</strong> ${event.deviceId || 'N/A'}</li>
        <li><strong>Severity:</strong> ${event.severity.toUpperCase()}</li>
        <li><strong>Time:</strong> ${timestamp}</li>
      </ul>
      ${event.metadata ? `<p><strong>Additional Details:</strong> ${JSON.stringify(event.metadata, null, 2)}</p>` : ''}
      <p>Please review this event in the security dashboard and take appropriate action.</p>
      <p>Best regards,<br>ValueOS Security System</p>
    `;
  }

  private async notifyUser(event: SecurityEvent): Promise<void> {
    try {
      // Get user email from Supabase
      const supabase = getSupabaseClient();
      const { data: user, error } = await supabase.auth.admin.getUserById(event.userId);

      if (error || !user?.email) {
        this.log('warn', 'Could not get user email for notification', {
          userId: event.userId,
          error: error?.message,
        });
        return;
      }

      const subject = `Security Alert: ${this.getEventDescription(event.type)}`;
      const message = this.generateUserNotificationMessage(event);

      await emailService.send({
        to: user.email,
        subject,
        html: message,
      });

      this.log('info', 'User notification sent', {
        type: event.type,
        userId: event.userId,
        email: user.email,
      });
    } catch (error) {
      this.log('error', 'Failed to send user notification', {
        type: event.type,
        userId: event.userId,
        error: String(error),
      });
    }
  }

  private async notifyAdmin(event: SecurityEvent): Promise<void> {
    try {
      // Get admin email from environment or config
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@valueos.com';

      const subject = `Security Alert: ${this.getEventDescription(event.type)} - ${event.severity.toUpperCase()}`;
      const message = this.generateAdminNotificationMessage(event);

      await emailService.send({
        to: adminEmail,
        subject,
        html: message,
      });

      this.log('info', 'Admin notification sent', {
        type: event.type,
        userId: event.userId,
        severity: event.severity,
        email: adminEmail,
      });
    } catch (error) {
      this.log('error', 'Failed to send admin notification', {
        type: event.type,
        userId: event.userId,
        error: String(error),
      });
    }
  }
}

// Singleton instance
let tokenRotationService: TokenRotationService | null = null;

export function getTokenRotationService(): TokenRotationService {
  if (!tokenRotationService) {
    tokenRotationService = new TokenRotationService();
  }
  return tokenRotationService;
}

export function resetTokenRotationService(): void {
  tokenRotationService = null;
}
