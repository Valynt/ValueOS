/**
 * Checkpoint REST endpoints — approve / reject / query pending HITL checkpoints.
 *
 * These endpoints resolve the in-memory Promises held by CheckpointMiddleware.
 */

import { Request, Response, Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { logger } from '../lib/logger.js';
import { CheckpointMiddleware } from '../services/middleware/CheckpointMiddleware.js';

/**
 * Create the checkpoint router.
 *
 * The caller must pass the same CheckpointMiddleware instance that is
 * registered in the orchestrator pipeline so the in-memory pending map
 * is shared.
 *
 * All routes require authentication and tenant context. Approve/reject
 * additionally require the `approvals:manage` permission.
 */
export function createCheckpointRouter(
  checkpointMiddleware: CheckpointMiddleware,
): Router {
  const router = Router();

  // All checkpoint routes require an authenticated session and tenant context.
  router.use(requireAuth, tenantContextMiddleware());

  /**
   * GET /api/checkpoints/:checkpointId
   * Retrieve a pending checkpoint's details.
   */
  router.get('/:checkpointId', (req: Request, res: Response) => {
    const { checkpointId } = req.params;
    const record = checkpointMiddleware.getCheckpoint(checkpointId);

    if (!record) {
      res.status(404).json({ error: 'Checkpoint not found or already resolved' });
      return;
    }

    res.json({ checkpoint: record });
  });

  /**
   * POST /api/checkpoints/:checkpointId/approve
   */
  router.post('/:checkpointId/approve', requirePermission('approvals:manage'), (req: Request, res: Response) => {
    const { checkpointId } = req.params;
    const resolvedBy = req.user?.id ?? req.body?.resolvedBy ?? 'unknown';

    logger.info('Checkpoint approve request', { checkpointId, resolvedBy });

    const found = checkpointMiddleware.resolveCheckpoint(checkpointId, 'approved', {
      resolvedBy,
    });

    if (!found) {
      res.status(404).json({ error: 'Checkpoint not found or already resolved' });
      return;
    }

    res.json({ status: 'approved', checkpointId });
  });

  /**
   * POST /api/checkpoints/:checkpointId/reject
   */
  router.post('/:checkpointId/reject', requirePermission('approvals:manage'), (req: Request, res: Response) => {
    const { checkpointId } = req.params;
    const reason = req.body?.reason ?? 'Rejected by reviewer';
    const resolvedBy = req.user?.id ?? req.body?.resolvedBy ?? 'unknown';

    logger.info('Checkpoint reject request', { checkpointId, resolvedBy, reason });

    const found = checkpointMiddleware.resolveCheckpoint(checkpointId, 'rejected', {
      reason,
      resolvedBy,
    });

    if (!found) {
      res.status(404).json({ error: 'Checkpoint not found or already resolved' });
      return;
    }

    res.json({ status: 'rejected', checkpointId, reason });
  });

  return router;
}
