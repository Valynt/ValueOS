import { logger } from "@shared/lib/logger";
import {
  BaseEvent,
  EVENT_TOPICS,
} from "@shared/types/events";
import { createHash } from "node:crypto";
import { Request, Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { getAgentAPIConfig } from "../config/ServiceConfigManager.js";
import { createAgentFactory } from "../lib/agent-fabric/AgentFactory.js";
import { CircuitBreaker } from "../lib/agent-fabric/CircuitBreaker.js";
import { MissingTenantContextError } from "../lib/errors.js";
import { LLMGateway } from "../lib/agent-fabric/LLMGateway.js";
import { MemorySystem } from "../lib/agent-fabric/MemorySystem.js";
import { SupabaseMemoryBackend } from "../lib/agent-fabric/SupabaseMemoryBackend.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { rateLimiters } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";
import { securityHeadersMiddleware } from "../middleware/securityMiddleware.js";
import { usageEnforcement } from "../middleware/usageEnforcement.js";
// In-process agent response cache (non-tenant routing state — Map is acceptable per ADR-0012)
const _agentResponseCache = new Map<
  string,
  { value: unknown; expiresAt: number }
>();
const AGENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Maximum number of entries the in-process cache may hold at once.
 * When the cap is reached the oldest-inserted entry is evicted (FIFO) before
 * the new one is stored. This bounds heap growth under sustained unique-query
 * load or a deliberate amplification attack.
 * Override via AGENT_CACHE_MAX_ENTRIES.
 */
const AGENT_CACHE_MAX_ENTRIES = (() => {
  const raw = process.env.AGENT_CACHE_MAX_ENTRIES;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 500;
})();

// Proactively evict expired entries every 5 minutes so the Map does not
// accumulate stale entries between reads.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of _agentResponseCache) {
    if (now > entry.expiresAt) {
      _agentResponseCache.delete(key);
    }
  }
}, 5 * 60 * 1000).unref(); // .unref() so this timer does not prevent process exit

/**
 * Build a cache key that is strictly scoped to a tenant.
 * Throws MissingTenantContextError when no tenant identifier is present —
 * falling back to a shared key would allow cross-tenant cache hits.
 */
function _agentCacheKey(
  query: string,
  context: Record<string, unknown>
): string {
  const tenantId = context["tenantId"] || context["organization_id"];
  if (!tenantId) {
    throw new MissingTenantContextError("agent cache");
  }
  const { sessionId: _s, timestamp: _t, ...normalized } = context;
  const str = query + JSON.stringify(normalized);
  // Use SHA-256 for strong collision resistance
  const hash = createHash('sha256').update(str).digest('hex').slice(0, 16);
  return `${String(context["agentType"] ?? "unknown")}:${String(tenantId)}:${hash}`;
}

const agentCache = {
  async get(
    query: string,
    context: Record<string, unknown>
  ): Promise<unknown | null> {
    // Throws MissingTenantContextError if tenant context is absent — callers must handle.
    const key = _agentCacheKey(query, context);
    const entry = _agentResponseCache.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      _agentResponseCache.delete(key);
      return null;
    }
    return entry.value;
  },
  async set(
    query: string,
    context: Record<string, unknown>,
    value: unknown
  ): Promise<void> {
    // Throws MissingTenantContextError if tenant context is absent — callers must handle.
    const key = _agentCacheKey(query, context);

    // Enforce size cap: evict the oldest entry (first key in insertion order)
    // before adding a new one when at capacity.
    if (!_agentResponseCache.has(key) && _agentResponseCache.size >= AGENT_CACHE_MAX_ENTRIES) {
      const oldestKey = _agentResponseCache.keys().next().value;
      if (oldestKey !== undefined) {
        _agentResponseCache.delete(oldestKey);
      }
    }

    _agentResponseCache.set(key, {
      value,
      expiresAt: Date.now() + AGENT_CACHE_TTL_MS,
    });
  },
};
import { isKafkaEnabled } from "../services/kafkaConfig.js";
import { modelCardService } from "../services/llm/ModelCardService.js";
import { getMetricsCollector } from "../services/monitoring/MetricsCollector.js";
import { getEventSourcingService } from "../services/post-v1/EventSourcingService.js";
import { getEventProducer } from "../services/realtime/EventProducer.js";
import type { LifecycleContext, LifecycleStage } from "../types/agent.js";
import type { AgentOutput } from "../types/agent.js";
import { sanitizeAgentInput } from "../utils/security.js";
import type { AgentType } from "../services/agent-types.js";
import {
  GovernanceVetoError,
} from "../lib/agent-fabric/hardening/index.js";
import {
  executeWithHardenedRunner,
  mapGovernanceVetoStatus,
  requiresHardenedExecution,
} from "../services/agents/HardenedExecution.js";
import {
  buildInteractiveSyncDeniedMessage,
  getAgentColdStartClass,
  isDirectSyncFallbackAllowedWithoutKafka,
} from "../services/agents/AgentInvocationPolicy.js";

