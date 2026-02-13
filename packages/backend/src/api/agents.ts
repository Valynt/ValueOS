import { Request, Response, Router } from "express";
import { modelCardService } from "../services/ModelCardService.js"
import { securityHeadersMiddleware } from "../middleware/securityMiddleware.js"
import { rateLimiters } from "../middleware/rateLimiter.js"
import { logger } from "@shared/lib/logger";
import { requirePermission } from "../middleware/rbac.js"
import { getEventProducer } from "../services/EventProducer.js"
import { getEventSourcingService } from "../services/EventSourcingService.js"
import { createBaseEvent, EVENT_TOPICS, AgentRequestEvent } from "@shared/types/events";
import { v4 as uuidv4 } from "uuid";
import { getAgentAPIConfig } from "../config/ServiceConfigManager.js"
import { z } from "zod";
import { agentCache } from "../services/CacheService.js"
import { getMetricsCollector } from "../services/MetricsCollector.js"
import { sanitizeAgentInput } from "../utils/security.js"
import { isKafkaEnabled } from "../services/kafkaConfig.js"

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

function resolveAuth0Sub(req: Request): string | undefined {
  const anyReq = req as any;
  const user = anyReq.user as Record<string, any> | undefined;

  const direct = user?.auth0_sub || user?.sub || user?.oidc_sub || user?.user_metadata?.auth0_sub || user?.app_metadata?.auth0_sub;
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
  // Basic validation middleware removed in favor of Zod inside handler
  async (req: Request, res: Response) => {
    const { agentId } = req.params;

    // Zod Validation Schema
    const invokeSchema = z.object({
      query: z.string().max(2000),
      context: z.any().optional(), // Flexible context
      parameters: z.record(z.unknown()).optional(),
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
        userId: (req as any).user?.id,
        tenantId: (req as any).tenantId,
      });

      return res.status(400).json({
        error: "Invalid request",
        message: "Agent prompt rejected due to unsafe content",
      });
    }

    // Add tenant context validation
    const tenantId = (req as any).tenantId;
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
      return kafkaUnavailableResponse(res);
    }

    try {
      const eventProducer = getEventProducer();
      const correlationId = uuidv4();
      const userId = (req as any).user?.id;
      const auth0Sub = resolveAuth0Sub(req);

      // Create agent request event
      const agentRequestEvent: AgentRequestEvent = {
        ...createBaseEvent("agent.request" as const, correlationId, "agent-api"),
        payload: {
          agentId,
          userId,
          auth0Sub,
          sessionId,
          tenantId,
          query: sanitizedQuery,
          context,
          parameters,
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
      res.json({
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
          userId: (req as any).user?.id,
        }
      );

      res.status(500).json({
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
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: { code: "tenant_required", message: "Tenant context is required" } });
    }

    if (!isKafkaEnabled()) {
      return kafkaUnavailableResponse(res);
    }

    try {
      const eventProducer = getEventProducer();
      const correlationId = uuidv4();
      const userId = (req as any).user?.id;
      const auth0Sub = resolveAuth0Sub(req);

      const payload = {
        agentId,
        userId,
        auth0Sub,
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

      res.json({ success: true, data: { jobId: correlationId, status: "queued" } });
    } catch (error) {
      logger.error("Failed to publish typed agent execute", error as Error);
      res.status(500).json({ success: false, error: { code: "PUBLISH_FAILED", message: "Failed to enqueue request" } });
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
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: { code: 'tenant_required', message: 'Tenant context is required' } });
    }

    if (!isKafkaEnabled()) {
      return kafkaUnavailableResponse(res);
    }

    try {
      const eventProducer = getEventProducer();
      const correlationId = uuidv4();
      const userId = (req as any).user?.id;
      const auth0Sub = resolveAuth0Sub(req);

      const normalizedAction = action
      ? action.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
      : undefined;

    const agentRequestEvent: AgentRequestEvent = {
      ...createBaseEvent("agent.request" as const, correlationId, "agent-api"),
      payload: {
        agentId,
        userId,
        auth0Sub,
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
    const responseEvent = events.find((e: any) => e.eventType === "agent.response");

    if (responseEvent) {
      // Job completed
      const result = responseEvent.payload.response;

      // Populate Cache if successful
      if (result && !responseEvent.payload.error) {
        const requestEvent = events.find((e: any) => e.eventType === "agent.request");
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

      res.json({
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
      const requestEvent = events.find((e: any) => e.eventType === "agent.request");
      res.json({
        success: true,
        data: {
          jobId,
          status: "processing",
          agentId: requestEvent?.payload?.agentId,
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

    res.status(500).json({
      success: false,
      error: "Job status check failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Stream agent job status (SSE)
 */
router.get("/jobs/:jobId/stream", rateLimiters.loose, async (req: Request, res: Response) => {
  const { jobId } = req.params;

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (res.flushHeaders) res.flushHeaders();

  const sendEvent = (data: any) => {
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
      res.end();
      return;
    }

    try {
      const auditTrail = await eventSourcing.getAuditTrail(jobId);

      if (auditTrail) {
        const events = auditTrail.data?.events || [];
        const responseEvent = events.find((e: any) => e.eventType === "agent.response");

        if (responseEvent) {
          const result = responseEvent.payload.response;
          const error = responseEvent.payload.error;

          // Populate Cache if successful
          if (result && !error) {
            const requestEvent = events.find((e: any) => e.eventType === "agent.request");
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
          res.end();
          return;
        } else {
          // Send processing update
          const requestEvent = events.find((e: any) => e.eventType === "agent.request");
          sendEvent({
            status: "processing",
            agentId: requestEvent?.payload?.agentId,
            queuedAt: requestEvent?.timestamp,
          });
        }
      }

      setTimeout(checkStatus, pollInterval);
    } catch (error) {
      logger.error("SSE Polling error", error instanceof Error ? error : undefined);
      sendEvent({ status: "error", message: "Internal polling error" });
      res.end();
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

    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: { code: 'tenant_required', message: 'Tenant context is required' } });
    }

    if (!isKafkaEnabled()) {
      return kafkaUnavailableResponse(res);
    }

    try {
      const eventProducer = getEventProducer();
      const correlationId = uuidv4();
      const userId = (req as any).user?.id;
      const auth0Sub = resolveAuth0Sub(req);

      // Publish a typed agent request to handle veto resolution
      const agentRequestEvent: AgentRequestEvent = {
        ...createBaseEvent("agent.request" as const, correlationId, "agent-api"),
        payload: {
          agentId: agentId || 'IntegrityAgent',
          userId,
          auth0Sub,
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
          actorId: userId || auth0Sub || 'system',
          auth0Sub: auth0Sub || 'system',
          actorType: auth0Sub ? 'user' : 'system',
          resourceId: issueId,
          resourceType: 'integrity_issue',
          action: `veto_${resolution}`,
          outcome: 'success',
          details: { agentId, sessionId, modifiedOutput },
          ipAddress: (req as any).ip || 'unknown',
          userAgent: (req as any).headers['user-agent'] || '',
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
