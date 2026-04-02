/**
 * StateUIMap — Default Experience Model Configuration
 *
 * Instantiates the ExperienceModel types from @valueos/shared/domain with
 * the canonical ValueOS Co-Pilot experience. This is the single source of
 * truth for how backend state maps to user-perceivable UI.
 *
 * The JourneyOrchestrator reads this at runtime to produce SDUIPageDefinitions.
 *
 * Sprint 55: Initial definition.
 */

import type {
  ArtifactSlot,
  ExperienceModel,
  InterruptDefinition,
  JourneyPhase,
  SlashCommand,
  TrustThresholds,
  UIStateMapping,
} from "@shared/domain";

// ============================================================================
// Trust Thresholds (Global Defaults)
// ============================================================================

export const DEFAULT_TRUST_THRESHOLDS: TrustThresholds = {
  always_show_below: 0.8,
  warn_below: 0.5,
  block_below: 0.3,
  min_evidence_tier: "gold",
  enable_lineage_drilldown: true,
  enable_reasoning_trace: true,
};

// ============================================================================
// Artifact Slot Presets
// ============================================================================

function createArtifactSlot(
  slot: Omit<ArtifactSlot, "region"> & Partial<Pick<ArtifactSlot, "region" | "panel_title" | "empty_state_label">>
): ArtifactSlot {
  return {
    region: "center_canvas",
    ...slot,
  };
}

const PHASE_METADATA: Record<JourneyPhase["lifecycle_stage"], Pick<JourneyPhase, "experience_mode" | "workspace_title" | "supports_board_ready_lock">> = {
  discovery: {
    experience_mode: "discovery_shell",
    workspace_title: "Discovery Shell",
    supports_board_ready_lock: false,
  },
  drafting: {
    experience_mode: "value_tree_canvas",
    workspace_title: "Value Tree Canvas",
    supports_board_ready_lock: false,
  },
  validating: {
    experience_mode: "integrity_layer",
    workspace_title: "Integrity Layer",
    supports_board_ready_lock: false,
  },
  composing: {
    experience_mode: "executive_output_studio",
    workspace_title: "Executive Output Studio",
    supports_board_ready_lock: false,
  },
  refining: {
    experience_mode: "cfo_collaboration_mode",
    workspace_title: "CFO Collaboration Mode",
    supports_board_ready_lock: true,
  },
  realizing: {
    experience_mode: "realization_workspace",
    workspace_title: "Value Realization Workspace",
    supports_board_ready_lock: false,
  },
  realized: {
    experience_mode: "realization_workspace",
    workspace_title: "Value Realization Workspace",
    supports_board_ready_lock: false,
  },
  expansion: {
    experience_mode: "realization_workspace",
    workspace_title: "Expansion Workspace",
    supports_board_ready_lock: false,
  },
};

function createJourneyPhase(
  phase: Omit<JourneyPhase, "experience_mode" | "workspace_title" | "supports_board_ready_lock">
): JourneyPhase {
  return {
    ...phase,
    ...PHASE_METADATA[phase.lifecycle_stage],
  };
}

const SLOT_VALUE_TREE = createArtifactSlot({
  id: "value_tree",
  label: "Value Tree",
  component: "ValueTreeCard",
  region: "center_canvas",
  panel_title: "Value Workspace",
  data_source: "value_hypothesis",
  refresh_on: ["HYPOTHESIS_CONFIRMED", "MODEL_COMPLETE", "VE_APPROVED"],
  sort_order: 0,
  badge_type: "count",
});

const SLOT_EVIDENCE_TABLE = createArtifactSlot({
  id: "evidence_table",
  label: "Evidence",
  component: "DataTable",
  region: "left_rail",
  panel_title: "Evidence",
  data_source: "evidence",
  refresh_on: ["INTEGRITY_PASSED", "HYPOTHESIS_CONFIRMED"],
  sort_order: 1,
  badge_type: "count",
});

