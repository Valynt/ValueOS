/**
 * Value Cases API Routes
 *
 * Composed route modules for value case management while preserving existing
 * middleware, auth, and rate-limit behavior.
 */

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { logger } from '../../lib/logger.js';
import { getDiscoveryAgent } from '../../lib/agent-fabric/agents/DiscoveryAgent.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { createRateLimiter, RateLimitTier } from '../../middleware/rateLimiter.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.js';
import { tenantDbContextMiddleware } from '../../middleware/tenantDbContext.js';

import baselineRouter from './baseline.js';
import { backHalfRouter } from './backHalf.js';
import { handleError } from './errors.js';
import { correlationId, requestLogger, validateUuidParam } from './middleware.js';
import { requireOrganizationContext } from './requireOrganizationContext.js';
import { registerCrudRoutes } from './crud.routes.js';
import { registerEconomicRoutes } from './economic.routes.js';
import { registerIntegrityRoutes } from './integrity.routes.js';
import { registerValueTreeRoutes } from './valueTree.routes.js';

const router = Router();

const standardLimiter = createRateLimiter(RateLimitTier.STANDARD);
const strictLimiter = createRateLimiter(RateLimitTier.STRICT);

router.use(correlationId);
router.use(requestLogger);
router.use(requireAuth);
router.use(tenantContextMiddleware(), tenantDbContextMiddleware());
router.use(requireOrganizationContext);

const discoveryRunIdSchema = z.string().min(1).max(128).regex(
  /^discovery_[0-9]{13}_[a-z0-9]{7}$/i,
  'Invalid runId format',
);

function validateDiscoveryRunIdParam(paramName: 'runId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = discoveryRunIdSchema.safeParse(req.params[paramName]);

    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Invalid ${paramName}: must be a discovery run identifier`,
        details: parsed.error.flatten(),
      });
      return;
    }

    next();
  };
}

const StartDiscoverySchema = z
  .object({
    companyName: z.string().min(1).max(200),
    industryContext: z.string().max(500).optional(),
  })
  .strict();

async function startDiscovery(req: Request, res: Response) {
  try {
    const { caseId } = req.params;
    const organizationId = req.organizationId!;
    const body = StartDiscoverySchema.safeParse(req.body);

    if (!body.success) {
      return res.status(400).json({
        error: 'Invalid discovery request',
        details: body.error.flatten(),
      });
    }

    const discoveryAgent = getDiscoveryAgent();
    const result = await discoveryAgent.startDiscovery({
      organizationId,
      valueCaseId: caseId,
      companyName: body.data.companyName,
      industryContext: body.data.industryContext,
    });

    logger.info('Discovery started', {
      runId: result.runId,
      caseId,
      organizationId,
    });

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
  validateDiscoveryRunIdParam('runId'),
  getDiscoveryStatus,
);

router.delete(
  '/discovery/:runId',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateDiscoveryRunIdParam('runId'),
  cancelDiscovery,
);

registerValueTreeRoutes(router, { standardLimiter });
registerIntegrityRoutes(router, { standardLimiter });
registerEconomicRoutes(router, { standardLimiter });
registerCrudRoutes(router, { standardLimiter, strictLimiter });

router.use('/', backHalfRouter);
router.use('/', baselineRouter);
router.use(handleError);

export default router;
export { router as valueCasesRouter };
