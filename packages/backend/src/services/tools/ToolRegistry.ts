/**
 * Tool Registry with MCP-Compatible Interface and Per-Tenant Rate Limiting
 *
 * Implements Model Context Protocol (MCP) compatible tool interface
 * for hot-swappable tools without orchestrator refactoring.
 *
 * Sprint 5.5: Added per-tenant, per-tool token bucket rate limiting with
 * tier-based limits (free/pro/enterprise). Prevents noisy neighbor problems
 * and enables usage-based pricing enforcement.
 *
 * Based on:
 * - Anthropic's Model Context Protocol (MCP)
 * - OpenAI Function Calling specification
 * - Industry standard tool interfaces
 */

import { authorizationPolicyGateway } from "../policy/AuthorizationPolicyGateway.js";
import { PolicyEnforcementError } from "../policy/PolicyEnforcement.js";
import { logger } from "../utils/logger.js";


import { getMetricsCollector } from "./MetricsCollector.js";

// ---------------------------------------------------------------------------
// Tier-Based Rate Limiting Configuration
// ---------------------------------------------------------------------------

/**
 * Tenant tier types for rate limiting.
 */
export type TenantTier = 'free' | 'pro' | 'enterprise' | 'internal';

/**
 * Rate limit configuration per tier.
 */
interface TierRateLimits {
  /** Requests per minute */
  requestsPerMinute: number;
  /** Burst size for token bucket */
  burstSize: number;
  /** Window size in milliseconds */
  windowMs: number;
}

/**
 * Default rate limits per tenant tier.
 * These can be overridden via environment variables or configuration.
 */
const DEFAULT_TIER_LIMITS: Record<TenantTier, TierRateLimits> = {
  free: { requestsPerMinute: 10, burstSize: 5, windowMs: 60000 },
  pro: { requestsPerMinute: 100, burstSize: 20, windowMs: 60000 },
  enterprise: { requestsPerMinute: 1000, burstSize: 100, windowMs: 60000 },
  internal: { requestsPerMinute: 10000, burstSize: 500, windowMs: 60000 },
};

/**
 * Token bucket state for rate limiting.
 */
interface TokenBucket {
  /** Current token count */
  tokens: number;
  /** Last refill timestamp (ms) */
  lastRefill: number;
  /** Maximum tokens (burst size) */
  capacity: number;
  /** Tokens added per window */
  refillRate: number;
  /** Window size in milliseconds */
  windowMs: number;
}

/**
 * Get tenant tier from tenant ID or context.
 * In production, this would query a tenant service or cache.
 */
function getTenantTier(_tenantId: string): TenantTier {
  // TODO: Implement actual tier lookup from tenant service
  // For now, default to pro for most tenants
  return 'pro';
}

/**
 * JSON Schema for tool parameters
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  items?: JSONSchema;
  enum?: unknown[];
  [key: string]: unknown;
}

/**
 * MCP-compatible tool interface
 */
export interface MCPTool {
  /** Unique tool identifier */
  name: string;

  /** Human-readable description of what the tool does */
  description: string;

  /** JSON Schema defining the tool's parameters */
  parameters: JSONSchema;

  /** Execute the tool with given parameters */
  execute(
    params: Record<string, unknown>,
    context?: ToolExecutionContext
  ): Promise<ToolResult>;

  /** Optional: Validate parameters before execution */
  validate?(params: Record<string, unknown>): Promise<ValidationResult>;

  /** Optional: Tool metadata */
  metadata?: {
    version?: string;
    author?: string;
    category?: string;
    tags?: string[];
    rateLimit?: {
      maxCalls: number;
      windowMs: number;
    };
  };
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  userId?: string;
  /** Tenant (organization) ID — required for usage metering and tenant isolation. */
  tenantId?: string;
  sessionId?: string;
  workflowId?: string;
  agentType?: string;
  traceId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    duration?: number;
    cost?: number;
    tokensUsed?: number;
    cached?: boolean;
    policyVersion?: string;
    decisionId?: string;
  };
}

/**
 * Parameter validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Tool Registry
 *
 * Central registry for all tools with hot-swap capability and per-tenant
 * token bucket rate limiting.
 */
export class ToolRegistry {
  private tools: Map<string, MCPTool> = new Map();
  private executionHistory: Map<string, number> = new Map();
  private rateLimitWindows: Map<string, number[]> = new Map();

  // Sprint 5.5: Token bucket rate limiting per tenant/tool
  private tokenBuckets: Map<string, TokenBucket> = new Map();
  private tierRateLimits: Record<TenantTier, TierRateLimits> = DEFAULT_TIER_LIMITS;

  /**
   * Configure rate limits for a tenant tier.
   */
  setTierRateLimits(tier: TenantTier, limits: TierRateLimits): void {
    this.tierRateLimits[tier] = limits;
  }

