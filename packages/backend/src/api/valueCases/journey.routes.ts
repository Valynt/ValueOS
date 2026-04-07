/**
 * Journey Routes for Value Cases
 *
 * GET /api/cases/:caseId/journey - Fetch current journey orchestration state
 * POST /api/cases/:caseId/hypotheses/:hypothesisId/promote - Promote hypothesis to assumption
 */

import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

import { logger } from "../../lib/logger.js";
import { getRequestSupabaseClient } from "../../lib/supabase.js";
import { requireRole } from "../../middleware/auth.js";
import { JourneyOrchestrator } from "../../services/bridging/JourneyOrchestrator.js";
import { getArtifactTransformerRegistry } from "../../services/bridging/ArtifactTransformer.js";
import { DEFAULT_EXPERIENCE_MODEL } from "@valueos/sdui";
import { FinancialModelSnapshotRepository } from "../../repositories/FinancialModelSnapshotRepository.js";
import { auditLogService } from "../../services/security/AuditLogService.js";

import { validateUuidParam } from "./middleware.js";
import { ValueCasesRouteLimiters } from "./crud.routes.js";

const router = Router();

// ============================================================================
// GET /api/cases/:caseId/journey
// ============================================================================

interface JourneyRequest extends Request {
  tenantId?: string;
  organizationId?: string;
  user?: { id: string; email?: string };
}

async function getJourneyState(
  req: JourneyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { caseId } = req.params;
    const organizationId = req.organizationId;
    const userId = req.user?.id ?? "unknown";

    if (!organizationId) {
      res.status(401).json({ error: "Missing tenant context" });
      return;
    }

    // Fetch case data from database
    const db = getRequestSupabaseClient(req);
    const { data: caseData, error: caseError } = await db
      .from("value_cases")
      .select("id, status, lifecycle_stage, saga_state, workflow_status, confidence_score, opportunity_id")
      .eq("id", caseId)
      .eq("organization_id", organizationId)
      .single();

    if (caseError || !caseData) {
      logger.warn("Journey state fetch failed: case not found", {
        caseId,
        organizationId,
        error: caseError?.message,
      });
      res.status(404).json({ error: "Case not found" });
      return;
    }

    // Build decision context
    const decisionContext = {
      organization_id: organizationId,
      opportunity: {
        id: caseData.opportunity_id ?? caseId,
        lifecycle_stage: caseData.lifecycle_stage ?? "discovery",
        confidence_score: caseData.confidence_score ?? 0.5,
        value_maturity: computeValueMaturity(caseData.saga_state, caseData.confidence_score),
      },
      business_case: {
        id: caseId,
        status: mapSagaStateToBusinessCaseStatus(caseData.saga_state),
        assumptions_reviewed: caseData.workflow_status !== "waiting_approval",
      },
      is_external_artifact_action: false,
    };

    // Initialize orchestrator
    const orchestrator = new JourneyOrchestrator(
      DEFAULT_EXPERIENCE_MODEL,
      getArtifactTransformerRegistry()
    );

    // Execute orchestration
    const output = await orchestrator.orchestrate({
      decision_context: decisionContext as never,
      saga_state: caseData.saga_state ?? "INITIATED",
      workflow_status: caseData.workflow_status ?? "pending",
      confidence_score: caseData.confidence_score ?? 0.5,
      active_interrupts: [],
      value_case_id: caseId,
      session_id: uuidv4(),
    });

    // Return journey state
    res.json({
      success: true,
      data: {
        phase: {
          id: output.phase.lifecycle_stage,
          label: output.phase.label,
          description: output.phase.description,
          userGoal: output.phase.user_goal,
          canLock: output.can_lock,
          experienceMode: output.phase.experience_mode,
          workspaceTitle: output.phase.workspace_title,
          supportsBoardReadyLock: output.phase.supports_board_ready_lock,
          artifactSlots: output.phase.artifact_slots.map((slot) => ({
            id: slot.id,
            label: slot.label,
            component: slot.component,
            region: slot.region,
            panelTitle: slot.panel_title,
            dataSource: slot.data_source,
            refreshOn: slot.refresh_on,
            badgeType: slot.badge_type,
          })),
          exitConditions: output.exit_conditions.map((ec) => ({
            id: ec.condition.id,
            description: ec.condition.description,
            passed: ec.passed,
            reason: ec.reason,
          })),
        },
        uiState: output.ui_state
          ? {
              label: output.ui_state.label,
              indicator: output.ui_state.indicator,
              userActionable: output.ui_state.user_actionable,
              cta: output.ui_state.cta,
              showConfidence: output.ui_state.show_confidence,
              activeAgent: output.ui_state.active_agent_label,
            }
          : null,
        availableActions: output.phase.allowed_actions.map((action) => ({
          id: action.id,
          label: action.label,
          surface: action.surface,
          slashCommand: action.slash_command,
          requiresConfirmation: action.requires_confirmation,
          minConfidence: action.min_confidence,
        })),
        slashCommands: output.phase.allowed_actions
          .filter((a) => a.surface === "slash_command")
          .map((a) => ({
            command: a.slash_command,
            label: a.label,
          })),
        pageSections: output.page_sections,
        workspaceRegions: output.workspace_regions,
        workspaceHeader: output.workspace_header,
        activeInterrupts: output.active_interrupts,
        trustThresholds: output.trust_thresholds,
        interactionMode: output.interaction_mode,
      },
    });
  } catch (error) {
    logger.error("Failed to get journey state", {
      error: error instanceof Error ? error.message : String(error),
      caseId: req.params.caseId,
    });
    next(error);
  }
}