const SLOT_CONFIDENCE_DASHBOARD = createArtifactSlot({
  id: "confidence_dashboard",
  label: "Confidence",
  component: "ReadinessGauge",
  region: "right_panel",
  panel_title: "Trust",
  data_source: "integrity_score",
  refresh_on: ["INTEGRITY_PASSED", "INTEGRITY_VETOED", "REDTEAM_OBJECTION"],
  sort_order: 2,
  badge_type: "alerts",
});

const SLOT_NARRATIVE_DRAFT = createArtifactSlot({
  id: "narrative_draft",
  label: "Narrative",
  component: "NarrativeBlock",
  region: "center_canvas",
  panel_title: "Executive Narrative",
  data_source: "narrative",
  refresh_on: ["FEEDBACK_RECEIVED", "VE_APPROVED"],
  sort_order: 3,
  badge_type: "none",
});

const SLOT_ASSUMPTION_REGISTER = createArtifactSlot({
  id: "assumption_register",
  label: "Assumptions",
  component: "AssumptionRegister",
  region: "center_canvas",
  panel_title: "Model Assumptions",
  data_source: "assumption",
  refresh_on: ["HYPOTHESIS_CONFIRMED", "MODEL_COMPLETE", "USER_FEEDBACK"],
  sort_order: 4,
  badge_type: "alerts",
});

const SLOT_SCENARIO_COMPARISON = createArtifactSlot({
  id: "scenario_comparison",
  label: "Scenarios",
  component: "ScenarioComparison",
  region: "left_rail",
  panel_title: "Scenarios",
  data_source: "scenario",
  refresh_on: ["MODEL_COMPLETE"],
  sort_order: 5,
  badge_type: "none",
});

const SLOT_SENSITIVITY_TORNADO = createArtifactSlot({
  id: "sensitivity_tornado",
  label: "Sensitivity",
  component: "SensitivityTornado",
  region: "right_panel",
  panel_title: "What-If Analysis",
  data_source: "scenario",
  refresh_on: ["MODEL_COMPLETE"],
  sort_order: 6,
  badge_type: "none",
});

const SLOT_REALIZATION_DASHBOARD = createArtifactSlot({
  id: "realization_dashboard",
  label: "Realization",
  component: "RealizationDashboard",
  region: "center_canvas",
  panel_title: "Value Delivery",
  data_source: "realization_plan",
  refresh_on: ["VE_APPROVED"],
  sort_order: 7,
  badge_type: "confidence",
});

const SLOT_INTEGRITY_SCORE = createArtifactSlot({
  id: "integrity_score",
  label: "Integrity",
  component: "IntegrityScoreCard",
  region: "right_panel",
  panel_title: "Integrity",
  data_source: "integrity_score",
  refresh_on: ["INTEGRITY_PASSED", "INTEGRITY_VETOED"],
  sort_order: 8,
  badge_type: "alerts",
});

// ============================================================================
// Journey Phases
// ============================================================================

