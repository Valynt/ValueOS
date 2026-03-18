/**
 * Value Commitments API Router
 *
 * All mutation endpoints require authentication. organizationId is resolved
 * exclusively from the authenticated session — never from the request body.
 *
 * Routes:
 *   POST   /                              create commitment
 *   GET    /:commitmentId                 get commitment
 *   PATCH  /:commitmentId                 update core fields
 *   POST   /:commitmentId/status-transitions  FSM transition
 *   POST   /:commitmentId/notes           add note
 *   DELETE /:commitmentId                 delete (draft only)
 */

import { createLogger } from '@shared/lib/logger';
import { NextFunction, Router } from 'express';
import { ZodError } from 'zod';


import { AuthenticatedRequest, requireAuth } from '../../middleware/auth.js';
import { createRateLimiter, RateLimitTier } from '../../middleware/rateLimiter.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.js';
import { valueCommitmentBackendService } from '../../services/value/ValueCommitmentBackendService.js';

import {
  AddNoteSchema,
  CreateCommitmentSchema,
  StatusTransitionSchema,
  toCommitmentDto,
  toNoteDto,
  UpdateCommitmentSchema,
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
