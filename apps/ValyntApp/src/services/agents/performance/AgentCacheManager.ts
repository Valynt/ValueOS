/**
 * Agent Cache Manager
 *
 * CONSOLIDATION: Response caching and memoization system for agent operations
 *
 * Provides intelligent caching with TTL, invalidation strategies, and
 * performance optimization for frequently accessed agent responses.
 */

import { AgentType } from "../../agent-types";
import { IAgent, AgentRequest, AgentResponse } from "../core/IAgent";
import { logger } from "../../../utils/logger";
import { agentTelemetryService } from "../telemetry/AgentTelemetryService";
import { getRedisClient } from "../../../lib/redisClient";
import { getMessageBus } from "../../MessageBus";

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
  /** Cache key */
  key: string;
  /** Cached response */
  response: AgentResponse;
  /** Creation timestamp */
  createdAt: Date;
  /** Last access timestamp */
  lastAccessedAt: Date;
  /** Access count */
  accessCount: number;
  /** Time to live in milliseconds */
  ttl: number;
  /** Cache size in bytes */
  size: number;
  /** Cache metadata */
  metadata: CacheMetadata;
  /** Cache tags */
  tags: string[];
}

export interface CacheMetadata {
  /** Agent type */
  agentType: AgentType;
  /** Request hash */
  requestHash: string;
  /** Response generation time */
  generationTime: number;
  /** Response confidence */
  confidence: string;
  /** Cache source */
  source: "agent" | "fallback" | "synthetic";
  /** Cache version */
  version: string;
  /** Distributed cache version */
  distributedVersion?: number;
  /** Dependencies */
  dependencies: CacheDependency[];
}

export interface CacheDependency {
  /** Dependency type */
  type: "data" | "config" | "model" | "service";
  /** Dependency identifier */
  identifier: string;
  /** Dependency version */
  version: string;
  /** Last modified timestamp */
  lastModified: Date;
}

export interface CacheConfig {
  /** Maximum cache size in MB */
  maxSize: number;
  /** Maximum number of entries */
  maxEntries: number;
  /** Default TTL in milliseconds */
  defaultTTL: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Cache eviction policy */
  evictionPolicy: EvictionPolicy;
  /** Compression settings */
  compression: CompressionSettings;
  /** Cache invalidation settings */
  invalidation: InvalidationSettings;
}

export type EvictionPolicy =
  | "lru" // Least Recently Used
  | "lfu" // Least Frequently Used
  | "ttl" // Time To Live
  | "size" // Size-based
  | "random";

export interface CompressionSettings {
  /** Enable compression */
  enabled: boolean;
  /** Compression algorithm */
  algorithm: "gzip" | "brotli" | "lz4";
  /** Minimum size to compress (bytes) */
  minSize: number;
  /** Compression level */
  level: number;
}

export interface InvalidationSettings {
  /** Enable auto-invalidation */
  enabled: boolean;
  /** Invalidation strategies */
  strategies: InvalidationStrategy[];
  /** Dependency tracking */
  trackDependencies: boolean;
  /** Event-based invalidation */
  eventBased: boolean;
}

export interface InvalidationStrategy {
  /** Strategy ID */
  id: string;
  /** Strategy type */
  type: "time_based" | "dependency_based" | "event_based" | "manual";
  /** Strategy configuration */
  config: Record<string, unknown>;
  /** Agent types this applies to */
  agentTypes: AgentType[];
  /** Enabled status */
  enabled: boolean;
}

export interface CacheStatistics {
  /** Total cache entries */
  totalEntries: number;
  /** Cache size in MB */
  currentSize: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Miss rate percentage */
  missRate: number;
  /** Total hits */
  totalHits: number;
  /** Total misses */
  totalMisses: number;
  /** Local cache hits */
  localHits: number;
  /** Local cache misses */
  localMisses: number;
  /** Redis cache hits */
  redisHits: number;
  /** Redis cache misses */
  redisMisses: number;
  /** Average response time from cache */
  avgCacheResponseTime: number;
  /** Average response time from agent */
  avgAgentResponseTime: number;
  /** Cache efficiency */
  efficiency: number;
  /** Evictions */
  evictions: number;
  /** Invalidations */
  invalidations: number;
  /** TTL expirations */
  ttlExpirations: number;
  /** Compression ratio */
  compressionRatio: number;
}

export interface CachePolicy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Policy description */
  description: string;
  /** Agent types this policy applies to */
  agentTypes: AgentType[];
  /** Cache configuration */
  config: CacheConfig;
  /** Cache rules */
  rules: CacheRule[];
  /** Enabled status */
  enabled: boolean;
}

export interface CacheRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule condition */
  condition: CacheCondition;
  /** Rule action */
  action: CacheAction;
  /** Rule priority */
  priority: number;
  /** Enabled status */
  enabled: boolean;
}