// Shared factory instance — created lazily on first direct-execution request.
// Avoids startup cost when Kafka is available.
// DEBT-001 fix: use provider "together" — LLMGateway only implements "together".
// DEBT-002 fix: enable_persistence: true with SupabaseMemoryBackend so agent
//               memory survives across HTTP requests (consistent with ExecutionRuntime).
let _directFactory: ReturnType<typeof createAgentFactory> | null = null;
function getDirectFactory(): ReturnType<typeof createAgentFactory> {
  if (!_directFactory) {
    _directFactory = createAgentFactory({
      llmGateway: new LLMGateway({
        provider: "together",
        model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      }),
      memorySystem: new MemorySystem(
        { max_memories: 1000, enable_persistence: true },
        new SupabaseMemoryBackend()
      ),
      circuitBreaker: new CircuitBreaker(),
    });
  }
  return _directFactory;
}

async function runAgentWithHardening(params: {
  agentId: AgentType;
  tenantId: string;
  userId: string;
  sessionId: string;
  traceId: string;
  lifecycleContext: LifecycleContext;
  execute: (ctx: LifecycleContext) => Promise<AgentOutput>;
}): Promise<AgentOutput> {
  const { agentId, tenantId, userId, sessionId, traceId, lifecycleContext, execute } = params;
  const normalizeResult = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : { value };
  const hardened = await executeWithHardenedRunner({
    agentId,
    organizationId: tenantId,
    userId,
    sessionId,
    traceId,
    lifecycleContext,
    execute,
    prompt: String(lifecycleContext.user_inputs?.query ?? ""),
  });

  logger.info("Direct agent execution governance", {
    agentId,
    traceId,
    governance_verdict: hardened.governance.verdict,
    confidence_overall: hardened.confidence.overall,
    confidence_label: hardened.confidence.label,
  });

  return {
    agent_id: String(agentId),
    agent_type: agentId,
    lifecycle_stage: lifecycleContext.lifecycle_stage,
    status: "success",
    result: normalizeResult(hardened.output),
    confidence: hardened.confidence.label,
    metadata: {
      execution_time_ms: 0,
      model_version: "hardened",
      timestamp: new Date().toISOString(),
      token_usage: {
        prompt_tokens: hardened.tokenUsage.prompt_tokens,
        completion_tokens: hardened.tokenUsage.completion_tokens,
        total_tokens: hardened.tokenUsage.total_tokens,
      },
    },
  };
}

const router: ReturnType<typeof Router> = Router();

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function resolveExternalSub(req: Request): string | undefined {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user as Record<string, unknown> | undefined;

  const direct =
    user?.["sub"] ||
    user?.["oidc_sub"] ||
    (user?.["user_metadata"] as Record<string, unknown> | undefined)?.["sub"] ||
    (user?.["app_metadata"] as Record<string, unknown> | undefined)?.["sub"];
  if (typeof direct === "string" && direct.length > 0) return direct;

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const claims = decodeJwtPayload(authHeader.slice(7));
    const claimSub = claims?.sub;
    if (typeof claimSub === "string" && claimSub.length > 0) {
      return claimSub;
    }
  }

  return undefined;
}

/** Minimal shape of an audit-trail event as stored by EventSourcingService. */
interface AuditEvent {
  eventType: string;
  timestamp: string;
  payload: {
    agentId?: string;
    userId?: string;
    tenantId?: string;
    sessionId?: string;
    query?: string;
    context?: Record<string, unknown>;
    response?: unknown;
    error?: string;
    latency?: number;
    [key: string]: unknown;
  };
}