  /**
   * Get the cache key for a tenant/tool combination.
   */
  private getBucketKey(tenantId: string, toolName: string): string {
    return `${tenantId}:${toolName}`;
  }

  /**
   * Get or create token bucket for tenant/tool.
   */
  private getTokenBucket(tenantId: string, toolName: string): TokenBucket {
    const key = this.getBucketKey(tenantId, toolName);

    let bucket = this.tokenBuckets.get(key);
    if (!bucket) {
      const tier = getTenantTier(tenantId);
      const limits = this.tierRateLimits[tier];

      bucket = {
        tokens: limits.burstSize,
        lastRefill: Date.now(),
        capacity: limits.burstSize,
        refillRate: limits.requestsPerMinute,
        windowMs: limits.windowMs,
      };

      this.tokenBuckets.set(key, bucket);
    }

    return bucket;
  }

  /**
   * Check rate limit using token bucket algorithm.
   * Returns true if allowed, false if rate limited.
   */
  private checkTokenBucket(tenantId: string, toolName: string): { allowed: boolean; retryAfter?: number } {
    const bucket = this.getTokenBucket(tenantId, toolName);
    const now = Date.now();

    // Calculate time since last refill
    const timePassed = now - bucket.lastRefill;
    const windowsPassed = timePassed / bucket.windowMs;

    // Refill tokens based on time passed
    const tokensToAdd = Math.floor(windowsPassed * bucket.refillRate);
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);

    // Update last refill time (account for partial windows)
    bucket.lastRefill = now - (timePassed % bucket.windowMs);

    // Check if we have tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }

    // Rate limited - calculate retry after
    const timeUntilNextToken = (1 - bucket.tokens) * (bucket.windowMs / bucket.refillRate);
    const retryAfter = Math.ceil(timeUntilNextToken / 1000);

