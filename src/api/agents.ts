import { Request, Response, Router } from "express";
import { modelCardService } from "../services/ModelCardService";
import { securityHeadersMiddleware } from "../middleware/securityMiddleware";
import { rateLimiters } from "../middleware/rateLimiter";
import { validateRequest } from "../middleware/inputValidation";
import { logger } from "../lib/logger";
import { requirePermission } from "../middleware/rbac";
import { getEventProducer } from "../services/EventProducer";
import { getEventSourcingService } from "../services/EventSourcingService";
import {
  createBaseEvent,
  EVENT_TOPICS,
  AgentRequestEvent,
} from "../types/events";
import { AgentType } from "../services/agent-types";
import { v4 as uuidv4 } from "uuid";
import {
  getServiceConfigManager,
  getAgentAPIConfig,
} from "../config/ServiceConfigManager";

const router = Router();
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
  }
);

/**
 * Invoke an agent asynchronously using event-driven architecture
 */
router.post(
  "/:agentId/invoke",
  rateLimiters.agentExecution,
  validateRequest({
    query: { type: "string" as const, required: true, maxLength: 2000 },
    context: { type: "string" as const, maxLength: 1000 },
    parameters: { type: "object" as const },
    sessionId: { type: "string" as const, maxLength: 100 },
  }),
  async (req: Request, res: Response) => {
    const { agentId } = req.params;
    const { query, context, parameters, sessionId } = req.body;

    // Add tenant context validation
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(403).json({
        error: "tenant_required",
        message: "Tenant context is required for agent invocation",
      });
    }

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        error: "Invalid request",
        message: "Query parameter is required and must be a string",
      });
    }

    try {
      const eventProducer = getEventProducer();
      const correlationId = uuidv4();
      const userId = (req as any).user?.id;

      // Create agent request event
      const agentRequestEvent: AgentRequestEvent = {
        ...createBaseEvent(
          "agent.request" as const,
          correlationId,
          "agent-api"
        ),
        payload: {
          agentId,
          userId,
          sessionId,
          tenantId,
          query,
          context,
          parameters,
          priority: "normal",
          timeout: 30000, // 30 seconds default timeout
        },
      };

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
router.get(
  "/jobs/:jobId",
  rateLimiters.loose,
  async (req: Request, res: Response) => {
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
      const responseEvent = events.find(
        (e: any) => e.eventType === "agent.response"
      );

      if (responseEvent) {
        // Job completed
        res.json({
          success: true,
          data: {
            jobId,
            status: "completed",
            result: responseEvent.payload.response,
            error: responseEvent.payload.error,
            latency: responseEvent.payload.latency,
            completedAt: responseEvent.timestamp,
          },
        });
      } else {
        // Job still processing or queued
        const requestEvent = events.find(
          (e: any) => e.eventType === "agent.request"
        );
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
      logger.error(
        "Job status check failed",
        error instanceof Error ? error : undefined,
        {
          jobId,
        }
      );

      res.status(500).json({
        success: false,
        error: "Job status check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
