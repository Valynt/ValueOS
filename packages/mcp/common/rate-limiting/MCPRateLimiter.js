"use strict";
/**
 * MCP Rate Limiter
 *
 * Provides centralized rate limiting for all MCP servers with provider-specific
 * configurations, circuit breaker patterns, and adaptive throttling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpRateLimiter = exports.MCPRateLimiter = void 0;
const events_1 = require("events");
const logger_1 = require("../../lib/logger");
// ============================================================================
// Circuit Breaker Implementation
// ============================================================================
class CircuitBreaker {
    config;
    provider;
    state = "closed";
    failureCount = 0;
    lastFailureTime = 0;
    nextRetryTime = 0;
    constructor(config, provider) {
        this.config = config;
        this.provider = provider;
    }
    check() {
        const now = Date.now();
        switch (this.state) {
            case "closed":
                return { allowed: true, state: "closed" };
            case "open":
                if (now >= this.nextRetryTime) {
                    this.state = "half-open";
                    logger_1.logger.info(`Circuit breaker transitioning to half-open for provider: ${this.provider}`);
                    return { allowed: true, state: "half-open" };
                }
                return { allowed: false, state: "open" };
            case "half-open":
                return { allowed: true, state: "half-open" };
            default:
                return { allowed: false, state: "unknown" };
        }
    }
    onSuccess() {
        if (this.state === "half-open") {
            this.reset();
        }
    }
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.state === "closed" && this.failureCount >= this.config.failureThreshold) {
            this.trip();
        }
        else if (this.state === "half-open") {
            this.trip();
        }
    }
    trip() {
        this.state = "open";
        this.nextRetryTime = Date.now() + this.config.recoveryTimeout;
        logger_1.logger.warn(`Circuit breaker tripped for provider: ${this.provider}`, {
            failureCount: this.failureCount,
            nextRetryTime: new Date(this.nextRetryTime),
        });
    }
    reset() {
        this.state = "closed";
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.nextRetryTime = 0;
        logger_1.logger.info(`Circuit breaker reset for provider: ${this.provider}`);
    }
    getState() {
        return this.state;
    }
    getFailureCount() {
        return this.failureCount;
    }
}
// ============================================================================
// Adaptive Throttling
// ============================================================================
class AdaptiveThrottler {
    targetResponseTime;
    responseTimes = [];
    maxHistorySize = 100;
    currentDelay = 0;
    constructor(targetResponseTime) {
        this.targetResponseTime = targetResponseTime;
    }
    recordResponseTime(responseTime) {
        this.responseTimes.push(responseTime);
        if (this.responseTimes.length > this.maxHistorySize) {
            this.responseTimes.shift();
        }
        this.adjustDelay();
    }
    adjustDelay() {
        if (this.responseTimes.length < 10)
            return;
        const avgResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
        const variance = this.calculateVariance();
        // Increase delay if response times are high or volatile
        if (avgResponseTime > this.targetResponseTime * 1.5 || variance > this.targetResponseTime) {
            this.currentDelay = Math.min(this.currentDelay + 100, 2000); // Max 2 second delay
        }
        else if (avgResponseTime < this.targetResponseTime * 0.8 &&
            variance < this.targetResponseTime * 0.5) {
            this.currentDelay = Math.max(this.currentDelay - 50, 0); // Reduce delay but not below 0
        }
        if (this.currentDelay > 0) {
            logger_1.logger.debug(`Adaptive throttling applied`, {
                avgResponseTime,
                variance,
                currentDelay: this.currentDelay,
            });
        }
    }
    calculateVariance() {
        const mean = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
        const squaredDiffs = this.responseTimes.map((x) => Math.pow(x - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }
    getCurrentDelay() {
        return this.currentDelay;
    }
    reset() {
        this.responseTimes = [];
        this.currentDelay = 0;
    }
}
// ============================================================================
// MCP Rate Limiter
// ============================================================================
class MCPRateLimiter extends events_1.EventEmitter {
    static instance;
    providers = new Map();
    requestWindows = new Map();
    circuitBreakers = new Map();
    adaptiveThrottlers = new Map();
    stats = new Map();
    cleanupInterval = null;
    constructor() {
        super();
        // Clean up old request data every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }
    static getInstance() {
        if (!MCPRateLimiter.instance) {
            MCPRateLimiter.instance = new MCPRateLimiter();
        }
        return MCPRateLimiter.instance;
    }
    /**
     * Register a provider with rate limiting configuration
     */
    registerProvider(config) {
        this.providers.set(config.provider, config);
        // Initialize circuit breaker if enabled
        if (config.circuitBreaker.enabled) {
            this.circuitBreakers.set(config.provider, new CircuitBreaker(config.circuitBreaker, config.provider));
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
        logger_1.logger.info(`Rate limiter registered for provider: ${config.provider}`, {
            requestsPerSecond: config.requestsPerSecond,
            burstCapacity: config.burstCapacity,
            circuitBreakerEnabled: config.circuitBreaker.enabled,
            adaptiveThrottling: config.adaptiveThrottling,
        });
    }
    /**
     * Check if a request should be allowed
     */
    async checkLimit(provider) {
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
                this.updateStats(provider, { circuitBreakerState: "open" });
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
        const requests = this.requestWindows.get(provider);
        const validRequests = requests.filter((timestamp) => timestamp > windowStart);
        this.requestWindows.set(provider, validRequests);
        // Check rate limit
        const currentRequests = validRequests.length;
        const remaining = Math.max(0, config.burstCapacity - currentRequests);
        if (currentRequests >= config.burstCapacity) {
            const oldestRequest = Math.min(...validRequests);
            const resetTime = oldestRequest + config.windowMs;
            logger_1.logger.warn(`Rate limit exceeded for provider: ${provider}`, {
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
    recordSuccess(provider, responseTime) {
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
    recordFailure(provider, error) {
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
    getStats(provider) {
        return this.stats.get(provider) || null;
    }
    /**
     * Get all provider statistics
     */
    getAllStats() {
        return Array.from(this.stats.values());
    }
    /**
     * Reset rate limit for a provider
     */
    resetProvider(provider) {
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
        logger_1.logger.info(`Rate limiter reset for provider: ${provider}`);
    }
    /**
     * Update provider statistics
     */
    updateStats(provider, updates) {
        const stats = this.stats.get(provider);
        if (!stats)
            return;
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
    cleanup() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        for (const [provider, requests] of this.requestWindows.entries()) {
            const validRequests = requests.filter((timestamp) => now - timestamp < maxAge);
            if (validRequests.length === 0) {
                this.requestWindows.delete(provider);
            }
            else {
                this.requestWindows.set(provider, validRequests);
            }
        }
        logger_1.logger.debug("Rate limiter cleanup completed", {
            providersRemaining: this.requestWindows.size,
        });
    }
    /**
     * Destroy the rate limiter (cleanup)
     */
    destroy() {
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
exports.MCPRateLimiter = MCPRateLimiter;
// Export singleton instance
exports.mcpRateLimiter = MCPRateLimiter.getInstance();
//# sourceMappingURL=MCPRateLimiter.js.map