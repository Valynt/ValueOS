/**
 * JourneyOrchestrator — Runtime Bridging Service
 *
 * Consumes DecisionContext + ExperienceModel and produces SDUIPageDefinitions
 * for the current engagement state. This is the runtime bridge that translates
 * backend agent state into the user-perceivable experience.
 *
 * Responsibilities:
 *   1. Resolve current JourneyPhase from lifecycle stage
 *   2. Resolve UIStateMapping from (SagaState, WorkflowStatus)
 *   3. Assemble artifact panel from phase artifact slots + transformer outputs
 *   4. Evaluate exit conditions to determine phase lock readiness
 *   5. Collect active interrupts and surface them
 *   6. Produce a complete SDUIPageDefinition
 *
 * Sprint 55: Initial implementation.
 */

import type {
  DecisionContext,
  ExperienceModel,
  InterruptInstance,
  JourneyPhase,
  PhaseExitCondition,
  TrustThresholds,
  UIStateMapping,
} from "@valueos/shared";

import { logger } from "../../lib/logger.js";

import type {
  ArtifactTransformerRegistry,
  TransformedArtifact,
} from "./ArtifactTransformer.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Input to the orchestrator: everything needed to produce a page.
 */
export interface JourneyOrchestratorInput {
  /** Current decision context (tenant, opportunity, hypothesis, etc.). */
  decision_context: DecisionContext;

  /** Current saga state. */
  saga_state: string;

  /** Current workflow execution status. */
  workflow_status: string;

  /** Overall confidence score (0-1). */
  confidence_score: number;

  /** Unresolved interrupt instances. */
  active_interrupts: InterruptInstance[];

  /** Value case ID for the current engagement. */
  value_case_id: string;

  /** Session ID for the current workflow. */
  session_id: string;
}

/**
 * Exit condition evaluation result.
 */
export interface ExitConditionResult {
  condition: PhaseExitCondition;
  passed: boolean;
  reason?: string;
}

/**
 * Full orchestrator output: everything the frontend needs to render.
 */
export interface JourneyOrchestratorOutput {
  /** Current journey phase definition. */
  phase: JourneyPhase;

  /** Resolved UI state for the current backend state. */
  ui_state: UIStateMapping | null;

  /** Transformed artifacts ready for the artifact panel. */
  artifacts: TransformedArtifact[];

  /** Exit condition evaluation results (for lock readiness). */
  exit_conditions: ExitConditionResult[];

  /** Whether all exit conditions pass (phase can be locked). */
  can_lock: boolean;

  /** Active trust thresholds for this phase. */
  trust_thresholds: TrustThresholds;

  /** Unresolved interrupts to display. */
  active_interrupts: InterruptInstance[];

  /** SDUI page sections assembled from artifacts + layout. */
  page_sections: SDUISection[];
}

/**
 * Minimal SDUI section type (avoids importing the full schema module
 * which may pull in React dependencies).
 */
interface SDUISection {
  type: "component";
  component: string;
  version: number;
  props: Record<string, unknown>;
}

// ============================================================================
// JourneyOrchestrator
// ============================================================================

export class JourneyOrchestrator {
  constructor(
    private readonly experienceModel: ExperienceModel,
    private readonly transformerRegistry: ArtifactTransformerRegistry
  ) {}

