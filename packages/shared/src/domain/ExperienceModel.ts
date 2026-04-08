/**
 * ExperienceModel — canonical bridging domain type
 *
 * The "third model" that sits between the agent-centric backend and the
 * screen-centric frontend. Defines user goals, decisions, trust checkpoints,
 * and allowed actions per lifecycle phase.
 *
 * This is the translation contract:
 *   Agent orchestration state → Human-perceivable experience
 *
 * Five bridging responsibilities encoded here:
 *   1. State → UI Mapping       (UIStateMapping)
 *   2. Agent Output → Artifact   (ArtifactSlot)
 *   3. Workflow → Journey         (JourneyPhase)
 *   4. Confidence → Trust UX      (TrustThresholds)
 *   5. Async → Perceived Flow     (ProgressDirective)
 *
 * Sprint 55: Initial definition. The JourneyOrchestrator service consumes
 * these types to produce SDUIPageDefinitions at runtime.
 */

import { z } from "zod";

import { EvidenceTierSchema } from "./Evidence.js";
import { OpportunityLifecycleStageSchema } from "./Opportunity.js";

// ============================================================================
// 1. State → UI Mapping
// ============================================================================

/**
 * Backend saga states (mirrored from ValueCaseSaga to avoid backend import).
 * Must stay in sync with packages/backend/src/lib/agents/core/ValueCaseSaga.ts.
 */
export const SagaStateEnumSchema = z.enum([
  "INITIATED",
  "DRAFTING",
  "VALIDATING",
  "COMPOSING",
  "REFINING",
  "FINALIZED",
  "TRACKING",
  "REALIZED",
  "AT_RISK",
  "EXPANSION_READY",
]);
export type SagaStateEnum = z.infer<typeof SagaStateEnumSchema>;

/**
 * Workflow execution statuses (mirrored from WorkflowStateRepository).
 * Must stay in sync with packages/backend/src/repositories/WorkflowStateRepository.ts.
 */
export const WorkflowStatusEnumSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "paused",
  "rolled_back",
  "waiting_approval",
]);
export type WorkflowStatusEnum = z.infer<typeof WorkflowStatusEnumSchema>;

/**
 * Visual indicator type shown to the user for a given state.
 */
export const UIIndicatorSchema = z.enum([
  "idle",
  "progress",
  "streaming",
  "success",
  "warning",
  "error",
  "blocked",
]);
export type UIIndicator = z.infer<typeof UIIndicatorSchema>;

/**
 * Maps a (SagaState, WorkflowStatus) pair to a user-perceivable UI state.
 *
 * Example:
 *   { saga_state: "VALIDATING", workflow_status: "running" }
 *   → { label: "Validating assumptions…", indicator: "progress" }
 */
export const UIStateMappingSchema = z.object({
  /** Backend saga state this mapping applies to. */
  saga_state: SagaStateEnumSchema,

  /** Workflow execution status. */
  workflow_status: WorkflowStatusEnumSchema,

  /** Human-readable label shown in the status bar / progress indicator. */
  label: z.string().min(1).max(200),

  /** Longer description for tooltip or detail panel. */
  description: z.string().max(500).optional(),

  /** Visual indicator type. */
  indicator: UIIndicatorSchema,

  /** Whether the user must take action to proceed. */
  user_actionable: z.boolean(),

  /** Optional call-to-action when user_actionable is true. */
  cta: z
    .object({
      label: z.string().min(1).max(100),
      action_id: z.string().min(1).max(100),
    })
    .optional(),

  /** Whether to show the confidence score in this state. */
  show_confidence: z.boolean().default(true),

  /**
   * Agent name displayed during this state (e.g. "FinancialModelingAgent").
   * Null when no specific agent is active.
   */
  active_agent_label: z.string().max(100).nullable().optional(),
});
export type UIStateMapping = z.infer<typeof UIStateMappingSchema>;

/**
 * Approval / lock axis orthogonal to lifecycle stage.
 */
export const ValueCaseStatusSchema = z.enum([
  "IN_PROGRESS",
  "BOARD_READY_LOCKED",
  "UNLOCKED_FOR_REVISION",
]);
export type ValueCaseStatus = z.infer<typeof ValueCaseStatusSchema>;

/**
 * Workspace regions used to place collaborative surfaces.
 */
export const WorkspaceRegionSchema = z.enum([
  "header",
  "left_rail",
  "center_canvas",
  "right_panel",
  "footer",
]);
export type WorkspaceRegion = z.infer<typeof WorkspaceRegionSchema>;

