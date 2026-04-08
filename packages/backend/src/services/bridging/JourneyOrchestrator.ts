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
  ArtifactSlot,
  JourneyPhase,
  UIStateMapping,
  PhaseExitCondition,
  InterruptInstance,
  TrustThresholds,
  ValueCaseStatus,
} from "@valueos/shared";
import { logger } from "@shared/lib/logger";

import { ExitConditionEvaluator, SupabaseExitConditionRepository } from "./ExitConditionEvaluator.js";
import {
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

  /** Approval / lock state orthogonal to lifecycle stage. */
  value_case_status?: ValueCaseStatus;
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
 * Smart guidance for the next recommended action.
 */
export interface NextStepGuidance {
  /** Unique ID for this guidance */
  id: string;

  /** Type of guidance */
  type: "auto_advance" | "action_required" | "suggestion" | "completion";

  /** Priority level */
  priority: "high" | "medium" | "low";

  /** Human-readable title */
  title: string;

  /** Detailed description */
  description: string;

  /** Primary action to take */
  primaryAction?: {
    id: string;
    label: string;
    surface: "button" | "slash_command" | "keyboard_shortcut";
    shortcut?: string;
  };

  /** Secondary actions available */
  secondaryActions?: Array<{
    id: string;
    label: string;
  }>;

  /** Progress indication for multi-step flows */
  progress?: {
    current: number;
    total: number;
    label: string;
  };

  /** Whether this guidance blocks further progress */
  blocking: boolean;

  /** Dismissible without action */
  dismissible: boolean;
}

/**
 * Inline validation result for real-time feedback.
 */
export interface InlineValidation {
  /** Field or action being validated */
  target: string;

  /** Validation status */
  status: "valid" | "invalid" | "pending" | "warning";

  /** Human-readable message */
  message: string;

  /** Suggested fix if invalid */
  suggestion?: string;

  /** Auto-fix available */
  autoFixable?: boolean;
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

  /** Approval / lock state for the active value case. */
  value_case_status: ValueCaseStatus;

  /** Whether the workspace is editable or locked. */
  interaction_mode: "editable" | "locked";

  /** Header metadata for the single collaborative workspace. */
  workspace_header: WorkspaceHeader;

  /** Artifacts grouped by workspace region for left rail / canvas / right panel layouts. */
  workspace_regions: WorkspaceRegions;

  /** Unresolved interrupts to display. */
  active_interrupts: InterruptInstance[];

  /** SDUI page sections assembled from artifacts + layout. */
  page_sections: SDUISection[];

  /** Smart next-step guidance for the user. */
  next_step_guidance: NextStepGuidance[];

  /** Inline validation results for real-time feedback. */
  inline_validations: InlineValidation[];

  /** Keyboard shortcuts available in current context. */
  keyboard_shortcuts: Array<{
    key: string;
    label: string;
    action_id: string;
    scope: "global" | "phase" | "widget";
  }>;
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

interface WorkspaceHeader {
  title: string;
  phase_label: string;
  user_goal: string;
  confidence_score: number;
  value_case_status: ValueCaseStatus;
  interaction_mode: "editable" | "locked";
}

interface WorkspaceRegions {
  header: TransformedArtifact[];
  left_rail: TransformedArtifact[];
  center_canvas: TransformedArtifact[];
  right_panel: TransformedArtifact[];
  footer: TransformedArtifact[];
}

// ============================================================================
// JourneyOrchestrator
// ============================================================================

export class JourneyOrchestrator {
  private readonly exitConditionEvaluator: ExitConditionEvaluator;

  constructor(
    private readonly experienceModel: ExperienceModel,
    private readonly transformerRegistry: ArtifactTransformerRegistry
  ) {
    const repository = new SupabaseExitConditionRepository();
    this.exitConditionEvaluator = new ExitConditionEvaluator(repository);
  }

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
    const exitConditions = await this.evaluateExitConditions(
      phase,
      input,
      artifacts
    );
    const canLock = exitConditions.every((ec) => ec.passed);

    // 5. Resolve trust thresholds
    const trustThresholds = this.experienceModel.trust_thresholds;

    const valueCaseStatus = this.resolveValueCaseStatus(input);
    const interactionMode =
      valueCaseStatus === "BOARD_READY_LOCKED" || phase.lifecycle_stage === "realized"
        ? "locked"
        : "editable";
    const workspaceRegions = this.groupArtifactsByRegion(artifacts);
    const workspaceHeader: WorkspaceHeader = {
      title: phase.workspace_title,
      phase_label: phase.label,
      user_goal: phase.user_goal,
      confidence_score: input.confidence_score,
      value_case_status: valueCaseStatus,
      interaction_mode: interactionMode,
    };

    // 6. Assemble SDUI page sections
    const pageSections = this.assemblePageSections(
      phase,
      uiState,
      artifacts,
      input,
      valueCaseStatus,
      interactionMode
    );

    // 7. Generate smart next-step guidance
    const nextStepGuidance = this.generateNextStepGuidance(
      phase,
      exitConditions,
      canLock,
      input,
      uiState
    );

    // 8. Generate inline validations
    const inlineValidations = this.generateInlineValidations(
      phase,
      exitConditions,
      artifacts
    );

    // 9. Resolve keyboard shortcuts for current context
    const keyboardShortcuts = this.resolveKeyboardShortcuts(phase, uiState);

    return {
      phase,
      ui_state: uiState,
      artifacts,
      exit_conditions: exitConditions,
      can_lock: canLock,
      trust_thresholds: trustThresholds,
      value_case_status: valueCaseStatus,
      interaction_mode: interactionMode,
      workspace_header: workspaceHeader,
      workspace_regions: workspaceRegions,
      active_interrupts: input.active_interrupts,
      page_sections: pageSections,
      next_step_guidance: nextStepGuidance,
      inline_validations: inlineValidations,
      keyboard_shortcuts: keyboardShortcuts,
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
          // Extract agent outputs from decision context based on agent type
          const agentOutput = this.extractAgentOutputForSlot(
            input.decision_context,
            slot,
            agentName
          );

          transformed = await transformer.transform({
            agent_output: agentOutput,
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

  // ── Agent Output Extraction ───────────────────────────────────────────

  private extractAgentOutputForSlot(
    decisionContext: JourneyOrchestratorInput["decision_context"],
    _slot: ArtifactSlot,
    agentName: string
  ): Record<string, unknown> {
    const context = decisionContext as unknown as {
      hypothesis_output?: Record<string, unknown>;
      value_output?: Record<string, unknown>;
      integrity_output?: Record<string, unknown>;
      agent_outputs?: Record<string, Record<string, unknown>>;
    };

    // In the current architecture, agent outputs are stored in the decision context
    // This method extracts the appropriate output based on agent type and slot
    switch (agentName) {
      case "HypothesisAgent":
        // For HypothesisAgent, look for hypothesis-related outputs
        return context.hypothesis_output ?? {};

      case "ValueAgent":
        // For ValueAgent, look for value-related outputs
        return context.value_output ?? {};

      case "IntegrityAgent":
        // For IntegrityAgent, look for integrity-related outputs
        return context.integrity_output ?? {};

      default:
        // Fallback: try to find any output that matches the slot
        const genericOutput = context.agent_outputs?.[agentName] ?? {};
        return genericOutput;
    }
  }

  private resolveValueCaseStatus(
    input: JourneyOrchestratorInput
  ): ValueCaseStatus {
    if (input.value_case_status) {
      return input.value_case_status;
    }

    return "IN_PROGRESS";
  }

  private groupArtifactsByRegion(
    artifacts: TransformedArtifact[]
  ): WorkspaceRegions {
    return artifacts.reduce<WorkspaceRegions>(
      (acc, artifact) => {
        acc[artifact.region].push(artifact);
        return acc;
      },
      {
        header: [],
        left_rail: [],
        center_canvas: [],
        right_panel: [],
        footer: [],
      }
    );
  }

  // ── Exit Condition Evaluation ────────────────────────────────────────

  private async evaluateExitConditions(
    phase: JourneyPhase,
    input: JourneyOrchestratorInput,
    _artifacts: TransformedArtifact[]
  ): Promise<ExitConditionResult[]> {
    const results = await Promise.all(
      phase.exit_conditions.map(async (condition: PhaseExitCondition): Promise<ExitConditionResult> => {
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
          return await this.exitConditionEvaluator.evaluate(condition, {
            organization_id: input.decision_context.organization_id,
            opportunity_id: input.decision_context.opportunity?.id ?? "",
          });

        case "all_fields_populated":
          return await this.exitConditionEvaluator.evaluate(condition, {
            organization_id: input.decision_context.organization_id,
            opportunity_id: input.decision_context.opportunity?.id ?? "",
          });

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
      })
    );
    return results;
  }

  // ── Page Section Assembly ────────────────────────────────────────────

  private assemblePageSections(
    phase: JourneyPhase,
    uiState: UIStateMapping | null,
    artifacts: TransformedArtifact[],
    input: JourneyOrchestratorInput,
    valueCaseStatus: ValueCaseStatus,
    interactionMode: "editable" | "locked"
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
        workspaceTitle: phase.workspace_title,
        experienceMode: phase.experience_mode,
        valueCaseStatus,
        interactionMode,
      },
    });

    if (valueCaseStatus === "BOARD_READY_LOCKED") {
      sections.push({
        type: "component",
        component: "InfoBanner",
        version: 1,
        props: {
          title: "Board-ready lock",
          message: "This value case is locked for export and audit. Unlock for revision to continue editing.",
          variant: "info",
          dismissible: false,
        },
      });
    }

    // 2. Human checkpoint (if user action is required)
    if (interactionMode === "editable" && uiState?.user_actionable && uiState.cta) {
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

  // ── Smart Guidance Generation ─────────────────────────────────────────

  private generateNextStepGuidance(
    phase: JourneyPhase,
    exitConditions: ExitConditionResult[],
    canLock: boolean,
    input: JourneyOrchestratorInput,
    uiState: UIStateMapping | null
  ): NextStepGuidance[] {
    const guidance: NextStepGuidance[] = [];

    // Check for auto-advance opportunity
    if (canLock && input.value_case_status !== "BOARD_READY_LOCKED") {
      const nextPhase = this.getNextPhase(phase);
      guidance.push({
        id: `auto-advance-${phase.lifecycle_stage}`,
        type: "auto_advance",
        priority: "high",
        title: `Ready to advance to ${nextPhase?.label || "next phase"}`,
        description: `All exit conditions met. You can lock this phase and continue to the ${nextPhase?.label || "next step"}.`,
        primaryAction: {
          id: "lock_phase",
          label: `Lock ${phase.label}`,
          surface: "button",
          shortcut: "Ctrl+L",
        },
        secondaryActions: [
          { id: "review_conditions", label: "Review conditions" },
          { id: "stay_in_phase", label: "Stay in current phase" },
        ],
        progress: {
          current: exitConditions.filter((ec) => ec.passed).length,
          total: exitConditions.length,
          label: `${exitConditions.filter((ec) => ec.passed).length} of ${exitConditions.length} conditions met`,
        },
        blocking: false,
        dismissible: true,
      });
    }

    // Check for failed exit conditions that need action
    for (const condition of exitConditions) {
      if (!condition.passed && condition.condition.type !== "custom") {
        guidance.push({
          id: `action-required-${condition.condition.id}`,
          type: "action_required",
          priority: condition.condition.type === "min_confidence" ? "high" : "medium",
          title: this.getConditionActionTitle(condition.condition),
          description: condition.reason || `Complete: ${condition.condition.description}`,
          primaryAction: {
            id: `fix-${condition.condition.id}`,
            label: this.getConditionActionLabel(condition.condition),
            surface: "button",
          },
          blocking: false,
          dismissible: true,
        });
      }
    }

    // Add contextual suggestions based on phase
    if (uiState?.user_actionable && uiState.cta) {
      guidance.push({
        id: "suggested-action",
        type: "suggestion",
        priority: "low",
        title: "Suggested next step",
        description: uiState.cta.label,
        primaryAction: {
          id: uiState.cta.action_id,
          label: uiState.cta.label,
          surface: "slash_command",
          shortcut: uiState.cta.action_id.startsWith("lock") ? "Ctrl+L" : "Ctrl+Enter",
        },
        blocking: false,
        dismissible: true,
      });
    }

    return guidance.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private getNextPhase(currentPhase: JourneyPhase): JourneyPhase | null {
    const phases = this.experienceModel.phases;
    const currentIndex = phases.findIndex(
      (p: JourneyPhase) => p.lifecycle_stage === currentPhase.lifecycle_stage
    );
    if (currentIndex >= 0 && currentIndex < phases.length - 1) {
      return phases[currentIndex + 1];
    }
    return null;
  }

  private getConditionActionTitle(condition: PhaseExitCondition): string {
    switch (condition.type) {
      case "min_confidence":
        return "Increase confidence score";
      case "no_unresolved_objections":
        return "Resolve Red Team objections";
      case "min_items":
        return `Add more ${condition.target_type || "items"}`;
      case "all_fields_populated":
        return "Complete required fields";
      case "integrity_passed":
        return "Complete integrity review";
      default:
        return "Complete required task";
    }
  }

  private getConditionActionLabel(condition: PhaseExitCondition): string {
    switch (condition.type) {
      case "min_confidence":
        return "Review & Improve";
      case "no_unresolved_objections":
        return "View Objections";
      case "min_items":
        return `Add ${condition.target_type || "Items"}`;
      case "all_fields_populated":
        return "Fill Fields";
      case "integrity_passed":
        return "Run Integrity Check";
      default:
        return "Take Action";
    }
  }

  // ── Inline Validation Generation ────────────────────────────────────────

  private generateInlineValidations(
    phase: JourneyPhase,
    exitConditions: ExitConditionResult[],
    _artifacts: TransformedArtifact[]
  ): InlineValidation[] {
    const validations: InlineValidation[] = [];

    // Map exit conditions to inline validations
    for (const result of exitConditions) {
      validations.push({
        target: result.condition.id,
        status: result.passed ? "valid" : "invalid",
        message: result.passed
          ? `${result.condition.description} ✓`
          : result.reason || result.condition.description,
        suggestion: result.passed ? undefined : this.getValidationSuggestion(result.condition),
        autoFixable: result.condition.type === "min_items" || result.condition.type === "all_fields_populated",
      });
    }

    return validations;
  }

  private getValidationSuggestion(condition: PhaseExitCondition): string | undefined {
    switch (condition.type) {
      case "min_confidence":
        return "Add evidence or refine assumptions to increase confidence";
      case "no_unresolved_objections":
        return "Review and respond to each Red Team objection";
      case "min_items":
        return `Create at least ${condition.threshold || 1} ${condition.target_type || "items"}`;
      case "all_fields_populated":
        return "Ensure all required fields have values";
      case "integrity_passed":
        return "Review assumptions and run integrity check";
      default:
        return undefined;
    }
  }

  // ── Keyboard Shortcuts Resolution ─────────────────────────────────────

  private resolveKeyboardShortcuts(
    phase: JourneyPhase,
    uiState: UIStateMapping | null
  ): Array<{ key: string; label: string; action_id: string; scope: "global" | "phase" | "widget" }> {
    const shortcuts: Array<{ key: string; label: string; action_id: string; scope: "global" | "phase" | "widget" }> = [
      // Global shortcuts
      { key: "?", label: "Show keyboard shortcuts", action_id: "show_shortcuts", scope: "global" },
      { key: "/", label: "Open slash command", action_id: "open_slash", scope: "global" },
      { key: "Esc", label: "Close panel / Cancel", action_id: "escape", scope: "global" },

      // Phase-specific shortcuts
      { key: "Ctrl+L", label: `Lock ${phase.label}`, action_id: "lock_phase", scope: "phase" },
      { key: "Ctrl+S", label: "Save / Sync", action_id: "save", scope: "phase" },
    ];

    // Add workflow-specific shortcuts based on UI state
    if (uiState?.user_actionable && uiState.cta) {
      shortcuts.push({
        key: "Ctrl+Enter",
        label: uiState.cta.label,
        action_id: uiState.cta.action_id,
        scope: "phase",
      });
    }

    // Add shortcuts for allowed actions in phase
    for (const action of phase.allowed_actions) {
      if (action.surface === "slash_command" && action.slash_command) {
        shortcuts.push({
          key: action.slash_command,
          label: action.label,
          action_id: action.id,
          scope: "phase",
        });
      }
    }

    return shortcuts;
  }
}
