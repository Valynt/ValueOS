import { logger } from "@shared/lib/logger";
import { AgentRequestEvent, createBaseEvent, EVENT_TOPICS } from "@shared/types/events";
import { Request, Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import type { AuthenticatedRequest } from "../middleware/auth.js";

import { getAgentAPIConfig } from "../config/ServiceConfigManager.js"
import { createAgentFactory } from "../lib/agent-fabric/AgentFactory.js"
import { CircuitBreaker } from "../lib/agent-fabric/CircuitBreaker.js"
import { LLMGateway } from "../lib/agent-fabric/LLMGateway.js"
import { MemorySystem } from "../lib/agent-fabric/MemorySystem.js"
import { SupabaseMemoryBackend } from "../lib/agent-fabric/SupabaseMemoryBackend.js"
import { rateLimiters } from "../middleware/rateLimiter.js"
import { requirePermission } from "../middleware/rbac.js"
import { securityHeadersMiddleware } from "../middleware/securityMiddleware.js"
import { usageEnforcement } from "../middleware/usageEnforcement.js"
// In-process agent response cache (non-tenant routing state — Map is acceptable per ADR-0012)
const _agentResponseCache = new Map<string, { value: unknown; expiresAt: number }>();
const AGENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function _agentCacheKey(query: string, context: Record<string, unknown>): string {
  const { sessionId: _s, timestamp: _t, ...normalized } = context;
  const str = query + JSON.stringify(normalized);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = (hash << 5) - hash + c;
    hash = hash & hash;
  }
  return `${String(context["agentType"] ?? "unknown")}:${Math.abs(hash).toString(36)}`;
}

const agentCache = {
  async get(query: string, context: Record<string, unknown>): Promise<unknown | null> {
    const key = _agentCacheKey(query, context);
    const entry = _agentResponseCache.get(key);
    if (!entry || Date.now() > entry.expiresAt) { _agentResponseCache.delete(key); return null; }
    return entry.value;
  },
  async set(query: string, context: Record<string, unknown>, value: unknown): Promise<void> {
    const key = _agentCacheKey(query, context);
    _agentResponseCache.set(key, { value, expiresAt: Date.now() + AGENT_CACHE_TTL_MS });
  },
};
import { getEventProducer } from "../services/realtime/EventProducer.js"
import { getEventSourcingService } from "../services/post-v1/EventSourcingService.js"
import { isKafkaEnabled } from "../services/kafkaConfig.js"
import { getMetricsCollector } from "../services/monitoring/MetricsCollector.js"
import { modelCardService } from "../services/llm/ModelCardService.js"

import type { LifecycleContext, LifecycleStage } from "../types/agent.js"
import { sanitizeAgentInput } from "../utils/security.js"

