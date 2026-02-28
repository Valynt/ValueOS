/**
 * MCP Rate Limiter
 *
 * Provides centralized rate limiting for all MCP servers with provider-specific
 * configurations, circuit breaker patterns, and adaptive throttling.
 */

import { EventEmitter } from "events";

import { logger } from "../../lib/logger";

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface MCPRateLimitConfig {
  provider: string;
  requestsPerSecond: number;
  burstCapacity: number;
  windowMs: number;
  retryAfterBase: number;
  maxRetries: number;
  backoffMultiplier: number;
  adaptiveThrottling: boolean;
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
  };
}

export interface MCPRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  circuitBreakerOpen?: boolean;
  adaptiveDelay?: number;
}

export interface MCPRateLimitState {
  provider: string;
  currentRequests: number;
  totalRequests: number;
  failedRequests: number;
  successRate: number;
  averageResponseTime: number;
  circuitBreakerState: "closed" | "open" | "half-open";
  lastFailureTime?: number;
  nextRetryTime?: number;
}

// ============================================================================
// Circuit Breaker Implementation
// ============================================================================

class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextRetryTime = 0;

  constructor(
    private config: MCPRateLimitConfig["circuitBreaker"],
    private provider: string
  ) {}

  check(): { allowed: boolean; state: string } {
    const now = Date.now();

    switch (this.state) {
      case "closed":
        return { allowed: true, state: "closed" };

      case "open":
        if (now >= this.nextRetryTime) {
          this.state = "half-open";
          logger.info(`Circuit breaker transitioning to half-open for provider: ${this.provider}`);
          return { allowed: true, state: "half-open" };
        }
        return { allowed: false, state: "open" };

      case "half-open":
        return { allowed: true, state: "half-open" };

      default:
        return { allowed: false, state: "unknown" };
    }
  }

  onSuccess(): void {
    if (this.state === "half-open") {
      this.reset();
    }
  }

  onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "closed" && this.failureCount >= this.config.failureThreshold) {
      this.trip();
    } else if (this.state === "half-open") {
      this.trip();
    }
  }

  private trip(): void {
    this.state = "open";
    this.nextRetryTime = Date.now() + this.config.recoveryTimeout;
    logger.warn(`Circuit breaker tripped for provider: ${this.provider}`, {
      failureCount: this.failureCount,
      nextRetryTime: new Date(this.nextRetryTime),
    });
  }

  private reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.nextRetryTime = 0;
    logger.info(`Circuit breaker reset for provider: ${this.provider}`);
  }

  getState(): MCPRateLimitState["circuitBreakerState"] {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

// ============================================================================
// Adaptive Throttling
// ============================================================================

class AdaptiveThrottler {
  private responseTimes: number[] = [];
  private maxHistorySize = 100;
  private currentDelay = 0;

  constructor(private targetResponseTime: number) {}

  recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);

    if (this.responseTimes.length > this.maxHistorySize) {
      this.responseTimes.shift();
    }

    this.adjustDelay();
  }

  private adjustDelay(): void {
    if (this.responseTimes.length < 10) return;

    const avgResponseTime =
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    const variance = this.calculateVariance();

    // Increase delay if response times are high or volatile
    if (avgResponseTime > this.targetResponseTime * 1.5 || variance > this.targetResponseTime) {
      this.currentDelay = Math.min(this.currentDelay + 100, 2000); // Max 2 second delay
    } else if (
      avgResponseTime < this.targetResponseTime * 0.8 &&
      variance < this.targetResponseTime * 0.5
    ) {
      this.currentDelay = Math.max(this.currentDelay - 50, 0); // Reduce delay but not below 0
    }

    if (this.currentDelay > 0) {
      logger.debug(`Adaptive throttling applied`, {
        avgResponseTime,
        variance,
        currentDelay: this.currentDelay,
      });
    }
  }

  private calculateVariance(): number {
    const mean = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    const squaredDiffs = this.responseTimes.map((x) => Math.pow(x - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  getCurrentDelay(): number {
    return this.currentDelay;
  }

  reset(): void {
    this.responseTimes = [];
    this.currentDelay = 0;
  }
}

// ============================================================================
// MCP Rate Limiter
// ============================================================================

export class MCPRateLimiter extends EventEmitter {
  private static instance: MCPRateLimiter;
  private providers: Map<string, MCPRateLimitConfig> = new Map();
  private requestWindows: Map<string, number[]> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private adaptiveThrottlers: Map<string, AdaptiveThrottler> = new Map();
  private stats: Map<string, MCPRateLimitState> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();

    // Clean up old request data every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  static getInstance(): MCPRateLimiter {
    if (!MCPRateLimiter.instance) {
      MCPRateLimiter.instance = new MCPRateLimiter();
    }
    return MCPRateLimiter.instance;
  }

  /**
   * Register a provider with rate limiting configuration
   */
  registerProvider(config: MCPRateLimitConfig): void {
    this.providers.set(config.provider, config);

    // Initialize circuit breaker if enabled
    if (config.circuitBreaker.enabled) {
      this.circuitBreakers.set(
        config.provider,
        new CircuitBreaker(config.circuitBreaker, config.provider)
      );
    }

    // Initialize adaptive throttler if enabled
    if (config.adaptiveThrottling) {
      this.adaptiveThrottlers.set(config.provider, new AdaptiveThrottler(1000)); // 1 second target
    }

    // Initialize stats
    this.stats.set(config.provider, {
      provider: config.provider,
      currentRequests: 0,
      totalRequests: 0,
      failedRequests: 0,
      successRate: 1.0,
      averageResponseTime: 0,
      circuitBreakerState: "closed",
    });

    logger.info(`Rate limiter registered for provider: ${config.provider}`, {
      requestsPerSecond: config.requestsPerSecond,
      burstCapacity: config.burstCapacity,
      circuitBreakerEnabled: config.circuitBreaker.enabled,
      adaptiveThrottling: config.adaptiveThrottling,
    });
  }

  /**
   * Check if a request should be allowed
   */
  async checkLimit(provider: string): Promise<MCPRateLimitResult> {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`Provider ${provider} not registered with rate limiter`);
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Check circuit breaker
    const circuitBreaker = this.circuitBreakers.get(provider);
    if (circuitBreaker) {
      const cbResult = circuitBreaker.check();
      if (!cbResult.allowed) {
        this.updateStats(provider, { circuitBreakerOpen: true });
        return {
          allowed: false,
          remaining: 0,
          resetTime: circuitBreaker["nextRetryTime"] || now + config.circuitBreaker.recoveryTimeout,
          circuitBreakerOpen: true,
        };
      }
    }

    // Get or initialize request window
    if (!this.requestWindows.has(provider)) {
      this.requestWindows.set(provider, []);
    }

    const requests = this.requestWindows.get(provider)!;
    const validRequests = requests.filter((timestamp) => timestamp > windowStart);
    this.requestWindows.set(provider, validRequests);

    // Check rate limit
    const currentRequests = validRequests.length;
    const remaining = Math.max(0, config.burstCapacity - currentRequests);

    if (currentRequests >= config.burstCapacity) {
      const oldestRequest = Math.min(...validRequests);
      const resetTime = oldestRequest + config.windowMs;

      logger.warn(`Rate limit exceeded for provider: ${provider}`, {
        currentRequests,
        burstCapacity: config.burstCapacity,
        windowMs: config.windowMs,
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      };
    }

    // Check adaptive throttling
    let adaptiveDelay = 0;
    const throttler = this.adaptiveThrottlers.get(provider);
    if (throttler) {
      adaptiveDelay = throttler.getCurrentDelay();
    }

    // Allow request
    validRequests.push(now);
    this.requestWindows.set(provider, validRequests);

    this.updateStats(provider, {
      currentRequests: currentRequests + 1,
      totalRequests: 1,
    });

    return {
      allowed: true,
      remaining: remaining - 1,
      resetTime: now + config.windowMs,
      adaptiveDelay,
    };
  }

  /**
   * Record successful request completion
   */
  recordSuccess(provider: string, responseTime: number): void {
    const circuitBreaker = this.circuitBreakers.get(provider);
    if (circuitBreaker) {
      circuitBreaker.onSuccess();
    }

    const throttler = this.adaptiveThrottlers.get(provider);
    if (throttler) {
      throttler.recordResponseTime(responseTime);
    }

    this.updateStats(provider, {
      successRate: 1.0,
      averageResponseTime: responseTime,
    });

    this.emit("success", { provider, responseTime });
  }

  /**
   * Record failed request
   */
  recordFailure(provider: string, error?: Error): void {
    const circuitBreaker = this.circuitBreakers.get(provider);
    if (circuitBreaker) {
      circuitBreaker.onFailure();
    }

    this.updateStats(provider, {
      failedRequests: 1,
      successRate: 0.0,
    });

    this.emit("failure", { provider, error });
  }

  /**
   * Get rate limit statistics for a provider
   */
  getStats(provider: string): MCPRateLimitState | null {
    return this.stats.get(provider) || null;
  }

  /**
   * Get all provider statistics
   */
  getAllStats(): MCPRateLimitState[] {
    return Array.from(this.stats.values());
  }

  /**
   * Reset rate limit for a provider
   */
  resetProvider(provider: string): void {
    this.requestWindows.delete(provider);
    this.circuitBreakers.delete(provider);
    this.adaptiveThrottlers.delete(provider);

    const stats = this.stats.get(provider);
    if (stats) {
      stats.currentRequests = 0;
      stats.totalRequests = 0;
      stats.failedRequests = 0;
      stats.successRate = 1.0;
      stats.averageResponseTime = 0;
      stats.circuitBreakerState = "closed";
    }

    logger.info(`Rate limiter reset for provider: ${provider}`);
  }

  /**
   * Update provider statistics
   */
  private updateStats(provider: string, updates: Partial<MCPRateLimitState>): void {
    const stats = this.stats.get(provider);
    if (!stats) return;

    if (updates.currentRequests !== undefined) {
      stats.currentRequests = updates.currentRequests;
    }

    if (updates.totalRequests !== undefined) {
      stats.totalRequests += updates.totalRequests;
    }

    if (updates.failedRequests !== undefined) {
      stats.failedRequests += updates.failedRequests;
    }

    if (updates.successRate !== undefined) {
      const totalAttempts = stats.totalRequests;
      const failures = stats.failedRequests;
      stats.successRate = totalAttempts > 0 ? (totalAttempts - failures) / totalAttempts : 1.0;
    }

    if (updates.averageResponseTime !== undefined) {
      // Simple exponential moving average
      const alpha = 0.1;
      stats.averageResponseTime =
        stats.averageResponseTime === 0
          ? updates.averageResponseTime
          : alpha * updates.averageResponseTime + (1 - alpha) * stats.averageResponseTime;
    }

    // Update circuit breaker state
    const circuitBreaker = this.circuitBreakers.get(provider);
    if (circuitBreaker) {
      stats.circuitBreakerState = circuitBreaker.getState();
      stats.lastFailureTime = circuitBreaker["lastFailureTime"];
      stats.nextRetryTime = circuitBreaker["nextRetryTime"];
    }
  }

  /**
   * Clean up old request data
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [provider, requests] of this.requestWindows.entries()) {
      const validRequests = requests.filter((timestamp) => now - timestamp < maxAge);

      if (validRequests.length === 0) {
        this.requestWindows.delete(provider);
      } else {
        this.requestWindows.set(provider, validRequests);
      }
    }

    logger.debug("Rate limiter cleanup completed", {
      providersRemaining: this.requestWindows.size,
    });
  }

  /**
   * Destroy the rate limiter (cleanup)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.providers.clear();
    this.requestWindows.clear();
    this.circuitBreakers.clear();
    this.adaptiveThrottlers.clear();
    this.stats.clear();

    this.removeAllListeners();
  }
}

// Export singleton instance
export const mcpRateLimiter = MCPRateLimiter.getInstance();