export const JOURNEY_PHASES: JourneyPhase[] = [
  // ── Phase 1: Discovery & Baseline ──────────────────────────────────────
  createJourneyPhase({
    lifecycle_stage: "discovery",
    saga_state: "INITIATED",
    label: "Discovery Shell",
    description:
      "Establish the Cost of Inaction (COI) by capturing baseline metrics " +
      "and anchoring the model in validated current-state data.",
    user_goal:
      "Provide customer context — industry, key metrics, pain points — " +
      "so the system can generate an initial Cost of Inaction estimate.",
    artifact_slots: [SLOT_VALUE_TREE, SLOT_EVIDENCE_TABLE, SLOT_CONFIDENCE_DASHBOARD],
    allowed_actions: [
      {
        id: "lock_discovery",
        label: "Lock Discovery",
        surface: "slash_command",
        slash_command: "/lock discovery",
        produces_trigger: "OPPORTUNITY_INGESTED",
        requires_confirmation: true,
        min_confidence: null,
      },
      {
        id: "request_data",
        label: "Request Customer Data",
        surface: "slash_command",
        slash_command: "/request-data",
        produces_trigger: null,
        requires_confirmation: false,
        min_confidence: null,
      },
      {
        id: "challenge",
        label: "Challenge This",
        surface: "button",
        produces_trigger: "REDTEAM_OBJECTION",
        requires_confirmation: false,
        min_confidence: null,
      },
    ],
    exit_conditions: [
      {
        id: "baseline_populated",
        description: "All baseline metrics must be captured",
        type: "all_fields_populated",
      },
      {
        id: "no_open_objections",
        description: "All Red Team objections must be resolved",
        type: "no_unresolved_objections",
      },
    ],
    sort_order: 0,
  }),

  // ── Phase 2: Logic Mapping (Impact Cascade) ────────────────────────────
  createJourneyPhase({
    lifecycle_stage: "drafting",
    saga_state: "DRAFTING",
    label: "Value Tree Canvas",
    description:
      "Map technical features to financial line items using the four-level " +
      "Impact Cascade: Feature → Capability → KPI → Financial Value.",
    user_goal:
      "Review proposed impact cascades, correct feature names, add or remove " +
      "cascades, and provide missing operational data.",
    artifact_slots: [
      SLOT_VALUE_TREE,
      SLOT_EVIDENCE_TABLE,
      SLOT_CONFIDENCE_DASHBOARD,
      SLOT_ASSUMPTION_REGISTER,
    ],
    allowed_actions: [
      {
        id: "lock_logic",
        label: "Lock Logic Mapping",
        surface: "slash_command",
        slash_command: "/lock logic",
        produces_trigger: "HYPOTHESIS_CONFIRMED",
        requires_confirmation: true,
        min_confidence: null,
      },
      {
        id: "add_cascade",
        label: "Add Impact Cascade",
        surface: "slash_command",
        slash_command: "/add-cascade",
        produces_trigger: null,
        requires_confirmation: false,
        min_confidence: null,
      },
      {
        id: "edit_cascade",
        label: "Edit Cascade",
        surface: "inline_edit",
        produces_trigger: null,
        requires_confirmation: false,
        min_confidence: null,
      },
      {
        id: "run_red_team",
        label: "Run Red Team",
        surface: "slash_command",
        slash_command: "/run-red-team",
        produces_trigger: "REDTEAM_OBJECTION",
        requires_confirmation: false,
        min_confidence: null,
      },
    ],
    exit_conditions: [
      {
        id: "min_cascades",
        description: "At least one impact cascade must be mapped per identified pain point",
        type: "min_items",
        threshold: 1,
        target_type: "value_hypothesis",
      },
      {
        id: "four_level_complete",
        description: "All cascades must have all four levels populated (Feature → Capability → KPI → Value)",
        type: "all_fields_populated",
      },
      {
        id: "no_open_objections",
        description: "All Red Team objections must be resolved",
        type: "no_unresolved_objections",
      },
    ],
    sort_order: 1,
  }),

  // ── Phase 3: Quantification & Calculation (TCO) ────────────────────────
  createJourneyPhase({
    lifecycle_stage: "validating",
    saga_state: "VALIDATING",
    label: "Integrity Layer",
    description:
      "Perform rigorous TCO analysis. Account for hidden costs (training, " +
      "API fees, change management). Resolve all cost unknowns.",
    user_goal:
      "Fill in unknown cost lines, review Red Team challenges on estimates, " +
      "and drive overall confidence above the CFO-ready threshold.",
    artifact_slots: [
      SLOT_VALUE_TREE,
      SLOT_EVIDENCE_TABLE,
      SLOT_CONFIDENCE_DASHBOARD,
      SLOT_ASSUMPTION_REGISTER,
      SLOT_SCENARIO_COMPARISON,
      SLOT_SENSITIVITY_TORNADO,
      SLOT_INTEGRITY_SCORE,
    ],
    allowed_actions: [
      {
        id: "lock_quantification",
        label: "Lock Quantification",
        surface: "slash_command",
        slash_command: "/lock quantification",
        produces_trigger: "INTEGRITY_PASSED",
        requires_confirmation: true,
        min_confidence: 0.75,
      },
      {
        id: "show_lineage",
        label: "Show Lineage",
        surface: "slash_command",
        slash_command: "/show-lineage",
        produces_trigger: null,
        requires_confirmation: false,
        min_confidence: null,
      },
      {
        id: "run_red_team",
        label: "Run Red Team",
        surface: "slash_command",
        slash_command: "/run-red-team",
        produces_trigger: "REDTEAM_OBJECTION",
        requires_confirmation: false,
        min_confidence: null,
      },
      {
        id: "fill_missing_costs",
        label: "Fill Missing Costs",
        surface: "button",
        produces_trigger: null,
        requires_confirmation: false,
        min_confidence: null,
      },
    ],
    exit_conditions: [
      {
        id: "all_costs_populated",
        description: "All cost line items must be populated (no unknowns)",
        type: "all_fields_populated",
      },
      {
        id: "no_open_objections",
        description: "All Red Team objections must be resolved",
        type: "no_unresolved_objections",
      },
      {
        id: "min_confidence",
        description: "Overall model confidence must be at or above CFO-ready threshold",
        type: "min_confidence",
        threshold: 0.75,
      },
      {
        id: "integrity_passed",
        description: "Integrity check must pass (score >= 0.6, no critical violations)",
        type: "integrity_passed",
      },
    ],
    sort_order: 2,
  }),

  // ── Phase 4: Composition (Build Business Case) ─────────────────────────
  createJourneyPhase({
    lifecycle_stage: "composing",
    saga_state: "COMPOSING",
    label: "Executive Output Studio",
    description:
      "Compose the customer-facing business case artifact from validated " +
      "hypotheses, financial models, and evidence.",
    user_goal:
      "Review the generated narrative, refine language for the target " +
      "stakeholder, and ensure the story aligns with the financial model.",
    artifact_slots: [
      SLOT_VALUE_TREE,
      SLOT_NARRATIVE_DRAFT,
      SLOT_EVIDENCE_TABLE,
      SLOT_CONFIDENCE_DASHBOARD,
      SLOT_SCENARIO_COMPARISON,
      SLOT_INTEGRITY_SCORE,
    ],
    allowed_actions: [
      {
        id: "lock_composition",
        label: "Lock Business Case",
        surface: "slash_command",
        slash_command: "/lock composition",
        produces_trigger: "FEEDBACK_RECEIVED",
        requires_confirmation: true,
        min_confidence: 0.75,
      },
      {
        id: "export_pdf",
        label: "Export PDF",
        surface: "slash_command",
        slash_command: "/export-pdf",
        produces_trigger: null,
        requires_confirmation: false,
        min_confidence: 0.75,
      },
      {
        id: "export_slides",
        label: "Export Slides",
        surface: "slash_command",
        slash_command: "/export-slides",
        produces_trigger: null,
        requires_confirmation: false,
        min_confidence: 0.75,
      },
    ],
    exit_conditions: [
      {
        id: "narrative_complete",
        description: "Business case narrative must be generated and reviewed",
        type: "min_items",
        threshold: 1,
        target_type: "business_case",
      },
      {
        id: "integrity_passed",
        description: "Integrity check must pass",
        type: "integrity_passed",
      },
    ],
    sort_order: 3,
  }),

  // ── Phase 5: Refinement ────────────────────────────────────────────────
  createJourneyPhase({
    lifecycle_stage: "refining",
    saga_state: "REFINING",
    label: "CFO Collaboration Mode",
    description:
      "Final human review. The VE locks the business case for presentation " +
      "after resolving any remaining feedback.",
    user_goal:
      "Make final adjustments, ensure all stakeholder concerns are addressed, " +
      "and approve the business case for customer delivery.",
    artifact_slots: [
      SLOT_VALUE_TREE,
      SLOT_NARRATIVE_DRAFT,
      SLOT_EVIDENCE_TABLE,
      SLOT_CONFIDENCE_DASHBOARD,
      SLOT_SCENARIO_COMPARISON,
      SLOT_INTEGRITY_SCORE,
    ],
    allowed_actions: [
      {
        id: "approve",
        label: "Approve & Finalize",
        surface: "slash_command",
        slash_command: "/lock refinement",
        produces_trigger: "VE_APPROVED",
        requires_confirmation: true,
        min_confidence: 0.75,
      },
      {
        id: "send_back",
        label: "Send Back for Revision",
        surface: "button",
        produces_trigger: "USER_FEEDBACK",
        requires_confirmation: true,
        min_confidence: null,
      },
      {
        id: "export_pdf",
        label: "Export PDF",
        surface: "slash_command",
        slash_command: "/export-pdf",
        produces_trigger: null,
        requires_confirmation: false,
        min_confidence: 0.75,
      },
    ],
    exit_conditions: [
      {
        id: "ve_approved",
        description: "Value Engineer must explicitly approve the business case",
        type: "custom",
      },
      {
        id: "integrity_passed",
        description: "Integrity check must pass",
        type: "integrity_passed",
      },
    ],
    sort_order: 4,
  }),

  // ── Phase 6: Value Realization (Post-Sale) ─────────────────────────────
  createJourneyPhase({
    lifecycle_stage: "realized",
    saga_state: "FINALIZED",
    label: "Value Realization Workspace",
    description:
      "Continuously measure actual performance against the projected " +
      "business case. Close the loop between sales promises and customer success.",
    user_goal:
      "Monitor realization progress, investigate underperforming hypotheses, " +
      "generate QBR materials, and flag model revisions if actuals diverge.",
    artifact_slots: [
      SLOT_VALUE_TREE,
      SLOT_REALIZATION_DASHBOARD,
      SLOT_EVIDENCE_TABLE,
      SLOT_CONFIDENCE_DASHBOARD,
    ],
    allowed_actions: [
      {
        id: "export_pdf",
        label: "Export QBR PDF",
        surface: "slash_command",
        slash_command: "/export-pdf",
        produces_trigger: null,
        requires_confirmation: false,
        min_confidence: null,
      },
      {
        id: "revise_model",
        label: "Revise Model",
        surface: "button",
        produces_trigger: "USER_FEEDBACK",
        requires_confirmation: true,
        min_confidence: null,
      },
      {
        id: "lock_realization",
        label: "Close Engagement",
        surface: "slash_command",
        slash_command: "/lock realization",
        produces_trigger: "VE_APPROVED",
        requires_confirmation: true,
        min_confidence: null,
      },
    ],
    exit_conditions: [],
    sort_order: 5,
  }),
];

