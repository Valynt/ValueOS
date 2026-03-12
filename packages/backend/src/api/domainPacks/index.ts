/**
 * Domain Packs API Routes
 *
 * CRUD endpoints for domain pack management.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextFunction, Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z, ZodError } from 'zod';

import { logger } from '../../lib/logger.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../../middleware/auth.js';
import { createRateLimiter, RateLimitTier } from '../../middleware/rateLimiter.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.js';
import { tenantDbContextMiddleware } from '../../middleware/tenantDbContext.js';

import {
  ConflictError,
  DatabaseError,
  getDomainPacksRepository,
  NotFoundError,
} from './repository.js';
import {
  ApiErrorResponse,
  CreateDomainPackSchema,
  ListDomainPacksQuerySchema,
  UpdateDomainPackSchema,
} from './types.js';


// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

const standardLimiter = createRateLimiter(RateLimitTier.STANDARD);
const strictLimiter = createRateLimiter(RateLimitTier.STRICT);

// ============================================================================
// Middleware
// ============================================================================

function correlationId(req: Request, _res: Response, next: NextFunction): void {
  (req as AuthenticatedRequest).correlationId =
    (req.headers['x-correlation-id'] as string) || `req-${uuidv4()}`;
  next();
}

function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const authReq = req as AuthenticatedRequest;

  res.on('finish', () => {
    logger.info('Domain packs API request', {
      requestId: authReq.correlationId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs: Date.now() - startTime,
      tenantId: authReq.tenantId,
    });
  });

  next();
}

function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: { errors },
          requestId: (req as AuthenticatedRequest).correlationId,
        } satisfies ApiErrorResponse);
        return;
      }
      next(err);
    }
  };
}

function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as unknown as typeof req.query;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: { errors },
          requestId: (req as AuthenticatedRequest).correlationId,
        } satisfies ApiErrorResponse);
        return;
      }
      next(err);
    }
  };
}

function validateUuidParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!value || !uuidRegex.test(value)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Invalid ${paramName}: must be a valid UUID`,
        requestId: (req as AuthenticatedRequest).correlationId,
      } satisfies ApiErrorResponse);
      return;
    }
    next();
  };
}

// ============================================================================
// Error Handler
// ============================================================================

function handleError(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as AuthenticatedRequest).correlationId;

  if (err instanceof NotFoundError) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: err.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json({
      error: 'CONFLICT',
      message: err.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (err instanceof DatabaseError) {
    logger.error('Database error in domain packs API', {
      requestId,
      error: err.message,
      code: err.code,
    });
    res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database temporarily unavailable. Please retry.',
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  logger.error('Unexpected error in domain packs API', {
    requestId,
    error: err instanceof Error ? err.message : 'Unknown error',
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    requestId,
  } satisfies ApiErrorResponse);
}

// ============================================================================
// Route Handlers
// ============================================================================


function getRepositoryForRequest(req: Request) {
  const supabase = (req as Request & { supabase?: SupabaseClient }).supabase;
  if (!supabase) {
    throw new DatabaseError('Request-scoped Supabase client is not available');
  }
  return getDomainPacksRepository(supabase);
}

async function createPack(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  try {
    const repository = getRepositoryForRequest(req);
    const pack = await repository.create(authReq.tenantId!, req.body);
    res.status(201).json({ data: pack, requestId: authReq.correlationId });
  } catch (err) {
    next(err);
  }
}

async function listPacks(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  try {
    const repository = getRepositoryForRequest(req);
    const result = await repository.list(authReq.tenantId!, req.query as unknown as Parameters<typeof repository.list>[1]);
    res.status(200).json({ ...result, requestId: authReq.correlationId });
  } catch (err) {
    next(err);
  }
}

async function getPack(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  try {
    const repository = getRepositoryForRequest(req);
    const pack = await repository.getById(authReq.tenantId!, req.params.packId);
    res.status(200).json({ data: pack, requestId: authReq.correlationId });
  } catch (err) {
    next(err);
  }
}

async function updatePack(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  try {
    const repository = getRepositoryForRequest(req);
    const pack = await repository.update(authReq.tenantId!, req.params.packId, req.body);
    res.status(200).json({ data: pack, requestId: authReq.correlationId });
  } catch (err) {
    next(err);
  }
}

async function publishPack(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  try {
    const repository = getRepositoryForRequest(req);
    const pack = await repository.publish(authReq.tenantId!, req.params.packId);
    res.status(200).json({ data: pack, requestId: authReq.correlationId });
  } catch (err) {
    next(err);
  }
}

async function deprecatePack(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  try {
    const repository = getRepositoryForRequest(req);
    const pack = await repository.deprecate(authReq.tenantId!, req.params.packId);
    res.status(200).json({ data: pack, requestId: authReq.correlationId });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// Route Definitions
// ============================================================================

router.use(correlationId);
router.use(requestLogger);
router.use(requireAuth);
router.use(tenantContextMiddleware(), tenantDbContextMiddleware());

// POST /domain-packs
router.post(
  '/',
  strictLimiter,
  requireRole(['admin', 'member']),
  validateBody(CreateDomainPackSchema),
  createPack,
);

// GET /domain-packs
router.get(
  '/',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateQuery(ListDomainPacksQuerySchema),
  listPacks,
);

// GET /domain-packs/:packId
router.get(
  '/:packId',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateUuidParam('packId'),
  getPack,
);

// PATCH /domain-packs/:packId
router.patch(
  '/:packId',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('packId'),
  validateBody(UpdateDomainPackSchema),
  updatePack,
);

// POST /domain-packs/:packId/publish
router.post(
  '/:packId/publish',
  strictLimiter,
  requireRole(['admin']),
  validateUuidParam('packId'),
  publishPack,
);

// POST /domain-packs/:packId/deprecate
router.post(
  '/:packId/deprecate',
  strictLimiter,
  requireRole(['admin']),
  validateUuidParam('packId'),
  deprecatePack,
);

router.use(handleError);

export { router as domainPacksRouter };
