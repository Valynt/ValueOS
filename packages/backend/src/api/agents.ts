import { Request, Response, Router } from "express";
import { modelCardService } from "../services/ModelCardService.js"
import { securityHeadersMiddleware } from "../middleware/securityMiddleware.js"
import { rateLimiters } from "../middleware/rateLimiter.js"
import { validateRequest } from "../middleware/inputValidation.js"
import { logger } from "@shared/lib/logger";
import { requirePermission } from "../middleware/rbac.js"
import { getEventProducer } from "../services/EventProducer.js"
import { getEventSourcingService } from "../services/EventSourcingService.js"
import { createBaseEvent, EVENT_TOPICS, AgentRequestEvent } from "@shared/types/events";
import { AgentType } from "../services/agent-types.js"
import { v4 as uuidv4 } from "uuid";
import { getServiceConfigManager, getAgentAPIConfig } from "../config/ServiceConfigManager.js"
import { z } from "zod";
import { agentCache } from "../services/CacheService.js"
import { getMetricsCollector } from "../services/MetricsCollector.js"

const router = Router();
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
      const cachedResponse = await agentCache.get(query, { ...context, agentId, tenantId });
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

    try {
      const eventProducer = getEventProducer();
      const correlationId = uuidv4();
      const userId = (req as any).user?.id;

      // Create agent request event
      const agentRequestEvent: AgentRequestEvent = {
        ...createBaseEvent("agent.request" as const, correlationId, "agent-api"),
        payload: {
          agentId,
          userId,
          sessionId,
          tenantId,
          query,
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

export default router;
