/**
 * Notifications API
 *
 * GET  /api/v1/notifications          — list for authenticated user
 * PATCH /api/v1/notifications/:id/read — mark one as read
 * POST  /api/v1/notifications/read-all — mark all as read
 *
 * All routes require auth + tenant context. organizationId is resolved from
 * the tenant context middleware (req.tenantId).
 */

import { NextFunction, Request, Response, Router } from "express";
import { z, ZodError } from "zod";

import { logger } from "../lib/logger.js";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { getNotificationService } from "../services/messaging/NotificationService.js";

const router = Router();

router.use(requireAuth);
router.use(tenantContextMiddleware());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveOrgId(req: AuthenticatedRequest): string | null {
  return (
    req.tenantId ??
    (req.user?.tenant_id as string | undefined) ??
    null
  );
}

function resolveUserId(req: AuthenticatedRequest): string | null {
  return req.user?.id ?? null;
}

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string
): void {
  res.status(status).json({ error: code, message });
}

// ---------------------------------------------------------------------------
// GET /api/v1/notifications
// ---------------------------------------------------------------------------

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  const organizationId = resolveOrgId(authReq);
  const userId = resolveUserId(authReq);

  if (!organizationId || !userId) {
    sendError(res, 403, "TENANT_REQUIRED", "Tenant context missing");
    return;
  }

  const limitRaw = req.query.limit;
  const limitParsed = parseInt(String(limitRaw ?? ""), 10);
  const limit = Number.isFinite(limitParsed) && limitParsed > 0
    ? Math.min(limitParsed, 100)
    : 50;

  try {
    const notifications = await getNotificationService().listForUser(
      organizationId,
      userId,
      limit
    );
    res.json({ data: notifications });
  } catch (err) {
    logger.error("GET /notifications failed", {
      organizationId,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/notifications/:id/read
// ---------------------------------------------------------------------------

const IdParamSchema = z.object({ id: z.string().uuid() });

router.patch(
  "/:id/read",
  async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = resolveOrgId(authReq);
    const userId = resolveUserId(authReq);

    if (!organizationId || !userId) {
      sendError(res, 403, "TENANT_REQUIRED", "Tenant context missing");
      return;
    }

    let id: string;
    try {
      ({ id } = IdParamSchema.parse(req.params));
    } catch (err) {
      if (err instanceof ZodError) {
        sendError(res, 400, "INVALID_ID", "id must be a valid UUID");
        return;
      }
      next(err);
      return;
    }

    try {
      await getNotificationService().markRead(id, organizationId, userId);
      res.status(204).end();
    } catch (err) {
      logger.error("PATCH /notifications/:id/read failed", {
        id,
        organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/notifications/read-all
// ---------------------------------------------------------------------------

router.post(
  "/read-all",
  async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const organizationId = resolveOrgId(authReq);
    const userId = resolveUserId(authReq);

    if (!organizationId || !userId) {
      sendError(res, 403, "TENANT_REQUIRED", "Tenant context missing");
      return;
    }

    try {
      await getNotificationService().markAllRead(organizationId, userId);
      res.status(204).end();
    } catch (err) {
      logger.error("POST /notifications/read-all failed", {
        organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
      next(err);
    }
  }
);

export default router;