type AuditTrailProjection = {
  data?: {
    events?: AuditEvent[];
  };
};

type AgentRequestPayload = {
  agentId: string;
  userId: string;
  externalSub?: string;
  sessionId: string;
  tenantId: string;
  query: string;
  context?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  priority: string;
  timeout: number;
};

function buildAgentRequestEvent(
  correlationId: string,
  payload: AgentRequestPayload
): BaseEvent {
  return {
    type: "agent.request",
    eventType: "agent.request",
    eventId: correlationId,
    version: "1.0.0",
    timestamp: new Date(),
    source: "agent-api",
    correlationId,
    payload,
  };
}

function kafkaUnavailableResponse(res: Response): Response {
  return res.status(503).json({
    success: false,
    error: {
      code: "KAFKA_DISABLED",
      message:
        "Kafka-backed agent execution is disabled in this deployment profile.",
    },
  });
}

router.use(securityHeadersMiddleware);
router.use(requirePermission("agents.execute"));

// ... rest of the code remains the same ...
router.get(
  "/:agentId/info",
  rateLimiters.loose,
  (req: Request, res: Response) => {
    const { agentId } = req.params;
    const modelCard = modelCardService.getModelCard(agentId as string);

    if (!modelCard) {
      return void res.status(404).json({
        error: "Model card not found",
        message: `No model metadata available for agent ${agentId}`,
      });
    }

    res.setHeader("x-model-card-version", modelCard.schemaVersion);

    return void res.json({
      success: true,
      data: {
        agent_id: agentId,
        model_card: modelCard.modelCard,
      },
    });
  }
);

/**
 * Invoke an agent asynchronously using event-driven architecture
 *
 * QUEUE ROUTING STRATEGY:
 * - This endpoint uses KAFKA (via EventProducer) for external HTTP requests
 * - Kafka provides distributed event streaming with persistence and replay
 * - AgentExecutorService consumes from Kafka and executes agents
 *
 * For internal orchestration (e.g., UnifiedAgentOrchestrator), use:
 * - BullMQ (via AgentMessageQueue) for Redis-backed job processing
 * - BullMQ provides priority queuing, rate limiting, and job tracking
 *
 * @see AgentExecutorService - Kafka consumer for agent execution
 * @see AgentMessageQueue - BullMQ queue for internal orchestration
 */
