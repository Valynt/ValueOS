"use strict";
/**
 * Cache Implementation for MCP Ground Truth Server
 *
 * Provides in-memory caching with TTL support for expensive API calls.
 * Designed to reduce SEC API load and improve response times.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryCache = void 0;
exports.getCache = getCache;
exports.setCache = setCache;
const logger_1 = require("../../lib/logger");
class MemoryCache {
    cache = new Map();
    policy;
    cleanupInterval = null;
    constructor(policy = {
        tier1_ttl: 86400, // 24 hours
        tier2_ttl: 21600, // 6 hours
        tier3_ttl: 3600, // 1 hour
        max_size_mb: 100,
    }) {
        this.policy = policy;
        this.startCleanupInterval();
    }
    /**
     * Get cached value if available and not expired
     */
    async get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        // Check if expired
        const now = Date.now();
        const expiresAt = entry.created_at + entry.ttl * 1000;
        if (now > expiresAt) {
            this.cache.delete(key);
            return null;
        }
        // Update access stats
        entry.accessed_at = Date.now();
        entry.access_count++;
        logger_1.logger.debug("Cache hit", { key, accessCount: entry.access_count });
        return entry.value;
    }
    /**
     * Store value in cache with appropriate TTL based on tier
     */
    async set(key, value, tier) {
        // Check cache size limit
        if (this.getCacheSizeMB() >= this.policy.max_size_mb) {
            this.evictOldest();
        }
        const ttl = this.getTTLForTier(tier);
        const entry = {
            key,
            value,
            tier,
            ttl,
            created_at: Date.now(),
            accessed_at: Date.now(),
            access_count: 0,
        };
        this.cache.set(key, entry);
        logger_1.logger.debug("Cache set", { key, tier, ttl });
    }
    /**
     * Delete cached value
     */
    async delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            logger_1.logger.debug("Cache deleted", { key });
        }
        return deleted;
    }
    /**
     * Clear all cached values
     */
    async clear() {
        this.cache.clear();
        logger_1.logger.info("Cache cleared");
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const tierBreakdown = { tier1: 0, tier2: 0, tier3: 0 };
        for (const entry of this.cache.values()) {
            tierBreakdown[entry.tier]++;
        }
        return {
            totalEntries: this.cache.size,
            sizeMB: this.getCacheSizeMB(),
            tierBreakdown,
        };
    }
    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const expiredKeys = [];
        for (const [key, entry] of this.cache.entries()) {
            const expiresAt = entry.created_at + entry.ttl * 1000;
            if (now > expiresAt) {
                expiredKeys.push(key);
            }
        }
        for (const key of expiredKeys) {
            this.cache.delete(key);
        }
        if (expiredKeys.length > 0) {
            logger_1.logger.debug("Cache cleanup completed", {
                expiredKeys: expiredKeys.length,
            });
        }
    }
    /**
     * Start periodic cleanup
     */
    startCleanupInterval() {
        // Clean up every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }
    /**
     * Stop cleanup interval
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    /**
     * Get TTL for tier
     */
    getTTLForTier(tier) {
        switch (tier) {
            case "tier1":
                return this.policy.tier1_ttl;
            case "tier2":
                return this.policy.tier2_ttl;
            case "tier3":
                return this.policy.tier3_ttl;
            default:
                return this.policy.tier3_ttl;
        }
    }
    /**
     * Estimate cache size in MB
     */
    getCacheSizeMB() {
        let totalSize = 0;
        for (const entry of this.cache.values()) {
            // Rough estimation: JSON string length as bytes
            totalSize += JSON.stringify(entry).length;
        }
        return totalSize / (1024 * 1024); // Convert to MB
    }
    /**
     * Evict oldest entries when cache is full
     */
    evictOldest() {
        let oldestKey = null;
        let oldestTime = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.accessed_at < oldestTime) {
                oldestTime = entry.accessed_at;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
            logger_1.logger.debug("Cache eviction: removed oldest entry", { key: oldestKey });
        }
    }
}
exports.MemoryCache = MemoryCache;
// Singleton instance
let defaultCache = null;
/**
 * Get default cache instance
 */
function getCache() {
    if (!defaultCache) {
        defaultCache = new MemoryCache();
    }
    return defaultCache;
}
/**
 * Set custom cache implementation
 */
function setCache(cache) {
    if (defaultCache) {
        defaultCache.stopCleanup();
    }
    defaultCache = cache;
}
//# sourceMappingURL=Cache.js.map