/**
 * Value Drivers API Routes
 * 
 * Production-grade CRUD endpoints for value driver management.
 * Admin-only create/update/delete, all authenticated users can read published.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { 
  CreateValueDriverSchema,
  UpdateValueDriverSchema,
  ListValueDriversQuerySchema,
  ApiErrorResponse,
} from './types';
import { getValueDriversRepository } from './repository';
import {
  DbConflictError,
  DbForbiddenError,
  DbNotFoundError,
  DbUnauthorizedError,
  DbValidationError,
  TransientDbError,
} from '../../lib/db/errors';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { createRateLimiter, RateLimitTier } from '../../middleware/rateLimiter';
import { logger } from '../../lib/logger';

// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

// Rate limiters
const standardLimiter = createRateLimiter(RateLimitTier.STANDARD);
const strictLimiter = createRateLimiter(RateLimitTier.STRICT);

// ============================================================================
// Middleware
// ============================================================================

/**
 * Add correlation ID to request
 */
function correlationId(req: Request, _res: Response, next: NextFunction): void {
  (req as AuthenticatedRequest).correlationId = 
    (req.headers['x-correlation-id'] as string) || `req-${uuidv4()}`;
  next();
}

/**
 * Request logging middleware
 */
function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const authReq = req as AuthenticatedRequest;

  res.on('finish', () => {
    const latencyMs = Date.now() - startTime;
    logger.info('API request completed', {
      requestId: authReq.correlationId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs,
      tenantId: authReq.tenantId,
      userId: authReq.user?.id,
    });
  });

  next();
}

/**
 * Validate request body against schema
 */
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map(e => ({
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

/**
 * Validate query params against schema
 */
function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as unknown as typeof req.query;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map(e => ({
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

/**
 * Validate UUID path parameter
 */
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

/**
 * Map repository errors to HTTP responses
 */
function handleError(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const requestId = authReq.correlationId;

  if (err instanceof DbValidationError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: err.message,
      details: err.details,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (err instanceof DbNotFoundError) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: err.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (err instanceof DbConflictError) {
    res.status(409).json({
      error: 'CONFLICT',
      message: err.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (err instanceof DbUnauthorizedError) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: err.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (err instanceof DbForbiddenError) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: err.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (err instanceof TransientDbError) {
    logger.warn('Transient database error', {
      requestId,
      error: err.message,
      details: err.details,
    });

    res.setHeader('Retry-After', Math.ceil(err.retryAfterMs / 1000));
    res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: err.message,
      details: {
        retryAfterMs: err.retryAfterMs,
        retryHint: err.retryHint,
      },
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  logger.error('Unexpected error in value drivers API', {
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

/**
 * POST /api/v1/drivers
 * Create a new value driver (Admin only)
 */
async function createDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  try {
    const repository = getValueDriversRepository();
    const driver = await repository.create(
      authReq.tenantId!,
      authReq.user!.id,
      req.body
    );

    res.status(201).json({
      data: driver,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/drivers
 * List value drivers with pagination
 */
async function listDrivers(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  try {
    const repository = getValueDriversRepository();
    
    // Non-admin users can only see published drivers
    const query = req.query as any;
    if (!authReq.user?.roles?.includes('admin')) {
      query.status = 'published';
    }

    const result = await repository.list(authReq.tenantId!, query);

    res.status(200).json({
      ...result,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/drivers/:driverId
 * Get a single value driver
 */
async function getDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { driverId } = req.params;

  try {
    const repository = getValueDriversRepository();
    const driver = await repository.getById(authReq.tenantId!, driverId);

    // Non-admin users can only see published drivers
    if (!authReq.user?.roles?.includes('admin') && driver.status !== 'published') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: `ValueDriver not found: ${driverId}`,
        requestId: authReq.correlationId,
      } satisfies ApiErrorResponse);
      return;
    }

    res.status(200).json({
      data: driver,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/drivers/:driverId
 * Update a value driver (Admin only)
 */
async function updateDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { driverId } = req.params;

  try {
    const repository = getValueDriversRepository();
    const driver = await repository.update(authReq.tenantId!, driverId, req.body);

    res.status(200).json({
      data: driver,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/drivers/:driverId
 * Delete a value driver (Admin only)
 */
async function deleteDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { driverId } = req.params;

  try {
    const repository = getValueDriversRepository();
    await repository.delete(authReq.tenantId!, driverId);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/drivers/:driverId/usage
 * Track usage of a driver (for analytics)
 */
async function trackUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { driverId } = req.params;

  try {
    const repository = getValueDriversRepository();
    await repository.incrementUsage(authReq.tenantId!, driverId);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// Route Definitions
// ============================================================================

// Apply common middleware
router.use(correlationId);
router.use(requestLogger);

// All routes require authentication
router.use(requireAuth);

// POST /drivers - Create (Admin only)
router.post(
  '/',
  strictLimiter,
  requireRole(['admin']),
  validateBody(CreateValueDriverSchema),
  createDriver
);

// GET /drivers - List (All authenticated, non-admin sees only published)
router.get(
  '/',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateQuery(ListValueDriversQuerySchema),
  listDrivers
);

// GET /drivers/:driverId - Get one
router.get(
  '/:driverId',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateUuidParam('driverId'),
  getDriver
);

// PATCH /drivers/:driverId - Update (Admin only)
router.patch(
  '/:driverId',
  standardLimiter,
  requireRole(['admin']),
  validateUuidParam('driverId'),
  validateBody(UpdateValueDriverSchema),
  updateDriver
);

// DELETE /drivers/:driverId - Delete (Admin only)
router.delete(
  '/:driverId',
  strictLimiter,
  requireRole(['admin']),
  validateUuidParam('driverId'),
  deleteDriver
);

// POST /drivers/:driverId/usage - Track usage
router.post(
  '/:driverId/usage',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('driverId'),
  trackUsage
);

// Error handler
router.use(handleError);

export default router;
export { router as valueDriversRouter };
