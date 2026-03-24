/**
 * Continuous Authentication Service
 *
 * Provides session validation and continuous authentication checks.
 *
 * Note: Uses TypeScript type casting patterns for Supabase query building.
 */

 

import { SupabaseClient } from '@supabase/supabase-js';

import { log } from '../../lib/logger.js'
import { sanitizeUser } from '../../lib/piiFilter.js'

import { TenantAwareService } from './TenantAwareService.js'

export interface DeviceFingerprint {
  userAgent: string;
  ipAddress: string;
  deviceId?: string;
  location?: GeographicLocation;
  riskScore: number;
}

export interface GeographicLocation {
  country: string;
  region?: string;
  city?: string;
}

export interface SessionData {
  id: string;
  user_id: string;
  tenant_id: string;
  device_fingerprint?: DeviceFingerprint;
  created_at: Date;
  last_activity: Date;
  expires_at: Date;
  trust_level: 'high' | 'medium' | 'low';
  mfa_verified: boolean;
  risk_score: number;
  invalidated_at?: Date;
  invalidation_reason?: string;
}

export interface SessionContext {
  sessionId: string;
  userId: string;
  tenantId: string;
  deviceFingerprint: DeviceFingerprint;
  lastActivity: Date;
  expiresAt: Date;
  trustLevel: 'high' | 'medium' | 'low';
  mfaVerified: boolean;
}

export class ContinuousAuthService extends TenantAwareService {
  private readonly SESSION_TIMEOUT_MINUTES = 30;
  private readonly HIGH_RISK_THRESHOLD = 70;
  private readonly DEVICE_TRUST_EXPIRY_DAYS = 90;

  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  /**
   * Validates and refreshes user session with continuous authentication
   */
  async validateSession(
    sessionId: string,
    userId: string,
    tenantId: string,
    currentFingerprint: DeviceFingerprint
  ): Promise<SessionContext> {
    // Validate tenant access first
    await this.validateTenantAccess(userId, tenantId);

    // Get current session
    const session = await this.queryWithTenantCheck<SessionContext>(
      'user_sessions',
      userId,
      { id: sessionId, user_id: userId }
    );

    if (!session || session.length === 0) {
      throw new Error('Session not found');
    }

    const currentSession = session[0];

    // Check if session is expired
    if (new Date() > new Date(currentSession.expiresAt)) {
      await this.invalidateSession(sessionId, userId, tenantId, 'expired');
      throw new Error('Session expired');
    }

    // Perform continuous authentication checks
    const riskAssessment = await this.assessSessionRisk(
      currentSession,
      currentFingerprint
    );

    // Update session activity
    await this.updateSessionActivity(sessionId, userId, tenantId, currentFingerprint);

    // Handle high-risk sessions
    if (riskAssessment.riskScore >= this.HIGH_RISK_THRESHOLD) {
      await this.handleHighRiskSession(sessionId, userId, tenantId, riskAssessment);
    }

    return {
      ...currentSession,
      trustLevel: this.calculateTrustLevel(riskAssessment),
      lastActivity: new Date()
    };
  }

  /**
   * Creates a new trusted session with device fingerprinting
   */
  async createTrustedSession(
    userId: string,
    tenantId: string,
    deviceFingerprint: DeviceFingerprint,
    mfaVerified: boolean = false
  ): Promise<SessionContext> {
    await this.validateTenantAccess(userId, tenantId);

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT_MINUTES * 60 * 1000);

    // Check device trust history
    const deviceTrust = await this.checkDeviceTrust(userId, tenantId, deviceFingerprint);

    const sessionData = {
      id: sessionId,
      user_id: userId,
      tenant_id: tenantId,
      device_fingerprint: deviceFingerprint,
      created_at: new Date(),
      last_activity: new Date(),
      expires_at: expiresAt,
      trust_level: deviceTrust.isTrusted ? 'high' : 'medium',
      mfa_verified: mfaVerified,
      risk_score: deviceTrust.riskScore
    };

    await this.insertWithTenantCheck('user_sessions', userId, tenantId, sessionData);

    // Log session creation
    await this.auditLog.log({
      userId,
      action: 'session.created',
      resourceType: 'user_session',
      resourceId: sessionId,
      details: {
        tenantId,
        deviceFingerprint: sanitizeUser(deviceFingerprint),
        mfaVerified,
        trustLevel: sessionData.trust_level
      },
      status: 'success'
    });

    log.info('Trusted session created', {
      sessionId,
      userId,
      tenantId,
      trustLevel: sessionData.trust_level
    });