export interface CacheCondition {
  /** Condition type */
  type: "request_size" | "response_size" | "agent_type" | "confidence" | "custom";
  /** Condition operator */
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "matches";
  /** Condition value */
  value: unknown;
  /** Condition parameters */
  parameters?: Record<string, unknown>;
}

export interface CacheAction {
  /** Action type */
  type: "cache" | "skip" | "ttl_override" | "compression_override";
  /** Action parameters */
  parameters: Record<string, unknown>;
}

// ============================================================================
// Cache Manager Implementation
// ============================================================================

/**
 * Agent Cache Manager
 *
 * Provides intelligent caching and memoization for agent responses
 */
export class AgentCacheManager {
  private static instance: AgentCacheManager;
  private cache: Map<string, CacheEntry> = new Map();
  private cachePolicies: Map<string, CachePolicy> = new Map();
  private statistics: CacheStatistics;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private currentSize: number = 0;
  private redisNamespace = process.env.AGENT_CACHE_NAMESPACE || "agent-cache";
  private redisClientPromise: Promise<any> | null = null;
  private messageBus = getMessageBus();
  private static readonly CACHE_INVALIDATION_CHANNEL = "agent.cache.invalidation";

  private constructor() {
    this.statistics = this.initializeStatistics();
    this.initializeDefaultPolicies();
    this.initializeEventInvalidation();
    this.startCleanup();
    logger.info("AgentCacheManager initialized");
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentCacheManager {
    if (!AgentCacheManager.instance) {
      AgentCacheManager.instance = new AgentCacheManager();
    }
    return AgentCacheManager.instance;
  }

  /**
   * Get cached response
   */
  async get(request: AgentRequest): Promise<AgentResponse | null> {
    const startTime = Date.now();
    const key = this.generateCacheKey(request);
    const entry = this.cache.get(key);

    if (entry) {
      if (this.isExpired(entry)) {
        this.removeEntry(key, entry, "ttl");
      } else {
        const syncStatus = await this.syncLocalEntryWithRedis(key, entry);
        if (syncStatus === "valid") {
          this.recordLocalHit(request, entry, startTime, key);
          return entry.response;
        }

        if (syncStatus === "unavailable") {
          this.recordLocalHit(request, entry, startTime, key);
          return entry.response;
        }
      }
    }

    this.statistics.localMisses++;

    const redisResponse = await this.getFromRedis(request, key, startTime);
    if (redisResponse) {
      return redisResponse;
    }

    this.recordCacheMiss(request, key);
    return null;
  }

  /**
   * Set cached response
   */
  set(
    request: AgentRequest,
    response: AgentResponse,
    options?: {
      ttl?: number;
      tags?: string[];
      metadata?: Partial<CacheMetadata>;
    }
  ): Promise<void> {
    return this.setInternal(request, response, options);
  }

  /**
   * Set cached response
   */
  private async setInternal(
    request: AgentRequest,
    response: AgentResponse,
    options?: {
      ttl?: number;
      tags?: string[];
      metadata?: Partial<CacheMetadata>;
    }
  ): Promise<void> {
    const key = this.generateCacheKey(request);
    const policy = this.getCachePolicy(request.agentType);

    if (!policy || !policy.enabled) {
      return; // Caching disabled for this agent type
    }

    // Check if response should be cached based on rules
    if (!this.shouldCache(request, response, policy)) {
      logger.debug("Response not cached due to policy rules", {
        agentType: request.agentType,
        key,
      });
      return;
    }

    const now = new Date();
    const ttl = options?.ttl || policy.config.defaultTTL;
    const size = this.calculateSize(response);
    const tags = options?.tags || [];

    // Check cache size limits
    if (this.currentSize + size > policy.config.maxSize * 1024 * 1024) {
      this.evictEntries(policy.config.evictionPolicy, size);
    }

    // Check entry count limits
    if (this.cache.size >= policy.config.maxEntries) {
      this.evictEntries(policy.config.evictionPolicy, 0);
    }

    const metadata: CacheMetadata = {
      agentType: request.agentType,
      requestHash: this.hashRequest(request),
      generationTime: response.metadata?.duration || 0,
      confidence: response.confidence,
      source: "agent",
      version: "1.0.0",
      dependencies: [],
      ...options?.metadata,
    };

    const entry: CacheEntry = {
      key,
      response,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      ttl,
      size,
      metadata,
      tags,
    };

    this.cache.set(key, entry);
    this.currentSize += size;
    this.statistics.totalEntries = this.cache.size;
    this.statistics.currentSize = this.currentSize / (1024 * 1024);

    // Record cache set in telemetry
    agentTelemetryService.recordTelemetryEvent({
      type: "agent_cache_set",
      agentType: request.agentType,
      sessionId: request.sessionId,
      userId: request.userId,
      data: {
        cacheKey: key,
        ttl,
        size,
        tags,
      },
      severity: "info",
    });

    logger.debug("Cache set", {
      agentType: request.agentType,
      key,
      ttl,
      size,
      totalEntries: this.cache.size,
    });

    await this.persistToRedis(entry);
  }

  /**
   * Invalidate cache entries
   */
  invalidate(pattern: {
    agentType?: AgentType;
    tags?: string[];
    key?: string;
    olderThan?: Date;
    dependencies?: CacheDependency[];
  }): number {
    return this.invalidateInternal(pattern);
  }

  /**
   * Invalidate cache entries
   */
  private invalidateInternal(pattern: {
    agentType?: AgentType;
    tags?: string[];
    key?: string;
    olderThan?: Date;
    dependencies?: CacheDependency[];
  }): number {
    let invalidatedCount = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      let shouldDelete = false;

      // Check agent type
      if (pattern.agentType && entry.metadata.agentType === pattern.agentType) {
        shouldDelete = true;
      }

      // Check tags
      if (pattern.tags && pattern.tags.some((tag) => entry.tags.includes(tag))) {
        shouldDelete = true;
      }

      // Check key pattern
      if (pattern.key && key.includes(pattern.key)) {
        shouldDelete = true;
      }

      // Check dependencies
      if (pattern.dependencies && pattern.dependencies.length > 0) {
        const dependencyMatch = pattern.dependencies.some((dependency) =>
          entry.metadata.dependencies.some(
            (entryDep) =>
              entryDep.type === dependency.type && entryDep.identifier === dependency.identifier
          )
        );
        if (dependencyMatch) {
          shouldDelete = true;
        }
      }

      // Check age
      if (pattern.olderThan && entry.createdAt < pattern.olderThan) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        keysToDelete.push(key);
      }
    }

