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

import { auditLogService } from '../../services/security/AuditLogService.js';

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
    const organizationId = req.organizationId;
    const discoveryAgent = getDiscoveryAgent();
    const runState = await discoveryAgent.getRunState(runId);

    if (!runState) {
      return res.status(404).json({ error: 'Discovery run not found' });
    }

    if (runState.organizationId !== organizationId) {
      return res.status(403).json({ error: 'Forbidden' });
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
    const organizationId = req.organizationId;
    const discoveryAgent = getDiscoveryAgent();

    // Verify ownership before cancelling
    const runState = await discoveryAgent.getRunState(runId);
    if (!runState) {
      return res.status(404).json({ error: 'Discovery run not found' });
    }
    if (runState.organizationId !== organizationId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

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


const checkpointDecisionSchema = z.object({
  runId: z.string().min(1).max(200),
  stageId: z.string().min(1).max(80).default('hypothesis'),
  decision: z.enum(['approved', 'changes_requested']),
  rationale: z.string().max(2000).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
});

const checkpointQuerySchema = z.object({
  runId: z.string().min(1).max(200),
  stageId: z.string().min(1).max(80).default('hypothesis'),
});

function asUuid(value: string | undefined): string | null {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

router.get('/:caseId/checkpoints/review', standardLimiter, requireRole(['admin', 'member']), validateUuidParam('caseId'), async (req: Request, res: Response) => {
  const parsed = checkpointQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }

  const db = req.db;
  const organizationId = req.organizationId;
  if (!db || !organizationId) {
    return res.status(500).json({ error: 'DEPENDENCY_ERROR', message: 'Tenant database context unavailable' });
  }

  const { runId, stageId } = parsed.data;
  const caseId = req.params.caseId;

  const existing = await db.query<{
    id: string;
    status: string;
    decision: { rationale?: string; decided_at?: string; actor_id?: string } | null;
    payload: { risk_level?: 'low' | 'medium' | 'high' } | null;
  }>(
    `SELECT id, status, decision, payload
       FROM public.workflow_checkpoints
      WHERE organization_id = $1
        AND case_id = $2::uuid
        AND session_id = $3
        AND agent_id = $4
      ORDER BY created_at DESC
      LIMIT 1`,
    [organizationId, caseId, runId, stageId],
  );

  const row = existing.rows[0];
  const data = {
    checkpointId: row?.id ?? null,
    caseId,
    runId,
    stageId,
    status: row?.status === 'approved' ? 'approved' : row?.status === 'rejected' ? 'changes_requested' : 'pending',
    rationale: row?.decision?.rationale ?? null,
    actorId: row?.decision?.actor_id ?? null,
    decidedAt: row?.decision?.decided_at ?? null,
    riskLevel: row?.payload?.risk_level ?? 'medium',
  };

  return res.status(200).json({ success: true, data });
});

router.post('/:caseId/checkpoints/review', strictLimiter, requireRole(['admin', 'member']), validateUuidParam('caseId'), async (req: Request, res: Response) => {
  const parsed = checkpointDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }

  const db = req.db;
  const organizationId = req.organizationId;
  const actorId = req.user?.id ?? 'unknown';
  if (!db || !organizationId) {
    return res.status(500).json({ error: 'DEPENDENCY_ERROR', message: 'Tenant database context unavailable' });
  }

  const { runId, stageId, decision, rationale, riskLevel } = parsed.data;
  if (decision === 'changes_requested' && !rationale?.trim()) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Rationale is required for requesting changes' });
  }

  const caseId = req.params.caseId;
  const nowIso = new Date().toISOString();

  const existing = await db.query<{ id: string }>(
    `SELECT id
       FROM public.workflow_checkpoints
      WHERE organization_id = $1
        AND case_id = $2::uuid
        AND session_id = $3
        AND agent_id = $4
      ORDER BY created_at DESC
      LIMIT 1`,
    [organizationId, caseId, runId, stageId],
  );

  let checkpointId = existing.rows[0]?.id;
  if (!checkpointId) {
    const inserted = await db.query<{ id: string }>(
      `INSERT INTO public.workflow_checkpoints
        (case_id, organization_id, session_id, agent_id, checkpoint_type, status, payload, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, 'review', 'pending', $5::jsonb, now(), now())
       RETURNING id`,
      [
        caseId,
        organizationId,
        runId,
        stageId,
        JSON.stringify({ case_id: caseId, run_id: runId, stage_id: stageId, risk_level: riskLevel, audit_log: [] }),
      ],
    );
    checkpointId = inserted.rows[0]?.id;
  }

  await db.query(
    `UPDATE public.workflow_checkpoints
        SET status = $1,
            decided_by = $2::uuid,
            decided_at = $3::timestamptz,
            decision = $4::jsonb,
            payload = jsonb_set(
              COALESCE(payload, '{}'::jsonb),
              '{audit_log}',
              COALESCE(payload->'audit_log', '[]'::jsonb) || $5::jsonb
            ),
            updated_at = now()
      WHERE id = $6
        AND organization_id = $7::uuid`,
    [
      decision === 'approved' ? 'approved' : 'rejected',
      asUuid(actorId),
      nowIso,
      JSON.stringify({
        review_status: decision,
        actor_id: actorId,
        decided_at: nowIso,
        rationale: rationale?.trim() || null,
        run_id: runId,
        case_id: caseId,
      }),
      JSON.stringify([{ event: 'review_decision_recorded', actor_id: actorId, decided_at: nowIso, decision }]),
      checkpointId,
      organizationId,
    ],
  );

  await auditLogService.logAudit({
    userId: actorId,
    userName: req.user?.email ?? actorId,
    userEmail: req.user?.email ?? '',
    tenantId: organizationId,
    action: `checkpoint_review_${decision}`,
    resourceType: 'workflow_checkpoint',
    resourceId: checkpointId ?? runId,
    details: {
      caseId,
      runId,
      stageId,
      rationale: rationale?.trim() || null,
      riskLevel,
    },
    status: 'success',
  });

  return res.status(200).json({
    success: true,
    data: {
      checkpointId: checkpointId ?? null,
      caseId,
      runId,
      stageId,
      status: decision,
      rationale: rationale?.trim() || null,
      actorId,
      decidedAt: nowIso,
      riskLevel,
    },
  });
});

registerValueTreeRoutes(router, { standardLimiter });
registerIntegrityRoutes(router, { standardLimiter });
registerEconomicRoutes(router, { standardLimiter });
registerCrudRoutes(router, { standardLimiter, strictLimiter });

router.use('/', backHalfRouter);
router.use('/', baselineRouter);
router.use(handleError);

export default router;
export { router as valueCasesRouter };
