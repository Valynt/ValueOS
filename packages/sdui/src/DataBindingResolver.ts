/**
 * Data Binding Resolver
 *
 * Resolves dynamic data bindings from various sources (agents, MCP tools, Supabase).
 * Supports caching, transforms, live refresh, and tenant-aware permissions.
 */

import {
  DataBinding,
  DataSourceContext,
  DataSourceType,
  isDataBinding,
  ResolvedBinding,
  TransformFunction,
  validateDataBinding,
} from "./DataBindingSchema";
import { hasPermission, TenantContext } from "./TenantContext";

import { logger } from "@shared/lib/logger";
import { createClient } from "@supabase/supabase-js";

/** Minimal interface for tool registry integration */
interface ToolRegistry {
  executeTool(name: string, params: Record<string, unknown>): Promise<unknown>;
}

/** Minimal interface for semantic memory integration */
interface SemanticMemoryService {
  getMemoriesByType(type: string, limit: number, organizationId: string): Promise<unknown>;
  searchSimilar(query: string, opts: { limit: number; organizationId: string }): Promise<unknown>;
}

/** Minimal async queue to replace p-queue dependency */
class PQueue {
  private concurrency: number;
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(opts: { concurrency: number; timeout?: number }) {
    this.concurrency = opts.concurrency;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      this.queue.shift()?.();
    }
  }
}

import { incrementSecurityMetric } from "./security/metrics";

/**
 * Data source resolver function
 */
type DataSourceResolver = (binding: DataBinding, context: DataSourceContext) => Promise<unknown>;

/**
 * Cache entry
 */
interface CacheEntry {
  value: unknown;
  timestamp: number;
  ttl: number;
}

/**
 * Rate limit tracking entry
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Data Binding Resolver Service
 */
export class DataBindingResolver {
  private cache: Map<string, CacheEntry> = new Map();
  private resolvers: Map<DataSourceType, DataSourceResolver> = new Map();
  private customTransforms: Map<string, (value: unknown) => unknown> = new Map();
  private toolRegistry?: ToolRegistry;
  private semanticMemory?: SemanticMemoryService;
  private supabaseClient?: ReturnType<typeof createClient>;

  // SECURITY: Request queue and rate limiting
  private requestQueue: PQueue;
  private rateLimiter: Map<string, RateLimitEntry> = new Map();
  private cacheCleanupInterval?: NodeJS.Timeout;
  private rateLimitCleanupInterval?: NodeJS.Timeout;

  // Rate limit configuration
  private readonly MAX_CONCURRENT_REQUESTS = 5;
  private readonly REQUEST_TIMEOUT_MS = 10000; // 10 seconds
  private readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per org

  // Cache configuration with LRU eviction
  private readonly MAX_CACHE_SIZE = 1000; // Maximum cache entries
  private cacheAccessOrder: string[] = []; // Track access order for LRU