/**
 * Primary UX mode for a lifecycle phase.
 */
export const ExperienceModeSchema = z.enum([
  "discovery_shell",
  "value_tree_canvas",
  "integrity_layer",
  "executive_output_studio",
  "cfo_collaboration_mode",
  "board_ready_lock",
  "realization_workspace",
]);
export type ExperienceMode = z.infer<typeof ExperienceModeSchema>;

// ============================================================================
// 2. Agent Output → User Artifact
// ============================================================================

/**
 * An artifact slot defines a position in the artifact panel where agent
 * output is rendered as a structured, user-facing component.
 *
 * The transformation pipeline is:
 *   Agent JSON → Domain Object → SDUI Component (via artifact slot)
 */
export const ArtifactSlotSchema = z.object({
  /** Unique slot identifier (e.g. "value_tree", "evidence_table"). */
  id: z.string().min(1).max(100),

  /** Tab label shown in the artifact panel. */
  label: z.string().min(1).max(50),

  /** SDUI component name from the registry. */
  component: z.string().min(1).max(100),

  /** Where this artifact belongs in the collaborative workspace layout. */
  region: WorkspaceRegionSchema.default("center_canvas"),

  /** Optional panel title for the workspace region. */
  panel_title: z.string().min(1).max(100).optional(),

  /** Empty-state label shown before the artifact is available. */
  empty_state_label: z.string().min(1).max(200).optional(),

  /** Domain object type that feeds this component's props. */
  data_source: z.enum([
    "value_hypothesis",
    "assumption",
    "evidence",
    "business_case",
    "scenario",
    "realization_plan",
    "narrative",
    "value_graph",
    "integrity_score",
    "deal_context",
  ]),

  /** Saga triggers that should cause this slot to refresh. */
  refresh_on: z.array(z.string()).default([]),

  /** Sort order in the artifact panel tab bar. */
  sort_order: z.number().int().nonnegative().default(0),

  /**
   * Badge expression: what to show on the tab badge.
   * "count" = number of items, "alerts" = number of warnings/errors.
   */
  badge_type: z.enum(["count", "alerts", "confidence", "none"]).default("none"),
});
export type ArtifactSlot = z.infer<typeof ArtifactSlotSchema>;

// ============================================================================
// 3. Workflow → Journey
// ============================================================================

/**
 * Exit condition that must be satisfied before a phase can be locked.
 * Evaluated by the JourneyOrchestrator at lock-time.
 */
export const PhaseExitConditionSchema = z.object({
  /** Unique condition identifier. */
  id: z.string().min(1).max(100),

  /** Human-readable description shown when condition is not met. */
  description: z.string().min(1).max(500),

  /**
   * Condition type determines evaluation logic:
   * - min_confidence: overall confidence must be >= threshold
   * - min_items: at least N domain objects of a given type must exist
   * - no_unresolved_objections: all red team objections resolved
   * - all_fields_populated: no missing required data flags
   * - integrity_passed: integrity_check_passed on business case
   */
  type: z.enum([
    "min_confidence",
    "min_items",
    "no_unresolved_objections",
    "all_fields_populated",
    "integrity_passed",
    "custom",
  ]),

  /** Threshold value (interpretation depends on type). */
  threshold: z.number().optional(),

  /** Domain object type for min_items conditions. */
  target_type: z.string().max(100).optional(),
});
export type PhaseExitCondition = z.infer<typeof PhaseExitConditionSchema>;

/**
 * A user action available within a journey phase.
 */
export const UserActionSchema = z.object({
  /** Action identifier (matches slash command or button ID). */
  id: z.string().min(1).max(100),

  /** Display label. */
  label: z.string().min(1).max(100),

  /** How this action is surfaced to the user. */
  surface: z.enum(["slash_command", "button", "inline_edit", "menu_item"]),

  /**
   * Slash command string (e.g. "/lock discovery").
   * Only present when surface is "slash_command".
   */
  slash_command: z.string().max(100).optional(),

  /** Backend saga trigger this action fires. Null for UI-only actions. */
  produces_trigger: z.string().max(100).nullable().optional(),

  /** Whether this action requires confirmation before executing. */
  requires_confirmation: z.boolean().default(false),

  /**
   * Minimum confidence score required to enable this action.
   * Null means always enabled.
   */
  min_confidence: z.number().min(0).max(1).nullable().optional(),
});
export type UserAction = z.infer<typeof UserActionSchema>;

