import { Router, Request, Response } from 'express';
import { modelCardService } from '../services/ModelCardService';
import { securityHeadersMiddleware } from '../middleware/securityMiddleware';
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware';
import { rateLimiters } from '../middleware/rateLimiter';
import { logger } from '../lib/logger';
import { requirePermission } from '../middleware/rbac';

const router = Router();
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);
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

router.use((err: unknown, _req: Request, res: Response) => {
  logger.error('Agent info endpoint failed', err instanceof Error ? err : undefined);
  res.status(500).json({
    error: 'agent_info_error',
    message: 'Unable to load model card information',
  });
});

export default router;
