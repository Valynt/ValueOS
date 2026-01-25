import { Router, Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { v4 as uuidv4 } from "uuid";
import type { PoolClient } from "pg";
import {
  CreateInitiativeSchema,
  UpdateInitiativeSchema,
  ListInitiativesQuerySchema,
  ApiErrorResponse,
} from "./types";
import { InitiativesService } from "./service";
import {
  DbConflictError,
  DbForbiddenError,
  DbNotFoundError,
  DbUnauthorizedError,
  DbValidationError,
  TransientDbError,
} from "../../lib/db/errors";
import { createRateLimiter, RateLimitTier } from "../../middleware/rateLimiter";
import { logger } from "../../lib/logger";

const router = Router();

const standardLimiter = createRateLimiter(RateLimitTier.STANDARD);
const strictLimiter = createRateLimiter(RateLimitTier.STRICT);

type TenantDbContext = {
  client: PoolClient;
  query: PoolClient["query"];
};

type AuthedRequest = Request & {
  tenantId?: string;
  user?: { id?: string };
  db?: TenantDbContext;
  correlationId?: string;
};

const correlationId = (req: Request, _res: Response, next: NextFunction) => {
  (req as AuthedRequest).correlationId =
    (req.headers["x-correlation-id"] as string) || `req-${uuidv4()}`;
  next();
};

const requireDb = (req: AuthedRequest): TenantDbContext => {
  if (!req.db) {
    throw new DbValidationError("Tenant database context unavailable");
  }
  return req.db;
};

const requireUser = (req: AuthedRequest): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new DbUnauthorizedError("User authentication required");
  }
  return userId;
};

const requireTenant = (req: AuthedRequest): string => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new DbForbiddenError("Tenant context required");
  }
  return tenantId;
};

const validateBody = <T>(schema: z.ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: { errors },
          requestId: (req as AuthedRequest).correlationId,
        } satisfies ApiErrorResponse);
        return;
      }
      next(error);
    }
  };

const validateQuery = <T>(schema: z.ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as unknown as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: { errors },
          requestId: (req as AuthedRequest).correlationId,
        } satisfies ApiErrorResponse);
        return;
      }
      next(error);
    }
  };

const validateUuidParam = (paramName: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!value || !uuidRegex.test(value)) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: `Invalid ${paramName}: must be a valid UUID`,
        requestId: (req as AuthedRequest).correlationId,
      } satisfies ApiErrorResponse);
      return;
    }
    next();
  };

const handleError = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = (req as AuthedRequest).correlationId;

  if (error instanceof DbValidationError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: error.message,
      details: error.details,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (error instanceof DbNotFoundError) {
    res.status(404).json({
      error: "NOT_FOUND",
      message: error.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (error instanceof DbConflictError) {
    res.status(409).json({
      error: "CONFLICT",
      message: error.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (error instanceof DbUnauthorizedError) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: error.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (error instanceof DbForbiddenError) {
    res.status(403).json({
      error: "FORBIDDEN",
      message: error.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (error instanceof TransientDbError) {
    res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message: error.message,
      details: { retryAfterMs: error.retryAfterMs },
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  logger.error("Unhandled initiative error", error instanceof Error ? error : undefined);
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    requestId,
  } satisfies ApiErrorResponse);
};

router.use(correlationId);

router.post(
  "/",
  strictLimiter,
  validateBody(CreateInitiativeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authed = req as AuthedRequest;
      const tenantId = requireTenant(authed);
      const userId = requireUser(authed);
      const db = requireDb(authed);
      const service = new InitiativesService(db);
      const headerKey = req.headers["idempotency-key"];
      const idempotencyKey = Array.isArray(headerKey) ? headerKey[0] : headerKey;
      const initiative = await service.create(tenantId, userId, {
        ...authed.body,
        idempotencyKey: idempotencyKey ?? authed.body.idempotencyKey,
      });

      res.status(201).json({ initiative, requestId: authed.correlationId });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/",
  standardLimiter,
  validateQuery(ListInitiativesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authed = req as AuthedRequest;
      const tenantId = requireTenant(authed);
      const db = requireDb(authed);
      const service = new InitiativesService(db);
      const result = await service.list(tenantId, authed.query);

      res.status(200).json({ ...result, requestId: authed.correlationId });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:initiativeId",
  standardLimiter,
  validateUuidParam("initiativeId"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authed = req as AuthedRequest;
      const tenantId = requireTenant(authed);
      const db = requireDb(authed);
      const service = new InitiativesService(db);
      const initiative = await service.getById(tenantId, req.params.initiativeId);

      res.status(200).json({ initiative, requestId: authed.correlationId });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/:initiativeId",
  strictLimiter,
  validateUuidParam("initiativeId"),
  validateBody(UpdateInitiativeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authed = req as AuthedRequest;
      const tenantId = requireTenant(authed);
      const userId = requireUser(authed);
      const db = requireDb(authed);
      const service = new InitiativesService(db);
      const initiative = await service.update(
        tenantId,
        userId,
        req.params.initiativeId,
        authed.body
      );

      res.status(200).json({ initiative, requestId: authed.correlationId });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:initiativeId",
  strictLimiter,
  validateUuidParam("initiativeId"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authed = req as AuthedRequest;
      const tenantId = requireTenant(authed);
      const userId = requireUser(authed);
      const db = requireDb(authed);
      const service = new InitiativesService(db);
      await service.remove(tenantId, userId, req.params.initiativeId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.use(handleError);

export default router;
