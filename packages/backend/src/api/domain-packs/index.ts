/**
 * Domain packs API routes.
 *
 * Canonical production router for `/api/v1/domain-packs`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextFunction, Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z, ZodError } from 'zod';

import { createRequestRlsSupabaseClient } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../../middleware/auth.js';
import { createRateLimiter, RateLimitTier } from '../../middleware/rateLimiter.js';
import { tenantContextMiddleware } from '../../middleware/tenantContext.js';
import { tenantDbContextMiddleware } from '../../middleware/tenantDbContext.js';
import { DomainPackAccessError, DomainPackService } from '../../services/domain-packs/index.js';

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

const router = Router();

const standardLimiter = createRateLimiter(RateLimitTier.STANDARD);
const strictLimiter = createRateLimiter(RateLimitTier.STRICT);

const SetPackSchema = z.object({
  packId: z.string().uuid(),
});

const HardenKPISchema = z.object({
  kpiKey: z.string(),
  baselineValue: z.number().optional(),
  targetValue: z.number().optional(),
});

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

function getTenantId(req: Request): string {
  const tenantId = (req as AuthenticatedRequest).tenantId;
  if (!tenantId) {
    throw new DomainPackAccessError('Tenant context required', 401);
  }
  return tenantId;
}

function handleError(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as AuthenticatedRequest).correlationId;

  if (err instanceof DomainPackAccessError) {
    res.status(err.statusCode).json({
      error: 'FORBIDDEN',
      message: err.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

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
    const result = await repository.list(authReq.tenantId!, req.query as Parameters<typeof repository.list>[1]);
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

async function setPackForCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const { caseId } = req.params;
    const body = SetPackSchema.parse(req.body);

    await new DomainPackService(createRequestRlsSupabaseClient(req)).setPackForCase(caseId, body.packId, tenantId);
    res.status(200).json({ success: true, caseId, packId: body.packId });
  } catch (err) {
    next(err);
  }
}

async function getMergedContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const { caseId } = req.params;
    const merged = await new DomainPackService(createRequestRlsSupabaseClient(req)).getMergedContext(caseId, tenantId);
    res.status(200).json(merged);
  } catch (err) {
    next(err);
  }
}

async function hardenSingleKpi(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const { caseId } = req.params;
    const body = HardenKPISchema.parse(req.body);

    await new DomainPackService(createRequestRlsSupabaseClient(req)).hardenKPI(
      caseId,
      body.kpiKey,
      {
        baseline_value: body.baselineValue,
        target_value: body.targetValue,
      },
      tenantId,
    );

    res.status(200).json({ success: true, caseId, kpiKey: body.kpiKey });
  } catch (err) {
    next(err);
  }
}

async function hardenAllKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = getTenantId(req);
    const { caseId } = req.params;
    const count = await new DomainPackService(createRequestRlsSupabaseClient(req)).hardenAllKPIs(caseId, tenantId);
    res.status(200).json({ success: true, caseId, hardenedCount: count });
  } catch (err) {
    next(err);
  }
}

router.use(correlationId);
router.use(requestLogger);
router.use(requireAuth);
router.use(tenantContextMiddleware(), tenantDbContextMiddleware());

router.post(
  '/',
  strictLimiter,
  requireRole(['admin', 'member']),
  validateBody(CreateDomainPackSchema),
  createPack,
);

router.get(
  '/',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateQuery(ListDomainPacksQuerySchema),
  listPacks,
);

router.post(
  '/value-cases/:caseId/set-pack',
  strictLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  validateBody(SetPackSchema),
  setPackForCase,
);

router.get(
  '/value-cases/:caseId/merged-context',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateUuidParam('caseId'),
  getMergedContext,
);

router.post(
  '/value-cases/:caseId/harden-kpi',
  strictLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  validateBody(HardenKPISchema),
  hardenSingleKpi,
);

router.post(
  '/value-cases/:caseId/harden-all-kpis',
  strictLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  hardenAllKpis,
);

router.get(
  '/:packId',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateUuidParam('packId'),
  getPack,
);

router.patch(
  '/:packId',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('packId'),
  validateBody(UpdateDomainPackSchema),
  updatePack,
);

router.post(
  '/:packId/publish',
  strictLimiter,
  requireRole(['admin']),
  validateUuidParam('packId'),
  publishPack,
);

router.post(
  '/:packId/deprecate',
  strictLimiter,
  requireRole(['admin']),
  validateUuidParam('packId'),
  deprecatePack,
);

router.use(handleError);

export { router as domainPacksRouter };
export default router;
