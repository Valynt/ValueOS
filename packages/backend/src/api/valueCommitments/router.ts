/**
 * Value Commitments API Router
 *
 * All mutation endpoints require authentication. organizationId is resolved
 * exclusively from the authenticated session — never from the request body.
 *
 * Routes:
 *   POST   /                                              create commitment
 *   GET    /                                              list commitments (?atRisk=true for below-threshold)
 *   GET    /:commitmentId                                 get commitment
 *   PATCH  /:commitmentId                                 update core fields
 *   POST   /:commitmentId/status-transitions              FSM transition
 *   POST   /:commitmentId/notes                           add note
 *   DELETE /:commitmentId                                 delete (draft only)
 *   GET    /:commitmentId/progress                        computed progress summary
 *   POST   /:commitmentId/validate-progress               ground-truth validation verdict
 *   POST   /:commitmentId/milestones                      add milestone
 *   PATCH  /:commitmentId/milestones/:milestoneId         update milestone
 *   POST   /:commitmentId/metrics                         add metric
 *   PATCH  /:commitmentId/metrics/:metricId/actual        record actual metric value
 *   POST   /:commitmentId/risks                           add risk
 *   PATCH  /:commitmentId/risks/:riskId                   update risk
 *   POST   /:commitmentId/stakeholders                    add stakeholder
 *   PATCH  /:commitmentId/stakeholders/:stakeholderId     update stakeholder
 */

import { NextFunction, Router } from 'express';
import { ZodError } from 'zod';

import { createLogger } from '@shared/lib/logger';

import { AuthenticatedRequest, requireAuth } from '../../middleware/auth.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.js';
import { createRateLimiter, RateLimitTier } from '../../middleware/rateLimiter.js';
import { valueCommitmentBackendService } from '../../services/value/ValueCommitmentBackendService.js';
import {
  AddMilestoneSchema,
  AddMetricSchema,
  AddNoteSchema,
  AddRiskSchema,
  AddStakeholderSchema,
  CreateCommitmentSchema,
  StatusTransitionSchema,
  UpdateCommitmentSchema,
  UpdateMilestoneSchema,
  UpdateMetricActualSchema,
  UpdateRiskSchema,
  UpdateStakeholderSchema,
  toCommitmentDto,
  toNoteDto,
} from './schemas.js';

