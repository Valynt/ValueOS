/**
 * Device Fingerprint Service
 *
 * Provides device recognition and anomaly detection:
 * - Browser/device fingerprinting
 * - New device detection
 * - Geographic anomaly detection
 * - Device trust scoring
 */

import { BaseService } from './BaseService.js';
import { getSessionStore, DeviceFingerprint } from '../security/RedisSessionStore.js';
import { securityLogger } from './SecurityLogger.js';
import { createLogger } from '@shared/lib/logger';
import { getRedisClient } from '@shared/lib/redisClient';
import { ns } from '@shared/lib/redisKeys';

const logger = createLogger({ component: 'DeviceFingerprintService' });

export interface DeviceInfo {
  deviceId: string;
  fingerprint: DeviceFingerprint;
  firstSeen: number;
  lastSeen: number;
  trustScore: number;
  isTrusted: boolean;
  isKnown: boolean;
  location?: GeoLocation;
  ipAddress: string;
  userId: string;
  tenantId?: string;
  flags: DeviceFlags;
}

export interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export interface DeviceFlags {
  isVPN?: boolean;
  isProxy?: boolean;
  isTor?: boolean;
  isDatacenter?: boolean;
  isSuspicious?: boolean;
  isNewLocation?: boolean;
  isNewDevice?: boolean;
}

export interface FingerprintMatch {
  deviceId: string;
  similarity: number;
  lastUsed: number;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  anomalies: AnomalyType[];
  riskScore: number;
  recommendation: 'allow' | 'challenge' | 'block';
}

export type AnomalyType =
  | 'new_device'
  | 'new_location'
  | 'impossible_travel'
  | 'suspicious_ip'
  | 'fingerprint_mismatch'
  | 'rapid_device_switch'
  | 'unusual_time'
  | 'multiple_failures';

export interface DeviceRecognitionResult {
  deviceId: string;
  isNew: boolean;
  isTrusted: boolean;
  trustScore: number;
  anomalies: AnomalyResult;
  requiresMFA: boolean;
  requiresVerification: boolean;
}

const DEVICE_KEY_PREFIX = 'device:';
const USER_DEVICES_KEY_PREFIX = 'user_devices:';
const TRUST_THRESHOLD = 0.7;
const NEW_DEVICE_THRESHOLD = 0.3;

export class DeviceFingerprintService extends BaseService {
  private sessionStore = getSessionStore();

  constructor() {
    super('DeviceFingerprintService');
  }

  /**
   * Recognize or register a device
   */
  async recognizeDevice(
    userId: string,
    fingerprint: DeviceFingerprint,
    ipAddress: string,
    tenantId?: string,
    existingDeviceId?: string
  ): Promise<DeviceRecognitionResult> {
    // Generate or use existing device ID
    const deviceId = existingDeviceId || this.generateDeviceId(fingerprint, userId);

    // Check if device is known
    const knownDevice = await this.getDeviceInfo(deviceId, tenantId);
    const isNew = !knownDevice;

    // Calculate trust score
    const trustScore = await this.calculateTrustScore(
      userId,
      deviceId,
      fingerprint,
      ipAddress,
      knownDevice
    );

    // Detect anomalies
    const anomalies = await this.detectAnomalies(
      userId,
      deviceId,
      fingerprint,
      ipAddress,
      tenantId
    );

    // Determine if MFA or verification is required
    const requiresMFA = this.shouldRequireMFA(isNew, trustScore, anomalies);
    const requiresVerification = this.shouldRequireVerification(isNew, trustScore, anomalies);

    // Store or update device info
    const deviceInfo: DeviceInfo = {
      deviceId,
      fingerprint,
      firstSeen: knownDevice?.firstSeen ?? Date.now(),
      lastSeen: Date.now(),
      trustScore,
      isTrusted: trustScore >= TRUST_THRESHOLD,
      isKnown: !isNew,
      ipAddress,
      userId,
      tenantId,
      flags: this.extractFlags(anomalies),
    };

    await this.storeDeviceInfo(deviceInfo);

    // Log device recognition
    securityLogger.log({
      category: 'authentication',
      action: isNew ? 'device_registered' : 'device_recognized',
      severity: isNew ? 'info' : 'info',
      metadata: {
        userId,
        deviceId,
        trustScore,
        isTrusted: deviceInfo.isTrusted,
        anomalies: anomalies.anomalies,
      },
    });

    return {
      deviceId,
      isNew,
      isTrusted: deviceInfo.isTrusted,
      trustScore,
      anomalies,
      requiresMFA,
      requiresVerification,
    };
  }

