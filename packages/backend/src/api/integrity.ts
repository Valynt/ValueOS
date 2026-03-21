/**
 * Integrity API Routes — Sprint 54
 *
 * GET  /api/v1/cases/:caseId/integrity
 *   Returns the current integrity score, all open violations, and block state.
 *
 * POST /api/v1/cases/:caseId/integrity/resolve/:id
 *   Resolves a violation via RE_EVALUATE (automated re-check) or DISMISS
 *   (human override with reason_code + comment).
 *
 * Both endpoints require authentication and tenant context.
 * All queries are scoped to organization_id (tenant isolation).
 */

import { Router, type NextFunction, type Request, type Response } from "express"; // eslint-disable-line sort-imports
import { z } from "zod";

import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { tenantDbContextMiddleware } from "../middleware/tenantDbContext.js";
import { createRateLimiter, RateLimitTier } from "../middleware/rateLimiter.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  NonDismissableViolationError,
  valueIntegrityService,
} from "../services/integrity/ValueIntegrityService.js";

const router = Router({ mergeParams: true });

const standardLimiter = createRateLimiter(RateLimitTier.STANDARD);
const strictLimiter = createRateLimiter(RateLimitTier.STRICT);

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const ResolveViolationBodySchema = z
  .object({
    resolution_type: z.enum(["RE_EVALUATE", "DISMISS"]),
    reason_code: z.string().min(1).optional(),
    comment: z.string().min(1).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.resolution_type === "DISMISS") {
      if (!val.reason_code) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "reason_code is required for DISMISS resolution",
          path: ["reason_code"],
        });
      }
      if (!val.comment) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "comment is required for DISMISS resolution",
          path: ["comment"],
        });
      }
    }
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOrganizationId(req: Request): string | undefined {
  const authReq = req as AuthenticatedRequest;
  return authReq.tenantId ?? authReq.organizationId;
}

function getAccessToken(req: Request): string {
  return req.headers.authorization?.replace("Bearer ", "") ?? "";
}

// ---------------------------------------------------------------------------
// GET /api/v1/cases/:caseId/integrity
// ---------------------------------------------------------------------------

router.get(
  "/:caseId/integrity",
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  standardLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { caseId } = req.params as { caseId: string };
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      res.status(401).json({ error: "Missing tenant context" });
      return;
    }

    try {
      const accessToken = getAccessToken(req);

      // Fetch current integrity score from business_cases
      const client = req.supabase;
      if (!client) {
        res.status(500).json({ error: "Database client unavailable" });
        return;
      }

      const { data: caseRow, error: caseError } = await client
        .from("business_cases")
        .select("integrity_score, defense_readiness_score")
        .eq("id", caseId)
        .eq("organization_id", organizationId)
        .single();

      if (caseError) {
        // PGRST116 = "no rows returned" — genuine not-found.
        // Any other code is a DB/infrastructure error.
        if ((caseError as { code?: string }).code === "PGRST116") {
          res.status(404).json({ error: "Case not found" });
        } else {
          logger.error("integrity GET: failed to fetch business case", caseError);
          res.status(500).json({ error: "Failed to fetch case" });
        }
        return;
      }

      const row = caseRow as {
        integrity_score: number | null;
        defense_readiness_score: number | null;
      };

      // Fetch all open violations
      const { data: violations, error: vivError } = await client
        .from("value_integrity_violations")
        .select("*")
        .eq("case_id", caseId)
        .eq("organization_id", organizationId)
        .eq("status", "OPEN");

      if (vivError) {
        logger.error("integrity GET: failed to fetch violations", vivError);
        res.status(500).json({ error: "Failed to fetch violations" });
        return;
      }

      const allViolations = violations ?? [];
      const criticals = allViolations.filter(
        (v: { severity: string }) => v.severity === "critical",
      );
      const warnings = allViolations.filter(
        (v: { severity: string }) => v.severity === "warning",
      );

      res.json({
        integrity_score: row.integrity_score ?? null,
        defense_readiness_score: row.defense_readiness_score ?? null,
        violations: allViolations,
        hard_blocked: criticals.length > 0,
        soft_warnings: warnings,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/v1/cases/:caseId/integrity/resolve/:id
// ---------------------------------------------------------------------------

router.post(
  "/:caseId/integrity/resolve/:violationId",
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  strictLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { caseId, violationId } = req.params as {
      caseId: string;
      violationId: string;
    };
    const organizationId = getOrganizationId(req);
    const authReq = req as AuthenticatedRequest;

    if (!organizationId) {
      res.status(401).json({ error: "Missing tenant context" });
      return;
    }

    const parsed = ResolveViolationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "InvalidRequest",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { resolution_type, reason_code, comment } = parsed.data;
    const resolvedBy = authReq.userId ?? authReq.user?.id ?? "unknown";

    try {
      const accessToken = getAccessToken(req);

      const updated = await valueIntegrityService.resolveViolation(
        violationId,
        organizationId,
        accessToken,
        { resolution_type, resolved_by: resolvedBy, reason_code, comment },
      );

      // Recompute integrity score after resolution
      try {
        await valueIntegrityService.recomputeScore(
          caseId,
          organizationId,
          accessToken,
        );
      } catch (scoreErr) {
        logger.warn("integrity resolve: score recompute failed", {
          caseId,
          error: scoreErr instanceof Error ? scoreErr.message : String(scoreErr),
        });
      }

      res.json({ data: updated });
    } catch (err) {
      if (err instanceof NonDismissableViolationError) {
        res.status(422).json({
          error: "NonDismissableViolation",
          message: err.message,
          violation_type: err.violationType,
        });
        return;
      }
      if (err instanceof Error && err.message.includes("not found")) {
        res.status(404).json({ error: "Violation not found" });
        return;
      }
      next(err);
    }
  },
);

export { router as integrityRouter };
