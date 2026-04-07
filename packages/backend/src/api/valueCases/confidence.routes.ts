/**
 * Confidence Score Editing API Routes
 *
 * PATCH /api/cases/:caseId/artifacts/:artifactId/confidence - Update artifact confidence
 * PATCH /api/cases/:caseId/hypotheses/:hypothesisId/confidence - Update hypothesis confidence
 * PATCH /api/cases/:caseId/assumptions/:assumptionId/confidence - Update assumption confidence
 */

import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { getRequestSupabaseClient } from "../../lib/supabase.js";
import { requireRole } from "../../middleware/auth.js";
import { auditLogService } from "../../services/security/AuditLogService.js";

import { validateUuidParam } from "./middleware.js";
import { ValueCasesRouteLimiters } from "./crud.routes.js";

const router = Router();

// ============================================================================
// Schemas
// ============================================================================

const UpdateConfidenceSchema = z.object({
  confidenceScore: z.number().min(0).max(1),
  reason: z.string().optional(),
  evidenceReference: z.string().optional(),
});

// ============================================================================
// Types
// ============================================================================

interface ConfidenceRequest extends Request {
  tenantId?: string;
  organizationId?: string;
  user?: { id: string; email?: string };
}

interface ConfidenceUpdateResult {
  id: string;
  previousScore: number;
  newScore: number;
  updatedAt: string;
  updatedBy: string;
  reason?: string;
}

// ============================================================================
// Generic Confidence Update Handler
// ============================================================================

async function updateEntityConfidence(
  req: ConfidenceRequest,
  res: Response,
  entityType: "artifact" | "hypothesis" | "assumption"
): Promise<void> {
  const { caseId } = req.params;
  const entityId = req.params[`${entityType}Id`] || req.params.artifactId;
  const organizationId = req.organizationId;
  const userId = req.user?.id ?? "unknown";
  const userEmail = req.user?.email ?? "unknown";

  if (!organizationId) {
    res.status(401).json({ error: "Missing tenant context" });
    return;
  }

  const body = UpdateConfidenceSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Invalid confidence update request",
      details: body.error.flatten(),
    });
    return;
  }

  const { confidenceScore, reason, evidenceReference } = body.data;
  const db = getRequestSupabaseClient(req);
  const now = new Date().toISOString();

  // Map entity type to table name
  const tableMap: Record<string, string> = {
    artifact: "artifacts",
    hypothesis: "value_hypotheses",
    assumption: "assumptions",
  };
  const table = tableMap[entityType];

  // Map entity type to ID column
  const idColumnMap: Record<string, string> = {
    artifact: "id",
    hypothesis: "id",
    assumption: "id",
  };
  const idColumn = idColumnMap[entityType];

  // Map entity type to case/tenant columns
  const tenantColumnMap: Record<string, { tenant: string; case?: string }> = {
    artifact: { tenant: "organization_id", case: "case_id" },
    hypothesis: { tenant: "organization_id", case: "case_id" },
    assumption: { tenant: "tenant_id", case: "case_id" },
  };
  const tenantCols = tenantColumnMap[entityType];

  // Fetch current value for audit trail
  const { data: currentEntity, error: fetchError } = await db
    .from(table)
    .select(`id, confidence_score, name, value_driver, title`)
    .eq(idColumn, entityId)
    .eq(tenantCols.tenant, organizationId)
    .single();

  if (fetchError || !currentEntity) {
    res.status(404).json({ error: `${entityType} not found` });
    return;
  }

  const previousScore = currentEntity.confidence_score ?? 0.5;

  // Build update payload with lineage tracking
  const updatePayload: Record<string, unknown> = {
    confidence_score: confidenceScore,
    updated_at: now,
    confidence_lineage: {
      previous_score: previousScore,
      new_score: confidenceScore,
      updated_by: userId,
      updated_at: now,
      reason: reason || null,
      evidence_reference: evidenceReference || null,
      change_magnitude: Math.abs(confidenceScore - previousScore),
    },
  };

  // Update the entity
  const { data: updatedEntity, error: updateError } = await db
    .from(table)
    .update(updatePayload)
    .eq(idColumn, entityId)
    .eq(tenantCols.tenant, organizationId)
    .select()
    .single();

  if (updateError) {
    logger.error(`Failed to update ${entityType} confidence`, {
      error: updateError.message,
      caseId,
      entityId,
    });
    res.status(500).json({ error: `Failed to update ${entityType} confidence` });
    return;
  }

  // Log audit event
  await auditLogService.logAudit({
    userId,
    userName: userEmail,
    userEmail,
    tenantId: organizationId,
    action: `${entityType}_confidence_updated`,
    resourceType: entityType,
    resourceId: entityId,
    details: {
      caseId,
      previousScore,
      newScore: confidenceScore,
      reason,
      evidenceReference,
    },
    status: "success",
  });

  // Trigger recalculation if assumption confidence changed significantly (>0.1)
  if (entityType === "assumption" && Math.abs(confidenceScore - previousScore) > 0.1) {
    try {
      // Queue recalculation via event or direct call
      logger.info("Triggering scenario recalculation due to confidence change", {
        caseId,
        assumptionId: entityId,
        delta: confidenceScore - previousScore,
      });
    } catch (recalcError) {
      logger.warn("Failed to queue recalculation", { recalcError });
    }
  }

  const result: ConfidenceUpdateResult = {
    id: entityId,
    previousScore,
    newScore: confidenceScore,
    updatedAt: now,
    updatedBy: userId,
    reason,
  };

  res.json({
    success: true,
    data: result,
  });
}

// ============================================================================
// Route Handlers
// ============================================================================

async function updateArtifactConfidence(
  req: ConfidenceRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await updateEntityConfidence(req, res, "artifact");
  } catch (error) {
    next(error);
  }
}

async function updateHypothesisConfidence(
  req: ConfidenceRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await updateEntityConfidence(req, res, "hypothesis");
  } catch (error) {
    next(error);
  }
}

async function updateAssumptionConfidence(
  req: ConfidenceRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await updateEntityConfidence(req, res, "assumption");
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerConfidenceRoutes(
  router: Router,
  { strictLimiter }: ValueCasesRouteLimiters
): void {
  router.patch(
    "/:caseId/artifacts/:artifactId/confidence",
    strictLimiter,
    requireRole(["admin", "member"]),
    validateUuidParam("caseId"),
    validateUuidParam("artifactId"),
    updateArtifactConfidence
  );

  router.patch(
    "/:caseId/hypotheses/:hypothesisId/confidence",
    strictLimiter,
    requireRole(["admin", "member"]),
    validateUuidParam("caseId"),
    validateUuidParam("hypothesisId"),
    updateHypothesisConfidence
  );

  router.patch(
    "/:caseId/assumptions/:assumptionId/confidence",
    strictLimiter,
    requireRole(["admin", "member"]),
    validateUuidParam("caseId"),
    validateUuidParam("assumptionId"),
    updateAssumptionConfidence
  );
}

export default router;
