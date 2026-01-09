import { Request, Response, Router } from 'express';
import { modelCardService } from '../services/ModelCardService';
import { securityHeadersMiddleware } from '../middleware/securityMiddleware';
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { rateLimiters } from '../middleware/rateLimiter';
import { validateRequest, ValidationSchemas } from '../middleware/inputValidation';
import { logger } from '../lib/logger';
import { requirePermission } from '../middleware/rbac';
import { getUnifiedAgentAPI } from '../services/UnifiedAgentAPI';

const router = Router();
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);
router.use(tenantContextMiddleware());
router.use(requirePermission('agents.execute'));

router.get('/:agentId/info', rateLimiters.loose, (req: Request, res: Response) => {
  const { agentId } = req.params;
  const modelCard = modelCardService.getModelCard(agentId);

  if (!modelCard) {
    return res.status(404).json({
      error: 'Model card not found',
      message: `No model metadata available for agent ${agentId}`,
    });
  }

  res.setHeader('x-model-card-version', modelCard.schemaVersion);

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
router.post('/:agentId/invoke', rateLimiters.agentExecution, validateRequest({
  query: { type: 'string' as const, required: true, maxLength: 2000 },
  context: { type: 'string' as const, maxLength: 1000 },
  parameters: { type: 'object' as const },
  sessionId: { type: 'string' as const, maxLength: 100 }
}), async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { query, context, parameters, sessionId } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Query parameter is required and must be a string',
    });
  }

  try {
    const api = getUnifiedAgentAPI();
    const userId = req.user?.id;

    const response = await api.invoke({
      agent: agentId,
      query,
      context,
      parameters,
      sessionId,
      userId,
    });

    res.json(response);
  } catch (error) {
    logger.error('Agent invocation failed', error instanceof Error ? error : undefined, {
      agentId,
      sessionId,
    });

    res.status(500).json({
      success: false,
      error: 'Agent invocation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.use((err: unknown, _req: Request, res: Response) => {
  logger.error('Agent info endpoint failed', err instanceof Error ? err : undefined);
  res.status(500).json({
    error: 'agent_info_error',
    message: 'Unable to load model card information',
  });
});

export default router;
