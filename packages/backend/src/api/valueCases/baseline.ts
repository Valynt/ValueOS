/**
 * Promise Baseline API Routes
 *
 * Endpoints for the promise baseline handoff feature:
 * - POST /api/v1/cases/:id/approve — approve case and create baseline
 * - GET /api/v1/cases/:id/baseline — retrieve baseline with details
 * - GET /api/v1/cases/:id/baseline/checkpoints — list checkpoints
 * - PATCH /api/v1/cases/:id/baseline/checkpoints/:checkpointId — adjust date
 */

import { Request, Response, Router } from "express";
import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { AuthenticatedRequest, requireAuth } from "../../middleware/auth.js";
import { rateLimiters } from "../../middleware/rateLimiter.js";
import { tenantContextMiddleware } from "../../middleware/tenantContext.js";
import { tenantDbContextMiddleware } from "../../middleware/tenantDbContext.js";
import { checkpointScheduler } from "../../services/handoff/CheckpointScheduler.js";
import { handoffNotesGenerator } from "../../services/handoff/HandoffNotesGenerator.js";
import { promiseBaselineService } from "../../services/handoff/PromiseBaselineService.js";

function getTenantId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  return (
    authReq.tenantId ??
    authReq.organizationId ??
    (authReq.user?.tenant_id as string | undefined) ??
    ""
  );
}

function getCaseId(req: Request): string {
  return (req.params as Record<string, string>)["id"] ?? "";
}

export const baselineRouter = Router({ mergeParams: true });

const auth = [
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
];

// POST /:id/approve — approve case with selected scenario and create baseline
baselineRouter.post(
  "/:id/approve",
  rateLimiters.strict,
  ...auth,
  async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const caseId = getCaseId(req);
    const userId = (req as AuthenticatedRequest).user?.id ?? "unknown";

    if (!tenantId) {
      return res
        .status(401)
        .json({ success: false, error: "Tenant context required" });
    }
    if (!caseId) {
      return res
        .status(400)
        .json({ success: false, error: "Case ID required" });
    }

    const ApproveBodySchema = z.object({
      scenario_id: z.string().uuid(),
      scenario_type: z.enum(["conservative", "base", "upside"]),
    }).strict();

    const parsed = ApproveBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const { scenario_id, scenario_type } = parsed.data;

    try {
      // Create baseline from approved scenario
      const baseline = await promiseBaselineService.createFromApprovedCase(tenantId, {
        case_id: caseId,
        scenario_id,
        scenario_type,
        user_id: userId,
      });

      // Generate checkpoints for all KPI targets
      await checkpointScheduler.generateCheckpointsForBaseline(baseline.id, tenantId);

      // Generate handoff notes
      await handoffNotesGenerator.generateHandoffNotes(baseline.id, tenantId);

      logger.info("Case approved and baseline created", {
        caseId,
        baselineId: baseline.id,
        tenantId,
        userId,
      });

      return res.status(200).json({
        success: true,
        data: {
          baseline,
          message: "Case approved. Baseline created with checkpoints and handoff notes.",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Case approval failed", { caseId, tenantId, error: message });
      return res.status(500).json({ success: false, error: message });
    }
  }
);

// GET /:id/baseline — retrieve promise baseline for case
baselineRouter.get(
  "/:id/baseline",
  ...auth,
  async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const caseId = getCaseId(req);

    if (!tenantId) {
      return res
        .status(401)
        .json({ success: false, error: "Tenant context required" });
    }
    if (!caseId) {
      return res
        .status(400)
        .json({ success: false, error: "Case ID required" });
    }

    try {
      const baseline = await promiseBaselineService.getActiveBaselineForCase(caseId, tenantId);
      if (!baseline) {
        return res.status(404).json({
          success: false,
          error: "No baseline found for this case",
        });
      }

      // Get full details with KPIs, checkpoints, and notes
      const details = await promiseBaselineService.getBaseline(baseline.id, tenantId);

      return res.status(200).json({ success: true, data: details });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Get baseline failed", { caseId, tenantId, error: message });
      return res.status(500).json({ success: false, error: message });
    }
  }
);

// GET /:id/baseline/checkpoints — list checkpoints for case baseline
baselineRouter.get(
  "/:id/baseline/checkpoints",
  ...auth,
  async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const caseId = getCaseId(req);

    if (!tenantId) {
      return res
        .status(401)
        .json({ success: false, error: "Tenant context required" });
    }
    if (!caseId) {
      return res
        .status(400)
        .json({ success: false, error: "Case ID required" });
    }

    try {
      const baseline = await promiseBaselineService.getActiveBaselineForCase(caseId, tenantId);
      if (!baseline) {
        return res.status(404).json({
          success: false,
          error: "No baseline found for this case",
        });
      }

      const checkpoints = await checkpointScheduler.getUpcomingCheckpoints(
        baseline.id,
        tenantId,
        365 // All checkpoints for the year
      );

      return res.status(200).json({ success: true, data: checkpoints });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Get checkpoints failed", { caseId, tenantId, error: message });
      return res.status(500).json({ success: false, error: message });
    }
  }
);

// PATCH /:id/baseline/checkpoints/:checkpointId — adjust checkpoint date
baselineRouter.patch(
  "/:id/baseline/checkpoints/:checkpointId",
  ...auth,
  async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const caseId = getCaseId(req);
    const { checkpointId } = req.params;

    if (!tenantId) {
      return res
        .status(401)
        .json({ success: false, error: "Tenant context required" });
    }
    if (!caseId || !checkpointId) {
      return res
        .status(400)
        .json({ success: false, error: "Case ID and checkpoint ID required" });
    }

    const UpdateCheckpointSchema = z.object({
      measurement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    }).strict();

    const parsed = UpdateCheckpointSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    try {
      await checkpointScheduler.adjustCheckpointDate(
        checkpointId,
        tenantId,
        parsed.data.measurement_date
      );

      return res.status(200).json({
        success: true,
        data: { message: "Checkpoint date adjusted" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Update checkpoint failed", { checkpointId, tenantId, error: message });
      return res.status(500).json({ success: false, error: message });
    }
  }
);

export default baselineRouter;