// ============================================================================
// State → UI Mappings
// ============================================================================

export const UI_STATE_MAPPINGS: UIStateMapping[] = [
  // ── INITIATED ──────────────────────────────────────────────────────────
  {
    saga_state: "INITIATED",
    workflow_status: "pending",
    label: "Ready to begin discovery",
    indicator: "idle",
    user_actionable: true,
    cta: { label: "Start Discovery", action_id: "start_discovery" },
    show_confidence: false,
  },
  {
    saga_state: "INITIATED",
    workflow_status: "running",
    label: "Assembling customer context\u2026",
    indicator: "progress",
    user_actionable: false,
    show_confidence: false,
    active_agent_label: "ContextAssemblyAgent",
  },
  {
    saga_state: "INITIATED",
    workflow_status: "completed",
    label: "Discovery baseline captured",
    indicator: "success",
    user_actionable: true,
    cta: { label: "Review Baseline", action_id: "review_baseline" },
    show_confidence: true,
  },
  {
    saga_state: "INITIATED",
    workflow_status: "failed",
    label: "Context assembly failed",
    description: "Unable to retrieve customer data. Check data source connectivity.",
    indicator: "error",
    user_actionable: true,
    cta: { label: "Retry", action_id: "retry" },
    show_confidence: false,
  },
  {
    saga_state: "INITIATED",
    workflow_status: "waiting_approval",
    label: "Baseline ready for review",
    indicator: "blocked",
    user_actionable: true,
    cta: { label: "Review & Lock Discovery", action_id: "lock_discovery" },
    show_confidence: true,
  },

  // ── DRAFTING ───────────────────────────────────────────────────────────
  {
    saga_state: "DRAFTING",
    workflow_status: "pending",
    label: "Ready to map value drivers",
    indicator: "idle",
    user_actionable: true,
    show_confidence: true,
  },
  {
    saga_state: "DRAFTING",
    workflow_status: "running",
    label: "Generating impact cascades\u2026",
    indicator: "streaming",
    user_actionable: false,
    show_confidence: true,
    active_agent_label: "HypothesisAgent",
  },
  {
    saga_state: "DRAFTING",
    workflow_status: "completed",
    label: "Impact cascades ready for review",
    indicator: "success",
    user_actionable: true,
    cta: { label: "Review Cascades", action_id: "review_cascades" },
    show_confidence: true,
  },
  {
    saga_state: "DRAFTING",
    workflow_status: "failed",
    label: "Hypothesis generation failed",
    indicator: "error",
    user_actionable: true,
    cta: { label: "Retry", action_id: "retry" },
    show_confidence: false,
  },
  {
    saga_state: "DRAFTING",
    workflow_status: "waiting_approval",
    label: "Cascades pending VE approval",
    indicator: "blocked",
    user_actionable: true,
    cta: { label: "Review & Lock Logic", action_id: "lock_logic" },
    show_confidence: true,
  },

  // ── VALIDATING ─────────────────────────────────────────────────────────
  {
    saga_state: "VALIDATING",
    workflow_status: "pending",
    label: "Ready to validate assumptions",
    indicator: "idle",
    user_actionable: true,
    show_confidence: true,
  },
  {
    saga_state: "VALIDATING",
    workflow_status: "running",
    label: "Validating financial model\u2026",
    description: "Running integrity checks and fetching evidence to corroborate assumptions.",
    indicator: "progress",
    user_actionable: false,
    show_confidence: true,
    active_agent_label: "IntegrityAgent",
  },
  {
    saga_state: "VALIDATING",
    workflow_status: "completed",
    label: "Validation complete",
    indicator: "success",
    user_actionable: true,
    cta: { label: "Review Results", action_id: "review_validation" },
    show_confidence: true,
  },
  {
    saga_state: "VALIDATING",
    workflow_status: "failed",
    label: "Validation failed",
    description: "One or more integrity checks could not complete.",
    indicator: "error",
    user_actionable: true,
    cta: { label: "Retry Validation", action_id: "retry" },
    show_confidence: true,
  },
  {
    saga_state: "VALIDATING",
    workflow_status: "waiting_approval",
    label: "Review assumptions before locking",
    description: "All assumptions must be reviewed and Red Team objections resolved.",
    indicator: "blocked",
    user_actionable: true,
    cta: { label: "Lock Quantification", action_id: "lock_quantification" },
    show_confidence: true,
  },

  // ── COMPOSING ──────────────────────────────────────────────────────────
  {
    saga_state: "COMPOSING",
    workflow_status: "pending",
    label: "Ready to compose business case",
    indicator: "idle",
    user_actionable: true,
    show_confidence: true,
  },
  {
    saga_state: "COMPOSING",
    workflow_status: "running",
    label: "Composing business case narrative\u2026",
    indicator: "streaming",
    user_actionable: false,
    show_confidence: true,
    active_agent_label: "ArtifactComposer",
  },
  {
    saga_state: "COMPOSING",
    workflow_status: "completed",
    label: "Business case drafted",
    indicator: "success",
    user_actionable: true,
    cta: { label: "Review Narrative", action_id: "review_narrative" },
    show_confidence: true,
  },
  {
    saga_state: "COMPOSING",
    workflow_status: "failed",
    label: "Composition failed",
    indicator: "error",
    user_actionable: true,
    cta: { label: "Retry", action_id: "retry" },
    show_confidence: true,
  },
  {
    saga_state: "COMPOSING",
    workflow_status: "waiting_approval",
    label: "Business case pending review",
    indicator: "blocked",
    user_actionable: true,
    cta: { label: "Lock Business Case", action_id: "lock_composition" },
    show_confidence: true,
  },

  // ── REFINING ───────────────────────────────────────────────────────────
  {
    saga_state: "REFINING",
    workflow_status: "pending",
    label: "Final review pending",
    indicator: "idle",
    user_actionable: true,
    show_confidence: true,
  },
  {
    saga_state: "REFINING",
    workflow_status: "running",
    label: "Applying revisions\u2026",
    indicator: "progress",
    user_actionable: false,
    show_confidence: true,
    active_agent_label: "NarrativeAgent",
  },
  {
    saga_state: "REFINING",
    workflow_status: "completed",
    label: "Revisions applied",
    indicator: "success",
    user_actionable: true,
    cta: { label: "Approve & Finalize", action_id: "approve" },
    show_confidence: true,
  },
  {
    saga_state: "REFINING",
    workflow_status: "failed",
    label: "Revision failed",
    indicator: "error",
    user_actionable: true,
    cta: { label: "Retry", action_id: "retry" },
    show_confidence: true,
  },
  {
    saga_state: "REFINING",
    workflow_status: "waiting_approval",
    label: "Ready for VE final approval",
    indicator: "blocked",
    user_actionable: true,
    cta: { label: "Approve & Finalize", action_id: "approve" },
    show_confidence: true,
  },

  // ── FINALIZED ──────────────────────────────────────────────────────────
  {
    saga_state: "FINALIZED",
    workflow_status: "pending",
    label: "Value realization tracking active",
    indicator: "idle",
    user_actionable: false,
    show_confidence: true,
  },
  {
    saga_state: "FINALIZED",
    workflow_status: "running",
    label: "Analyzing realization data\u2026",
    indicator: "progress",
    user_actionable: false,
    show_confidence: true,
    active_agent_label: "RealizationAgent",
  },
  {
    saga_state: "FINALIZED",
    workflow_status: "completed",
    label: "Engagement complete",
    indicator: "success",
    user_actionable: false,
    show_confidence: true,
  },
];