    return {
      sessionId,
      userId,
      tenantId,
      deviceFingerprint,
      lastActivity: new Date(),
      expiresAt,
      trustLevel: sessionData.trust_level as 'high' | 'medium' | 'low',
      mfaVerified
    };
  }

  /**
   * Assesses risk level of current session activity
   */
  private async assessSessionRisk(
    session: SessionData,
    currentFingerprint: DeviceFingerprint
  ): Promise<{ riskScore: number; riskFactors: string[] }> {
    let riskScore = 0;
    const riskFactors: string[] = [];

    // Check IP address change
    if (session.device_fingerprint?.ipAddress !== currentFingerprint.ipAddress) {
      riskScore += 30;
      riskFactors.push('ip_address_changed');
    }

    // Check user agent change (potential device change)
    if (session.device_fingerprint?.userAgent !== currentFingerprint.userAgent) {
      riskScore += 20;
      riskFactors.push('user_agent_changed');
    }

    // Check location change (geographic anomaly)
    if (this.isGeographicAnomaly(session.device_fingerprint?.location, currentFingerprint.location)) {
      riskScore += 40;
      riskFactors.push('geographic_anomaly');
    }

    // Check time-based anomalies (unusual hours)
    if (this.isUnusualAccessTime()) {
      riskScore += 15;
      riskFactors.push('unusual_access_time');
    }

    // Check device trust score
    riskScore += Math.max(0, 100 - (currentFingerprint.riskScore || 0));

    return { riskScore: Math.min(100, riskScore), riskFactors };
  }

  /**
   * Checks if device is trusted based on historical usage
   */
  private async checkDeviceTrust(
    userId: string,
    tenantId: string,
    deviceFingerprint: DeviceFingerprint
  ): Promise<{ isTrusted: boolean; riskScore: number }> {
    // Query device trust history
    const history = await this.queryWithTenantCheck(
      'device_trust_history',
      userId,
      { user_id: userId, device_id: deviceFingerprint.deviceId },
      { limit: 10, orderBy: 'last_seen', ascending: false }
    );

    if (!history || history.length === 0) {
      return { isTrusted: false, riskScore: 50 }; // New device, medium trust
    }

    const recentActivity = history.filter(h =>
      new Date(h.last_seen) > new Date(Date.now() - this.DEVICE_TRUST_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    );

    const trustScore = Math.min(100, recentActivity.length * 10);
    const isTrusted = trustScore >= 70;

    return { isTrusted, riskScore: 100 - trustScore };
  }

  /**
   * Handles high-risk session detection
   */
  private async handleHighRiskSession(
    sessionId: string,
    userId: string,
    tenantId: string,
    riskAssessment: { riskScore: number; riskFactors: string[] }
  ): Promise<void> {
    // Log security event
    await this.auditLog.log({
      userId,
      action: 'session.high_risk_detected',
      resourceType: 'user_session',
      resourceId: sessionId,
      details: {
        tenantId,
        riskScore: riskAssessment.riskScore,
        riskFactors: riskAssessment.riskFactors
      },
      status: 'warning'
    });

    // Require additional verification for high-risk sessions
    await this.requireAdditionalVerification(sessionId, userId, tenantId);

    log.warn('High-risk session detected', {
      sessionId,
      userId,
      tenantId,
      riskScore: riskAssessment.riskScore,
      riskFactors: riskAssessment.riskFactors
    });
  }

  /**
   * Updates session activity and device fingerprint
   */
  private async updateSessionActivity(
    sessionId: string,
    userId: string,
    tenantId: string,
    deviceFingerprint: DeviceFingerprint
  ): Promise<void> {
    await this.updateWithTenantCheck(
      'user_sessions',
      userId,
      tenantId,
      {
        id: sessionId,
        last_activity: new Date(),
        device_fingerprint: deviceFingerprint
      },
      { id: sessionId }
    );

    // Update device trust history
    if (deviceFingerprint.deviceId) {
      await this.upsertDeviceTrust(userId, tenantId, deviceFingerprint);
    }
  }

  /**
   * Invalidates a session
   */
  async invalidateSession(
    sessionId: string,
    userId: string,
    tenantId: string,
    reason: string
  ): Promise<void> {
    await this.validateTenantAccess(userId, tenantId);

    await this.updateWithTenantCheck(
      'user_sessions',
      userId,
      tenantId,
      {
        id: sessionId,
        invalidated_at: new Date(),
        invalidation_reason: reason
      },
      { id: sessionId }
    );

    await this.auditLog.log({
      userId,
      action: 'session.invalidated',
      resourceType: 'user_session',
      resourceId: sessionId,
      details: { tenantId, reason },
      status: 'success'
    });

    log.info('Session invalidated', { sessionId, userId, tenantId, reason });
  }

  // Helper methods
  private isGeographicAnomaly(oldLocation?: GeographicLocation, newLocation?: GeographicLocation): boolean {
    if (!oldLocation || !newLocation) return false;

    // Simple distance check (in a real implementation, use proper geolocation)
    return oldLocation.country !== newLocation.country;
  }

  private isUnusualAccessTime(): boolean {
    const hour = new Date().getHours();
    // Consider 2 AM - 5 AM as unusual hours
    return hour >= 2 && hour <= 5;
  }

  private calculateTrustLevel(riskAssessment: { riskScore: number }): 'high' | 'medium' | 'low' {
    if (riskAssessment.riskScore < 30) return 'high';
    if (riskAssessment.riskScore < 70) return 'medium';
    return 'low';
  }

  private async requireAdditionalVerification(
    sessionId: string,
    userId: string,
    tenantId: string
  ): Promise<void> {
    // Implementation for requiring MFA or additional verification
    // This would trigger push notifications, SMS, etc.
    log.info('Additional verification required', { sessionId, userId, tenantId });
  }

  private async upsertDeviceTrust(
    userId: string,
    tenantId: string,
    deviceFingerprint: DeviceFingerprint
  ): Promise<void> {
    await this.validateTenantAccess(userId, tenantId);

    const trustData = {
      user_id: userId,
      tenant_id: tenantId,
      device_id: deviceFingerprint.deviceId,
      last_seen: new Date(),
      fingerprint: deviceFingerprint,
      trust_score: Math.max(0, 100 - deviceFingerprint.riskScore)
    };

    // Include tenant_id in conflict key to prevent cross-tenant collisions
    await this.supabase
      .from('device_trust_history')
      .upsert(trustData, { onConflict: 'user_id,tenant_id,device_id' });
  }
}