  /**
   * Produce a full orchestrator output for the current engagement state.
   */
  async orchestrate(
    input: JourneyOrchestratorInput
  ): Promise<JourneyOrchestratorOutput> {
    const lifecycleStage =
      input.decision_context.opportunity?.lifecycle_stage ?? "discovery";

    // 1. Resolve journey phase
    const phase = this.resolvePhase(lifecycleStage);
    if (!phase) {
      throw new Error(
        `JourneyOrchestrator: no phase defined for lifecycle stage '${lifecycleStage}'`
      );
    }

    // 2. Resolve UI state
    const uiState = this.resolveUIState(
      input.saga_state,
      input.workflow_status
    );

    // 3. Transform artifacts for each slot
    const artifacts = await this.transformArtifacts(phase, input);

    // 4. Evaluate exit conditions
    const exitConditions = this.evaluateExitConditions(
      phase,
      input,
      artifacts
    );
    const canLock = exitConditions.every((ec) => ec.passed);

    // 5. Resolve trust thresholds
    const trustThresholds = this.experienceModel.trust_thresholds;

    // 6. Assemble SDUI page sections
    const pageSections = this.assemblePageSections(
      phase,
      uiState,
      artifacts,
      input
    );

    return {
      phase,
      ui_state: uiState,
      artifacts,
      exit_conditions: exitConditions,
      can_lock: canLock,
      trust_thresholds: trustThresholds,
      active_interrupts: input.active_interrupts,
      page_sections: pageSections,
    };
  }

  // ── Phase Resolution ─────────────────────────────────────────────────

  private resolvePhase(lifecycleStage: string): JourneyPhase | null {
    return (
      this.experienceModel.phases.find(
        (p: JourneyPhase) => p.lifecycle_stage === lifecycleStage
      ) ?? null
    );
  }

  // ── UI State Resolution ──────────────────────────────────────────────

  private resolveUIState(
    sagaState: string,
    workflowStatus: string
  ): UIStateMapping | null {
    return (
      this.experienceModel.ui_state_mappings.find(
        (m: UIStateMapping) =>
          m.saga_state === sagaState && m.workflow_status === workflowStatus
      ) ?? null
    );
  }

  // ── Artifact Transformation ──────────────────────────────────────────

