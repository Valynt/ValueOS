/**
 * API Key Rate Limiter Middleware
 *
 * Implements API key-specific rate limiting with enhanced security:
 * - Per-API-key rate limits based on tier and usage patterns
 * - API key validation and authentication
 * - Usage analytics and monitoring
 * - Integration with security services
 */

import { NextFunction, Request, Response } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { logger } from '@shared/lib/logger';
import { MLAnomalyDetectionService } from '../services/MLAnomalyDetectionService';
import { DistributedAttackDetectionService } from '../services/DistributedAttackDetectionService';
import { RateLimitEscalationService } from '../services/RateLimitEscalationService';
import { getRedisClient } from '../lib/redis';

export interface APIKeyCreateRequest {
  key?: string;
  name: string;
  tier: 'free' | 'basic' | 'pro' | 'enterprise';
  ownerId: string;
  tenantId: string;
  permissions: string[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  isActive?: boolean;
  metadata?: {
    allowedIPs?: string[];
    allowedEndpoints?: string[];
    description?: string;
    tags?: string[];
  };
}

export interface APIKey {
  id: string;
  keyFingerprint: string;
  name: string;
  tier: 'free' | 'basic' | 'pro' | 'enterprise';
  ownerId: string;
  tenantId: string;
  permissions: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  isActive: boolean;
  status: 'active' | 'suspended' | 'expired' | 'revoked';
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
  usage: {
    totalRequests: number;
    currentMinute: number;
    currentHour: number;
    currentDay: number;
    lastReset: {
      minute: Date;
      hour: Date;
      day: Date;
    };
  };
  metadata: {
    allowedIPs?: string[];
    allowedEndpoints?: string[];
    description?: string;
    tags?: string[];
  };
}

export interface APIKeyMetrics {
  keyId: string;
  keyName: string;
  tier: string;
  currentUsage: {
    minute: number;
    hour: number;
    day: number;
  };
  limits: {
    minute: number;
    hour: number;
    day: number;
  };
  utilization: {
    minute: number;
    hour: number;
    day: number;
  };
  lastActivity: Date;
  riskScore: number;
  alerts: number;
}

export interface APIKeySecurityContext {
  isValid: boolean;
  keyId?: string;
  keyName?: string;
  tier?: string;
  permissions?: string[];
  violations: Array<{
    type: 'invalid_key' | 'expired_key' | 'rate_limit' | 'permission_denied' | 'ip_restricted';
    message: string;
    timestamp: Date;
  }>;
  riskFactors: Array<{
    type: 'unusual_usage' | 'distributed_pattern' | 'privilege_escalation' | 'data_exfiltration';
    score: number;
    description: string;
  }>;
}

interface APIKeyRedisRecord {
  id: string;
  keyFingerprint: string;
  name: string;
  tier: 'free' | 'basic' | 'pro' | 'enterprise';
  ownerId: string;
  tenantId: string;
  permissions: string[];
  rateLimit: APIKey['rateLimit'];
  isActive: boolean;
  status: APIKey['status'];
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
  revoked_at?: string;
  metadata: APIKey['metadata'];
}

export class APIKeyRateLimiter {
  private keyMetrics = new Map<string, APIKeyMetrics>();
  private readonly keyHashSecret = process.env.API_KEY_HASH_SECRET || 'dev-api-key-secret-change-me';

  // Default rate limits by tier
  private readonly DEFAULT_LIMITS = {
    free: { requestsPerMinute: 10, requestsPerHour: 100, requestsPerDay: 1000 },
    basic: { requestsPerMinute: 30, requestsPerHour: 500, requestsPerDay: 5000 },
    pro: { requestsPerMinute: 100, requestsPerHour: 2000, requestsPerDay: 20000 },
    enterprise: { requestsPerMinute: 500, requestsPerHour: 10000, requestsPerDay: 100000 }
  };

  constructor(
    private mlService: MLAnomalyDetectionService,
    private distributedService: DistributedAttackDetectionService,
    private escalationService: RateLimitEscalationService
  ) {
    this.initializeCleanup();
  }