  /**
   * Get device information
   */
  async getDeviceInfo(deviceId: string, tenantId?: string): Promise<DeviceInfo | null> {
    try {
      const redis = await getRedisClient();
      const key = ns(tenantId, `${DEVICE_KEY_PREFIX}${deviceId}`);
      const data = await redis.get(key);

      if (data) {
        return JSON.parse(data) as DeviceInfo;
      }
    } catch (error) {
      this.log('warn', 'Failed to get device info', { deviceId, error: String(error) });
    }

    return null;
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string, tenantId?: string): Promise<DeviceInfo[]> {
    try {
      const redis = await getRedisClient();
      const key = ns(tenantId, `${USER_DEVICES_KEY_PREFIX}${userId}`);
      const deviceIds = await redis.sMembers(key);

      const devices: DeviceInfo[] = [];
      for (const deviceId of deviceIds) {
        const info = await this.getDeviceInfo(deviceId, tenantId);
        if (info) {
          devices.push(info);
        }
      }

      return devices.sort((a, b) => b.lastSeen - a.lastSeen);
    } catch (error) {
      this.log('warn', 'Failed to get user devices', { userId, error: String(error) });
      return [];
    }
  }

  /**
   * Trust a device
   */
  async trustDevice(
    deviceId: string,
    userId: string,
    tenantId?: string
  ): Promise<boolean> {
    const device = await this.getDeviceInfo(deviceId, tenantId);
    if (!device || device.userId !== userId) {
      return false;
    }

    device.trustScore = 1.0;
    device.isTrusted = true;
    device.flags.isSuspicious = false;

    await this.storeDeviceInfo(device);

    securityLogger.log({
      category: 'authentication',
      action: 'device_trusted',
      severity: 'info',
      metadata: { userId, deviceId },
    });

    return true;
  }

  /**
   * Revoke trust for a device
   */
  async revokeDeviceTrust(
    deviceId: string,
    userId: string,
    tenantId?: string
  ): Promise<boolean> {
    const device = await this.getDeviceInfo(deviceId, tenantId);
    if (!device || device.userId !== userId) {
      return false;
    }

    device.trustScore = 0;
    device.isTrusted = false;

    await this.storeDeviceInfo(device);

    securityLogger.log({
      category: 'authentication',
      action: 'device_trust_revoked',
      severity: 'warn',
      metadata: { userId, deviceId },
    });

    return true;
  }

  /**
   * Remove a device
   */
  async removeDevice(
    deviceId: string,
    userId: string,
    tenantId?: string
  ): Promise<boolean> {
    const device = await this.getDeviceInfo(deviceId, tenantId);
    if (!device || device.userId !== userId) {
      return false;
    }

    try {
      const redis = await getRedisClient();

      // Remove device record
      await redis.del(ns(tenantId, `${DEVICE_KEY_PREFIX}${deviceId}`));

      // Remove from user's device set
      await redis.sRem(ns(tenantId, `${USER_DEVICES_KEY_PREFIX}${userId}`), deviceId);

      // Invalidate sessions for this device
      await this.sessionStore.invalidateDeviceSessions(deviceId, tenantId);

      securityLogger.log({
        category: 'authentication',
        action: 'device_removed',
        severity: 'info',
        metadata: { userId, deviceId },
      });

      return true;
    } catch (error) {
      this.log('error', 'Failed to remove device', { deviceId, error: String(error) });
      return false;
    }
  }

  /**
   * Detect anomalies for a device/login attempt
   */
  async detectAnomalies(
    userId: string,
    deviceId: string,
    fingerprint: DeviceFingerprint,
    ipAddress: string,
    tenantId?: string
  ): Promise<AnomalyResult> {
    const anomalies: AnomalyType[] = [];
    let riskScore = 0;

    // Get device history
    const device = await this.getDeviceInfo(deviceId, tenantId);
    const userDevices = await this.getUserDevices(userId, tenantId);

    // Check for new device
    if (!device) {
      anomalies.push('new_device');
      riskScore += 0.2;
    }

    // Check for fingerprint mismatch
    if (device && !this.fingerprintsMatch(device.fingerprint, fingerprint)) {
      anomalies.push('fingerprint_mismatch');
      riskScore += 0.4;
    }

    // Check for new location (simplified - would integrate with GeoIP service)
    if (device && device.ipAddress !== ipAddress) {
      // In production, compare geo locations
      anomalies.push('new_location');
      riskScore += 0.15;
    }

    // Check for rapid device switching
    const recentDevices = userDevices.filter(
      (d) => Date.now() - d.lastSeen < 60 * 60 * 1000 // Last hour
    );
    if (recentDevices.length > 3) {
      anomalies.push('rapid_device_switch');
      riskScore += 0.25;
    }

    // Check for suspicious IP (would integrate with threat intelligence)
    const suspiciousIP = await this.checkSuspiciousIP(ipAddress);
    if (suspiciousIP) {
      anomalies.push('suspicious_ip');
      riskScore += 0.3;
    }

    // Check for impossible travel (would need geo data)
    // TODO: Implement with GeoIP service

    const recommendation = this.getRecommendation(riskScore, anomalies);

    return {
      isAnomaly: anomalies.length > 0,
      anomalies,
      riskScore: Math.min(riskScore, 1.0),
      recommendation,
    };
  }

