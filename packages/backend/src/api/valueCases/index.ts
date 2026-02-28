/**
 * Value Cases API Routes
 * 
 * Production-grade CRUD endpoints for value case management.
 * 
 * Features:
 * - Input validation with Zod (strict mode, reject unknown fields)
 * - JWT authentication with role-based access
 * - Rate limiting (per-IP + per-user)
 * - Structured JSON logging with correlation IDs
 * - Proper HTTP status codes
 * - Graceful error handling (no stack trace leaks)
 */

import { NextFunction, Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z, ZodError } from 'zod';

import { logger } from '../../lib/logger.js'
import { AuthenticatedRequest, requireAuth, requireRole } from '../../middleware/auth.js'
import { createRateLimiter, RateLimitTier } from '../../middleware/rateLimiter.js'
import { tenantContextMiddleware } from '../../middleware/tenantContext.js'
import { tenantDbContextMiddleware } from '../../middleware/tenantDbContext.js'

import { 
  ConflictError,
  DatabaseError,
  getValueCasesRepository,
  NotFoundError,
} from './repository';
import { 
  ApiErrorResponse,
  CreateValueCaseSchema,
  ListValueCasesQuerySchema,
  UpdateValueCaseSchema,
} from './types';


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
      userAgent: req.headers['user-agent']?.substring(0, 100),
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

  // Known repository errors
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
    logger.error('Database error', {
      requestId,
      error: err.message,
      code: err.code,
      // Never log the cause stack trace
    });

    res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database temporarily unavailable. Please retry.',
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  // Unexpected errors - log but don't leak details
  logger.error('Unexpected error in value cases API', {
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
 * POST /api/v1/cases
 * Create a new value case
 */
async function createCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  try {
    const repository = getValueCasesRepository();
    const valueCase = await repository.create(
      authReq.tenantId!,
      authReq.user!.id,
      req.body
    );

    res.status(201).json({
      data: valueCase,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/cases
 * List value cases with pagination
 */
async function listCases(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  try {
    const repository = getValueCasesRepository();
    const result = await repository.list(authReq.tenantId!, req.query as any);

    res.status(200).json({
      ...result,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/cases/:caseId
 * Get a single value case
 */
async function getCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;

  try {
    const repository = getValueCasesRepository();
    const valueCase = await repository.getById(authReq.tenantId!, caseId);

    res.status(200).json({
      data: valueCase,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/cases/:caseId
 * Update a value case
 */
async function updateCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;

  try {
    const repository = getValueCasesRepository();
    const valueCase = await repository.update(authReq.tenantId!, caseId, req.body);

    res.status(200).json({
      data: valueCase,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/cases/:caseId
 * Delete a value case
 */
async function deleteCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;

  try {
    const repository = getValueCasesRepository();
    await repository.delete(authReq.tenantId!, caseId);

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
router.use(tenantContextMiddleware(), tenantDbContextMiddleware());

// POST /cases - Create
router.post(
  '/',
  strictLimiter,
  requireRole(['admin', 'member']),
  validateBody(CreateValueCaseSchema),
  createCase
);

// GET /cases - List
router.get(
  '/',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateQuery(ListValueCasesQuerySchema),
  listCases
);

// GET /cases/:caseId - Get one
router.get(
  '/:caseId',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateUuidParam('caseId'),
  getCase
);

// PATCH /cases/:caseId - Update
router.patch(
  '/:caseId',
  standardLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  validateBody(UpdateValueCaseSchema),
  updateCase
);

// DELETE /cases/:caseId - Delete
router.delete(
  '/:caseId',
  strictLimiter,
  requireRole(['admin']),
  validateUuidParam('caseId'),
  deleteCase
);

// Error handler
router.use(handleError);

export default router;
export { router as valueCasesRouter };
