/**
 * Unified Rate Limit Key Service
 *
 * Standardizes rate limit key generation across all limiters
 * Ensures consistent key format and prevents collisions
 */

import { Request } from 'express';

export interface RateLimitKeyContext {
  tenantId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
}

export interface RateLimitKeyOptions {
  service: string; // 'general', 'llm', 'auth', 'api'
  tier: string;   // 'strict', 'standard', 'loose', 'free', 'pro', 'enterprise', 'admin'
  scope?: string; // Optional additional scope
}

export class RateLimitKeyService {
  private static readonly SEPARATOR = ':';
  private static readonly KEY_PREFIX = 'rl';

  /**
   * Generate standardized rate limit key
   */
  static generateKey(
    req: Request,
    options: RateLimitKeyOptions,
    context?: Partial<RateLimitKeyContext>
  ): string {
    const parts = [
      this.KEY_PREFIX,
      options.service,
      options.tier,
      this.extractTenantId(req, context),
      this.extractUserId(req, context),
      this.extractIP(req, context),
      this.extractScope(options.scope)
    ].filter(Boolean); // Remove empty parts

    return parts.join(this.SEPARATOR);
  }

  /**
   * Generate key for user-based rate limiting
   */
  static generateUserKey(
    userId: string,
    tenantId: string,
    options: RateLimitKeyOptions
  ): string {
    const parts = [
      this.KEY_PREFIX,
      options.service,
      options.tier,
      tenantId,
      `user:${userId}`,
      this.extractScope(options.scope)
    ].filter(Boolean);

    return parts.join(this.SEPARATOR);
  }

  /**
   * Generate key for IP-based rate limiting
   */
  static generateIPKey(
    ip: string,
    tenantId?: string,
    options: RateLimitKeyOptions
  ): string {
    const parts = [
      this.KEY_PREFIX,
      options.service,
      options.tier,
      tenantId || 'global',
      `ip:${ip}`,
      this.extractScope(options.scope)
    ].filter(Boolean);

    return parts.join(this.SEPARATOR);
  }

  /**
   * Generate key for endpoint-based rate limiting
   */
  static generateEndpointKey(
    endpoint: string,
    method: string,
    tenantId: string,
    options: RateLimitKeyOptions
  ): string {
    const parts = [
      this.KEY_PREFIX,
      options.service,
      options.tier,
      tenantId,
      `endpoint:${method.toLowerCase()}:${endpoint}`,
      this.extractScope(options.scope)
    ].filter(Boolean);

    return parts.join(this.SEPARATOR);
  }

  /**
   * Parse rate limit key to extract components
   */
  static parseKey(key: string): {
    service?: string;
    tier?: string;
    tenantId?: string;
    userId?: string;
    ip?: string;
    endpoint?: string;
    scope?: string;
  } {
    const parts = key.split(this.SEPARATOR);

    if (parts[0] !== this.KEY_PREFIX || parts.length < 3) {
      return {};
    }

    const [, service, tier, tenantId, resource, scope] = parts;
    const result: unknown = { service, tier, tenantId };

    if (resource) {
      if (resource.startsWith('user:')) {
        result.userId = resource.substring(5);
      } else if (resource.startsWith('ip:')) {
        result.ip = resource.substring(3);
      } else if (resource.startsWith('endpoint:')) {
        result.endpoint = resource.substring(9);
      }
    }

    if (scope) {
      result.scope = scope;
    }

    return result;
  }

  /**
   * Extract tenant ID from request or context
   */
  private static extractTenantId(
    req: Request,
    context?: Partial<RateLimitKeyContext>
  ): string | undefined {
    // Priority: context > request > undefined
    return context?.tenantId ||
           (req as any).tenantId ||
           ((req as any).serviceIdentityVerified === true
             ? req.headers['x-tenant-id'] as string
             : undefined) ||
           undefined;
  }

  /**
   * Extract user ID from request or context
   */
  private static extractUserId(
    req: Request,
    context?: Partial<RateLimitKeyContext>
  ): string | undefined {
    // Priority: context > request > undefined
    return context?.userId ||
           (req as any).user?.id ||
           undefined;
  }

  /**
   * Extract IP address from request or context
   */
  private static extractIP(
    req: Request,
    context?: Partial<RateLimitKeyContext>
  ): string | undefined {
    // Priority: context > trusted request address > connection > undefined
    return context?.ip ||
           req.ip ||
           req.socket.remoteAddress ||
           undefined;
  }

  /**
   * Extract and normalize scope
   */
  private static extractScope(scope?: string): string | undefined {
    if (!scope) return undefined;

    // Normalize scope (lowercase, alphanumeric, underscores, hyphens only)
    return scope.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  }