  private async transformArtifacts(
    phase: JourneyPhase,
    input: JourneyOrchestratorInput
  ): Promise<TransformedArtifact[]> {
    const results: TransformedArtifact[] = [];

    for (const slot of phase.artifact_slots) {
      // Find a transformer that can fill this slot.
      // In the initial implementation, we attempt to find a transformer
      // by looking up the component name. In practice, the mapping from
      // slot → agent → transformer will be more sophisticated.
      const registeredAgents = this.transformerRegistry.getRegisteredAgents();

      let transformed: TransformedArtifact | null = null;

      for (const agentName of registeredAgents) {
        const transformer = this.transformerRegistry.get(agentName);
        if (!transformer) continue;

        try {
          transformed = await transformer.transform({
            agent_output: {},
            organization_id:
              input.decision_context.organization_id,
            opportunity_id:
              input.decision_context.opportunity?.id ?? "",
            session_id: input.session_id,
            trace_id: null,
            grounding_score: null,
            target_slot: slot,
          });

          if (transformed) break;
        } catch (err) {
          logger.warn("JourneyOrchestrator: transformer failed", {
            agent: agentName,
            slot: slot.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (transformed) {
        results.push(transformed);
      }
    }

    return results;
  }

  // ── Exit Condition Evaluation ────────────────────────────────────────

  private evaluateExitConditions(
    phase: JourneyPhase,
    input: JourneyOrchestratorInput,
    _artifacts: TransformedArtifact[]
  ): ExitConditionResult[] {
    return phase.exit_conditions.map(
      (condition: PhaseExitCondition): ExitConditionResult => {
        switch (condition.type) {
          case "min_confidence":
            return {
              condition,
              passed:
                input.confidence_score >= (condition.threshold ?? 0.75),
              reason:
                input.confidence_score < (condition.threshold ?? 0.75)
                  ? `Confidence ${input.confidence_score.toFixed(2)} is below threshold ${condition.threshold ?? 0.75}`
                  : undefined,
            };

          case "no_unresolved_objections": {
            const unresolvedCount = input.active_interrupts.filter(
              (i: InterruptInstance) =>
                i.type === "red_team_objection" && i.resolution === null
            ).length;
            return {
              condition,
              passed: unresolvedCount === 0,
              reason:
                unresolvedCount > 0
                  ? `${unresolvedCount} unresolved Red Team objection(s)`
                  : undefined,
            };
          }

          case "integrity_passed": {
            const bc = input.decision_context.business_case;
            const passed = bc?.assumptions_reviewed === true;
            return {
              condition,
              passed: !!passed,
              reason: !passed
                ? "Integrity check has not passed"
                : undefined,
            };
          }

          case "min_items":
            // Requires domain-specific query; delegate to caller in v2.
            return {
              condition,
              passed: true,
              reason: undefined,
            };

          case "all_fields_populated":
            // Requires domain-specific query; delegate to caller in v2.
            return {
              condition,
              passed: true,
              reason: undefined,
            };

          case "custom":
            // Custom conditions evaluated by external hooks.
            return {
              condition,
              passed: false,
              reason: "Custom condition requires explicit resolution",
            };

          default:
            return {
              condition,
              passed: false,
              reason: `Unknown condition type: ${condition.type}`,
            };
        }
      }
    );
  }

  // ── Page Section Assembly ────────────────────────────────────────────

  private assemblePageSections(
    phase: JourneyPhase,
    uiState: UIStateMapping | null,
    artifacts: TransformedArtifact[],
    input: JourneyOrchestratorInput
  ): SDUISection[] {
    const sections: SDUISection[] = [];

    // 1. Status bar section
    sections.push({
      type: "component",
      component: "WorkflowStatusBar",
      version: 1,
      props: {
        stages: this.experienceModel.phases.map((p: JourneyPhase) => ({
          id: p.lifecycle_stage,
          label: p.label,
          saga_state: p.saga_state,
        })),
        currentStageId: phase.lifecycle_stage,
        status: uiState?.indicator ?? "idle",
        statusLabel: uiState?.label ?? phase.label,
        activeAgent: uiState?.active_agent_label ?? null,
        confidenceScore: input.confidence_score,
        showConfidence: uiState?.show_confidence ?? true,
      },
    });

    // 2. Human checkpoint (if user action is required)
    if (uiState?.user_actionable && uiState.cta) {
      sections.push({
        type: "component",
        component: "HumanCheckpoint",
        version: 1,
        props: {
          stageId: phase.lifecycle_stage,
          agentName: uiState.active_agent_label ?? "System",
          action: uiState.cta.label,
          actionId: uiState.cta.action_id,
          riskLevel: input.confidence_score < 0.5 ? "high" : "medium",
        },
      });
    }

    // 3. Interrupt banners
    for (const interrupt of input.active_interrupts) {
      if (interrupt.resolution !== null) continue;
      sections.push({
        type: "component",
        component: "IntegrityVetoPanel",
        version: 1,
        props: {
          issues: [
            {
              id: interrupt.id,
              type: interrupt.type,
              severity: interrupt.severity,
              message: interrupt.message,
              sourceAgent: interrupt.source_agent,
            },
          ],
        },
      });
    }

    // 4. Artifact sections (from transformed outputs)
    for (const artifact of artifacts) {
      sections.push({
        type: "component",
        component: artifact.component,
        version: artifact.version,
        props: {
          ...artifact.props,
          _lineage: artifact.lineage,
          _indicator: artifact.indicator,
        },
      });
    }

    // 5. Confidence dashboard (if trust thresholds require it)
    const trust = this.experienceModel.trust_thresholds;
    if (
      input.confidence_score < trust.always_show_below ||
      uiState?.show_confidence
    ) {
      sections.push({
        type: "component",
        component: "ReadinessGauge",
        version: 1,
        props: {
          compositeScore: input.confidence_score,
          status:
            input.confidence_score >= 0.75
              ? "ready"
              : input.confidence_score >= trust.warn_below
                ? "warning"
                : "critical",
          components: {
            confidence: input.confidence_score,
            warnThreshold: trust.warn_below,
            blockThreshold: trust.block_below,
          },
        },
      });
    }

    return sections;
  }
}
