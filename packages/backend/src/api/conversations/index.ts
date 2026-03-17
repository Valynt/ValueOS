/**
 * Conversations API Routes
 * 
 * Endpoints for conversation/message persistence.
 * Supports saving and loading agent chat sessions per case.
 */

import { NextFunction, Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z, ZodError } from 'zod';

import { logger } from "../../lib/logger.js";
import { requireAuth } from '../../middleware/auth.js'
import { createRateLimiter, RateLimitTier } from '../../middleware/rateLimiter.js'
import { requireRole } from '../../middleware/rbac.js'
import { tenantContextMiddleware } from '../../middleware/tenantContext.js'
import { tenantDbContextMiddleware } from '../../middleware/tenantDbContext.js'

import { 
  ConversationsRepository,
  DatabaseError,
  NotFoundError,
} from './repository';
import { 
  ApiErrorResponse,
  BatchCreateMessagesSchema,
  CreateMessageSchema,
  ListMessagesQuerySchema,
  SaveSessionSchema,
} from './types';

// ============================================================================
// Types
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: { id: string; role?: string };
  tenantId?: string;
  correlationId?: string;
}

// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

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
    logger.info('Conversations API request completed', {
      requestId: authReq.correlationId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs,
      tenantId: authReq.tenantId,
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

  if (err instanceof NotFoundError) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: err.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (err instanceof DatabaseError) {
    logger.error('Database error in conversations API', {
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

  logger.error('Unexpected error in conversations API', {
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
 * POST /api/v1/conversations/messages
 * Create a single message
 */
async function createMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  try {
    const repository = ConversationsRepository.fromRequest(req);
    const message = await repository.create(
      authReq.tenantId || 'default',
      authReq.user?.id || 'anonymous',
      req.body
    );

    res.status(201).json({
      data: message,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/conversations/messages/batch
 * Create multiple messages at once
 */
async function createMessagesBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  try {
    const repository = ConversationsRepository.fromRequest(req);
    const { caseId, workflowId, messages } = req.body;
    
    const created = await repository.createBatch(
      authReq.tenantId || 'default',
      authReq.user?.id || 'anonymous',
      caseId,
      workflowId,
      messages
    );

    res.status(201).json({
      data: created,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/conversations/messages
 * List messages for a case
 */
async function listMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  try {
    const repository = ConversationsRepository.fromRequest(req);
    const messages = await repository.getByCase(
      authReq.tenantId || 'default',
      ListMessagesQuerySchema.parse(req.query)
    );

    res.status(200).json({
      data: messages,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/conversations/session/:caseId
 * Load a conversation session for a case
 */
async function loadSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;

  try {
    const repository = ConversationsRepository.fromRequest(req);
    const session = await repository.loadSession(
      authReq.tenantId || 'default',
      caseId
    );

    res.status(200).json({
      data: session,
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/conversations/session/:caseId
 * Save a conversation session (replaces existing messages)
 */
async function saveSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;

  try {
    const repository = ConversationsRepository.fromRequest(req);
    const { messages } = req.body;

    // Delete existing messages for this case
    await repository.deleteByCase(authReq.tenantId || 'default', caseId);

    // Create new messages
    const messagesToCreate = messages.map((msg: Record<string, unknown>) => ({
      role: msg.role === 'agent' ? 'assistant' : msg.role, // Map 'agent' to 'assistant'
      content: msg.content,
      metadata: msg.metadata,
      timestamp: msg.timestamp,
    }));

    const created = await repository.createBatch(
      authReq.tenantId || 'default',
      authReq.user?.id || 'anonymous',
      caseId,
      undefined,
      messagesToCreate
    );

    res.status(200).json({
      data: {
        caseId,
        messageCount: created.length,
        savedAt: new Date().toISOString(),
      },
      requestId: authReq.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/conversations/session/:caseId
 * Clear all messages for a case
 */
async function clearSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { caseId } = req.params;

  try {
    const repository = ConversationsRepository.fromRequest(req);
    const count = await repository.deleteByCase(authReq.tenantId || 'default', caseId);

    res.status(200).json({
      data: {
        caseId,
        deletedCount: count,
      },
      requestId: authReq.correlationId,
    });
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

// POST /messages - Create single message
router.post(
  '/messages',
  strictLimiter,
  requireRole(['admin', 'member']),
  validateBody(CreateMessageSchema),
  createMessage
);

// POST /messages/batch - Create multiple messages
router.post(
  '/messages/batch',
  strictLimiter,
  requireRole(['admin', 'member']),
  validateBody(BatchCreateMessagesSchema),
  createMessagesBatch
);

// GET /messages - List messages
router.get(
  '/messages',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateQuery(ListMessagesQuerySchema),
  listMessages
);

// GET /session/:caseId - Load session
router.get(
  '/session/:caseId',
  standardLimiter,
  requireRole(['admin', 'member', 'viewer']),
  validateUuidParam('caseId'),
  loadSession
);

// POST /session/:caseId - Save session
router.post(
  '/session/:caseId',
  strictLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  validateBody(SaveSessionSchema),
  saveSession
);

// DELETE /session/:caseId - Clear session
router.delete(
  '/session/:caseId',
  strictLimiter,
  requireRole(['admin', 'member']),
  validateUuidParam('caseId'),
  clearSession
);

// Error handler
router.use(handleError);

export default router;
export { router as conversationsRouter };