  /**
   * Validate key format
   */
  static validateKey(key: string): boolean {
    const parts = key.split(this.SEPARATOR);

    // Must have at least: prefix, service, tier
    if (parts.length < 3 || parts[0] !== this.KEY_PREFIX) {
      return false;
    }

    // Service and tier must be alphanumeric
    const [, service, tier] = parts;
    if (!/^[a-z]+$/.test(service) || !/^[a-z]+$/.test(tier)) {
      return false;
    }

    return true;
  }

  /**
   * Generate cache key for rate limit data
   */
  static generateCacheKey(rateLimitKey: string, dataType: 'count' | 'reset' | 'meta' = 'count'): string {
    return `${rateLimitKey}${this.SEPARATOR}${dataType}`;
  }

  /**
   * Get key hash for consistent hashing (useful for distributed systems)
   */
  static hashKey(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate batch keys for multiple rate limiters
   */
  static generateBatchKeys(
    req: Request,
    configs: Array<RateLimitKeyOptions & { name: string }>
  ): Record<string, string> {
    const keys: Record<string, string> = {};

    for (const config of configs) {
      keys[config.name] = this.generateKey(req, config);
    }

    return keys;
  }

  /**
   * Check if keys belong to the same tenant
   */
  static sameTenant(key1: string, key2: string): boolean {
    const parsed1 = this.parseKey(key1);
    const parsed2 = this.parseKey(key2);

    return parsed1.tenantId === parsed2.tenantId &&
           parsed1.tenantId !== undefined;
  }

  /**
   * Check if keys belong to the same user
   */
  static sameUser(key1: string, key2: string): boolean {
    const parsed1 = this.parseKey(key1);
    const parsed2 = this.parseKey(key2);

    return parsed1.userId === parsed2.userId &&
           parsed1.userId !== undefined;
  }

  /**
   * Get key statistics for monitoring
   */
  static getKeyStats(keys: string[]): {
    total: number;
    byService: Record<string, number>;
    byTier: Record<string, number>;
    byTenant: Record<string, number>;
    userKeys: number;
    ipKeys: number;
    endpointKeys: number;
  } {
    const stats = {
      total: keys.length,
      byService: {} as Record<string, number>,
      byTier: {} as Record<string, number>,
      byTenant: {} as Record<string, number>,
      userKeys: 0,
      ipKeys: 0,
      endpointKeys: 0
    };

    for (const key of keys) {
      const parsed = this.parseKey(key);

      if (parsed.service) {
        stats.byService[parsed.service] = (stats.byService[parsed.service] || 0) + 1;
      }

      if (parsed.tier) {
        stats.byTier[parsed.tier] = (stats.byTier[parsed.tier] || 0) + 1;
      }

      if (parsed.tenantId) {
        stats.byTenant[parsed.tenantId] = (stats.byTenant[parsed.tenantId] || 0) + 1;
      }

      if (parsed.userId) stats.userKeys++;
      if (parsed.ip) stats.ipKeys++;
      if (parsed.endpoint) stats.endpointKeys++;
    }

    return stats;
  }

  /**
   * Sanitize key components to prevent injection
   */
  static sanitizeComponent(component: string): string {
    return component
      .replace(/[^a-zA-Z0-9_-]/g, '') // Allow only alphanumeric, underscore, hyphen
      .toLowerCase()
      .substring(0, 100); // Limit length
  }

  /**
   * Generate rate limit key with enhanced security
   */
  static generateSecureKey(
    req: Request,
    options: RateLimitKeyOptions,
    context?: Partial<RateLimitKeyContext>
  ): string {
    // Sanitize all components
    const sanitizedOptions = {
      service: this.sanitizeComponent(options.service),
      tier: this.sanitizeComponent(options.tier),
      scope: options.scope ? this.sanitizeComponent(options.scope) : undefined
    };

    const sanitizedContext = context ? {
      tenantId: context.tenantId ? this.sanitizeComponent(context.tenantId) : undefined,
      userId: context.userId ? this.sanitizeComponent(context.userId) : undefined,
      ip: context.ip, // IP addresses have their own validation
      userAgent: context.userAgent ? this.sanitizeComponent(context.userAgent) : undefined,
      endpoint: context.endpoint ? this.sanitizeComponent(context.endpoint) : undefined,
      method: context.method ? this.sanitizeComponent(context.method) : undefined
    } : undefined;

    return this.generateKey(req, sanitizedOptions, sanitizedContext);
  }
}
