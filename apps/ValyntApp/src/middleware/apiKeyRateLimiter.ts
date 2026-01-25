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
import { logger } from '../utils/logger';
import { MLAnomalyDetectionService } from '../services/MLAnomalyDetectionService';
import { DistributedAttackDetectionService } from '../services/DistributedAttackDetectionService';
import { RateLimitEscalationService } from '../services/RateLimitEscalationService';

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
  keyHash: string;
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
  createdAt: Date;
  lastUsed?: Date;
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

export class APIKeyRateLimiter {
  private apiKeys = new Map<string, APIKey>();
  private keyMetrics = new Map<string, APIKeyMetrics>();
  private securityContexts = new Map<string, APIKeySecurityContext>();

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

    // Check query parameter
    const apiKeyQuery = req.query.api_key as string;
    if (apiKeyQuery) {
      return apiKeyQuery;
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
      // Hash the API key for lookup
      const keyHash = this.hashAPIKey(apiKey);

      // Look up API key
      const keyData = this.apiKeys.get(keyHash);

      if (!keyData) {
        context.violations.push({
          type: 'invalid_key',
          message: 'Invalid API key',
          timestamp: new Date()
        });
        return context;
      }

      // Check if key is active
      if (!keyData.isActive) {
        context.violations.push({
          type: 'expired_key',
          message: 'API key is inactive or expired',
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

      // Update last used timestamp
      keyData.lastUsed = new Date();

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
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey) {
      throw new Error(`API key not found: ${keyId}`);
    }

    const now = new Date();
    const usage = apiKey.usage;
    const limits = apiKey.rateLimit;

    // Reset counters if needed
    this.resetUsageCounters(apiKey, now);

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
        minute: new Date(usage.lastReset.minute.getTime() + 60 * 1000),
        hour: new Date(usage.lastReset.hour.getTime() + 60 * 60 * 1000),
        day: new Date(usage.lastReset.day.getTime() + 24 * 60 * 60 * 1000)
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
    const apiKey = this.apiKeys.get(keyId);

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
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey) return;

    const now = new Date();

    // Reset counters if needed
    this.resetUsageCounters(apiKey, now);

    // Increment counters
    apiKey.usage.totalRequests++;
    apiKey.usage.currentMinute++;
    apiKey.usage.currentHour++;
    apiKey.usage.currentDay++;

    // Update metrics
    this.updateAPIKeyMetrics(apiKey);
  }

  /**
   * Reset usage counters if time windows have expired
   */
  private resetUsageCounters(apiKey: APIKey, now: Date): void {
    const usage = apiKey.usage;
    const lastReset = usage.lastReset;

    // Reset minute counter
    if (now.getTime() - lastReset.minute.getTime() >= 60 * 1000) {
      usage.currentMinute = 0;
      usage.lastReset.minute = now;
    }

    // Reset hour counter
    if (now.getTime() - lastReset.hour.getTime() >= 60 * 60 * 1000) {
      usage.currentHour = 0;
      usage.lastReset.hour = now;
    }

    // Reset day counter
    if (now.getTime() - lastReset.day.getTime() >= 24 * 60 * 60 * 1000) {
      usage.currentDay = 0;
      usage.lastReset.day = now;
    }
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
    // Simple hash for demonstration - use proper hashing in production
    return `hash_${apiKey.substring(0, 8)}_${apiKey.length}`;
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
  public createAPIKey(keyData: APIKeyCreateRequest): APIKey {
    const apiKey: APIKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      keyHash: this.hashAPIKey(keyData.key || ''),
      name: keyData.name || 'Unnamed API Key',
      tier: keyData.tier || 'free',
      ownerId: keyData.ownerId || '',
      tenantId: keyData.tenantId || '',
      permissions: keyData.permissions || ['read'],
      rateLimit: keyData.rateLimit || this.DEFAULT_LIMITS[keyData.tier || 'free'],
      isActive: keyData.isActive !== false,
      createdAt: new Date(),
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

    this.apiKeys.set(apiKey.keyHash, apiKey);
    return apiKey;
  }

  public getAPIKeyMetrics(keyId: string): APIKeyMetrics | null {
    return this.keyMetrics.get(keyId) || null;
  }

  public getAllAPIKeyMetrics(): APIKeyMetrics[] {
    return Array.from(this.keyMetrics.values());
  }

  public revokeAPIKey(keyId: string): boolean {
    for (const [hash, apiKey] of this.apiKeys.entries()) {
      if (apiKey.id === keyId) {
        apiKey.isActive = false;
        return true;
      }
    }
    return false;
  }
}
