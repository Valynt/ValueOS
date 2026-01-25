import { Request, Response, Router } from "express";
import { modelCardService } from "../services/ModelCardService";
import { securityHeadersMiddleware } from "../middleware/securityMiddleware";
import { rateLimiters } from "../middleware/rateLimiter";
import { validateRequest } from "../middleware/inputValidation";
import { logger } from "../lib/logger";
import { requirePermission } from "../middleware/rbac";
import { getUnifiedAgentAPI } from "../services/UnifiedAgentAPI";
import { AgentType } from "../services/agent-types";

const router = Router();
router.use(securityHeadersMiddleware);
router.use(requirePermission("agents.execute"));

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
 * Invoke an agent with rate limiting
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
    const idempotencyKey =
      req.header("Idempotency-Key") || req.header("x-idempotency-key") || undefined;

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
      const api = getUnifiedAgentAPI();
      const userId = (req as any).user?.id;

      const response = await api.invoke({
        agent: agentId as AgentType,
        query,
        context,
        parameters,
        sessionId,
        userId,
        tenantId,
        idempotencyKey,
      });

      res.json(response);
    } catch (error) {
      logger.error("Agent invocation failed", error instanceof Error ? error : undefined, {
        agentId,
        sessionId,
        tenantId, // Add tenant context
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Agent invocation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

router.use((err: unknown, _req: Request, res: Response) => {
  logger.error("Agent info endpoint failed", err instanceof Error ? err : undefined);
  res.status(500).json({
    error: "agent_info_error",
    message: "Unable to load model card information",
  });
});

export default router;
