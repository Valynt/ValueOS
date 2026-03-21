/**
 * Reasoning Traces API Routes
 *
 * GET /api/v1/cases/:caseId/reasoning-traces  — paginated traces for a case
 * GET /api/v1/reasoning-traces/:traceId       — single trace by ID
 *
 * Both endpoints are tenant-scoped: organization_id is derived from the
 * authenticated JWT via tenantContextMiddleware. RLS enforces isolation at
 * the DB layer; the repository also filters explicitly.
 *
 * Sprint 52.
 */

import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";

import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { reasoningTraceRepository } from "../repositories/ReasoningTraceRepository.js";

const router = Router();

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// GET /api/v1/cases/:caseId/reasoning-traces
// ---------------------------------------------------------------------------

router.get(
  "/cases/:caseId/reasoning-traces",
  requireAuth,
  tenantContextMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { caseId } = req.params;
      const organizationId = req.tenantId;

      if (!organizationId) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Tenant context missing" } });
        return;
      }

      const queryParsed = PaginationQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        res.status(400).json({
          error: { code: "INVALID_QUERY", message: "Invalid pagination parameters" },
        });
        return;
      }

      const { page, pageSize } = queryParsed.data;

      const result = await reasoningTraceRepository.findByCaseId({
        caseId,
        organizationId,
        page,
        pageSize,
      });

      res.json({
        data: result.rows,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        },
      });
    } catch (err) {
      logger.error("GET /cases/:caseId/reasoning-traces failed", {
        caseId: req.params.caseId,
        error: err instanceof Error ? err.message : String(err),
      });
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/reasoning-traces/:traceId
// ---------------------------------------------------------------------------

router.get(
  "/reasoning-traces/:traceId",
  requireAuth,
  tenantContextMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { traceId } = req.params;
      const organizationId = req.tenantId;

      if (!organizationId) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Tenant context missing" } });
        return;
      }

      const trace = await reasoningTraceRepository.findById(traceId, organizationId);

      if (!trace) {
        res.status(404).json({
          error: { code: "NOT_FOUND", message: "Reasoning trace not found" },
        });
        return;
      }

      res.json({ data: trace });
    } catch (err) {
      logger.error("GET /reasoning-traces/:traceId failed", {
        traceId: req.params.traceId,
        error: err instanceof Error ? err.message : String(err),
      });
      next(err);
    }
  }
);

export { router as reasoningTracesRouter };