// ============================================================================
// Interrupt Definitions
// ============================================================================

export const INTERRUPT_DEFINITIONS: InterruptDefinition[] = [
  {
    type: "red_team_objection",
    severity: "high",
    requires_user_action: true,
    allowed_responses: ["accept", "dismiss", "discuss"],
    active_in_phases: ["drafting", "validating", "composing", "refining"],
  },
  {
    type: "evidence_upgrade_available",
    severity: "medium",
    requires_user_action: false,
    allowed_responses: ["accept", "dismiss"],
    active_in_phases: [],
  },
  {
    type: "missing_data_reminder",
    severity: "medium",
    requires_user_action: true,
    allowed_responses: ["accept", "defer"],
    active_in_phases: ["discovery", "drafting", "validating"],
  },
  {
    type: "confidence_threshold_alert",
    severity: "high",
    requires_user_action: true,
    allowed_responses: ["accept", "discuss"],
    active_in_phases: [],
  },
  {
    type: "realization_drift",
    severity: "medium",
    requires_user_action: true,
    allowed_responses: ["accept", "dismiss", "discuss"],
    active_in_phases: ["realized"],
  },
  {
    type: "saga_conflict",
    severity: "high",
    requires_user_action: true,
    allowed_responses: ["accept", "dismiss"],
    active_in_phases: [],
  },
];