  /**
   * API key rate limiting middleware
   */
  apiKeyRateLimit(): (req: Request, res: Response, next: NextFunction) => void {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      try {
        // Extract API key from request
        const apiKey = this.extractAPIKey(req);

        if (!apiKey) {
          await this.handleMissingAPIKey(req, res);
          return;
        }

        // Validate API key and get security context
        const securityContext = await this.validateAPIKey(apiKey, req);

        if (!securityContext.isValid) {
          await this.handleInvalidAPIKey(req, res, securityContext);
          return;
        }

        // Check rate limits
        const rateLimitResult = await this.checkAPIKeyRateLimits(securityContext.keyId!);

        if (rateLimitResult.exceeded) {
          await this.handleAPIKeyRateLimitExceeded(req, res, rateLimitResult, securityContext);
          return;
        }

        // Check permissions
        if (!this.checkPermissions(securityContext.permissions!, req)) {
          await this.handlePermissionDenied(req, res, securityContext);
          return;
        }

        // Perform security analysis
        await this.performAPIKeySecurityAnalysis(req, securityContext);

        // Update usage metrics
        await this.updateAPIKeyUsage(securityContext.keyId!);

        // Add security context to request
        (req as any).apiKeyContext = securityContext;

        // Set rate limit headers
        this.setAPIKeyRateLimitHeaders(res, rateLimitResult);

        next();

      } catch (error) {
        await this.handleAPIKeyError(req, res, error as Error, startTime);
      }
    };
  }

  /**
   * Extract API key from request
   */
  private extractAPIKey(req: Request): string | null {
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check X-API-Key header
    const apiKeyHeader = req.headers['x-api-key'] as string;
    if (apiKeyHeader) {
      return apiKeyHeader;
    }

    return null;
  }

  /**
   * Validate API key and return security context
   */
  private async validateAPIKey(apiKey: string, req: Request): Promise<APIKeySecurityContext> {
    const context: APIKeySecurityContext = {
      isValid: false,
      violations: [],
      riskFactors: []
    };

    try {
      const tenantId = this.resolveTenantId(req);
      const keyFingerprint = this.hashAPIKey(apiKey);
      const keyData = await this.getAPIKeyByFingerprint(keyFingerprint, tenantId);

      if (!keyData) {
        context.violations.push({
          type: 'invalid_key',
          message: 'Invalid API key',
          timestamp: new Date()
        });
        return context;
      }

      if (!this.safeCompare(keyFingerprint, keyData.keyFingerprint)) {
        context.violations.push({
          type: 'invalid_key',
          message: 'Invalid API key',
          timestamp: new Date()
        });
        return context;
      }

      const now = new Date();
      const isExpired = Boolean(keyData.expiresAt && keyData.expiresAt.getTime() <= now.getTime());
      const isRevoked = Boolean(keyData.revokedAt);
      const isInactive = !keyData.isActive || keyData.status !== 'active';

      if (isInactive || isExpired || isRevoked) {
        context.violations.push({
          type: 'expired_key',
          message: 'API key is inactive, expired, or revoked',
          timestamp: new Date()
        });
        return context;
      }

      // Check IP restrictions
      if (keyData.metadata.allowedIPs && keyData.metadata.allowedIPs.length > 0) {
        const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
        if (!keyData.metadata.allowedIPs.includes(clientIP)) {
          context.violations.push({
            type: 'ip_restricted',
            message: 'API key not allowed from this IP address',
            timestamp: new Date()
          });
          return context;
        }
      }

      // Populate valid context
      context.isValid = true;
      context.keyId = keyData.id;
      context.keyName = keyData.name;
      context.tier = keyData.tier;
      context.permissions = keyData.permissions;

      await this.updateLastUsed(keyData.id, keyData.tenantId);

      return context;

    } catch (error) {
      logger.error('API key validation failed', error as Error);

      context.violations.push({
        type: 'invalid_key',
        message: 'API key validation error',
        timestamp: new Date()
      });

      return context;
    }
  }

