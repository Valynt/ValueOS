/**
 * ValueGraphEdge — Value Graph relationship
 *
 * A typed, weighted, evidence-linked edge between two Value Graph entities.
 * Edges are the core primitive that makes ROI paths deterministic and
 * explainable — every causal claim is a traversable edge with a confidence
 * score and evidence links.
 *
 * Canonical edge types and their allowed source → target pairs:
 *
 *   company_has_persona               Account         → Stakeholder
 *   persona_executes_use_case         Stakeholder     → UseCase
 *   use_case_enabled_by_capability    UseCase         → VgCapability
 *   capability_impacts_metric         VgCapability    → VgMetric
 *   metric_maps_to_value_driver       VgMetric        → VgValueDriver
 *   evidence_supports_metric          Evidence        → VgMetric
 *   hypothesis_claims_value_driver    ValueHypothesis → VgValueDriver
 *   narrative_explains_hypothesis     Narrative       → ValueHypothesis
 *   target_quantifies_driver          VgMetric        → VgValueDriver
 *   realization_tracks_target         Evidence        → VgMetric
 *   expansion_extends_node            UseCase         → VgCapability
 *   audit_verifies_node               Evidence        → VgValueDriver
 *
 * Sprint 47: Initial definition.
 * Sprint 48: Renamed hypothesis_claims_metric → hypothesis_claims_value_driver to match
 *            the actual target entity type (VgValueDriver, not VgMetric).
 * Sprint 49: Added 5 new edge types for remaining agents. Added `narrative` entity type.
 *            Added EDGE_TYPE_CONSTRAINTS compile-time guardrail and EdgeConstraintViolationError.
 */

import { z } from "zod";

export const ValueGraphEntityTypeSchema = z.enum([
  "account",
  "stakeholder",
  "use_case",
  "vg_capability",
  "vg_metric",
  "vg_value_driver",
  "evidence",
  "value_hypothesis",
  "narrative",
]);
export type ValueGraphEntityType = z.infer<typeof ValueGraphEntityTypeSchema>;

export const ValueGraphEdgeTypeSchema = z.enum([
  "company_has_persona",
  "persona_executes_use_case",
  "use_case_enabled_by_capability",
  "capability_impacts_metric",
  "metric_maps_to_value_driver",
  "evidence_supports_metric",
  "hypothesis_claims_value_driver",
  // Sprint 49 — remaining agents
  "narrative_explains_hypothesis",
  "target_quantifies_driver",
  "realization_tracks_target",
  "expansion_extends_node",
  "audit_verifies_node",
]);
export type ValueGraphEdgeType = z.infer<typeof ValueGraphEdgeTypeSchema>;

/**
 * Compile-time-enforced allowlist of valid (from_entity_type, to_entity_type)
 * pairs for each edge_type. ValueGraphService.writeEdge validates against this
 * at runtime and throws EdgeConstraintViolationError on mismatch.
 *
 * The `as const satisfies` pattern ensures TypeScript catches any entry that
 * references an unknown entity type or edge type at compile time.
 */
export const EDGE_TYPE_CONSTRAINTS = {
  company_has_persona:            { from: "account",          to: "stakeholder"      },
  persona_executes_use_case:      { from: "stakeholder",      to: "use_case"         },
  use_case_enabled_by_capability: { from: "use_case",         to: "vg_capability"    },
  capability_impacts_metric:      { from: "vg_capability",    to: "vg_metric"        },
  metric_maps_to_value_driver:    { from: "vg_metric",        to: "vg_value_driver"  },
  evidence_supports_metric:       { from: "evidence",         to: "vg_metric"        },
  hypothesis_claims_value_driver: { from: "value_hypothesis", to: "vg_value_driver"  },
  narrative_explains_hypothesis:  { from: "narrative",        to: "value_hypothesis" },
  target_quantifies_driver:       { from: "vg_metric",        to: "vg_value_driver"  },
  realization_tracks_target:      { from: "evidence",         to: "vg_metric"        },
  expansion_extends_node:         { from: "use_case",         to: "vg_capability"    },
  audit_verifies_node:            { from: "evidence",         to: "vg_value_driver"  },
} as const satisfies Record<ValueGraphEdgeType, { from: ValueGraphEntityType; to: ValueGraphEntityType }>;

/**
 * Thrown by ValueGraphService.writeEdge when the (from_entity_type, edge_type,
 * to_entity_type) triple does not match EDGE_TYPE_CONSTRAINTS.
 * Agents' safeWrite catches this and logs it without propagating.
 */
export class EdgeConstraintViolationError extends Error {
  constructor(
    public readonly edgeType: ValueGraphEdgeType,
    public readonly fromEntityType: ValueGraphEntityType,
    public readonly toEntityType: ValueGraphEntityType,
  ) {
    const constraint = EDGE_TYPE_CONSTRAINTS[edgeType];
    super(
      `EdgeConstraintViolation: edge_type="${edgeType}" requires ` +
      `from="${constraint.from}" → to="${constraint.to}", ` +
      `but got from="${fromEntityType}" → to="${toEntityType}"`,
    );
    this.name = "EdgeConstraintViolationError";
  }
}

export const ValueGraphEdgeSchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** Tenant that owns this record. All queries must filter on this. */
  organization_id: z.string().uuid(),

  /** The opportunity this edge belongs to. */
  opportunity_id: z.string().uuid(),

  /** Entity type of the source node. */
  from_entity_type: ValueGraphEntityTypeSchema,

  /** UUID of the source entity. */
  from_entity_id: z.string().uuid(),

  /** Entity type of the target node. */
  to_entity_type: ValueGraphEntityTypeSchema,

  /** UUID of the target entity. */
  to_entity_id: z.string().uuid(),

  /** Semantic relationship type. */
  edge_type: ValueGraphEdgeTypeSchema,

  /**
   * Confidence that this relationship holds (0–1).
   * Set by the agent that created the edge; updated by IntegrityAgent.
   */
  confidence_score: z.number().min(0).max(1).default(0.5),

  /**
   * IDs of Evidence entities that support this edge.
   * An edge with no evidence links is treated as agent inference (silver tier).
   */
  evidence_ids: z.array(z.string().uuid()).default([]),

  /**
   * Name of the agent that created this edge.
   * Used for contradiction detection and audit.
   */
  created_by_agent: z.string().min(1).max(100),

  /** Ontology version this edge was written under. */
  ontology_version: z.string().default("1.0"),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ValueGraphEdge = z.infer<typeof ValueGraphEdgeSchema>;