    return { allowed: false, retryAfter };
  }

  /**
   * Register a tool
   */
  register(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      logger.warn("Tool already registered, replacing", {
        toolName: tool.name,
      });
    }

    // Validate tool interface
    this.validateToolInterface(tool);

    this.tools.set(tool.name, tool);

    logger.info("Tool registered", {
      name: tool.name,
      category: tool.metadata?.category,
      version: tool.metadata?.version,
    });
  }

  /**
   * Unregister a tool (hot-swap)
   */
  unregister(toolName: string): boolean {
    const removed = this.tools.delete(toolName);

    if (removed) {
      logger.info("Tool unregistered", { toolName });
    }

    return removed;
  }

  /**
   * Get a tool by name
   */
  get(toolName: string): MCPTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * List all registered tools
   */
  list(category?: string): MCPTool[] {
    const tools = Array.from(this.tools.values());

    if (category) {
      return tools.filter(t => t.metadata?.category === category);
    }

    return tools;
  }

  /**
   * Execute a tool
   */
  async execute(
    toolName: string,
    params: Record<string, unknown>,
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: {
          code: "TOOL_NOT_FOUND",
          message: `Tool not found: ${toolName}`,
        },
      };
    }

    // Check rate limits (Sprint 5.5: Use token bucket for tenant-aware limiting)
    const tenantId = context?.tenantId;
    let rateLimitResult: { allowed: boolean; message?: string; retryAfter?: number };

    if (tenantId) {
      // Use tenant-aware token bucket rate limiting
      const tokenResult = this.checkTokenBucket(tenantId, toolName);
      rateLimitResult = {
        allowed: tokenResult.allowed,
        message: tokenResult.allowed ? undefined : `Rate limit exceeded for tenant ${tenantId}. Try again in ${tokenResult.retryAfter}s.`,
        retryAfter: tokenResult.retryAfter,
      };
    } else {
      // Fall back to legacy per-tool rate limiting
      rateLimitResult = this.checkRateLimit(tool, context?.userId);
    }

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: rateLimitResult.message || "Rate limit exceeded",
          details: { retryAfter: rateLimitResult.retryAfter },
        },
      };
    }

    // Validate parameters
    if (tool.validate) {
      const validation = await tool.validate(params);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: "INVALID_PARAMETERS",
            message: "Parameter validation failed",
            details: { errors: validation.errors },
          },
        };
      }
    }

    // Execute tool
    const startTime = Date.now();
    const agentType = context?.agentType;

    try {
      const decision = authorizationPolicyGateway.authorize({
        channel: "tool_registry",
        action: "execute",
        resource: toolName,
        subject: {
          userId: context?.userId,
          tenantId: context?.tenantId,
          sessionId: context?.sessionId,
          agentType,
        },
        metadata: {
          traceId: context?.traceId,
          requestId: context?.requestId,
          workflowId: context?.workflowId,
        },
      });

      const policyVersion = decision.policyVersion;

      logger.info("Executing tool", {
        toolName,
        userId: context?.userId,
        workflowId: context?.workflowId,
        policyVersion,
        decisionId: decision.decisionId,
      });

      const result = await tool.execute(params, context);

      const duration = Date.now() - startTime;

      // Track execution
      this.trackExecution(toolName, context?.userId);

      // Emit api_calls usage event for successful tool invocations only.
      // Failed calls are not billed (per billing-v2 spec).
      if (result.success && context?.tenantId) {
        try {
          const idempotencyKey = context?.requestId
            ? `${context.requestId}:${toolName}`
            : context?.sessionId
              ? `${context.sessionId}:${toolName}`
              : undefined;

          getMetricsCollector().recordUsage({
            tenantId: context.tenantId,
            metric: "api_calls",
            quantity: 1,
            path: `/tools/${toolName}`,
            idempotencyKey,
          });
        } catch {
          /* metering is non-fatal */
        }
      }

      logger.info("Tool execution completed", {
        toolName,
        success: result.success,
        duration,
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          duration,
          policyVersion,
          decisionId: decision.decisionId,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof PolicyEnforcementError) {
        throw error;
      }

      logger.error("Tool execution failed", {
        toolName,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      });

      return {
        success: false,
        error: {
          code: "EXECUTION_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        metadata: {
          duration,
        },
      };
    }
  }

  /**
   * Validate tool interface
   */
  private validateToolInterface(tool: MCPTool): void {
    if (!tool.name || typeof tool.name !== "string") {
      throw new Error("Tool must have a valid name");
    }

    if (!tool.description || typeof tool.description !== "string") {
      throw new Error("Tool must have a description");
    }

    if (!tool.parameters || typeof tool.parameters !== "object") {
      throw new Error("Tool must have parameters schema");
    }

    if (typeof tool.execute !== "function") {
      throw new Error("Tool must have an execute function");
    }
  }

  /**
   * Check rate limits
   */
  private checkRateLimit(
    tool: MCPTool,
    userId?: string
  ): { allowed: boolean; message?: string; retryAfter?: number } {
    if (!tool.metadata?.rateLimit) {
      return { allowed: true };
    }

    const key = `${tool.name}:${userId || "anonymous"}`;
    const now = Date.now();
    const window = tool.metadata.rateLimit.windowMs;
    const maxCalls = tool.metadata.rateLimit.maxCalls;

    // Get or create window
    let calls = this.rateLimitWindows.get(key) || [];

    // Remove old calls outside window
    calls = calls.filter(timestamp => now - timestamp < window);

    // Check limit
    if (calls.length >= maxCalls) {
      const oldestCall = Math.min(...calls);
      const retryAfter = Math.ceil((oldestCall + window - now) / 1000);

      return {
        allowed: false,
        message: `Rate limit exceeded. Max ${maxCalls} calls per ${window}ms`,
        retryAfter,
      };
    }

    // Add current call
    calls.push(now);
    this.rateLimitWindows.set(key, calls);

    return { allowed: true };
  }

  /**
   * Track tool execution
   */
  private trackExecution(toolName: string, userId?: string): void {
    const key = `${toolName}:${userId || "anonymous"}`;
    const count = this.executionHistory.get(key) || 0;
    this.executionHistory.set(key, count + 1);
  }

  /**
   * Get tool execution statistics
   */
  getStatistics(toolName?: string): {
    totalExecutions: number;
    byTool: Record<string, number>;
  } {
    let totalExecutions = 0;
    const byTool: Record<string, number> = {};

    for (const [key, count] of this.executionHistory.entries()) {
      const [tool] = key.split(":");

      if (toolName && tool !== toolName) continue;

      totalExecutions += count;
      byTool[tool] = (byTool[tool] || 0) + count;
    }

    return { totalExecutions, byTool };
  }

  /**
   * Convert tools to OpenAI function format
   */
  toOpenAIFunctions(): Array<{
    name: string;
    description: string;
    parameters: JSONSchema;
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Convert tools to Anthropic tool format
   */
  toAnthropicTools(): Array<{
    name: string;
    description: string;
    input_schema: JSONSchema;
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  /**
   * Clear all tools (for testing)
   */
  clear(): void {
    this.tools.clear();
    this.executionHistory.clear();
    this.rateLimitWindows.clear();
    logger.info("Tool registry cleared");
  }
}

/**
 * Abstract base class for tools
 */
export abstract class BaseTool implements MCPTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: JSONSchema;
  abstract execute(
    params: Record<string, unknown>,
    context?: ToolExecutionContext
  ): Promise<ToolResult>;

  metadata?: MCPTool["metadata"];

  async validate(params: Record<string, unknown>): Promise<ValidationResult> {
    // Basic validation against JSON schema
    const errors: string[] = [];

    if (this.parameters.required) {
      for (const field of this.parameters.required) {
        if (!(field in params)) {
          errors.push(`Missing required parameter: ${field}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