    // Delete entries
    for (const key of keysToDelete) {
      const entry = this.cache.get(key);
      if (entry) {
        this.removeEntry(key, entry, "invalidate");
        invalidatedCount++;
      }
    }

    this.statistics.invalidations += invalidatedCount;

    logger.info("Cache invalidated", {
      pattern,
      invalidatedCount,
      remainingEntries: this.cache.size,
    });

    return invalidatedCount;
  }

  /**
   * Invalidate cache entries by tag
   */
  async invalidateByTag(tag: string, publishEvent: boolean = true): Promise<number> {
    const invalidated = this.invalidateInternal({ tags: [tag] });
    await this.invalidateRedisByTag(tag);

    if (publishEvent) {
      await this.publishInvalidationEvent({ type: "tag", tag });
    }

    return invalidated;
  }

  /**
   * Invalidate cache entries by dependency
   */
  async invalidateByDependency(
    dependency: CacheDependency,
    publishEvent: boolean = true
  ): Promise<number> {
    const invalidated = this.invalidateInternal({
      dependencies: [dependency],
    });
    await this.invalidateRedisByDependency(dependency);

    if (publishEvent) {
      await this.publishInvalidationEvent({ type: "dependency", dependency });
    }

    return invalidated;
  }

  /**
   * Clear cache
   */
  clear(): void {
    const clearedCount = this.cache.size;
    this.cache.clear();
    this.currentSize = 0;
    this.statistics.invalidations += clearedCount;
    this.statistics.totalEntries = 0;
    this.statistics.currentSize = 0;

    logger.info("Cache cleared", {
      clearedCount,
    });
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Get cache entries matching criteria
   */
  getEntries(criteria?: {
    agentType?: AgentType;
    tags?: string[];
    olderThan?: Date;
    newerThan?: Date;
  }): CacheEntry[] {
    let entries = Array.from(this.cache.values());

    if (criteria) {
      if (criteria.agentType) {
        entries = entries.filter((e) => e.metadata.agentType === criteria.agentType);
      }

      if (criteria.tags && criteria.tags.length > 0) {
        entries = entries.filter((e) => criteria.tags!.some((tag) => e.tags.includes(tag)));
      }

      if (criteria.olderThan) {
        entries = entries.filter((e) => e.createdAt < criteria.olderThan);
      }

      if (criteria.newerThan) {
        entries = entries.filter((e) => e.createdAt > criteria.newerThan);
      }
    }

    return entries.sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime());
  }

  /**
   * Add or update cache policy
   */
  updateCachePolicy(policy: CachePolicy): void {
    this.cachePolicies.set(policy.id, policy);
    logger.info("Cache policy updated", { policyId: policy.id, agentTypes: policy.agentTypes });
  }

  /**
   * Get cache policy for agent type
   */
  getCachePolicy(agentType: AgentType): CachePolicy | undefined {
    for (const policy of this.cachePolicies.values()) {
      if (policy.agentTypes.includes(agentType) && policy.enabled) {
        return policy;
      }
    }
    return undefined;
  }

  /**
   * Warm up cache with common requests
   */
  async warmUp(
    agent: IAgent,
    requests: AgentRequest[]
  ): Promise<{
    successful: number;
    failed: number;
    skipped: number;
  }> {
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    logger.info("Starting cache warm-up", {
      agentType: agent.getAgentType(),
      requestCount: requests.length,
    });

    for (const request of requests) {
      // Check if already cached
      if (await this.get(request)) {
        skipped++;
        continue;
      }

      try {
        const response = await agent.execute(request);
        await this.set(request, response, { tags: ["warmup"] });
        successful++;
      } catch (error) {
        failed++;
        logger.warn("Cache warm-up request failed", {
          agentType: agent.getAgentType(),
          error: (error as Error).message,
        });
      }
    }

    logger.info("Cache warm-up completed", {
      agentType: agent.getAgentType(),
      successful,
      failed,
      skipped,
    });

    return { successful, failed, skipped };
  }

  /**
   * Reset cache manager
   */
  reset(): void {
    this.clear();
    this.statistics = this.initializeStatistics();
    this.initializeDefaultPolicies();
    logger.info("Agent cache manager reset");
  }

  /**
   * Shutdown cache manager
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    logger.info("Agent cache manager shutdown");
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generate cache key
   */
  private generateCacheKey(request: AgentRequest): string {
    const keyData = {
      agentType: request.agentType,
      query: request.query,
      parameters: request.parameters || {},
      context: request.context || {},
    };

    return Buffer.from(JSON.stringify(keyData)).toString("base64");
  }

  /**
   * Hash request
   */
  private hashRequest(request: AgentRequest): string {
    // Simple hash function - in production, use proper cryptographic hash
    return Buffer.from(JSON.stringify(request)).toString("base64").substring(0, 16);
  }

  /**
   * Calculate size of response
   */
  private calculateSize(response: AgentResponse): number {
    return Buffer.from(JSON.stringify(response)).length;
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.createdAt.getTime() > entry.ttl;
  }

  /**
   * Evict entries based on policy
   */
  private evictEntries(policy: EvictionPolicy, requiredSpace: number): void {
    const entries = Array.from(this.cache.entries());

    switch (policy) {
      case "lru":
        this.evictLRU(entries, requiredSpace);
        break;

      case "lfu":
        this.evictLFU(entries, requiredSpace);
        break;

      case "ttl":
        this.evictTTL(entries);
        break;

      case "size":
        this.evictBySize(entries, requiredSpace);
        break;

      case "random":
        this.evictRandom(entries, requiredSpace);
        break;

      default:
        this.evictLRU(entries, requiredSpace);
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(entries: [string, CacheEntry][], requiredSpace: number): void {
    const sorted = entries.sort(
      (a, b) => a[1].lastAccessedAt.getTime() - b[1].lastAccessedAt.getTime()
    );

    let freedSpace = 0;
    for (const [key, entry] of sorted) {
      if (freedSpace >= requiredSpace) break;

      this.removeEntry(key, entry, "eviction");
      freedSpace += entry.size;
    }
  }

  /**
   * Evict least frequently used entries
   */
  private evictLFU(entries: [string, CacheEntry][], requiredSpace: number): void {
    const sorted = entries.sort((a, b) => a[1].accessCount - b[1].accessCount);

    let freedSpace = 0;
    for (const [key, entry] of sorted) {
      if (freedSpace >= requiredSpace) break;

      this.removeEntry(key, entry, "eviction");
      freedSpace += entry.size;
    }
  }

  /**
   * Evict expired entries
   */
  private evictTTL(entries: [string, CacheEntry][]): void {
    const now = Date.now();

    for (const [key, entry] of entries) {
      if (now - entry.createdAt.getTime() > entry.ttl) {
        this.removeEntry(key, entry, "ttl");
      }
    }
  }

  /**
   * Evict largest entries
   */
  private evictBySize(entries: [string, CacheEntry][], requiredSpace: number): void {
    const sorted = entries.sort((a, b) => b[1].size - a[1].size);

    let freedSpace = 0;
    for (const [key, entry] of sorted) {
      if (freedSpace >= requiredSpace) break;

      this.removeEntry(key, entry, "eviction");
      freedSpace += entry.size;
    }
  }

  /**
   * Evict random entries
   */
  private evictRandom(entries: [string, CacheEntry][], requiredSpace: number): void {
    const shuffled = [...entries].sort(() => Math.random() - 0.5);

    let freedSpace = 0;
    for (const [key, entry] of shuffled) {
      if (freedSpace >= requiredSpace) break;

      this.removeEntry(key, entry, "eviction");
      freedSpace += entry.size;
    }
  }

  /**
   * Check if response should be cached
   */
  private shouldCache(
    request: AgentRequest,
    response: AgentResponse,
    policy: CachePolicy
  ): boolean {
    // Check cache rules
    for (const rule of policy.rules.sort((a, b) => b.priority - a.priority)) {
      if (!rule.enabled) continue;

      if (this.evaluateCondition(rule.condition, request, response)) {
        return rule.action.type === "cache";
      }
    }

    // Default behavior - cache successful responses
    return response.success;
  }

  /**
   * Evaluate cache condition
   */
  private evaluateCondition(
    condition: CacheCondition,
    request: AgentRequest,
    response: AgentResponse
  ): boolean {
    switch (condition.type) {
      case "agent_type":
        return this.evaluateOperator(condition.operator, request.agentType, condition.value);

      case "confidence":
        return this.evaluateOperator(condition.operator, response.confidence, condition.value);

      case "response_size":
        const responseSize = this.calculateSize(response);
        return this.evaluateOperator(condition.operator, responseSize, condition.value);

      case "custom":
        // Custom condition evaluation would go here
        return true;

      default:
        return true;
    }
  }

  /**
   * Evaluate operator
   */
  private evaluateOperator(operator: string, actual: unknown, expected: unknown): boolean {
    switch (operator) {
      case "equals":
        return actual === expected;
      case "not_equals":
        return actual !== expected;
      case "greater_than":
        return Number(actual) > Number(expected);
      case "less_than":
        return Number(actual) < Number(expected);
      case "contains":
        return String(actual).includes(String(expected));
      case "matches":
        return new RegExp(String(expected)).test(String(actual));
      default:
        return false;
    }
  }

  /**
   * Update cache response time statistics
   */
  private updateCacheResponseTime(responseTime: number): void {
    const currentAvg = this.statistics.avgCacheResponseTime;
    const totalHits = this.statistics.totalHits;

    this.statistics.avgCacheResponseTime =
      (currentAvg * (totalHits - 1) + responseTime) / totalHits;
  }

  /**
   * Update cache efficiency
   */
  private updateEfficiency(): void {
    const cacheTime = this.statistics.avgCacheResponseTime;
    const agentTime = this.statistics.avgAgentResponseTime;

    if (agentTime > 0) {
      this.statistics.efficiency = ((agentTime - cacheTime) / agentTime) * 100;
    }
  }

  /**
   * Initialize event-based invalidation hooks
   */
  private initializeEventInvalidation(): void {
    this.messageBus.subscribe(
      AgentCacheManager.CACHE_INVALIDATION_CHANNEL,
      "agent-cache-manager",
      async (event: any) => {
        const payload = event?.payload ?? event?.data ?? event;
        if (!payload || !payload.type) {
          return;
        }

        switch (payload.type) {
          case "tag":
            if (payload.tag) {
              await this.invalidateByTag(payload.tag, false);
            }
            break;
          case "dependency":
            if (payload.dependency) {
              await this.invalidateByDependency(payload.dependency, false);
            }
            break;
          case "key":
            if (payload.key) {
              this.invalidate({ key: payload.key });
            }
            break;
          case "agentType":
            if (payload.agentType) {
              this.invalidate({ agentType: payload.agentType });
            }
            break;
          default:
            break;
        }
      }
    );
  }

  /**
   * Publish invalidation events to the message bus
   */
  private async publishInvalidationEvent(payload: {
    type: "tag" | "dependency" | "key" | "agentType";
    tag?: string;
    dependency?: CacheDependency;
    key?: string;
    agentType?: AgentType;
  }): Promise<void> {
    try {
      await this.messageBus.publishMessage(AgentCacheManager.CACHE_INVALIDATION_CHANNEL, {
        channel: AgentCacheManager.CACHE_INVALIDATION_CHANNEL,
        agent_name: "agent-cache-manager",
        event_type: "broadcast",
        payload,
      } as any);
    } catch (error) {
      logger.warn("Failed to publish cache invalidation event", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Remove entry from local cache
   */
  private removeEntry(
    key: string,
    entry: CacheEntry,
    reason: "ttl" | "invalidate" | "eviction"
  ): void {
    this.cache.delete(key);
    this.currentSize -= entry.size;
    this.statistics.totalEntries = this.cache.size;
    this.statistics.currentSize = this.currentSize / (1024 * 1024);

    if (reason === "ttl") {
      this.statistics.ttlExpirations += 1;
    } else if (reason === "eviction") {
      this.statistics.evictions += 1;
    }
  }

  /**
   * Record local cache hit
   */
  private recordLocalHit(
    request: AgentRequest,
    entry: CacheEntry,
    startTime: number,
    key: string
  ): void {
    entry.lastAccessedAt = new Date();
    entry.accessCount++;
    this.statistics.totalHits++;
    this.statistics.localHits++;
    this.statistics.hitRate =
      (this.statistics.totalHits / (this.statistics.totalHits + this.statistics.totalMisses)) * 100;

    const responseTime = Date.now() - startTime;
    this.updateCacheResponseTime(responseTime);

    agentTelemetryService.recordTelemetryEvent({
      type: "agent_cache_hit",
      agentType: request.agentType,
      sessionId: request.sessionId,
      userId: request.userId,
      data: {
        cacheKey: key,
        responseTime,
        age: Date.now() - entry.createdAt.getTime(),
        accessCount: entry.accessCount,
        cacheTier: "local",
      },
      severity: "info",
    });

    logger.debug("Cache hit (local)", {
      agentType: request.agentType,
      key,
      age: Date.now() - entry.createdAt.getTime(),
      accessCount: entry.accessCount,
    });
  }

  /**
   * Record cache miss
   */
  private recordCacheMiss(request: AgentRequest, key: string): void {
    this.statistics.totalMisses++;
    this.statistics.missRate =
      (this.statistics.totalMisses / (this.statistics.totalHits + this.statistics.totalMisses)) * 100;

    agentTelemetryService.recordTelemetryEvent({
      type: "agent_cache_miss",
      agentType: request.agentType,
      sessionId: request.sessionId,
      userId: request.userId,
      data: {
        cacheKey: key,
      },
      severity: "info",
    });

    logger.debug("Cache miss", {
      agentType: request.agentType,
      key,
      totalMisses: this.statistics.totalMisses,
    });
  }

  /**
   * Sync local entry with Redis version/TTL
   */
  private async syncLocalEntryWithRedis(
    key: string,
    entry: CacheEntry
  ): Promise<"valid" | "stale" | "unavailable"> {
    const client = await this.getRedisClientSafe();
    if (!client) {
      return "unavailable";
    }

    try {
      const versionKey = this.buildRedisVersionKey(key);
      const entryKey = this.buildRedisEntryKey(key);
      const [redisVersion, ttlMs] = await Promise.all([
        client.get(versionKey),
        client.pTTL(entryKey),
      ]);

      if (!redisVersion || ttlMs <= 0) {
        this.statistics.redisMisses++;
        this.removeEntry(key, entry, "ttl");
        return "stale";
      }

      const redisVersionNumber = Number(redisVersion);
      if (
        Number.isFinite(redisVersionNumber) &&
        entry.metadata.distributedVersion === undefined
      ) {
        entry.metadata.distributedVersion = redisVersionNumber;
      }

      if (
        Number.isFinite(redisVersionNumber) &&
        entry.metadata.distributedVersion !== undefined &&
        redisVersionNumber !== entry.metadata.distributedVersion
      ) {
        this.statistics.invalidations += 1;
        this.removeEntry(key, entry, "invalidate");
        return "stale";
      }

      const remainingLocal = entry.ttl - (Date.now() - entry.createdAt.getTime());
      if (ttlMs > 0 && ttlMs < remainingLocal) {
        entry.ttl = ttlMs;
        entry.createdAt = new Date();
      }

      return "valid";
    } catch (error) {
      logger.warn("Redis sync failed for cache entry", {
        error: (error as Error).message,
      });
      return "unavailable";
    }
  }

  /**
   * Fetch entry from Redis and hydrate local cache
   */
  private async getFromRedis(
    request: AgentRequest,
    key: string,
    startTime: number
  ): Promise<AgentResponse | null> {
    const client = await this.getRedisClientSafe();
    if (!client) {
      return null;
    }

    try {
      const redisKey = this.buildRedisEntryKey(key);
      const cachedValue = await client.get(redisKey);

      if (!cachedValue) {
        this.statistics.redisMisses++;
        return null;
      }

      const ttlMs = await client.pTTL(redisKey);
      if (ttlMs <= 0) {
        this.statistics.redisMisses++;
        this.statistics.ttlExpirations += 1;
        return null;
      }

      const parsed = this.deserializeEntry(cachedValue);
      if (!parsed) {
        this.statistics.redisMisses++;
        return null;
      }

      const originalTtl = parsed.ttl;
      const ageOffset = Math.max(0, originalTtl - ttlMs);
      parsed.ttl = ttlMs;
      parsed.createdAt = new Date(Date.now() - ageOffset);
      parsed.lastAccessedAt = new Date();
      parsed.accessCount = 1;

      this.storeLocalEntry(parsed, request.agentType);

      this.statistics.totalHits++;
      this.statistics.redisHits++;
      this.statistics.hitRate =
        (this.statistics.totalHits / (this.statistics.totalHits + this.statistics.totalMisses)) *
        100;

      const responseTime = Date.now() - startTime;
      this.updateCacheResponseTime(responseTime);

      agentTelemetryService.recordTelemetryEvent({
        type: "agent_cache_hit",
        agentType: request.agentType,
        sessionId: request.sessionId,
        userId: request.userId,
        data: {
          cacheKey: key,
          responseTime,
          age: Date.now() - parsed.createdAt.getTime(),
          accessCount: parsed.accessCount,
          cacheTier: "redis",
        },
        severity: "info",
      });

      logger.debug("Cache hit (redis)", {
        agentType: request.agentType,
        key,
        ttlMs,
      });

      return parsed.response;
    } catch (error) {
      this.statistics.redisMisses++;
      logger.warn("Redis cache lookup failed", {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Store entry locally with eviction awareness
   */
  private storeLocalEntry(entry: CacheEntry, agentType: AgentType): void {
    const policy = this.getCachePolicy(agentType);
    if (!policy) {
      return;
    }

    if (this.currentSize + entry.size > policy.config.maxSize * 1024 * 1024) {
      this.evictEntries(policy.config.evictionPolicy, entry.size);
    }

    if (this.cache.size >= policy.config.maxEntries) {
      this.evictEntries(policy.config.evictionPolicy, 0);
    }

    this.cache.set(entry.key, entry);
    this.currentSize += entry.size;
    this.statistics.totalEntries = this.cache.size;
    this.statistics.currentSize = this.currentSize / (1024 * 1024);
  }

  /**
   * Persist entry to Redis with versioning
   */
  private async persistToRedis(entry: CacheEntry): Promise<void> {
    const client = await this.getRedisClientSafe();
    if (!client) {
      return;
    }

    try {
      const ttlSeconds = Math.max(1, Math.ceil(entry.ttl / 1000));
      const entryKey = this.buildRedisEntryKey(entry.key);
      const versionKey = this.buildRedisVersionKey(entry.key);
      const version = await client.incr(versionKey);
      entry.metadata.distributedVersion = version;

      await client.expire(versionKey, ttlSeconds);
      await client.setEx(entryKey, ttlSeconds, this.serializeEntry(entry));

      if (entry.tags.length > 0) {
        await Promise.all(
          entry.tags.map(async (tag) => {
            const tagKey = this.buildRedisTagKey(tag);
            await client.sAdd(tagKey, entry.key);
            await client.expire(tagKey, ttlSeconds);
          })
        );
      }

      if (entry.metadata.dependencies.length > 0) {
        await Promise.all(
          entry.metadata.dependencies.map(async (dependency) => {
            const depKey = this.buildRedisDependencyKey(dependency);
            await client.sAdd(depKey, entry.key);
            await client.expire(depKey, ttlSeconds);
          })
        );
      }
    } catch (error) {
      logger.warn("Failed to persist cache entry to Redis", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Invalidate Redis entries by tag
   */
  private async invalidateRedisByTag(tag: string): Promise<void> {
    const client = await this.getRedisClientSafe();
    if (!client) {
      return;
    }

    try {
      const tagKey = this.buildRedisTagKey(tag);
      const keys = await client.sMembers(tagKey);
      if (!keys || keys.length === 0) {
        return;
      }

      await Promise.all(
        keys.map(async (key: string) => {
          const entryKey = this.buildRedisEntryKey(key);
          const versionKey = this.buildRedisVersionKey(key);
          await client.del(entryKey, versionKey);
          await client.sRem(tagKey, key);
        })
      );
    } catch (error) {
      logger.warn("Failed to invalidate Redis cache by tag", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Invalidate Redis entries by dependency
   */
  private async invalidateRedisByDependency(dependency: CacheDependency): Promise<void> {
    const client = await this.getRedisClientSafe();
    if (!client) {
      return;
    }

    try {
      const depKey = this.buildRedisDependencyKey(dependency);
      const keys = await client.sMembers(depKey);
      if (!keys || keys.length === 0) {
        return;
      }

      await Promise.all(
        keys.map(async (key: string) => {
          const entryKey = this.buildRedisEntryKey(key);
          const versionKey = this.buildRedisVersionKey(key);
          await client.del(entryKey, versionKey);
          await client.sRem(depKey, key);
        })
      );
    } catch (error) {
      logger.warn("Failed to invalidate Redis cache by dependency", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Build Redis cache key
   */
  private buildRedisEntryKey(key: string): string {
    return `${this.redisNamespace}:entry:${key}`;
  }

  /**
   * Build Redis version key
   */
  private buildRedisVersionKey(key: string): string {
    return `${this.redisNamespace}:version:${key}`;
  }

  /**
   * Build Redis tag key
   */
  private buildRedisTagKey(tag: string): string {
    return `${this.redisNamespace}:tag:${tag}`;
  }

  /**
   * Build Redis dependency key
   */
  private buildRedisDependencyKey(dependency: CacheDependency): string {
    return `${this.redisNamespace}:dependency:${dependency.type}:${dependency.identifier}`;
  }

  /**
   * Serialize cache entry for Redis
   */
  private serializeEntry(entry: CacheEntry): string {
    return JSON.stringify({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
      lastAccessedAt: entry.lastAccessedAt.toISOString(),
      metadata: {
        ...entry.metadata,
        dependencies: entry.metadata.dependencies.map((dep) => ({
          ...dep,
          lastModified: dep.lastModified.toISOString(),
        })),
      },
    });
  }

  /**
   * Deserialize cache entry from Redis
   */
  private deserializeEntry(payload: string): CacheEntry | null {
    try {
      const parsed = JSON.parse(payload) as CacheEntry & {
        createdAt: string;
        lastAccessedAt: string;
        metadata: CacheMetadata & { dependencies: Array<CacheDependency & { lastModified: string }> };
      };

      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        lastAccessedAt: new Date(parsed.lastAccessedAt),
        metadata: {
          ...parsed.metadata,
          dependencies: parsed.metadata.dependencies.map((dep) => ({
            ...dep,
            lastModified: new Date(dep.lastModified),
          })),
        },
      };
    } catch (error) {
      logger.warn("Failed to deserialize Redis cache entry", {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Get Redis client safely
   */
  private async getRedisClientSafe(): Promise<any | null> {
    if (!this.redisClientPromise) {
      this.redisClientPromise = getRedisClient();
    }

    try {
      const client = await this.redisClientPromise;
      if (client && "isReady" in client && !client.isReady) {
        return null;
      }
      return client;
    } catch (error) {
      this.redisClientPromise = null;
      logger.warn("Redis client unavailable", {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60000); // Every minute
  }

  /**
   * Perform cleanup
   */
  private performCleanup(): void {
    const beforeSize = this.cache.size;

    // Remove expired entries
    this.evictTTL(Array.from(this.cache.entries()));

    // Update efficiency
    this.updateEfficiency();

    const cleanedCount = beforeSize - this.cache.size;

    if (cleanedCount > 0) {
      logger.debug("Cache cleanup completed", {
        cleanedCount,
        remainingEntries: this.cache.size,
        currentSize: this.currentSize,
      });
    }
  }

  /**
   * Initialize statistics
   */
  private initializeStatistics(): CacheStatistics {
    return {
      totalEntries: 0,
      currentSize: 0,
      hitRate: 0,
      missRate: 0,
      totalHits: 0,
      totalMisses: 0,
      localHits: 0,
      localMisses: 0,
      redisHits: 0,
      redisMisses: 0,
      avgCacheResponseTime: 0,
      avgAgentResponseTime: 0,
      efficiency: 0,
      evictions: 0,
      invalidations: 0,
      ttlExpirations: 0,
      compressionRatio: 0,
    };
  }

  /**
   * Initialize default cache policies
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicy: CachePolicy = {
      id: "default-cache-policy",
      name: "Default Cache Policy",
      description: "Default caching policy for all agents",
      agentTypes: ["opportunity", "target", "expansion", "integrity", "realization"],
      config: {
        maxSize: 100, // 100MB
        maxEntries: 10000,
        defaultTTL: 300000, // 5 minutes
        cleanupInterval: 60000, // 1 minute
        evictionPolicy: "lru",
        compression: {
          enabled: false,
          algorithm: "gzip",
          minSize: 1024, // 1KB
          level: 6,
        },
        invalidation: {
          enabled: true,
          strategies: [],
          trackDependencies: true,
          eventBased: true,
        },
      },
      rules: [
        {
          id: "cache-successful-responses",
          name: "Cache Successful Responses",
          condition: {
            type: "custom",
            operator: "equals",
            value: true,
          },
          action: {
            type: "cache",
            parameters: {},
          },
          priority: 1,
          enabled: true,
        },
        {
          id: "skip-low-confidence",
          name: "Skip Low Confidence Responses",
          condition: {
            type: "confidence",
            operator: "less_than",
            value: "low",
          },
          action: {
            type: "skip",
            parameters: {},
          },
          priority: 2,
          enabled: true,
        },
      ],
      enabled: true,
    };

    this.cachePolicies.set(defaultPolicy.id, defaultPolicy);
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const agentCacheManager = AgentCacheManager.getInstance();
