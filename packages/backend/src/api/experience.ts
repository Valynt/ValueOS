/**
 * Experience API — JourneyOrchestrator Endpoint
 *
 * POST /api/v1/experience/orchestrate
 *
 * Consumes DecisionContext + current backend state, produces SDUIPageDefinition
 * for the Co-Pilot experience. This is the runtime bridge between backend agent
 * state and the user-perceivable UI.
 *
 * Sprint 55: Phase 2 implementation.
 */

import { randomBytes } from "crypto";

import { logger } from "@shared/lib/logger";
import { Request, Response, Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { createBillingAccessEnforcement } from "../middleware/billingAccessEnforcement.js";
import { rateLimiters } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";
import { securityHeadersMiddleware } from "../middleware/securityMiddleware.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { tenantDbContextMiddleware } from "../middleware/tenantDbContext.js";
import { JourneyOrchestrator } from "../services/bridging/index.js";
import { getArtifactTransformerRegistry } from "../services/bridging/index.js";
import { DEFAULT_EXPERIENCE_MODEL } from "@valueos/sdui";

const router: Router = Router();

// Standard middleware stack for experience endpoints
router.use(securityHeadersMiddleware);
router.use(requireAuth);
router.use(tenantContextMiddleware());
router.use(tenantDbContextMiddleware());
router.use(createBillingAccessEnforcement());
router.use(requirePermission("agents:execute"));

// ── Request/Response Schemas ───────────────────────────────────────────

const OrchestrateRequestSchema = z.object({
  opportunity_id: z.string().uuid(),
  value_case_id: z.string().uuid(),
  session_id: z.string().uuid(),
  saga_state: z.enum([
    "INITIATED",
    "DRAFTING",
    "VALIDATING",
    "COMPOSING",
    "REFINING",
    "FINALIZED",
  ]),
  workflow_status: z.enum([
    "pending",
    "running",
    "completed",
    "failed",
    "cancelled",
    "paused",
    "rolled_back",
    "waiting_approval",
  ]),
  confidence_score: z.number().min(0).max(1).default(0.5),
  // Optional: pre-fetched interrupts from client
  client_interrupts: z
    .array(
      z.object({
        id: z.string().uuid(),
        type: z.string(),
        severity: z.enum(["high", "medium", "low"]),
        source_agent: z.string(),
        message: z.string(),
        target_id: z.string().uuid().optional(),
        resolution: z.string().nullable().optional(),
        created_at: z.string().datetime(),
      })
    )
    .default([]),
});

// ── Orchestrate Handler ────────────────────────────────────────────────

interface OrchestrateRequest extends Request {
  tenantId?: string;
}

async function orchestrateHandler(
  req: OrchestrateRequest,
  res: Response
): Promise<Response> {
  const tenantId = req.tenantId;
  const userId = req.user?.id ?? "api-user";

  if (!tenantId) {
    return res.status(401).json({
      error: "tenant_required",
      message: "Tenant context is required to orchestrate experience",
    });
  }

  const parseResult = OrchestrateRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "validation_error",
      message:
        parseResult.error.issues[0]?.message ??
        "Invalid orchestration request payload",
      details: parseResult.error.issues,
    });
  }

  const payload = parseResult.data;

  try {
    // Build DecisionContext from request + database
    // In production, this would query the database for full context
    const decisionContext = {
      organization_id: tenantId,
      opportunity: {
        id: payload.opportunity_id,
        lifecycle_stage: mapSagaStateToLifecycleStage(payload.saga_state),
        confidence_score: payload.confidence_score,
        value_maturity: computeValueMaturity(
          payload.saga_state,
          payload.confidence_score
        ),
      },
      hypothesis: undefined, // Would be populated from HypothesisRepository
      buying_committee: undefined, // Would be populated from StakeholderRepository
      business_case: {
        id: payload.value_case_id,
        status: mapSagaStateToBusinessCaseStatus(payload.saga_state),
        assumptions_reviewed: payload.workflow_status !== "waiting_approval",
      },
      is_external_artifact_action: ["composing", "refining"].includes(
        mapSagaStateToLifecycleStage(payload.saga_state)
      ),
    };

    // Initialize JourneyOrchestrator with singletons
    const orchestrator = new JourneyOrchestrator(
      DEFAULT_EXPERIENCE_MODEL,
      getArtifactTransformerRegistry()
    );

    // Execute orchestration
    const output = await orchestrator.orchestrate({
      decision_context: decisionContext as never,
      saga_state: payload.saga_state,
      workflow_status: payload.workflow_status,
      confidence_score: payload.confidence_score,
      active_interrupts: payload.client_interrupts as never,
      value_case_id: payload.value_case_id,
      session_id: payload.session_id,
    });

    // Assemble SDUI page from page_sections
    const pageDefinition = {
      type: "page" as const,
      version: 1,
      tenantId,
      organizationId: tenantId,
      sections: output.page_sections.map((section) => ({
        type: "component" as const,
        component: section.component,
        version: section.version,
        props: section.props,
        // SDUI metadata
        id: `${section.component}-${randomBytes(6).toString("hex")}`,
        metadata: {
          lifecycleStage: output.phase.lifecycle_stage,
          sessionId: payload.session_id,
          agentName: output.ui_state?.active_agent_label ?? null,
          confidenceScore: payload.confidence_score,
        },
      })),
      metadata: {
        stage: output.phase.lifecycle_stage,
        sagaState: payload.saga_state,
        workflowStatus: payload.workflow_status,
        canLock: output.can_lock,
        confidenceScore: payload.confidence_score,
        activeInterrupts: output.active_interrupts.length,
      },
    };

    return res.status(200).json({
      success: true,
      data: {
        page: pageDefinition,
        phase: {
          id: output.phase.lifecycle_stage,
          label: output.phase.label,
          description: output.phase.description,
          userGoal: output.phase.user_goal,
          canLock: output.can_lock,
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
        activeInterrupts: output.active_interrupts.map((i) => ({
          id: i.id,
          type: i.type,
          severity: i.severity,
          message: i.message,
          sourceAgent: i.source_agent,
        })),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Orchestration failed";
    logger.error(
      "JourneyOrchestrator failed",
      error instanceof Error ? error : undefined,
      {
        tenantId,
        opportunityId: payload.opportunity_id,
        sagaState: payload.saga_state,
      }
    );

    return res.status(500).json({
      error: "orchestration_failed",
      message,
    });
  }
}

// ── Helper Functions ───────────────────────────────────────────────────

function mapSagaStateToLifecycleStage(
  sagaState: string
): "discovery" | "drafting" | "validating" | "composing" | "refining" | "realized" {
  const mapping: Record<string, "discovery" | "drafting" | "validating" | "composing" | "refining" | "realized"> = {
    INITIATED: "discovery",
    DRAFTING: "drafting",
    VALIDATING: "validating",
    COMPOSING: "composing",
    REFINING: "refining",
    FINALIZED: "realized",
  };
  return mapping[sagaState] ?? "discovery";
}

function mapSagaStateToBusinessCaseStatus(
  sagaState: string
): "draft" | "in_review" | "approved" | "presented" | "archived" {
  const mapping: Record<string, "draft" | "in_review" | "approved" | "presented" | "archived"> = {
    INITIATED: "draft",
    DRAFTING: "draft",
    VALIDATING: "in_review",
    COMPOSING: "in_review",
    REFINING: "in_review",
    FINALIZED: "approved",
  };
  return mapping[sagaState] ?? "draft";
}

function computeValueMaturity(
  sagaState: string,
  confidenceScore: number
): "low" | "medium" | "high" {
  if (sagaState === "FINALIZED" && confidenceScore >= 0.75) return "high";
  if (
    ["COMPOSING", "REFINING", "FINALIZED"].includes(sagaState) &&
    confidenceScore >= 0.5
  )
    return "medium";
  return "low";
}

// ── Routes ─────────────────────────────────────────────────────────────

router.post(
  "/v1/experience/orchestrate",
  rateLimiters.standard,
  orchestrateHandler
);

// Health check for the experience API
router.get("/v1/experience/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    modelVersion: DEFAULT_EXPERIENCE_MODEL.version,
  });
});

export default router;