  // Private methods

  private generateDeviceId(fingerprint: DeviceFingerprint, userId: string): string {
    // Create a stable device ID from fingerprint components
    const components = [
      fingerprint.userAgent,
      fingerprint.platform,
      fingerprint.screenResolution,
      fingerprint.timezone,
    ].filter(Boolean);

    const hash = this.simpleHash(components.join('|') + userId);
    return `dev_${hash.substring(0, 16)}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private async calculateTrustScore(
    userId: string,
    deviceId: string,
    _fingerprint: DeviceFingerprint,
    _ipAddress: string,
    knownDevice: DeviceInfo | null
  ): Promise<number> {
    if (!knownDevice) {
      return NEW_DEVICE_THRESHOLD;
    }

    let score = knownDevice.trustScore;

    // Increase trust over time
    const ageInDays = (Date.now() - knownDevice.firstSeen) / (1000 * 60 * 60 * 24);
    if (ageInDays > 30) {
      score = Math.min(score + 0.1, 1.0);
    }

    // Decrease trust if flagged as suspicious
    if (knownDevice.flags.isSuspicious) {
      score = Math.max(score - 0.3, 0);
    }

    return score;
  }

  private fingerprintsMatch(a: DeviceFingerprint, b: DeviceFingerprint): boolean {
    // Check key fingerprint components
    return (
      a.userAgent === b.userAgent &&
      a.platform === b.platform &&
      a.screenResolution === b.screenResolution &&
      a.timezone === b.timezone
    );
  }

  private async checkSuspiciousIP(ipAddress: string): Promise<boolean> {
    // TODO: Integrate with threat intelligence API
    // For now, check for known bad patterns
    const suspiciousPatterns = [
      /^10\./, // Private (shouldn't be external)
      /^192\.168\./, // Private
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private
    ];

    // These are actually fine for internal, but suspicious if claimed as external
    return false; // Placeholder
  }

  private shouldRequireMFA(
    isNew: boolean,
    trustScore: number,
    anomalies: AnomalyResult
  ): boolean {
    if (isNew && trustScore < TRUST_THRESHOLD) return true;
    if (anomalies.anomalies.includes('fingerprint_mismatch')) return true;
    if (anomalies.anomalies.includes('suspicious_ip')) return true;
    if (anomalies.riskScore > 0.5) return true;
    return false;
  }

  private shouldRequireVerification(
    isNew: boolean,
    trustScore: number,
    anomalies: AnomalyResult
  ): boolean {
    if (isNew) return true;
    if (anomalies.anomalies.includes('new_location')) return true;
    if (trustScore < 0.5) return true;
    return false;
  }

  private getRecommendation(
    riskScore: number,
    anomalies: AnomalyType[]
  ): 'allow' | 'challenge' | 'block' {
    if (riskScore >= 0.7 || anomalies.includes('fingerprint_mismatch')) {
      return 'block';
    }
    if (riskScore >= 0.3 || anomalies.length > 1) {
      return 'challenge';
    }
    return 'allow';
  }

  private extractFlags(anomalies: AnomalyResult): DeviceFlags {
    return {
      isNewDevice: anomalies.anomalies.includes('new_device'),
      isNewLocation: anomalies.anomalies.includes('new_location'),
      isSuspicious: anomalies.anomalies.includes('suspicious_ip'),
    };
  }

  private async storeDeviceInfo(device: DeviceInfo): Promise<void> {
    try {
      const redis = await getRedisClient();
      const key = ns(device.tenantId, `${DEVICE_KEY_PREFIX}${device.deviceId}`);
      const userKey = ns(
        device.tenantId,
        `${USER_DEVICES_KEY_PREFIX}${device.userId}`
      );

      // Store device info with 90 day TTL
      await redis.setEx(key, 90 * 24 * 60 * 60, JSON.stringify(device));

      // Add to user's device set
      await redis.sAdd(userKey, device.deviceId);
    } catch (error) {
      this.log('error', 'Failed to store device info', {
        deviceId: device.deviceId,
        error: String(error),
      });
    }
  }
}

// Singleton instance
let deviceFingerprintService: DeviceFingerprintService | null = null;

export function getDeviceFingerprintService(): DeviceFingerprintService {
  if (!deviceFingerprintService) {
    deviceFingerprintService = new DeviceFingerprintService();
  }
  return deviceFingerprintService;
}

export function resetDeviceFingerprintService(): void {
  deviceFingerprintService = null;
}