// ============================================================================
// POST /api/cases/:caseId/hypotheses/:hypothesisId/promote
// ============================================================================

const PromoteHypothesisSchema = z.object({
  value: z.number().optional(),
  unit: z.string().default("USD"),
  sourceType: z.enum([
    "customer-confirmed",
    "CRM-derived",
    "call-derived",
    "note-derived",
    "benchmark-derived",
    "externally-researched",
    "inferred",
    "manually-overridden",
  ]).default("inferred"),
});

async function promoteHypothesisToAssumption(
  req: JourneyRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { caseId, hypothesisId } = req.params;
    const organizationId = req.organizationId;
    const userId = req.user?.id ?? "unknown";
    const userEmail = req.user?.email ?? "unknown";

    if (!organizationId) {
      res.status(401).json({ error: "Missing tenant context" });
      return;
    }

    const body = PromoteHypothesisSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid promotion request",
        details: body.error.flatten(),
      });
      return;
    }

    const db = getRequestSupabaseClient(req);

    // Fetch the hypothesis
    const { data: hypothesis, error: hypothesisError } = await db
      .from("value_hypotheses")
      .select("*")
      .eq("id", hypothesisId)
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .single();

    if (hypothesisError || !hypothesis) {
      res.status(404).json({ error: "Hypothesis not found" });
      return;
    }

    // Check if already promoted
    if (hypothesis.status === "promoted") {
      res.status(409).json({ error: "Hypothesis already promoted to assumption" });
      return;
    }

    // Determine source type based on hypothesis evidence
    let sourceType = body.data.sourceType;
    if (sourceType === "inferred") {
      // Map evidence tier to source type
      const evidenceTier = hypothesis.evidence_tier;
      if (evidenceTier === "tier1") {
        sourceType = "customer-confirmed";
      } else if (evidenceTier === "tier2") {
        sourceType = "benchmark-derived";
      } else {
        sourceType = "inferred";
      }
    }

    // Calculate value from impact range
    const impactMin = hypothesis.impact_range_min ?? 0;
    const impactMax = hypothesis.impact_range_max ?? impactMin;
    const value = body.data.value ?? (impactMin + impactMax) / 2;

    // Create the assumption
    const assumptionId = `asm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    const { data: assumption, error: insertError } = await db
      .from("assumptions")
      .insert({
        id: assumptionId,
        tenant_id: organizationId,
        case_id: caseId,
        name: hypothesis.name ?? "Untitled Assumption",
        description: hypothesis.description,
        value: value,
        unit: body.data.unit,
        source_type: sourceType,
        confidence_score: hypothesis.confidence_score ?? 0.5,
        source_confidence: hypothesis.evidence_tier === "tier1" ? 0.9 : hypothesis.evidence_tier === "tier2" ? 0.7 : 0.5,
        lineage: {
          hypothesis_id: hypothesisId,
          hypothesis_name: hypothesis.name,
          promoted_by: userId,
          promoted_at: now,
          evidence_tier: hypothesis.evidence_tier,
          impact_range: { min: impactMin, max: impactMax },
        },
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to create assumption from hypothesis", {
        error: insertError.message,
        caseId,
        hypothesisId,
      });
      res.status(500).json({ error: "Failed to create assumption" });
      return;
    }

    // Update hypothesis status to promoted
    const { error: updateError } = await db
      .from("value_hypotheses")
      .update({
        status: "promoted",
        promoted_to_assumption_id: assumptionId,
        updated_at: now,
      })
      .eq("id", hypothesisId)
      .eq("organization_id", organizationId);

    if (updateError) {
      logger.error("Failed to update hypothesis status", {
        error: updateError.message,
        caseId,
        hypothesisId,
      });
      // Don't fail the request, just log
    }

    // Log audit event
    await auditLogService.logAudit({
      userId,
      userName: userEmail,
      userEmail,
      tenantId: organizationId,
      action: "hypothesis_promoted_to_assumption",
      resourceType: "assumption",
      resourceId: assumptionId,
      details: {
        caseId,
        hypothesisId,
        assumptionId,
        sourceType,
        value,
      },
      status: "success",
    });

    // Invalidate scenario cache to trigger recalculation
    try {
      const repo = new FinancialModelSnapshotRepository(db);
      const latestSnapshot = await repo.getLatestSnapshotForCase(caseId, organizationId);
      if (latestSnapshot) {
        // Create new snapshot with updated assumptions
        const existingAssumptions = (latestSnapshot.assumptions_json as Array<Record<string, unknown>>) ?? [];
        const newAssumptionRecord = {
          id: assumptionId,
          name: hypothesis.name ?? "Untitled Assumption",
          value: String(value),
          unit: body.data.unit,
          source: sourceType,
          confidence: hypothesis.confidence_score ?? 0.5,
          sensitivity_low: String(value * 0.8),
          sensitivity_high: String(value * 1.2),
          version: 1,
          updatedAt: now,
        };

        await repo.createSnapshot({
          case_id: caseId,
          organization_id: organizationId,
          roi: latestSnapshot.roi ?? undefined,
          npv: latestSnapshot.npv ?? undefined,
          payback_period_months: latestSnapshot.payback_period_months ?? undefined,
          assumptions_json: [...existingAssumptions, newAssumptionRecord],
          outputs_json: {
            ...(latestSnapshot.outputs_json as Record<string, unknown> ?? {}),
            new_assumption_added: assumptionId,
            recalc_triggered: true,
            promoted_from_hypothesis: hypothesisId,
          },
          source_agent: "manual",
        });
      }
    } catch (recalcError) {
      logger.warn("Failed to invalidate scenario cache", {
        error: recalcError instanceof Error ? recalcError.message : String(recalcError),
        caseId,
        assumptionId,
      });
      // Don't fail the request if recalc fails
    }

    res.status(201).json({
      success: true,
      data: {
        assumption: {
          id: assumptionId,
          name: assumption.name,
          value: assumption.value,
          unit: assumption.unit,
          source: sourceType,
          confidenceScore: assumption.confidence_score,
          lineage: assumption.lineage,
        },
        hypothesis: {
          id: hypothesisId,
          status: "promoted",
          promotedToAssumptionId: assumptionId,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to promote hypothesis", {
      error: error instanceof Error ? error.message : String(error),
      caseId: req.params.caseId,
      hypothesisId: req.params.hypothesisId,
    });
    next(error);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapSagaStateToBusinessCaseStatus(
  sagaState: string | null
): "draft" | "in_review" | "approved" | "presented" | "archived" {
  const mapping: Record<string, "draft" | "in_review" | "approved" | "presented" | "archived"> = {
    INITIATED: "draft",
    DRAFTING: "draft",
    VALIDATING: "in_review",
    COMPOSING: "in_review",
    REFINING: "in_review",
    FINALIZED: "approved",
  };
  return mapping[sagaState ?? ""] ?? "draft";
}

function computeValueMaturity(
  sagaState: string | null,
  confidenceScore: number | null
): "low" | "medium" | "high" {
  if (sagaState === "FINALIZED" && (confidenceScore ?? 0) >= 0.75) return "high";
  if (
    ["COMPOSING", "REFINING", "FINALIZED"].includes(sagaState ?? "") &&
    (confidenceScore ?? 0) >= 0.5
  )
    return "medium";
  return "low";
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerJourneyRoutes(
  router: Router,
  { standardLimiter, strictLimiter }: ValueCasesRouteLimiters
): void {
  router.get(
    "/:caseId/journey",
    standardLimiter,
    requireRole(["admin", "member"]),
    validateUuidParam("caseId"),
    getJourneyState
  );

  router.post(
    "/:caseId/hypotheses/:hypothesisId/promote",
    strictLimiter,
    requireRole(["admin", "member"]),
    validateUuidParam("caseId"),
    validateUuidParam("hypothesisId"),
    promoteHypothesisToAssumption
  );
}

export default router;