  /**
   * Check API key rate limits
   */
  private async checkAPIKeyRateLimits(keyId: string): Promise<{
    exceeded: boolean;
    currentUsage: {
      minute: number;
      hour: number;
      day: number;
    };
    limits: {
      minute: number;
      hour: number;
      day: number;
    };
    resetTimes: {
      minute: Date;
      hour: Date;
      day: Date;
    };
  }> {
    const apiKey = await this.getAPIKeyById(keyId);
    if (!apiKey) {
      throw new Error(`API key not found: ${keyId}`);
    }
    const limits = apiKey.rateLimit;
    const usage = await this.getUsageCounters(keyId);

    // Check each limit
    const minuteExceeded = usage.currentMinute >= limits.requestsPerMinute;
    const hourExceeded = usage.currentHour >= limits.requestsPerHour;
    const dayExceeded = usage.currentDay >= limits.requestsPerDay;

    const exceeded = minuteExceeded || hourExceeded || dayExceeded;

    return {
      exceeded,
      currentUsage: {
        minute: usage.currentMinute,
        hour: usage.currentHour,
        day: usage.currentDay
      },
      limits: {
        minute: limits.requestsPerMinute,
        hour: limits.requestsPerHour,
        day: limits.requestsPerDay
      },
      resetTimes: {
        minute: new Date(Date.now() + 60 * 1000),
        hour: new Date(Date.now() + 60 * 60 * 1000),
        day: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    };
  }

  /**
   * Check if API key has required permissions
   */
  private checkPermissions(permissions: string[], req: Request): boolean {
    // If no permissions are required, allow
    if (!permissions || permissions.length === 0) {
      return true;
    }

    // Map endpoint to required permission
    const requiredPermission = this.getRequiredPermission(req);

    if (!requiredPermission) {
      return true; // No specific permission required
    }

    return permissions.includes(requiredPermission) || permissions.includes('*');
  }

  /**
   * Perform security analysis on API key usage
   */
  private async performAPIKeySecurityAnalysis(
    req: Request,
    securityContext: APIKeySecurityContext
  ): Promise<void> {
    const keyId = securityContext.keyId!;
    const apiKey = await this.getAPIKeyById(keyId);

    if (!apiKey) return;

    // Check for unusual usage patterns
    await this.checkUnusualUsagePatterns(apiKey, req, securityContext);

    // Check for distributed attack patterns
    await this.checkDistributedAttackPatterns(apiKey, req, securityContext);

    // Check for privilege escalation attempts
    await this.checkPrivilegeEscalation(apiKey, req, securityContext);

    // Check for data exfiltration patterns
    await this.checkDataExfiltration(apiKey, req, securityContext);

    // Update risk score
    this.updateAPIKeyRiskScore(keyId, securityContext);
  }

  /**
   * Check for unusual usage patterns
   */
  private async checkUnusualUsagePatterns(
    apiKey: APIKey,
    req: Request,
    securityContext: APIKeySecurityContext
  ): Promise<void> {
    const metrics = this.keyMetrics.get(apiKey.id);

    if (!metrics) return;

    // Check for sudden increase in usage
    const minuteUtilization = metrics.utilization.minute;
    const hourUtilization = metrics.utilization.hour;

    if (minuteUtilization > 0.9 || hourUtilization > 0.8) {
      securityContext.riskFactors.push({
        type: 'unusual_usage',
        score: 0.6,
        description: `High utilization detected: ${Math.round(minuteUtilization * 100)}% (minute), ${Math.round(hourUtilization * 100)}% (hour)`
      });
    }

    // Check for unusual time patterns
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      securityContext.riskFactors.push({
        type: 'unusual_usage',
        score: 0.3,
        description: 'API key usage during unusual hours'
      });
    }
  }

  /**
   * Check for distributed attack patterns
   */
  private async checkDistributedAttackPatterns(
    apiKey: APIKey,
    req: Request,
    securityContext: APIKeySecurityContext
  ): Promise<void> {
    // This would integrate with the distributed attack detection service
    // For now, using simplified logic

    const recentIPs = this.getRecentIPsForAPIKey(apiKey.id, 60); // Last hour

    if (recentIPs.size > 10) {
      securityContext.riskFactors.push({
        type: 'distributed_pattern',
        score: 0.7,
        description: `API key used from ${recentIPs.size} different IPs in the last hour`
      });
    }
  }