// Shared factory instance — created lazily on first direct-execution request.
// Avoids startup cost when Kafka is available.
// DEBT-001 fix: use provider "together" — LLMGateway only implements "together".
// DEBT-002 fix: enable_persistence: true with SupabaseMemoryBackend so agent
//               memory survives across HTTP requests (consistent with ExecutionRuntime).
let _directFactory: ReturnType<typeof createAgentFactory> | null = null;
function getDirectFactory(): ReturnType<typeof createAgentFactory> {
  if (!_directFactory) {
    _directFactory = createAgentFactory({
      llmGateway: new LLMGateway({ provider: "together", model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo" }),
      memorySystem: new MemorySystem(
        { max_memories: 1000, enable_persistence: true },
        new SupabaseMemoryBackend(),
      ),
      circuitBreaker: new CircuitBreaker(),
    });
  }
  return _directFactory;
}

const router = Router();


function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function resolveExternalSub(req: Request): string | undefined {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user as Record<string, unknown> | undefined;

  const direct = user?.['sub'] || user?.['oidc_sub'] || (user?.['user_metadata'] as Record<string, unknown> | undefined)?.['sub'] || (user?.['app_metadata'] as Record<string, unknown> | undefined)?.['sub'];
  if (typeof direct === 'string' && direct.length > 0) return direct;

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const claims = decodeJwtPayload(authHeader.slice(7));
    const claimSub = claims?.sub;
    if (typeof claimSub === 'string' && claimSub.length > 0) {
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

function kafkaUnavailableResponse(res: Response): Response {
  return res.status(503).json({
    success: false,
    error: {
      code: "KAFKA_DISABLED",
      message: "Kafka-backed agent execution is disabled in this deployment profile.",
    },
  });
}

router.use(securityHeadersMiddleware);
router.use(requirePermission("agents.execute"));

// ... rest of the code remains the same ...
router.get("/:agentId/info", rateLimiters.loose, (req: Request, res: Response) => {
  const { agentId } = req.params;
  const modelCard = modelCardService.getModelCard(agentId as string);

  if (!modelCard) {
    return res.status(404).json({
      error: "Model card not found",
      message: `No model metadata available for agent ${agentId}`,
    });
  }

  res.setHeader("x-model-card-version", modelCard.schemaVersion);

  return res.json({
    success: true,
    data: {
      agent_id: agentId,
      model_card: modelCard.modelCard,
    },
  });
});

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
  ...usageEnforcement({ metric: 'llm_tokens' }),
  async (req: Request, res: Response) => {
    const { agentId } = req.params;

    // Zod Validation Schema
    // parameters is restricted to scalar values (string | number | boolean) so
    // nested objects cannot smuggle unsanitized strings into agent prompts.
    const invokeSchema = z.object({
      query: z.string().max(2000),
      context: z.any().optional(), // Flexible context
      parameters: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
      sessionId: z.string().max(100).optional(),
    });

    // Validate request body
    const validationResult = invokeSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request",
        message: "Request validation failed",
        details: validationResult.error.errors,
      });
    }

    const { query, context, parameters, sessionId } = validationResult.data;
    const { sanitized, safe, severity, violations } = sanitizeAgentInput(query);
    const sanitizedQuery = typeof sanitized === "string" ? sanitized : String(sanitized);

    if (!safe) {
      logger.warn("Blocked unsafe agent prompt", {
        agentId,
        severity,
        violations,
        userId: (req as AuthenticatedRequest).user?.id,
        tenantId: (req as AuthenticatedRequest).tenantId,
      });

      return res.status(400).json({
        error: "Invalid request",
        message: "Agent prompt rejected due to unsafe content",
      });
    }

    // Sanitize string values in parameters to prevent prompt injection.
    // Numbers and booleans are safe scalars; they pass through unchanged.
    // Nested objects are rejected at the schema level above.
    let sanitizedParameters: Record<string, string | number | boolean> | undefined;
    if (parameters) {
      sanitizedParameters = {};
      for (const [key, value] of Object.entries(parameters)) {
        if (typeof value === "string") {
          const { sanitized: sanitizedValue, safe: paramSafe, violations: paramViolations } =
            sanitizeAgentInput(value);
          if (!paramSafe) {
            logger.warn("Blocked unsafe agent parameter", {
              agentId,
              key,
              violations: paramViolations,
              userId: (req as AuthenticatedRequest).user?.id,
              tenantId: (req as AuthenticatedRequest).tenantId,
            });
            return res.status(400).json({
              error: "Invalid request",
              message: `Agent parameter '${key}' rejected due to unsafe content`,
            });
          }
          sanitizedParameters[key] = typeof sanitizedValue === "string"
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
      return res.status(403).json({
        error: "tenant_required",
        message: "Tenant context is required for agent invocation",
      });
    }

    // Check Cache
    try {
      const startTime = Date.now();
      const cachedResponse = await agentCache.get(sanitizedQuery, { ...context, agentId, tenantId });
      if (cachedResponse) {
        // Record Cache Hit Metric
        try {
          const metrics = getMetricsCollector();
          metrics.recordAgentInvocation(agentId, true, Date.now() - startTime);
          metrics.recordLLMCall("cache", agentId, 0, 0, true);
        } catch (mErr) { /* ignore */ }

        return res.json({
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
      logger.warn("Cache check failed", cacheError instanceof Error ? cacheError : undefined);
    }

    if (!isKafkaEnabled()) {
      // Direct execution fallback: run the agent synchronously without Kafka.
      // Returns the same response shape as the Kafka path so callers are mode-agnostic.
      const jobId = uuidv4();
      const userId = (req as AuthenticatedRequest).user?.id ?? "unknown";
      const directStartTime = Date.now();
      try {
        const factory = getDirectFactory();
        if (!factory.hasFabricAgent(agentId)) {
          logger.warn("Direct agent execution: unknown agent type", { agentId, tenantId, userId });
          return res.status(404).json({
            success: false,
            error: { code: "AGENT_NOT_FOUND", message: `No fabric implementation for agent "${agentId}"` },
          });
        }

        logger.info("Direct agent execution started", { agentId, jobId, tenantId, userId, mode: "direct" });

        const agent = factory.create(agentId, tenantId);
        const lifecycleContext: LifecycleContext = {
          workspace_id: (context as Record<string, unknown>)?.workspace_id as string ?? jobId,
          organization_id: tenantId,
          user_id: userId,
          lifecycle_stage: agentId as LifecycleStage,
          user_inputs: { query: sanitizedQuery, ...(sanitizedParameters ?? {}) },
          workspace_data: (context as Record<string, unknown>)?.workspace_data as LifecycleContext["workspace_data"] ?? {},
          previous_stage_outputs: (context as Record<string, unknown>)?.previous_stage_outputs as Record<string, unknown> | undefined,
          metadata: { job_id: jobId, mode: "direct" },
        };

        const output = await agent.execute(lifecycleContext);
        const durationMs = Date.now() - directStartTime;

        logger.info("Direct agent execution completed", {
          agentId, jobId, tenantId, userId,
          status: output.status,
          duration_ms: durationMs,
          mode: "direct",
        });

        // Record metrics for direct-mode runs.
        // Failed runs are not billed (per billing-v2 spec).
        const succeeded = output.status === "success" || output.status === "partial_success";
        try {
          const metrics = getMetricsCollector();
          metrics.recordAgentInvocation(agentId, succeeded, durationMs, tenantId);

          if (succeeded) {
            // Prefer token counts from agent output metadata; fall back to a
            // prompt-length estimate when the provider does not return usage.
            const tokenUsage = output.metadata?.token_usage;
            const totalTokens =
              tokenUsage?.total_tokens ??
              Math.ceil(sanitizedQuery.length / 4);

            const idempotencyKey = `${sessionId}:${agentId}:${jobId}`;
            metrics.recordUsage({
              tenantId,
              metric: 'llm_tokens',
              quantity: totalTokens,
              path: `/api/agents/${agentId}/invoke`,
              idempotencyKey,
            });
          }
        } catch { /* metrics are non-fatal */ }

        return res.json({
          success: true,
          data: {
            jobId,
            status: output.status === "success" || output.status === "partial_success" ? "completed" : "failed",
            agentId,
            mode: "direct",
            result: output.result,
            confidence: output.confidence,
            reasoning: output.reasoning,
            warnings: output.warnings,
          },
        });
      } catch (directErr) {
        logger.error("Direct agent execution failed", directErr instanceof Error ? directErr : undefined, {
          agentId, jobId, tenantId, userId,
          duration_ms: Date.now() - directStartTime,
          mode: "direct",
        });
        return res.status(500).json({
          success: false,
          data: { jobId, status: "failed", agentId, mode: "direct" },
          error: { code: "AGENT_EXECUTION_FAILED", message: directErr instanceof Error ? directErr.message : "Unknown error" },
        });
      }
    }

    try {
      const eventProducer = getEventProducer();
      const correlationId = uuidv4();
      const userId = (req as AuthenticatedRequest).user?.id;
      const externalSub = resolveExternalSub(req);

      // Create agent request event
      const agentRequestEvent: AgentRequestEvent = {
        ...createBaseEvent("agent.request" as const, correlationId, "agent-api"),
        payload: {
          agentId,
          userId,
          externalSub,
          sessionId,
          tenantId,
          query: sanitizedQuery,
          context,
          parameters: sanitizedParameters,
          priority: "normal",
          timeout: getAgentAPIConfig().timeout, // Centralized timeout config
        },
      };

      // Publish event to Kafka
      await eventProducer.publish(EVENT_TOPICS.AGENT_REQUESTS, agentRequestEvent);

      logger.info("Agent request event published", {
        agentId,
        correlationId,
        userId,
        tenantId,
        sessionId,
      });

      // Return job ID for tracking
      return res.json({
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

      return res.status(500).json({
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
      type: z.string().max(200).describe("AgentType:action"),
      data: z.any().optional(),
      sessionId: z.string().max(100).optional(),
    });

    const result = bodySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, error: { code: "INVALID_REQUEST", message: "Invalid payload" } });
    }

    const { type, data, sessionId } = result.data;

    // Split type like "IntegrityAgent:resolveIssue"
    const [agentIdRaw, actionRaw] = type.split(":");
    const agentId = agentIdRaw;
    const action = actionRaw || "execute";

    // Validate tenant
    const tenantId = (req as AuthenticatedRequest).tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: { code: "tenant_required", message: "Tenant context is required" } });
    }

    if (!isKafkaEnabled()) {
      return kafkaUnavailableResponse(res);
    }

    try {
      const eventProducer = getEventProducer();
      const correlationId = uuidv4();
      const userId = (req as AuthenticatedRequest).user?.id;
      const externalSub = resolveExternalSub(req);

      const payload = {
        agentId,
        userId,
        externalSub,
        sessionId,
        tenantId,
        query: type,
        context: { action, data },
        parameters: { action, data },
        priority: "normal",
        timeout: getAgentAPIConfig().timeout,
      };

      const agentRequestEvent: AgentRequestEvent = {
        ...createBaseEvent("agent.request" as const, correlationId, "agent-api"),
        payload,
      };

      await eventProducer.publish(EVENT_TOPICS.AGENT_REQUESTS, agentRequestEvent);

      return res.json({ success: true, data: { jobId: correlationId, status: "queued" } });
    } catch (error) {
      logger.error("Failed to publish typed agent execute", error as Error);
      return res.status(500).json({ success: false, error: { code: "PUBLISH_FAILED", message: "Failed to enqueue request" } });
    }
  }
);


/**
 * Execute a typed agent action (e.g. { type: 'IntegrityAgent:resolveIssue', data: {...} })
 * This is a convenience endpoint that allows callers to invoke agent actions without
 * knowing the internal agent-specific route. It publishes an AgentRequestEvent to the
 * agent request topic, preserving tenant and user context.
 */
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
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.errors } });
    }

    const { type, data, sessionId, priority } = parsed.data;
    const [agentIdPart, actionPart] = type.split(":");
    const agentId = agentIdPart || type;
    const action = actionPart || undefined;

    // Tenant validation
    const tenantId = (req as AuthenticatedRequest).tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: { code: 'tenant_required', message: 'Tenant context is required' } });
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

    const agentRequestEvent: AgentRequestEvent = {
      ...createBaseEvent("agent.request" as const, correlationId, "agent-api"),
      payload: {
        agentId,
        userId,
        externalSub,
        sessionId,
        tenantId,
        query: normalizedAction || "execute",
        context: { action: normalizedAction || 'execute' },
        parameters: { data, action: normalizedAction },
        priority: priority || "normal",
        timeout: getAgentAPIConfig().timeout,
      },
    };

      await eventProducer.publish(EVENT_TOPICS.AGENT_REQUESTS, agentRequestEvent);

      return res.json({ success: true, data: { jobId: correlationId, status: 'queued', agentId } });
    } catch (error) {
      logger.error("Agent execute request failed", error instanceof Error ? error : undefined);
      return res.status(500).json({ success: false, error: { code: 'AGENT_REQ_FAILED', message: 'Failed to publish agent request' } });
    }
  }
);

