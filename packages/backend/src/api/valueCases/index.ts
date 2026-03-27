/**
 * Value Cases API Routes
 *
 * Composed route modules for value case management while preserving existing
 * middleware, auth, and rate-limit behavior.
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { logger } from '../../lib/logger.js';
import { getDiscoveryAgent } from '../../lib/agent-fabric/agents/DiscoveryAgent.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../../middleware/auth.js';
import { createRateLimiter, RateLimitTier } from '../../middleware/rateLimiter.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.js';
import { tenantDbContextMiddleware } from '../../middleware/tenantDbContext.js';

import baselineRouter from './baseline.js';
import { backHalfRouter } from './backHalf.js';
import { registerCrudRoutes } from './crud.routes.js';
import { registerEconomicRoutes } from './economic.routes.js';
import { handleError } from './errors.js';
import { registerIntegrityRoutes } from './integrity.routes.js';
import { validateUuidParam, correlationId, requestLogger } from './middleware.js';
import { registerValueTreeRoutes } from './valueTree.routes.js';

const router = Router();

const standardLimiter = createRateLimiter(RateLimitTier.STANDARD);
const strictLimiter = createRateLimiter(RateLimitTier.STRICT);

router.use(correlationId);
router.use(requestLogger);
router.use(requireAuth);
router.use(tenantContextMiddleware(), tenantDbContextMiddleware());

registerCrudRoutes(router, { standardLimiter, strictLimiter });
registerValueTreeRoutes(router, { standardLimiter });
registerIntegrityRoutes(router, { standardLimiter });
registerEconomicRoutes(router, { standardLimiter });

const StartDiscoverySchema = z.object({
  companyName: z.string().min(1).max(200),
  industryContext: z.string().max(500).optional(),
}).strict();

async function startDiscovery(req: Request, res: Response) {
  try {
    const { caseId } = req.params;
    const tenantId = (req as AuthenticatedRequest).tenantId ?? '';
    const body = StartDiscoverySchema.safeParse(req.body);

    if (!body.success) {
      return res.status(400).json({
        error: 'Invalid discovery request',
        details: body.error.flatten(),
      });
    }

    const discoveryAgent = getDiscoveryAgent();
    const result = await discoveryAgent.startDiscovery({
      organizationId: tenantId,
      valueCaseId: caseId,
      companyName: body.data.companyName,
      industryContext: body.data.industryContext,
    });

    logger.info('Discovery started', { runId: result.runId, caseId, tenantId });
    return res.status(202).json({
      runId: result.runId,
      status: 'started',
      message: 'Discovery workflow initiated',
    });
  } catch (err) {
    logger.error('Discovery start failed', {
      error: err instanceof Error ? err.message : String(err),
      caseId: req.params.caseId,
    });
    return res.status(500).json({ error: 'Failed to start discovery' });
  }
}

async function getDiscoveryStatus(req: Request, res: Response) {
  try {
    const { runId } = req.params;
    const discoveryAgent = getDiscoveryAgent();
    const runState = discoveryAgent.getRunState(runId);

    if (!runState) {
      return res.status(404).json({ error: 'Discovery run not found' });
    }

    return res.json({
      runId: runState.runId,
      status: runState.status,
      startedAt: runState.startedAt,
      completedAt: runState.completedAt,
      error: runState.error,
    });
  } catch (err) {
    logger.error('Discovery status check failed', {
      error: err instanceof Error ? err.message : String(err),
      runId: req.params.runId,
    });
    return res.status(500).json({ error: 'Failed to get discovery status' });
  }
}

async function cancelDiscovery(req: Request, res: Response) {
  try {
    const { runId } = req.params;
    const discoveryAgent = getDiscoveryAgent();
    await discoveryAgent.cancelDiscovery(runId);
    return res.json({ message: 'Discovery run cancelled' });
  } catch (err) {
    logger.error('Discovery cancel failed', {
      error: err instanceof Error ? err.message : String(err),
      runId: req.params.runId,
    });
    return res.status(500).json({ error: 'Failed to cancel discovery' });
  }
}

router.post(
  '/:caseId/discovery',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  startDiscovery,
);

router.get(
  '/discovery/:runId',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('runId'),
  getDiscoveryStatus,
);

router.delete(
  '/discovery/:runId',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('runId'),
  cancelDiscovery,
);

router.use(handleError);
router.use('/', backHalfRouter);
router.use('/', baselineRouter);

export default router;
export { router as valueCasesRouter };