const logger = createLogger({ component: 'ValueCommitmentsRouter' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract trusted org/user context from the authenticated request. */
function resolveContext(req: AuthenticatedRequest): { organizationId: string; actorUserId: string } {
  const organizationId = req.tenantId ?? (req.user?.tenant_id as string | undefined);
  const actorUserId    = req.user?.id;

  if (!organizationId || !actorUserId) {
    const err = new Error('Missing tenant or user context after auth middleware');
    (err as NodeJS.ErrnoException).code = 'MISSING_CONTEXT';
    throw err;
  }

  return { organizationId, actorUserId };
}

/** Map service errors to HTTP status codes. */
function errorStatus(err: unknown): number {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code;
    if (code === 'MISSING_CONTEXT')    return 401;
    if (code === 'AUTHORIZATION_ERROR') return 403;
    if (code === 'NOT_FOUND')           return 404;
    if (code === 'CONFLICT')            return 409;
    if (code === 'VALIDATION_ERROR')    return 400;
  }
  return 500;
}

function handleError(err: unknown, res: import('express').Response, context: string): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      // flatten() returns { formErrors, fieldErrors }. formErrors carries root-level
      // refine() messages (e.g. "At least one field required" on UpdateCommitmentSchema).
      details: err.flatten(),
    });
    return;
  }

  const status = errorStatus(err);
  const message = err instanceof Error ? err.message : 'Internal server error';

  if (status >= 500) {
    logger.error(`${context} failed`, {
      error: message,
      status,
    });
  }

  res.status(status).json({
    error: status === 500 ? 'INTERNAL_ERROR' : (err instanceof Error ? (err as { code?: string }).code ?? 'ERROR' : 'ERROR'),
    message: status >= 500 ? 'An unexpected error occurred' : message,
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const valueCommitmentsRouter = Router();

const standardLimiter = createRateLimiter(RateLimitTier.STANDARD);
const strictLimiter   = createRateLimiter(RateLimitTier.STRICT);

// All routes require authentication and tenant context
valueCommitmentsRouter.use(requireAuth);
valueCommitmentsRouter.use(tenantContextMiddleware());

// ---------------------------------------------------------------------------
// POST / — create commitment
// ---------------------------------------------------------------------------

valueCommitmentsRouter.post(
  '/',
  strictLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId } = resolveContext(req);
      const input = CreateCommitmentSchema.parse(req.body);

      const row = await valueCommitmentBackendService.createCommitment(
        organizationId,
        actorUserId,
        input,
      );

      res.status(201).json(toCommitmentDto(row));
    } catch (err) {
      handleError(err, res, 'POST /value-commitments');
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:commitmentId — read commitment
// ---------------------------------------------------------------------------

valueCommitmentsRouter.get(
  '/:commitmentId',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId } = resolveContext(req);
      const { commitmentId }   = req.params as { commitmentId: string };

      const row = await valueCommitmentBackendService.getCommitment(commitmentId, organizationId);

      res.status(200).json(toCommitmentDto(row));
    } catch (err) {
      handleError(err, res, 'GET /value-commitments/:id');
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /:commitmentId — update core fields
// ---------------------------------------------------------------------------

valueCommitmentsRouter.patch(
  '/:commitmentId',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId } = resolveContext(req);
      const { commitmentId }                = req.params as { commitmentId: string };
      const input = UpdateCommitmentSchema.parse(req.body);

      const row = await valueCommitmentBackendService.updateCommitment(
        commitmentId,
        organizationId,
        actorUserId,
        input,
      );

      res.status(200).json(toCommitmentDto(row));
    } catch (err) {
      handleError(err, res, 'PATCH /value-commitments/:id');
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:commitmentId/status-transitions — FSM transition
// ---------------------------------------------------------------------------

valueCommitmentsRouter.post(
  '/:commitmentId/status-transitions',
  strictLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId } = resolveContext(req);
      const { commitmentId }                = req.params as { commitmentId: string };
      const input = StatusTransitionSchema.parse(req.body);

      const row = await valueCommitmentBackendService.transitionStatus(
        commitmentId,
        organizationId,
        actorUserId,
        input,
      );

      res.status(200).json(toCommitmentDto(row));
    } catch (err) {
      handleError(err, res, 'POST /value-commitments/:id/status-transitions');
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:commitmentId/notes — add note
// ---------------------------------------------------------------------------

valueCommitmentsRouter.post(
  '/:commitmentId/notes',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId } = resolveContext(req);
      const { commitmentId }                = req.params as { commitmentId: string };
      const input = AddNoteSchema.parse(req.body);

      const row = await valueCommitmentBackendService.addNote(
        commitmentId,
        organizationId,
        actorUserId,
        input,
      );

      res.status(201).json(toNoteDto(row));
    } catch (err) {
      handleError(err, res, 'POST /value-commitments/:id/notes');
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:commitmentId — delete (draft only)
// ---------------------------------------------------------------------------

valueCommitmentsRouter.delete(
  '/:commitmentId',
  strictLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId } = resolveContext(req);
      const { commitmentId }                = req.params as { commitmentId: string };

      await valueCommitmentBackendService.deleteCommitment(
        commitmentId,
        organizationId,
        actorUserId,
      );

      res.status(204).send();
    } catch (err) {
      handleError(err, res, 'DELETE /value-commitments/:id');
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:commitmentId/progress — computed progress summary
// ---------------------------------------------------------------------------

valueCommitmentsRouter.get(
  '/:commitmentId/progress',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId } = resolveContext(req);
      const { commitmentId }   = req.params as { commitmentId: string };

      const progress = await valueCommitmentBackendService.getProgress(commitmentId, organizationId);
      res.status(200).json(progress);
    } catch (err) {
      handleError(err, res, 'GET /value-commitments/:id/progress');
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:commitmentId/validate-progress — ground-truth validation
//
// Applies explicit threshold rules to the live progress snapshot and returns
// a structured verdict. Replaces the client-side stub in the frontend service.
// ---------------------------------------------------------------------------

valueCommitmentsRouter.post(
  '/:commitmentId/validate-progress',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId } = resolveContext(req);
      const { commitmentId }   = req.params as { commitmentId: string };

      const result = await valueCommitmentBackendService.validateProgress(commitmentId, organizationId);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res, 'POST /value-commitments/:id/validate-progress');
    }
  },
);

// ---------------------------------------------------------------------------
// GET / — list commitments; ?atRisk=true filters to below-threshold rows
// ---------------------------------------------------------------------------

valueCommitmentsRouter.get(
  '/',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId } = resolveContext(req);
      const atRisk = req.query['atRisk'] === 'true';

      if (atRisk) {
        const rows = await valueCommitmentBackendService.getAtRiskCommitments(organizationId);
        res.status(200).json(rows.map(toCommitmentDto));
      } else {
        const rows = await valueCommitmentBackendService.listCommitments(organizationId);
        res.status(200).json(rows.map(toCommitmentDto));
      }
    } catch (err) {
      handleError(err, res, 'GET /value-commitments');
    }
  },
);

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