  /**
   * Check for privilege escalation attempts
   */
  private async checkPrivilegeEscalation(
    apiKey: APIKey,
    req: Request,
    securityContext: APIKeySecurityContext
  ): Promise<void> {
    const requiredPermission = this.getRequiredPermission(req);

    if (!requiredPermission) return;

    // Check if user is trying to access higher-privilege endpoints
    const isHighPrivilege = this.isHighPrivilegeEndpoint(req);
    const hasHighPrivilegePermission = securityContext.permissions?.includes('admin') ||
                                      securityContext.permissions?.includes('write');

    if (isHighPrivilege && !hasHighPrivilegePermission) {
      securityContext.riskFactors.push({
        type: 'privilege_escalation',
        score: 0.8,
        description: 'Attempt to access high-privilege endpoint without sufficient permissions'
      });
    }
  }

  /**
   * Check for data exfiltration patterns
   */
  private async checkDataExfiltration(
    apiKey: APIKey,
    req: Request,
    securityContext: APIKeySecurityContext
  ): Promise<void> {
    // Check for large data export requests
    const isDataExport = req.path.includes('/export') || req.path.includes('/download');
    const isLargeRequest = req.headers['content-length'] &&
                          parseInt(req.headers['content-length']) > 10 * 1024 * 1024; // 10MB

    if (isDataExport || isLargeRequest) {
      securityContext.riskFactors.push({
        type: 'data_exfiltration',
        score: 0.6,
        description: 'Large data export or download request detected'
      });
    }
  }

  /**
   * Update API key usage metrics
   */
  private async updateAPIKeyUsage(keyId: string): Promise<void> {
    const apiKey = await this.getAPIKeyById(keyId);
    if (!apiKey) return;
    await this.incrementUsageCounters(keyId);

    // Update metrics
    const usage = await this.getUsageCounters(keyId);
    this.updateAPIKeyMetrics({
      ...apiKey,
      usage: {
        ...apiKey.usage,
        totalRequests: usage.total,
        currentMinute: usage.currentMinute,
        currentHour: usage.currentHour,
        currentDay: usage.currentDay
      }
    });
  }

  /**
   * Update API key metrics
   */
  private updateAPIKeyMetrics(apiKey: APIKey): void {
    const metrics: APIKeyMetrics = {
      keyId: apiKey.id,
      keyName: apiKey.name,
      tier: apiKey.tier,
      currentUsage: {
        minute: apiKey.usage.currentMinute,
        hour: apiKey.usage.currentHour,
        day: apiKey.usage.currentDay
      },
      limits: {
        minute: apiKey.rateLimit.requestsPerMinute,
        hour: apiKey.rateLimit.requestsPerHour,
        day: apiKey.rateLimit.requestsPerDay
      },
      utilization: {
        minute: apiKey.usage.currentMinute / apiKey.rateLimit.requestsPerMinute,
        hour: apiKey.usage.currentHour / apiKey.rateLimit.requestsPerHour,
        day: apiKey.usage.currentDay / apiKey.rateLimit.requestsPerDay
      },
      lastActivity: new Date(),
      riskScore: 0,
      alerts: 0
    };

    this.keyMetrics.set(apiKey.id, metrics);
  }

  /**
   * Update API key risk score
   */
  private updateAPIKeyRiskScore(keyId: string, securityContext: APIKeySecurityContext): void {
    const metrics = this.keyMetrics.get(keyId);
    if (!metrics) return;

    // Calculate risk score from risk factors
    const totalRiskScore = securityContext.riskFactors.reduce((sum, factor) => sum + factor.score, 0);
    metrics.riskScore = Math.min(totalRiskScore, 1.0);

    // Count violations as alerts
    metrics.alerts = securityContext.violations.length;
  }

  // Error handlers
  private async handleMissingAPIKey(req: Request, res: Response): Promise<void> {
    logger.warn('Missing API key', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent']
    });