// ============================================================================
// Slash Commands
// ============================================================================

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: "lock",
    description: "Validate and lock the named phase; commits saga checkpoint",
    available_in_phases: [],
    args: [
      { name: "phase", description: "Phase to lock (discovery, logic, quantification, composition, refinement, realization)", required: true, type: "phase" },
    ],
  },
  {
    command: "unlock",
    description: "Request unlock of a previously locked phase (audited)",
    available_in_phases: [],
    args: [
      { name: "phase", description: "Phase to unlock", required: true, type: "phase" },
    ],
  },
  {
    command: "show-lineage",
    description: "Display data source, formula, and agent for any number",
    available_in_phases: [],
    args: [
      { name: "item", description: "Item to show lineage for (e.g. 'contractor-spend')", required: true, type: "string" },
    ],
  },
  {
    command: "run-red-team",
    description: "Manually trigger Red Team on all unlocked hypotheses",
    available_in_phases: ["drafting", "validating"],
    args: [],
  },
  {
    command: "add-cascade",
    description: "Start a new Impact Cascade interactively",
    available_in_phases: ["drafting"],
    args: [],
  },
  {
    command: "request-data",
    description: "Generate a structured data request to send to the customer",
    available_in_phases: [],
    args: [
      { name: "type", description: "Type of data to request", required: false, type: "string" },
    ],
  },
  {
    command: "export-pdf",
    description: "Generate a CFO-ready PDF with full lineage appendix",
    available_in_phases: ["validating", "composing", "refining", "realized"],
    args: [],
  },
  {
    command: "export-slides",
    description: "Generate a presentation deck from the narrative",
    available_in_phases: ["composing", "refining", "realized"],
    args: [],
  },
  {
    command: "compare",
    description: "Side-by-side comparison with another engagement",
    available_in_phases: [],
    args: [
      { name: "engagement", description: "Engagement ID or name to compare with", required: true, type: "string" },
    ],
  },
  {
    command: "status",
    description: "Show phase completion, open objections, confidence summary",
    available_in_phases: [],
    args: [],
  },
];