/**
 * A journey phase maps a backend lifecycle stage to a user-facing experience.
 *
 * This is the core of the "Workflow → Journey" translation:
 *   Backend: "DRAFTING" → Frontend: "Identify Value Opportunities"
 */
export const JourneyPhaseSchema = z.object({
  /** Matches OpportunityLifecycleStage. */
  lifecycle_stage: OpportunityLifecycleStageSchema,

  /** Corresponding saga state. */
  saga_state: SagaStateEnumSchema,

  /** User-facing phase label (e.g. "Understand the Customer"). */
  label: z.string().min(1).max(100),

  /** User-facing phase description. */
  description: z.string().min(1).max(500),

  /** Primary UX mode for the phase. */
  experience_mode: ExperienceModeSchema,

  /** Primary workspace title shown in the shell header. */
  workspace_title: z.string().min(1).max(120),

  /**
   * What the VE is trying to accomplish in this phase.
   * Displayed as guidance text in the UI.
   */
  user_goal: z.string().min(1).max(500),

  /** Whether this phase allows a board-ready lock transition. */
  supports_board_ready_lock: z.boolean().default(false),

  /** SDUI component sections rendered in the artifact panel during this phase. */
  artifact_slots: z.array(ArtifactSlotSchema),

  /** Actions available to the user during this phase. */
  allowed_actions: z.array(UserActionSchema),

  /** Conditions that must be met to lock this phase and advance. */
  exit_conditions: z.array(PhaseExitConditionSchema),

  /** Sort order (0 = first phase). */
  sort_order: z.number().int().nonnegative(),
});
export type JourneyPhase = z.infer<typeof JourneyPhaseSchema>;

// ============================================================================
// 4. Confidence → Trust UX
// ============================================================================

/**
 * Trust thresholds control when and how confidence/evidence signals
 * are surfaced to the user. Applied per-phase or globally.
 */
export const TrustThresholdsSchema = z.object({
  /**
   * Always show confidence indicator when score is below this value.
   * Above this threshold, confidence is shown only on hover/expand.
   */
  always_show_below: z.number().min(0).max(1).default(0.8),

  /** Show warning badge when confidence drops below this. */
  warn_below: z.number().min(0).max(1).default(0.5),

  /** Block phase advancement when confidence is below this. */
  block_below: z.number().min(0).max(1).default(0.3),

  /**
   * Minimum evidence tier required for CFO-ready presentation.
   * Claims below this tier show an upgrade prompt.
   */
  min_evidence_tier: EvidenceTierSchema.default("gold"),

  /** Whether to show "why this number?" drilldown links on all figures. */
  enable_lineage_drilldown: z.boolean().default(true),

  /** Whether to show the reasoning trace panel on agent outputs. */
  enable_reasoning_trace: z.boolean().default(true),
});
export type TrustThresholds = z.infer<typeof TrustThresholdsSchema>;

// ============================================================================
// 5. Async → Perceived Flow (Proactive Interrupts)
// ============================================================================

/**
 * Types of proactive interrupts the system can inject into the conversation.
 */
export const InterruptTypeSchema = z.enum([
  "red_team_objection",
  "evidence_upgrade_available",
  "missing_data_reminder",
  "confidence_threshold_alert",
  "realization_drift",
  "saga_conflict",
]);
export type InterruptType = z.infer<typeof InterruptTypeSchema>;

/**
 * Severity level for proactive interrupts.
 */
export const InterruptSeveritySchema = z.enum(["high", "medium", "low"]);
export type InterruptSeverity = z.infer<typeof InterruptSeveritySchema>;

/**
 * How the user can respond to an interrupt.
 */
export const InterruptResponseSchema = z.enum([
  "accept",
  "dismiss",
  "discuss",
  "justify",
  "defer",
]);
export type InterruptResponse = z.infer<typeof InterruptResponseSchema>;

/**
 * Defines the behavior of a proactive interrupt type.
 */
export const InterruptDefinitionSchema = z.object({
  /** Interrupt type identifier. */
  type: InterruptTypeSchema,

  /** Default severity. May be overridden per-instance at runtime. */
  severity: InterruptSeveritySchema,

  /** Whether the user must act before proceeding. */
  requires_user_action: z.boolean(),

  /** Response options presented to the user. */
  allowed_responses: z.array(InterruptResponseSchema).min(1),

  /**
   * Phases where this interrupt type can fire.
   * Empty array means all phases.
   */
  active_in_phases: z.array(OpportunityLifecycleStageSchema).default([]),
});
export type InterruptDefinition = z.infer<typeof InterruptDefinitionSchema>;