valueCommitmentsRouter.post(
  '/:commitmentId/milestones',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId } = resolveContext(req);
      const { commitmentId }                = req.params as { commitmentId: string };
      const input = AddMilestoneSchema.parse(req.body);

      const row = await valueCommitmentBackendService.addMilestone(
        commitmentId, organizationId, actorUserId, input,
      );
      res.status(201).json(row);
    } catch (err) {
      handleError(err, res, 'POST /value-commitments/:id/milestones');
    }
  },
);

valueCommitmentsRouter.patch(
  '/:commitmentId/milestones/:milestoneId',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId } = resolveContext(req);
      const { commitmentId, milestoneId }   = req.params as { commitmentId: string; milestoneId: string };
      const input = UpdateMilestoneSchema.parse(req.body);

      const row = await valueCommitmentBackendService.updateMilestone(
        commitmentId, milestoneId, organizationId, actorUserId, input,
      );
      res.status(200).json(row);
    } catch (err) {
      handleError(err, res, 'PATCH /value-commitments/:id/milestones/:milestoneId');
    }
  },
);

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

valueCommitmentsRouter.post(
  '/:commitmentId/metrics',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId } = resolveContext(req);
      const { commitmentId }                = req.params as { commitmentId: string };
      const input = AddMetricSchema.parse(req.body);

      const row = await valueCommitmentBackendService.addMetric(
        commitmentId, organizationId, actorUserId, input,
      );
      res.status(201).json(row);
    } catch (err) {
      handleError(err, res, 'POST /value-commitments/:id/metrics');
    }
  },
);

valueCommitmentsRouter.patch(
  '/:commitmentId/metrics/:metricId/actual',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId } = resolveContext(req);
      const { commitmentId, metricId }      = req.params as { commitmentId: string; metricId: string };
      const input = UpdateMetricActualSchema.parse(req.body);

      const row = await valueCommitmentBackendService.updateMetricActual(
        commitmentId, metricId, organizationId, actorUserId, input,
      );
      res.status(200).json(row);
    } catch (err) {
      handleError(err, res, 'PATCH /value-commitments/:id/metrics/:metricId/actual');
    }
  },
);

// ---------------------------------------------------------------------------
// Risks
// ---------------------------------------------------------------------------

valueCommitmentsRouter.post(
  '/:commitmentId/risks',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId } = resolveContext(req);
      const { commitmentId }                = req.params as { commitmentId: string };
      const input = AddRiskSchema.parse(req.body);

      const row = await valueCommitmentBackendService.addRisk(
        commitmentId, organizationId, actorUserId, input,
      );
      res.status(201).json(row);
    } catch (err) {
      handleError(err, res, 'POST /value-commitments/:id/risks');
    }
  },
);

valueCommitmentsRouter.patch(
  '/:commitmentId/risks/:riskId',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId } = resolveContext(req);
      const { commitmentId, riskId }        = req.params as { commitmentId: string; riskId: string };
      const input = UpdateRiskSchema.parse(req.body);

      const row = await valueCommitmentBackendService.updateRisk(
        commitmentId, riskId, organizationId, actorUserId, input,
      );
      res.status(200).json(row);
    } catch (err) {
      handleError(err, res, 'PATCH /value-commitments/:id/risks/:riskId');
    }
  },
);

// ---------------------------------------------------------------------------
// Stakeholders
// ---------------------------------------------------------------------------

valueCommitmentsRouter.post(
  '/:commitmentId/stakeholders',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId } = resolveContext(req);
      const { commitmentId }                = req.params as { commitmentId: string };
      const input = AddStakeholderSchema.parse(req.body);

      const row = await valueCommitmentBackendService.addStakeholder(
        commitmentId, organizationId, actorUserId, input,
      );
      res.status(201).json(row);
    } catch (err) {
      handleError(err, res, 'POST /value-commitments/:id/stakeholders');
    }
  },
);

valueCommitmentsRouter.patch(
  '/:commitmentId/stakeholders/:stakeholderId',
  standardLimiter,
  async (req: AuthenticatedRequest, res, _next: NextFunction) => {
    try {
      const { organizationId, actorUserId }    = resolveContext(req);
      const { commitmentId, stakeholderId }    = req.params as { commitmentId: string; stakeholderId: string };
      const input = UpdateStakeholderSchema.parse(req.body);

      const row = await valueCommitmentBackendService.updateStakeholder(
        commitmentId, stakeholderId, organizationId, actorUserId, input,
      );
      res.status(200).json(row);
    } catch (err) {
      handleError(err, res, 'PATCH /value-commitments/:id/stakeholders/:stakeholderId');
    }
  },
);