// ============================================================================
// Default Experience Model
// ============================================================================

/**
 * The canonical default ExperienceModel for ValueOS.
 *
 * Tenant-specific overrides can be layered on top of this default by
 * deep-merging phase-level or threshold-level customizations.
 */
export const DEFAULT_EXPERIENCE_MODEL: ExperienceModel = {
  version: 1,
  phases: JOURNEY_PHASES,
  ui_state_mappings: UI_STATE_MAPPINGS,
  interrupt_definitions: INTERRUPT_DEFINITIONS,
  trust_thresholds: DEFAULT_TRUST_THRESHOLDS,
  slash_commands: SLASH_COMMANDS,
};

// ============================================================================
// Lookup Helpers
// ============================================================================

/**
 * Resolve the UI state for a given backend state combination.
 * Returns the matching UIStateMapping or null if no mapping exists.
 */
export function resolveUIState(
  sagaState: string,
  workflowStatus: string,
  model: ExperienceModel = DEFAULT_EXPERIENCE_MODEL
): UIStateMapping | null {
  return (
    model.ui_state_mappings.find(
      (m: UIStateMapping) => m.saga_state === sagaState && m.workflow_status === workflowStatus
    ) ?? null
  );
}

/**
 * Resolve the journey phase for a given lifecycle stage.
 */
export function resolveJourneyPhase(
  lifecycleStage: string,
  model: ExperienceModel = DEFAULT_EXPERIENCE_MODEL
): JourneyPhase | null {
  return model.phases.find((p: JourneyPhase) => p.lifecycle_stage === lifecycleStage) ?? null;
}

/**
 * Get all slash commands available in a given lifecycle stage.
 */
export function getAvailableSlashCommands(
  lifecycleStage: string,
  model: ExperienceModel = DEFAULT_EXPERIENCE_MODEL
): SlashCommand[] {
  return model.slash_commands.filter(
    (c: SlashCommand) =>
      c.available_in_phases.length === 0 ||
      c.available_in_phases.includes(lifecycleStage as never)
  );
}

/**
 * Get all interrupt definitions active in a given lifecycle stage.
 */
export function getActiveInterrupts(
  lifecycleStage: string,
  model: ExperienceModel = DEFAULT_EXPERIENCE_MODEL
): InterruptDefinition[] {
  return model.interrupt_definitions.filter(
    (d: InterruptDefinition) =>
      d.active_in_phases.length === 0 ||
      d.active_in_phases.includes(lifecycleStage as never)
  );
}