router.post(
  "/:agentId/invoke",
  rateLimiters.agentExecution,
  // Enforce llm_tokens quota before executing. Returns 402 when the tenant is
  // at their hard cap. Soft limit (80%) logs a warning but does not block.
  ...usageEnforcement({ metric: "llm_tokens" }),
  async (req: Request, res: Response) => {
    const { agentId } = req.params;

    // Zod Validation Schema
    // parameters is restricted to scalar values (string | number | boolean) so
    // nested objects cannot smuggle unsanitized strings into agent prompts.
    const invokeSchema = z.object({
      query: z.string().max(2000),
      context: z.any().optional(), // Flexible context
      parameters: z
        .record(z.union([z.string(), z.number(), z.boolean()]))
        .optional(),
      sessionId: z.string().max(100).optional(),
    });

    // Validate request body
    const validationResult = invokeSchema.safeParse(req.body);

    if (!validationResult.success) {
      return void res.status(400).json({
        error: "Invalid request",
        message: "Request validation failed",
        details: validationResult.error.errors,
      });
    }

    const { query, context, parameters, sessionId } = validationResult.data;
    const { sanitized, safe, severity, violations } = sanitizeAgentInput(query);
    const sanitizedQuery =
      typeof sanitized === "string" ? sanitized : String(sanitized);

    if (!safe) {
      logger.warn("Blocked unsafe agent prompt", {
        agentId,
        severity,
        violations,
        userId: (req as AuthenticatedRequest).user?.id,
        tenantId: (req as AuthenticatedRequest).tenantId,
      });

      return void res.status(400).json({
        error: "Invalid request",
        message: "Agent prompt rejected due to unsafe content",
      });
    }

    // Sanitize string values in parameters to prevent prompt injection.
    // Numbers and booleans are safe scalars; they pass through unchanged.
    // Nested objects are rejected at the schema level above.
    let sanitizedParameters:
      | Record<string, string | number | boolean>
      | undefined;
    if (parameters) {
      sanitizedParameters = {};
      for (const [key, value] of Object.entries(parameters)) {
        if (typeof value === "string") {
          const {
            sanitized: sanitizedValue,
            safe: paramSafe,
            violations: paramViolations,
          } = sanitizeAgentInput(value);
          if (!paramSafe) {
            logger.warn("Blocked unsafe agent parameter", {
              agentId,
              key,
              violations: paramViolations,
              userId: (req as AuthenticatedRequest).user?.id,
              tenantId: (req as AuthenticatedRequest).tenantId,
            });
            return void res.status(400).json({
              error: "Invalid request",
              message: `Agent parameter '${key}' rejected due to unsafe content`,
            });
          }
          sanitizedParameters[key] =
            typeof sanitizedValue === "string"
              ? sanitizedValue
              : String(sanitizedValue);
        } else {
          sanitizedParameters[key] = value;
        }
      }
    }

    // Add tenant context validation
    const tenantId = (req as AuthenticatedRequest).tenantId;
    if (!tenantId) {
      return void res.status(403).json({
        error: "tenant_required",
        message: "Tenant context is required for agent invocation",
      });
    }

    // Check Cache
    try {
      const startTime = Date.now();
      const cachedResponse = await agentCache.get(sanitizedQuery, {
        ...context,
        agentId,
        tenantId,
      });
      if (cachedResponse) {
        // Record Cache Hit Metric
        try {
          const metrics = getMetricsCollector();
          metrics.recordAgentInvocation(agentId, true, Date.now() - startTime);
          metrics.recordLLMCall("cache", agentId, 0, 0, true);
        } catch (mErr) {
          /* ignore */
        }

        return void res.json({
          success: true,
          data: {
            jobId: "cached-result",
            status: "completed",
            result: cachedResponse,
            message: "Result retrieved from cache",
            cached: true,
          },
        });
      }
    } catch (cacheError) {
      if (cacheError instanceof MissingTenantContextError) {
        logger.error("Agent cache rejected request: missing tenant context", {
          agentId,
          userId: (req as AuthenticatedRequest).user?.id,
        });
        return void res.status(403).json({
          success: false,
          error: {
            code: "TENANT_CONTEXT_REQUIRED",
            message: "Tenant context is required for agent cache access",
          },
        });
      }
      logger.warn(
        "Cache check failed",
        cacheError instanceof Error ? cacheError : undefined
      );
    }

    if (!isKafkaEnabled()) {
      if (!isDirectSyncFallbackAllowedWithoutKafka(agentId as AgentType)) {
        return void res.status(409).json({
          success: false,
          error: {
            code: "AGENT_ASYNC_ONLY",
            message: buildInteractiveSyncDeniedMessage(agentId as AgentType, "/api/agents/:agentId/invoke"),
            coldStartClass: getAgentColdStartClass(agentId as AgentType),
            recommendedWorkflow: "Use the queued /api/agents/:agentId/invoke flow with Kafka enabled, then poll /api/agents/jobs/:jobId or stream /api/agents/jobs/:jobId/stream.",
          },
        });
      }

      // Direct execution fallback: run the agent synchronously without Kafka.
      // Returns the same response shape as the Kafka path so callers are mode-agnostic.
      const jobId = uuidv4();
      const userId = (req as AuthenticatedRequest).user?.id ?? "unknown";
      const directStartTime = Date.now();
      try {
        const factory = getDirectFactory();
        if (!factory.hasFabricAgent(agentId)) {
          logger.warn("Direct agent execution: unknown agent type", {
            agentId,
            tenantId,
            userId,
          });
          return void res.status(404).json({
            success: false,
            error: {
              code: "AGENT_NOT_FOUND",
              message: `No fabric implementation for agent "${agentId}"`,
            },
          });
        }

        logger.info("Direct agent execution started", {
          agentId,
          jobId,
          tenantId,
          userId,
          mode: "direct",
        });

        const agent = factory.create(agentId, tenantId);
        const lifecycleContext: LifecycleContext = {
          workspace_id:
            ((context as Record<string, unknown>)?.workspace_id as string) ??
            jobId,
          organization_id: tenantId,
          user_id: userId,
          lifecycle_stage: agentId as LifecycleStage,
          user_inputs: {
            query: sanitizedQuery,
            ...(sanitizedParameters ?? {}),
          },
          workspace_data:
            ((context as Record<string, unknown>)
              ?.workspace_data as LifecycleContext["workspace_data"]) ?? {},
          previous_stage_outputs: (context as Record<string, unknown>)
            ?.previous_stage_outputs as Record<string, unknown> | undefined,
          metadata: { job_id: jobId, mode: "direct" },
        };

        let output: AgentOutput;
        try {
          output = requiresHardenedExecution(agentId as AgentType)
            ? await runAgentWithHardening({
                agentId: agentId as AgentType,
                tenantId,
                userId,
                sessionId: sessionId ?? jobId,
                traceId: jobId,
                lifecycleContext,
                execute: (ctx) => agent.execute(ctx),
              })
            : await agent.execute(lifecycleContext);
        } catch (directErr) {
          if (directErr instanceof GovernanceVetoError) {
            const governanceStatus = mapGovernanceVetoStatus(directErr);
            logger.warn("Direct agent execution vetoed", {
              agentId,
              jobId,
              tenantId,
              userId,
              verdict: directErr.verdict,
              reason: directErr.reason,
              checkpoint_id: directErr.checkpointId,
              duration_ms: Date.now() - directStartTime,
              mode: "direct",
            });
            return void res.status(governanceStatus.httpStatus).json({
              success: false,
              data: {
                jobId,
                status: governanceStatus.apiStatus,
                agentId,
                mode: "direct",
              },
              error: {
                code: governanceStatus.errorCode,
                message: directErr.reason,
                checkpointId: directErr.checkpointId,
              },
            });
          }
          throw directErr;
        }
        const durationMs = Date.now() - directStartTime;

        logger.info("Direct agent execution completed", {
          agentId,
          jobId,
          tenantId,
          userId,
          status: output.status,
          duration_ms: durationMs,
          mode: "direct",
        });

        // Record metrics for direct-mode runs.
        // Failed runs are not billed (per billing-v2 spec).
        const succeeded =
          output.status === "success" || output.status === "partial_success";
        try {
          const metrics = getMetricsCollector();
          metrics.recordAgentInvocation(
            agentId,
            succeeded,
            durationMs,
            tenantId
          );

          if (succeeded) {
            // Prefer token counts from agent output metadata; fall back to a
            // prompt-length estimate when the provider does not return usage.
            const tokenUsage = output.metadata?.token_usage;
            const totalTokens =
              tokenUsage?.total_tokens ?? Math.ceil(sanitizedQuery.length / 4);

            const idempotencyKey = `${sessionId}:${agentId}:${jobId}`;
            metrics.recordUsage({
              tenantId,
              metric: "llm_tokens",
              quantity: totalTokens,
              path: `/api/agents/${agentId}/invoke`,
              idempotencyKey,
            });
          }
        } catch {
          /* metrics are non-fatal */
        }

        return void res.json({
          success: true,
          data: {
            jobId,
            status:
              output.status === "success" || output.status === "partial_success"
                ? "completed"
                : "failed",
            agentId,
            mode: "direct",
            result: output.result,
            confidence: output.confidence,
            reasoning: output.reasoning,
            warnings: output.warnings,
          },
        });
      } catch (directErr) {
        logger.error(
          "Direct agent execution failed",
          directErr instanceof Error ? directErr : undefined,
          {
            agentId,
            jobId,
            tenantId,
            userId,
            duration_ms: Date.now() - directStartTime,
            mode: "direct",
          }
        );
        return void res.status(500).json({
          success: false,
          data: { jobId, status: "failed", agentId, mode: "direct" },
          error: {
            code: "AGENT_EXECUTION_FAILED",
            message:
              directErr instanceof Error ? directErr.message : "Unknown error",
          },
        });
      }
    }

    try {
      const eventProducer = getEventProducer();
      const correlationId = uuidv4();
      const userId = (req as AuthenticatedRequest).user?.id;
      const externalSub = resolveExternalSub(req);

      const agentRequestEvent = buildAgentRequestEvent(correlationId, {
        agentId,
        userId: userId ?? externalSub ?? "unknown",
        externalSub,
        sessionId: sessionId ?? correlationId,
        tenantId,
        query: sanitizedQuery,
        context: (context as Record<string, unknown> | undefined) ?? {},
        parameters: sanitizedParameters,
        priority: "normal",
        timeout: getAgentAPIConfig().timeout,
      });

      // Publish event to Kafka
      await eventProducer.publish(
        EVENT_TOPICS.AGENT_REQUESTS,
        agentRequestEvent
      );

      logger.info("Agent request event published", {
        agentId,
        correlationId,
        userId,
        tenantId,
        sessionId,
      });

      // Return job ID for tracking
      return void res.json({
        success: true,
        data: {
          jobId: correlationId,
          status: "queued",
          agentId,
          estimatedDuration: "30s",
          message: "Agent request has been queued for processing",
        },
      });
    } catch (error) {
      logger.error(
        "Agent request event publishing failed",
        error instanceof Error ? error : undefined,
        {
          agentId,
          sessionId,
          tenantId,
          userId: (req as AuthenticatedRequest).user?.id,
        }
      );

      return void res.status(500).json({
        success: false,
        error: "Agent request failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// New typed execute endpoint: POST /api/agents/execute
router.post(
  "/execute",
  rateLimiters.agentExecution,
  async (req: Request, res: Response) => {
    const bodySchema = z.object({
      type: z.string().min(3), // e.g. "IntegrityAgent:resolveIssue"
      data: z.any().optional(),
      sessionId: z.string().optional(),
      priority: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payload",
            details: parsed.error.errors,
          },
        });
    }

    const { type, data, sessionId, priority } = parsed.data;
    const [agentIdPart, actionPart] = type.split(":");
    const agentId = agentIdPart || type;
    const action = actionPart || undefined;

    // Tenant validation
    const tenantId = (req as AuthenticatedRequest).tenantId;
    if (!tenantId) {
      return res
        .status(403)
        .json({
          success: false,
          error: {
            code: "tenant_required",
            message: "Tenant context is required",
          },
        });
    }

    if (!isKafkaEnabled()) {
      return kafkaUnavailableResponse(res);
    }

    try {
      const eventProducer = getEventProducer();
      const correlationId = uuidv4();
      const userId = (req as AuthenticatedRequest).user?.id;
      const externalSub = resolveExternalSub(req);

      const normalizedAction = action
        ? action.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
        : undefined;

      const agentRequestEvent = buildAgentRequestEvent(correlationId, {
        agentId,
        userId: userId ?? externalSub ?? "unknown",
        externalSub,
        sessionId: sessionId ?? correlationId,
        tenantId,
        query: normalizedAction || "execute",
        context: { action: normalizedAction || "execute" },
        parameters: { data, action: normalizedAction },
        priority: priority || "normal",
        timeout: getAgentAPIConfig().timeout,
      });

      await eventProducer.publish(
        EVENT_TOPICS.AGENT_REQUESTS,
        agentRequestEvent
      );

      return void res.json({
        success: true,
        data: { jobId: correlationId, status: "queued", agentId },
      });
    } catch (error) {
      logger.error(
        "Agent execute request failed",
        error instanceof Error ? error : undefined
      );
      return res
        .status(500)
        .json({
          success: false,
          error: {
            code: "AGENT_REQ_FAILED",
            message: "Failed to publish agent request",
          },
        });
    }
  }
);

/**
 * Get agent job status
 */
router.get(
  "/jobs/:jobId",
  rateLimiters.loose,
  async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const tenantId = (req as AuthenticatedRequest).tenantId;

    if (!tenantId) {
      return void res.status(403).json({
        success: false,
        error: {
          code: "tenant_required",
          message: "Tenant context is required",
        },
      });
    }

    if (!isKafkaEnabled()) {
      return kafkaUnavailableResponse(res);
    }

    try {
      const eventSourcing = getEventSourcingService();

      // Get audit trail for this job
      const auditTrail =
        (await eventSourcing.getAuditTrail(
          tenantId,
          jobId
        )) as AuditTrailProjection | null;

      if (!auditTrail) {
        return void res.status(404).json({
          error: "Job not found",
          message: `No job found with ID ${jobId}`,
        });
      }

      // Check if we have a response event
      const events = auditTrail?.data?.events ?? [];
      const responseEvent = events.find(
        (e: AuditEvent) => e.eventType === "agent.response"
      );

      if (responseEvent) {
        // Job completed
        const result = responseEvent.payload.response;

        // Populate Cache if successful
        if (result && !responseEvent.payload.error) {
          const requestEvent = events.find(
            (e: AuditEvent) => e.eventType === ("agent.request" as string)
          );
          if (requestEvent?.payload?.query) {
            const { query, context, agentId, tenantId } = requestEvent.payload;
            try {
              await agentCache.set(
                query,
                { ...context, agentId, tenantId },
                result
              );
            } catch (cacheError) {
              if (cacheError instanceof MissingTenantContextError) {
                logger.error("Skipping cache set: missing tenant context in audit event payload", {
                  jobId,
                });
              } else {
                logger.warn(
                  "Failed to cache agent response",
                  cacheError instanceof Error ? cacheError : undefined
                );
              }
            }
          }
        }

        return void res.json({
          success: true,
          data: {
            jobId,
            status: "completed",
            result: result,
            error: responseEvent.payload.error,
            latency: responseEvent.payload.latency,
            completedAt: responseEvent.timestamp,
          },
        });
      } else {
        // Job still processing or queued
        const requestEvent = events.find(
          (e: AuditEvent) => e.eventType === "agent.request"
        );
        return void res.json({
          success: true,
          data: {
            jobId,
            status: "processing",
            agentId: requestEvent?.payload?.agentId ?? "unknown",
            queuedAt: requestEvent?.timestamp,
            estimatedDuration: "30s",
            message: "Agent request is being processed",
          },
        });
      }
    } catch (error) {
      logger.error(
        "Job status check failed",
        error instanceof Error ? error : undefined,
        {
          jobId,
        }
      );

      return void res.status(500).json({
        success: false,
        error: "Job status check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Stream agent job status (SSE)
 */
router.get(
  "/jobs/:jobId/stream",
  rateLimiters.loose,
  async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const tenantId = (req as AuthenticatedRequest).tenantId;

    if (!tenantId) {
      return void res.status(403).json({
        success: false,
        error: {
          code: "tenant_required",
          message: "Tenant context is required",
        },
      });
    }

    if (!isKafkaEnabled()) {
      return kafkaUnavailableResponse(res);
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();

    const sendEvent = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const eventSourcing = getEventSourcingService();
    let isActive = true;

    req.on("close", () => {
      isActive = false;
    });

    const pollInterval = 1000;
    const timeout = 120000; // 2 minutes timeout
    const startTime = Date.now();

    const checkStatus = async (): Promise<void> => {
      if (!isActive) return;

      if (Date.now() - startTime > timeout) {
        sendEvent({
          status: "error",
          error: "Timeout waiting for job completion",
        });
        return void res.end();
      }

      try {
        const auditTrail =
          (await eventSourcing.getAuditTrail(
            tenantId,
            jobId
          )) as AuditTrailProjection | null;

        if (auditTrail) {
          const events = auditTrail?.data?.events ?? [];
          const responseEvent = events.find(
            (e: AuditEvent) => e.eventType === "agent.response"
          );

          if (responseEvent) {
            const result = responseEvent.payload.response;
            const error = responseEvent.payload.error;

            // Populate Cache if successful
            if (result && !error) {
              const requestEvent = events.find(
                (e: AuditEvent) => e.eventType === "agent.request"
              );
              if (requestEvent?.payload?.query) {
                const { query, context, agentId, tenantId } =
                  requestEvent.payload;
                try {
                  await agentCache.set(
                    query,
                    { ...context, agentId, tenantId },
                    result
                  );
                } catch (cacheError) {
                  if (cacheError instanceof MissingTenantContextError) {
                    logger.error("Skipping SSE cache set: missing tenant context in audit event payload", {
                      jobId,
                    });
                  } else {
                    logger.warn(
                      "Failed to cache agent response in SSE",
                      cacheError instanceof Error ? cacheError : undefined
                    );
                  }
                }
              }
            }

            sendEvent({
              status: "completed",
              result,
              error,
              latency: responseEvent.payload.latency,
              completedAt: responseEvent.timestamp,
            });
            return void res.end();
          } else {
            // Send processing update
            const requestEvent = events.find(
              (e: AuditEvent) => e.eventType === "agent.request"
            );
            sendEvent({
              status: "processing",
              agentId: requestEvent?.payload?.agentId ?? "unknown",
              queuedAt: requestEvent?.timestamp,
            });
          }
        }

        setTimeout(checkStatus, pollInterval);
      } catch (error) {
        logger.error(
          "SSE Polling error",
          error instanceof Error ? error : undefined
        );
        sendEvent({ status: "error", message: "Internal polling error" });
        return void res.end();
      }
    };

    // Start polling
    void checkStatus();
    return;
  }
);

// POST /api/agents/integrity/veto - accept/reject/modify a flagged integrity issue
router.post(
  "/integrity/veto",
  rateLimiters.loose,
  async (req: Request, res: Response) => {
    const bodySchema = z.object({
      issueId: z.string().min(1),
      resolution: z.enum(["accept", "reject", "modify"]),
      modifiedOutput: z.any().optional(),
      agentId: z.string().optional(),
      sessionId: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payload",
            details: parsed.error.errors,
          },
        });
    }

    const { issueId, resolution, modifiedOutput, agentId, sessionId } =
      parsed.data;

    const tenantId = (req as AuthenticatedRequest).tenantId;
    if (!tenantId) {
      return res
        .status(403)
        .json({
          success: false,
          error: {
            code: "tenant_required",
            message: "Tenant context is required",
          },
        });
    }

    if (!isKafkaEnabled()) {
      return kafkaUnavailableResponse(res);
    }

    try {
      const eventProducer = getEventProducer();
      const correlationId = uuidv4();
      const userId = (req as AuthenticatedRequest).user?.id;
      const externalSub = resolveExternalSub(req);

      const agentRequestEvent = buildAgentRequestEvent(correlationId, {
        agentId: agentId || "IntegrityAgent",
        userId: userId ?? externalSub ?? "unknown",
        externalSub,
        sessionId: sessionId ?? correlationId,
        tenantId,
        query: "resolve_issue",
        context: { issueId, resolution },
        parameters: { issueId, resolution, modifiedOutput },
        priority: "normal",
        timeout: getAgentAPIConfig().timeout,
      });

      await eventProducer.publish(
        EVENT_TOPICS.AGENT_REQUESTS,
        agentRequestEvent
      );

      // Log to audit trail for immediate compliance record
      try {
        const auditService =
          require("../services/security/AuditTrailService.js").getAuditTrailService();
        await auditService.logImmediate({
          eventType: "integrity_veto",
          actorId: userId || externalSub || "system",
          externalSub: externalSub || "system",
          actorType: externalSub ? "user" : "system",
          resourceId: issueId,
          resourceType: "integrity_issue",
          action: `veto_${resolution}`,
          outcome: "success",
          details: { agentId, sessionId, modifiedOutput },
          ipAddress: (req as AuthenticatedRequest).ip || "unknown",
          userAgent: (req as AuthenticatedRequest).headers["user-agent"] || "",
          timestamp: Date.now(),
          sessionId: sessionId || correlationId,
          correlationId,
          riskScore: 0.5,
          complianceFlags: ["integrity_resolution"],
          tenantId,
        });
      } catch (auditErr) {
        logger.warn(
          "Failed to log integrity veto to audit trail",
          auditErr instanceof Error ? auditErr : undefined
        );
      }

      return void res.json({
        success: true,
        data: { jobId: correlationId, status: "queued" },
      });
    } catch (error) {
      logger.error(
        "Integrity veto handler failed",
        error instanceof Error ? error : undefined
      );
      return res
        .status(500)
        .json({
          success: false,
          error: {
            code: "INTEGRITY_VETO_FAILED",
            message: "Failed to process veto",
          },
        });
    }
  }
);

export default router;