/**
 * Get agent job status
 */
router.get("/jobs/:jobId", rateLimiters.loose, async (req: Request, res: Response) => {
  const { jobId } = req.params;

  if (!isKafkaEnabled()) {
    return kafkaUnavailableResponse(res);
  }

  try {
    const eventSourcing = getEventSourcingService();

    // Get audit trail for this job
    const auditTrail = await eventSourcing.getAuditTrail(jobId);

    if (!auditTrail) {
      return res.status(404).json({
        error: "Job not found",
        message: `No job found with ID ${jobId}`,
      });
    }

    // Check if we have a response event
    const events = auditTrail.data?.events || [];
    const responseEvent = events.find((e: AuditEvent) => e.eventType === "agent.response");

    if (responseEvent) {
      // Job completed
      const result = responseEvent.payload.response;

      // Populate Cache if successful
      if (result && !responseEvent.payload.error) {
        const requestEvent = events.find((e: AuditEvent) => e.eventType === "agent.request");
        if (requestEvent?.payload) {
          const { query, context, agentId, tenantId } = requestEvent.payload;
          try {
            await agentCache.set(
              query,
              { ...context, agentId, tenantId },
              result
            );
          } catch (cacheError) {
            logger.warn("Failed to cache agent response", cacheError instanceof Error ? cacheError : undefined);
          }
        }
      }

      return res.json({
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
      const requestEvent = events.find((e: AuditEvent) => e.eventType === "agent.request");
      return res.json({
        success: true,
        data: {
          jobId,
          status: "processing",
          agentId: requestEvent?.payload?.agentId ?? 'unknown',
          queuedAt: requestEvent?.timestamp,
          estimatedDuration: "30s",
          message: "Agent request is being processed",
        },
      });
    }
  } catch (error) {
    logger.error("Job status check failed", error instanceof Error ? error : undefined, {
      jobId,
    });

    return res.status(500).json({
      success: false,
      error: "Job status check failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return;
  }
});

/**
 * Stream agent job status (SSE)
 */
router.get("/jobs/:jobId/stream", rateLimiters.loose, async (req: Request, res: Response) => {
  const { jobId } = req.params;

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

  const checkStatus = async () => {
    if (!isActive) return;

    if (Date.now() - startTime > timeout) {
      sendEvent({ status: "error", error: "Timeout waiting for job completion" });
      return res.end();
    }

    try {
      const auditTrail = await eventSourcing.getAuditTrail(jobId);

      if (auditTrail) {
        const events = auditTrail.data?.events || [];
        const responseEvent = events.find((e: AuditEvent) => e.eventType === "agent.response");

        if (responseEvent) {
          const result = responseEvent.payload.response;
          const error = responseEvent.payload.error;

          // Populate Cache if successful
          if (result && !error) {
            const requestEvent = events.find((e: AuditEvent) => e.eventType === "agent.request");
            if (requestEvent?.payload) {
              const { query, context, agentId, tenantId } = requestEvent.payload;
              try {
                await agentCache.set(
                  query,
                  { ...context, agentId, tenantId },
                  result
                );
              } catch (cacheError) {
                logger.warn("Failed to cache agent response in SSE", cacheError instanceof Error ? cacheError : undefined);
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
          return res.end();
        } else {
          // Send processing update
          const requestEvent = events.find((e: AuditEvent) => e.eventType === "agent.request");
          sendEvent({
            status: "processing",
            agentId: requestEvent?.payload?.agentId ?? 'unknown',
            queuedAt: requestEvent?.timestamp,
          });
        }
      }

      setTimeout(checkStatus, pollInterval);
    } catch (error) {
      logger.error("SSE Polling error", error instanceof Error ? error : undefined);
      sendEvent({ status: "error", message: "Internal polling error" });
      return res.end();
    }
  };

  // Start polling
  checkStatus();
});

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
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.errors } });
    }

    const { issueId, resolution, modifiedOutput, agentId, sessionId } = parsed.data;

    const tenantId = (req as AuthenticatedRequest).tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: { code: 'tenant_required', message: 'Tenant context is required' } });
    }

    if (!isKafkaEnabled()) {
      return kafkaUnavailableResponse(res);
    }

    try {
      const eventProducer = getEventProducer();
      const correlationId = uuidv4();
      const userId = (req as AuthenticatedRequest).user?.id;
      const externalSub = resolveExternalSub(req);

      // Publish a typed agent request to handle veto resolution
      const agentRequestEvent: AgentRequestEvent = {
        ...createBaseEvent("agent.request" as const, correlationId, "agent-api"),
        payload: {
          agentId: agentId || 'IntegrityAgent',
          userId,
          externalSub,
          sessionId,
          tenantId,
          query: 'resolve_issue',
          context: { issueId, resolution },
          parameters: { issueId, resolution, modifiedOutput },
          priority: 'normal',
          timeout: getAgentAPIConfig().timeout,
        },
      };

      await eventProducer.publish(EVENT_TOPICS.AGENT_REQUESTS, agentRequestEvent);

      // Log to audit trail for immediate compliance record
      try {
        const auditService = require("../services/security/AuditTrailService.js").getAuditTrailService();
        await auditService.logImmediate({
          eventType: 'integrity_veto',
          actorId: userId || externalSub || 'system',
          externalSub: externalSub || 'system',
          actorType: externalSub ? 'user' : 'system',
          resourceId: issueId,
          resourceType: 'integrity_issue',
          action: `veto_${resolution}`,
          outcome: 'success',
          details: { agentId, sessionId, modifiedOutput },
          ipAddress: (req as AuthenticatedRequest).ip || 'unknown',
          userAgent: (req as AuthenticatedRequest).headers['user-agent'] || '',
          timestamp: Date.now(),
          sessionId: sessionId || correlationId,
          correlationId,
          riskScore: 0.5,
          complianceFlags: ['integrity_resolution'],
          tenantId,
        });
      } catch (auditErr) {
        logger.warn('Failed to log integrity veto to audit trail', auditErr instanceof Error ? auditErr : undefined);
      }

      return res.json({ success: true, data: { jobId: correlationId, status: 'queued' } });
    } catch (error) {
      logger.error('Integrity veto handler failed', error instanceof Error ? error : undefined);
      return res.status(500).json({ success: false, error: { code: 'INTEGRITY_VETO_FAILED', message: 'Failed to process veto' } });
    }
  }
);

export default router;
