/**
 * @valueos/sdui-types
 *
 * Shared type contract between agent output and SDUI template rendering.
 * Templates import from this package; agents produce output conforming to it.
 * This is the boundary — types here must match what agents actually emit.
 */

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/** The set of lifecycle stages that have SDUI chat templates. */
export type LifecycleStage =
  | "opportunity"
  | "target"
  | "realization"
  | "expansion";

// ---------------------------------------------------------------------------
// WorkflowState
// ---------------------------------------------------------------------------

export interface WorkflowState {
  /** Current lifecycle stage. */
  stage: LifecycleStage;
  /** Arbitrary context bag — templates read context.caseId. */
  context: {
    caseId?: string;
    [key: string]: unknown;
  };
  /** ISO timestamp of last state transition. */
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// SystemMap
// ---------------------------------------------------------------------------

export interface SystemEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
  /** Relative influence weight within the system (0–1). */
  influence?: number;
}

export interface SystemRelationship {
  id: string;
  source_id: string;
  target_id: string;
  /** Causal direction: reinforcing or balancing. */
  type: "reinforcing" | "balancing" | "neutral";
  /** Strength of the relationship (0–1). */
  strength?: number;
  description?: string;
}

export interface LeveragePoint {
  id: string;
  entity_id: string;
  name: string;
  description?: string;
  /** Estimated leverage score (0–1). */
  leverage_score?: number;
  category?: string;
}

export interface SystemConstraint {
  id: string;
  name: string;
  description?: string;
  type?: string;
}

export interface SystemMap {
  id: string;
  name: string;
  description?: string;
  entities: SystemEntity[];
  relationships: SystemRelationship[];
  leverage_points: LeveragePoint[];
  constraints: SystemConstraint[];
}

// ---------------------------------------------------------------------------
// InterventionPoint
// ---------------------------------------------------------------------------

export interface InterventionPoint {
  id: string;
  name: string;
  description?: string;
  /** The leverage point this intervention targets. */
  leverage_point_id?: string;
  /** Mechanism by which the intervention produces change. */
  mechanism?: string;
  /** Expected delay before observable effect (in days). */
  delay_days?: number;
  /** Estimated confidence in the intervention (0–1). */
  confidence?: number;
  status?: "proposed" | "validated" | "active" | "completed";
}

// ---------------------------------------------------------------------------
// OutcomeHypothesis
// ---------------------------------------------------------------------------

export interface OutcomeHypothesis {
  id: string;
  statement: string;
  /** Causal chain steps from intervention to outcome. */
  causal_chain?: string[];
  assumptions?: string[];
  evidence?: string[];
  confidence?: number;
  status?: "draft" | "validated" | "rejected";
}

// ---------------------------------------------------------------------------
// FeedbackLoop
// ---------------------------------------------------------------------------

/**
 * A single system update event recorded within a feedback loop.
 * Rendered by the SystemUpdateLog SDUI component.
 */
export interface SystemUpdate {
  id: string;
  timestamp: string;
  description: string;
  type?: string;
  /** Entity or metric that changed. */
  affected_entity?: string;
  delta?: number;
  unit?: string;
}

/**
 * A quantitative measurement captured during a feedback loop iteration.
 * Rendered by the LoopMetricsPanel SDUI component.
 */
export interface LoopMetric {
  id: string;
  name: string;
  value: number;
  unit?: string;
  timestamp: string;
  baseline?: number;
  target?: number;
}

export interface FeedbackLoop {
  id: string;
  name: string;
  description?: string;
  /** "active" loops are currently running; "closed" loops have completed. */
  realization_stage: "active" | "monitoring" | "closed";
  closure_status: "open" | "closed" | "stalled";
  /** System state changes recorded within this loop. */
  system_updates: SystemUpdate[];
  /** Quantitative measurements for this loop. */
  loop_metrics: LoopMetric[];
  intervention_point_id?: string;
  started_at?: string;
  closed_at?: string;
}