    res.status(401).json({
      error: 'Authentication Required',
      message: 'API key is required',
      code: 'MISSING_API_KEY'
    });
  }

  private async handleInvalidAPIKey(
    req: Request,
    res: Response,
    securityContext: APIKeySecurityContext
  ): Promise<void> {
    const violation = securityContext.violations[0];

    logger.warn('Invalid API key', {
      ip: req.ip,
      path: req.path,
      violation: violation.type,
      message: violation.message
    });

    res.status(401).json({
      error: 'Authentication Failed',
      message: violation.message,
      code: violation.type.toUpperCase()
    });
  }

  private async handleAPIKeyRateLimitExceeded(
    req: Request,
    res: Response,
    rateLimitResult: any,
    securityContext: APIKeySecurityContext
  ): Promise<void> {
    logger.warn('API key rate limit exceeded', {
      keyId: securityContext.keyId,
      keyName: securityContext.keyName,
      tier: securityContext.tier,
      ip: req.ip,
      path: req.path,
      currentUsage: rateLimitResult.currentUsage,
      limits: rateLimitResult.limits
    });

    res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'API key rate limit exceeded',
      keyName: securityContext.keyName,
      tier: securityContext.tier,
      currentUsage: rateLimitResult.currentUsage,
      limits: rateLimitResult.limits,
      resetTimes: rateLimitResult.resetTimes
    });
  }

  private async handlePermissionDenied(
    req: Request,
    res: Response,
    securityContext: APIKeySecurityContext
  ): Promise<void> {
    const requiredPermission = this.getRequiredPermission(req);

    logger.warn('API key permission denied', {
      keyId: securityContext.keyId,
      keyName: securityContext.keyName,
      requiredPermission,
      permissions: securityContext.permissions,
      ip: req.ip,
      path: req.path
    });

    res.status(403).json({
      error: 'Permission Denied',
      message: 'API key does not have required permissions',
      requiredPermission,
      code: 'PERMISSION_DENIED'
    });
  }

  private async handleAPIKeyError(
    req: Request,
    res: Response,
    error: Error,
    startTime: number
  ): Promise<void> {
    const duration = Date.now() - startTime;

    logger.error('API key rate limiter error', error, {
      ip: req.ip,
      path: req.path,
      duration
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'API key authentication service temporarily unavailable',
      code: 'SERVICE_ERROR'
    });
  }

  // Helper methods
  private hashAPIKey(apiKey: string): string {
    return createHmac('sha256', this.keyHashSecret).update(apiKey).digest('hex');
  }

  private safeCompare(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a, 'utf8');
    const bBuffer = Buffer.from(b, 'utf8');
    if (aBuffer.length !== bBuffer.length) {
      return false;
    }
    return timingSafeEqual(aBuffer, bBuffer);
  }

  private resolveTenantId(req: Request): string {
    return (req.headers['x-tenant-id'] as string) || (req as any).tenantId || 'default';
  }

  private async getAPIKeyByFingerprint(fingerprint: string, tenantId: string): Promise<APIKey | null> {
    const redis = await getRedisClient();
    if (!redis) return null;

    const keyId = await redis.get(`apikey:index:${tenantId}:${fingerprint}`);
    if (!keyId) return null;

    return this.getAPIKeyById(keyId);
  }

  private async getAPIKeyById(keyId: string): Promise<APIKey | null> {
    const redis = await getRedisClient();
    if (!redis) return null;

    const payload = await redis.get(`apikey:data:${keyId}`);
    if (!payload) return null;

    const data = JSON.parse(payload) as APIKeyRedisRecord;

    return {
      id: data.id,
      keyFingerprint: data.keyFingerprint,
      name: data.name,
      tier: data.tier,
      ownerId: data.ownerId,
      tenantId: data.tenantId,
      permissions: data.permissions,
      rateLimit: data.rateLimit,
      isActive: data.isActive,
      status: data.status,
      createdAt: new Date(data.created_at),
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : undefined,
      revokedAt: data.revoked_at ? new Date(data.revoked_at) : undefined,
      usage: {
        totalRequests: 0,
        currentMinute: 0,
        currentHour: 0,
        currentDay: 0,
        lastReset: { minute: new Date(), hour: new Date(), day: new Date() }
      },
      metadata: data.metadata || {}
    };
  }

  private async updateLastUsed(keyId: string, tenantId: string): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;
    const existing = await this.getAPIKeyById(keyId);
    if (!existing) return;

    const record: APIKeyRedisRecord = {
      id: existing.id,
      keyFingerprint: existing.keyFingerprint,
      name: existing.name,
      tier: existing.tier,
      ownerId: existing.ownerId,
      tenantId,
      permissions: existing.permissions,
      rateLimit: existing.rateLimit,
      isActive: existing.isActive,
      status: existing.status,
      created_at: existing.createdAt.toISOString(),
      expires_at: existing.expiresAt?.toISOString(),
      revoked_at: existing.revokedAt?.toISOString(),
      last_used_at: new Date().toISOString(),
      metadata: existing.metadata
    };

    await redis.set(`apikey:data:${keyId}`, JSON.stringify(record));
  }

  private async incrementUsageCounters(keyId: string): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;

    await Promise.all([
      redis.incr(`apikey:usage:${keyId}:total`),
      redis.incr(`apikey:usage:${keyId}:minute`),
      redis.incr(`apikey:usage:${keyId}:hour`),
      redis.incr(`apikey:usage:${keyId}:day`),
      redis.expire(`apikey:usage:${keyId}:minute`, 60),
      redis.expire(`apikey:usage:${keyId}:hour`, 3600),
      redis.expire(`apikey:usage:${keyId}:day`, 86400)
    ]);
  }

  private async getUsageCounters(keyId: string): Promise<{ total: number; currentMinute: number; currentHour: number; currentDay: number }> {
    const redis = await getRedisClient();
    if (!redis) {
      return { total: 0, currentMinute: 0, currentHour: 0, currentDay: 0 };
    }

    const [total, minute, hour, day] = await Promise.all([
      redis.get(`apikey:usage:${keyId}:total`),
      redis.get(`apikey:usage:${keyId}:minute`),
      redis.get(`apikey:usage:${keyId}:hour`),
      redis.get(`apikey:usage:${keyId}:day`)
    ]);

    return {
      total: Number(total || 0),
      currentMinute: Number(minute || 0),
      currentHour: Number(hour || 0),
      currentDay: Number(day || 0)
    };
  }

  private getRequiredPermission(req: Request): string | null {
    const path = req.path;
    const method = req.method;

    // Map endpoints to permissions
    if (path.startsWith('/api/admin/')) return 'admin';
    if (path.startsWith('/api/write/') || method === 'POST' || method === 'PUT' || method === 'DELETE') return 'write';
    if (path.startsWith('/api/read/') || method === 'GET') return 'read';

    return null;
  }

  private isHighPrivilegeEndpoint(req: Request): boolean {
    const path = req.path;
    return path.includes('/admin') ||
           path.includes('/delete') ||
           path.includes('/system') ||
           req.method === 'DELETE';
  }

  private getRecentIPsForAPIKey(keyId: string, minutes: number): Set<string> {
    // This would track recent IPs for each API key
    // For now, returning empty set
    return new Set();
  }

  private setAPIKeyRateLimitHeaders(res: Response, rateLimitResult: any): void {
    res.setHeader('X-RateLimit-Limit-Minute', rateLimitResult.limits.minute);
    res.setHeader('X-RateLimit-Remaining-Minute', Math.max(0, rateLimitResult.limits.minute - rateLimitResult.currentUsage.minute));
    res.setHeader('X-RateLimit-Reset-Minute', rateLimitResult.resetTimes.minute.toISOString());

    res.setHeader('X-RateLimit-Limit-Hour', rateLimitResult.limits.hour);
    res.setHeader('X-RateLimit-Remaining-Hour', Math.max(0, rateLimitResult.limits.hour - rateLimitResult.currentUsage.hour));
    res.setHeader('X-RateLimit-Reset-Hour', rateLimitResult.resetTimes.hour.toISOString());

    res.setHeader('X-RateLimit-Limit-Day', rateLimitResult.limits.day);
    res.setHeader('X-RateLimit-Remaining-Day', Math.max(0, rateLimitResult.limits.day - rateLimitResult.currentUsage.day));
    res.setHeader('X-RateLimit-Reset-Day', rateLimitResult.resetTimes.day.toISOString());
  }

  private initializeCleanup(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000);
  }

  private cleanupOldMetrics(): void {
    // Remove metrics for inactive API keys
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    for (const [keyId, metrics] of this.keyMetrics.entries()) {
      if (metrics.lastActivity.getTime() < cutoff) {
        this.keyMetrics.delete(keyId);
      }
    }
  }

  // Public API methods
  public async createAPIKey(keyData: APIKeyCreateRequest): Promise<APIKey> {
    const rawApiKey = keyData.key || randomBytes(32).toString('hex');
    const apiKeyId = `key_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const fingerprint = this.hashAPIKey(rawApiKey);

    const apiKey: APIKey = {
      id: apiKeyId,
      keyFingerprint: fingerprint,
      name: keyData.name || 'Unnamed API Key',
      tier: keyData.tier || 'free',
      ownerId: keyData.ownerId || '',
      tenantId: keyData.tenantId || '',
      permissions: keyData.permissions || ['read'],
      rateLimit: keyData.rateLimit || this.DEFAULT_LIMITS[keyData.tier || 'free'],
      isActive: keyData.isActive !== false,
      status: keyData.isActive === false ? 'suspended' : 'active',
      createdAt: new Date(),
      expiresAt: undefined,
      lastUsedAt: undefined,
      revokedAt: undefined,
      usage: {
        totalRequests: 0,
        currentMinute: 0,
        currentHour: 0,
        currentDay: 0,
        lastReset: {
          minute: new Date(),
          hour: new Date(),
          day: new Date()
        }
      },
      metadata: keyData.metadata || {}
    };

    const redis = await getRedisClient();
    if (redis) {
      const redisRecord: APIKeyRedisRecord = {
        id: apiKey.id,
        keyFingerprint: apiKey.keyFingerprint,
        name: apiKey.name,
        tier: apiKey.tier,
        ownerId: apiKey.ownerId,
        tenantId: apiKey.tenantId,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        isActive: apiKey.isActive,
        status: apiKey.status,
        created_at: apiKey.createdAt.toISOString(),
        expires_at: apiKey.expiresAt?.toISOString(),
        last_used_at: apiKey.lastUsedAt?.toISOString(),
        revoked_at: apiKey.revokedAt?.toISOString(),
        metadata: apiKey.metadata
      };

      await Promise.all([
        redis.set(`apikey:data:${apiKey.id}`, JSON.stringify(redisRecord)),
        redis.set(`apikey:index:${apiKey.tenantId}:${apiKey.keyFingerprint}`, apiKey.id)
      ]);
    }

    return apiKey;
  }

  public getAPIKeyMetrics(keyId: string): APIKeyMetrics | null {
    return this.keyMetrics.get(keyId) || null;
  }

  public getAllAPIKeyMetrics(): APIKeyMetrics[] {
    return Array.from(this.keyMetrics.values());
  }

  public async revokeAPIKey(keyId: string): Promise<boolean> {
    const redis = await getRedisClient();
    if (!redis) return false;

    const existing = await this.getAPIKeyById(keyId);
    if (!existing) return false;

    const revokedAt = new Date();
    const updated: APIKeyRedisRecord = {
      id: existing.id,
      keyFingerprint: existing.keyFingerprint,
      name: existing.name,
      tier: existing.tier,
      ownerId: existing.ownerId,
      tenantId: existing.tenantId,
      permissions: existing.permissions,
      rateLimit: existing.rateLimit,
      isActive: false,
      status: 'revoked',
      created_at: existing.createdAt.toISOString(),
      expires_at: existing.expiresAt?.toISOString(),
      last_used_at: existing.lastUsedAt?.toISOString(),
      revoked_at: revokedAt.toISOString(),
      metadata: existing.metadata
    };

    await redis.set(`apikey:data:${keyId}`, JSON.stringify(updated));
    return true;
  }
}