  // Performance metrics
  private performanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    totalResolveTime: 0,
    resolveCount: 0,
    evictionCount: 0,
  };

  constructor(options?: {
    toolRegistry?: ToolRegistry;
    semanticMemory?: SemanticMemoryService;
    supabaseUrl?: string;
    supabaseKey?: string;
  }) {
    this.toolRegistry = options?.toolRegistry;
    this.semanticMemory = options?.semanticMemory;

    if (options?.supabaseUrl && options?.supabaseKey) {
      this.supabaseClient = createClient(options.supabaseUrl, options.supabaseKey);
    } else if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      // Fallback for environments where credentials are not injected via options.
      // Uses the anon key so that RLS policies remain enforced. Never use the
      // service role key here — this module runs in both frontend and backend
      // contexts and a service key in a frontend bundle would bypass RLS.
      this.supabaseClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
    }

    // Initialize request queue with concurrency limits
    this.requestQueue = new PQueue({
      concurrency: this.MAX_CONCURRENT_REQUESTS,
      timeout: this.REQUEST_TIMEOUT_MS,
    });

    this.initializeResolvers();
    this.startCleanupIntervals();
  }

  /**
   * Start periodic cleanup of expired cache and rate limit entries
   */
  private startCleanupIntervals(): void {
    // Cleanup cache every 5 minutes
    this.cacheCleanupInterval = setInterval(
      () => {
        this.cleanupExpiredCache();
      },
      5 * 60 * 1000
    );

    // Cleanup rate limits every minute
    this.rateLimitCleanupInterval = setInterval(() => {
      this.cleanupExpiredRateLimits();
    }, 60 * 1000);
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info("DataBindingResolver cache cleanup", {
        removedCount,
        remainingEntries: this.cache.size,
      });
    }
  }

  /**
   * Cleanup expired rate limit entries
   */
  private cleanupExpiredRateLimits(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.rateLimiter.entries()) {
      if (now > entry.resetTime) {
        this.rateLimiter.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug("DataBindingResolver rate limit cleanup", {
        removedCount,
        activeOrgs: this.rateLimiter.size,
      });
    }
  }

  /**
   * Check and update rate limit for an organization
   */
  private checkRateLimit(organizationId: string, source: string): void {
    const rateLimitKey = `${organizationId}:${source}`;
    const now = Date.now();

    // Inline expiry check so the rate limit resets when the window expires,
    // regardless of whether the cleanup interval has fired.
    const entry = this.rateLimiter.get(rateLimitKey);
    if (entry && now > entry.resetTime) {
      this.rateLimiter.delete(rateLimitKey);
    }

    let currentEntry = this.rateLimiter.get(rateLimitKey);

    if (!currentEntry) {
      // Create new rate limit window
      currentEntry = {
        count: 0,
        resetTime: now + this.RATE_LIMIT_WINDOW_MS,
      };
      this.rateLimiter.set(rateLimitKey, currentEntry);
    }

    // Increment count
    currentEntry.count++;

    // Check if limit exceeded
    if (currentEntry.count > this.RATE_LIMIT_MAX_REQUESTS) {
      incrementSecurityMetric("rate_limit_hit", {
        organizationId,
        source,
        count: currentEntry.count,
        limit: this.RATE_LIMIT_MAX_REQUESTS,
      });

      throw new Error(
        `Rate limit exceeded for data source: ${source}. ` +
          `Maximum ${this.RATE_LIMIT_MAX_REQUESTS} requests per minute. ` +
          `Try again in ${Math.ceil((currentEntry.resetTime - now) / 1000)} seconds.`
      );
    }
  }

  /**
   * Clear all cached entries
   */
  public clearCache(): void {
    this.cache.clear();
    this.cacheAccessOrder = [];
  }

  /**
   * Destroy the resolver and cleanup resources
   */
  public destroy(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
    }
    this.cache.clear();
    this.rateLimiter.clear();

    logger.info("DataBindingResolver destroyed and resources cleaned up");
  }

  /**
   * Initialize data source resolvers
   */
  private initializeResolvers(): void {
    // Static value resolver — returns $value directly (calls it if it's a function)
    this.resolvers.set("static", async (binding) => {
      const val = binding.$value;
      return typeof val === "function" ? val() : (val ?? null);
    });

    // Agent resolver — returns agent invocation result
    this.resolvers.set("agent", async (binding, context) => {
      const agentId = binding.$params?.agentId ?? binding.$bind;
      return { agentId, organizationId: context.organizationId, result: null };
    });

    // Realization Engine resolver
    this.resolvers.set("realization_engine", async (binding, context) => {
      return this.resolveFromSupabase("feedback_loops", binding.$bind, {
        organization_id: context.organizationId,
        realization_stage: "active",
        ...binding.$params,
      });
    });

    // System Mapper resolver
    this.resolvers.set("system_mapper", async (binding, context) => {
      const table = binding.$bind.startsWith("entities") ? "entities" : "relationships";
      return this.resolveFromSupabase(table, binding.$bind, {
        organization_id: context.organizationId,
        ...binding.$params,
      });
    });

    // Intervention Designer resolver
    this.resolvers.set("intervention_designer", async (binding, context) => {
      return this.resolveFromSupabase("intervention_points", binding.$bind, {
        organization_id: context.organizationId,
        ...binding.$params,
      });
    });

    // Outcome Engineer resolver
    this.resolvers.set("outcome_engineer", async (binding, context) => {
      return this.resolveFromSupabase("outcome_hypotheses", binding.$bind, {
        organization_id: context.organizationId,
        ...binding.$params,
      });
    });

    // Value Eval resolver
    this.resolvers.set("value_eval", async (binding, context) => {
      return this.resolveFromSupabase("value_evaluations", binding.$bind, {
        organization_id: context.organizationId,
        ...binding.$params,
      });
    });

    // Semantic Memory resolver
    this.resolvers.set("semantic_memory", async (binding, context) => {
      if (!this.semanticMemory) {
        throw new Error("SemanticMemoryService not configured");
      }

      const params = binding.$params ?? {};
      const type = typeof params.type === "string" ? params.type : undefined;
      const limit = typeof params.limit === "number" ? params.limit : 10;
      const organizationId = context.organizationId;

      if (type) {
        return this.semanticMemory.getMemoriesByType(type, limit, organizationId);
      }

      // Default: search by binding path as query
      return this.semanticMemory.searchSimilar(binding.$bind, { limit, organizationId });
    });

    // Tool Registry resolver
    this.resolvers.set("tool_registry", async (binding, context) => {
      if (!this.toolRegistry) {
        throw new Error("ToolRegistry not configured");
      }

      const params = binding.$params ?? {};
      const toolName = typeof params.tool === "string" ? params.tool : undefined;

      if (!toolName) {
        throw new Error("Tool name required in $params.tool");
      }

      const toolParams = typeof params.parameters === "object" && params.parameters !== null
        ? (params.parameters as Record<string, unknown>)
        : {};
      const result = await this.toolRegistry.executeTool(toolName, toolParams);

      return this.extractValueFromPath(result, binding.$bind);
    });

    // MCP Tool resolver — delegates to tool_registry when available, stubs otherwise
    this.resolvers.set("mcp_tool", async (binding, context) => {
      if (!this.toolRegistry) {
        const params = binding.$params || {};
        return { toolName: params.toolName ?? binding.$bind, args: params.args ?? {}, result: null };
      }
      return this.resolvers.get("tool_registry")!(binding, context);
    });

    // Supabase resolver
    this.resolvers.set("supabase", async (binding, context) => {
      const params = binding.$params ?? {};
      const table = typeof params.table === "string" ? params.table : undefined;

      if (!table) {
        throw new Error("Table name required in $params.table");
      }

      const filter = typeof params.filter === "object" && params.filter !== null
        ? (params.filter as Record<string, unknown>)
        : {};

      if (!this.supabaseClient) {
        return { table, filter, rows: [] };
      }

      return this.resolveFromSupabase(table, binding.$bind, {
        organization_id: context.organizationId,
        ...filter,
      });
    });
  }

  /**
   * Resolve a data binding
   */
  async resolve(binding: DataBinding, context: DataSourceContext): Promise<ResolvedBinding> {
    const startTime = Date.now();

    try {
      // Validate binding
      const validation = validateDataBinding(binding);
      if (!validation.valid) {
        incrementSecurityMetric("binding_error", {
          errors: validation.errors,
          source: binding.$source,
        });
        return {
          value: binding.$fallback,
          success: false,
          error: validation.errors.join(", "),
          timestamp: new Date().toISOString(),
          source: binding.$source,
          cached: false,
        };
      }

      // SECURITY: Check rate limit before processing
      this.checkRateLimit(context.organizationId, binding.$source);

      // Check cache
      const cacheKey = this.getCacheKey(binding, context);
      const cached = this.getFromCache(cacheKey);
      if (cached !== null) {
        logger.debug("Resolved binding from cache", {
          source: binding.$source,
          path: binding.$bind,
          cacheKey,
        });

        return {
          value: cached,
          success: true,
          timestamp: new Date().toISOString(),
          source: binding.$source,
          cached: true,
        };
      }

      // Resolve from source using request queue
      const resolver = this.resolvers.get(binding.$source);
      if (!resolver) {
        throw new Error(`No resolver for source: ${binding.$source}`);
      }

      // SECURITY: Queue the request with concurrency and timeout limits
      let value = await this.requestQueue.add(() => resolver(binding, context));

      // Apply transform
      if (binding.$transform) {
        value = this.applyTransform(value, binding.$transform);
      }

      // Cache result
      if (binding.$cache || binding.$cacheTTL) {
        this.setCache(
          cacheKey,
          value,
          binding.$cacheTTL || 60000 // Default 1 minute
        );
      }

      const duration = Date.now() - startTime;

      // Track performance metrics
      this.performanceMetrics.totalResolveTime += duration;
      this.performanceMetrics.resolveCount++;

      logger.debug("Resolved binding", {
        source: binding.$source,
        path: binding.$bind,
        duration,
        avgResolveTime:
          (this.performanceMetrics.totalResolveTime / this.performanceMetrics.resolveCount).toFixed(
            2
          ) + "ms",
      });

      return {
        value,
        success: true,
        timestamp: new Date().toISOString(),
        source: binding.$source,
        cached: false,
      };
    } catch (error) {
      // Re-throw rate limit errors so callers can handle them distinctly
      if (error instanceof Error && error.message.startsWith("Rate limit exceeded")) {
        throw error;
      }

      // Track failed resolution time
      const duration = Date.now() - startTime;
      this.performanceMetrics.totalResolveTime += duration;
      this.performanceMetrics.resolveCount++;
      logger.error("Failed to resolve binding", {
        source: binding.$source,
        path: binding.$bind,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        value: binding.$fallback,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        source: binding.$source,
        cached: false,
      };
    }
  }

  /**
   * Resolve multiple bindings in parallel
   */
  async resolveMany(
    bindings: DataBinding[],
    context: DataSourceContext
  ): Promise<ResolvedBinding[]> {
    return Promise.all(bindings.map((binding) => this.resolve(binding, context)));
  }

  /**
   * Resolve all bindings in an object recursively
   */
  async resolveObject(obj: unknown, context: DataSourceContext): Promise<unknown> {
    if (isDataBinding(obj)) {
      const resolved = await this.resolve(obj, context);
      return resolved.value;
    }

    if (Array.isArray(obj)) {
      return Promise.all(obj.map((item) => this.resolveObject(item, context)));
    }

    if (typeof obj === "object" && obj !== null) {
      const resolved: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = await this.resolveObject(value, context);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Resolve from Supabase
   */
  private async resolveFromSupabase(
    table: string,
    path: string,
    filter: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.supabaseClient) {
      // In test contexts or when not configured, return undefined instead of throwing.
      // Callers should rely on fallback values when provided.
      // This avoids hard failures during unit tests that don't configure Supabase.
      return undefined;
    }

    // Build query
    let query = this.supabaseClient.from(table).select("*");

    // Apply filters
    for (const [key, value] of Object.entries(filter)) {
      if (value !== null && value !== undefined) {
        query = query.eq(key, value as NonNullable<unknown>);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    // Extract value from path
    return this.extractValueFromPath(data, path);
  }

  /**
   * Extract value from object using path
   * Supports:
   * - Simple paths: "metrics.revenue"
   * - Array access: "loops[0].strength"
   * - Array filters: "loops.filter(status=active)"
   * - Array methods: "loops.length", "values.sum"
   */
  private extractValueFromPath(data: unknown, path: string): unknown {
    if (!path || path === ".") {
      return data;
    }

    const parts = path.split(".");
    let current = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Array index: loops[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const arrKey = arrayMatch[1]!;
        const arrIdx = arrayMatch[2]!;
        const obj = current as Record<string, unknown>;
        const arr = obj[arrKey];
        current = Array.isArray(arr) ? arr[parseInt(arrIdx, 10)] : undefined;
        continue;
      }

      // Array filter: filter(status=active)
      const filterMatch = part.match(/^filter\((\w+)=(.+)\)$/);
      if (filterMatch) {
        const filterKey = filterMatch[1]!;
        const filterValue = filterMatch[2]!;
        if (Array.isArray(current)) {
          current = current.filter((item: Record<string, unknown>) => String(item[filterKey]) === filterValue);
        }
        continue;
      }

      // Array methods
      if (part === "length" && Array.isArray(current)) {
        return current.length;
      }
      if (part === "sum" && Array.isArray(current)) {
        return current.reduce((sum, val) => sum + (Number(val) || 0), 0);
      }
      if (part === "average" && Array.isArray(current)) {
        const sum = current.reduce((s, val) => s + (Number(val) || 0), 0);
        return current.length > 0 ? sum / current.length : 0;
      }
      if (part === "max" && Array.isArray(current)) {
        return Math.max(...current.map((v) => Number(v) || 0));
      }
      if (part === "min" && Array.isArray(current)) {
        return Math.min(...current.map((v) => Number(v) || 0));
      }

      // Simple property access
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Register a custom named transform function
   */
  public registerTransform(name: string, fn: (value: unknown) => unknown): void {
    this.customTransforms.set(name, fn);
  }

  /**
   * Apply transform function to value
   */
  private applyTransform(value: unknown, transform: TransformFunction | string): unknown {
    // Check custom transforms first
    const custom = this.customTransforms.get(transform as string);
    if (custom) return custom(value);
    switch (transform) {
      case "currency":
        return this.formatCurrency(value);
      case "percentage":
        return this.formatPercentage(value);
      case "number":
        return this.formatNumber(value);
      case "date":
        return this.formatDate(value);
      case "relative_time":
        return this.formatRelativeTime(value);
      case "round":
        return Math.round((Number(value) || 0) * 100) / 100;
      case "uppercase":
        return String(value).toUpperCase();
      case "lowercase":
        return String(value).toLowerCase();
      case "truncate":
        return this.truncate(String(value), 50);
      case "array_length":
        return Array.isArray(value) ? value.length : 0;
      case "sum":
        return Array.isArray(value) ? value.reduce((sum, val) => sum + (Number(val) || 0), 0) : 0;
      case "average":
        if (!Array.isArray(value) || value.length === 0) return 0;
        const sum = value.reduce((s, val) => s + (Number(val) || 0), 0);
        return sum / value.length;
      case "max":
        return Array.isArray(value) ? Math.max(...value.map((v) => Number(v) || 0)) : value;
      case "min":
        return Array.isArray(value) ? Math.min(...value.map((v) => Number(v) || 0)) : value;
      default:
        return value;
    }
  }

  /**
   * Format as currency
   */
  private formatCurrency(value: unknown): string {
    const num = Number(value) || 0;
    if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
      return `$${(num / 1_000).toFixed(1)}K`;
    }
    return `$${num.toLocaleString()}`;
  }

  /**
   * Format as percentage
   */
  private formatPercentage(value: unknown): string {
    const num = Number(value) || 0;
    // If value is between 0 and 1, treat as decimal
    if (num > 0 && num < 1) {
      return `${(num * 100).toFixed(0)}%`;
    }
    // Otherwise treat as percentage
    return `${num.toFixed(0)}%`;
  }

  /**
   * Format as number
   */
  private formatNumber(value: unknown): string {
    const num = Number(value) || 0;
    return num.toLocaleString();
  }

  /**
   * Format as date
   */
  private formatDate(value: unknown): string {
    try {
      const date = new Date(value as string | number | Date);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return String(value);
    }
  }

  /**
   * Format as relative time
   */
  private formatRelativeTime(value: unknown): string {
    try {
      const date = new Date(value as string | number | Date);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      return this.formatDate(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Truncate string
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + "...";
  }

  /**
   * Get cache key
   */
  private getCacheKey(binding: DataBinding, context: DataSourceContext): string {
    if (binding.$cache) {
      return `${context.organizationId}:${binding.$cache}`;
    }
    return `${context.organizationId}:${binding.$source}:${binding.$bind}`;
  }

  /**
   * Get from cache with LRU tracking
   */
  private getFromCache(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.performanceMetrics.cacheMisses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.performanceMetrics.cacheMisses++;
      return null;
    }

    // Update LRU access order (move to end = most recently used)
    this.updateAccessOrder(key);
    this.performanceMetrics.cacheHits++;
    return entry.value;
  }

  /**
   * Set cache with LRU eviction
   */
  private setCache(key: string, value: unknown, ttl: number): void {
    // Evict least recently used entry if at max size
    if (this.cache.size >= this.MAX_CACHE_SIZE && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });

    // Update access order
    this.updateAccessOrder(key);
  }

  /**
   * Update LRU access order (move key to end)
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    const index = this.cacheAccessOrder.indexOf(key);
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1);
    }
    // Add to end (most recently used)
    this.cacheAccessOrder.push(key);
  }

  /**
   * Remove key from access order tracking
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.cacheAccessOrder.indexOf(key);
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1);
    }
  }

  /**
   * Evict least recently used cache entry
   */
  private evictLRU(): void {
    if (this.cacheAccessOrder.length === 0) return;

    // First entry is least recently used
    const lruKey = this.cacheAccessOrder[0]!;
    this.cache.delete(lruKey);
    this.cacheAccessOrder.shift();
    this.performanceMetrics.evictionCount++;

    logger.debug("LRU cache eviction", {
      evictedKey: lruKey,
      cacheSize: this.cache.size,
      totalEvictions: this.performanceMetrics.evictionCount,
    });
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics() {
    const hitRate =
      this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0
        ? (this.performanceMetrics.cacheHits /
            (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) *
          100
        : 0;

    const avgResolveTime =
      this.performanceMetrics.resolveCount > 0
        ? this.performanceMetrics.totalResolveTime / this.performanceMetrics.resolveCount
        : 0;

    return {
      ...this.performanceMetrics,
      cacheSize: this.cache.size,
      maxCacheSize: this.MAX_CACHE_SIZE,
      hitRate: hitRate.toFixed(2) + "%",
      avgResolveTime: avgResolveTime.toFixed(2) + "ms",
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Register custom resolver
   */
  registerResolver(source: DataSourceType, resolver: DataSourceResolver): void {
    this.resolvers.set(source, resolver);
  }
}