/**
 * A runtime interrupt instance injected into the conversation.
 */
export const InterruptInstanceSchema = z.object({
  /** Unique interrupt instance ID. */
  id: z.string().uuid(),

  /** Interrupt type. */
  type: InterruptTypeSchema,

  /** Runtime severity (may differ from definition default). */
  severity: InterruptSeveritySchema,

  /** Agent that triggered this interrupt. */
  source_agent: z.string().min(1).max(100),

  /** Human-readable message shown in the interrupt banner. */
  message: z.string().min(1).max(2000),

  /** The domain object this interrupt relates to (e.g. hypothesis ID). */
  target_id: z.string().uuid().optional(),

  /** Structured data for the interrupt (e.g. suggested revision). */
  payload: z.record(z.unknown()).optional(),

  /** How the user responded. Null while unresolved. */
  resolution: InterruptResponseSchema.nullable().default(null),

  /** User's justification text (when resolution is "justify"). */
  resolution_note: z.string().max(2000).nullable().optional(),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  resolved_at: z.string().datetime().nullable().optional(),
});
export type InterruptInstance = z.infer<typeof InterruptInstanceSchema>;

// ============================================================================
// Progress Directive (Async → Perceived Flow)
// ============================================================================

/**
 * Describes how to render agent progress while async work is in flight.
 * Used by the frontend to show streaming partial results and progress.
 */
export const ProgressDirectiveSchema = z.object({
  /** Which agent is currently active. */
  agent_name: z.string().min(1).max(100),

  /** Human-readable description of current activity. */
  activity_label: z.string().min(1).max(200),

  /** Progress percentage (0-100). Null for indeterminate. */
  progress_pct: z.number().min(0).max(100).nullable().optional(),

  /** Whether partial results are available for optimistic rendering. */
  has_partial_result: z.boolean().default(false),

  /**
   * Partial result to render optimistically.
   * Must conform to the expected SDUI component props for the active artifact slot.
   */
  partial_result: z.record(z.unknown()).optional(),

  /** Estimated time remaining in seconds. Null if unknown. */
  eta_seconds: z.number().nonnegative().nullable().optional(),
});
export type ProgressDirective = z.infer<typeof ProgressDirectiveSchema>;

// ============================================================================
// Slash Command Registry
// ============================================================================

/**
 * Slash command definition for the chat input autocomplete.
 */
export const SlashCommandSchema = z.object({
  /** Command string without the leading slash (e.g. "lock"). */
  command: z.string().min(1).max(50),

  /** Human-readable description for autocomplete. */
  description: z.string().min(1).max(200),

  /** Phases where this command is available. Empty = all phases. */
  available_in_phases: z.array(OpportunityLifecycleStageSchema).default([]),

  /** Arguments the command accepts. */
  args: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        description: z.string().max(200),
        required: z.boolean().default(false),
        type: z.enum(["string", "phase", "item_id"]),
      })
    )
    .default([]),
});
export type SlashCommand = z.infer<typeof SlashCommandSchema>;

// ============================================================================
// ExperienceModel (Root)
// ============================================================================

/**
 * The complete Experience Model definition.
 *
 * This is NOT a per-record domain object — it is a system-level definition
 * that the JourneyOrchestrator uses to translate backend state into frontend
 * experience. One instance exists per tenant (with sensible defaults).
 *
 * The three models:
 *   Backend model = agents + sagas + domain objects
 *   Frontend model = SDUI components + layouts
 *   Experience model = user goals + decisions + trust checkpoints (THIS)
 */
export const ExperienceModelSchema = z.object({
  /** Version of this experience model definition. */
  version: z.number().int().positive(),

  /** Journey phases in lifecycle order. */
  phases: z.array(JourneyPhaseSchema).min(1),

  /** State → UI mappings for all (saga_state, workflow_status) combinations. */
  ui_state_mappings: z.array(UIStateMappingSchema),

  /** Proactive interrupt definitions. */
  interrupt_definitions: z.array(InterruptDefinitionSchema),

  /** Global trust thresholds (phases may override). */
  trust_thresholds: TrustThresholdsSchema,

  /** Available slash commands. */
  slash_commands: z.array(SlashCommandSchema),
});
export type ExperienceModel = z.infer<typeof ExperienceModelSchema>;
